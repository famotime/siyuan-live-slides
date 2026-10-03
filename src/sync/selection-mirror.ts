/**
 * 幻灯片反向定位与高亮映射器 (Selection Mirror)
 * 从幻灯片沙箱点击元素，反向平滑滚动并高亮思源正文块
 */
export function mirrorBlockSelection(blockId: string): boolean {
  if (!blockId || typeof document === "undefined") {
    return false
  }

  const blockEl = document.querySelector(`[data-node-id="${blockId}"]`)
  if (!blockEl) {
    return false
  }

  // 平滑滚动至视口居中
  blockEl.scrollIntoView({ behavior: "smooth", block: "center" })

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
