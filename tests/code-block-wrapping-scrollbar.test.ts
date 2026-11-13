import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { mapElementAttrs } from "../src/compiler/scope-mapper"
import { normalizeMaxHeight } from "../src/compiler/directive-wrapper"
import { convertBlockToHtml } from "../src/export/markdown-renderer"
import { buildPrintableHtml } from "../src/export/pdf-exporter"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import {
  ATTR_ELEM_MAX_HEIGHT,
  type ISlidesBlockItem,
  type ISlidesDocument,
} from "../src/types/slides-protocol"

describe("Code Block Wrapping & Subtle Scrollbar (代码块换行、无横向滚动条与弱提示滚动条测试)", () => {
  const sampleDoc: ISlidesDocument = {
    docId: "doc-code-wrap-test",
    config: {
      theme: "default",
      aspectRatio: "16/9",
      highlighter: "shiki",
      defaultTransition: "fade",
      colorSchema: "dark",
    },
    slides: [
      {
        pageIndex: 1,
        startBlockId: "b-slide-1",
        frontmatter: { layout: "image-right" },
        notes: "",
        blocks: [
          {
            id: "b-code-1",
            type: "c",
            content: "```ts [demo.ts]\nconst veryLongCodeLine = '这是一行非常长非常长非常长的代码，在双栏或三栏以及image-right排版时绝不能产生横向滚动条，而应该自动换行排版';\n```",
            rawMarkdown: "```ts [demo.ts]\nconst veryLongCodeLine = '这是一行非常长非常长非常长的代码，在双栏或三栏以及image-right排版时绝不能产生横向滚动条，而应该自动换行排版';\n```",
            attrs: {
              [ATTR_ELEM_MAX_HEIGHT]: "360px",
            },
          },
        ],
        rawMarkdown: "",
      },
    ],
    fullMarkdown: "",
  }

  it("scope-mapper 应正确将 custom-slides-max-height 映射为 block.maxHeight", () => {
    const rawAttrs = {
      [ATTR_ELEM_MAX_HEIGHT]: "400px",
    }
    const mapped = mapElementAttrs(rawAttrs)
    expect(mapped.maxHeight).toBe("400px")
  })

  it("Web Sandbox HTML 模版应包含禁止横向滚动、自动换行与弱提示滚动条样式", () => {
    const indexPath = path.resolve(__dirname, "../public/slides-client/index.html")
    const content = fs.readFileSync(indexPath, "utf-8")

    // 1. 禁止横向滚动条，支持自动换行
    expect(content).toContain("overflow-x: hidden !important")
    expect(content).toContain("overflow-y: auto !important")
    expect(content).toContain("white-space: pre-wrap !important")
    expect(content).toContain("word-break: break-all !important")
    expect(content).toContain("overflow-wrap: anywhere !important")

    // 2. 行号与代码置顶弹性布局
    expect(content).toContain(".slide-block .code-line")
    expect(content).toContain("display: flex !important")
    expect(content).toContain("align-items: flex-start !important")
    expect(content).toContain(".slide-block .code-line .line-no")
    expect(content).toContain(".slide-block .code-line .line-content")

    // 3. 亮色与暗色模式下的 4px 细弱提示滚动条
    expect(content).toContain("[data-theme=\"light\"] *::-webkit-scrollbar")
    expect(content).toContain("[data-theme=\"dark\"] *::-webkit-scrollbar")
    expect(content).toContain("scrollbar-width: thin")
    expect(content).toContain("rgba(0, 0, 0, 0.15)")
    expect(content).toContain("rgba(255, 255, 255, 0.20)")
  })

  it("markdown-renderer 渲染代码块时应将 custom-slides-max-height 注入为 style max-height", () => {
    const block: ISlidesBlockItem = {
      id: "b-test",
      type: "c",
      content: "```ts\nconsole.log(1)\n```",
      rawMarkdown: "```ts\nconsole.log(1)\n```",
      attrs: {
        [ATTR_ELEM_MAX_HEIGHT]: "350px",
      },
    }
    const html = convertBlockToHtml(block)
    expect(html).toContain('style="max-height:350px;overflow-y:auto;"')
    expect(html).toContain("code-line")
    expect(html).toContain("line-no")
    expect(html).toContain("line-content")
  })

  it("Single-HTML Exporter 导出的独立离线 HTML 应包含代码换行、无横向滚动条与弱提示滚动条规则", () => {
    const html = buildStandaloneHtml(sampleDoc)
    expect(html).toContain("overflow-x: hidden !important")
    expect(html).toContain("overflow-y: auto !important")
    expect(html).toContain("white-space: pre-wrap !important")
    expect(html).toContain("word-break: break-all !important")
    expect(html).toContain("scrollbar-width: thin")
    expect(html).toContain("width: 4px")
  })

  it("PDF Exporter 导出的打印 HTML 应包含代码自动换行与行号对齐规则", () => {
    const html = buildPrintableHtml(sampleDoc)
    expect(html).toContain("white-space: pre-wrap !important")
    expect(html).toContain("word-break: break-all !important")
    expect(html).toContain("overflow-wrap: anywhere !important")
    expect(html).toContain(".code-line")
    expect(html).toContain("align-items: flex-start !important")
  })

  it("markdown-renderer 遇到纯数字高度配置时应自动补齐 px 单位并正常渲染", () => {
    const block: ISlidesBlockItem = {
      id: "b-num-height",
      type: "c",
      content: "```ts\nconsole.log(1)\n```",
      rawMarkdown: "```ts\nconsole.log(1)\n```",
      attrs: {
        [ATTR_ELEM_MAX_HEIGHT]: "350",
      },
    }
    const html = convertBlockToHtml(block)
    expect(html).toContain('style="max-height:350px;overflow-y:auto;"')
  })

  it("normalizeMaxHeight 应正确处理纯数字、百分比以及 vh 视口单位转换", () => {
    expect(normalizeMaxHeight("")).toBe("")
    expect(normalizeMaxHeight("320")).toBe("320px")
    expect(normalizeMaxHeight("400px")).toBe("400px")
    expect(normalizeMaxHeight("50%")).toBe("50cqh")
    expect(normalizeMaxHeight("60%")).toBe("60cqh")
    expect(normalizeMaxHeight("50vh")).toBe("50cqh")
    expect(normalizeMaxHeight("40vh")).toBe("40cqh")
    expect(normalizeMaxHeight("50cqh")).toBe("50cqh")
  })

  it("markdown-renderer 遇到百分比高度 50% 与 50vh 时应转换为 50cqh 容器查询限高", () => {
    const blockPct: ISlidesBlockItem = {
      id: "b-pct-height",
      type: "c",
      content: "```ts\nconsole.log(1)\n```",
      rawMarkdown: "```ts\nconsole.log(1)\n```",
      attrs: {
        [ATTR_ELEM_MAX_HEIGHT]: "50%",
      },
    }
    const htmlPct = convertBlockToHtml(blockPct)
    expect(htmlPct).toContain('style="max-height:50cqh;overflow-y:auto;"')

    const blockVh: ISlidesBlockItem = {
      id: "b-vh-height",
      type: "c",
      content: "```ts\nconsole.log(1)\n```",
      rawMarkdown: "```ts\nconsole.log(1)\n```",
      attrs: {
        [ATTR_ELEM_MAX_HEIGHT]: "50vh",
      },
    }
    const htmlVh = convertBlockToHtml(blockVh)
    expect(htmlVh).toContain('style="max-height:50cqh;overflow-y:auto;"')
  })

  it("Web Sandbox HTML 模版应包含选中代码块控制垂直滚动、未选中默认翻页的调度逻辑", () => {
    const indexPath = path.resolve(__dirname, "../public/slides-client/index.html")
    const clientHtml = fs.readFileSync(indexPath, "utf-8")
    expect(clientHtml).toContain("targetPre && isSelected")
    expect(clientHtml).toContain("targetPre.scrollTop += deltaY")
    expect(clientHtml).toContain(".slide-block.highlighted pre::-webkit-scrollbar-thumb")
  })
})
