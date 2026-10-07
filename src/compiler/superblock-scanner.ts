import type { ISiYuanBlockNode } from "../types/slidev-protocol"
import {
  ATTR_ELEM_SLOT,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
  ROLE_IMAGE_LEFT,
  ROLE_IMAGE_RIGHT,
} from "../types/slidev-protocol"
import { isPageBreak } from "./scope-mapper"

import {
  cleanCardListItemMarkdown,
  extractImageUrl,
  isListItemNode,
} from "../utils/markdown-utils"

export { cleanCardListItemMarkdown, extractImageUrl, isListItemNode }

/**
 * 判断一个块节点是否为超级块 (思源内核缩写为 's'，AST 为 'NodeSuperBlock'，兼容 'sb')
 */
export function isSuperBlock(node: ISiYuanBlockNode): boolean {
  if (!node) return false
  const t = (node.type || "").toLowerCase()
  return t === "s" || t === "sb" || t === "nodesuperblock"
}

/**
 * 判断超级块是否为横向分栏超级块
 * 思源官方规范：col 为横向分栏（Horizontal Column），row 为纵向行堆叠（Vertical Row）
 */
export function isHorizontalSuperBlock(node: ISiYuanBlockNode): boolean {
  if (!isSuperBlock(node)) return false

  // 1. 显式 subType 判断：官方规范 col 代表横向分栏，h 代表历史兼容横向；row / v 代表纵向
  const subType = (node.subType || "").toLowerCase()
  if (subType === "col" || subType === "h" || subType === "horizontal") return true
  if (subType === "row" || subType === "v" || subType === "vertical") return false

  // 2. 检查 node.ial 或 DOM 属性 (思源官方: data-sb-layout="col")
  if (node.ial) {
    const layout = (node.ial["data-sb-layout"] || node.ial["layout"] || "").toLowerCase()
    if (layout === "col" || layout === "h") return true
    if (layout === "row" || layout === "v") return false
  }

  // 3. 检查 AST 子节点中是否有 NodeSuperBlockLayoutMarker
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.type === "NodeSuperBlockLayoutMarker" || child.type === "layout-marker") {
        const markerData = (child.content || child.markdown || "").trim().toLowerCase()
        if (markerData === "col" || markerData === "h") return true
        if (markerData === "row" || markerData === "v") return false
      }
    }
  }

  // 4. 检查 Markdown 或 content 开头是否为 {{{col 或 {{{row
  const raw = (node.markdown || node.content || "").trim()
  if (/^\{\{\{col\b/i.test(raw)) return true
  if (/^\{\{\{row\b/i.test(raw)) return false

  // 5. 默认行为：思源中新建分栏超级块默认是横向 col，未明确指定为纵向则视为横向
  return true
}

/**
 * 判断一个块是否主要为图片块
 */
export function isImageBlock(node: ISiYuanBlockNode): boolean {
  if (!node) return false
  // 必须排除列表项、列表与超级块容器，列表项卡片即使内含图片也绝不属于独立图片块
  if (isListItemNode(node) || isSuperBlock(node)) return false

  const imgUrl = extractImageUrl(node.markdown, node.content)
  if (!imgUrl) return false

  // 排除长文章段落中偶然夹带的内联小表情/小图
  const textWithoutImg = (node.markdown || node.content || "")
    .replace(/!\[.*?\]\([^)]+\)/g, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/\{:[^}]*\}/g, "")
    .trim()

  return textWithoutImg.length <= 25
}

export interface ISuperBlockImageLayout {
  imageNode: ISiYuanBlockNode
  imageUrl: string
  layout: "image-left" | "image-right"
  contentNodes: ISiYuanBlockNode[]
  ratio?: string
}

/**
 * 从横向分栏超级块的子块中提取宽度比例配置
 * 思源笔记在用户调整超级块列宽时，会在子块 style 中持久化类似:
 * width: calc(30% - 13.8px); flex: none; 或 width: calc(33.3% - 10px);
 * 如果成功提取，返回归一化比值字符串（如 "1:2", "3:7", "1:2:1" 或 "35:65"）；
 * 若子块均未设置宽度或无法识别，返回 null。
 */
export function extractSuperBlockWidthRatios(node: ISiYuanBlockNode): string | null {
  if (!node || !isSuperBlock(node)) return null
  if (!isHorizontalSuperBlock(node)) return null

  const contentChildren = getContentChildren(node)
  if (!contentChildren || contentChildren.length < 2) return null

  // 提取各直接子块的宽度设置
  const rawPercentages: (number | null)[] = []
  let anyWidthFound = false

  for (const child of contentChildren) {
    const styleStr = (child.ial?.style || (child as any).style || "").trim()
    let pct: number | null = null
    if (styleStr) {
      const calcMatch = styleStr.match(/calc\(\s*([\d.]+)%/i)
      if (calcMatch) {
        pct = parseFloat(calcMatch[1])
      } else {
        const widthMatch = styleStr.match(/(?:^|;|\s)width:\s*([\d.]+)%/i)
        if (widthMatch) {
          pct = parseFloat(widthMatch[1])
        }
      }
    }
    if (pct !== null && !isNaN(pct) && pct > 0) {
      rawPercentages.push(pct)
      anyWidthFound = true
    } else {
      rawPercentages.push(null)
    }
  }

  if (!anyWidthFound) {
    return null
  }

  // 若部分子块有宽度，部分没有，未设置的均分剩余比例（对齐思源 rebalanceSbWidth 逻辑）
  const totalCount = contentChildren.length
  const knownSum = rawPercentages.reduce((acc: number, curr) => acc + (curr || 0), 0)
  const unknownCount = rawPercentages.filter(p => p === null).length
  const remaining = Math.max(0, 100 - knownSum)
  const fillPct = unknownCount > 0 ? remaining / unknownCount : 100 / totalCount

  const finalPercentages = rawPercentages.map(p => (p !== null ? p : fillPct))
  const finalSum = finalPercentages.reduce((a: number, b: number) => a + b, 0)
  if (finalSum <= 0) return null

  // 归一化到 100%
  const normalized = finalPercentages.map(p => (p / finalSum) * 100)

  // 检查经典比值
  if (normalized.length === 2) {
    const [p1] = normalized
    if (p1 >= 48 && p1 <= 52) return "1:1"
    if (p1 >= 31 && p1 <= 35) return "1:2"
    if (p1 >= 65 && p1 <= 69) return "2:1"
    if (p1 >= 28 && p1 <= 32) return "3:7"
    if (p1 >= 68 && p1 <= 72) return "7:3"
    if (p1 >= 38 && p1 <= 42) return "4:6"
    if (p1 >= 58 && p1 <= 62) return "6:4"
    if (p1 >= 23 && p1 <= 27) return "1:3"
    if (p1 >= 73 && p1 <= 77) return "3:1"
    const r1 = Math.round(p1)
    const r2 = 100 - r1
    return `${r1}:${r2}`
  }

  if (normalized.length === 3) {
    const [p1, p2, p3] = normalized
    if (p1 >= 31 && p1 <= 35 && p2 >= 31 && p2 <= 35 && p3 >= 31 && p3 <= 35) return "1:1:1"
    if (p1 >= 23 && p1 <= 27 && p2 >= 48 && p2 <= 52 && p3 >= 23 && p3 <= 27) return "1:2:1"
    if (p1 >= 48 && p1 <= 52 && p2 >= 23 && p2 <= 27 && p3 >= 23 && p3 <= 27) return "2:1:1"
    if (p1 >= 23 && p1 <= 27 && p2 >= 23 && p2 <= 27 && p3 >= 48 && p3 <= 52) return "1:1:2"
    if (p1 >= 18 && p1 <= 22 && p2 >= 58 && p2 <= 62 && p3 >= 18 && p3 <= 22) return "1:3:1"
    const r1 = Math.round(p1)
    const r2 = Math.round(p2)
    const r3 = 100 - r1 - r2
    return `${r1}:${r2}:${r3}`
  }

  return normalized.map(p => Math.round(p)).join(":")
}

/**
 * 检测超级块是否为图文分栏组合（左图右文或左文右图）
 * 仅对横向超级块生效（官方 {{{col 或 data-sb-layout="col"）
 */
export function detectSuperBlockImageLayout(node: ISiYuanBlockNode): ISuperBlockImageLayout | null {
  if (!node || !isSuperBlock(node)) return null

  // 必须是横向超级块，纵向超级块 (row/v) 不作为左右分栏
  if (!isHorizontalSuperBlock(node)) {
    return null
  }

  // 过滤掉思源 AST 中的超级块标记节点 (如 NodeSuperBlockOpenMarker, NodeSuperBlockLayoutMarker, NodeSuperBlockCloseMarker)
  const contentChildren = (node.children || []).filter((c) => {
    const t = c.type || ""
    if (
      t === "NodeSuperBlockOpenMarker" ||
      t === "NodeSuperBlockLayoutMarker" ||
      t === "NodeSuperBlockCloseMarker" ||
      t === "open-marker" ||
      t === "layout-marker" ||
      t === "close-marker"
    ) {
      return false
    }
    const text = (c.markdown || c.content || "").trim()
    if (/^\{\{\{(?:col|row)?\s*$/i.test(text) || text === "}}}") {
      return false
    }
    return true
  })

  if (contentChildren.length < 2) {
    return null
  }

  const firstIsImg = isImageBlock(contentChildren[0])
  const lastIsImg = isImageBlock(contentChildren[contentChildren.length - 1])
  const detectedRatio = extractSuperBlockWidthRatios(node) || undefined

  // 1. 图左模式：首个子块为图片，末尾子块包含非图片内容
  if (firstIsImg && !lastIsImg) {
    const imgUrl = extractImageUrl(contentChildren[0].markdown, contentChildren[0].content)
    if (imgUrl) {
      return {
        imageNode: contentChildren[0],
        imageUrl: imgUrl,
        layout: ROLE_IMAGE_LEFT,
        contentNodes: contentChildren.slice(1),
        ratio: detectedRatio,
      }
    }
  }

  // 2. 图右模式：首个子块为非图片，末尾子块为图片
  if (!firstIsImg && lastIsImg) {
    const imgUrl = extractImageUrl(contentChildren[contentChildren.length - 1].markdown, contentChildren[contentChildren.length - 1].content)
    if (imgUrl) {
      return {
        imageNode: contentChildren[contentChildren.length - 1],
        imageUrl: imgUrl,
        layout: ROLE_IMAGE_RIGHT,
        contentNodes: contentChildren.slice(0, contentChildren.length - 1),
        ratio: detectedRatio,
      }
    }
  }

  return null
}

export interface ITagChangeRecord {
  blockId: string
  layout: "image-left" | "image-right"
  previousLayout?: string
  ratio?: string
}

/**
 * 遍历扫描块树，为图文超级块中的图片自动标记或自适应更新 custom-slidev-layout="image-left" / "image-right"
 */
export function scanAndTagSuperBlocks(
  blocks: ISiYuanBlockNode[],
  onTagChange?: (record: ITagChangeRecord) => void,
): ITagChangeRecord[] {
  const changes: ITagChangeRecord[] = []

  function walk(nodes: ISiYuanBlockNode[]) {
    for (const node of nodes) {
      const detected = detectSuperBlockImageLayout(node)
      if (detected) {
        const { imageNode, layout, ratio } = detected
        if (!imageNode.ial) {
          imageNode.ial = {}
        }

        const currentLayout = imageNode.ial[ATTR_PAGE_LAYOUT]
        const needLayoutUpdate = currentLayout !== layout

        if (needLayoutUpdate) {
          const record: ITagChangeRecord = {
            blockId: imageNode.id,
            layout,
            previousLayout: currentLayout,
            ratio,
          }
          imageNode.ial[ATTR_PAGE_LAYOUT] = layout
          changes.push(record)
          if (onTagChange) {
            onTagChange(record)
          }
        }
      }

      if (node.children && node.children.length > 0) {
        walk(node.children)
      }
    }
  }

  walk(blocks)
  return changes
}

/**
 * 过滤超级块内部标记节点并提取有效内容子块
 */
export function getContentChildren(node: ISiYuanBlockNode): ISiYuanBlockNode[] {
  return (node.children || []).filter((c) => {
    const t = c.type || ""
    if (
      t === "NodeSuperBlockOpenMarker" ||
      t === "NodeSuperBlockLayoutMarker" ||
      t === "NodeSuperBlockCloseMarker" ||
      t === "open-marker" ||
      t === "layout-marker" ||
      t === "close-marker"
    ) {
      return false
    }
    const text = (c.markdown || c.content || "").trim()
    if (/^\{\{\{(?:col|row)?\s*$/i.test(text) || text === "}}}") {
      return false
    }
    return true
  })
}

/**
 * 判断是否为标题块 (NodeHeading 'h' 或 h1~h6 或 Markdown # 标题)
 */
export function isHeadingBlock(node: ISiYuanBlockNode): boolean {
  if (!node) return false
  const t = (node.type || "").toLowerCase()
  if (t === "h" || t === "nodeheading") return true
  if (/^h[1-6]$/i.test(node.subType || "")) return true
  const md = (node.markdown || node.content || "").trim()
  if (/^#{1,6}\s+/.test(md)) return true
  return false
}

import {
  collectAllLeafListItems,
  detectListSuperBlock,
  extractFourComponentSuperBlock,
  extractListSuperBlockItems,
  extractListUnits,
  findFourComponentSuperBlockInPage,
  isInvalidListSuperBlock,
  scanAndTagListSuperBlocks,
} from "./list-column-scanner"
import type {
  IExtractedListColumns,
  IFourComponentSuperBlockMatch,
  IListSuperBlockDetection,
  IListSuperBlockTagChange,
  IScanListSuperBlocksResult,
  ITrackedListSuperBlock,
} from "./list-column-scanner"

export {
  collectAllLeafListItems,
  detectListSuperBlock,
  extractFourComponentSuperBlock,
  extractListSuperBlockItems,
  extractListUnits,
  findFourComponentSuperBlockInPage,
  isInvalidListSuperBlock,
  scanAndTagListSuperBlocks,
}
export type {
  IExtractedListColumns,
  IFourComponentSuperBlockMatch,
  IListSuperBlockDetection,
  IListSuperBlockTagChange,
  IScanListSuperBlocksResult,
  ITrackedListSuperBlock,
}
