import { describe, it, expect, beforeEach } from "vitest"
import {
  DEFAULT_GLOBAL_SETTINGS,
  globalSettingsState,
  normalizeGlobalSettings,
  setRuntimeSettings,
  getRuntimeSettings,
} from "../src/settings"
import { parseDocumentConfig } from "../src/compiler/scope-mapper"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import { generatePdfExportStyles } from "../src/export/pdf-template-styles"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import { buildPrintableHtml } from "../src/export/pdf-exporter"
import { renderSlideBlocksToHtml } from "../src/export/slide-layout-renderer"

describe("v0.8.0 Enhancements: Heading Normalization, Multi-col Center & Lightbox", () => {
  beforeEach(() => {
    setRuntimeSettings({ ...DEFAULT_GLOBAL_SETTINGS })
  })

  describe("1. 全局特定标题大小固定设置 (normalizeHeadingSizes)", () => {
    it("默认情况下 normalizeHeadingSizes 应为 false", () => {
      expect(DEFAULT_GLOBAL_SETTINGS.normalizeHeadingSizes).toBe(false)
      expect(getRuntimeSettings().normalizeHeadingSizes).toBe(false)
    })

    it("normalizeGlobalSettings 应正确解析并归一化布尔值", () => {
      const resTrue = normalizeGlobalSettings({ normalizeHeadingSizes: true })
      expect(resTrue.normalizeHeadingSizes).toBe(true)

      const resFalse = normalizeGlobalSettings({ normalizeHeadingSizes: false })
      expect(resFalse.normalizeHeadingSizes).toBe(false)

      const resEmpty = normalizeGlobalSettings({})
      expect(resEmpty.normalizeHeadingSizes).toBe(false)
    })

    it("setRuntimeSettings 能响应式更新 normalizeHeadingSizes 并体现在 parseDocumentConfig 中", () => {
      setRuntimeSettings({ normalizeHeadingSizes: true })
      expect(getRuntimeSettings().normalizeHeadingSizes).toBe(true)

      const config = parseDocumentConfig({})
      expect(config.normalizeHeadingSizes).toBe(true)
    })
  })

  describe("2. 单文件导出与 PDF 导出中的 CSS 规则注入", () => {
    it("generateStandaloneExportStyles 应包含表头多栏内首个列表项去圆点后居中显示的样式规则", () => {
      const css = generateStandaloneExportStyles()
      expect(css).toContain("/* 表头多栏内超级块子块首个列表项去圆点后居中显示标题/首行文本 */")
      expect(css).toContain(".layout-cols-wrapper .pdf-col > *:first-child .slide-list-item-title")
      expect(css).toContain("text-align: center !important;")
    })

    it("generateStandaloneExportStyles 应包含特定标题大小固定 (H2 / H3) 规则", () => {
      const css = generateStandaloneExportStyles()
      expect(css).toContain('[data-normalize-headings="true"] .slide-content:not(.layout-cover)')
      expect(css).toContain("font-size: 1.7rem !important;")
      expect(css).toContain("font-size: 1.3rem !important;")
    })

    it("generatePdfExportStyles 应包含特定标题大小固定与多栏居中规则", () => {
      const css = generatePdfExportStyles({ pageRatio: "16:9" })
      expect(css).toContain("/* 表头多栏内超级块子块首个列表项去圆点后居中显示标题/首行文本 */")
      expect(css).toContain('[data-normalize-headings="true"]')
      expect(css).toContain("font-size: 1.7rem !important;")
      expect(css).toContain("font-size: 1.3rem !important;")
    })

    it("buildStandaloneHtml 应在 #app 上正确携带 data-normalize-headings 属性", () => {
      const testDoc = {
        docId: "doc-test-1",
        title: "Test Presentation",
        config: {
          theme: "default",
          aspectRatio: "16/9",
          highlighter: "shiki" as const,
          defaultTransition: "slide-left",
          colorSchema: "dark" as const,
          normalizeHeadingSizes: true,
        },
        slides: [],
      }

      const html = buildStandaloneHtml(testDoc)
      expect(html).toContain('data-normalize-headings="true"')
    })

    it("buildPrintableHtml 应在 body 上正确携带 data-normalize-headings 属性", () => {
      const testDoc = {
        docId: "doc-test-2",
        title: "Test PDF",
        config: {
          theme: "default",
          aspectRatio: "16/9",
          highlighter: "shiki" as const,
          defaultTransition: "slide-left",
          colorSchema: "light" as const,
          normalizeHeadingSizes: true,
        },
        slides: [],
      }

      const html = buildPrintableHtml(testDoc)
      expect(html).toContain('<body data-normalize-headings="true">')
    })

    it("renderSlideBlocksToHtml 应正确为非封面页首标题标记 slidev-page-first-heading-block", () => {
      const slide = {
        pageIndex: 2,
        frontmatter: { layout: "default" },
        blocks: [
          { id: "b1", type: "p", content: "前置段落" },
          { id: "b2", type: "h", content: "#### 四级标题作为页首首标题", rawMarkdown: "#### 四级标题作为页首首标题" },
          { id: "b3", type: "h", content: "### 后续三级标题", rawMarkdown: "### 后续三级标题" },
        ],
      }
      const html = renderSlideBlocksToHtml(slide as any)
      expect(html).toContain("slidev-page-first-heading-block")
      expect(html).toMatch(/class="[^"]*slidev-page-first-heading-block[^"]*"[^>]*><h4/)
    })

    it("renderSlideBlocksToHtml 应为多栏布局各栏首个标题标记 slidev-col-first-heading-block", () => {
      const slide = {
        pageIndex: 3,
        frontmatter: { layout: "two-cols" },
        blocks: [
          { id: "b1", type: "h", content: "## 左栏首个标题", rawMarkdown: "## 左栏首个标题", slot: "left" },
          { id: "b2", type: "h", content: "#### 右栏首个标题", rawMarkdown: "#### 右栏首个标题", slot: "right" },
        ],
      }
      const html = renderSlideBlocksToHtml(slide as any)
      expect(html).toContain("slidev-col-first-heading-block")
      expect(html).toMatch(/class="[^"]*slidev-col-first-heading-block[^"]*"[^>]*><h4/)
    })
  })
})
