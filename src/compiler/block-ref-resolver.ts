/**
 * 思源块引用 ((block-id "anchor")) 与块嵌入动态展开解析器
 */

export interface IBlockRefInfo {
  fullMatch: string
  blockId: string
  anchorText?: string
}

/**
 * 抽取文本中的所有块引用标记
 */
export function extractBlockRefs(content: string): IBlockRefInfo[] {
  const result: IBlockRefInfo[] = []
  if (!content) return result

  // 匹配 ((20231019123456-abcdef "锚文本")) 或 ((20231019123456-abcdef))
  const regex = /\(\(([0-9a-zA-Z-]+)(?:\s+"([^"]*)")?\)\)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    result.push({
      fullMatch: match[0],
      blockId: match[1],
      anchorText: match[2],
    })
  }

  return result
}

/**
 * 将块引用替换为展开后的引用内容或带样式卡片
 */
export function resolveBlockRefsSync(
  content: string,
  refContentMap?: Record<string, string>,
): string {
  if (!content) return ""

  return content.replace(
    /\(\(([0-9a-zA-Z-]+)(?:\s+"([^"]*)")?\)\)/g,
    (match, blockId, anchor) => {
      // 若缓存中存在源块内容，直接展开并附带引用样式
      if (refContentMap && refContentMap[blockId]) {
        const resolved = refContentMap[blockId]
        return `<div class="slidev-block-ref" data-ref-id="${blockId}">${resolved}</div>`
      }
      // 否则呈现锚文本或备用卡片
      const text = anchor || `Ref(${blockId.slice(0, 8)})`
      return `<span class="slidev-ref-tag" data-ref-id="${blockId}">🔗 ${text}</span>`
    },
  )
}
