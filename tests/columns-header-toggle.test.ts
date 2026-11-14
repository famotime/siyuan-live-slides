import { describe, expect, it } from "vitest"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { parsePageAttrs } from "../src/compiler/scope-mapper"
import { renderSlideBlocksToHtml } from "../src/export/slide-layout-renderer"
import type { ISiYuanBlockNode, ISlidesVirtualPage } from "../src/types/slides-protocol"
import { ATTR_PAGE_HEADER, ATTR_PAGE_LAYOUT, isColsHeaderLayout } from "../src/types/slides-protocol"

describe("多栏版式合并与通栏标题开关 (columns-header-toggle)", () => {
  it("isColsHeaderLayout 应将 cols-header, two-cols-header, three-cols-header 及 two-cols 统一识别为多栏体系", () => {
    expect(isColsHeaderLayout("cols-header")).toBe(true)
    expect(isColsHeaderLayout("two-cols-header")).toBe(true)
    expect(isColsHeaderLayout("three-cols-header")).toBe(true)
    expect(isColsHeaderLayout("two-cols")).toBe(true)
    expect(isColsHeaderLayout("default")).toBe(false)
    expect(isColsHeaderLayout("cover")).toBe(false)
  })

  it("scope-mapper: 应正确解析 custom-slides-header 属性，缺省时默认为 true", () => {
    const resDefault = parsePageAttrs({
      [ATTR_PAGE_LAYOUT]: "cols-header",
    })
    expect(resDefault.frontmatter.layout).toBe("cols-header")
    expect(resDefault.frontmatter.header).toBeUndefined()

    const resFalse = parsePageAttrs({
      [ATTR_PAGE_LAYOUT]: "cols-header",
      [ATTR_PAGE_HEADER]: "false",
    })
    expect(resFalse.frontmatter.header).toBe(false)

    const resTrue = parsePageAttrs({
      [ATTR_PAGE_LAYOUT]: "cols-header",
      [ATTR_PAGE_HEADER]: "true",
    })
    expect(resTrue.frontmatter.header).toBe(true)
  })

  it("scope-mapper: 对于历史 two-cols 版式，若未显式指定 header 则自动补齐 header: false", () => {
    const resTwoCols = parsePageAttrs({
      [ATTR_PAGE_LAYOUT]: "two-cols",
    })
    expect(resTwoCols.frontmatter.layout).toBe("two-cols")
    expect(resTwoCols.frontmatter.header).toBe(false)
  })

  it("AST 构建器: 通栏标题默认开启时，自动提取首个大标题为 header，其余内容均分多栏", () => {
    const blocks: ISiYuanBlockNode[] = [
      { id: "h1", type: "h", content: "页面总览标题", markdown: "# 页面总览标题" },
      { id: "p1", type: "p", content: "左侧方案A", markdown: "左侧方案A" },
      { id: "p2", type: "p", content: "右侧方案B", markdown: "右侧方案B" },
    ]

    const doc = buildSlidesDocument("doc-cols-1", { [ATTR_PAGE_LAYOUT]: "cols-header" }, blocks)
    expect(doc.slides.length).toBe(1)
    const page = doc.slides[0]

    // 标题被提取为 header
    const headerBlock = page.blocks.find(b => b.id === "h1")
    expect(headerBlock).toBeDefined()
    expect(page.blocks.filter(b => b.slot === "col-1").map(b => b.content)).toEqual(["左侧方案A"])
    expect(page.blocks.filter(b => b.slot === "col-2").map(b => b.content)).toEqual(["右侧方案B"])
  })

  it("AST 构建器: 当设置 custom-slides-header='false' 时，首个大标题不作为表头，而是与正文一起进入第 1 栏", () => {
    const blocks: ISiYuanBlockNode[] = [
      { id: "h1", type: "h", content: "左栏大标题", markdown: "# 左栏大标题" },
      { id: "p1", type: "p", content: "左侧正文描述", markdown: "左侧正文描述" },
      { id: "h2", type: "h", content: "右栏大标题", markdown: "# 右栏大标题", ial: { "custom-slides-slot": "col-2" } },
      { id: "p2", type: "p", content: "右侧正文描述", markdown: "右侧正文描述", ial: { "custom-slides-slot": "col-2" } },
    ]

    const doc = buildSlidesDocument(
      "doc-cols-2",
      {
        [ATTR_PAGE_LAYOUT]: "cols-header",
        [ATTR_PAGE_HEADER]: "false",
      },
      blocks,
    )
    expect(doc.slides.length).toBe(1)
    const page = doc.slides[0]

    // 没有任何块被分配为 header 插槽
    const headerBlocks = page.blocks.filter(b => b.slot === "header")
    expect(headerBlocks.length).toBe(0)

    // h1 留在 col-1 中
    const col1Blocks = page.blocks.filter(b => b.slot === "col-1")
    expect(col1Blocks.map(b => b.id)).toEqual(["h1", "p1"])

    // col-2 包含右栏内容
    const col2Blocks = page.blocks.filter(b => b.slot === "col-2")
    expect(col2Blocks.map(b => b.id)).toEqual(["h2", "p2"])
  })

  it("渲染器: 当 headerBlocks 为空（通栏标题关闭）时，不输出 layout-header-section，网格填满全高", () => {
    const page: ISlidesVirtualPage = {
      pageIndex: 1,
      frontmatter: { layout: "cols-header", header: false },
      blocks: [
        { id: "b1", rawMarkdown: "左侧卡片内容", slot: "col-1" },
        { id: "b2", rawMarkdown: "右侧卡片内容", slot: "col-2" },
      ],
      rawMarkdown: "",
    }

    const html = renderSlideBlocksToHtml(page)
    expect(html).toContain("layout-cols-header-container")
    expect(html).toContain("layout-two-cols-header-container")
    expect(html).toContain("layout-cols-grid")
    expect(html).not.toContain("layout-header-section") // 无表头容器
    expect(html).toContain("pdf-col--left")
    expect(html).toContain("pdf-col--right")
    expect(html).toContain("左侧卡片内容")
    expect(html).toContain("右侧卡片内容")
  })
})
