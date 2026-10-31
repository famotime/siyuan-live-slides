import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import { getStandaloneClientRuntimeScript } from "../src/export/standalone-client-runtime"
import type { ISlidesDocument } from "../src/types/slides-protocol"

/**
 * 「数字+回车」跳页功能三处播放面的内容断言：
 * 宿主页签补位监听 / 内置沙箱播放器 / standalone 单文件导出播放器
 */
describe("Page Jump Navigation (放映中数字+回车跳页)", () => {
  const indexHtmlPath = path.resolve(__dirname, "../public/slides-client/index.html")
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8")
  const previewTabPath = path.resolve(__dirname, "../src/ui/tab/SlidesPreviewTab.vue")
  const previewTabVue = fs.readFileSync(previewTabPath, "utf-8")
  const runtimeScript = getStandaloneClientRuntimeScript()

  const dummyDoc: ISlidesDocument = {
    docId: "doc-jump-test",
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
        frontmatter: { layout: "default" },
        notes: "",
        blocks: [],
        rawMarkdown: "# Slide 2",
      },
    ],
    fullMarkdown: "# Slide 1\n---\n# Slide 2",
  }

  describe("1. 内置沙箱播放器 (public/slides-client/index.html)", () => {
    it("应包含右下角跳页角标元素与样式（含越界红色抖动态）", () => {
      expect(indexHtml).toContain('<div class="jump-page-indicator" v-show="jumpDisplay"')
      expect(indexHtml).toMatch(/\.jump-page-indicator\s*\{/)
      expect(indexHtml).toMatch(/\.jump-page-indicator\.is-invalid\s*\{/)
      expect(indexHtml).toContain("@keyframes jump-indicator-shake")
      // 角标不可交互，避免遮挡幻灯片点击
      expect(indexHtml).toMatch(/\.jump-page-indicator\s*\{[^}]*pointer-events:\s*none;/s)
    })

    it("keydown 应处理数字缓冲、回车跳转、Esc 清空，且复用 nav.go 落到初始 click 状态", () => {
      expect(indexHtml).toContain('if (/^[0-9]$/.test(e.key)) {')
      expect(indexHtml).toContain('if (e.key === "Enter" && jumpDisplay.value) {')
      expect(indexHtml).toContain("slidesContext.nav.go(page)")
      expect(indexHtml).toContain('if (e.key === "Escape" && (jumpDisplay.value || jumpInvalid.value)) {')
      // 空闲清空与越界抖动提示时长
      expect(indexHtml).toContain("const JUMP_IDLE_CLEAR_MS = 1500")
      expect(indexHtml).toContain("const JUMP_INVALID_FLASH_MS = 500")
    })

    it("跳页分支应位于灯箱与键盘冻结守卫之后，冻结时一并禁用", () => {
      const lightboxGuard = indexHtml.indexOf("if (activeLightbox.value) {")
      const frozenGuard = indexHtml.indexOf("if (isKeyboardFrozen.value) {")
      const jumpBlock = indexHtml.indexOf("// 「数字+回车」跳页：可输入元素、修饰键、IME 组合输入中不拦截")
      expect(lightboxGuard).toBeGreaterThanOrEqual(0)
      expect(frozenGuard).toBeGreaterThan(lightboxGuard)
      expect(jumpBlock).toBeGreaterThan(frozenGuard)
    })

    it("可输入元素守卫与角标状态应暴露给模板渲染", () => {
      expect(indexHtml).toContain("function isEditableKeyTarget(e)")
      expect(indexHtml).toMatch(/return\s*\{[\s\S]*?jumpDisplay,\s*\n\s*jumpInvalid,/)
    })
  })

  describe("2. 宿主页签补位监听 (SlidesPreviewTab.vue)", () => {
    it("页签根容器应挂接 keydown 补位监听并接入跳页状态机", () => {
      expect(previewTabVue).toContain('@keydown="onTabKeydown"')
      expect(previewTabVue).toContain("createPageJumpInput({")
      // 速览抽屉打开（键盘冻结）期间不拦截
      expect(previewTabVue).toContain("isEnabled: () => !isDrawerOpen.value")
      // 消费成功才 preventDefault，避免回车误触聚焦按钮
      expect(previewTabVue).toMatch(/if \(pageJumpInput\.handleKeydown\(e\)\)\s*\{\s*e\.preventDefault\(\)/)
    })

    it("跳页应按引擎模式分流，并把焦点交还 iframe", () => {
      expect(previewTabVue).toMatch(/function jumpToPage\(page: number\)[\s\S]*?engineManager\.nativeBridge\.navigateToPage\(page\)[\s\S]*?sandboxBridge\.navigatePage\(page\)/)
      expect(previewTabVue).toContain("sandboxIframeRef.value?.focus()")
    })

    it("应包含宿主侧跳页角标浮层与卸载清理", () => {
      expect(previewTabVue).toMatch(/v-show="jumpDisplay"[\s\S]*?:class="\{ 'is-invalid': jumpInvalid \}"/)
      expect(previewTabVue).toContain(".spm-jump-badge")
      expect(previewTabVue).toContain("@keyframes spm-jump-shake")
      expect(previewTabVue).toContain("pageJumpInput.clear()")
    })
  })

  describe("3. standalone 单文件导出播放器", () => {
    it("运行时脚本应包含数字缓冲、回车跳页与角标逻辑", () => {
      expect(runtimeScript).toContain("const jumpBadge = document.createElement(\"div\")")
      expect(runtimeScript).toContain(".jump-page-indicator{position:fixed")
      expect(runtimeScript).toContain('if (/^[0-9]$/.test(e.key)) {')
      expect(runtimeScript).toContain('if (e.key === "Enter" && jumpDisplay) {')
      expect(runtimeScript).toContain("renderSlide(page - 1)")
      expect(runtimeScript).toContain("setTimeout(hideJumpIndicator, 1500)")
      expect(runtimeScript).toContain("setTimeout(hideJumpIndicator, 500)")
      expect(runtimeScript).toContain("function isEditableKeyTarget(t)")
    })

    it("导出的单文件 HTML 应内嵌相同的跳页运行时", () => {
      const exportedHtml = buildStandaloneHtml(dummyDoc)
      expect(exportedHtml).toContain("jump-page-indicator")
      expect(exportedHtml).toContain("renderSlide(page - 1)")
      expect(exportedHtml).toContain("setTimeout(hideJumpIndicator, 1500)")
    })
  })
})
