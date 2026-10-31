import { describe, expect, it } from "vitest"
import {
  convertBlockToHtml,
  escapeHtml,
  formatInlineMarkdown,
  parseShikiRanges,
  renderMarkdownTable,
  renderSlideBlocksToHtml,
} from "../src/export/markdown-renderer"
import type { ISlidesBlockItem, ISlidesVirtualPage } from "../src/types/slides-protocol"

describe("MarkdownRenderer (导出模块与沙箱通用高保真渲染引擎)", () => {
  it("escapeHtml 应正确转义 HTML 关键字符", () => {
    expect(escapeHtml("<script>alert('xss') & \"safe\"</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;) &amp; &quot;safe&quot;&lt;/script&gt;",
    )
  })

  it("parseShikiRanges 应准确解析聚光行号范围", () => {
    expect(parseShikiRanges("all")).toBe("all")
    expect(parseShikiRanges("")).toBe("all")
    const rangeSet = parseShikiRanges("1-3|5|8") as Set<number>
    expect(rangeSet.has(1)).toBe(true)
    expect(rangeSet.has(2)).toBe(true)
    expect(rangeSet.has(3)).toBe(true)
    expect(rangeSet.has(4)).toBe(false)
    expect(rangeSet.has(5)).toBe(true)
    expect(rangeSet.has(8)).toBe(true)
  })

  it("formatInlineMarkdown 应支持加粗、斜体、删除线、行内代码、数学公式、链接、v-mark 以及通用安全 HTML 标签 (如 kbd、sub、sup)", () => {
    const raw = "这是 **粗体**，*斜体*，~~删除线~~，`code`，公式 $E = mc^2$，[链接](https://siyuan.io)，<v-mark type=\"underline\">重点</v-mark>，快捷键 <kbd>right</kbd> / <kbd>space</kbd>，化学式 H<sub>2</sub>O"
    const formatted = formatInlineMarkdown(raw)
    expect(formatted).toContain("<strong>粗体</strong>")
    expect(formatted).toContain("<em>斜体</em>")
    expect(formatted).toContain("<del>删除线</del>")
    expect(formatted).toContain("<code>code</code>")
    expect(formatted).toContain('class="katex-inline font-math"')
    expect(formatted).toContain('href="https://siyuan.io"')
    expect(formatted).toContain('<mark class="v-mark v-mark--underline">重点</mark>')
    expect(formatted).toContain("<kbd>right</kbd>")
    expect(formatted).toContain("<kbd>space</kbd>")
    expect(formatted).toContain("H<sub>2</sub>O")
  })

  it("renderMarkdownTable 应将 Markdown 表格转换为带对齐样式的 HTML table", () => {
    const tableMd = [
      "| 功能 | 状态 | 评分 |",
      "| :--- | :---: | ---: |",
      "| 高保真沙箱 | 完成 | 100 |",
      "| 官方 Pro 引擎 | 推进中 | 95 |",
    ]
    const html = renderMarkdownTable(tableMd)
    expect(html).toContain("<table")
    expect(html).toContain('style="text-align: left">功能</th>')
    expect(html).toContain('style="text-align: center"')
    expect(html).toContain('style="text-align: right"')
    expect(html).toContain('style="text-align: left">高保真沙箱</td>')
  })

  it("convertBlockToHtml 应正确渲染各类型块级 Markdown 结构", () => {
    // 标题
    expect(convertBlockToHtml({ id: "b1", rawMarkdown: "# 标题 1" })).toContain("<h1>标题 1</h1>")
    expect(convertBlockToHtml({ id: "b2", rawMarkdown: "## 标题 2" })).toContain("<h2>标题 2</h2>")
    expect(convertBlockToHtml({ id: "b3", rawMarkdown: "### 标题 3" })).toContain("<h3>标题 3</h3>")

    // 代码块与 Shiki 聚光行号聚焦高亮
    const codeBlock: ISlidesBlockItem = {
      id: "b4",
      rawMarkdown: "```ts {1-2|4}\nconst a = 123\nconst b = 456\nconst c = 789\nconst d = 999\n```",
    }
    const codeHtml = convertBlockToHtml(codeBlock)
    expect(codeHtml).toContain("<pre class=\"pdf-code shiki-container\"")
    expect(codeHtml).toContain("<span class=\"lang-badge\">ts</span>")
    expect(codeHtml).toContain("shiki-focus")
    expect(codeHtml).toContain("shiki-dimmed")
    expect(codeHtml).toContain("<span class=\"line-no\">1</span>")

    // 独立 KaTeX 数学公式块
    const mathBlock: ISlidesBlockItem = {
      id: "b_math",
      rawMarkdown: "$$\n\\int_{0}^{1} x^2 dx = \\frac{1}{3}\n$$",
    }
    expect(convertBlockToHtml(mathBlock)).toContain("katex-display")

    // Callout 警示框
    const calloutBlock: ISlidesBlockItem = {
      id: "b_callout",
      rawMarkdown: "::: warning\n请注意演示环境安全\n:::",
    }
    const calloutHtml = convertBlockToHtml(calloutBlock)
    expect(calloutHtml).toContain("pdf-callout--warning")
    expect(calloutHtml).toContain("请注意演示环境安全")

    // 任务清单
    const taskBlock: ISlidesBlockItem = {
      id: "b_task",
      rawMarkdown: "- [x] 已完成任务项",
    }
    expect(convertBlockToHtml(taskBlock)).toContain('type="checkbox" disabled="" checked=""')

    // 引用块
    const quoteBlock: ISlidesBlockItem = {
      id: "b5",
      rawMarkdown: "> 重点结论",
    }
    expect(convertBlockToHtml(quoteBlock)).toContain('<blockquote class="pdf-quote"><p>重点结论</p></blockquote>')

    // 图片
    const imgBlock: ISlidesBlockItem = {
      id: "b6",
      rawMarkdown: "![架构图](assets/arch.png)",
    }
    expect(convertBlockToHtml(imgBlock)).toContain('<img alt="架构图" src="assets/arch.png"')

    // 无序列表与有序列表（单项与多行列表）
    expect(convertBlockToHtml({ id: "b7", rawMarkdown: "- 列表项 1" })).toContain("<li>列表项 1</li>")
    expect(convertBlockToHtml({ id: "b8", rawMarkdown: "1. 排序项 1" })).toContain("<li>排序项 1</li>")

    const multiListBlock: ISlidesBlockItem = {
      id: "b_multi",
      rawMarkdown: "- 📝 **Text-based** - Markdown\n- 🎨 **Themable** - Themes\n- 🧑‍💻 **Developer Friendly** - Code",
    }
    const multiHtml = convertBlockToHtml(multiListBlock)
    expect(multiHtml).toContain("<strong>Text-based</strong>")
    expect(multiHtml).toContain("<strong>Themable</strong>")
    expect(multiHtml).toContain("<strong>Developer Friendly</strong>")
    expect(multiHtml).toContain("<ul class=\"pdf-list pdf-list--unordered\">")

    // 已解析的思源引用 HTML 直接保留
    const refBlock: ISlidesBlockItem = {
      id: "b9",
      rawMarkdown: '<span class="slides-block-ref">引用内容</span>',
    }
    expect(convertBlockToHtml(refBlock)).toContain('class="slides-block-ref"')

    // 带微动效与时长延迟参数的段落
    const motionBlock: ISlidesBlockItem = {
      id: "b10",
      rawMarkdown: "微动效段落内容",
      motion: { preset: "slide-up", duration: 400, delay: 100 },
    }
    const motionHtml = convertBlockToHtml(motionBlock)
    expect(motionHtml).toContain("slides-motion-slide-up")
    expect(motionHtml).toContain("--motion-duration:400ms")
    expect(motionHtml).toContain("--motion-delay:100ms")
  })

  it("renderSlideBlocksToHtml 应正确支持 two-cols, two-cols-header 与 fact 布局", () => {
    // 1. two-cols
    const slideTwoCols: ISlidesVirtualPage = {
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
    const htmlTwoCols = renderSlideBlocksToHtml(slideTwoCols)
    expect(htmlTwoCols).toContain("two-cols")
    expect(htmlTwoCols).toContain("左侧内容")
    expect(htmlTwoCols).toContain("右侧内容")

    // 2. two-cols-header
    const slideHeaderCols: ISlidesVirtualPage = {
      pageIndex: 2,
      startBlockId: "p2",
      frontmatter: { layout: "two-cols-header" },
      notes: "",
      rawMarkdown: "",
      blocks: [
        { id: "bh", rawMarkdown: "# 架构对比总览", type: "h" },
        { id: "bl", rawMarkdown: "方案 A", slot: "left" },
        { id: "br", rawMarkdown: "方案 B", slot: "right" },
      ],
    }
    const htmlHeaderCols = renderSlideBlocksToHtml(slideHeaderCols)
    expect(htmlHeaderCols).toContain("layout-two-cols-header-container")
    expect(htmlHeaderCols).toContain("架构对比总览")
    expect(htmlHeaderCols).toContain("方案 A")
    expect(htmlHeaderCols).toContain("方案 B")

    // 3. fact
    const slideFact: ISlidesVirtualPage = {
      pageIndex: 3,
      startBlockId: "p3",
      frontmatter: { layout: "fact" },
      notes: "",
      rawMarkdown: "",
      blocks: [
        { id: "bf", rawMarkdown: "# 99.99% 可用性" },
      ],
    }
    const htmlFact = renderSlideBlocksToHtml(slideFact)
    expect(htmlFact).toContain("layout-fact-container")
    expect(htmlFact).toContain("99.99% 可用性")
  })
})
