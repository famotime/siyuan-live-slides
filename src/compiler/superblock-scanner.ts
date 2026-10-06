import type { ISiYuanBlockNode } from "../types/slidev-protocol"
import {
  ATTR_ELEM_SLOT,
  ATTR_PAGE_LAYOUT,
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

  // 1. 图左模式：首个子块为图片，末尾子块包含非图片内容
  if (firstIsImg && !lastIsImg) {
    const imgUrl = extractImageUrl(contentChildren[0].markdown, contentChildren[0].content)
    if (imgUrl) {
      return {
        imageNode: contentChildren[0],
        imageUrl: imgUrl,
        layout: ROLE_IMAGE_LEFT,
        contentNodes: contentChildren.slice(1),
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
      }
    }
  }

  return null
}

export interface ITagChangeRecord {
  blockId: string
  layout: "image-left" | "image-right"
  previousLayout?: string
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
        const { imageNode, layout } = detected
        if (!imageNode.ial) {
          imageNode.ial = {}
        }

        const currentLayout = imageNode.ial[ATTR_PAGE_LAYOUT]
        if (currentLayout !== layout) {
          const record: ITagChangeRecord = {
            blockId: imageNode.id,
            layout,
            previousLayout: currentLayout,
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
  extractListSuperBlockItems,
  extractListUnits,
  isInvalidListSuperBlock,
  scanAndTagListSuperBlocks,
} from "./list-column-scanner"
import type {
  IExtractedListColumns,
  IListSuperBlockDetection,
  IListSuperBlockTagChange,
  IScanListSuperBlocksResult,
  ITrackedListSuperBlock,
} from "./list-column-scanner"

export {
  collectAllLeafListItems,
  detectListSuperBlock,
  extractListSuperBlockItems,
  extractListUnits,
  isInvalidListSuperBlock,
  scanAndTagListSuperBlocks,
}
export type {
  IExtractedListColumns,
  IListSuperBlockDetection,
  IListSuperBlockTagChange,
  IScanListSuperBlocksResult,
  ITrackedListSuperBlock,
}
