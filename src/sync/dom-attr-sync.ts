import { ATTR_PAGE_LAYOUT, ATTR_ELEM_ROLE } from "../types/slidev-protocol"

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

/**
 * 彻底巡检并自愈清理 Protyle 编辑区中的陈旧/残留 Slidev DOM 属性与角标
 * 扫描当前所有带有 [custom-slidev-layout] 或 [custom-slidev-role] 的 DOM 节点，
 * 若该节点在权威有效集合中已不存在对应属性（或为空），则立即 removeAttribute 彻底清除。
 *
 * @param validAttrsMap 包含各合法 blockId 及其期望属性的映射表
 */
export function purgeStaleDomSlidevAttrs(
  validAttrsMap: Map<string, Record<string, string>>,
): void {
  if (typeof document === "undefined") {
    return
  }

  const selector = `.protyle-wysiwyg [${ATTR_PAGE_LAYOUT}], .protyle-wysiwyg [${ATTR_ELEM_ROLE}], .protyle-wysiwyg [custom-slidev-layout], .protyle-wysiwyg [custom-slidev-role]`
  const elements = document.querySelectorAll<HTMLElement>(selector)
  if (!elements || elements.length === 0) {
    return
  }

  elements.forEach((el) => {
    const blockId = el.getAttribute("data-node-id")
    if (!blockId) {
      el.removeAttribute(ATTR_PAGE_LAYOUT)
      el.removeAttribute("custom-slidev-layout")
      el.removeAttribute(ATTR_ELEM_ROLE)
      el.removeAttribute("custom-slidev-role")
      return
    }

    const expected = validAttrsMap.get(blockId)

    // 检查 custom-slidev-layout (如旧残留的 image-right)
    const expectedLayout = expected?.[ATTR_PAGE_LAYOUT] || expected?.["custom-slidev-layout"] || ""
    const currentLayout = el.getAttribute(ATTR_PAGE_LAYOUT) || el.getAttribute("custom-slidev-layout")
    if (currentLayout && currentLayout !== expectedLayout) {
      if (expectedLayout) {
        el.setAttribute(ATTR_PAGE_LAYOUT, expectedLayout)
      } else {
        el.removeAttribute(ATTR_PAGE_LAYOUT)
        el.removeAttribute("custom-slidev-layout")
      }
    }

    // 检查 custom-slidev-role (如旧残留的 background)
    const expectedRole = expected?.[ATTR_ELEM_ROLE] || expected?.["custom-slidev-role"] || ""
    const currentRole = el.getAttribute(ATTR_ELEM_ROLE) || el.getAttribute("custom-slidev-role")
    if (currentRole && currentRole !== expectedRole) {
      if (expectedRole) {
        el.setAttribute(ATTR_ELEM_ROLE, expectedRole)
      } else {
        el.removeAttribute(ATTR_ELEM_ROLE)
        el.removeAttribute("custom-slidev-role")
      }
    }
  })
}

