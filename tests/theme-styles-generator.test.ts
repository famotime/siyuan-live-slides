import { describe, expect, it } from "vitest"
import {
  DEFAULT_SIYUAN_PALETTE_CSS,
  generateCustomInlineStylesCss,
  generateCompleteSiYuanThemeCss,
  type ISiYuanInlineStylesPayload,
} from "../src/compiler/theme-styles-generator"
import { wrapElementDirectives } from "../src/compiler/slidev-ast-builder"
import { convertBlockToHtml } from "../src/export/markdown-renderer"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import { buildPrintableHtml } from "../src/export/pdf-exporter"
import type { ISlidevDocument } from "../src/types/slidev-protocol"

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

  it("wrapElementDirectives 当传入块级 style 时应生成带 slide-styled-block 和 style 的容器", () => {
    const rawContent = "## 带有背景色的标题"
    const styleAttr = "color: var(--b3-font-color1); background-color: var(--b3-font-background2);"

    const wrapped = wrapElementDirectives(rawContent, undefined, undefined, styleAttr)
    expect(wrapped).toContain(`<div style="${styleAttr}" class="slide-styled-block">`)
    expect(wrapped).toContain(rawContent)
    expect(wrapped).toContain("</div>")
  })

  it("wrapElementDirectives 同时具备 v-click 和 style 时应正确结合 class 和 style", () => {
    const rawContent = "点击后淡入的卡片"
    const styleAttr = "background-color: var(--b3-font-background6);"

    const wrapped = wrapElementDirectives(rawContent, "1", undefined, styleAttr)
    expect(wrapped).toContain(`v-click="1"`)
    expect(wrapped).toContain(`style="${styleAttr}"`)
    expect(wrapped).toContain(`class="slide-styled-block"`)
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
    const doc: ISlidevDocument = {
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
    const doc: ISlidevDocument = {
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
})
