import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createPageJumpInput,
  PAGE_JUMP_IDLE_CLEAR_MS,
  PAGE_JUMP_INVALID_FLASH_MS,
} from "../src/ui/tab/page-jump-input"
import type { IPageJumpState } from "../src/ui/tab/page-jump-input"

/**
 * 「数字+回车」跳页输入状态机单元测试
 * 三处播放面（宿主页签 / 内置沙箱 / standalone 导出）共用的交互规则在宿主侧收敛为该状态机
 */
describe("Page Jump Input (数字+回车跳页状态机)", () => {
  const makeKeyEvent = (key: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent => {
    return { key, target: {}, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, ...extra } as unknown as KeyboardEvent
  }

  let jumps: number[]
  let states: IPageJumpState[]

  const createInput = (totalPages = 25, isEnabled?: () => boolean) => {
    jumps = []
    states = []
    return createPageJumpInput({
      getTotalPages: () => totalPages,
      isEnabled,
      onJump: (page) => jumps.push(page),
      onStateChange: (state) => states.push({ ...state }),
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("数字键累计缓冲并实时回显，回车确认后跳转并清空", () => {
    const input = createInput(25)
    expect(input.handleKeydown(makeKeyEvent("1"))).toBe(true)
    expect(input.getState().display).toBe("1")
    expect(input.handleKeydown(makeKeyEvent("3"))).toBe(true)
    expect(input.getState().display).toBe("13")

    expect(input.handleKeydown(makeKeyEvent("Enter"))).toBe(true)
    expect(jumps).toEqual([13])
    expect(input.getState()).toEqual({ display: "", invalid: false })
  })

  it("小键盘数字（key 同为 0-9）同样进入缓冲", () => {
    const input = createInput(25)
    input.handleKeydown(makeKeyEvent("7", { code: "Numpad7" }))
    expect(input.handleKeydown(makeKeyEvent("Enter"))).toBe(true)
    expect(jumps).toEqual([7])
  })

  it("前导零忽略：05 视为第 5 页", () => {
    const input = createInput(25)
    input.handleKeydown(makeKeyEvent("0"))
    input.handleKeydown(makeKeyEvent("5"))
    input.handleKeydown(makeKeyEvent("Enter"))
    expect(jumps).toEqual([5])
  })

  it("越界页码不跳转，角标红色抖动提示后自动清空", () => {
    const input = createInput(25)
    input.handleKeydown(makeKeyEvent("9"))
    input.handleKeydown(makeKeyEvent("9"))
    expect(input.handleKeydown(makeKeyEvent("Enter"))).toBe(true)

    expect(jumps).toEqual([])
    expect(input.getState()).toEqual({ display: "99", invalid: true })

    vi.advanceTimersByTime(PAGE_JUMP_INVALID_FLASH_MS)
    expect(input.getState()).toEqual({ display: "", invalid: false })
  })

  it("纯 0 页码按越界提示处理", () => {
    const input = createInput(25)
    input.handleKeydown(makeKeyEvent("0"))
    expect(input.handleKeydown(makeKeyEvent("Enter"))).toBe(true)
    expect(jumps).toEqual([])
    expect(input.getState().invalid).toBe(true)
  })

  it("Esc 清空缓冲且不再消费无缓冲的 Esc", () => {
    const input = createInput(25)
    input.handleKeydown(makeKeyEvent("1"))
    expect(input.handleKeydown(makeKeyEvent("Escape"))).toBe(true)
    expect(input.getState().display).toBe("")

    // 无缓冲时 Esc 放行（如沙箱内灯箱关闭等既有行为）
    expect(input.handleKeydown(makeKeyEvent("Escape"))).toBe(false)
  })

  it("1.5 秒无输入自动清空缓冲", () => {
    const input = createInput(25)
    input.handleKeydown(makeKeyEvent("2"))
    vi.advanceTimersByTime(PAGE_JUMP_IDLE_CLEAR_MS - 1)
    expect(input.getState().display).toBe("2")
    // 提示期间续输会重置空闲计时
    input.handleKeydown(makeKeyEvent("3"))
    vi.advanceTimersByTime(PAGE_JUMP_IDLE_CLEAR_MS - 1)
    expect(input.getState().display).toBe("23")
    vi.advanceTimersByTime(1)
    expect(input.getState()).toEqual({ display: "", invalid: false })
    expect(input.handleKeydown(makeKeyEvent("Enter"))).toBe(false)
    expect(jumps).toEqual([])
  })

  it("空缓冲或提示抖动期间的回车不消费，放行页面原有行为", () => {
    const input = createInput(25)
    expect(input.handleKeydown(makeKeyEvent("Enter"))).toBe(false)

    input.handleKeydown(makeKeyEvent("9"))
    input.handleKeydown(makeKeyEvent("9"))
    input.handleKeydown(makeKeyEvent("Enter")) // 进入抖动提示
    expect(input.handleKeydown(makeKeyEvent("Enter"))).toBe(false)
    expect(jumps).toEqual([])
  })

  it("越界抖动期间忽略续输数字，提示结束后重新输入", () => {
    const input = createInput(25)
    input.handleKeydown(makeKeyEvent("9"))
    input.handleKeydown(makeKeyEvent("9"))
    input.handleKeydown(makeKeyEvent("Enter"))
    expect(input.handleKeydown(makeKeyEvent("1"))).toBe(true)
    expect(input.getState()).toEqual({ display: "99", invalid: true })

    vi.advanceTimersByTime(PAGE_JUMP_INVALID_FLASH_MS)
    expect(input.handleKeydown(makeKeyEvent("1"))).toBe(true)
    expect(input.getState().display).toBe("1")
  })

  it("位数达到上限后忽略后续数字，防止长按撑爆缓冲", () => {
    const input = createInput(25)
    for (const key of ["1", "2", "3", "4", "5", "6"]) {
      input.handleKeydown(makeKeyEvent(key))
    }
    expect(input.getState().display).toBe("1234")
  })

  it("光标在可输入元素内时不拦截按键", () => {
    const input = createInput(25)
    const editableEvent = makeKeyEvent("1", { target: { tagName: "INPUT" } as unknown as EventTarget })
    expect(input.handleKeydown(editableEvent)).toBe(false)
    expect(input.handleKeydown(makeKeyEvent("Enter"))).toBe(false)
    expect(jumps).toEqual([])

    const contentEditableEvent = makeKeyEvent("1", { target: { tagName: "DIV", isContentEditable: true } as unknown as EventTarget })
    expect(input.handleKeydown(contentEditableEvent)).toBe(false)
  })

  it("携带 Ctrl/Meta/Alt 修饰键或 IME 组合输入中的按键不拦截", () => {
    const input = createInput(25)
    expect(input.handleKeydown(makeKeyEvent("1", { ctrlKey: true }))).toBe(false)
    expect(input.handleKeydown(makeKeyEvent("1", { metaKey: true }))).toBe(false)
    expect(input.handleKeydown(makeKeyEvent("1", { altKey: true }))).toBe(false)
    expect(input.handleKeydown(makeKeyEvent("1", { isComposing: true }))).toBe(false)
    expect(input.getState().display).toBe("")
  })

  it("isEnabled 返回 false 时（速览抽屉冻结键盘）忽略所有按键", () => {
    const input = createInput(25, () => false)
    expect(input.handleKeydown(makeKeyEvent("1"))).toBe(false)
    expect(input.handleKeydown(makeKeyEvent("Enter"))).toBe(false)
    expect(input.getState().display).toBe("")
  })

  it("总页数未知（0）时回车一律按越界提示处理", () => {
    const input = createInput(0)
    input.handleKeydown(makeKeyEvent("1"))
    expect(input.handleKeydown(makeKeyEvent("Enter"))).toBe(true)
    expect(jumps).toEqual([])
    expect(input.getState().invalid).toBe(true)
  })

  it("clear() 主动清空角标并取消挂起定时器", () => {
    const input = createInput(25)
    input.handleKeydown(makeKeyEvent("2"))
    input.clear()
    expect(input.getState()).toEqual({ display: "", invalid: false })
    // 定时器已取消，推进时钟不会再触发隐藏回调（状态保持一致）
    vi.advanceTimersByTime(PAGE_JUMP_IDLE_CLEAR_MS + PAGE_JUMP_INVALID_FLASH_MS)
    expect(input.getState()).toEqual({ display: "", invalid: false })
  })
})
