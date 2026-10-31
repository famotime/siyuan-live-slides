import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { SLIDES_CUSTOM_STYLES_CSS, WorkspaceScaffolder } from "../src/engine/workspace-scaffolder"
import { buildPrintableHtml } from "../src/export/pdf-exporter"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import type { ISlidesDocument } from "../src/types/slides-protocol"

describe("Theme Link & Ref Styles (超链接与块引用 Slidev 规范与主题设计测试)", () => {
  const sampleDoc: ISlidesDocument = {
    docId: "doc-links-test",
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
        startBlockId: "b-1",
        frontmatter: { layout: "default" },
        notes: "",
        blocks: [
          {
            id: "b-link",
            type: "p",
            content: "参考 [Slidev 官网](https://sli.dev) 以及 ((20260625214150-d151ljw '《福格行为模型》'))",
            rawMarkdown: "参考 [Slidev 官网](https://sli.dev) 以及 ((20260625214150-d151ljw '《福格行为模型》'))",
          },
        ],
        rawMarkdown: "参考 [Slidev 官网](https://sli.dev) 以及 ((20260625214150-d151ljw '《福格行为模型》'))",
      },
    ],
    fullMarkdown: "",
  }

  it("Web Sandbox HTML 模版应包含 Slidev 规范的超链接与主题色块引用样式", () => {
    const indexPath = path.resolve(__dirname, "../public/slides-client/index.html")
    const content = fs.readFileSync(indexPath, "utf-8")

    // 不再使用默认浏览器蓝字下划线，而是使用正文继承色与虚线底边
    expect(content).toContain("border-bottom: 1px dashed currentColor")
    expect(content).toContain("color: inherit")
    expect(content).toContain("text-decoration: none")
    expect(content).toContain("a.slides-link")

    // Hover 态高亮为主题强调色并转为实线
    expect(content).toContain("color: var(--slide-accent)")
    expect(content).toContain("border-bottom-style: solid")

    // 块引用胶囊标签与面板全面告别硬编码蓝色，动态联动 var(--slide-accent)
    expect(content).toContain("color-mix(in srgb, var(--slide-accent) 12%, transparent)")
    expect(content).toContain("color-mix(in srgb, var(--slide-accent) 25%, transparent)")
    expect(content).toContain("border-left: 3px solid var(--slide-accent)")
  })

  it("演讲者模式 Presenter HTML 模版应包含 Slidev 规范超链接样式", () => {
    const presenterPath = path.resolve(__dirname, "../public/slides-client/presenter.html")
    const content = fs.readFileSync(presenterPath, "utf-8")

    expect(content).toContain("border-bottom: 1px dashed currentColor")
    expect(content).toContain("color: var(--accent-color)")
  })

  it("单文件离线 HTML 导出产物应包含主题自适应超链接与块引用样式", () => {
    const html = buildStandaloneHtml(sampleDoc)

    expect(html).toContain("border-bottom: 1px dashed currentColor")
    expect(html).toContain("color: var(--slide-accent)")
    expect(html).toContain("color-mix(in srgb, var(--slide-accent)")
  })

  it("PDF 讲义导出产物应包含 Slidev 规范超链接与块引用样式", () => {
    const html = buildPrintableHtml(sampleDoc)

    expect(html).toContain("border-bottom: 1px dashed currentColor")
    expect(html).toContain(".slides-ref-tag, a.slides-ref-tag")
    expect(html).toContain(".slides-block-ref, .pdf-block--ref")
  })

  it("WorkspaceScaffolder 的 styles/index.css 应包含 Slidev 原生主题色联动样式", () => {
    expect(SLIDES_CUSTOM_STYLES_CSS).toContain(".slides-ref-tag")
    expect(SLIDES_CUSTOM_STYLES_CSS).toContain("var(--slides-theme-primary")
    expect(SLIDES_CUSTOM_STYLES_CSS).toContain("color-mix(in srgb, var(--slides-theme-primary")
  })
})
