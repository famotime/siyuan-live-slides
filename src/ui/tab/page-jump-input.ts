/**
 * 放映状态下「数字 + 回车」跳页输入状态机
 *
 * 统一交互规则（宿主页签 / 内置沙箱 / standalone 导出播放器三处保持一致）：
 * - 数字键（主键盘与小键盘）累计输入，实时显示于右下角角标
 * - 回车确认跳转；越界或纯 0 时不跳转，角标红色抖动提示后清空
 * - Esc 或 1.5 秒无输入自动清空缓冲
 * - 光标位于可输入元素、携带修饰键、IME 组合输入中时不拦截
 */

/** 无输入自动清空缓冲的空闲时长 */
export const PAGE_JUMP_IDLE_CLEAR_MS = 1500
/** 越界红色抖动提示的展示时长 */
export const PAGE_JUMP_INVALID_FLASH_MS = 500

/** 角标展示文本的位数上限，防御长按数字键导致缓冲无限增长 */
const MAX_BUFFER_LENGTH = 4

export interface IPageJumpInputOptions {
  /** 当前总页数（0 或负数视为未知，回车一律按越界提示处理） */
  getTotalPages: () => number
  /** 合法页码（1-based）确认跳转回调 */
  onJump: (page: number) => void
  /** 可选使能开关（返回 false 时忽略所有按键，如速览抽屉打开冻结键盘时） */
  isEnabled?: () => boolean
  /** 可选状态回调：缓冲或提示态变化时同步给 UI（Vue 侧转存为响应式） */
  onStateChange?: (state: IPageJumpState) => void
}

export interface IPageJumpState {
  /** 角标当前展示文本（空串表示隐藏） */
  display: string
  /** 越界提示态：角标红色抖动展示已敲数字 */
  invalid: boolean
}

export interface IPageJumpInput {
  /** 处理按键事件；返回 true 表示事件已被消费（调用方可据此 preventDefault） */
  handleKeydown: (e: KeyboardEvent) => boolean
  getState: () => IPageJumpState
  /** 主动清空角标与定时器（组件卸载时调用） */
  clear: () => void
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

/** 判断事件目标是否处于可输入元素内（供宿主侧其它按键守卫复用） */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  return EDITABLE_TAGS.has(el.tagName) || el.isContentEditable === true
}

export function createPageJumpInput(options: IPageJumpInputOptions): IPageJumpInput {
  let display = ""
  let invalid = false
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function notify() {
    if (options.onStateChange) {
      options.onStateChange({ display, invalid })
    }
  }

  function clearTimers() {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    if (flashTimer) {
      clearTimeout(flashTimer)
      flashTimer = null
    }
  }

  function hide() {
    clearTimers()
    display = ""
    invalid = false
    notify()
  }

  function armIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(hide, PAGE_JUMP_IDLE_CLEAR_MS)
  }

  function flashInvalid() {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    invalid = true
    notify()
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = setTimeout(hide, PAGE_JUMP_INVALID_FLASH_MS)
  }

  function handleKeydown(e: KeyboardEvent): boolean {
    if (options.isEnabled && !options.isEnabled()) return false
    if (isEditableTarget(e.target)) return false
    if (e.isComposing) return false
    // 携带修饰键的数字（如 Ctrl+1 切换标签）交还系统处理
    if (e.ctrlKey || e.metaKey || e.altKey) return false

    if (/^[0-9]$/.test(e.key)) {
      // 越界抖动提示期间忽略续输，等待提示自然结束
      if (invalid) return true
      if (display.length >= MAX_BUFFER_LENGTH) return true
      display += e.key
      notify()
      armIdleTimer()
      return true
    }

    if (e.key === "Enter") {
      // 空缓冲或提示抖动期间的回车不消费，放行给页面原有行为
      if (!display || invalid) return false
      const typed = display
      const page = parseInt(typed, 10)
      const total = options.getTotalPages()
      if (!isNaN(page) && page >= 1 && total > 0 && page <= total) {
        hide()
        options.onJump(page)
        return true
      }
      // 越界 / 纯 0：不跳转，保留数字做红色抖动提示后清空
      flashInvalid()
      return true
    }

    if (e.key === "Escape") {
      if (display || invalid) {
        hide()
        return true
      }
      return false
    }

    return false
  }

  return {
    handleKeydown,
    getState: () => ({ display, invalid }),
    clear: hide,
  }
}
