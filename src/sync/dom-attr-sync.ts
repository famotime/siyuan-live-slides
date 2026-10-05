/**
 * 思源编辑区 DOM 块属性实时同步器 (DOM Attribute Synchronizer)
 *
 * 彻底防御与修复思源笔记本体前端在 transactions updateAttrs 中
 * 硬编码忽略 NodeThematicBreak 等特殊块导致 DOM 属性无法同步更新的缺陷。
 * 确保版式切换、动效设置、讲稿备注转换时，Protyle WYSIWYG 编辑区
 * 中的自定义属性 (custom-slidev-*) 与伪元素徽标浮动提示能毫秒级即刻刷新/消失。
 */

/**
 * 实时同步/更新 Protyle 编辑区中对应块的 DOM 元素属性
 *
 * @param blockId 思源块 ID
 * @param attrs 需要同步的属性键值对（若值为 ""、null 或 undefined 则执行 removeAttribute 彻底清除）
 */
export function syncDomBlockAttrs(
  blockId: string,
  attrs: Record<string, string | null | undefined>,
): void {
  if (typeof document === "undefined" || !blockId) {
    return
  }

  const escapedId = globalThis.CSS?.escape ? globalThis.CSS.escape(blockId) : blockId.replace(/"/g, '\\"')
  const elements = document.querySelectorAll<HTMLElement>(`[data-node-id="${escapedId}"]`)
  if (!elements || elements.length === 0) {
    return
  }

  elements.forEach((el) => {
    for (const [key, val] of Object.entries(attrs)) {
      if (val !== undefined && val !== null && val !== "") {
        el.setAttribute(key, String(val))
      } else {
        el.removeAttribute(key)
      }
    }
  })
}

/**
 * 批量同步多个块的 DOM 属性
 */
export function syncBatchDomBlockAttrs(
  items: Array<{ id: string; attrs: Record<string, string | null | undefined> }>,
): void {
  if (typeof document === "undefined" || !Array.isArray(items) || items.length === 0) {
    return
  }

  for (const item of items) {
    if (item.id && item.attrs) {
      syncDomBlockAttrs(item.id, item.attrs)
    }
  }
}
