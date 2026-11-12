import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import { generatePdfExportStyles } from "../src/export/pdf-template-styles"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import { buildPrintableHtml } from "../src/export/pdf-exporter"
import type { ISlidesDocument } from "../src/types/slides-protocol"

describe("页面排版间距体系优化 (Spacing Gradient & Hierarchy Linkage)", () => {
  const indexPath = path.resolve(__dirname, "../public/slides-client/index.html")
  const presenterTabPath = path.resolve(__dirname, "../src/ui/tab/SlidesPresenterTab.vue")
  const docInspectorPath = path.resolve(__dirname, "../src/ui/components/DocInspectorSection.vue")
  const pageInspectorPath = path.resolve(__dirname, "../src/ui/components/PageInspectorSection.vue")

  const dummyDoc: ISlidesDocument = {
    docId: "doc-spacing-test",
    title: "Spacing Test Doc",
    config: {
      theme: "default",
      aspectRatio: "16/9",
      spacing: "compact"
    },
    slides: [
      {
        pageIndex: 1,
        frontmatter: { layout: "default", spacing: "compact" },
        blocks: [],
        rawMarkdown: "# Slide 1"
      },
      {
        pageIndex: 2,
        frontmatter: { layout: "two-cols", spacing: "loose" },
        blocks: [],
        rawMarkdown: "# Slide 2"
      }
    ]
  }

  describe("1. 内置 Web 沙箱客户端 (public/slides-client/index.html)", () => {
    const html = fs.readFileSync(indexPath, "utf-8")

    it("沙箱 CSS 应具备 8 个梯级联动 CSS 变量 (内衬/块距/列表距/栏距/标题距/行高)", () => {
      // 紧凑
      expect(html).toContain("--slides-padding-y: 16px;")
      expect(html).toContain("--slides-padding-x: 28px;")
      expect(html).toContain("--slides-block-gap: 8px;")
      expect(html).toContain("--slides-list-gap: 4px;")
      expect(html).toContain("--slides-cols-gap: 20px;")
      expect(html).toContain("--slides-title-margin-bottom: 8px;")
      expect(html).toContain("--slides-header-gap: 10px;")
      expect(html).toContain("--slides-line-height: 1.45;")

      // 标准
      expect(html).toContain("--slides-padding-y: 32px;")
      expect(html).toContain("--slides-padding-x: 48px;")
      expect(html).toContain("--slides-block-gap: 14px;")
      expect(html).toContain("--slides-list-gap: 6px;")
      expect(html).toContain("--slides-cols-gap: 32px;")
      expect(html).toContain("--slides-title-margin-bottom: 12px;")
      expect(html).toContain("--slides-header-gap: 16px;")
      expect(html).toContain("--slides-line-height: 1.6;")

      // 宽松
      expect(html).toContain("--slides-padding-y: 52px;")
      expect(html).toContain("--slides-padding-x: 72px;")
      expect(html).toContain("--slides-block-gap: 22px;")
      expect(html).toContain("--slides-list-gap: 10px;")
      expect(html).toContain("--slides-cols-gap: 44px;")
      expect(html).toContain("--slides-title-margin-bottom: 18px;")
      expect(html).toContain("--slides-header-gap: 24px;")
      expect(html).toContain("--slides-line-height: 1.75;")
    })

    it("Vue setup 的 spacingCssVars 计算属性应返回完整的 8 维度属性映射", () => {
      expect(html).toContain("'--slides-line-height': '1.45'")
      expect(html).toContain("'--slides-line-height': '1.6'")
      expect(html).toContain("'--slides-line-height': '1.75'")
      expect(html).toContain("'--slides-cols-gap': '20px'")
      expect(html).toContain("'--slides-cols-gap': '32px'")
      expect(html).toContain("'--slides-cols-gap': '44px'")
    })

    it("特殊版式 (图文半屏 image-right/image-left) 应全面适配间距内衬变量", () => {
      expect(html).toMatch(/\.image-right-content,\s*\.image-left-content\s*\{[^}]*var\(--slides-padding-y,\s*32px\)\s*var\(--slides-padding-x,\s*48px\)/)
    })

    it("内容块与列表行距应联动应用 --slides-block-gap, --slides-list-gap, --slides-line-height", () => {
      expect(html).toContain("margin-bottom: var(--slides-block-gap, 14px);")
      expect(html).toContain("gap: var(--slides-list-gap, 6px);")
      expect(html).toContain("line-height: var(--slides-line-height, 1.6);")
    })
  })

  describe("2. 单文件离线导出模板 (standalone-template-styles.ts)", () => {
    const css = generateStandaloneExportStyles()

    it("独立 CSS 模板应具备完整梯级间距变量定义", () => {
      expect(css).toContain("--slides-padding-y: 16px;")
      expect(css).toContain("--slides-padding-x: 28px;")
      expect(css).toContain("--slides-padding-y: 52px;")
      expect(css).toContain("--slides-padding-x: 72px;")
      expect(css).toContain("--slides-line-height: 1.45;")
      expect(css).toContain("--slides-line-height: 1.75;")
    })

    it("多栏布局与列表项应动态响应栏间隙与列表项间隙", () => {
      expect(css).toContain("gap: var(--slides-cols-gap, 32px);")
      expect(css).toContain("gap: var(--slides-list-gap, 6px);")
      expect(css).toContain("margin-bottom: var(--slides-list-gap, 6px) !important;")
      expect(css).toContain("padding: var(--slides-padding-y, 32px) var(--slides-padding-x, 48px);")
    })

    it("buildStandaloneHtml 产出文档应注入正确间距类与样式", () => {
      const rendered = buildStandaloneHtml(dummyDoc)
      expect(rendered).toContain("spacing-compact")
      expect(rendered).toContain("--slides-padding-y: 16px;")
      expect(rendered).toContain("--slides-padding-y: 52px;")
    })
  })

  describe("3. PDF 打印与导出模板 (pdf-template-styles.ts)", () => {
    const pdfCss = generatePdfExportStyles()

    it("PDF 打印样式应具备高辨识度间距梯级变量", () => {
      expect(pdfCss).toContain(".pdf-slide-page.spacing-compact")
      expect(pdfCss).toContain("--slides-padding-y: 16px;")
      expect(pdfCss).toContain("--slides-padding-x: 28px;")
      expect(pdfCss).toContain(".pdf-slide-page.spacing-loose")
      expect(pdfCss).toContain("--slides-padding-y: 52px;")
      expect(pdfCss).toContain("--slides-padding-x: 72px;")
      expect(pdfCss).toContain("--slides-cols-gap: 20px;")
      expect(pdfCss).toContain("--slides-cols-gap: 44px;")
    })

    it("buildPrintableHtml 产出 HTML 应正确包含紧凑与宽松页面", () => {
      const printableHtml = buildPrintableHtml(dummyDoc)
      expect(printableHtml).toContain("spacing-compact")
      expect(printableHtml).toContain("spacing-loose")
      expect(printableHtml).toContain(".pdf-slide-page.spacing-compact")
    })
  })

  describe("4. 演讲者分屏控制台 (SlidesPresenterTab.vue)", () => {
    const presenterCode = fs.readFileSync(presenterTabPath, "utf-8")

    it("分屏样式应与主播放器保持间距变量绝对一致", () => {
      expect(presenterCode).toContain("--slides-padding-y: 16px;")
      expect(presenterCode).toContain("--slides-padding-x: 28px;")
      expect(presenterCode).toContain("--slides-padding-y: 52px;")
      expect(presenterCode).toContain("--slides-padding-x: 72px;")
      expect(presenterCode).toContain("--slides-line-height: 1.45;")
      expect(presenterCode).toContain("--slides-line-height: 1.75;")
      expect(presenterCode).toContain("gap: var(--slides-cols-gap, 32px);")
    })
  })

  describe("5. 属性检查器 UI (DocInspectorSection & PageInspectorSection)", () => {
    const docInspectorCode = fs.readFileSync(docInspectorPath, "utf-8")
    const pageInspectorCode = fs.readFileSync(pageInspectorPath, "utf-8")

    it("文档级与页面级检查器按钮 Tooltip 应清晰呈现外衬、块距与行高梯级", () => {
      expect(docInspectorCode).toContain("紧凑排版：外衬 16/28px，块距 8px，行高 1.45")
      expect(docInspectorCode).toContain("标准排版：外衬 32/48px，块距 14px，行高 1.60（推荐默认）")
      expect(docInspectorCode).toContain("宽松排版：外衬 52/72px，块距 22px，行高 1.75")
      expect(docInspectorCode).toContain("内衬、内容间隙与正文行距预设")

      expect(pageInspectorCode).toContain("紧凑排版：外衬 16/28px，块距 8px，行高 1.45")
      expect(pageInspectorCode).toContain("标准排版：外衬 32/48px，块距 14px，行高 1.60")
      expect(pageInspectorCode).toContain("宽松排版：外衬 52/72px，块距 22px，行高 1.75")
      expect(pageInspectorCode).toContain("覆盖本页内衬、内容间隙与正文行距")
    })
  })
})
