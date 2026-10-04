import { openTab } from "siyuan"

/**
 * 幻灯片反向定位与高亮映射器 (Selection Mirror)
 * 从幻灯片沙箱点击元素，反向平滑滚动并高亮思源正文块
 */
export function mirrorBlockSelection(blockId: string, app?: any): boolean {
  if (!blockId || typeof document === "undefined") {
    return false
  }

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
    blockEl.scrollIntoView()
  }

  // 设置焦点，触发思源选区
  try {
    blockEl.focus?.({ preventScroll: true })
  } catch {}

  // 注入思源高亮样式类与临时呼吸光晕
  blockEl.classList.add("protyle-wysiwyg--select")
  const originalOutline = (blockEl as HTMLElement).style.outline
  ;(blockEl as HTMLElement).style.outline = "2px solid #3b82f6"
  ;(blockEl as HTMLElement).style.transition = "outline 0.3s ease"

  setTimeout(() => {
    blockEl.classList.remove("protyle-wysiwyg--select")
    ;(blockEl as HTMLElement).style.outline = originalOutline
  }, 1200)

  return true
}

