import { describe, expect, it } from "vitest"
import { parseSlidesPresentation } from "../src/compiler/slides-importer"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import {
  buildTocTree,
  convertBlockToHtml,
  renderSlideBlocksToHtml,
  renderTocHtml,
} from "../src/export/markdown-renderer"
import type { ISiYuanBlockNode, ISlidesVirtualPage } from "../src/types/slides-protocol"

describe("Two-Cols & Toc Import and Rendering Pipeline", () => {
  const userSnippet = `---
layout: two-cols
layoutClass: gap-16
---

# Table of contents

You can use the \`Toc\` component to generate a table of contents for your slides:

\`\`\`html
<Toc minDepth="1" maxDepth="1" />
\`\`\`

The title will be inferred from your slide content, or you can override it with \`title\` and \`level\` in your frontmatter.

::right::

<Toc text-sm minDepth="1" maxDepth="2" />`

  it("should parse snippet with cleanSlots: false, preserving ::right:: and layoutClass", () => {
    const res = parseSlidesPresentation(userSnippet, { cleanSlots: false })

    expect(res.slides.length).toBe(1)
    const s1 = res.slides[0]

    // 验证两栏与间距属性完整保留
    expect(s1.pageAttrs["custom-slides-layout"]).toBe("two-cols")
    expect(s1.pageAttrs["custom-slides-layoutClass"]).toBe("gap-16")

    // 验证插槽标记 ::right:: 未被吞噬
    expect(s1.rawMarkdown).toContain("::right::")
    expect(s1.rawMarkdown).toContain('<Toc text-sm minDepth="1" maxDepth="2" />')
  })

  it("should build SlidevDocument with layoutClass and assign right slot to blocks after ::right::", () => {
    // 模拟思源内核依据 Markdown 解析的块树
    const mockBlocks: ISiYuanBlockNode[] = [
      { id: "b1", type: "h", content: "Table of contents", markdown: "# Table of contents" },
      { id: "b2", type: "p", content: "You can use the `Toc` component...", markdown: "You can use the `Toc` component..." },
      { id: "b3", type: "c", content: '<Toc minDepth="1" maxDepth="1" />', markdown: "```html\n<Toc minDepth=\"1\" maxDepth=\"1\" />\n```" },
      { id: "b4", type: "p", content: "The title will be inferred...", markdown: "The title will be inferred..." },
      { id: "b_slot", type: "p", content: "::right::", markdown: "::right::" },
      { id: "b5", type: "p", content: '<Toc text-sm minDepth="1" maxDepth="2" />', markdown: '<Toc text-sm minDepth="1" maxDepth="2" />' },
    ]

    const docAttrs = {
      "custom-slides-layout": "two-cols",
      "custom-slides-layoutClass": "gap-16",
    }

    const doc = buildSlidesDocument("doc-toc-test", docAttrs, mockBlocks)
    expect(doc.slides.length).toBe(1)
    const slide = doc.slides[0]

    expect(slide.frontmatter.layout).toBe("two-cols")
    expect(slide.frontmatter.layoutClass).toBe("gap-16")

    // 验证插槽分界标记后的块 slot 自动归属为 right
    const tocBlock = slide.blocks.find(b => b.id === "b5")
    expect(tocBlock).toBeDefined()
    expect(tocBlock?.slot).toBe("right")

    // 验证 ::right:: 自身被识别为插槽分界块
    const slotDivider = slide.blocks.find(b => b.id === "b_slot")
    expect(slotDivider?.slot).toBe("slot-divider-right")
  })

  it("should render Toc component into structured HTML list instead of escaped text", () => {
    const mockSlides: ISlidesVirtualPage[] = [
      {
        pageIndex: 1,
        startBlockId: "p1",
        frontmatter: { title: "Welcome to Slidev" },
        notes: "",
        rawMarkdown: "",
        blocks: [{ id: "b1", rawMarkdown: "# Welcome to Slidev" }],
      },
      {
        pageIndex: 2,
        startBlockId: "p2",
        frontmatter: { title: "What is Slidev?" },
        notes: "",
        rawMarkdown: "",
        blocks: [{ id: "b2", rawMarkdown: "# What is Slidev?" }],
      },
      {
        pageIndex: 3,
        startBlockId: "p3",
        frontmatter: { level: 2, title: "Navigation" },
        notes: "",
        rawMarkdown: "",
        blocks: [{ id: "b3", rawMarkdown: "# Navigation" }],
      },
      {
        pageIndex: 4,
        startBlockId: "p4",
        frontmatter: { layout: "two-cols" },
        notes: "",
        rawMarkdown: "",
        blocks: [{ id: "b4", rawMarkdown: "# Table of contents" }],
      },
    ]

    // 1. 测试 buildTocTree 能够正确组织多层级（如 Navigation 作为 What is Slidev? 的子项）
    const tree = buildTocTree(mockSlides, 4, { minDepth: 1, maxDepth: 2 })
    expect(tree.length).toBe(3) // 3 个一级标题: Welcome to Slidev, What is Slidev?, Table of contents
    expect(tree[1].title).toBe("What is Slidev?")
    expect(tree[1].children.length).toBe(1)
    expect(tree[1].children[0].title).toBe("Navigation")
    expect(tree[2].active).toBe(true) // 当前在第 4 页，Table of contents 处于激活态

    // 2. 测试 renderTocHtml 生成的 HTML
    const tocHtml = renderTocHtml(mockSlides, 4, { minDepth: 1, maxDepth: 2, textSm: true })
    expect(tocHtml).toContain('class="slides-toc text-sm"')
    expect(tocHtml).toContain("slides-toc-list-level-1")
    expect(tocHtml).toContain("slides-toc-list-level-2")
    expect(tocHtml).toContain("Welcome to Slidev")
    expect(tocHtml).toContain("Navigation")
    expect(tocHtml).toContain("slides-toc-item-active")

    // 3. 测试 convertBlockToHtml 对 <Toc ... /> 的渲染
    const blockToc = {
      id: "b_toc",
      rawMarkdown: '<Toc text-sm minDepth="1" maxDepth="2" />',
      slot: "right",
    }
    const html = convertBlockToHtml(blockToc, { allSlides: mockSlides, currentPageIndex: 4 })
    expect(html).not.toContain("&lt;Toc")
    expect(html).toContain("slides-toc text-sm")
    expect(html).toContain("Welcome to Slidev")
    expect(html).toContain("Navigation")
  })

  it("should render two-cols layout with layoutClass and correct left/right slot separation", () => {
    const slide: ISlidesVirtualPage = {
      pageIndex: 1,
      startBlockId: "p1",
      frontmatter: { layout: "two-cols", layoutClass: "gap-16" },
      notes: "",
      rawMarkdown: "",
      blocks: [
        { id: "b1", rawMarkdown: "# Table of contents", slot: "left" },
        { id: "b2", rawMarkdown: "Some text description", slot: "left" },
        { id: "b_slot", rawMarkdown: "::right::", slot: "slot-divider-right" },
        { id: "b3", rawMarkdown: '<Toc text-sm minDepth="1" maxDepth="2" />', slot: "right" },
      ],
    }

    const html = renderSlideBlocksToHtml(slide, { allSlides: [slide], currentPageIndex: 1 })

    // 验证容器带有 gap-16 样式类
    expect(html).toContain("gap-16")
    expect(html).toContain("pdf-two-cols-wrapper")

    // 验证左栏包含标题与文本
    expect(html).toContain("Table of contents")
    expect(html).toContain("Some text description")

    // 验证分界占位符 ::right:: 被正确过滤，未作为普通文本输出
    expect(html).not.toContain("::right::")

    // 验证右栏包含 Toc 渲染结果
    expect(html).toContain("slides-toc text-sm")
  })
})
