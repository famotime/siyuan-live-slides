import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { InspectorSyncCoordinator } from "../src/sync/inspector-sync-coordinator"
import * as mainModule from "../src/main"
import * as selectionMirrorModule from "../src/sync/selection-mirror"
import { mirrorBlockSelection, clearBlockSelectionHighlight } from "../src/sync/selection-mirror"
import type { ISlidesDocument } from "../src/types/slides-protocol"

describe("Block Selection Highlight Toggle (演示与预览界面块级蓝色边框切换与取消)", () => {
  const indexHtmlPath = path.resolve(__dirname, "../public/slides-client/index.html")
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8")

  describe("1. 内置沙箱播放器交互 (public/slides-client/index.html)", () => {
    it("再次点击同一个对象时应清空 highlightedBlockId 并通知宿主 clickedBlockId 为空", () => {
      expect(indexHtml).toContain("if (highlightedBlockId.value && highlightedBlockId.value === blockId)")
      expect(indexHtml).toMatch(/highlightedBlockId\.value\s*=\s*""[\s\S]*?action:\s*"BLOCK_CLICKED"[\s\S]*?clickedBlockId:\s*""/)
    })

    it("按下 Escape 键时若有对象高亮应取消高亮并通知宿主", () => {
      expect(indexHtml).toContain("if (e.key === \"Escape\" && highlightedBlockId.value)")
      expect(indexHtml).toMatch(/if\s*\(e\.key\s*===\s*"Escape"\s*&&\s*highlightedBlockId\.value\)[\s\S]*?highlightedBlockId\.value\s*=\s*""/)
    })

    it("点击幻灯片空白区域时应清除对象高亮并通知宿主", () => {
      expect(indexHtml).toMatch(/\/\/ 空白区域点击：若当前存在对象高亮[\s\S]*?if\s*\(highlightedBlockId\.value\)[\s\S]*?highlightedBlockId\.value\s*=\s*""/)
    })

    it("页码切换 (watch currentPageIndex) 时应自动重置清除高亮", () => {
      expect(indexHtml).toMatch(/watch\(currentPageIndex,\s*\(newVal,\s*oldVal\)\s*=>\s*\{[\s\S]*?if\s*\(highlightedBlockId\.value\)\s*\{[\s\S]*?highlightedBlockId\.value\s*=\s*""/)
    })
  })

  describe("2. 宿主 InspectorSyncCoordinator 协调逻辑", () => {
    let coordinator: InspectorSyncCoordinator

    beforeEach(() => {
      coordinator = new InspectorSyncCoordinator()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    const dummyDoc: ISlidesDocument = {
      docId: "doc-toggle-test",
      config: { theme: "default", aspectRatio: "16/9", highlighter: "shiki" } as any,
      slides: [
        {
          pageIndex: 1,
          startBlockId: "div-page-1",
          frontmatter: { layout: "cover" },
          notes: "",
          blocks: [{ id: "b-1", type: "p", content: "页1内容", rawMarkdown: "页1内容" }],
          rawMarkdown: "页1内容",
        },
        {
          pageIndex: 2,
          startBlockId: "div-page-2",
          frontmatter: { layout: "two-cols" },
          notes: "",
          blocks: [{ id: "b-2", type: "p", content: "页2内容", rawMarkdown: "页2内容" }],
          rawMarkdown: "页2内容",
        },
      ],
      fullMarkdown: "",
    }

    it("当 blockId 为空时（取消高亮），不得触发 mirrorBlockSelection 滚动或呼吸高亮", () => {
      const mirrorSpy = vi.spyOn(selectionMirrorModule, "mirrorBlockSelection")
      const updateInspectorSpy = vi.spyOn(mainModule, "updateInspectorCurrentBlock").mockImplementation(() => {})

      const res = coordinator.handleBlockClickedFromSlide("", null, "doc-toggle-test", dummyDoc, 2)
      expect(res).toBe(true)
      expect(mirrorSpy).not.toHaveBeenCalled()
    })

    it("当 blockId 为空时（取消高亮），右侧面板应退回对应页面的「幻灯片页面配置 (Page Inspector)」", async () => {
      const updateInspectorSpy = vi.spyOn(mainModule, "updateInspectorCurrentBlock").mockImplementation(() => {})

      // 模拟第 2 页取消高亮
      coordinator.handleBlockClickedFromSlide("", null, "doc-toggle-test", dummyDoc, 2)

      // 等待微任务 resolveBlockAttrs 完成
      await Promise.resolve()

      expect(updateInspectorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "div-page-2",
          isDivider: true,
          type: "NodeThematicBreak",
          pageDividerId: "div-page-2",
          pageDividerLayout: "two-cols",
        }),
      )
    })

    it("当文档无 slides 时应降级退回全局文档演示配置模式", async () => {
      const switchDocSpy = vi.spyOn(coordinator, "switchToDocGlobalInspector").mockImplementation(async () => {})

      coordinator.handleBlockClickedFromSlide("", null, "doc-toggle-test", null, 1)

      expect(switchDocSpy).toHaveBeenCalledWith("doc-toggle-test")
    })
  })

  describe("3. 正文编辑区 SelectionMirror 单例防残留与快速响应优化", () => {
    let origDoc: any

    beforeEach(() => {
      origDoc = (globalThis as any).document
      vi.useFakeTimers()
    })

    afterEach(() => {
      clearBlockSelectionHighlight()
      ;(globalThis as any).document = origDoc
      vi.useRealTimers()
    })

    function createMockElement(id: string) {
      return {
        id,
        scrollIntoView: vi.fn(),
        focus: vi.fn(),
        classList: {
          classes: new Set<string>(),
          add(cls: string) { this.classes.add(cls) },
          remove(cls: string) { this.classes.delete(cls) },
          contains(cls: string) { return this.classes.has(cls) },
        },
        style: {
          outline: "",
          transition: "",
          removeProperty(prop: string) {
            if (prop === "outline") this.outline = ""
            if (prop === "transition") this.transition = ""
          },
        },
      }
    }

    it("连续点击不同对象时，前一个对象的高亮必须立刻被清除，不得并发残留", () => {
      const el1 = createMockElement("block-1")
      const el2 = createMockElement("block-2")

      const elements: Record<string, any> = { "block-1": el1, "block-2": el2 }

      ;(globalThis as any).document = {
        querySelector: vi.fn((sel: string) => {
          for (const key of Object.keys(elements)) {
            if (sel.includes(key)) return elements[key]
          }
          return null
        }),
        querySelectorAll: vi.fn(() => []),
      }

      // 1. 点击 block-1
      mirrorBlockSelection("block-1")
      expect(el1.classList.contains("protyle-wysiwyg--select")).toBe(true)
      expect(el1.style.outline).toBe("2px solid #3b82f6")

      // 2. 紧接着点击 block-2（未到 500ms）
      vi.advanceTimersByTime(100)
      mirrorBlockSelection("block-2")

      // 验证：block-1 必须立刻被解除高亮，不得保留蓝色边框！
      expect(el1.classList.contains("protyle-wysiwyg--select")).toBe(false)
      expect(el1.style.outline).toBe("")

      // block-2 处于高亮态
      expect(el2.classList.contains("protyle-wysiwyg--select")).toBe(true)
      expect(el2.style.outline).toBe("2px solid #3b82f6")

      // 500ms 后 block-2 也正常自动恢复
      vi.advanceTimersByTime(500)
      expect(el2.classList.contains("protyle-wysiwyg--select")).toBe(false)
      expect(el2.style.outline).toBe("")
    })

    it("连续快速点击同一个对象时，不会将高亮色污染为 originalOutline，定时器触发后高亮完全消失", () => {
      const el1 = createMockElement("block-repeat")

      ;(globalThis as any).document = {
        querySelector: vi.fn((sel: string) => {
          if (sel.includes("block-repeat")) return el1
          return null
        }),
        querySelectorAll: vi.fn(() => []),
      }

      // 第一次点击
      mirrorBlockSelection("block-repeat")
      expect(el1.style.outline).toBe("2px solid #3b82f6")

      // 在高亮仍在生效期间（100ms）再次点击同块
      vi.advanceTimersByTime(100)
      mirrorBlockSelection("block-repeat")
      expect(el1.style.outline).toBe("2px solid #3b82f6")

      // 等待 500ms 超时，验证 outline 必须完全清空，绝不因污染而永久残留！
      vi.advanceTimersByTime(550)
      expect(el1.style.outline).toBe("")
      expect(el1.classList.contains("protyle-wysiwyg--select")).toBe(false)
    })

    it("clearBlockSelectionHighlight 会兜底巡检并清理编辑区内任何残留的蓝色边框", () => {
      const staleEl = createMockElement("stale-block")
      staleEl.style.outline = "2px solid #3b82f6"
      staleEl.classList.add("protyle-wysiwyg--select")

      ;(globalThis as any).document = {
        querySelectorAll: vi.fn((sel: string) => {
          return [staleEl]
        }),
      }

      clearBlockSelectionHighlight()

      expect(staleEl.style.outline).toBe("")
      expect(staleEl.classList.contains("protyle-wysiwyg--select")).toBe(false)
    })
  })
})
