import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import type { ISlidesDocument } from "../src/types/slides-protocol"

describe("Blank Area Mouse Click Navigation (空白区域鼠标左键左右翻页)", () => {
  const indexPath = path.resolve(__dirname, "../public/slides-client/index.html")
  const indexHtml = fs.readFileSync(indexPath, "utf-8")

  const dummyDoc: ISlidesDocument = {
    docId: "doc-click-test",
    config: {
      theme: "default",
      aspectRatio: "16/9",
      highlighter: "shiki",
      defaultTransition: "fade",
      colorSchema: "auto",
    },
    slides: [
      {
        pageIndex: 1,
        startBlockId: "start-1",
        frontmatter: { layout: "default" },
        notes: "",
        blocks: [
          { id: "h1", type: "h", content: "标题", rawMarkdown: "# 标题" },
        ],
        rawMarkdown: "# 标题",
      },
      {
        pageIndex: 2,
        startBlockId: "start-2",
        frontmatter: { layout: "default" },
        notes: "",
        blocks: [
          { id: "p1", type: "p", content: "正文", rawMarkdown: "正文" },
        ],
        rawMarkdown: "正文",
      },
    ],
    fullMarkdown: "# 标题\n\n---\n\n正文",
  }

  it("客户端 index.html 应包含鼠标左键过滤、划选保护、组件排查与左右翻页调度", () => {
    expect(indexHtml).toContain("if (e.button !== 0) return")
    expect(indexHtml).toContain("const selection = window.getSelection ? window.getSelection().toString().trim() : \"\"")
    expect(indexHtml).toContain("if (selection.length > 0) return")
    expect(indexHtml).toContain(".slide-block, .controls-bar, .image-right-img-container, .image-left-img-container")
    expect(indexHtml).toContain("const isLeft = e.clientX < window.innerWidth / 2")
    expect(indexHtml).toContain("prevStepOrSlide()")
    expect(indexHtml).toContain("nextStepOrSlide()")
    expect(indexHtml).toContain("syncAutoplayVideos()")
  })

  it("导出的单文件 HTML 中应同步包含相同的空白区域左右翻页与组件排查逻辑", () => {
    const exportedHtml = buildStandaloneHtml(dummyDoc)
    expect(exportedHtml).toContain("if (e.button !== 0) return;")
    expect(exportedHtml).toContain("const selection = window.getSelection ? window.getSelection().toString().trim() : \"\";")
    expect(exportedHtml).toContain("if (selection.length > 0) return;")
    expect(exportedHtml).toContain(".slide-block, .controls-bar, .image-right-img-container, .image-left-img-container")
    expect(exportedHtml).toContain("const isLeft = e.clientX < window.innerWidth / 2;")
    expect(exportedHtml).toContain("renderSlide(currentIndex - 1);")
    expect(exportedHtml).toContain("renderSlide(currentIndex + 1);")
  })

  it("模拟调度算法：点击空白左侧应向前翻页，右侧应向后翻页，点中内容块或交互控件应抑制翻页", () => {
    // 提取调度纯函数逻辑进行沙箱化单测模拟
    function simulateClickNavigation(
      e: {
        button: number
        clientX: number
        target: { closest: (selector: string) => any }
      },
      windowWidth: number,
      selectionText: string,
      callbacks: { onPrev: () => void; onNext: () => void }
    ) {
      if (e.button !== 0) return false

      if (selectionText && selectionText.trim().length > 0) return false

      const isComponent = e.target.closest(
        ".slide-block, .controls-bar, .image-right-img-container, .image-left-img-container, img, video, audio, button, a, input, textarea, select, [data-clickable], [data-ref-id], .slides-toc, .empty-state"
      )
      if (isComponent) return false

      const isLeft = e.clientX < windowWidth / 2
      if (isLeft) {
        callbacks.onPrev()
      } else {
        callbacks.onNext()
      }
      return true
    }

    const onPrev = vi.fn()
    const onNext = vi.fn()

    // 1. 空白处左侧点击 (clientX: 200, innerWidth: 1000) -> onPrev
    const blankTarget = { closest: () => null }
    const resLeft = simulateClickNavigation(
      { button: 0, clientX: 200, target: blankTarget },
      1000,
      "",
      { onPrev, onNext }
    )
    expect(resLeft).toBe(true)
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()

    // 2. 空白处右侧点击 (clientX: 800, innerWidth: 1000) -> onNext
    const resRight = simulateClickNavigation(
      { button: 0, clientX: 800, target: blankTarget },
      1000,
      "",
      { onPrev, onNext }
    )
    expect(resRight).toBe(true)
    expect(onNext).toHaveBeenCalledTimes(1)

    // 3. 点击内容块内部 (.slide-block) -> 不触发翻页
    const blockTarget = {
      closest: (sel: string) => (sel.includes(".slide-block") ? { className: "slide-block" } : null),
    }
    const resBlock = simulateClickNavigation(
      { button: 0, clientX: 800, target: blockTarget },
      1000,
      "",
      { onPrev, onNext }
    )
    expect(resBlock).toBe(false)
    expect(onNext).toHaveBeenCalledTimes(1) // 未增加

    // 4. 点击控制条 (.controls-bar) -> 不触发翻页
    const controlTarget = {
      closest: (sel: string) => (sel.includes(".controls-bar") ? { className: "controls-bar" } : null),
    }
    const resControl = simulateClickNavigation(
      { button: 0, clientX: 100, target: controlTarget },
      1000,
      "",
      { onPrev, onNext }
    )
    expect(resControl).toBe(false)
    expect(onPrev).toHaveBeenCalledTimes(1) // 未增加

    // 5. 非鼠标左键点击 (button: 2，右键) -> 不触发翻页
    const resRightBtn = simulateClickNavigation(
      { button: 2, clientX: 100, target: blankTarget },
      1000,
      "",
      { onPrev, onNext }
    )
    expect(resRightBtn).toBe(false)

    // 6. 处于文本选中状态 -> 不触发翻页
    const resSelection = simulateClickNavigation(
      { button: 0, clientX: 800, target: blankTarget },
      1000,
      "选中的某些文字",
      { onPrev, onNext }
    )
    expect(resSelection).toBe(false)
    expect(onNext).toHaveBeenCalledTimes(1) // 未增加
  })

  it("客户端 index.html 中点击命中对象时绝不因未完成步进 (hasPendingSteps/蒙版) 而穿透触发翻页", () => {
    // 确保 index.html 中的 isComponent 拦截不携带 !hasPendingSteps 穿透条件
    expect(indexHtml).not.toMatch(/if\s*\(isComponent\s*&&\s*!hasPendingSteps\)\s*return/)
    // 确保命中组件时直接 return 抑制翻页
    expect(indexHtml).toMatch(/if\s*\(isComponent\)\s*return/)
  })
})
