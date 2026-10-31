import { describe, expect, it } from "vitest"
import { renderSlideBlocksToHtml } from "../src/export/slide-layout-renderer"
import type { ISlidesVirtualPage } from "../src/types/slides-protocol"

describe("SlideLayoutRenderer (幻灯片版式容器渲染器)", () => {
  it("应支持 two-cols 自动二分或显式 right 插槽分栏", () => {
    const page: ISlidesVirtualPage = {
      pageIndex: 1,
      frontmatter: { layout: "two-cols" },
      blocks: [
        { id: "b1", rawMarkdown: "左侧内容 1" },
        { id: "b2", rawMarkdown: "右侧内容 2", slot: "right" },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(page)
    expect(html).toContain("layout-two-cols-grid")
    expect(html).toContain("pdf-col--left")
    expect(html).toContain("pdf-col--right")
    expect(html).toContain("左侧内容 1")
    expect(html).toContain("右侧内容 2")
  })

  it("应支持 two-cols-header 表头与双栏网格组合", () => {
    const page: ISlidesVirtualPage = {
      pageIndex: 2,
      frontmatter: { layout: "two-cols-header" },
      blocks: [
        { id: "h", type: "h", rawMarkdown: "# 页面大标题", slot: "header" },
        { id: "left", rawMarkdown: "左栏" },
        { id: "right", rawMarkdown: "右栏", slot: "right" },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(page)
    expect(html).toContain("layout-two-cols-header-container")
    expect(html).toContain("layout-header-section")
    expect(html).toContain("<h1>页面大标题</h1>")
    expect(html).toContain("pdf-col--left")
    expect(html).toContain("pdf-col--right")
  })

  it("应支持 image-right 与 image-left 图文版式", () => {
    const page: ISlidesVirtualPage = {
      pageIndex: 3,
      frontmatter: { layout: "image-right", image: "https://example.com/cover.png" },
      blocks: [
        { id: "b", rawMarkdown: "# 图文介绍" },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(page)
    expect(html).toContain("layout-image-cols-grid")
    expect(html).toContain("pdf-content-col")
    expect(html).toContain("pdf-image-col")
    expect(html).toContain("https://example.com/cover.png")
  })

  it("应支持 cover 与 fact 专属展示版式", () => {
    const coverPage: ISlidesVirtualPage = {
      pageIndex: 4,
      frontmatter: { layout: "cover" },
      blocks: [{ id: "c", rawMarkdown: "# 封面大字" }],
      rawMarkdown: "",
    }
    expect(renderSlideBlocksToHtml(coverPage)).toContain("layout-cover-container")

    const factPage: ISlidesVirtualPage = {
      pageIndex: 5,
      frontmatter: { layout: "fact" },
      blocks: [{ id: "f", rawMarkdown: "# 关键数据 99%" }],
      rawMarkdown: "",
    }
    expect(renderSlideBlocksToHtml(factPage)).toContain("layout-fact-container")
  })
})
