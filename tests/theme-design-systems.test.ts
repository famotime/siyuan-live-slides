import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import { generatePdfExportStyles } from "../src/export/pdf-template-styles"
import { buildPrintableHtml } from "../src/export/pdf-exporter"
import { ISlidesDocument } from "../src/types/slides-protocol"

describe("Theme Design Systems & Contrast Guard (三大主题鲜明特色与亮暗对比度测试)", () => {
  const indexHtmlPath = path.resolve(__dirname, "../public/slides-client/index.html")
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8")

  describe("1. 内置沙箱播放端 (public/slides-client/index.html)", () => {
    it("应包含默认科技主题 (Default) 的专属翡翠/青蓝渐变、科技指示条与 WCAG AAA 高对比度", () => {
      expect(indexHtml).toContain('[data-slides-theme="default"]')
      expect(indexHtml).toContain('.slides-theme-default')
      // 亮色深渊墨蓝黑 (17:1 对比度)
      expect(indexHtml).toContain('--slide-text: #0f172a;')
      // 暗色纯净钛白 (18:1 对比度)
      expect(indexHtml).toContain('--slide-text: #f1f5f9;')
      // 科技感垂直指示条 (Accent 垂直指示条)
      expect(indexHtml).toContain('border-left: 4px solid var(--slide-accent);')
    })

    it("应包含优雅衬线主题 (Seriph) 的学术书卷质感、温暖羊皮纸背景、细下划线与大双引号引用", () => {
      expect(indexHtml).toContain('[data-slides-theme="seriph"]')
      expect(indexHtml).toContain('.slides-theme-seriph')
      // 亮色暖羊皮纸背景与古雅暖碳黑
      expect(indexHtml).toContain('--slide-bg: #fcfbf7;')
      expect(indexHtml).toContain('--slide-text: #231f1d;')
      // 暗色乌木褐黑与绢丝白
      expect(indexHtml).toContain('--slide-bg: #171513;')
      expect(indexHtml).toContain('--slide-text: #f5f2eb;')
      // 正文标题细下划线
      expect(indexHtml).toContain('border-bottom: 1.5px solid color-mix(in srgb, var(--slide-accent) 45%, transparent);')
      // 优雅古典大双引号
      expect(indexHtml).toContain('content: "“";')
    })

    it("应包含极简发布会主题 (Apple Basic) 的绝对黑白纯粹主义、特大字重排版与 16px 无边框平底大圆角", () => {
      expect(indexHtml).toContain('[data-slides-theme="apple-basic"]')
      expect(indexHtml).toContain('.slides-theme-apple-basic')
      // 亮色纯白与纯黑 (21:1 绝对对比度)
      expect(indexHtml).toContain('--slide-bg: #ffffff;')
      expect(indexHtml).toContain('--slide-text: #000000;')
      // 暗色 OLED 纯黑与纯白 (21:1 绝对对比度)
      expect(indexHtml).toContain('--slide-bg: #000000;')
      expect(indexHtml).toContain('--slide-text: #ffffff;')
      // 16px 超大圆角代码与无感底块
      expect(indexHtml).toContain('border-radius: 16px !important;')
      // 标题去装饰化
      expect(indexHtml).toContain('letter-spacing: -0.04em !important;')
    })

    it("应具备复杂背景防穿透文字保护与智能背衬磨砂玻璃 (Text Scrim)", () => {
      expect(indexHtml).toContain('.slide-viewport[style*="background-image"] .slide-content-wrapper h1')
      expect(indexHtml).toContain('text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75)')
      expect(indexHtml).toContain('backdrop-filter: blur(8px);')
    })

    it("应内置背景亮度感知算法与单页主题动态切换机制，设置白色背景时自适应深色文字", () => {
      expect(indexHtml).toContain('function isLightColor(colorStr)')
      expect(indexHtml).toContain('currentSlideThemeMode')
      expect(indexHtml).toContain(':data-theme="currentSlideThemeMode"')
      // 当背景为白色时动态注入深色文字
      expect(indexHtml).toContain("styles['--slide-text'] = '#0f172a'")
    })
  })

  describe("2. 单文件离线 HTML 导出样式 (standalone-template-styles.ts)", () => {
    const css = generateStandaloneExportStyles()

    it("离线单文件导出包应完整同步三大主题设计规范与对比度", () => {
      expect(css).toContain('.slides-theme-default')
      expect(css).toContain('--slide-text: #0f172a;')
      expect(css).toContain('.slides-theme-seriph')
      expect(css).toContain('--slide-bg: #fcfbf7;')
      expect(css).toContain('.slides-theme-apple-basic')
      expect(css).toContain('--slide-text: #000000;')
      expect(css).toContain('text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75)')
    })

    it("单页为 light 时应具备高特异性文字覆盖规则，即使外层为 dark 也强制黑字", () => {
      expect(css).toContain('[data-theme="dark"] .slide-viewport[data-theme="light"]')
      expect(css).toContain('--slide-text: #0f172a !important;')
      expect(css).toContain('--slide-text: #000000 !important;')
    })
  })

  describe("3. PDF 打印与导出管道 (pdf-exporter.ts & pdf-template-styles.ts)", () => {
    it("buildPrintableHtml 应根据文档配置注入对应的主题类名，并根据页面背景自适应 theme-light 或 theme-dark", () => {
      const mockDoc: ISlidesDocument = {
        config: {
          theme: "seriph",
          aspectRatio: "16/9",
        },
        slides: [
          {
            pageIndex: 0,
            frontmatter: { layout: "default", background: "white" },
            blocks: [],
            rawMarkdown: "# 优雅学术展示 (白色背景)",
          },
          {
            pageIndex: 1,
            frontmatter: { layout: "default", background: "#000000" },
            blocks: [],
            rawMarkdown: "# 优雅学术展示 (黑色背景)",
          },
        ],
      }
      const html = buildPrintableHtml(mockDoc, { theme: "dark" })
      expect(html).toContain('slides-theme-seriph')
      expect(html).toContain('data-slides-theme="seriph"')
      // 第 1 页设置了 white 背景，应自适应为 theme-light
      expect(html).toContain('theme-light')
      // 第 2 页设置了黑色背景，应自适应为 theme-dark
      expect(html).toContain('theme-dark')
    })

    it("generatePdfExportStyles 应注入针对三大主题的打印调色板与排版细节", () => {
      const pdfCss = generatePdfExportStyles()
      expect(pdfCss).toContain('.pdf-slide-page.slides-theme-default')
      expect(pdfCss).toContain('.pdf-slide-page.slides-theme-seriph')
      expect(pdfCss).toContain('.pdf-slide-page.slides-theme-apple-basic')
      expect(pdfCss).toContain('color: #059669;')
      expect(pdfCss).toContain('color: #b45309;')
    })
  })
})
