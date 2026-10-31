/**
 * 思源块引用 ((block-id "anchor"))、((block-id 'anchor')) 与块嵌入动态展开解析器
 */

export interface IBlockRefInfo {
  fullMatch: string
  blockId: string
  anchorText?: string
}

/**
 * 匹配思源块引用的通用正则：
 * 1. ((block-id '单引号锚文本')) - 思源笔记官方标准
 * 2. ((block-id "双引号锚文本"))
 * 3. ((block-id 无引号文本))
 * 4. ((block-id)) - 无锚文本
 */
export const BLOCK_REF_REGEX = /\(\(([0-9a-zA-Z-]+)(?:\s*(?:'([^']*)'|"([^"]*)"|([^\)]+?)))?\s*\)\)/g

/**
 * 抽取文本中的所有块引用标记
 */
export function extractBlockRefs(content: string): IBlockRefInfo[] {
  const result: IBlockRefInfo[] = []
  if (!content) return result

  const regex = new RegExp(BLOCK_REF_REGEX.source, "g")
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    const rawAnchor = match[2] ?? match[3] ?? match[4]
    result.push({
      fullMatch: match[0],
      blockId: match[1],
      anchorText: rawAnchor ? rawAnchor.trim() : undefined,
    })
  }

  return result
}

/**
 * 将块引用替换为展开后的引用内容或带样式可交互链接卡片
 */
export function resolveBlockRefsSync(
  content: string,
  refContentMap?: Record<string, string>,
): string {
  if (!content) return ""

  const regex = new RegExp(BLOCK_REF_REGEX.source, "g")
  return content.replace(
    regex,
    (match, blockId, singleAnchor, doubleAnchor, rawAnchor) => {
      const anchor = (singleAnchor ?? doubleAnchor ?? rawAnchor ?? "").trim()

      // 若缓存中存在源块内容，直接展开并附带引用样式
      if (refContentMap && refContentMap[blockId]) {
        const resolved = refContentMap[blockId].trim()
        return `<div class="slides-block-ref" data-ref-id="${blockId}">${resolved}</div>`
      }

      // 否则呈现带有思源跳转协议与数据属性的可点击交互链接
      const text = anchor || `Ref(${blockId.slice(0, 8)})`
      return `<a href="siyuan://blocks/${blockId}" data-ref-id="${blockId}" class="slides-ref-tag">🔗 ${text}</a>`
    },
  )
}

