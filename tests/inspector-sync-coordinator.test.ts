import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { InspectorSyncCoordinator } from "../src/sync/inspector-sync-coordinator"
import { globalDocumentCompiler } from "../src/compiler/document-compiler"
import * as mainModule from "../src/main"
import * as domAttrSyncModule from "../src/sync/dom-attr-sync"
import type { ISlidevDocument } from "../src/types/slidev-protocol"

describe("InspectorSyncCoordinator (编辑器与配置面板同步协调器)", () => {
  let coordinator: InspectorSyncCoordinator

  beforeEach(() => {
    coordinator = new InspectorSyncCoordinator()
  })

  afterEach(() => {
    delete (globalThis as any).document
  })

  it("在非 DOM 环境下 getActiveDocumentId 应安全返回空字符串", () => {
    delete (globalThis as any).document
    expect(coordinator.getActiveDocumentId()).toBe("")
  })

  it("resolveDocIdFromElement 在无法寻址时应返回回退 fallbackDocId", () => {
    const mockEl = {
      closest: vi.fn(() => null),
    } as any

    expect(coordinator.resolveDocIdFromElement(mockEl, "fallback-123")).toBe("fallback-123")
  })

  it("patchThematicBreakTransactions 应正确提取事务中的 updateAttrs 并写入覆盖层", () => {
    const setOverrideSpy = vi.spyOn(globalDocumentCompiler, "setBlockAttrOverride")
    const syncDomSpy = vi.spyOn(domAttrSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    const mockTxData = {
      cmd: "transactions",
      data: [
        {
          doOperations: [
            {
              action: "updateAttrs",
              id: "divider-99",
              data: {
                old: { "custom-slidev-layout": "cover" },
                new: { "custom-slidev-layout": "two-cols" },
              },
            },
          ],
        },
      ],
    }

    coordinator.patchThematicBreakTransactions(mockTxData)

    expect(setOverrideSpy).toHaveBeenCalledWith("divider-99", expect.objectContaining({
      "custom-slidev-layout": "two-cols",
    }))
    expect(syncDomSpy).toHaveBeenCalledWith("divider-99", expect.objectContaining({
      "custom-slidev-layout": "two-cols",
    }))

    setOverrideSpy.mockRestore()
    syncDomSpy.mockRestore()
  })

  it("purgeStaleDomSlidevAttrs 应遍历文档版式与角色并下发巡检清理", () => {
    (globalThis as any).document = { querySelectorAll: vi.fn(() => []) }
    const purgeSpy = vi.spyOn(domAttrSyncModule, "purgeStaleDomSlidevAttrs").mockImplementation(() => {})

    const mockDoc: ISlidevDocument = {
      docId: "doc-1",
      config: { theme: "default", aspectRatio: "16/9", highlighter: "shiki" } as any,
      slides: [
        {
          pageIndex: 1,
          startBlockId: "div-1",
          frontmatter: { layout: "cover" },
          notes: "",
          blocks: [
            {
              id: "b-1",
              type: "p",
              content: "",
              rawMarkdown: "",
              ial: { "custom-slidev-role": "background" },
            },
          ],
          rawMarkdown: "",
        },
      ],
      fullMarkdown: "",
    }

    coordinator.purgeStaleDomSlidevAttrs(mockDoc)

    expect(purgeSpy).toHaveBeenCalled()
    const validMap = purgeSpy.mock.calls[0][0] as Map<string, Record<string, string>>
    expect(validMap.get("div-1")?.["custom-slidev-layout"]).toBe("cover")
    expect(validMap.get("b-1")?.["custom-slidev-role"]).toBe("background")

    purgeSpy.mockRestore()
  })
})
