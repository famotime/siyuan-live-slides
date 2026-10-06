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

export interface IListSuperBlockDetection {
  superBlockNode: ISiYuanBlockNode
  nestedSuperBlocks?: ISiYuanBlockNode[]
  count: 2 | 3
  layout: "two-cols-header" | "three-cols-header"
  items: ISiYuanBlockNode[]
  slots: string[]
}

export interface IExtractedListColumns {
  items: ISiYuanBlockNode[]
  nestedSuperBlocks: ISiYuanBlockNode[]
}

/**
 * 递归展开提取单个分栏容器中的独立列表项单元
 * 1. 若为横向超级块，递归提取其各栏单元
 * 2. 若为 NodeList (l) 且包含多个子列表项（AST 子节点或多行 Markdown 列表项），拆分提取各子列表项
 * 3. 否则若自身为单个列表项，作为单项返回
 */
export function extractListUnits(node: ISiYuanBlockNode): ISiYuanBlockNode[] {
  if (!node) return []

  // 1. 横向超级块递归展开
  if (isSuperBlock(node) && isHorizontalSuperBlock(node) && !detectSuperBlockImageLayout(node)) {
    const ch = getContentChildren(node)
    const units: ISiYuanBlockNode[] = []
    for (const c of ch) {
      units.push(...extractListUnits(c))
    }
    return units
  }

  // 2. 检查是否为包含多个列表项的列表容器 (NodeList 'l')
  const t = (node.type || "").toLowerCase()
  const isListContainer = t === "l" || t === "nodelist" || t === "list"
  if (isListContainer) {
    if (node.children && node.children.length > 0) {
      const listChildren = node.children.filter(isListItemNode)
      if (listChildren.length > 0) {
        return listChildren
      }
    }

    // 容错：若 AST children 未填充，检查 Markdown 是否包含多个列表顶格项
    const md = (node.markdown || node.content || "").trim()
    const lines = md.split(/\r?\n/)
    const itemStartIndices: number[] = []
    for (let i = 0; i < lines.length; i++) {
      if (/^(?:[-*+]|\d+\.)\s+/.test(lines[i])) {
        itemStartIndices.push(i)
      }
    }
    if (itemStartIndices.length >= 2) {
      const splitItems: ISiYuanBlockNode[] = []
      for (let k = 0; k < itemStartIndices.length; k++) {
        const start = itemStartIndices[k]
        const end = k + 1 < itemStartIndices.length ? itemStartIndices[k + 1] : lines.length
        const chunkMd = lines.slice(start, end).join("\n")
        splitItems.push({
          id: `${node.id}-item-${k + 1}`,
          type: "i",
          markdown: chunkMd,
          content: chunkMd,
          ial: { ...(node.ial || {}) },
        })
      }
      return splitItems
    }
  }

  // 3. 单个列表项或单列表
  if (isListItemNode(node)) {
    return [node]
  }

  return []
}

/**
 * 递归展开并提取超级块内的逻辑列表分栏项
 * 支持以下形态：
 * 1. 扁平 2 栏：[Item1, Item2]
 * 2. 扁平 3 栏：[Item1, Item2, Item3]
 * 3. 嵌套形态 A (col1-2 + col3)：外层 [内层横向超级块(Item1, Item2), Item3] 或 [包含2项的列表, 1项列表]
 * 4. 嵌套形态 B (col1 + col2-3)：外层 [Item1, 内层横向超级块(Item2, Item3)] 或 [1项列表, 包含2项的列表]
 * 5. 单子块冗余超级块包装解包
 */
export function extractListSuperBlockItems(node: ISiYuanBlockNode): IExtractedListColumns | null {
  if (!node || !isSuperBlock(node)) return null
  if (!isHorizontalSuperBlock(node)) return null

  // 排除图文超级块
  if (detectSuperBlockImageLayout(node)) return null

  const contentChildren = getContentChildren(node)
  if (contentChildren.length === 0) return null

  // 单子块冗余包装解包
  if (contentChildren.length === 1 && isSuperBlock(contentChildren[0]) && isHorizontalSuperBlock(contentChildren[0])) {
    const innerRes = extractListSuperBlockItems(contentChildren[0])
    if (innerRes) {
      return {
        items: innerRes.items,
        nestedSuperBlocks: [contentChildren[0], ...innerRes.nestedSuperBlocks],
      }
    }
    return null
  }

  // 收集内层嵌套的所有超级块节点用于追踪
  const nestedSbs: ISiYuanBlockNode[] = []
  for (const c of contentChildren) {
    if (isSuperBlock(c)) {
      nestedSbs.push(c)
      const subSbs = c.children?.filter(isSuperBlock) || []
      nestedSbs.push(...subSbs)
    }
  }

  // 1. 若直接包含 3 个有效子块
  if (contentChildren.length === 3) {
    const u0 = extractListUnits(contentChildren[0])
    const u1 = extractListUnits(contentChildren[1])
    const u2 = extractListUnits(contentChildren[2])
    if (u0.length === 1 && u1.length === 1 && u2.length === 1) {
      return {
        items: [u0[0], u1[0], u2[0]],
        nestedSuperBlocks: nestedSbs,
      }
    }
  }

  // 2. 若直接包含 2 个有效子块
  if (contentChildren.length === 2) {
    const u0 = extractListUnits(contentChildren[0])
    const u1 = extractListUnits(contentChildren[1])

    // 形态 A (col1-2 + col3): 前列展开为 2 项，后列为 1 项 -> 3 栏！
    if (u0.length === 2 && u1.length === 1) {
      return {
        items: [u0[0], u0[1], u1[0]],
        nestedSuperBlocks: nestedSbs,
      }
    }

    // 形态 B (col1 + col2-3): 前列为 1 项，后列展开为 2 项 -> 3 栏！
    if (u0.length === 1 && u1.length === 2) {
      return {
        items: [u0[0], u1[0], u1[1]],
        nestedSuperBlocks: nestedSbs,
      }
    }

    // 扁平 2 栏: 前列为 1 项，后列为 1 项 -> 2 栏！
    if (u0.length === 1 && u1.length === 1) {
      return {
        items: [u0[0], u1[0]],
        nestedSuperBlocks: nestedSbs,
      }
    }
  }

  return null
}

/**
 * 检测超级块是否为包含 2 个或 3 个列表项的横向分栏超级块（支持扁平及嵌套形态）
 */
export function detectListSuperBlock(node: ISiYuanBlockNode): IListSuperBlockDetection | null {
  if (!node || !isSuperBlock(node)) return null
  if (!isHorizontalSuperBlock(node)) return null

  // 排除图文超级块
  if (detectSuperBlockImageLayout(node)) return null

  const extracted = extractListSuperBlockItems(node)
  if (!extracted) return null

  const { items, nestedSuperBlocks } = extracted
  if (items.length !== 2 && items.length !== 3) {
    return null
  }

  if (items.length === 2) {
    return {
      superBlockNode: node,
      nestedSuperBlocks,
      count: 2,
      layout: "two-cols-header",
      items,
      slots: ["left", "right"],
    }
  }

  return {
    superBlockNode: node,
    nestedSuperBlocks,
    count: 3,
    layout: "three-cols-header",
    items,
    slots: ["col-1", "col-2", "col-3"],
  }
}

/**
 * 递归收集超级块及其子超级块中的所有列表项叶子节点
 * 若包含非列表项且非横向超级块的其它内容块（如普通段落、表格等），返回 null
 */
export function collectAllLeafListItems(node: ISiYuanBlockNode): ISiYuanBlockNode[] | null {
  if (!node || !isSuperBlock(node)) return null
  if (!isHorizontalSuperBlock(node)) return null
  if (detectSuperBlockImageLayout(node)) return null

  const contentChildren = getContentChildren(node)
  if (contentChildren.length === 0) return null

  const leaves: ISiYuanBlockNode[] = []
  for (const child of contentChildren) {
    const units = extractListUnits(child)
    if (units.length === 0) {
      return null
    }
    leaves.push(...units)
  }
  return leaves
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

  const leaves = collectAllLeafListItems(node)
  if (!leaves || leaves.length === 0) return null

  // 有效项数为 2 或 3 时不属于无效超级块
  if (leaves.length === 2 || leaves.length === 3) {
    return null
  }

  return {
    superBlockNode: node,
    items: leaves,
  }
}

export interface ITrackedListSuperBlock {
  superBlockId: string
  nestedSuperBlockIds?: string[]
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
    const prevTracked = prevTrackedList.find(t => t.pageTargetId === pageTargetId)

    // 检查当前页面是否属于顶层图文分栏版式 (image-left / image-right)
    // 依据用户决策仲裁原则：若外层为图文超级块，外层管页面版式，内层管局部双栏，不与表头多栏版式冲突
    const hasTopLevelImageLayout = group.blocks.some((b) => {
      if (detectSuperBlockImageLayout(b)) return true
      if (
        isImageBlock(b) &&
        (b.ial?.[ATTR_PAGE_LAYOUT] === "image-left" || b.ial?.[ATTR_PAGE_LAYOUT] === "image-right")
      ) {
        return true
      }
      return false
    })

    if (hasTopLevelImageLayout) {
      if (prevTracked) {
        const hId = prevTracked.headerId
        if (hId) {
          recordChange(hId, { [ATTR_ELEM_SLOT]: "" })
          const hNode = blocks.find(b => b.id === hId)
          if (hNode?.ial) hNode.ial[ATTR_ELEM_SLOT] = ""
        }
        for (const itId of prevTracked.itemIds) {
          recordChange(itId, { [ATTR_ELEM_SLOT]: "" })
          const itNode = blocks.find(b => b.id === itId)
          if (itNode?.ial) itNode.ial[ATTR_ELEM_SLOT] = ""
        }
      }
      continue
    }

    let matchedDetection: IListSuperBlockDetection | null = null
    let matchedSbIndex = -1

    for (let i = 0; i < group.blocks.length; i++) {
      const b = group.blocks[i]
      const candidates = isSuperBlock(b)
        ? [b, ...findSuperBlocks(b.children || [])]
        : (b.children ? findSuperBlocks(b.children) : [])
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
        if (pageTargetNode) {
          if (!pageTargetNode.ial) pageTargetNode.ial = {}
          pageTargetNode.ial[ATTR_PAGE_LAYOUT] = layout
        }
      }

      // 2.2 检查并配置表头 custom-slidev-slot="header"
      if (headerNode) {
        const currentSlot = headerNode.ial?.[ATTR_ELEM_SLOT] || ""
        if (currentSlot !== "header") {
          recordChange(headerNode.id, { [ATTR_ELEM_SLOT]: "header" }, { [ATTR_ELEM_SLOT]: currentSlot })
          if (!headerNode.ial) {
            headerNode.ial = {}
          }
          headerNode.ial[ATTR_ELEM_SLOT] = "header"
        }
      }

      // 若之前追踪过其他表头但现在变了，清空原表头的 slot
      if (prevTracked?.headerId && prevTracked.headerId !== headerId) {
        recordChange(prevTracked.headerId, { [ATTR_ELEM_SLOT]: "" })
        const oldH = blocks.find(b => b.id === prevTracked.headerId)
        if (oldH) {
          if (!oldH.ial) oldH.ial = {}
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
          if (!it.ial) {
            it.ial = {}
          }
          it.ial[ATTR_ELEM_SLOT] = expectedSlot
        }
        if (it.children && it.children.length > 0) {
          for (const c of it.children) {
            if (!c.ial) c.ial = {}
            if (c.ial[ATTR_ELEM_SLOT] !== expectedSlot) {
              c.ial[ATTR_ELEM_SLOT] = expectedSlot
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
            if (oldNode) {
              if (!oldNode.ial) oldNode.ial = {}
              oldNode.ial[ATTR_ELEM_SLOT] = ""
            }
          }
        }
      }

      newTracked.push({
        superBlockId: superBlockNode.id,
        nestedSuperBlockIds: matchedDetection.nestedSuperBlocks?.map(n => n.id),
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
        const sbs = isSuperBlock(b)
          ? [b, ...findSuperBlocks(b.children || [])]
          : (b.children ? findSuperBlocks(b.children) : [])
        for (const cand of sbs) {
          const inv = isInvalidListSuperBlock(cand)
          if (inv) {
            hasInvalidListSb = true
            for (const it of inv.items) {
              invalidItemsToClear.push(it.id)
            }
          }
        }
      }

      const currentLayout = pageTargetNode?.ial?.[ATTR_PAGE_LAYOUT] || ""
      const isMultiColLayout = currentLayout === "two-cols-header" || currentLayout === "three-cols-header"

      if (prevTracked || (hasInvalidListSb && isMultiColLayout)) {
        recordChange(pageTargetId, { [ATTR_PAGE_LAYOUT]: "" }, { [ATTR_PAGE_LAYOUT]: currentLayout })
        if (pageTargetNode) {
          if (!pageTargetNode.ial) pageTargetNode.ial = {}
          pageTargetNode.ial[ATTR_PAGE_LAYOUT] = ""
        }

        const hId = prevTracked?.headerId
        if (hId) {
          recordChange(hId, { [ATTR_ELEM_SLOT]: "" })
          const hNode = blocks.find(b => b.id === hId)
          if (hNode) {
            if (!hNode.ial) hNode.ial = {}
            hNode.ial[ATTR_ELEM_SLOT] = ""
          }
        }

        const itemsToClean = new Set<string>([
          ...(prevTracked?.itemIds || []),
          ...invalidItemsToClear,
        ])
        for (const itId of itemsToClean) {
          recordChange(itId, { [ATTR_ELEM_SLOT]: "" })
          const itNode = blocks.find(b => b.id === itId)
          if (itNode) {
            if (!itNode.ial) itNode.ial = {}
            itNode.ial[ATTR_ELEM_SLOT] = ""
          }
        }
      }
    }
  }

  return { changes, newTracked }
}
