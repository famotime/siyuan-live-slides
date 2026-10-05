import type { ISiYuanBlockNode } from "../types/slidev-protocol"
import {
  ATTR_ELEM_SLOT,
  ATTR_PAGE_LAYOUT,
  ROLE_IMAGE_LEFT,
  ROLE_IMAGE_RIGHT,
} from "../types/slidev-protocol"
import { isPageBreak } from "./scope-mapper"

/**
 * 从块的 Markdown 文本或纯文本中提取第一张图片的 URL
 */
export function extractImageUrl(markdown?: string, content?: string): string | null {
  const text = (markdown || content || "").trim()
  if (!text) return null

  // 1. Markdown 图片语法: ![alt](url) 或 ![alt](url "title") 或 ![alt](url =widthxheight)
  const mdMatch = text.match(/!\[[\s\S]*?\]\(\s*([^\s)]+)(?:\s+(?:=["']?[^"'\s)]*["']?|["'][^"']*["']))*?\s*\)/)
  if (mdMatch) {
    return mdMatch[1].trim()
  }

  // 2. HTML <img> 标签: <img ... src="url" ...>
  const imgTagMatch = text.match(/<img\b[^>]*?\bsrc=["']([^"']+)["']/i)
  if (imgTagMatch) {
    return imgTagMatch[1].trim()
  }

  // 3. 纯资源文件路径 (如 assets/foo.png 或 https://...)
  const pureUrl = text.replace(/\{:[^}]*\}/g, "").trim()
  if (/^(?:assets\/|https?:\/\/|\/|\.\.?\/)[^\s]+\.(?:png|jpe?g|gif|webp|svg|avif)(?:\?[^\s]*)?$/i.test(pureUrl)) {
    return pureUrl
  }

  return null
}

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
 * 判断是否为列表项块 (NodeListItem 'i' 或 NodeList 'l' 或 Markdown 列表语法)
 */
export function isListItemNode(node: ISiYuanBlockNode): boolean {
  if (!node) return false
  const t = (node.type || "").toLowerCase()
  if (t === "i" || t === "nodelistitem") return true
  if (t === "l" || t === "nodelist") return true
  const md = (node.markdown || node.content || "").trim()
  if (/^(?:[-*+]|\d+\.)\s+/.test(md)) return true
  return false
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

/**
 * 清洗分栏卡片中的首层列表项前缀（剥离开头的 - / * / + / 1. 等，并将首行去标记，后续行去除首层缩进）
 */
export function cleanCardListItemMarkdown(markdown: string): string {
  if (!markdown) return ""
  const lines = markdown.split(/\r?\n/)
  if (lines.length === 0) return ""

  const firstLine = lines[0]
  const firstMatch = firstLine.match(/^(\s*)(?:[-*+]|\d+\.)\s+(.*)$/)
  if (!firstMatch) {
    return markdown
  }

  const baseIndent = firstMatch[1].length
  const firstLineText = firstMatch[2].trim()
  const prefixLength = firstLine.length - firstMatch[2].length

  if (lines.length === 1) {
    return firstLineText
  }

  const resultLines = [firstLineText]
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) {
      resultLines.push("")
      continue
    }

    const spaceMatch = line.match(/^(\s*)/)
    const spaces = spaceMatch ? spaceMatch[1].length : 0

    if (spaces >= prefixLength) {
      resultLines.push(line.slice(prefixLength))
    } else if (spaces > baseIndent) {
      resultLines.push(line.slice(spaces))
    } else {
      resultLines.push(line)
    }
  }

  return resultLines.join("\n")
}

export interface IListSuperBlockDetection {
  superBlockNode: ISiYuanBlockNode
  count: 2 | 3
  layout: "two-cols-header" | "three-cols-header"
  items: ISiYuanBlockNode[]
  slots: string[]
}

/**
 * 检测超级块是否为包含 2 个或 3 个列表项的横向分栏超级块
 */
export function detectListSuperBlock(node: ISiYuanBlockNode): IListSuperBlockDetection | null {
  if (!node || !isSuperBlock(node)) return null
  if (!isHorizontalSuperBlock(node)) return null

  // 排除图文超级块
  if (detectSuperBlockImageLayout(node)) return null

  const contentChildren = getContentChildren(node)
  if (contentChildren.length !== 2 && contentChildren.length !== 3) {
    return null
  }

  // 必须全部子块都是列表项或列表
  if (!contentChildren.every(isListItemNode)) {
    return null
  }

  if (contentChildren.length === 2) {
    return {
      superBlockNode: node,
      count: 2,
      layout: "two-cols-header",
      items: contentChildren,
      slots: ["left", "right"],
    }
  }

  return {
    superBlockNode: node,
    count: 3,
    layout: "three-cols-header",
    items: contentChildren,
    slots: ["col-1", "col-2", "col-3"],
  }
}

/**
 * 检测是否为非 2~3 项的列表超级块（例如拖出后变 1 项，或拖入后变 4+ 项）
 */
export function isInvalidListSuperBlock(
  node: ISiYuanBlockNode,
): { superBlockNode: ISiYuanBlockNode; items: ISiYuanBlockNode[] } | null {
  if (!node || !isSuperBlock(node)) return null
  if (!isHorizontalSuperBlock(node)) return null
  if (detectSuperBlockImageLayout(node)) return null

  const contentChildren = getContentChildren(node)
  if (contentChildren.length === 0 || contentChildren.length === 2 || contentChildren.length === 3) {
    return null
  }

  if (contentChildren.every(isListItemNode)) {
    return {
      superBlockNode: node,
      items: contentChildren,
    }
  }
  return null
}

export interface ITrackedListSuperBlock {
  superBlockId: string
  pageTargetId: string
  headerId?: string
  itemIds: string[]
  layout: "two-cols-header" | "three-cols-header"
}

export interface IListSuperBlockTagChange {
  blockId: string
  attrs: Record<string, string>
  previousAttrs?: Record<string, string>
}

export interface IScanListSuperBlocksResult {
  changes: IListSuperBlockTagChange[]
  newTracked: ITrackedListSuperBlock[]
}

/**
 * 遍历扫描文档块树，为包含 2~3 项列表的超级块自动配置表头双栏/三栏版式及插槽，并支持拖拽重排与边界自愈
 */
export function scanAndTagListSuperBlocks(
  docId: string,
  blocks: ISiYuanBlockNode[],
  options?: {
    tracked?: ITrackedListSuperBlock[]
    onTagChange?: (change: IListSuperBlockTagChange) => void
  },
): IScanListSuperBlocksResult {
  const changes: IListSuperBlockTagChange[] = []
  const newTracked: ITrackedListSuperBlock[] = []
  const prevTrackedList = options?.tracked || []

  // 1. 将 blocks 按幻灯片页面（isPageBreak 分隔）划分作用域
  interface ISlideGroup {
    pageTargetId: string
    blocks: ISiYuanBlockNode[]
  }

  const slideGroups: ISlideGroup[] = []
  let currentGroup: ISlideGroup = {
    pageTargetId: docId,
    blocks: [],
  }
  slideGroups.push(currentGroup)

  for (let i = 0; i < blocks.length; i++) {
    const node = blocks[i]
    if (isPageBreak(node)) {
      if (slideGroups.length === 1 && currentGroup.blocks.length === 0) {
        currentGroup.pageTargetId = node.id
        currentGroup.blocks.push(node)
        continue
      }
      currentGroup = {
        pageTargetId: node.id,
        blocks: [node],
      }
      slideGroups.push(currentGroup)
    } else {
      currentGroup.blocks.push(node)
    }
  }

  function findSuperBlocks(nodes: ISiYuanBlockNode[]): ISiYuanBlockNode[] {
    const list: ISiYuanBlockNode[] = []
    for (const n of nodes) {
      if (isSuperBlock(n)) {
        list.push(n)
      }
      if (n.children && n.children.length > 0) {
        list.push(...findSuperBlocks(n.children))
      }
    }
    return list
  }

  function recordChange(blockId: string, attrs: Record<string, string>, prevAttrs?: Record<string, string>) {
    const rec: IListSuperBlockTagChange = {
      blockId,
      attrs,
      previousAttrs: prevAttrs,
    }
    changes.push(rec)
    if (options?.onTagChange) {
      options.onTagChange(rec)
    }
  }

  // 2. 遍历每个幻灯片页面
  for (const group of slideGroups) {
    const pageTargetId = group.pageTargetId
    const pageTargetNode = blocks.find(b => b.id === pageTargetId)

    let matchedDetection: IListSuperBlockDetection | null = null
    let matchedSbIndex = -1

    for (let i = 0; i < group.blocks.length; i++) {
      const b = group.blocks[i]
      const candidates = isSuperBlock(b) ? [b] : (b.children ? findSuperBlocks(b.children) : [])
      for (const cand of candidates) {
        const det = detectListSuperBlock(cand)
        if (det) {
          matchedDetection = det
          matchedSbIndex = i
          break
        }
      }
      if (matchedDetection) break
    }

    const prevTracked = prevTrackedList.find(t => t.pageTargetId === pageTargetId)

    if (matchedDetection) {
      const { superBlockNode, layout, items, slots } = matchedDetection

      // 寻找表头：超级块之前的第一条标题
      const preBlocks = group.blocks.slice(0, matchedSbIndex)
      const headerNode = preBlocks.find(b => isHeadingBlock(b))
      const headerId = headerNode?.id

      // 2.1 检查并配置页面版式 custom-slidev-layout
      const currentLayout = pageTargetNode?.ial?.[ATTR_PAGE_LAYOUT] || ""
      if (currentLayout !== layout) {
        recordChange(pageTargetId, { [ATTR_PAGE_LAYOUT]: layout }, { [ATTR_PAGE_LAYOUT]: currentLayout })
        if (pageTargetNode?.ial) {
          pageTargetNode.ial[ATTR_PAGE_LAYOUT] = layout
        }
      }

      // 2.2 检查并配置表头 custom-slidev-slot="header"
      if (headerNode) {
        const currentSlot = headerNode.ial?.[ATTR_ELEM_SLOT] || ""
        if (currentSlot !== "header") {
          recordChange(headerNode.id, { [ATTR_ELEM_SLOT]: "header" }, { [ATTR_ELEM_SLOT]: currentSlot })
          if (headerNode.ial) {
            headerNode.ial[ATTR_ELEM_SLOT] = "header"
          }
        }
      }

      // 若之前追踪过其他表头但现在变了，清空原表头的 slot
      if (prevTracked?.headerId && prevTracked.headerId !== headerId) {
        recordChange(prevTracked.headerId, { [ATTR_ELEM_SLOT]: "" })
        const oldH = blocks.find(b => b.id === prevTracked.headerId)
        if (oldH?.ial) {
          oldH.ial[ATTR_ELEM_SLOT] = ""
        }
      }

      // 2.3 检查并按当前顺序配置各列表项的 slot
      const currentItemIds: string[] = []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const expectedSlot = slots[i]
        currentItemIds.push(it.id)
        const currentSlot = it.ial?.[ATTR_ELEM_SLOT] || ""
        if (currentSlot !== expectedSlot) {
          recordChange(it.id, { [ATTR_ELEM_SLOT]: expectedSlot }, { [ATTR_ELEM_SLOT]: currentSlot })
          if (it.ial) {
            it.ial[ATTR_ELEM_SLOT] = expectedSlot
          }
        }
        if (it.children && it.children.length > 0) {
          for (const c of it.children) {
            if (c.ial?.[ATTR_ELEM_SLOT] !== expectedSlot) {
              if (c.ial) c.ial[ATTR_ELEM_SLOT] = expectedSlot
            }
          }
        }
      }

      // 2.4 清理被拖出该超级块的旧列表项
      if (prevTracked?.itemIds) {
        for (const oldId of prevTracked.itemIds) {
          if (!currentItemIds.includes(oldId)) {
            recordChange(oldId, { [ATTR_ELEM_SLOT]: "" })
            const oldNode = blocks.find(b => b.id === oldId)
            if (oldNode?.ial) {
              oldNode.ial[ATTR_ELEM_SLOT] = ""
            }
          }
        }
      }

      newTracked.push({
        superBlockId: superBlockNode.id,
        pageTargetId,
        headerId,
        itemIds: currentItemIds,
        layout,
      })
    } else {
      // 当前页未匹配到 2~3 项列表超级块
      let hasInvalidListSb = false
      const invalidItemsToClear: string[] = []
      for (const b of group.blocks) {
        const inv = isInvalidListSuperBlock(b)
        if (inv) {
          hasInvalidListSb = true
          for (const it of inv.items) {
            invalidItemsToClear.push(it.id)
          }
        }
      }

      const currentLayout = pageTargetNode?.ial?.[ATTR_PAGE_LAYOUT] || ""
      const isMultiColLayout = currentLayout === "two-cols-header" || currentLayout === "three-cols-header"

      if (prevTracked || (hasInvalidListSb && isMultiColLayout)) {
        recordChange(pageTargetId, { [ATTR_PAGE_LAYOUT]: "" }, { [ATTR_PAGE_LAYOUT]: currentLayout })
        if (pageTargetNode?.ial) {
          pageTargetNode.ial[ATTR_PAGE_LAYOUT] = ""
        }

        const hId = prevTracked?.headerId
        if (hId) {
          recordChange(hId, { [ATTR_ELEM_SLOT]: "" })
          const hNode = blocks.find(b => b.id === hId)
          if (hNode?.ial) hNode.ial[ATTR_ELEM_SLOT] = ""
        }

        const itemsToClean = new Set<string>([
          ...(prevTracked?.itemIds || []),
          ...invalidItemsToClear,
        ])
        for (const itId of itemsToClean) {
          recordChange(itId, { [ATTR_ELEM_SLOT]: "" })
          const itNode = blocks.find(b => b.id === itId)
          if (itNode?.ial) itNode.ial[ATTR_ELEM_SLOT] = ""
        }
      }
    }
  }

  return { changes, newTracked }
}
