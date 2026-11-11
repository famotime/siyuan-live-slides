import type { ISiYuanBlockNode } from "../types/slides-protocol"
import {
  ATTR_ELEM_SLOT,
  ATTR_PAGE_LAYOUT,
  isColsHeaderLayout,
} from "../types/slides-protocol"
import { isPageBreak } from "./scope-mapper"
import { isListItemNode } from "../utils/markdown-utils"
import {
  detectSuperBlockImageLayout,
  extractSuperBlockWidthRatios,
  getContentChildren,
  isHeadingBlock,
  isHorizontalSuperBlock,
  isImageBlock,
  isSuperBlock,
} from "./superblock-scanner"

export interface IListSuperBlockDetection {
  superBlockNode: ISiYuanBlockNode
  nestedSuperBlocks?: ISiYuanBlockNode[]
  count: number
  layout: "cols-header" | "two-cols-header" | "three-cols-header"
  items: ISiYuanBlockNode[]
  slots: string[]
  ratio?: string
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

  // 遍历所有子块提取列表单元，自适应 2~N 栏（上限 6 栏）及嵌套形态
  const unitsPerChild: ISiYuanBlockNode[][] = contentChildren.map(extractListUnits)
  if (unitsPerChild.length >= 2 && unitsPerChild.every(u => u.length > 0)) {
    const allUnits = unitsPerChild.flat()
    if (allUnits.length >= 2 && allUnits.length <= 6) {
      return {
        items: allUnits,
        nestedSuperBlocks: nestedSbs,
      }
    }
  }

  // 容错处理：若外层为 2 个子块但内含嵌套形态（如 2 项 + 1 项，或 1 项 + 2 项）
  if (contentChildren.length === 2) {
    const u0 = extractListUnits(contentChildren[0])
    const u1 = extractListUnits(contentChildren[1])

    if (u0.length + u1.length >= 2 && u0.length + u1.length <= 6 && (u0.length > 0 || u1.length > 0)) {
      return {
        items: [...u0, ...u1],
        nestedSuperBlocks: nestedSbs,
      }
    }
  }

  return null
}

/**
 * 检测超级块是否为包含 2~N 个列表项的横向分栏超级块（支持自适应 2~6 栏）
 */
export function detectListSuperBlock(node: ISiYuanBlockNode): IListSuperBlockDetection | null {
  if (!node || !isSuperBlock(node)) return null
  if (!isHorizontalSuperBlock(node)) return null

  // 排除图文超级块
  if (detectSuperBlockImageLayout(node)) return null

  const extracted = extractListSuperBlockItems(node)
  if (!extracted) return null

  const { items, nestedSuperBlocks } = extracted
  if (items.length < 2 || items.length > 6) {
    return null
  }

  const detectedRatio = extractSuperBlockWidthRatios(node) || undefined
  const count = items.length

  return {
    superBlockNode: node,
    nestedSuperBlocks,
    count,
    layout: "cols-header",
    items,
    slots: items.map((_, i) => `col-${i + 1}`),
    ratio: detectedRatio,
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
 * 检测是否为非 2~6 项的列表超级块（例如拖出后仅剩 1 项，或超出 6 栏）
 */
export function isInvalidListSuperBlock(
  node: ISiYuanBlockNode,
): { superBlockNode: ISiYuanBlockNode; items: ISiYuanBlockNode[] } | null {
  if (!node || !isSuperBlock(node)) return null
  if (!isHorizontalSuperBlock(node)) return null
  if (detectSuperBlockImageLayout(node)) return null

  const leaves = collectAllLeafListItems(node)
  if (!leaves || leaves.length === 0) return null

  // 有效项数为 2 到 6 栏时属于有效分栏超级块
  if (leaves.length >= 2 && leaves.length <= 6) {
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
  layout: "cols-header" | "two-cols-header" | "three-cols-header" | "clover"
}

export interface IFourComponentSuperBlockMatch {
  superBlockNode: ISiYuanBlockNode
  items: ISiYuanBlockNode[]
  headerNode?: ISiYuanBlockNode
}

/**
 * 提取超级块中包含的 4 个组件（优先列表项，兼容直接子块）
 */
export function extractFourComponentSuperBlock(node: ISiYuanBlockNode): ISiYuanBlockNode[] | null {
  if (!node || !isSuperBlock(node)) return null
  if (!isHorizontalSuperBlock(node)) return null
  if (detectSuperBlockImageLayout(node)) return null

  // 1. 优先检查列表分栏项 (包括扁平 4 栏及嵌套 2x2 等展开形态)
  const listItemsRes = extractListSuperBlockItems(node)
  if (listItemsRes && listItemsRes.items.length === 4) {
    return listItemsRes.items
  }

  // 2. 检查收集的所有叶子列表项
  const leaves = collectAllLeafListItems(node)
  if (leaves && leaves.length === 4) {
    return leaves
  }

  // 3. 兼容直接包含 4 个有效内容子块的超级块（段落、卡片等）
  const contentChildren = getContentChildren(node)
  if (contentChildren.length === 4) {
    return contentChildren
  }

  return null
}

/**
 * 在给定的页面块列表（或当前幻灯片）中搜索符合条件的“包含 4 个组件的超级块”
 * 优先级：
 * 1. 优先匹配当前焦点所在的超级块 (preferredBlockId)
 * 2. 否则按文档顺序取页面内的第一个匹配项
 */
export function findFourComponentSuperBlockInPage(
  blocks: ISiYuanBlockNode[],
  preferredBlockId?: string,
): IFourComponentSuperBlockMatch | null {
  if (!blocks || blocks.length === 0) return null

  interface ICandidate {
    sbNode: ISiYuanBlockNode
    items: ISiYuanBlockNode[]
    topLevelIndex: number
  }

  const candidates: ICandidate[] = []

  function searchSuperBlocks(node: ISiYuanBlockNode, topIndex: number) {
    if (isSuperBlock(node)) {
      const items = extractFourComponentSuperBlock(node)
      if (items && items.length === 4) {
        candidates.push({ sbNode: node, items, topLevelIndex: topIndex })
      }
    }
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        searchSuperBlocks(child, topIndex)
      }
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    searchSuperBlocks(blocks[i], i)
  }

  if (candidates.length === 0) return null

  // 1. 若指定了 preferredBlockId，检查是否有候选超级块包含该 ID
  let selectedCandidate: ICandidate | null = null
  if (preferredBlockId) {
    selectedCandidate = candidates.find(c => {
      if (c.sbNode.id === preferredBlockId) return true
      if (c.items.some(it => it.id === preferredBlockId)) return true
      const checkDescendant = (n: ISiYuanBlockNode): boolean => {
        if (n.id === preferredBlockId) return true
        if (n.children) {
          return n.children.some(checkDescendant)
        }
        return false
      }
      return checkDescendant(c.sbNode)
    }) || null
  }

  // 2. 若无焦点匹配，取文档顺序第一个
  if (!selectedCandidate) {
    selectedCandidate = candidates[0]
  }

  // 寻找该超级块之前的第一条标题作为表头
  const preBlocks = blocks.slice(0, selectedCandidate.topLevelIndex)
  const headerNode = preBlocks.slice().reverse().find(b => isHeadingBlock(b))

  return {
    superBlockNode: selectedCandidate.sbNode,
    items: selectedCandidate.items,
    headerNode,
  }
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

      // 2.1 检查并配置页面版式 custom-slides-layout
      const currentLayout = pageTargetNode?.ial?.[ATTR_PAGE_LAYOUT] || ""
      const isCurrentClover = currentLayout === "clover"
      const targetLayout = isCurrentClover ? "clover" : layout
      if (currentLayout !== targetLayout) {
        recordChange(pageTargetId, { [ATTR_PAGE_LAYOUT]: targetLayout }, { [ATTR_PAGE_LAYOUT]: currentLayout })
        if (pageTargetNode) {
          if (!pageTargetNode.ial) pageTargetNode.ial = {}
          pageTargetNode.ial[ATTR_PAGE_LAYOUT] = targetLayout
        }
      }

      // 2.1.5 不再自动同步超级块宽度设置到 custom-slides-layout-ratio，改为由用户在面板显式点击「读取」按钮应用

      // 2.2 检查并配置表头 custom-slides-slot="header"
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
        layout: isCurrentClover ? "clover" : layout,
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
      const isMultiColLayout = isColsHeaderLayout(currentLayout)

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
