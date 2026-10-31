import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { getLightboxSection } from "../src/export/standalone-runtime-sections/lightbox"
import { getKeyboardScrollInitSection } from "../src/export/standalone-runtime-sections/keyboard-scroll-init"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import type { ISlidesDocument } from "../src/types/slides-protocol"

describe("Lightbox Image Wheel Zoom & Pan (放映灯箱图片滚轮缩放与平移)", () => {
  const indexHtmlPath = path.resolve(__dirname, "../public/slides-client/index.html")
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8")
  const lightboxSection = getLightboxSection()
  const keyboardScrollSection = getKeyboardScrollInitSection()
  const standaloneStyles = generateStandaloneExportStyles()

  describe("1. 内置沙箱播放端 (public/slides-client/index.html)", () => {
    it("应定义灯箱缩放与平移的核心响应式状态与重置逻辑", () => {
      expect(indexHtml).toContain("const lightboxScale = ref(1.0)")
      expect(indexHtml).toContain("const lightboxTranslateX = ref(0)")
      expect(indexHtml).toContain("const lightboxTranslateY = ref(0)")
      expect(indexHtml).toContain("const isLightboxDragging = ref(false)")
      expect(indexHtml).toContain("function resetLightboxZoom()")
    })

    it("图片元素应绑定指针拖拽、双击重置与计算样式属性", () => {
      expect(indexHtml).toContain(":style=\"lightboxImgStyle\"")
      expect(indexHtml).toContain("@pointerdown=\"onLightboxPointerDown\"")
      expect(indexHtml).toContain("@pointermove=\"onLightboxPointerMove\"")
      expect(indexHtml).toContain("@pointerup=\"onLightboxPointerUp\"")
      expect(indexHtml).toContain("@dblclick.stop=\"onLightboxDblClick\"")
      expect(indexHtml).toContain("@click.stop=\"onLightboxImgClick\"")
    })

    it("滚轮事件应拦截仅对图片 (img) 执行滚轮缩放 handleLightboxWheel", () => {
      expect(indexHtml).toContain("if (activeLightbox.value.type === 'img') {")
      expect(indexHtml).toContain("handleLightboxWheel(e)")
    })

    it("缩放范围应严格限制在 [1.0, 5.0]，触底 1.0 时平移自动回正", () => {
      expect(indexHtml).toContain("if (nextScale <= 1.02) {")
      expect(indexHtml).toContain("resetLightboxZoom()")
      expect(indexHtml).toContain("if (nextScale > 5.0) {")
      expect(indexHtml).toContain("nextScale = 5.0")
    })

    it("样式应设置 user-select: none 与 touch-action: none，防止原生拖拽幽灵图干扰", () => {
      expect(indexHtml).toMatch(/\.slides-lightbox-img\s*\{[^}]*user-select:\s*none;/)
      expect(indexHtml).toMatch(/\.slides-lightbox-img\s*\{[^}]*touch-action:\s*none;/)
    })

    it("拖拽后松开应有防误触保护，不误触发背景关闭灯箱", () => {
      expect(indexHtml).toContain("function onLightboxBackdropClick(e)")
      expect(indexHtml).toContain("if (lightboxHasMoved) {")
    })
  })

  describe("2. 单文件导出播放端 (src/export/standalone-runtime-sections)", () => {
    it("getLightboxSection 应包含平移与滚轮缩放核心状态函数", () => {
      expect(lightboxSection).toContain("let lightboxScale = 1.0;")
      expect(lightboxSection).toContain("let lightboxTranslateX = 0;")
      expect(lightboxSection).toContain("let lightboxTranslateY = 0;")
      expect(lightboxSection).toContain("function handleLightboxWheel(e)")
      expect(lightboxSection).toContain("function updateLightboxImgTransform(animate)")
      expect(lightboxSection).toContain("function resetLightboxZoom()")
    })

    it("getKeyboardScrollInitSection 应正确分发灯箱滚轮事件与防误触点击保护", () => {
      expect(keyboardScrollSection).toContain("if (isLightboxOpen) {")
      expect(keyboardScrollSection).toContain("if (typeof handleLightboxWheel === \"function\") {")
      expect(keyboardScrollSection).toContain("handleLightboxWheel(e);")
      expect(keyboardScrollSection).toContain("if (typeof lightboxHasMoved !== \"undefined\" && lightboxHasMoved) {")
    })

    it("单文件导出样式应包含灯箱图片手势防护与阴影圆角声明", () => {
      expect(standaloneStyles).toMatch(/\.slides-lightbox-img\s*\{[^}]*user-select:\s*none;/)
      expect(standaloneStyles).toMatch(/\.slides-lightbox-img\s*\{[^}]*touch-action:\s*none;/)
    })

    it("完整 buildStandaloneHtml 产物中应包含灯箱缩放与平移动态逻辑", () => {
      const dummyDoc: ISlidesDocument = {
        docId: "doc-lightbox-test",
        config: { theme: "default", aspectRatio: "16/9", defaultTransition: "fade", colorSchema: "dark" },
        slides: [{ pageIndex: 1, startBlockId: "s1", blocks: [{ id: "b1", type: "p", content: "test" }] }],
      }
      const html = buildStandaloneHtml(dummyDoc)
      expect(html).toContain("handleLightboxWheel")
      expect(html).toContain("updateLightboxImgTransform")
      expect(html).toContain("resetLightboxZoom")
    })
  })

  describe("3. 以鼠标为锚点的缩放几何数学验证", () => {
    it("缩放计算公式应保证鼠标所指图像局部坐标在缩放前后绝对静止", () => {
      // 模拟视口与图片中心: 原中心位于 (500, 400)
      const origCenterX = 500
      const origCenterY = 400
      let currentScale = 1.0
      let currentTx = 0
      let currentTy = 0

      // 用户鼠标指向 (600, 450)
      const mouseX = 600
      const mouseY = 450

      // 缩放前鼠标指向的图像局部坐标:
      // (mouseX - (origCenterX + currentTx)) / currentScale
      const localXBefore = (mouseX - (origCenterX + currentTx)) / currentScale
      const localYBefore = (mouseY - (origCenterY + currentTy)) / currentScale
      expect(localXBefore).toBe(100)
      expect(localYBefore).toBe(50)

      // 放大至 2.0x
      const nextScale = 2.0
      const nextTx = (mouseX - origCenterX) * (1 - nextScale / currentScale) + currentTx * (nextScale / currentScale)
      const nextTy = (mouseY - origCenterY) * (1 - nextScale / currentScale) + currentTy * (nextScale / currentScale)

      // 放大后鼠标所指图像局部坐标:
      const localXAfter = (mouseX - (origCenterX + nextTx)) / nextScale
      const localYAfter = (mouseY - (origCenterY + nextTy)) / nextScale

      // 局部坐标分毫不差，鼠标在图像上的相对点保持绝对一致
      expect(localXAfter).toBeCloseTo(localXBefore, 5)
      expect(localYAfter).toBeCloseTo(localYBefore, 5)

      // 再次放大至 3.5x
      const thirdScale = 3.5
      const thirdTx = (mouseX - origCenterX) * (1 - thirdScale / nextScale) + nextTx * (thirdScale / nextScale)
      const thirdTy = (mouseY - origCenterY) * (1 - thirdScale / nextScale) + nextTy * (thirdScale / nextScale)

      const localXThird = (mouseX - (origCenterX + thirdTx)) / thirdScale
      const localYThird = (mouseY - (origCenterY + thirdTy)) / thirdScale
      expect(localXThird).toBeCloseTo(localXBefore, 5)
      expect(localYThird).toBeCloseTo(localYBefore, 5)
    })
  })
})
