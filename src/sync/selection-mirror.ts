import { openTab } from "siyuan"

let activeHighlightEl: HTMLElement | null = null
let activeHighlightTimer: any = null
let activeHighlightOriginalOutline = ""

/**
 * 立即清理当前正在呼吸高亮的思源正文块及轮廓样式（单例清理与兜底巡检）
 */
export function clearBlockSelectionHighlight(): void {
  if (activeHighlightTimer) {
    clearTimeout(activeHighlightTimer)
    activeHighlightTimer = null
  }

  if (activeHighlightEl) {
    try {
      activeHighlightEl.classList.remove("protyle-wysiwyg--select")
      if (activeHighlightOriginalOutline) {
        activeHighlightEl.style.outline = activeHighlightOriginalOutline
      } else if (typeof activeHighlightEl.style?.removeProperty === "function") {
        activeHighlightEl.style.removeProperty("outline")
      } else if (activeHighlightEl.style) {
        activeHighlightEl.style.outline = ""
      }

      if (typeof activeHighlightEl.style?.removeProperty === "function") {
        activeHighlightEl.style.removeProperty("transition")
      } else if (activeHighlightEl.style) {
        activeHighlightEl.style.transition = ""
      }
    } catch (err) {
      console.warn("[SelectionMirror] clear activeHighlightEl failed:", err)
    }

    activeHighlightEl = null
    activeHighlightOriginalOutline = ""
  }

  // 兜底保护：清理任何可能因连续并发点击残留在编辑区中的蓝色轮廓或高亮类
  if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
    try {
      const staleElements = document.querySelectorAll<HTMLElement>(
        ".protyle-wysiwyg [data-node-id].protyle-wysiwyg--select, .protyle-wysiwyg [data-node-id][style*='outline']",
      )
      staleElements.forEach((el) => {
        el.classList.remove("protyle-wysiwyg--select")
        const outlineVal = el.style?.outline || ""
        if (
          outlineVal.includes("#3b82f6") ||
          outlineVal.includes("rgb(59, 130, 246)") ||
          outlineVal.includes("59, 130, 246")
        ) {
          if (typeof el.style?.removeProperty === "function") {
            el.style.removeProperty("outline")
            el.style.removeProperty("transition")
          } else if (el.style) {
            el.style.outline = ""
            el.style.transition = ""
          }
        }
      })
    } catch {}
  }
}

/**
 * 幻灯片反向定位与高亮映射器 (Selection Mirror)
 * 从幻灯片沙箱点击元素，反向平滑滚动并高亮思源正文块
 */
export function mirrorBlockSelection(blockId: string, app?: any): boolean {
  if (!blockId || typeof document === "undefined") {
    clearBlockSelectionHighlight()
    return false
  }

  // 1. 在激活新对象前，立即清理上一个对象的高亮与定时器（避免多个蓝色边框并存）
  clearBlockSelectionHighlight()

  // 优先精确定位主编辑区 (WYSIWYG) 内的思源块，防止误选大纲或面包屑
  const escapedId = globalThis.CSS?.escape ? globalThis.CSS.escape(blockId) : blockId.replace(/"/g, '\\"')
  const blockEl = (document.querySelector(`.protyle-wysiwyg [data-node-id="${escapedId}"]`) ||
    document.querySelector(`[data-node-id="${escapedId}"]`)) as HTMLElement | null

  if (!blockEl) {
    // 降级兜底：当文档超长且目标块处于思源虚拟滚动渲染视口之外时，使用 openTab 定位
    if (app) {
      try {
        openTab({
          app,
          doc: {
            id: blockId,
            action: ["cb-get-hl", "cb-get-focus", "cb-get-context"],
          },
        })
        return true
      } catch (err) {
        console.warn("[SelectionMirror] openTab fallback failed:", err)
      }
    }
    return false
  }

  // 平滑滚动至视口居中
  try {
    blockEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
  } catch {
    blockEl.scrollIntoView?.()
  }

  // 设置焦点，触发思源选区
  try {
    blockEl.focus?.({ preventScroll: true })
  } catch {}

  // 记录真实的原始 outline（排除历史高亮残留色）
  const curOutline = blockEl.style?.outline || ""
  const isOurHighlight =
    curOutline.includes("#3b82f6") ||
    curOutline.includes("rgb(59, 130, 246)") ||
    curOutline.includes("59, 130, 246")
  activeHighlightOriginalOutline = isOurHighlight ? "" : curOutline

  // 注入思源高亮样式类与临时呼吸光晕
  blockEl.classList.add("protyle-wysiwyg--select")
  if (blockEl.style) {
    blockEl.style.outline = "2px solid #3b82f6"
    blockEl.style.transition = "outline 0.2s ease"
  }
  activeHighlightEl = blockEl

  // 呼吸高亮时长优化为 500ms（响应敏捷、视觉舒适、不粘滞）
  activeHighlightTimer = setTimeout(() => {
    clearBlockSelectionHighlight()
  }, 500)

  return true
}
