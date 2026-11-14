import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import { getStandaloneClientRuntimeScript } from "../src/export/standalone-client-runtime"
import type { ISlidesDocument } from "../src/types/slides-protocol"

/**
 * 缩略图总览（o 键呼出，方向键/数字+回车/点选跳页）三处播放面的内容断言：
 * 内置沙箱播放器 / 宿主页签入口 / standalone 单文件导出播放器
 */
describe("Overview Grid (缩略图总览)", () => {
  const indexHtmlPath = path.resolve(__dirname, "../public/slides-client/index.html")
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8")
  const previewTabPath = path.resolve(__dirname, "../src/ui/tab/SlidesPreviewTab.vue")
  const previewTabVue = fs.readFileSync(previewTabPath, "utf-8")
  const bridgePath = path.resolve(__dirname, "../src/engine/web-sandbox-bridge.ts")
  const bridgeTs = fs.readFileSync(bridgePath, "utf-8")
  const runtimeScript = getStandaloneClientRuntimeScript()

  const dummyDoc: ISlidesDocument = {
    docId: "doc-overview-test",
    config: {
      theme: "default",
      aspectRatio: "16/9",
      defaultTransition: "fade",
      colorSchema: "dark",
    },
    slides: [
      {
        pageIndex: 1,
        startBlockId: "slide-1",
        frontmatter: { layout: "default" },
        notes: "",
        blocks: [],
        rawMarkdown: "# Slide 1",
      },
      {
        pageIndex: 2,
        startBlockId: "slide-2",
        frontmatter: { layout: "two-cols" },
        notes: "",
        blocks: [],
        rawMarkdown: "# Slide 2",
      },
    ],
  }

  describe("1. 布局分组参数化（主渲染路径与缩略图共用）", () => {
    it("布局分组 computed 应收敛为参数化 buildLayoutGroups(slide)", () => {
      expect(indexHtml).toContain("function buildLayoutGroups(slide)")
      expect(indexHtml).toContain("const layoutGroups = computed(() => buildLayoutGroups(currentSlide.value))")
      expect(indexHtml).toContain("const normalBlocks = computed(() => layoutGroups.value.normal)")
      expect(indexHtml).toContain("const headerBlocks = computed(() => layoutGroups.value.header)")
      expect(indexHtml).toContain("const dynamicColsCount = computed(() => layoutGroups.value.colsCount)")
      expect(indexHtml).toContain("const isSuperBlockColsHeader = computed(() => layoutGroups.value.isSuperCols)")
      expect(indexHtml).toContain("const multiColBlocks = computed(() => layoutGroups.value.multiCol)")
    })
  })

  describe("2. 内置沙箱播放器总览层", () => {
    it("应包含总览层 DOM（网格/卡片/页码/提示）与主题上下文属性", () => {
      expect(indexHtml).toContain('v-show="showOverview"')
      expect(indexHtml).toContain('class="slides-overview"')
      expect(indexHtml).toContain(':data-slides-theme="currentSlidesTheme"')
      expect(indexHtml).toContain('class="slides-overview-grid"')
      expect(indexHtml).toContain('class="slides-overview-canvas"')
      expect(indexHtml).toContain('class="slides-overview-caption"')
      expect(indexHtml).toContain("@click.self=\"closeOverview\"")
      // 点击卡片跳转并关闭
      expect(indexHtml).toContain('@click.stop="goFromOverview(idx + 1)"')
    })

    it("缩略图应镜像主渲染版式结构（表头/分栏/图文/常规）并按基准尺寸缩放", () => {
      expect(indexHtml).toContain("function buildOverviewThumbHtml(slide)")
      expect(indexHtml).toMatch(/buildOverviewThumbHtml[\s\S]*?layout-cols-grid[\s\S]*?two-cols-left[\s\S]*?image-right-img-container/)
      expect(indexHtml).toContain('class="two-cols-header-top three-cols-header-top cols-header-top layout-header-section"')
      expect(indexHtml).toContain("getLayoutGridStyle(slide, g.colsCount)")
      // 基准尺寸 980 缩放为卡片宽度
      expect(indexHtml).toContain("const OVERVIEW_CARD_W = 236")
      expect(indexHtml).toContain("const overviewScale = computed(() => OVERVIEW_CARD_W / baseWidth)")
    })

    it("应使用 IntersectionObserver 懒渲染并缓存，slides 更新时失效重建", () => {
      expect(indexHtml).toContain("function ensureOverviewObserver()")
      expect(indexHtml).toContain("new IntersectionObserver(")
      expect(indexHtml).toContain('rootMargin: "240px"')
      expect(indexHtml).toContain("function renderOverviewThumb(cardEl)")
      expect(indexHtml).toContain("function resetOverviewThumbs()")
      expect(indexHtml).toMatch(/watch\(slides, \(\) => \{\s*resetOverviewThumbs\(\)\s*\}\)/)
    })

    it("o 键应可呼出与关闭总览，关闭态与打开态均受输入守卫", () => {
      // 关闭态：onKeyDown 守卫块内的 o 分支
      expect(indexHtml).toMatch(/if \(e\.key === "o" \|\| e\.key === "O"\) \{\s*e\.preventDefault\(\)\s*toggleOverview\(\)\s*return\s*\}/)
      // 打开态：总览层接管全部按键
      expect(indexHtml).toContain("if (showOverview.value) {")
      expect(indexHtml).toContain("function handleOverviewKeyDown(e)")
      expect(indexHtml).toMatch(/handleOverviewKeyDown[\s\S]*?e\.key === "Escape" \|\| e\.key === "o" \|\| e\.key === "O"/)
    })

    it("总览内应支持方向键移动高亮、数字缓冲高亮与 Enter 确认跳转", () => {
      expect(indexHtml).toMatch(/handleOverviewKeyDown[\s\S]*?setOverviewFocus\(overviewFocus\.value \+ getOverviewCols\(\)\)/)
      expect(indexHtml).toMatch(/handleOverviewKeyDown[\s\S]*?setOverviewFocus\(p\)/)
      expect(indexHtml).toMatch(/handleOverviewKeyDown[\s\S]*?goFromOverview\(page\)/)
      // 跳转落初始 click 状态：复用 nav.go（内部重置 currentStep）
      expect(indexHtml).toMatch(/function goFromOverview\(page\) \{[\s\S]*?slidesContext\.nav\.go\(p\)/)
    })

    it("总览打开时滚轮与翻页应被冻结，交给总览列表原生滚动", () => {
      expect(indexHtml).toMatch(/function onWheel\(e\) \{[\s\S]*?if \(showOverview\.value\) return/)
      // 总览内空格/PGUP/PGDN 仅阻止默认不再翻页
      expect(indexHtml).toMatch(/handleOverviewKeyDown[\s\S]*?if \(e\.key === " "\) \{\s*e\.preventDefault\(\)\s*return\s*\}/)
    })

    it("应处理宿主 TOGGLE_OVERVIEW 消息", () => {
      expect(indexHtml).toMatch(/case "TOGGLE_OVERVIEW":\s*toggleOverview\(\)\s*break/)
    })
  })

  describe("3. 宿主页签入口", () => {
    it("工具栏应有总览按钮并经 bridge 转发，且采用 4 个小方格的 layout-grid 图标", () => {
      const currentTabVue = fs.readFileSync(previewTabPath, "utf-8")
      expect(currentTabVue).toContain('aria-label="缩略图总览 (O)"')
      expect(currentTabVue).toContain('@click="onToggleOverview"')
      expect(currentTabVue).toMatch(/aria-label="缩略图总览 \(O\)"[\s\S]*?<SlidesIcon name="layout-grid" \/>/)
      expect(bridgeTs).toMatch(/public toggleOverview\(\): void \{\s*this\.postMessage\("TOGGLE_OVERVIEW", \{\}\)\s*\}/)
    })

    it("工具栏全屏放映按钮应采用 is-primary 强调高亮样式与全屏放映标签", () => {
      const currentTabVue = fs.readFileSync(previewTabPath, "utf-8")
      expect(currentTabVue).toMatch(/class="spm-icon-btn is-primary spm-btn-fullscreen[\s\S]*?aria-label="全屏放映"/)
      expect(currentTabVue).toContain('class="spm-btn-fullscreen__label">全屏放映</span>')
    })

    it("宿主 o 键应转发总览并移交焦点", () => {
      expect(previewTabVue).toMatch(/if \(e\.key === 'o' \|\| e\.key === 'O'\) \{[\s\S]*?onToggleOverview\(\)/)
      expect(previewTabVue).toMatch(/function onToggleOverview\(\) \{[\s\S]*?sandboxBridge\.toggleOverview\(\)[\s\S]*?sandboxIframeRef\.value\?\.focus\(\)/)
    })
  })

  describe("4. standalone 单文件导出播放器", () => {
    it("运行时脚本应包含总览层、懒渲染与同套交互", () => {
      expect(runtimeScript).toContain('className = "slides-overview"')
      expect(runtimeScript).toContain("function buildOverviewThumbInto(canvas, slide)")
      expect(runtimeScript).toContain("new IntersectionObserver(")
      expect(runtimeScript).toContain("function handleOverviewKeyDown(e)")
      expect(runtimeScript).toMatch(/function goFromOverview\(page\) \{[\s\S]*?renderSlide\(p - 1\)/)
      // 打开态接管滚轮与空白点击
      expect(runtimeScript).toMatch(/window\.addEventListener\("wheel"[\s\S]*?if \(overviewOpen\) return/)
      expect(runtimeScript).toMatch(/document\.addEventListener\("click"[\s\S]*?if \(overviewOpen\) return/)
    })

    it("导出的单文件 HTML 应内嵌总览运行时", () => {
      const exportedHtml = buildStandaloneHtml(dummyDoc)
      expect(exportedHtml).toContain("slides-overview")
      expect(exportedHtml).toContain("buildOverviewThumbInto")
      expect(exportedHtml).toContain("renderSlide(p - 1)")
    })
  })
})
