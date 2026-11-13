import { describe, expect, it } from "vitest"
import {
  DEFAULT_SIYUAN_PALETTE_CSS,
  generateCustomInlineStylesCss,
  generateCompleteSiYuanThemeCss,
  type ISiYuanInlineStylesPayload,
} from "../src/compiler/theme-styles-generator"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { cleanAndTransformInlineKramdown } from "../src/compiler/html-cleaner"
import { convertBlockToHtml } from "../src/export/markdown-renderer"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import { buildPrintableHtml } from "../src/export/pdf-exporter"
import type { ISlidesDocument } from "../src/types/slides-protocol"

describe("Theme Styles Generator (思源笔记调色板与字体样式生成器)", () => {
  it("DEFAULT_SIYUAN_PALETTE_CSS 应包含 13 种内置文字颜色与背景颜色，以及 4 种卡片标牌", () => {
    // 浅色模式检验
    expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain("--b3-card-error-color: #790600")
    expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain("--b3-card-warning-color: #8a4f00")
    expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain("--b3-card-info-color: #005599")
    expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain("--b3-card-success-color: #006b04")

    for (let i = 1; i <= 13; i++) {
      expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain(`--b3-font-color${i}:`)
      expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain(`--b3-font-background${i}:`)
    }

    // 深色模式检验
    expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain("html.dark")
    expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain('[data-theme="dark"]')
    expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain("--b3-card-error-color: rgb(243, 153, 147)")

    // 块级样式与行内样式增强规则
    expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain(".slide-styled-block")
    expect(DEFAULT_SIYUAN_PALETTE_CSS).toContain('span[style*="background-color"]')
  })

  it("generateCustomInlineStylesCss 能针对用户扩展调色板正确输出 CSS 声明", () => {
    expect(generateCustomInlineStylesCss(null)).toBe("")
    expect(generateCustomInlineStylesCss(undefined)).toBe("")
    expect(generateCustomInlineStylesCss({})).toBe("")

    const mockPayload: ISiYuanInlineStylesPayload = {
      version: 1,
      styles: [
        {
          id: "brand-highlight",
          name: "品牌高亮",
          light: { color: "#ff1122", backgroundColor: "#fff0f0" },
          dark: { color: "#ff8899", backgroundColor: "#330011" },
        },
      ],
      builtin: {
        colors: [
          {
            index: 1,
            light: { color: "#e60000" },
            dark: { color: "#ff4444" },
          },
        ],
        styles: [
          {
            id: "warning",
            light: { color: "#996600" },
            dark: { backgroundColor: "#443311" },
          },
        ],
      },
    }

    const css = generateCustomInlineStylesCss(mockPayload)
    expect(css).toContain("--b3-inline-style-brand-highlight-color: #ff1122;")
    expect(css).toContain("--b3-inline-style-brand-highlight-background-color: #fff0f0;")
    expect(css).toContain("--b3-font-color1: #e60000;")
    expect(css).toContain("--b3-card-warning-color: #996600;")

    // 深色部分
    expect(css).toContain("html.dark")
    expect(css).toContain("--b3-inline-style-brand-highlight-color: #ff8899;")
    expect(css).toContain("--b3-font-color1: #ff4444;")
    expect(css).toContain("--b3-card-warning-background: #443311;")
  })

  it("generateCompleteSiYuanThemeCss 无自定义样式时返回默认调色板，有自定义时自动合并", () => {
    const defaultCss = generateCompleteSiYuanThemeCss()
    expect(defaultCss).toBe(DEFAULT_SIYUAN_PALETTE_CSS)

    const mergedCss = generateCompleteSiYuanThemeCss({
      styles: [
        {
          id: "custom-red",
          light: { color: "#ff0000" },
        },
      ],
    })
    expect(mergedCss).toContain("/* SiYuan Note Built-in Font & Background Styles for Slidev */")
    expect(mergedCss).toContain("/* Custom Workspace Inline Styles */")
    expect(mergedCss).toContain("--b3-inline-style-custom-red-color: #ff0000;")
  })

  it("convertBlockToHtml 渲染带样式的块时应注入 style 和 slide-styled-block", () => {
    const block = {
      id: "styled-block-1",
      type: "p",
      content: "带背景色的段落",
      rawMarkdown: "带背景色的段落",
      attributes: {
        style: "color: var(--b3-font-color6); background-color: var(--b3-font-background6);",
      },
    }

    const html = convertBlockToHtml(block)
    expect(html).toContain('style="color: var(--b3-font-color6); background-color: var(--b3-font-background6);"')
    expect(html).toContain("slide-styled-block")
    expect(html).toContain("带背景色的段落")
  })

  it("单文件 HTML 导出 buildStandaloneHtml 应注入思源主题调色板 CSS", () => {
    const doc: ISlidesDocument = {
      docId: "doc-test-styled",
      config: {
        theme: "default",
      },
      slides: [
        {
          pageIndex: 1,
          startBlockId: "start-1",
          frontmatter: { layout: "default" },
          blocks: [
            {
              id: "b1",
              type: "p",
              content: '<span style="color: var(--b3-font-color1);">红字</span>',
              rawMarkdown: '<span style="color: var(--b3-font-color1);">红字</span>',
            },
          ],
        },
      ],
      fullMarkdown: "",
    }

    const html = buildStandaloneHtml(doc)
    expect(html).toContain("--b3-font-color1:")
    expect(html).toContain("--b3-font-background1:")
    expect(html).toContain(".slide-styled-block")
  })

  it("PDF 打印导出 buildPrintableHtml 应注入思源主题调色板 CSS", () => {
    const doc: ISlidesDocument = {
      docId: "doc-test-pdf-styled",
      config: {
        theme: "default",
      },
      slides: [
        {
          pageIndex: 1,
          startBlockId: "start-1",
          frontmatter: { layout: "default" },
          blocks: [
            {
              id: "b1",
              type: "p",
              content: "测试 PDF 样式",
              rawMarkdown: "测试 PDF 样式",
            },
          ],
        },
      ],
      fullMarkdown: "",
    }

    const html = buildPrintableHtml(doc)
    expect(html).toContain("--b3-font-color1:")
    expect(html).toContain("--b3-font-background1:")
    expect(html).toContain(".slide-styled-block")
  })

  it("cleanAndTransformInlineKramdown 能彻底清除行内冗余 Kramdown Span IAL 并正确转换样式", () => {
    // 真实思源格式：已有 span 标签，紧随冗余 Span IAL
    const siyuanRaw = '### 聚焦笔记<span data-type="text" style="color: var(--b3-font-color8); font-size: 31px;">领域</span>{: style="color: var(--b3-font-color8); font-size: 31px;"}：从为知笔记到思源笔记'
    const cleaned = cleanAndTransformInlineKramdown(siyuanRaw)
    expect(cleaned).toBe('### 聚焦笔记<span data-type="text" style="color: var(--b3-font-color8); font-size: 31px;">领域</span>：从为知笔记到思源笔记')
    expect(cleaned).not.toContain("{: style=")

    // Markdown 加粗后带 style IAL
    const boldWithIal = '**重点词**{: style="color: var(--b3-font-color1);"}'
    expect(cleanAndTransformInlineKramdown(boldWithIal)).toBe('<span style="color: var(--b3-font-color1);">**重点词**</span>')

    // 纯中文词汇后带 style IAL
    const plainWordWithIal = '聚焦领域{: style="color: red;"}'
    expect(cleanAndTransformInlineKramdown(plainWordWithIal)).toBe('<span style="color: red;">聚焦领域</span>')

    // 清除元数据 IAL
    const metaIal = '正文{: custom-id="12345" updated="2026"}'
    expect(cleanAndTransformInlineKramdown(metaIal)).toBe("正文")
  })

  it("buildSlidesDocument 编译带行内样式的思源标题块时，不泄漏 IAL 且不篡改块级样式", () => {
    const rawHeading = '### 聚焦笔记<span data-type="text" style="color: var(--b3-font-color8); font-size: 31px;">领域</span>{: style="color: var(--b3-font-color8); font-size: 31px;"}：从为知笔记到思源笔记'
    const blockNode = {
      id: "heading-1",
      root_id: "doc-1",
      type: "h",
      subType: "h3",
      content: "聚焦笔记领域：从为知笔记到思源笔记",
      markdown: rawHeading,
      ial: {
        id: "heading-1",
      },
    }

    const doc = buildSlidesDocument("doc-1", {}, [blockNode])
    const slideBlock = doc.slides[0].blocks[0]

    // 1. 块的 rawMarkdown 中不包含未转义的 {: style=...}
    expect(slideBlock.rawMarkdown).not.toContain("{: style=")
    expect(slideBlock.rawMarkdown).toContain('<span data-type="text" style="color: var(--b3-font-color8); font-size: 31px;">领域</span>')

    // 2. 块本身没有块级 style 属性（不能污染整行标题变成红色或缩小）
    expect(slideBlock.attributes?.style).toBeUndefined()

    // 3. 页面原始 Markdown 也不含有泄漏代码
    expect(doc.slides[0].rawMarkdown).not.toContain("{: style=")

    // 4. 导出渲染器 convertBlockToHtml 渲染出的 HTML 正确保留 h3 和 span
    const html = convertBlockToHtml(slideBlock)
    expect(html).toContain("<h3>聚焦笔记<span")
    expect(html).toContain('style="color: var(--b3-font-color8); font-size: 31px;"')
    expect(html).toContain("领域</span>：从为知笔记到思源笔记</h3>")
    expect(html).not.toContain("{: style=")
  })
})

