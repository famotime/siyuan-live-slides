import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import { generatePdfExportStyles } from "../src/export/pdf-template-styles"
import { buildPrintableHtml } from "../src/export/pdf-exporter"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import { renderSlideBlocksToHtml } from "../src/export/slide-layout-renderer"
import { getSlideRenderingSection } from "../src/export/standalone-runtime-sections/slide-rendering"
import { parseDocumentConfig } from "../src/compiler/scope-mapper"
import { detectSiYuanThemeMode, isLightColor, resolveEffectiveColorSchema } from "../src/utils/color-utils"
import { ISlidesDocument } from "../src/types/slides-protocol"

describe("Theme Design Systems & Contrast Guard (三大主题鲜明特色与亮暗对比度测试)", () => {
  const indexHtmlPath = path.resolve(__dirname, "../public/slides-client/index.html")
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8")

  describe("1. 内置沙箱播放端 (public/slides-client/index.html)", () => {
    it("应包含科技主题 (Tech) 的专属翡翠/青蓝渐变、科技指示条与 WCAG AAA 高对比度", () => {
      expect(indexHtml).toContain('[data-slides-theme="tech"]')
      expect(indexHtml).toContain('.slides-theme-tech')
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
      expect(css).toContain('.slides-theme-tech')
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
      expect(pdfCss).toContain('.pdf-slide-page.slides-theme-tech')
      expect(pdfCss).toContain('.pdf-slide-page.slides-theme-seriph')
      expect(pdfCss).toContain('.pdf-slide-page.slides-theme-apple-basic')
      expect(pdfCss).toContain('color: #059669;')
      expect(pdfCss).toContain('color: #b45309;')
    })

    it("buildPrintableHtml 应对亮色渐变背景（如晨雾渐变）自适应切换为 theme-light", () => {
      const mockDoc: ISlidesDocument = {
        config: {
          theme: "tech",
          aspectRatio: "16/9",
          background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        },
        slides: [
          {
            pageIndex: 0,
            frontmatter: { layout: "cover" },
            blocks: [],
            rawMarkdown: "# 晨雾渐变封面",
          },
          {
            pageIndex: 1,
            frontmatter: {
              layout: "default",
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            },
            blocks: [],
            rawMarkdown: "# 雅蓝渐变内页",
          },
        ],
      }
      const html = buildPrintableHtml(mockDoc, { theme: "dark" })
      expect(html).toContain('pdf-slide-page layout-cover theme-light')
      expect(html).toContain('pdf-slide-page layout-default theme-dark')
    })
  })

  describe("4. CSS 渐变与多格式背景感知亮度 (isLightColor)", () => {
    const MORNING_MIST = "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)"
    const ELEGANT_BLUE = "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
    const AURORA_DARK = "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)"

    it("通用工具函数 isLightColor 应准确识别晨雾渐变等亮色渐变与暗色渐变", () => {
      expect(isLightColor(MORNING_MIST)).toBe(true)
      expect(isLightColor(ELEGANT_BLUE)).toBe(false)
      expect(isLightColor(AURORA_DARK)).toBe(false)
      expect(isLightColor("radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, #e2e8f0 100%)")).toBe(true)
      expect(isLightColor("linear-gradient(to right, white, #f1f5f9)")).toBe(true)
      expect(isLightColor("linear-gradient(to right, rgba(255,255,255,0.9), transparent)")).toBe(true)
      expect(isLightColor("hsl(210, 40%, 96%)")).toBe(true)
      expect(isLightColor("hsl(222, 47%, 11%)")).toBe(false)
      expect(isLightColor("https://example.com/bg.png#ffffff")).toBeNull()
      expect(isLightColor("assets/bg-123.png")).toBeNull()
      expect(isLightColor("")).toBeNull()
    })

    it("沙箱端 (index.html) 与离线导出端 (slide-rendering.ts) 内联 isLightColor 应同步支持晨雾渐变", () => {
      const extractFn = (source: string) => {
        const start = source.indexOf("function isLightColor(colorStr)")
        expect(start).toBeGreaterThan(-1)
        const slice = source.slice(start)
        let depth = 0
        let end = -1
        for (let i = slice.indexOf("{"); i < slice.length; i++) {
          if (slice[i] === "{") depth++
          else if (slice[i] === "}") {
            depth--
            if (depth === 0) {
              end = i + 1
              break
            }
          }
        }
        expect(end).toBeGreaterThan(0)
        const fnBody = slice.slice(0, end)
        // eslint-disable-next-line no-new-func -- 测试需动态求值从沙箱脚本中抽取的 isLightColor
        return new Function(`${fnBody}; return isLightColor;`)() as (c?: string) => boolean | null
      }

      const sandboxIsLight = extractFn(indexHtml)
      expect(sandboxIsLight(MORNING_MIST)).toBe(true)
      expect(sandboxIsLight(ELEGANT_BLUE)).toBe(false)
      expect(sandboxIsLight(AURORA_DARK)).toBe(false)
      expect(sandboxIsLight("assets/cover.png")).toBeNull()

      const exportIsLight = extractFn(getSlideRenderingSection())
      expect(exportIsLight(MORNING_MIST)).toBe(true)
      expect(exportIsLight(ELEGANT_BLUE)).toBe(false)
      expect(exportIsLight(AURORA_DARK)).toBe(false)
      expect(exportIsLight("assets/cover.png")).toBeNull()
    })
  })

  describe("5. 全局演示背景色卡预设与可视化样式 (DocInspectorSection.vue)", () => {
    const docInspectorPath = path.resolve(__dirname, "../src/ui/components/DocInspectorSection.vue")
    const docInspectorSource = fs.readFileSync(docInspectorPath, "utf-8")

    it("应包含 9 个高区分度预设与可视化色卡网格及实时预览输入框", () => {
      expect(docInspectorSource).toContain("spm-bg-swatch-grid")
      expect(docInspectorSource).toContain("spm-bg-swatch-aa")
      expect(docInspectorSource).toContain("spm-bg-input-row")
      expect(docInspectorSource).toContain("spm-bg-input-clear")
      expect(docInspectorSource).toContain("极简白")
      expect(docInspectorSource).toContain("暖羊皮")
      expect(docInspectorSource).toContain("晴空薄荷")
      expect(docInspectorSource).toContain("晨曦微光")
      expect(docInspectorSource).toContain("曜石炭黑")
      expect(docInspectorSource).toContain("松墨深绿")
      expect(docInspectorSource).toContain("极光紫青")
      expect(docInspectorSource).toContain("深空靛蓝")
    })

    it("新预设的 4 个浅色背景与 4 个深色背景均应被 isLightColor 正确识别", () => {
      const lightPresets = [
        "#ffffff",
        "#f5efe6",
        "linear-gradient(135deg, #e0f2fe 0%, #dcfce7 100%)",
        "linear-gradient(135deg, #fef3c7 0%, #fce7f3 100%)",
      ]
      const darkPresets = [
        "#18181b",
        "#0d2621",
        "linear-gradient(135deg, #1e1b4b 0%, #0f3d4c 100%)",
        "linear-gradient(135deg, #172554 0%, #312e81 100%)",
      ]
      for (const bg of lightPresets) {
        expect(isLightColor(bg)).toBe(true)
      }
      for (const bg of darkPresets) {
        expect(isLightColor(bg)).toBe(false)
      }
    })
  })

  describe("6. 默认背景跟随思源笔记亮暗主题自动切换", () => {
    function withMockSiYuanTheme(
      opts: { appearanceMode?: 0 | 1; dataThemeMode?: "light" | "dark" },
      fn: () => void,
    ) {
      const g = globalThis as Record<string, any>
      const hadWindow = "window" in g
      const hadDocument = "document" in g
      const prevWindow = g.window
      const prevDocument = g.document
      try {
        g.window = {
          siyuan: opts.appearanceMode !== undefined
            ? { config: { appearance: { mode: opts.appearanceMode } } }
            : undefined,
        }
        g.document = opts.dataThemeMode
          ? {
              documentElement: {
                getAttribute: (attr: string) => (attr === "data-theme-mode" ? opts.dataThemeMode : null),
                classList: { contains: () => false },
              },
            }
          : {
              documentElement: {
                getAttribute: () => null,
                classList: { contains: () => false },
              },
            }
        fn()
      } finally {
        if (hadWindow) g.window = prevWindow
        else delete g.window
        if (hadDocument) g.document = prevDocument
        else delete g.document
      }
    }

    it("detectSiYuanThemeMode 与 resolveEffectiveColorSchema 应随思源主题联动且支持显式覆盖", () => {
      withMockSiYuanTheme({ appearanceMode: 0 }, () => {
        expect(detectSiYuanThemeMode()).toBe("light")
        expect(resolveEffectiveColorSchema("auto")).toBe("light")
        expect(resolveEffectiveColorSchema(undefined)).toBe("light")
        expect(resolveEffectiveColorSchema("dark")).toBe("dark")
      })

      withMockSiYuanTheme({ appearanceMode: 1 }, () => {
        expect(detectSiYuanThemeMode()).toBe("dark")
        expect(resolveEffectiveColorSchema("auto")).toBe("dark")
        expect(resolveEffectiveColorSchema(undefined)).toBe("dark")
        expect(resolveEffectiveColorSchema("light")).toBe("light")
      })

      withMockSiYuanTheme({ dataThemeMode: "dark" }, () => {
        expect(detectSiYuanThemeMode()).toBe("dark")
        expect(resolveEffectiveColorSchema("auto")).toBe("dark")
      })

      withMockSiYuanTheme({ dataThemeMode: "light" }, () => {
        expect(detectSiYuanThemeMode()).toBe("light")
        expect(resolveEffectiveColorSchema("auto")).toBe("light")
      })
    })

    it("默认背景 (background: '') 在独立导出与 PDF 打印中应按思源亮暗模式解析主题", async () => {
      const dummyDoc: ISlidesDocument = {
        docId: "doc-auto-theme",
        title: "Auto Theme Deck",
        fullMarkdown: "# Title",
        config: {
          theme: "tech",
          aspectRatio: "16/9",
          defaultTransition: "none",
          colorSchema: "auto",
          background: "",
        },
        slides: [
          {
            index: 0,
            slidevIndex: 0,
            blockId: "b1",
            markdown: "# Slide 1",
            frontmatter: {},
            notes: "",
            clicksCount: 0,
            fragments: [],
          },
        ],
      }

      const lightPrintHtml = buildPrintableHtml(dummyDoc)
      expect(lightPrintHtml).toContain('data-theme="light"')

      withMockSiYuanTheme({ appearanceMode: 1 }, () => {
        const darkPrintHtml = buildPrintableHtml(dummyDoc)
        expect(darkPrintHtml).toContain('data-theme="dark"')
      })

      const standaloneLight = await buildStandaloneHtml(dummyDoc, undefined, { theme: "light" })
      expect(standaloneLight).toContain('<div id="app" data-theme="light"')
      expect(standaloneLight).toContain('id="viewport" data-theme="light"')

      let standaloneAutoDark = ""
      await (async () => {
        const g = globalThis as Record<string, any>
        const hadWindow = "window" in g
        const prevWindow = g.window
        try {
          g.window = { siyuan: { config: { appearance: { mode: 1 } } } }
          standaloneAutoDark = await buildStandaloneHtml(dummyDoc)
        } finally {
          if (hadWindow) g.window = prevWindow
          else delete g.window
        }
      })()
      expect(standaloneAutoDark).toContain('<div id="app" data-theme="dark"')
      expect(standaloneAutoDark).toContain('id="viewport" data-theme="dark"')
      expect(standaloneAutoDark).toContain('"hostThemeMode":"dark"')
    })

    it("内置沙箱与演讲者视图应接入宿主亮暗主题联动而非写死暗色", () => {
      expect(indexHtml).toContain("detectHostSiYuanThemeMode")
      expect(indexHtml).toContain("applyConfigThemeMode")
      expect(indexHtml).not.toContain("const isDarkTheme = ref(true)")

      const presenterTabPath = path.resolve(__dirname, "../src/ui/tab/SlidesPresenterTab.vue")
      const presenterTabSource = fs.readFileSync(presenterTabPath, "utf-8")
      expect(presenterTabSource).toContain("resolveEffectiveColorSchema")
      expect(presenterTabSource).toContain("observeSiYuanThemeMode")
    })
  })

  describe("7. 封面 + 背景图 + 默认主题标题防浮雕黑芯与实际文字颜色保留", () => {
    it("沙箱播放端、单文件 HTML 导出与演讲者模式在存在背景图或显式文字色时均应取消透明渐变镂空", () => {
      const standaloneCss = generateStandaloneExportStyles()
      const presenterThumbPath = path.resolve(__dirname, "../src/ui/tab/SlidesPresenterThumbnail.scss")
      const presenterTabSource = fs.readFileSync(path.resolve(__dirname, "../src/ui/tab/SlidesPresenterTab.vue"), "utf-8") + (fs.existsSync(presenterThumbPath) ? fs.readFileSync(presenterThumbPath, "utf-8") : "")

      // 沙箱播放端：背景图与显式文字色保护
      expect(indexHtml).toContain('.slide-viewport[style*="background-image"] .layout-cover h1')
      expect(indexHtml).toContain('.slides-theme-tech .layout-cover .slide-block[style^="color:"] h1')
      expect(indexHtml).toContain('.layout-cover h1 span[style^="color:"]')
      expect(indexHtml).toContain('-webkit-text-fill-color: initial !important;')
      expect(indexHtml).toContain('-webkit-text-fill-color: currentColor !important;')

      // 独立 HTML 导出端：背景图（含总览卡片）与显式文字色保护
      expect(standaloneCss).toContain('.slide-viewport[style*="background-image"] .layout-cover h1')
      expect(standaloneCss).toContain('.slides-overview-canvas[style*="background-image"].layout-cover h1')
      expect(standaloneCss).toContain('.slides-theme-tech .layout-cover .slide-block[style^="color:"] h1')
      expect(standaloneCss).toContain('-webkit-text-fill-color: initial !important;')
      expect(standaloneCss).toContain('-webkit-text-fill-color: currentColor !important;')

      // 演讲者模式：缩略图背景图与显式文字色保护
      expect(presenterTabSource).toContain('&.slides-theme-tech .slide-content[style*="background-image"].layout-cover h1')
      expect(presenterTabSource).toContain('&.slides-theme-tech .layout-cover .slide-block[style^="color:"] h1')
      expect(presenterTabSource).toContain('-webkit-text-fill-color: initial !important;')
      expect(presenterTabSource).toContain('-webkit-text-fill-color: currentColor !important;')
    })
  })

  describe("8. 幻灯片主题可视化预览小卡片 (DocInspectorSection.vue & index.scss)", () => {
    it("DocInspectorSection 与全局样式应为三大主题提供 3 列可视化预览小卡片与激活角标", () => {
      const docInspectorSource = fs.readFileSync(path.resolve(__dirname, "../src/ui/components/DocInspectorSection.vue"), "utf-8")
      const scssSource = fs.readFileSync(path.resolve(__dirname, "../src/index.scss"), "utf-8")

      expect(docInspectorSource).toContain("spm-theme-card-grid")
      expect(docInspectorSource).toContain("spm-theme-card-preview")
      expect(docInspectorSource).toContain("theme-preview--")
      expect(docInspectorSource).toContain("spm-theme-card-label")
      expect(docInspectorSource).toContain("极简 apple")
      expect(docInspectorSource).toContain("科技 tech")
      expect(docInspectorSource).toContain("优雅 seriph")

      const appleIdx = docInspectorSource.indexOf("value: 'apple-basic'")
      const techIdx = docInspectorSource.indexOf("value: 'tech'")
      const seriphIdx = docInspectorSource.indexOf("value: 'seriph'")
      expect(appleIdx).toBeGreaterThan(-1)
      expect(techIdx).toBeGreaterThan(appleIdx)
      expect(seriphIdx).toBeGreaterThan(techIdx)
      expect(parseDocumentConfig(null).theme).toBe("apple-basic")

      expect(scssSource).toContain(".spm-theme-card-grid")
      expect(scssSource).toContain(".spm-theme-card-preview")
      expect(scssSource).toContain("&.theme-preview--tech")
      expect(scssSource).toContain("&.theme-preview--seriph")
      expect(scssSource).toContain("&.theme-preview--apple-basic")
      expect(scssSource).toContain("rgba(16, 185, 129, 0.22)")
    })

    it("内容页顶部标题在四大渲染端均按三套主题差异化呈现，仅每页首个主标题独享主题强调色与标记样式，后续与分栏标题仅应用字体", () => {
      const indexHtml = fs.readFileSync(path.resolve(__dirname, "../public/slides-client/index.html"), "utf-8")
      const standaloneCss = generateStandaloneExportStyles()
      const presenterThumbPath = path.resolve(__dirname, "../src/ui/tab/SlidesPresenterThumbnail.scss")
      const presenterSource = fs.readFileSync(path.resolve(__dirname, "../src/ui/tab/SlidesPresenterTab.vue"), "utf-8") + (fs.existsSync(presenterThumbPath) ? fs.readFileSync(presenterThumbPath, "utf-8") : "")
      const pdfCss = generatePdfExportStyles()

      // 1. Live Web Sandbox (index.html)
      expect(indexHtml).toContain(".slide-content-wrapper:not(.layout-cover)")
      expect(indexHtml).toContain("slides-page-first-heading-block")
      expect(indexHtml).toContain("two-cols-left")
      expect(indexHtml).toContain("image-left-content")
      expect(indexHtml).toContain("image-right-content")
      expect(indexHtml).toContain("intro-info-col")
      expect(indexHtml).toContain(".image-left-content > .slide-block:first-child")
      expect(indexHtml).toContain(".image-right-content > .slide-block:first-child")
      expect(indexHtml).toContain(".intro-info-col > .slide-block:first-child")
      expect(indexHtml).toContain("slides-mask-body-container")
      expect(indexHtml).toContain("font-weight: 800 !important;")
      expect(indexHtml).not.toContain("width: 44px;")
      expect(indexHtml).toContain("color: inherit !important;")
      // 验证分栏子标题与后续标题不再享有首标题标记与强调色
      expect(indexHtml).not.toContain(".two-cols-left > .slide-block:first-child :is(h1, h2, h3)")

      // 2. Standalone Single-HTML Export
      expect(standaloneCss).toContain(".slides-theme-tech .slide-content:not(.layout-cover)")
      expect(standaloneCss).toContain(".slides-theme-seriph .slide-content:not(.layout-cover)")
      expect(standaloneCss).toContain(".slides-theme-apple-basic .slide-content:not(.layout-cover)")
      expect(standaloneCss).toContain("slides-page-first-heading-block")
      expect(standaloneCss).not.toContain("width: 44px;")
      expect(standaloneCss).not.toContain(".pdf-col--left > .slide-block:first-child h3")
      expect(standaloneCss).toContain(".image-left-content > .slide-block:first-child")
      expect(standaloneCss).toContain(".image-right-content > .slide-block:first-child")
      expect(standaloneCss).toContain(".slide-viewport[style*=\"background-image\"] .slide-content:not(.layout-cover)")
      expect(standaloneCss).toContain(".slide-viewport .slide-block[style^=\"color:\"] h1")
      expect(standaloneCss).toContain("color: inherit !important;")

      // 3. Presenter Tab Thumbnail Preview
      expect(presenterSource).toContain("&.slides-theme-tech .slide-content:not(.layout-cover)")
      expect(presenterSource).toContain("&.slides-theme-seriph .slide-content:not(.layout-cover)")
      expect(presenterSource).toContain("&.slides-theme-apple-basic .slide-content:not(.layout-cover)")
      expect(presenterSource).toContain("slides-page-first-heading-block")
      expect(presenterSource).not.toContain("width: 44px;")
      expect(presenterSource).not.toContain(".two-cols-left > .slide-block:first-child h1")
      expect(presenterSource).toContain(".image-left-content > .slide-block:first-child")
      expect(presenterSource).toContain(".slide-content[style*=\"background-image\"]:not(.layout-cover)")
      expect(presenterSource).toContain(".slide-block[style^=\"color:\"] h1")

      // 4. PDF Print Export
      expect(pdfCss).toContain(".slides-theme-tech:not(.layout-cover)")
      expect(pdfCss).toContain(".slides-theme-seriph:not(.layout-cover)")
      expect(pdfCss).toContain(".slides-theme-apple-basic:not(.layout-cover)")
      expect(pdfCss).toContain("slides-page-first-heading-block")
      expect(pdfCss).not.toContain("width: 44px;")
      expect(pdfCss).not.toContain(".two-cols-left > .pdf-block:first-child h1")
      expect(pdfCss).toContain(".image-left-content > .pdf-block:first-child")
      expect(pdfCss).toContain("color: #059669;")
      expect(pdfCss).toContain("color: #b45309;")
      expect(pdfCss).toContain(".pdf-slide-page[style*=\"background-image\"]:not(.layout-cover)")
      expect(pdfCss).toContain(".pdf-slide-page .pdf-block[style^=\"color:\"] h1")
    })

    it("图左、图右、介绍、居中、大字报等全版式首标题均享有主题样式，仅排除封面 cover", () => {
      const indexHtml = fs.readFileSync(path.resolve(__dirname, "../public/slides-client/index.html"), "utf-8")
      const standaloneCss = generateStandaloneExportStyles()
      const presenterThumbPath = path.resolve(__dirname, "../src/ui/tab/SlidesPresenterThumbnail.scss")
      const presenterSource = fs.readFileSync(path.resolve(__dirname, "../src/ui/tab/SlidesPresenterTab.vue"), "utf-8") + (fs.existsSync(presenterThumbPath) ? fs.readFileSync(presenterThumbPath, "utf-8") : "")
      const pdfCss = generatePdfExportStyles()

      // 1. 确认四大渲染端首标题规则已全面移除 :not(.layout-center):not(.layout-fact)，对居中与大字报生效
      expect(indexHtml).not.toContain(":not(.layout-center)")
      expect(indexHtml).not.toContain(":not(.layout-fact)")
      expect(standaloneCss).not.toContain(":not(.layout-center)")
      expect(standaloneCss).not.toContain(":not(.layout-fact)")
      expect(presenterSource).not.toContain(":not(.layout-center)")
      expect(presenterSource).not.toContain(":not(.layout-fact)")
      expect(pdfCss).not.toContain(":not(.layout-center)")
      expect(pdfCss).not.toContain(":not(.layout-fact)")

      // 2. 确认图左、图右、介绍首标题选择器在四大端均明确注册
      expect(indexHtml).toContain(".image-left-content > .slide-block:first-child")
      expect(indexHtml).toContain(".image-right-content > .slide-block:first-child")
      expect(indexHtml).toContain(".intro-info-col > .slide-block:first-child")

      expect(standaloneCss).toContain(".image-left-content > .slide-block:first-child")
      expect(standaloneCss).toContain(".image-right-content > .slide-block:first-child")
      expect(standaloneCss).toContain(".intro-info-col > .slide-block:first-child")

      expect(presenterSource).toContain(".image-left-content > .slide-block:first-child")
      expect(presenterSource).toContain(".image-right-content > .slide-block:first-child")
      expect(presenterSource).toContain(".intro-info-col > .slide-block:first-child")

      expect(pdfCss).toContain(".image-left-content > .pdf-block:first-child")
      expect(pdfCss).toContain(".image-right-content > .pdf-block:first-child")
      expect(pdfCss).toContain(".intro-info-col > .pdf-block:first-child")

      // 3. 验证独立导出渲染器对各版式首块打标 slides-page-first-heading-block
      const dummySlide = (layout: string): any => ({
        pageIndex: 1,
        frontmatter: { layout },
        blocks: [
          { id: "b1", type: "h", content: "版式主标题", rawMarkdown: "# 版式主标题" },
          { id: "b2", type: "p", content: "99%", rawMarkdown: "99%" },
          { id: "b3", type: "p", content: "指标说明", rawMarkdown: "指标说明" },
        ],
      })

      const htmlImgLeft = renderSlideBlocksToHtml(dummySlide("image-left"))
      expect(htmlImgLeft).toContain("slides-page-first-heading-block")

      const htmlImgRight = renderSlideBlocksToHtml(dummySlide("image-right"))
      expect(htmlImgRight).toContain("slides-page-first-heading-block")

      const htmlIntro = renderSlideBlocksToHtml(dummySlide("intro"))
      expect(htmlIntro).toContain("slides-page-first-heading-block")

      const htmlCenter = renderSlideBlocksToHtml(dummySlide("center"))
      expect(htmlCenter).toContain("slides-page-first-heading-block")

      const htmlFact = renderSlideBlocksToHtml(dummySlide("fact"))
      expect(htmlFact).toContain("slides-page-first-heading-block")
    })

    it("H4~H6 作为每页首个页面标题时在四大渲染端均生效三大主题可视化效果，后续内容标题与分栏子标题保持隔离", () => {
      const indexHtml = fs.readFileSync(path.resolve(__dirname, "../public/slides-client/index.html"), "utf-8")
      const standaloneCss = generateStandaloneExportStyles()
      const presenterThumbPath = path.resolve(__dirname, "../src/ui/tab/SlidesPresenterThumbnail.scss")
      const presenterSource = fs.readFileSync(path.resolve(__dirname, "../src/ui/tab/SlidesPresenterTab.vue"), "utf-8") + (fs.existsSync(presenterThumbPath) ? fs.readFileSync(presenterThumbPath, "utf-8") : "")
      const pdfCss = generatePdfExportStyles()

      // 1. Live Web Sandbox (index.html)：三大主题首标题、重置规则、背景保护、自定义字色及非首块标题标记
      expect(indexHtml).toContain(".slides-theme-tech .slide-content-wrapper:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(indexHtml).toContain(".slides-theme-seriph .slide-content-wrapper:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(indexHtml).toContain(".slides-theme-seriph .slide-content-wrapper:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)::after")
      expect(indexHtml).toContain(".slides-theme-apple-basic .slide-content-wrapper:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(indexHtml).toContain(".slide-block:not(:first-child):not(.slides-page-first-heading-block) :is(h1, h2, h3, h4, h5, h6)")
      expect(indexHtml).toContain(".slide-block[style^=\"color:\"] :is(h1, h2, h3, h4, h5, h6)")
      expect(indexHtml).toContain("getPageFirstThemeHeadingClass")

      // 2. Standalone Single-HTML Export
      expect(standaloneCss).toContain(".slides-theme-tech .slide-content:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(standaloneCss).toContain(".slides-theme-seriph .slide-content:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(standaloneCss).toContain(".slides-theme-seriph .slide-content:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)::after")
      expect(standaloneCss).toContain(".slides-theme-apple-basic .slide-content:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(standaloneCss).toContain(".slide-block:not(:first-child):not(.slides-page-first-heading-block) :is(h1, h2, h3, h4, h5, h6)")
      expect(standaloneCss).toContain(".slide-viewport .slide-block[style^=\"color:\"] h4")
      expect(standaloneCss).toContain(".slide-viewport .slide-block[style^=\"color:\"] h6")

      // 3. Presenter Tab Thumbnail Preview
      expect(presenterSource).toContain("&.slides-theme-tech .slide-content:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(presenterSource).toContain("&.slides-theme-seriph .slide-content:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(presenterSource).toContain("&.slides-theme-seriph .slide-content:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)::after")
      expect(presenterSource).toContain("&.slides-theme-apple-basic .slide-content:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(presenterSource).toContain(".slide-block:not(:first-child):not(.slides-page-first-heading-block) :is(h1, h2, h3, h4, h5, h6)")
      expect(presenterSource).toContain(".slide-block[style^=\"color:\"] h4")
      expect(presenterSource).toContain(".slide-block[style^=\"color:\"] h6")

      // 4. PDF Print Export
      expect(pdfCss).toContain(".slides-theme-tech:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(pdfCss).toContain(".slides-theme-seriph:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(pdfCss).toContain(".slides-theme-seriph:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)::after")
      expect(pdfCss).toContain(".slides-theme-apple-basic:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6)")
      expect(pdfCss).toContain(".pdf-block:not(.slides-page-first-heading-block) :is(h1, h2, h3, h4, h5, h6)")
      expect(pdfCss).toContain(".pdf-slide-page .pdf-block[style^=\"color:\"] h4")
      expect(pdfCss).toContain(".pdf-slide-page .pdf-block[style^=\"color:\"] h6")

      // 5. 渲染器针对 H4~H6 页面标题（含前置非标题块场景）及后续内容标题的打标隔离
      const slideWithH5FirstAndH4Second: any = {
        pageIndex: 2,
        frontmatter: { layout: "default" },
        blocks: [
          { id: "p0", type: "p", content: "引导段落", rawMarkdown: "引导段落" },
          { id: "h5", type: "h", subType: "h5", content: "五级页面主标题", rawMarkdown: "##### 五级页面主标题" },
          { id: "h4", type: "h", subType: "h4", content: "后续四级内容标题", rawMarkdown: "#### 后续四级内容标题" },
        ],
      }
      const renderedDefault = renderSlideBlocksToHtml(slideWithH5FirstAndH4Second)
      expect(renderedDefault).toMatch(/class="[^"]*slides-page-first-heading-block[^"]*"[^>]*><h5/)
      expect(renderedDefault).not.toMatch(/class="[^"]*slides-page-first-heading-block[^"]*"[^>]*><h4/)

      const renderedImgRight = renderSlideBlocksToHtml({
        ...slideWithH5FirstAndH4Second,
        frontmatter: { layout: "image-right", image: "assets/cover.png" },
      })
      expect(renderedImgRight).toMatch(/class="[^"]*slides-page-first-heading-block[^"]*"[^>]*><h5/)
      expect(renderedImgRight).not.toMatch(/class="[^"]*slides-page-first-heading-block[^"]*"[^>]*><h4/)

      const renderedCover = renderSlideBlocksToHtml({
        ...slideWithH5FirstAndH4Second,
        frontmatter: { layout: "cover" },
      })
      expect(renderedCover).not.toContain("slides-page-first-heading-block")
    })
  })
})
