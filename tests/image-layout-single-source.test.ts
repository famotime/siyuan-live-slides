import { describe, expect, it, vi } from "vitest"
import { computed, ref } from "vue"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { createLayoutActions } from "../src/ui/dock/actions/layout-actions"
import * as apiModule from "../src/api"
import * as domSyncModule from "../src/sync/dom-attr-sync"

/**
 * 图左/图右版式：配图仅出现在侧边栏，不得再进入左侧正文；
 * 切换页面版式时自动把本页最后一张图片标记为对应版式。
 */
describe("图文版式配图单一来源", () => {
  it("已标记图右的图片块只作为侧边配图，不进入正文内容流", () => {
    const blocks: any[] = [
      { id: "h", type: "h", markdown: "# 标题" },
      { id: "i1", type: "p", markdown: "![a](assets/a.png)", ial: { "custom-slides-layout": "image-right" } },
      { id: "p", type: "p", markdown: "正文" },
    ]
    const doc = buildSlidesDocument("doc", {}, blocks)
    const slide = doc.slides[0]
    expect(slide.frontmatter.layout).toBe("image-right")
    expect(slide.frontmatter.image).toBe("/assets/a.png")
    expect(slide.imageBlockId).toBe("i1")
    expect(slide.blocks.map(b => b.id)).toEqual(["h", "p"])
  })

  it("页面级图右 + 末尾图片块标记图右时，该图片不再出现在正文", () => {
    const blocks: any[] = [
      { id: "d1", type: "tb", markdown: "---", ial: { "custom-slides-layout": "image-right" } },
      { id: "p", type: "p", markdown: "正文" },
      { id: "i1", type: "p", markdown: "![a](assets/a.png)" },
      { id: "i2", type: "p", markdown: "![b](assets/b.png)", ial: { "custom-slides-layout": "image-right" } },
    ]
    const slide = buildSlidesDocument("doc", {}, blocks).slides[0]
    expect(slide.frontmatter.image).toBe("/assets/b.png")
    expect(slide.blocks.map(b => b.id)).toEqual(["p", "i1"])
  })
})

describe("syncPageImageLayout 自动标记配图", () => {
  function setup(slide: any) {
    const ctx: any = {
      activeBlockId: ref("x"),
      activeBlockType: ref("NodeParagraph"),
      activeBlockAttrs: ref({}),
      rawSnippet: ref(""),
      currentDocId: ref("doc"),
      currentPageDividerId: ref("div-1"),
      currentPageDividerLayout: ref(""),
      targetSlide: computed(() => slide),
      pageImage: ref(""),
      plugin: { compileCurrentDocument: vi.fn() },
    }
    const noop = async () => {}
    const actions = createLayoutActions(ctx, { saveAttr: noop, saveAttrs: noop, savePageAttr: noop })
    const setAttrs = vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
    vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})
    return { actions, setAttrs }
  }

  const mkSlide = (extra: any = {}) => ({
    frontmatter: {},
    blocks: [
      { id: "p1", type: "p", content: "正文", rawMarkdown: "正文" },
      { id: "i1", type: "p", content: "", rawMarkdown: "![a](assets/a.png)" },
      { id: "i2", type: "p", content: "", rawMarkdown: "![b](assets/b.png)" },
      { id: "p2", type: "p", content: "结尾", rawMarkdown: "结尾" },
    ],
    ...extra,
  })

  it("切换到图右：仅把最后一张图片标记为 image-right", async () => {
    const { actions, setAttrs } = setup(mkSlide())
    await actions.syncPageImageLayout("image-right")
    expect(setAttrs).toHaveBeenCalledTimes(1)
    expect(setAttrs).toHaveBeenCalledWith("i2", { "custom-slides-layout": "image-right" })
    setAttrs.mockRestore()
  })

  it("切换到图左：沿用已有来源块并改为 image-left，清除其它残留标记", async () => {
    const slide: any = mkSlide({ imageBlockId: "i0" })
    slide.blocks[1].rawNode = { id: "i1", type: "p", markdown: "![a](assets/a.png)", ial: { "custom-slides-layout": "image-right" } }
    const { actions, setAttrs } = setup(slide)
    await actions.syncPageImageLayout("image-left")
    expect(setAttrs).toHaveBeenCalledWith("i0", { "custom-slides-layout": "image-left" })
    expect(setAttrs).toHaveBeenCalledWith("i1", { "custom-slides-layout": "" })
    expect(setAttrs).not.toHaveBeenCalledWith("i2", expect.anything())
    setAttrs.mockRestore()
  })

  it("切换到非图文版式：清除本页图左/图右标记", async () => {
    const { actions, setAttrs } = setup(mkSlide({ imageBlockId: "i2" }))
    await actions.syncPageImageLayout("two-cols")
    expect(setAttrs).toHaveBeenCalledWith("i2", { "custom-slides-layout": "" })
    setAttrs.mockRestore()
  })

  it("本页没有图片时不写入任何标记", async () => {
    const { actions, setAttrs } = setup({ frontmatter: {}, blocks: [{ id: "p1", type: "p", content: "正文", rawMarkdown: "正文" }] })
    await actions.syncPageImageLayout("image-right")
    expect(setAttrs).not.toHaveBeenCalled()
    setAttrs.mockRestore()
  })
})
