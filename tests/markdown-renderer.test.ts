import { describe, expect, it } from "vitest"
import {
  convertBlockToHtml,
  escapeHtml,
  formatInlineMarkdown,
  renderSlideBlocksToHtml,
} from "../src/export/markdown-renderer"
import type { ISlidevBlockItem, ISlidevVirtualPage } from "../src/types/slidev-protocol"

describe("MarkdownRenderer (导出模块通用 Markdown 块级渲染引擎)", () => {
  it("escapeHtml 应正确转义 HTML 关键字符", () => {
    expect(escapeHtml("<script>alert('xss') & \"safe\"</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;) &amp; &quot;safe&quot;&lt;/script&gt;",
    )
  })

  it("formatInlineMarkdown 应支持加粗、斜体与行内代码", () => {
    const raw = "这是 **粗体**，这是 *斜体*，这是 `const x = 1`"
    const formatted = formatInlineMarkdown(raw)
    expect(formatted).toContain("<strong>粗体</strong>")
    expect(formatted).toContain("<em>斜体</em>")
    expect(formatted).toContain("<code>const x = 1</code>")
  })

  it("convertBlockToHtml 应正确渲染各类型块级 Markdown 结构", () => {
    // 标题
    expect(convertBlockToHtml({ id: "b1", rawMarkdown: "# 标题 1" })).toContain("<h1>标题 1</h1>")
    expect(convertBlockToHtml({ id: "b2", rawMarkdown: "## 标题 2" })).toContain("<h2>标题 2</h2>")
    expect(convertBlockToHtml({ id: "b3", rawMarkdown: "### 标题 3" })).toContain("<h3>标题 3</h3>")

    // 代码块
    const codeBlock: ISlidevBlockItem = {
      id: "b4",
      rawMarkdown: "```ts\nconst a = 123\n```",
    }
    const codeHtml = convertBlockToHtml(codeBlock)
    expect(codeHtml).toContain("<pre")
    expect(codeHtml).toContain("<code>const a = 123</code>")

    // 引用块
    const quoteBlock: ISlidevBlockItem = {
      id: "b5",
      rawMarkdown: "> 重点结论",
    }
    expect(convertBlockToHtml(quoteBlock)).toContain('<blockquote class="pdf-quote"><p>重点结论</p></blockquote>')

    // 图片
    const imgBlock: ISlidevBlockItem = {
      id: "b6",
      rawMarkdown: "![架构图](assets/arch.png)",
    }
    expect(convertBlockToHtml(imgBlock)).toContain('<img alt="架构图" src="assets/arch.png"')

    // 无序列表与有序列表
    expect(convertBlockToHtml({ id: "b7", rawMarkdown: "- 列表项 1" })).toContain("<li>列表项 1</li>")
    expect(convertBlockToHtml({ id: "b8", rawMarkdown: "1. 排序项 1" })).toContain("<li>排序项 1</li>")

    // 已解析的思源引用 HTML 直接保留
    const refBlock: ISlidevBlockItem = {
      id: "b9",
      rawMarkdown: '<span class="slidev-block-ref">引用内容</span>',
    }
    expect(convertBlockToHtml(refBlock)).toContain('class="slidev-block-ref"')
  })

  it("renderSlideBlocksToHtml 应正确支持 two-cols 双栏与单栏布局", () => {
    const slideTwoCols: ISlidevVirtualPage = {
      pageIndex: 1,
      startBlockId: "p1",
      frontmatter: { layout: "two-cols" },
      notes: "这是备注",
      rawMarkdown: "",
      blocks: [
        { id: "b1", rawMarkdown: "左侧内容", slot: "left" },
        { id: "b2", rawMarkdown: "右侧内容", slot: "right" },
      ],
    }

    const html = renderSlideBlocksToHtml(slideTwoCols)
    expect(html).toContain("two-cols")
    expect(html).toContain("左侧内容")
    expect(html).toContain("右侧内容")
  })
})
