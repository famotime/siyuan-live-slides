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
      expect(css).toContain("/* 表头多栏内超级块子块首个列表项去圆点后居中显示标题/首行文本 (仅在存在超级块分栏时生效) */")
      expect(css).toContain(".has-superblock-cols .pdf-col > *:first-child .slide-list-item-title")
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
      expect(css).toContain("/* 表头多栏内超级块子块首个列表项去圆点后居中显示标题/首行文本 (仅在存在超级块分栏时生效) */")
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

    it("renderSlideBlocksToHtml 应为存在超级块的表头多栏布局各栏首个标题标记 slidev-col-first-heading-block", () => {
      const slide = {
        pageIndex: 3,
        frontmatter: { layout: "cols-header" },
        blocks: [
          { id: "h1", type: "h", content: "# 顶栏大标题", slot: "header" },
          { id: "b1", type: "h", content: "## 左栏首个标题", rawMarkdown: "## 左栏首个标题", slot: "col-1" },
          { id: "b2", type: "h", content: "#### 右栏首个标题", rawMarkdown: "#### 右栏首个标题", slot: "col-2" },
        ],
      }
      const html = renderSlideBlocksToHtml(slide as any)
      expect(html).toContain("slidev-col-first-heading-block")
      expect(html).toMatch(/class="[^"]*slidev-col-first-heading-block[^"]*"[^>]*><h4/)
      expect(html).toContain("has-superblock-cols")
    })
  })

  describe("4. 表头多栏超级块子块首个列表项去圆点与居中显示", () => {
    it("复合 Markdown 块中首个段落自动标记为 slide-list-item-title，后续段落标记为 slide-list-item-desc", async () => {
      const { renderCompoundMarkdown } = await import("../src/export/visual-list-renderer")
      const md = "核心引擎架构\n零网络依赖极速离线放映"
      const html = renderCompoundMarkdown(md)
      expect(html).toContain('<p class="slide-list-item-title">核心引擎架构</p>')
      expect(html).toContain('<p class="slide-list-item-desc">零网络依赖极速离线放映</p>')
    })

    it("单文件导出样式包含表头多栏超级块首个列表项去圆点、清除 marker 与居中声明 (限定在 has-superblock-cols 范围)", async () => {
      const { generateStandaloneExportStyles } = await import("../src/export/standalone-template-styles")
      const css = generateStandaloneExportStyles()

      // 首个列表项去圆点与居中
      expect(css).toContain(".has-superblock-cols .pdf-col > *:first-child :is(ul, ol) > li:first-child")
      expect(css).toContain("list-style: none !important")
      expect(css).toContain("text-align: center !important")
      // marker 清除
      expect(css).toContain("li:first-child::marker")
      // 左对齐明确排除首项
      expect(css).toContain(".has-superblock-cols .pdf-col li:not(:first-child)")
    })

    it("PDF 导出样式同样包含表头多栏超级块首个列表项去圆点、清除 marker 与居中声明 (限定在 has-superblock-cols 范围)", async () => {
      const { generatePdfExportStyles } = await import("../src/export/pdf-template-styles")
      const css = generatePdfExportStyles()

      expect(css).toContain(".has-superblock-cols .pdf-col > *:first-child :is(ul, ol) > li:first-child")
      expect(css).toContain("list-style: none !important")
      expect(css).toContain("text-align: center !important")
      expect(css).toContain("li:first-child::marker")
      expect(css).toContain(".has-superblock-cols .pdf-col li:not(:first-child)")
    })

    it("当列表项内容为以 # 开头的标题时，自动赋予 slide-list-item-title 类名", async () => {
      const { renderCompoundMarkdown } = await import("../src/export/visual-list-renderer")
      const md = "# 模块化设计\n底层逻辑解耦清晰"
      const html = renderCompoundMarkdown(md)
      expect(html).toContain('<h1 class="slide-list-item-title">模块化设计</h1>')
      expect(html).toContain('<p class="slide-list-item-desc">底层逻辑解耦清晰</p>')
    })

    it("convertBlockToHtml 对作为标题的列表项块赋予 slide-list-item-title 类名", async () => {
      const { convertBlockToHtml } = await import("../src/export/markdown-renderer")
      const block = {
        id: "b-h",
        type: "i",
        content: "### 分栏首标题",
        rawMarkdown: "### 分栏首标题",
      }
      const html = convertBlockToHtml(block as any, { extraClassName: "slidev-col-first-heading-block" })
      expect(html).toContain('<h3 class="slide-list-item-title">分栏首标题</h3>')
    })

    it("单文件导出样式与 PDF 样式中的标题选择器为后代选择器并包含 h1~h6 强制居中 (限定在 has-superblock-cols 范围)", async () => {
      const { generateStandaloneExportStyles } = await import("../src/export/standalone-template-styles")
      const { generatePdfExportStyles } = await import("../src/export/pdf-template-styles")

      const htmlCss = generateStandaloneExportStyles()
      const pdfCss = generatePdfExportStyles()

      // 后代选择器包含 h1~h6 居中，且限定在 has-superblock-cols 范围
      expect(htmlCss).toContain(".has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6)")
      expect(htmlCss).toContain(".has-superblock-cols .slidev-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title)")
      expect(pdfCss).toContain(".has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6)")
      expect(pdfCss).toContain(".has-superblock-cols .slidev-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title)")

      // 固定特定标题大小选项中同样包含居中声明，两者协同无冲突
      expect(htmlCss).toContain('data-normalize-headings="true"] .has-superblock-cols .slidev-col-first-heading-block')
      expect(pdfCss).toContain('data-normalize-headings="true"] .has-superblock-cols .slidev-col-first-heading-block')
    })
  })

  describe("5. 离线客户端运行时与 Pro CLI 模式中的标题规范化全面生效验证", () => {
    it("getStandaloneClientRuntimeScript 应包含 isHeadingBlock 与页首/栏首打标逻辑", async () => {
      const { getStandaloneClientRuntimeScript } = await import("../src/export/standalone-client-runtime")
      const script = getStandaloneClientRuntimeScript()
      expect(script).toContain("function isHeadingBlock(b)")
      expect(script).toContain("slidev-page-first-heading-block")
      expect(script).toContain("slidev-col-first-heading-block")
    })

    it("CliDevServerBridge.buildStandardSlidevMarkdown 在开启 normalizeHeadingSizes 时应注入规范化样式", async () => {
      const { CliDevServerBridge } = await import("../src/engine/cli-devserver-bridge")
      const bridge = new CliDevServerBridge()
      const doc = {
        docId: "doc-cli-test",
        title: "CLI Normalization Test",
        config: {
          theme: "default",
          aspectRatio: "16/9",
          highlighter: "shiki" as const,
          defaultTransition: "slide-left",
          colorSchema: "dark" as const,
          normalizeHeadingSizes: true,
        },
        slides: [
          {
            pageIndex: 1,
            frontmatter: { layout: "default" },
            blocks: [{ id: "b1", type: "h", content: "### 页首标题", rawMarkdown: "### 页首标题" }],
          },
        ],
      }
      const md = bridge.buildStandardSlidevMarkdown(doc as any)
      expect(md).toContain("<style>")
      expect(md).toContain("Specific Heading Normalization")
      expect(md).toContain("font-size: 1.7rem !important;")
      expect(md).toContain("font-size: 1.3rem !important;")
    })

    it("单文件导出与 PDF 导出样式应包含后置强力覆盖规则以防被列表项字号覆写", async () => {
      const { generateStandaloneExportStyles } = await import("../src/export/standalone-template-styles")
      const { generatePdfExportStyles } = await import("../src/export/pdf-template-styles")

      const htmlCss = generateStandaloneExportStyles()
      const pdfCss = generatePdfExportStyles()

      expect(htmlCss).toContain("/* 全局特定标题大小规范化后置强力锁定 (防止被列表项内部字号覆盖) */")
      expect(pdfCss).toContain("/* 全局特定标题大小规范化后置强力锁定 (防止被列表项内部字号覆盖) */")
      expect(htmlCss).toContain(".slide-content:not(.layout-cover) > :is(.pdf-block, .slide-block):first-child")
      expect(pdfCss).toContain(".pdf-slide:not(.layout-cover) > :is(.pdf-block, .slide-block):first-child")
    })

    it("public/slidev-client/index.html 应在 setup 中返回 config 与 isNormalizeHeadings 并绑定至 DOM", async () => {
      const fs = await import("fs")
      const path = await import("path")
      const html = fs.readFileSync(path.resolve(__dirname, "../public/slidev-client/index.html"), "utf-8")
      expect(html).toContain(":data-normalize-headings=\"isNormalizeHeadings ? 'true' : null\"")
      expect(html).toMatch(/return\s*\{[^}]*\bconfig\b[^}]*\bisNormalizeHeadings\b/)
      expect(html).toContain("const isNormalizeHeadings = computed(() => Boolean(config.value?.normalizeHeadingSizes))")
    })

    it("standalone-client-runtime 应全面兼容 H1~H6 任意层级标题（涵盖六级标题 ######）", async () => {
      const { getStandaloneClientRuntimeScript } = await import("../src/export/standalone-client-runtime")
      const script = getStandaloneClientRuntimeScript()
      expect(script).toContain("const hMatch = md.match(/^(#{1,6})\\s+(.*)$/);")
      expect(script).toContain("div.innerHTML = \"<h\" + level + \">\" + th + \"</h\" + level + \">\";")
    })

    it("convertBlockToHtml 对作为分栏首块的列表项块赋予 slide-list-item-title 类名，普通列表项不赋予", async () => {
      const { convertBlockToHtml } = await import("../src/export/markdown-renderer")
      const colFirstBlock = {
        id: "b-h",
        type: "i",
        content: "### 分栏首标题",
        rawMarkdown: "### 分栏首标题",
        isColFirst: true,
      }
      const html1 = convertBlockToHtml(colFirstBlock as any, { extraClassName: "slidev-col-first-heading-block" })
      expect(html1).toContain('<h3 class="slide-list-item-title">分栏首标题</h3>')

      const normalListBlock = {
        id: "b-normal",
        type: "i",
        content: "### 普通列表标题",
        rawMarkdown: "### 普通列表标题",
      }
      const html2 = convertBlockToHtml(normalListBlock as any)
      expect(html2).toContain('<h3>普通列表标题</h3>')
      expect(html2).not.toContain('slide-list-item-title')
    })

    it("单文件导出样式与 PDF 样式中的标题选择器仅对 has-superblock-cols 强制居中，且图左图右被排除", async () => {
      const { generateStandaloneExportStyles } = await import("../src/export/standalone-template-styles")
      const { generatePdfExportStyles } = await import("../src/export/pdf-template-styles")

      const htmlCss = generateStandaloneExportStyles()
      const pdfCss = generatePdfExportStyles()

      // 居中与标题规格化限定在 has-superblock-cols 范围
      expect(htmlCss).toContain(".has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6)")
      expect(htmlCss).toContain(".has-superblock-cols .slidev-col-first-heading-block")
      expect(pdfCss).toContain(".has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6)")
      expect(pdfCss).toContain(".has-superblock-cols .slidev-col-first-heading-block")

      // 图左与图右完全排除在规范化与居中之外
      expect(htmlCss).toContain("layout-image-left, .layout-image-right")
      expect(pdfCss).toContain("layout-image-left, .layout-image-right")
    })

    it("renderSlideBlocksToHtml 在存在超级块插槽时添加 has-superblock-cols，普通列表时不添加", async () => {
      const { renderSlideBlocksToHtml } = await import("../src/export/slide-layout-renderer")

      // 场景 1: 带超级块分栏插槽 (col-1, col-2) 的 cols-header 页面
      const sbSlide = {
        pageIndex: 2,
        frontmatter: { layout: "cols-header" },
        blocks: [
          { id: "h1", type: "h", content: "# 页面总标题", slot: "header" },
          { id: "b1", type: "i", content: "- # 栏目 1", slot: "col-1" },
          { id: "b2", type: "i", content: "- # 栏目 2", slot: "col-2" },
        ],
      }
      const sbHtml = renderSlideBlocksToHtml(sbSlide as any)
      expect(sbHtml).toContain("has-superblock-cols")
      expect(sbHtml).toContain("slidev-col-first-heading-block")

      // 场景 2: 无超级块分栏插槽的普通列表页面（即便是 cols-header 版式）
      const normalListSlide = {
        pageIndex: 3,
        frontmatter: { layout: "cols-header" },
        blocks: [
          { id: "h1", type: "h", content: "# 页面总标题", slot: "header" },
          { id: "b1", type: "i", content: "- 普通列表项 1" },
          { id: "b2", type: "i", content: "- 普通列表项 2" },
        ],
      }
      const normalHtml = renderSlideBlocksToHtml(normalListSlide as any)
      expect(normalHtml).not.toContain("has-superblock-cols")
      expect(normalHtml).not.toContain("slidev-col-first-heading-block")
    })
  })
})


