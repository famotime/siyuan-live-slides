import { describe, expect, it, vi, beforeEach } from "vitest"
import { ref, computed } from "vue"
import {
  createAttrPersistence,
} from "../src/ui/dock/actions/attr-persistence"
import {
  createNotesActions,
} from "../src/ui/dock/actions/notes-actions"
import {
  createLayoutActions,
} from "../src/ui/dock/actions/layout-actions"
import * as apiModule from "../src/api"
import * as domSyncModule from "../src/sync/dom-attr-sync"
import * as siyuanModule from "siyuan"
import { globalDocumentCompiler } from "../src/compiler/document-compiler"
import { ATTR_ELEM_NOTE } from "../src/types/slides-protocol"

/**
 * RF-016 领域级单测：直接针对 attr-persistence / notes-actions / layout-actions
 * 三个拆分后的领域模块验证编排行为（门面级回归见 inspector-actions.test.ts）。
 */

function buildCtx() {
  const ctx: any = {
    activeBlockId: ref("block-101"),
    activeBlockType: ref("NodeParagraph"),
    activeBlockAttrs: ref<Record<string, string>>({}),
    rawSnippet: ref("测试文本"),
    currentDocId: ref("doc-001"),
    currentPageDividerId: ref("div-1"),
    currentPageDividerLayout: ref(""),
    parentContainerId: ref(""),
    parentContainerClicks: ref(""),
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
    videoAutoplay: computed(() => false),
    videoLoop: computed(() => false),
    videoMuted: computed(() => true),
    videoControls: computed(() => true),
    pageBackground: ref(""),
    pageImage: ref(""),
    elemShikiLines: ref(""),
    elemMaxHeight: ref(""),
    saveStatus: ref(""),
    plugin: {
      compileCurrentDocument: vi.fn(),
    },
  }
  return ctx
}

describe("attr-persistence (属性持久化领域模块)", () => {
  let ctx: any
  let persistence: ReturnType<typeof createAttrPersistence>

  beforeEach(() => {
    ctx = buildCtx()
    persistence = createAttrPersistence(ctx)
  })

  it("saveAttr 在无激活块时应回退到文档根 ID 作为写入目标", async () => {
    ctx.activeBlockId.value = ""
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    const syncDomSpy = vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await persistence.saveAttr("custom-slides-theme", "default")

    expect(setAttrsSpy).toHaveBeenCalledWith("doc-001", { "custom-slides-theme": "default" })
    expect(syncDomSpy).toHaveBeenCalledWith("doc-001", { "custom-slides-theme": "default" })

    setAttrsSpy.mockRestore()
    syncDomSpy.mockRestore()
  })

  it("savePageAttr 应写入分页符块而非当前激活的普通块", async () => {
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await persistence.savePageAttr("custom-slides-transition", "fade")

    // 激活块是普通段落 block-101，但页面属性必须落到分页符 div-1
    expect(setAttrsSpy).toHaveBeenCalledWith("div-1", { "custom-slides-transition": "fade" })
    // 目标不是激活块时不应污染激活块属性字典
    expect(ctx.activeBlockAttrs.value["custom-slides-transition"]).toBeUndefined()

    setAttrsSpy.mockRestore()
  })

  it("savePageAttr 在目标恰为激活块时应同步激活块属性字典", async () => {
    ctx.currentPageDividerId.value = ""
    ctx.activeBlockType.value = "NodeThematicBreak"
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await persistence.savePageAttr("custom-slides-transition", "fade")

    expect(setAttrsSpy).toHaveBeenCalledWith("block-101", { "custom-slides-transition": "fade" })
    expect(ctx.activeBlockAttrs.value["custom-slides-transition"]).toBe("fade")

    setAttrsSpy.mockRestore()
  })

  it("saveAttr 应将容器主文本的点击动效同步到父容器", async () => {
    ctx.parentContainerId.value = "sb-parent"
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await persistence.saveAttr("custom-slides-click", "+1")

    // 一次写目标块自身，一次联动写父容器
    expect(setAttrsSpy).toHaveBeenCalledWith("block-101", { "custom-slides-click": "+1" })
    expect(setAttrsSpy).toHaveBeenCalledWith("sb-parent", { "custom-slides-click": "+1" })
    expect(ctx.parentContainerClicks.value).toBe("+1")

    setAttrsSpy.mockRestore()
  })

  it("saveDocAttr 应同步更新 latestDoc.config 中的主题配置", async () => {
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await persistence.saveDocAttr("custom-slides-theme", "seriph")

    expect(ctx.latestDoc.value.config.theme).toBe("seriph")
    expect(setAttrsSpy).toHaveBeenCalledWith("doc-001", { "custom-slides-theme": "seriph" })

    setAttrsSpy.mockRestore()
  })

  it("保存失败时应将状态置为同步失败且不触发编译", async () => {
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockRejectedValue(new Error("kernel down"))
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await persistence.saveAttr("custom-slides-click", "+1")

    expect(ctx.saveStatus.value).toBe("同步失败")
    expect(ctx.plugin.compileCurrentDocument).not.toHaveBeenCalled()

    setAttrsSpy.mockRestore()
  })

  it("applyPageLayoutAndRatio 应一次性写入版式与比例并更新 frontmatter", async () => {
    const slide: any = { pageIndex: 1, frontmatter: {} }
    ctx.targetSlide = computed(() => slide)
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await persistence.applyPageLayoutAndRatio("two-cols", "1-2")

    expect(setAttrsSpy).toHaveBeenCalledWith("div-1", {
      "custom-slides-layout": "two-cols",
      "custom-slides-layout-ratio": "1-2",
    })
    expect(slide.frontmatter.layout).toBe("two-cols")
    expect(slide.frontmatter.layoutRatio).toBe("1-2")
    expect(ctx.currentPageDividerLayout.value).toBe("two-cols")

    setAttrsSpy.mockRestore()
  })
})

describe("notes-actions (备注与 AI 领域模块)", () => {
  let ctx: any
  let notes: ReturnType<typeof createNotesActions>

  beforeEach(() => {
    ctx = buildCtx()
    notes = createNotesActions(ctx, { triggerSaveNotice: (msg?: string) => { ctx.saveStatus.value = msg || "" } })
  })

  it("createNoteBlockOnCurrentSlide 非末页时应插入到下一页起始块之前", async () => {
    ctx.latestDoc.value.slides = [
      { pageIndex: 1, startBlockId: "div-1", noteBlocks: [], blocks: [{ id: "b-1" }] },
      { pageIndex: 2, startBlockId: "div-2", noteBlocks: [], blocks: [] },
    ]
    ctx.targetSlide = computed(() => ctx.latestDoc.value.slides[0])

    const insertSpy = vi.spyOn(apiModule, "insertBlock").mockResolvedValue([{ doOperations: [{ id: "note-new" }] }] as any)
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)

    const newId = await notes.createNoteBlockOnCurrentSlide()

    expect(newId).toBe("note-new")
    expect(insertSpy).toHaveBeenCalledWith("markdown", expect.stringContaining("演讲备注"), "div-2")
    expect(setAttrsSpy).toHaveBeenCalledWith("note-new", { "custom-slides-note": "true" })
    expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalled()

    insertSpy.mockRestore()
    setAttrsSpy.mockRestore()
  })

  it("onBatchAppendNotes 处理中时应被并发守卫拦截", async () => {
    ;(notes as any).isBatchProcessing.value = true
    const confirmSpy = vi.spyOn(siyuanModule, "confirm")

    await notes.onBatchAppendNotes()

    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it("onBatchAppendNotes 应跳过已有讲稿的页面", async () => {
    ctx.latestDoc.value.slides = [
      { pageIndex: 1, startBlockId: "div-1", noteBlocks: [{ id: "n-1" }], notes: "已有" },
      { pageIndex: 2, startBlockId: "div-2", noteBlocks: [], notes: "" },
    ]

    let cbPromise: any = null
    const confirmSpy = vi.spyOn(siyuanModule, "confirm").mockImplementation((_t, _x, cb) => { cbPromise = cb?.() })
    const insertSpy = vi.spyOn(apiModule, "insertBlock").mockResolvedValue([{ id: "nn" }] as any)
    vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)

    await notes.onBatchAppendNotes()
    await cbPromise

    expect(insertSpy).toHaveBeenCalledTimes(1)
    // 第 2 页为末页：回退为在其起始块（previousId）之后插入
    expect(insertSpy).toHaveBeenCalledWith("markdown", expect.stringContaining("演讲备注"), undefined, "div-2")

    confirmSpy.mockRestore()
    insertSpy.mockRestore()
  })

  it("onIdentifyNotesBlocks 应支持全流程编排并在完成后重编文档", async () => {
    const getChildSpy = vi.spyOn(apiModule, "getChildBlocks").mockResolvedValue([
      { id: "p-1", type: "p", markdown: "内容" },
      { id: "note-1", type: "b", markdown: "> 口播讲稿" },
      { id: "tb-1", type: "tb", markdown: "---" },
    ] as any)
    const updateSpy = vi.spyOn(apiModule, "updateBlock").mockResolvedValue({} as any)
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await notes.onIdentifyNotesBlocks()

    expect(updateSpy).toHaveBeenCalledWith(
      "markdown",
      expect.stringContaining("> [!NOTE] 💡 演讲备注\n> 口播讲稿"),
      "note-1"
    )
    expect(setAttrsSpy).toHaveBeenCalledWith("note-1", { [ATTR_ELEM_NOTE]: "true" })
    expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalled()

    getChildSpy.mockRestore()
    updateSpy.mockRestore()
    setAttrsSpy.mockRestore()
  })

  it("onIdentifyNotesBlocks 处理中时应被并发守卫拦截", async () => {
    notes.isBatchProcessing.value = true
    const showMsgSpy = vi.spyOn(siyuanModule, "showMessage").mockImplementation(() => {})

    await notes.onIdentifyNotesBlocks()

    expect(showMsgSpy).toHaveBeenCalledWith("正在批量处理中，请稍候...")
    showMsgSpy.mockRestore()
  })
})

describe("layout-actions (版式与元素指令领域模块)", () => {
  let ctx: any
  let layout: ReturnType<typeof createLayoutActions>

  beforeEach(() => {
    ctx = buildCtx()
    const persistence = createAttrPersistence(ctx)
    layout = createLayoutActions(ctx, {
      saveAttr: persistence.saveAttr,
      saveAttrs: persistence.saveAttrs,
      savePageAttr: persistence.savePageAttr,
    })
  })

  it("onElemSlotChange 重复点击相同栏位时应清空 slot", async () => {
    ctx.activeBlockAttrs.value["custom-slides-slot"] = "left"
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await layout.onElemSlotChange("left")

    expect(setAttrsSpy).toHaveBeenCalledWith("block-101", { "custom-slides-slot": "" })

    setAttrsSpy.mockRestore()
  })

  it("onSetTwoColsContrast 在 three-cols-header 版式下应使用 col-1 栏位", async () => {
    ctx.currentSlideLayout = computed(() => "three-cols-header")
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})
    const showMsgSpy = vi.spyOn(siyuanModule, "showMessage")

    await layout.onSetTwoColsContrast()

    expect(setAttrsSpy).toHaveBeenCalledWith("block-101", { "custom-slides-slot": "col-1" })
    expect(showMsgSpy).toHaveBeenCalledWith("已将当前块设置为第 1 栏")

    setAttrsSpy.mockRestore()
    showMsgSpy.mockRestore()
  })

  it("onToggleVideoMuted 应依据当前状态翻转静音值", async () => {
    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

    await layout.onToggleVideoMuted()

    // ctx.videoMuted 初始为 true → 翻转为 false
    expect(setAttrsSpy).toHaveBeenCalledWith("block-101", { "custom-slides-muted": "false" })

    setAttrsSpy.mockRestore()
  })

  it("onInsertDividerAfter 无激活块时应回退到文档根之后插入", async () => {
    ctx.activeBlockId.value = ""
    const insertSpy = vi.spyOn(apiModule, "insertBlock").mockResolvedValue({} as any)

    await layout.onInsertDividerAfter()

    expect(insertSpy).toHaveBeenCalledWith("markdown", "---", undefined, "doc-001")

    insertSpy.mockRestore()
  })

  it("onAutoAnimateDocument 应成功扫描正文页并完成顺延动效写入", async () => {
    ctx.latestDoc.value.slides = [
      { pageIndex: 1, frontmatter: {}, blocks: [{ id: "h0", type: "h" }] },
      {
        pageIndex: 2,
        frontmatter: {},
        blocks: [
          { id: "h1", type: "h", rawMarkdown: "## 标题" },
          { id: "p1", type: "p", rawMarkdown: "首块" },
          { id: "p2", type: "p", rawMarkdown: "次块" },
        ],
      },
    ]

    const setAttrsSpy = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})
    const compileSpy = vi.spyOn(globalDocumentCompiler, "compile").mockResolvedValue(ctx.latestDoc.value)

    await layout.onAutoAnimateDocument()

    expect(setAttrsSpy).toHaveBeenCalledWith("p2", { "custom-slides-click": "+1" })
    expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalled()

    setAttrsSpy.mockRestore()
    compileSpy.mockRestore()
  })
})
