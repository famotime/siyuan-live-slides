import { describe, expect, it } from "vitest"
import { parseDocumentConfig } from "../src/compiler/scope-mapper"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import {
  ATTR_DOC_BACKGROUND,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_LAYOUT,
  ATTR_ELEM_ROLE,
  ROLE_BACKGROUND,
} from "../src/types/slides-protocol"
import type { ISiYuanBlockNode } from "../src/types/slides-protocol"

describe("Global Background (全局演示背景)", () => {
  it("parseDocumentConfig 应正确解析文档根节点的全局背景属性", () => {
    const config = parseDocumentConfig({
      [ATTR_DOC_BACKGROUND]: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    })
    expect(config.background).toBe("linear-gradient(135deg, #1e293b 0%, #0f172a 100%)")
  })

  it("buildSlidesDocument 应将全局背景应用至所有幻灯片页面", () => {
    const docId = "doc-test-global-bg"
    const docAttrs = {
      [ATTR_DOC_BACKGROUND]: "#1e1e24",
    }
    const blocks: ISiYuanBlockNode[] = [
      { id: "b1", type: "h", content: "第一页标题", markdown: "# 第一页标题" },
      { id: "div1", type: "tb", content: "---", markdown: "---" },
      { id: "b2", type: "p", content: "第二页内容", markdown: "第二页内容" },
      { id: "div2", type: "tb", content: "---", markdown: "---" },
      { id: "b3", type: "p", content: "第三页内容", markdown: "第三页内容" },
    ]

    const doc = buildSlidesDocument(docId, docAttrs, blocks)
    expect(doc.slides.length).toBe(3)
    expect(doc.slides[0].frontmatter.background).toBe("#1e1e24")
    expect(doc.slides[1].frontmatter.background).toBe("#1e1e24")
    expect(doc.slides[2].frontmatter.background).toBe("#1e1e24")
  })

  it("buildSlidesDocument 遇到历史分隔线上残留的 custom-slides-background 应予以忽略，由全局背景主导", () => {
    const docId = "doc-test-legacy-divider"
    const docAttrs = {
      [ATTR_DOC_BACKGROUND]: "#0f172a",
    }
    const blocks: ISiYuanBlockNode[] = [
      { id: "b1", type: "h", content: "第一页标题", markdown: "# 第一页标题" },
      {
        id: "div1",
        type: "tb",
        content: "---",
        markdown: "---",
        ial: { [ATTR_PAGE_BACKGROUND]: "assets/legacy-divider-bg.jpg" },
      },
      { id: "b2", type: "p", content: "第二页内容", markdown: "第二页内容" },
    ]

    const doc = buildSlidesDocument(docId, docAttrs, blocks)
    expect(doc.slides.length).toBe(2)
    // 历史分隔线上的背景应被忽略，统一采用全局背景
    expect(doc.slides[1].frontmatter.background).toBe("#0f172a")
  })

  it("若某页存在 custom-slides-role='background' 的图片块，应允许该页单独覆盖全局背景", () => {
    const docId = "doc-test-img-role-override"
    const docAttrs = {
      [ATTR_DOC_BACKGROUND]: "#ffffff",
    }
    const blocks: ISiYuanBlockNode[] = [
      { id: "b1", type: "h", content: "第一页标题", markdown: "# 第一页标题" },
      { id: "div1", type: "tb", content: "---", markdown: "---" },
      { id: "b2", type: "p", content: "第二页配图背景", markdown: "第二页配图背景" },
      {
        id: "b-img",
        type: "p",
        content: "![特权背景图](assets/page2-special.png)",
        markdown: "![特权背景图](assets/page2-special.png)",
        ial: { [ATTR_ELEM_ROLE]: ROLE_BACKGROUND },
      },
    ]

    const doc = buildSlidesDocument(docId, docAttrs, blocks)
    expect(doc.slides.length).toBe(2)
    expect(doc.slides[0].frontmatter.background).toBe("#ffffff")
    expect(doc.slides[1].frontmatter.background).toBe("/assets/page2-special.png")
  })
})
