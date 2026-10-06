import { describe, expect, it, vi, beforeEach } from "vitest"
import { ref, computed } from "vue"
import { useInspectorActions } from "../src/ui/dock/useInspectorActions"
import * as apiModule from "../src/api"
import * as domSyncModule from "../src/sync/dom-attr-sync"
import { globalDocumentCompiler } from "../src/compiler/document-compiler"

describe("useInspectorActions (Inspector 操作与 API 编排)", () => {
  let ctx: any
  let actions: any

  beforeEach(() => {
    ctx = {
      activeBlockId: ref("block-101"),
      activeBlockType: ref("NodeParagraph"),
      activeBlockAttrs: ref<Record<string, string>>({}),
      rawSnippet: ref("测试文本"),
      currentDocId: ref("doc-001"),
      currentPageDividerId: ref("div-1"),
      currentPageDividerLayout: ref(""),
      latestDoc: ref<any>({
        docId: "doc-001",
        slides: [],
        config: {},
      }),
      targetSlide: computed(() => null),
      currentSlideNoteBlockId: computed(() => ""),
      currentSlideLayout: computed(() => "default"),
      isNoteBlock: computed(() => false),
      elemClick: computed(() => ctx.activeBlockAttrs.value["custom-slidev-click"] || ""),
      videoAutoplay: computed(() => ctx.activeBlockAttrs.value["custom-slidev-autoplay"] === "true"),
      videoLoop: computed(() => ctx.activeBlockAttrs.value["custom-slidev-loop"] === "true"),
      videoMuted: computed(() => ctx.activeBlockAttrs.value["custom-slidev-muted"] === "true"),
      videoControls: computed(() => ctx.activeBlockAttrs.value["custom-slidev-controls"] !== "false"),
      pageBackground: ref(""),
      pageImage: ref(""),
      elemShikiLines: ref(""),
      elemMaxHeight: ref(""),
      saveStatus: ref(""),
      plugin: {
        compileCurrentDocument: vi.fn(),
      },
    }

    actions = useInspectorActions(ctx)
  })

  it("saveAttr 应同步内存属性、内存覆盖层并调用思源 API", async () => {
    const setBlockAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    const syncDomSpy = vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})
    const setOverrideSpy = vi.spyOn(globalDocumentCompiler, "setBlockAttrOverride")

    await actions.saveAttr("custom-slidev-click", "+1")

    expect(ctx.activeBlockAttrs.value["custom-slidev-click"]).toBe("+1")
    expect(setOverrideSpy).toHaveBeenCalledWith("block-101", { "custom-slidev-click": "+1" })
    expect(syncDomSpy).toHaveBeenCalledWith("block-101", { "custom-slidev-click": "+1" })
    expect(setBlockAttrsSpy).toHaveBeenCalledWith("block-101", { "custom-slidev-click": "+1" })
    expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalled()

    setBlockAttrsSpy.mockRestore()
    syncDomSpy.mockRestore()
    setOverrideSpy.mockRestore()
  })

  it("onToggleVideoAutoplay 应联动开启静音播放 (autoplay=true, muted=true)", async () => {
    vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await actions.onToggleVideoAutoplay()

    expect(ctx.activeBlockAttrs.value["custom-slidev-autoplay"]).toBe("true")
    expect(ctx.activeBlockAttrs.value["custom-slidev-muted"]).toBe("true")
  })

  it("onClearBlockAttrs 应清除所有演示属性并清空本地响应式状态", async () => {
    ctx.activeBlockAttrs.value = {
      "custom-slidev-click": "+1",
      "custom-slidev-slot": "left",
    }
    ctx.elemShikiLines.value = "1-3"
    ctx.elemMaxHeight.value = "300px"

    const setBlockAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})
    const clearOverrideSpy = vi.spyOn(globalDocumentCompiler, "clearBlockAttrOverride")

    await actions.onClearBlockAttrs()

    expect(setBlockAttrsSpy).toHaveBeenCalled()
    expect(clearOverrideSpy).toHaveBeenCalledWith("block-101")
    expect(Object.keys(ctx.activeBlockAttrs.value).length).toBe(0)
    expect(ctx.elemShikiLines.value).toBe("")
    expect(ctx.elemMaxHeight.value).toBe("")
  })

  it("onInsertDividerBefore 应调用 insertBlock 插入分割线", async () => {
    const insertSpy = vi.spyOn(apiModule, "insertBlock").mockResolvedValue({} as any)

    await actions.onInsertDividerBefore()

    expect(insertSpy).toHaveBeenCalledWith("markdown", "---", "block-101", undefined)
    expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalled()

    insertSpy.mockRestore()
  })
})
