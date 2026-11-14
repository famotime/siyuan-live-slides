import { describe, expect, it, vi, beforeEach } from "vitest"
import { ref, computed } from "vue"
import { useInspectorActions } from "../src/ui/dock/useInspectorActions"
import * as apiModule from "../src/api"
import * as domSyncModule from "../src/sync/dom-attr-sync"
import * as superblockTransformModule from "../src/sync/superblock-transform"
import * as siyuanModule from "siyuan"
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
      elemClick: computed(() => ctx.activeBlockAttrs.value["custom-slides-click"] || ""),
      videoAutoplay: computed(() => ctx.activeBlockAttrs.value["custom-slides-autoplay"] === "true"),
      videoLoop: computed(() => ctx.activeBlockAttrs.value["custom-slides-loop"] === "true"),
      videoMuted: computed(() => ctx.activeBlockAttrs.value["custom-slides-muted"] === "true"),
      videoControls: computed(() => ctx.activeBlockAttrs.value["custom-slides-controls"] !== "false"),
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

    await actions.saveAttr("custom-slides-click", "+1")

    expect(ctx.activeBlockAttrs.value["custom-slides-click"]).toBe("+1")
    expect(setOverrideSpy).toHaveBeenCalledWith("block-101", { "custom-slides-click": "+1" })
    expect(syncDomSpy).toHaveBeenCalledWith("block-101", { "custom-slides-click": "+1" })
    expect(setBlockAttrsSpy).toHaveBeenCalledWith("block-101", { "custom-slides-click": "+1" })
    expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalled()

    setBlockAttrsSpy.mockRestore()
    syncDomSpy.mockRestore()
    setOverrideSpy.mockRestore()
  })

  it("onToggleVideoAutoplay 应联动开启静音播放 (autoplay=true, muted=true)", async () => {
    vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await actions.onToggleVideoAutoplay()

    expect(ctx.activeBlockAttrs.value["custom-slides-autoplay"]).toBe("true")
    expect(ctx.activeBlockAttrs.value["custom-slides-muted"]).toBe("true")
  })

  it("onClearBlockAttrs 应先弹出警告弹窗，并在确认后清除所有演示属性并清空本地响应式状态", async () => {
    ctx.activeBlockAttrs.value = {
      "custom-slides-click": "+1",
      "custom-slides-slot": "left",
    }
    ctx.elemShikiLines.value = "1-3"
    ctx.elemMaxHeight.value = "300px"

    const confirmSpy = vi.spyOn(siyuanModule, "confirm").mockImplementation((_title, _text, confirmCb) => {
      confirmCb?.()
    })
    const setBlockAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})
    const clearOverrideSpy = vi.spyOn(globalDocumentCompiler, "clearBlockAttrOverride")

    await actions.onClearBlockAttrs()

    expect(confirmSpy).toHaveBeenCalledWith(
      "清除块演示属性",
      "确定要清除当前块的所有演示属性（包含动画、插槽、备注等）吗？此操作无法撤销。",
      expect.any(Function)
    )
    expect(setBlockAttrsSpy).toHaveBeenCalled()
    expect(clearOverrideSpy).toHaveBeenCalledWith("block-101")
    expect(Object.keys(ctx.activeBlockAttrs.value).length).toBe(0)
    expect(ctx.elemShikiLines.value).toBe("")
    expect(ctx.elemMaxHeight.value).toBe("")

    confirmSpy.mockRestore()
  })

  it("onClearBlockAttrs - 当用户在弹窗中取消时不应执行清除", async () => {
    ctx.activeBlockAttrs.value = {
      "custom-slides-click": "+1",
    }
    const confirmSpy = vi.spyOn(siyuanModule, "confirm").mockImplementation((_title, _text, _confirmCb, cancelCb) => {
      cancelCb?.()
    })
    const setBlockAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs")

    await actions.onClearBlockAttrs()

    expect(confirmSpy).toHaveBeenCalled()
    expect(setBlockAttrsSpy).not.toHaveBeenCalled()
    expect(ctx.activeBlockAttrs.value["custom-slides-click"]).toBe("+1")

    confirmSpy.mockRestore()
  })

  it("onInsertDividerBefore 应调用 insertBlock 插入分割线", async () => {
    const insertSpy = vi.spyOn(apiModule, "insertBlock").mockResolvedValue({} as any)

    await actions.onInsertDividerBefore()

    expect(insertSpy).toHaveBeenCalledWith("markdown", "---", "block-101", undefined)
    expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalled()

    insertSpy.mockRestore()
  })

  describe("演讲者题词批量操作 (Batch Notes Operations)", () => {
    it("onBatchAppendNotes - 当所有页均已有讲稿时应提示无需追加且不弹窗确认", async () => {
      ctx.latestDoc.value.slides = [
        { pageIndex: 1, noteBlocks: [{ id: "n-1" }], notes: "备注1" },
        { pageIndex: 2, noteBlocks: [], notes: "备注2" },
      ]

      const confirmSpy = vi.spyOn(siyuanModule, "confirm")
      const showMessageSpy = vi.spyOn(siyuanModule, "showMessage")

      await actions.onBatchAppendNotes()

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(showMessageSpy).toHaveBeenCalledWith("所有幻灯片页面均已存在讲稿备注块，无需追加")

      confirmSpy.mockRestore()
      showMessageSpy.mockRestore()
    })

    it("onBatchAppendNotes - 仅对无讲稿的页面批量追加讲稿块并在确认后执行", async () => {
      ctx.latestDoc.value.slides = [
        { pageIndex: 1, startBlockId: "div-1", noteBlocks: [{ id: "n-1" }], notes: "已存在" },
        { pageIndex: 2, startBlockId: "div-2", noteBlocks: [], notes: "", blocks: [{ id: "b-2" }] },
      ]

      let cbPromise: any = null
      const confirmSpy = vi.spyOn(siyuanModule, "confirm").mockImplementation((title, text, confirmCb) => {
        expect(title).toBe("批量追加讲稿备注")
        expect(text).toContain("将在未配置讲稿的 1 页末尾自动插入讲稿提示块")
        cbPromise = confirmCb?.()
      })
      const insertSpy = vi.spyOn(apiModule, "insertBlock").mockResolvedValue([{ id: "new-note-block-id" }] as any)
      const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
      const showMessageSpy = vi.spyOn(siyuanModule, "showMessage")

      await actions.onBatchAppendNotes()
      await cbPromise

      expect(confirmSpy).toHaveBeenCalled()
      expect(insertSpy).toHaveBeenCalledTimes(1)
      expect(setAttrsSpy).toHaveBeenCalledWith("new-note-block-id", { "custom-slides-note": "true" })
      expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalled()
      expect(showMessageSpy).toHaveBeenCalledWith("已成功为 1 页追加讲稿备注块")

      confirmSpy.mockRestore()
      insertSpy.mockRestore()
      setAttrsSpy.mockRestore()
      showMessageSpy.mockRestore()
    })

    it("onBatchAppendNotes - 当用户取消确认弹窗时不执行任何插入", async () => {
      ctx.latestDoc.value.slides = [
        { pageIndex: 1, startBlockId: "div-1", noteBlocks: [], notes: "" },
      ]

      const confirmSpy = vi.spyOn(siyuanModule, "confirm").mockImplementation((_title, _text, _confirmCb, cancelCb) => {
        cancelCb?.()
      })
      const insertSpy = vi.spyOn(apiModule, "insertBlock")

      await actions.onBatchAppendNotes()

      expect(confirmSpy).toHaveBeenCalled()
      expect(insertSpy).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
      insertSpy.mockRestore()
    })

    it("onBatchDeleteNotes - 当文档无讲稿块时应提示无需删除且不弹窗确认", async () => {
      ctx.latestDoc.value.slides = [
        { pageIndex: 1, noteBlocks: [] },
        { pageIndex: 2, noteBlocks: [] },
      ]

      const confirmSpy = vi.spyOn(siyuanModule, "confirm")
      const showMessageSpy = vi.spyOn(siyuanModule, "showMessage")

      await actions.onBatchDeleteNotes()

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(showMessageSpy).toHaveBeenCalledWith("当前文档中没有讲稿备注块，无需删除")

      confirmSpy.mockRestore()
      showMessageSpy.mockRestore()
    })

    it("onBatchDeleteNotes - 物理删除全部讲稿块并在确认后执行", async () => {
      ctx.latestDoc.value.slides = [
        { pageIndex: 1, noteBlocks: [{ id: "note-1" }] },
        { pageIndex: 2, noteBlocks: [{ id: "note-2" }, { id: "note-3" }] },
      ]
      ctx.activeBlockId.value = "note-2"
      ctx.activeBlockAttrs.value = { "custom-slides-note": "true" }

      let cbPromise: any = null
      const confirmSpy = vi.spyOn(siyuanModule, "confirm").mockImplementation((title, text, confirmCb) => {
        expect(title).toBe("危险操作：批量删除所有讲稿块")
        expect(text).toContain("全部 3 个讲稿备注块（涉及 2 页）")
        cbPromise = confirmCb?.()
      })
      const deleteBlockSpy = vi.spyOn(apiModule, "deleteBlock").mockResolvedValue({} as any)
      const showMessageSpy = vi.spyOn(siyuanModule, "showMessage")

      await actions.onBatchDeleteNotes()
      await cbPromise

      expect(confirmSpy).toHaveBeenCalled()
      expect(deleteBlockSpy).toHaveBeenCalledTimes(3)
      expect(deleteBlockSpy).toHaveBeenCalledWith("note-1")
      expect(deleteBlockSpy).toHaveBeenCalledWith("note-2")
      expect(deleteBlockSpy).toHaveBeenCalledWith("note-3")
      expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalled()
      expect(ctx.activeBlockAttrs.value["custom-slides-note"]).toBeUndefined()
      expect(showMessageSpy).toHaveBeenCalledWith("已成功删除全部 3 个讲稿备注块")

      confirmSpy.mockRestore()
      deleteBlockSpy.mockRestore()
      showMessageSpy.mockRestore()
    })

    it("onBatchDeleteNotes - 当用户取消确认弹窗时不执行删除", async () => {
      ctx.latestDoc.value.slides = [
        { pageIndex: 1, noteBlocks: [{ id: "note-1" }] },
      ]

      const confirmSpy = vi.spyOn(siyuanModule, "confirm").mockImplementation((_title, _text, _confirmCb, cancelCb) => {
        cancelCb?.()
      })
      const deleteBlockSpy = vi.spyOn(apiModule, "deleteBlock")

      await actions.onBatchDeleteNotes()

      expect(confirmSpy).toHaveBeenCalled()
      expect(deleteBlockSpy).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
      deleteBlockSpy.mockRestore()
    })

    it("onConvertToSuperBlock - 成功调用 executeConvertToSuperBlock 并触发编译和保存提示", async () => {
      const transformSpy = vi.spyOn(superblockTransformModule, "executeConvertToSuperBlock").mockResolvedValue({
        success: true,
        colCount: 3,
        superBlockId: "sb-123",
      })
      const showMessageSpy = vi.spyOn(siyuanModule, "showMessage")

      await actions.onConvertToSuperBlock()

      expect(transformSpy).toHaveBeenCalledWith({
        currentDocId: "doc-001",
        activeBlockId: "block-101",
      })
      expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalledWith("doc-001")
      expect(showMessageSpy).toHaveBeenCalledWith(expect.stringContaining("已成功合并为横向超级块"))

      transformSpy.mockRestore()
      showMessageSpy.mockRestore()
    })
  })
})
