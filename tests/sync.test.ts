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

    tracker.destroy()
    vi.useRealTimers()
  })
})

describe("Selection Mirror (反向定位)", () => {
  it("在非浏览器环境调用时安全返回 false", () => {
    expect(mirrorBlockSelection("some-block-id")).toBe(false)
  })
})
