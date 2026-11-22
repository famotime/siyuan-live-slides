import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import type { ISlidesDocument } from "../src/types/slides-protocol"

describe("Wheel Navigation, Auto-hidden Controls Bar & Page Number Strong Sync", () => {
  const indexHtmlPath = path.resolve(__dirname, "../public/slides-client/index.html")
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8")

  const dummyDoc: ISlidesDocument = {
    docId: "doc-wheel-test",
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
      {
        pageIndex: 3,
        startBlockId: "slide-3",
        frontmatter: { layout: "default" },
        notes: "",
        blocks: [],
        rawMarkdown: "# Slide 3",
      },
    ],
    fullMarkdown: "# Slide 1\n---\n# Slide 2\n---\n# Slide 3",
  }

  describe("1. 悬浮控制条默认隐藏与悬浮显现规范", () => {
    it("内置沙箱 index.html 控制条 .controls-bar 默认应为 opacity: 0，悬浮时变为 opacity: 1", () => {
      // 默认隐藏
      expect(indexHtml).toMatch(/\.controls-bar\s*\{[^}]*opacity:\s*0;/s)
      // 扩展悬浮感应热区（需置于底层 z-index: -1，避免遮挡按钮触发 hover 闪烁）
      expect(indexHtml).toMatch(/\.controls-bar::before\s*\{[^}]*z-index:\s*-1;/s)
      // 鼠标悬浮或聚焦时展示
      expect(indexHtml).toMatch(/\.controls-bar:hover,\s*\.controls-bar:focus-within\s*\{[^}]*opacity:\s*1;/s)
    })

    it("单文件独立导出 CSS 中 .controls 默认应为 opacity: 0，悬浮时变为 opacity: 1", () => {
      const styles = generateStandaloneExportStyles()
      expect(styles).toMatch(/\.controls\s*\{[^}]*opacity:\s*0;/s)
      expect(styles).toMatch(/\.controls::before\s*\{[^}]*z-index:\s*-1;/s)
      expect(styles).toMatch(/\.controls:hover,\s*\.controls:focus-within\s*\{[^}]*opacity:\s*1;/s)
    })
  })

  describe("2. 鼠标滚轮上下翻页调度", () => {
    it("内置沙箱 index.html 应包含滚轮监听、局部垂直滚动元素保护放行与防抖调度", () => {
      expect(indexHtml).toContain("function canElementScrollY(el, deltaY)")
      expect(indexHtml).toContain("function onWheel(e)")
      expect(indexHtml).toContain("e.deltaY > 0")
      expect(indexHtml).toContain("nextStepOrSlide()")
      expect(indexHtml).toContain("prevStepOrSlide()")
      expect(indexHtml).toContain('window.addEventListener("wheel", onWheel, { passive: false })')
      expect(indexHtml).toContain('window.removeEventListener("wheel", onWheel)')
    })

    it("导出的单文件独立 HTML 应包含相同的滚轮翻页调度与局部滚动放行逻辑", () => {
      const exportedHtml = buildStandaloneHtml(dummyDoc)
      expect(exportedHtml).toContain("function canElementScrollY(el, deltaY)")
      expect(exportedHtml).toContain('window.addEventListener("wheel"')
      expect(exportedHtml).toContain("renderSlide(currentIndex + 1);")
      expect(exportedHtml).toContain("renderSlide(currentIndex - 1);")
    })

    it("模拟局部滚动判定函数：若内部元素未滚到边界应放行，若已滚到尽头或无可滚动元素应触发翻页", () => {
      function simulateCanScroll(scrollHeight: number, clientHeight: number, scrollTop: number, deltaY: number) {
        const maxScroll = scrollHeight - clientHeight
        if (maxScroll > 2) {
          if (deltaY > 0 && scrollTop < maxScroll - 1) return true
          if (deltaY < 0 && scrollTop > 1) return true
        }
        return false
      }

      // 未滚到底部，向下滚轮 -> 应放行局部滚动
      expect(simulateCanScroll(500, 300, 100, 50)).toBe(true)
      // 已滚到底部，继续向下滚轮 -> 应返回 false 触发幻灯片翻页
      expect(simulateCanScroll(500, 300, 200, 50)).toBe(false)
      // 未滚到顶部，向上滚轮 -> 应放行局部滚动
      expect(simulateCanScroll(500, 300, 100, -50)).toBe(true)
      // 已在最顶部，向上滚轮 -> 应返回 false 触发幻灯片翻上一页
      expect(simulateCanScroll(500, 300, 0, -50)).toBe(false)
    })
  })

  describe("3. 预览窗口顶部和底部页码强同步与可靠翻页", () => {
    it("内置沙箱在接收 NAVIGATE_PAGE、HIGHLIGHT_ELEMENT、UPDATE_SLIDES 时均应触发 notifySlideChanged 与 broadcastSync", () => {
      expect(indexHtml).toContain('case "NAVIGATE_PAGE":')
      expect(indexHtml).toMatch(/case\s+"NAVIGATE_PAGE":[\s\S]*?notifySlideChanged\(\)[\s\S]*?broadcastSync\(\)/)
      expect(indexHtml).toMatch(/case\s+"HIGHLIGHT_ELEMENT":[\s\S]*?notifySlideChanged\(\)[\s\S]*?broadcastSync\(\)/)
      expect(indexHtml).toMatch(/case\s+"UPDATE_SLIDES":[\s\S]*?notifySlideChanged\(\)/)
    })

    it("内置沙箱应对 currentPageIndex 与 totalPages 设置响应式 watch 确保绝对强同步", () => {
      expect(indexHtml).toMatch(/watch\(currentPageIndex,\s*\(newVal,\s*oldVal\)\s*=>\s*\{[\s\S]*?notifySlideChanged\(\)/)
      expect(indexHtml).toMatch(/watch\(totalPages,\s*\(\)\s*=>\s*\{[\s\S]*?notifySlideChanged\(\)/)
    })

    it("内置沙箱在 CLIENT_READY 挂载就绪时应主动向宿主上报初始页码", () => {
      expect(indexHtml).toMatch(/action:\s*"CLIENT_READY",[\s\S]*?currentPage:\s*currentPageIndex\.value[\s\S]*?totalPages:\s*totalPages\.value/)
    })
  })
})
