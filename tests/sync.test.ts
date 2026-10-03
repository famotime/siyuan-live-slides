import { describe, expect, it, vi } from "vitest"
import { CursorTracker } from "../src/sync/cursor-tracker"
import { DebounceController } from "../src/sync/debounce-controller"
import { mirrorBlockSelection } from "../src/sync/selection-mirror"
import type { ISlidevVirtualPage } from "../src/types/slidev-protocol"

describe("DebounceController (防抖控制器)", () => {
  it("应在延迟指定毫秒后执行最后一次任务", async () => {
    vi.useFakeTimers()
    const ctrl = new DebounceController()
    const fn = vi.fn()

    ctrl.debounce("task1", fn, 150)
    expect(ctrl.hasPending("task1")).toBe(true)

    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()

    // 再次调用触发重置
    ctrl.debounce("task1", fn, 150)
    vi.advanceTimersByTime(140)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(20)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(ctrl.hasPending("task1")).toBe(false)

    vi.useRealTimers()
  })

  it("应支持显式取消任务", () => {
    vi.useFakeTimers()
    const ctrl = new DebounceController()
    const fn = vi.fn()

    ctrl.debounce("task1", fn, 150)
    ctrl.cancel("task1")
    vi.advanceTimersByTime(200)

    expect(fn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe("CursorTracker (双向光标联动中枢)", () => {
  it("应正确构建 Block ID 到 Page Index 的索引并在聚焦时寻址", () => {
    vi.useFakeTimers()
    const mockBridge = {
      navigatePage: vi.fn(),
      highlightElement: vi.fn(),
    } as any

    const tracker = new CursorTracker(mockBridge)

    const slides: ISlidevVirtualPage[] = [
      {
        pageIndex: 1,
        startBlockId: "start-1",
        frontmatter: {},
        notes: "",
        blocks: [{ id: "b-1", type: "p", content: "", rawMarkdown: "" }],
        rawMarkdown: "",
      },
      {
        pageIndex: 2,
        startBlockId: "divider-2",
        frontmatter: {},
        notes: "",
        blocks: [
          { id: "b-2", type: "p", content: "", rawMarkdown: "" },
          { id: "b-3", type: "c", content: "", rawMarkdown: "" },
        ],
        rawMarkdown: "",
      },
    ]

    tracker.updateSlidesIndex(slides)

    expect(tracker.getPageByBlockId("start-1")).toBe(1)
    expect(tracker.getPageByBlockId("b-1")).toBe(1)
    expect(tracker.getPageByBlockId("divider-2")).toBe(2)
    expect(tracker.getPageByBlockId("b-3")).toBe(2)
    expect(tracker.getPageByBlockId("not-exist")).toBeNull()

    // 测试光标移入 b-3
    tracker.onCursorFocusBlock("b-3")
    vi.advanceTimersByTime(110)

    expect(mockBridge.navigatePage).toHaveBeenCalledWith(2)
    expect(mockBridge.highlightElement).toHaveBeenCalledWith("b-3")

    // 重复移入相同块不应触发额外调用
    tracker.onCursorFocusBlock("b-3")
    vi.advanceTimersByTime(150)
    expect(mockBridge.navigatePage).toHaveBeenCalledTimes(1)

    // 空块 ID 不应触发
    tracker.onCursorFocusBlock("")
    vi.advanceTimersByTime(150)
    expect(mockBridge.navigatePage).toHaveBeenCalledTimes(1)

    tracker.destroy()
    vi.useRealTimers()
  })
})

describe("Selection Mirror (反向定位)", () => {
  it("在非浏览器环境调用时安全返回 false", () => {
    expect(mirrorBlockSelection("some-block-id")).toBe(false)
  })

  it("当目标 DOM 元素存在时应成功平滑滚动并注入高亮样式", () => {
    vi.useFakeTimers()
    const mockEl = {
      setAttribute: vi.fn(),
      scrollIntoView: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      style: {
        outline: "",
        transition: "",
      },
    }

    const origDoc = (globalThis as any).document
    ;(globalThis as any).document = {
      querySelector: vi.fn((sel: string) => {
        if (sel.includes("mock-target-block")) return mockEl
        return null
      }),
    }

    const ok = mirrorBlockSelection("mock-target-block")
    expect(ok).toBe(true)
    expect(mockEl.scrollIntoView).toHaveBeenCalled()
    expect(mockEl.classList.add).toHaveBeenCalledWith("protyle-wysiwyg--select")

    // 1200ms 后应移除高亮类
    vi.advanceTimersByTime(1250)
    expect(mockEl.classList.remove).toHaveBeenCalledWith("protyle-wysiwyg--select")

    ;(globalThis as any).document = origDoc
    vi.useRealTimers()
  })
})

describe("Presenter Mode Protocol (演讲者模式协议规范)", () => {
  it("应正确定义双向同步的消息契约与广播载荷", () => {
    // 模拟沙箱收到 REQUEST_SYNC 后广播 SYNC_PAGE 与 SYNC_SLIDES
    const mockChannel = {
      postMessage: vi.fn(),
    }

    function handleRequestSync(currentSlides: any[], currentPage: number) {
      mockChannel.postMessage({
        type: "SYNC_PAGE",
        page: currentPage,
      })
      mockChannel.postMessage({
        type: "SYNC_SLIDES",
        slides: currentSlides,
      })
    }

    const testSlides = [
      { pageIndex: 1, startBlockId: "p1", blocks: [], frontmatter: {}, notes: "第一页备注", rawMarkdown: "" },
      { pageIndex: 2, startBlockId: "p2", blocks: [], frontmatter: {}, notes: "第二页备注", rawMarkdown: "" },
    ]

    handleRequestSync(testSlides, 2)

    expect(mockChannel.postMessage).toHaveBeenCalledWith({
      type: "SYNC_PAGE",
      page: 2,
    })
    expect(mockChannel.postMessage).toHaveBeenCalledWith({
      type: "SYNC_SLIDES",
      slides: testSlides,
    })
  })

  it("应保证翻页与跳转在边界范围内", () => {
    function clampPage(page: number, total: number): number {
      return Math.max(1, Math.min(page, Math.max(total, 1)))
    }

    expect(clampPage(0, 5)).toBe(1)
    expect(clampPage(-3, 5)).toBe(1)
    expect(clampPage(3, 5)).toBe(3)
    expect(clampPage(6, 5)).toBe(5)
    expect(clampPage(10, 0)).toBe(1)
  })
})

