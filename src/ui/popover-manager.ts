import { createApp, type App as VueApp } from 'vue'
import QuickDividerPopover from './components/QuickDividerPopover.vue'
import ElementAnimBar from './components/ElementAnimBar.vue'

let currentPopoverApp: VueApp | null = null
let currentPopoverContainer: HTMLElement | null = null

/**
 * 销毁当前弹出的悬浮气泡
 */
export function closeCurrentPopover(): void {
  if (currentPopoverApp) {
    currentPopoverApp.unmount()
    currentPopoverApp = null
  }
  if (currentPopoverContainer && currentPopoverContainer.parentElement) {
    currentPopoverContainer.parentElement.removeChild(currentPopoverContainer)
    currentPopoverContainer = null
  }
}

/**
 * 在目标 DOM 元素周围定位气泡
 */
function positionPopover(container: HTMLElement, targetEl: HTMLElement): void {
  const rect = targetEl.getBoundingClientRect()
  const popoverWidth = 290
  const popoverHeight = 360

  let top = rect.top - popoverHeight - 8
  let left = rect.left + (rect.width - popoverWidth) / 2

  // 避免超出屏幕顶部
  if (top < 10) {
    top = rect.bottom + 8
  }
  // 避免超出屏幕左右边界
  if (left < 10) {
    left = 10
  } else if (left + popoverWidth > window.innerWidth - 10) {
    left = window.innerWidth - popoverWidth - 10
  }

  container.style.position = 'fixed'
  container.style.top = `${Math.round(top)}px`
  container.style.left = `${Math.round(left)}px`
  container.style.zIndex = '9999'
}

/**
 * 打开水平分割线快捷分页设置悬浮气泡
 */
export function openQuickDividerPopover(
  targetEl: HTMLElement,
  blockId: string,
  initialAttrs: Record<string, string> = {},
  onUpdated?: (attrs: Record<string, string>) => void,
): void {
  closeCurrentPopover()

  const container = document.createElement('div')
  container.className = 'slides-floating-popover-container'
  document.body.appendChild(container)
  currentPopoverContainer = container

  positionPopover(container, targetEl)

  currentPopoverApp = createApp(QuickDividerPopover, {
    blockId,
    initialAttrs,
    onClose: () => {
      closeCurrentPopover()
    },
    onUpdated: (attrs: Record<string, string>) => {
      if (onUpdated) {
        onUpdated(attrs)
      }
    },
  })

  currentPopoverApp.mount(container)

  // 点击外部自动关闭
  const handleOutsideClick = (e: MouseEvent) => {
    if (!container.contains(e.target as Node) && !targetEl.contains(e.target as Node)) {
      closeCurrentPopover()
      window.removeEventListener('mousedown', handleOutsideClick, true)
    }
  }
  setTimeout(() => {
    window.addEventListener('mousedown', handleOutsideClick, true)
  }, 50)
}

/**
 * 打开元素级动效与排版悬浮工具条
 */
export function openElementAnimBar(
  targetEl: HTMLElement,
  blockId: string,
  isCodeBlock = false,
  initialAttrs: Record<string, string> = {},
  onUpdated?: (attrs: Record<string, string>) => void,
): void {
  closeCurrentPopover()

  const container = document.createElement('div')
  container.className = 'slides-floating-animbar-container'
  document.body.appendChild(container)
  currentPopoverContainer = container

  const rect = targetEl.getBoundingClientRect()
  const top = Math.max(10, rect.top - 42)
  const left = Math.max(10, Math.min(rect.left, window.innerWidth - 260))

  container.style.position = 'fixed'
  container.style.top = `${Math.round(top)}px`
  container.style.left = `${Math.round(left)}px`
  container.style.zIndex = '9999'

  currentPopoverApp = createApp(ElementAnimBar, {
    blockId,
    isCodeBlock,
    initialAttrs,
    onUpdated: (attrs: Record<string, string>) => {
      if (onUpdated) {
        onUpdated(attrs)
      }
    },
  })

  currentPopoverApp.mount(container)

  const handleOutsideClick = (e: MouseEvent) => {
    if (!container.contains(e.target as Node) && !targetEl.contains(e.target as Node)) {
      closeCurrentPopover()
      window.removeEventListener('mousedown', handleOutsideClick, true)
    }
  }
  setTimeout(() => {
    window.addEventListener('mousedown', handleOutsideClick, true)
  }, 50)
}
