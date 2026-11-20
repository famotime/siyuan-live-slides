import { describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import { usePeekDrawerState } from "../src/ui/tab/usePeekDrawerState"
import { updatePreviewTabHeader } from "../src/plugin/preview-tab-title"
import { InspectorSyncCoordinator } from "../src/sync/inspector-sync-coordinator"
import * as mainModule from "../src/main"
import * as apiModule from "../src/api"
import * as domAttrSyncModule from "../src/sync/dom-attr-sync"

/**
 * 状态机审计 FIX-10 (P1-E)：异步乱序完成代际卫——
 * 多 await 请求期间有更新请求发起时，先发起请求的陈旧完成不得覆写状态
 */
describe("异步乱序代际卫 (P1-E2/P1-E3)", () => {
  it("速览抽屉：SQL 探测晚返回的先点请求不覆写后点链接的状态 (P1-E2)", async () => {
    let resolveDetectA!: (v: boolean) => void
    const freezeKeyboardNav = vi.fn()
    const state = usePeekDrawerState({
      sandboxBridge: { freezeKeyboardNav } as any,
      getLatestDoc: () => null,
      getSettings: () => ({ enableWebServeJump: true, webServeUrl: "http://127.0.0.1:6806" } as any),
      buildWebUrl: (base: string, target: string) => `${base}/stub/${target}`,
      resolveUrl: (target: string) => ({ url: target, external: false }),
      detectDocBlock: (targetId: string) => {
        if (targetId === "block-a") {
          return new Promise<boolean>(resolve => { resolveDetectA = resolve })
        }
        return Promise.resolve(false)
      },
      openExternalUrl: () => {},
    })

    // 先点 block-a（慢 SQL 挂起），等其进入 await 后再点 block-b（立即完成）
    const openA = state.handleOpenPeekDrawer({ peekType: 'siyuan', target: "block-a", title: "A" } as any)
    await new Promise(resolve => setTimeout(resolve, 0))
    await state.handleOpenPeekDrawer({ peekType: 'siyuan', target: "block-b", title: "B" } as any)
    expect(state.peekUrl.value).toContain("block-b")
    expect(state.isDrawerOpen.value).toBe(true)

    // block-a 的 SQL 晚返回：代际已过期，不得覆写为 block-a
    resolveDetectA(false)
    await openA
    expect(state.peekUrl.value).toContain("block-b")
    expect(state.drawerTitle.value).toContain("B")
    expect(freezeKeyboardNav).toHaveBeenCalled()
  })

  it("预览页签标题：显式标题的更新先完成后，慢解析的先发请求不覆写 (P1-E3)", async () => {
    let resolveFetchA!: (v: string) => void
    const host = {
      currentDocId: "doc-b",
      latestCompiledDoc: null,
      previewTab: { updateTitle: vi.fn() },
      getActiveDocumentId: () => "",
      fetchDocumentTitle: (docId: string) => {
        if (docId === "doc-a") {
          return new Promise<string>(resolve => { resolveFetchA = resolve })
        }
        return Promise.resolve("doc-b-title")
      },
    }

    // 先发起 doc-a 慢解析
    const slow = updatePreviewTabHeader(host as any, undefined, "doc-a")
    // 再发起 doc-b 显式标题（无 await，立即写标题）
    await updatePreviewTabHeader(host as any, "已定标题B", "doc-b")
    expect(host.previewTab.updateTitle).toHaveBeenCalledTimes(1)
    expect(host.previewTab.updateTitle).toHaveBeenLastCalledWith("即现（已定标题B）")

    // 慢解析晚返回：代际已过期，不得覆写
    resolveFetchA("doc-a-标题")
    await slow
    expect(host.previewTab.updateTitle).toHaveBeenCalledTimes(1)
    expect(host.previewTab.updateTitle).toHaveBeenLastCalledWith("即现（已定标题B）")
  })

  it("光标联动：属性解析晚返回的先选块不覆写后选块的配置面板 (P1-E3)", async () => {
    const updateInspectorSpy = vi.spyOn(mainModule, "updateInspectorCurrentBlock").mockImplementation(() => {})
    const syncDomSpy = vi.spyOn(domAttrSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})
    let resolveGetAttrsA!: (v: any) => void
    const getBlockAttrsSpy = vi.spyOn(apiModule, "getBlockAttrs").mockImplementation((id: string) => {
      if (id === "block-a") {
        return new Promise<any>(resolve => { resolveGetAttrsA = resolve })
      }
      return Promise.resolve({})
    })

    const coordinator = new InspectorSyncCoordinator()
    const makeEl = (id: string) => ({
      id,
      closest: () => null,
      getAttribute: (n: string) => (n === "data-node-id" ? id : null),
      classList: { contains: () => false },
      parentElement: null,
      previousElementSibling: null,
      innerText: "文本",
      querySelector: () => null,
    } as unknown as HTMLElement)

    // 先选 block-a（慢内核查询挂起）
    const slowA = coordinator.syncInspectorBlock(makeEl("block-a"), "block-a", "p", "doc-1", null)
    // 再选 block-b（快查询立即完成）
    await coordinator.syncInspectorBlock(makeEl("block-b"), "block-b", "p", "doc-1", null)
    const callsAfterB = updateInspectorSpy.mock.calls.length
    expect(callsAfterB).toBeGreaterThan(0)
    expect(updateInspectorSpy.mock.calls[callsAfterB - 1][0].id).toBe("block-b")

    // block-a 查询晚返回：代际已过期，不得覆写面板
    resolveGetAttrsA({ "custom-slides-layout": "stale" })
    await slowA
    expect(updateInspectorSpy.mock.calls[updateInspectorSpy.mock.calls.length - 1][0].id).toBe("block-b")

    updateInspectorSpy.mockRestore()
    syncDomSpy.mockRestore()
    getBlockAttrsSpy.mockRestore()
  })
})
