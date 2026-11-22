import { getBlockAttrs, getChildBlocks, getDocBlocksOrders, getInlineStyles, setBlockAttrs, sql } from "../api"
import { parseKramdownIAL } from "./ast-crawler"
import { extractBlockRefs } from "./block-ref-resolver"
import { buildSlidesDocument } from "./slides-ast-builder"
import { generateCompleteSiYuanThemeCss } from "./theme-styles-generator"
import {
  isSuperBlock,
  scanAndTagSuperBlocks,
  scanAndTagListSuperBlocks,
  ITrackedListSuperBlock,
} from "./superblock-scanner"
import type { ISiYuanBlockNode, ISlidesDocument } from "../types/slides-protocol"
import { ATTR_PAGE_LAYOUT } from "../types/slides-protocol"

/**
 * 辅助解析思源数据库中的 IAL 字段文本为键值对字典（复用 parseKramdownIAL 保持一致性）
 */
export const parseIALString = parseKramdownIAL

/** 索引行是否为容器块（其 content/markdown 为整棵子树的序列化） */
function isContainerRow(row: any): boolean {
  const t = String(row?.type || "").toLowerCase()
  return (
    t === "s" || t === "sb" || t === "nodesuperblock" ||
    t === "l" || t === "nodelist" ||
    t === "i" || t === "nodelistitem" ||
    t === "b" || t === "nodeblockquote"
  )
}

/**
 * 索引内容可用性判定（不涉及顺序：同层顺序一律由实时文档序决定）
 *
 * 背景：内核 SQL 索引异步落库（kernel/sql/queue.go 的 time.AfterFunc(50ms) + 索引队列），
 * 会短暂滞后于实时块树；且容器块的 content/markdown 是整棵子树的序列化，容器行滞后即意味着
 * 该子树的内容不可信。
 *
 * 处置原则：只重建"确实滞后"的子树，而不是整体放弃索引——
 * - 叶子顶层块滞后 → 用实时值就地修正（其下无子树）
 * - 容器顶层块滞后 → 仅对该子树递归走实时 getChildBlocks 重建（代价 = 该子树的容器数）
 * - 实时顶层块不在索引中 → 由调用方按实时数据补齐（新增块）
 * 这样单次编译的内核往返仍为常数级 + 变更子树的容器数，而非全文档容器数。
 */
export interface IIndexContentDecision {
  /** false 表示索引完全不可用（如无行），调用方应回退全量实时路径 */
  usable: boolean
  reason: string
  /** 叶子顶层块的实时内容修正 */
  leafPatch: Map<string, { content: string; markdown: string }>
  /** 内容滞后、需按子树实时重建的顶层容器块 id */
  rebuildRoots: string[]
}

export function analyzeIndexContent(
  liveTopBlocks: any[],
  indexRows: any[],
): IIndexContentDecision {
  const leafPatch = new Map<string, { content: string; markdown: string }>()
  const rebuildRoots: string[] = []
  if (!Array.isArray(indexRows) || indexRows.length === 0) {
    return { usable: false, reason: "索引无行", leafPatch, rebuildRoots }
  }

  const rowById = new Map<string, any>()
  for (const row of indexRows) {
    if (row?.id) {
      rowById.set(row.id, row)
    }
  }

  for (const live of liveTopBlocks || []) {
    if (!live?.id) continue
    const row = rowById.get(live.id)
    if (!row) {
      // 索引中缺失（新增块）：由调用方按实时数据补齐，不属于陈旧
      continue
    }
    const liveContent = live.content ?? ""
    const liveMarkdown = live.markdown ?? ""
    if ((row.content ?? "") === liveContent && (row.markdown ?? "") === liveMarkdown) {
      continue
    }
    if (isContainerRow(row)) {
      rebuildRoots.push(live.id)
    } else {
      leafPatch.set(live.id, { content: liveContent, markdown: liveMarkdown })
    }
  }

  return { usable: true, reason: "", leafPatch, rebuildRoots }
}

export interface IDocumentCompilerDeps {
  getBlockAttrs: (id: string) => Promise<Record<string, string>>
  getChildBlocks: (id: string) => Promise<any[]>
  /** 文档内块 id 的文档顺序（实时，来自 /api/block/getDocBlocksOrders） */
  getDocBlocksOrders?: (id: string) => Promise<string[]>
  setBlockAttrs?: (id: string, attrs: Record<string, string>) => Promise<any>
  sql: (query: string) => Promise<any[]>
  getBaseUrl?: () => string
  getInlineStyles?: () => Promise<any>
}

/** 标题块类型判定（内核索引 parent_id 覆写规则的依据） */
function isHeadingRow(row: any): boolean {
  const t = String(row?.type || "").toLowerCase()
  return t === "h" || t === "nodeheading"
}

/**
 * 容器块判定：与既有逐容器 getChildBlocks 递归保持完全一致的判定集合
 * 表格（t）、标题（h）等不在其中，故其子块不会被挂载，避免改变既有渲染结构
 */
function isContainerNode(node: ISiYuanBlockNode): boolean {
  return (
    isSuperBlock(node) ||
    node.type === "l" ||
    node.type === "NodeList" ||
    node.type === "i" ||
    node.type === "NodeListItem" ||
    node.type === "b" ||
    node.type === "NodeBlockquote"
  )
}

export interface IIndexTreeResult {
  topLevel: ISiYuanBlockNode[]
  byId: Map<string, ISiYuanBlockNode>
}

/**
 * 由整篇文档的 SQL 索引行一次性构建块树（取代逐容器 getChildBlocks 的 N+1 内核往返）
 *
 * 层级语义对齐说明：内核索引（kernel/sql/database.go 的 buildBlockFromNode）会把处于标题块下方的块
 * 的 parent_id 覆写为最近的标题祖先（treenode.HeadingParent），而 getChildBlocks 对非标题容器返回的是
 * AST 直接子节点。此处按"沿标题父级上提"还原，使标题章节内的块与其兄弟一样归属到标题的父级，
 * 与既有结构完全一致（标题不被当作容器）。
 */
export function buildBlockTreeFromIndex(
  docId: string,
  rows: any[],
  resolveIal: (id: string, rowIal?: string) => Record<string, string>,
  maxDepth = 8,
  orderIndex?: Map<string, number>,
): IIndexTreeResult {
  const rowById = new Map<string, any>()
  for (const row of rows) {
    if (row?.id) {
      rowById.set(row.id, row)
    }
  }

  const makeNode = (row: any): ISiYuanBlockNode => ({
    id: row.id,
    parent_id: row.parent_id,
    root_id: row.root_id || docId,
    type: row.type,
    // 内核 blocks 表列名为 subtype（kernel/sql/database.go），此处兼容 API 侧的 subType
    subType: row.subtype ?? row.subType ?? "",
    content: row.content || "",
    markdown: row.markdown || "",
    ial: resolveIal(row.id, row.ial),
    children: [],
  })

  const effectiveParentId = (row: any): string => {
    let parentId = row.parent_id
    let guard = 0
    while (parentId && parentId !== docId && guard++ < 16) {
      const parentRow = rowById.get(parentId)
      if (!parentRow || !isHeadingRow(parentRow)) {
        return parentId
      }
      parentId = parentRow.parent_id
    }
    return parentId || docId
  }

  const childrenByParent = new Map<string, any[]>()
  for (const row of rows) {
    if (!row?.id || row.id === docId) {
      continue
    }
    // 实时文档序可用时以其为成员权威：不在其中的行是索引残留（已删除块），必须剔除
    if (orderIndex && orderIndex.size > 0 && !orderIndex.has(row.id)) {
      continue
    }
    const parentId = effectiveParentId(row)
    const bucket = childrenByParent.get(parentId)
    if (bucket) {
      bucket.push(row)
    } else {
      childrenByParent.set(parentId, [row])
    }
  }

  // 同层兄弟顺序以实时文档序为准（SQL 的 sort 列是块类型权重、created 为秒级，均不可作位置）
  if (orderIndex && orderIndex.size > 0) {
    for (const bucket of childrenByParent.values()) {
      bucket.sort(
        (a, b) =>
          (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      )
    }
  }

  const byId = new Map<string, ISiYuanBlockNode>()
  const attach = (row: any, depth: number): ISiYuanBlockNode => {
    const node = makeNode(row)
    byId.set(node.id, node)
    if (depth >= maxDepth || !isContainerNode(node)) {
      return node
    }
    const childRows = childrenByParent.get(node.id)
    if (childRows && childRows.length > 0) {
      node.children = childRows.map((child) => attach(child, depth + 1))
    }
    return node
  }

  const topRows = childrenByParent.get(docId) || []
  return { topLevel: topRows.map((row) => attach(row, 0)), byId }
}

const defaultDeps: IDocumentCompilerDeps = {
  getBlockAttrs,
  getChildBlocks,
  getDocBlocksOrders,
  setBlockAttrs,
  sql,
  getBaseUrl: () => (typeof location !== "undefined" ? location.origin : ""),
  getInlineStyles,
}

/**
 * 文档编译编排服务：从思源笔记拉取块与 IAL、解析关联引用并构建 Slidev 虚拟文档模型
 */
export class DocumentCompilerService {
  private deps: IDocumentCompilerDeps
  private attrOverrides = new Map<string, Record<string, string>>()
  private trackedListSuperBlocks = new Map<string, ITrackedListSuperBlock[]>()
  /** 诊断：已提示过"索引树回退"的文档 id，避免持续编辑时刷屏 */
  private fallbackWarnedDocId = ""

  constructor(deps?: Partial<IDocumentCompilerDeps>) {
    this.deps = {
      ...defaultDeps,
      ...(deps || {}),
    }
  }

  /**
   * 写入块属性的即时覆盖缓存 (毫秒级解决思源后台 SQLite 异步落库延迟)
   */
  public setBlockAttrOverride(id: string, attrs: Record<string, string | null | undefined>): void {
    if (!id || !attrs) return
    const existing = this.attrOverrides.get(id) || {}
    const updated = { ...existing }
    for (const [k, v] of Object.entries(attrs)) {
      if (v === "" || v === null || v === undefined) {
        delete updated[k]
      } else {
        updated[k] = String(v)
      }
    }
    if (Object.keys(updated).length === 0) {
      this.attrOverrides.delete(id)
    } else {
      this.attrOverrides.set(id, updated)
    }
  }

  /**
   * 获取块属性的即时覆盖缓存
   */
  public getBlockAttrOverride(id: string): Record<string, string> | undefined {
    return this.attrOverrides.get(id)
  }

  /**
   * 获取所有即时覆盖层缓存快照
   */
  public getAllAttrOverrides(): Map<string, Record<string, string>> {
    return new Map(this.attrOverrides)
  }

  /**
   * 获取某篇文档已自动跟踪的列表超级块状态
   */
  public getTrackedListSuperBlocks(docId: string): ITrackedListSuperBlock[] {
    return this.trackedListSuperBlocks.get(docId) || []
  }

  /**
   * 清除特定块或属性的即时覆盖缓存
   */
  public clearBlockAttrOverride(id: string, key?: string): void {
    if (!id) return
    if (!key) {
      this.attrOverrides.delete(id)
      return
    }
    const existing = this.attrOverrides.get(id)
    if (existing) {
      delete existing[key]
      if (Object.keys(existing).length === 0) {
        this.attrOverrides.delete(id)
      }
    }
  }

  /**
   * 清除所有即时覆盖缓存与追踪状态
   */
  public clearAllOverrides(): void {
    this.attrOverrides.clear()
    this.trackedListSuperBlocks.clear()
  }

  public async compile(docId: string): Promise<ISlidesDocument> {
    try {
      // 1. 获取文档属性并注入即时覆盖缓存
      const docAttrs = (await this.deps.getBlockAttrs(docId).catch(() => ({}))) || {}
      const docOverride = this.attrOverrides.get(docId)
      if (docOverride) {
        Object.assign(docAttrs, docOverride)
      }

      // 2. 获取文档顶层块：getChildBlocks 返回实时、权威的顶层顺序（1 次内核调用）
      const liveTopBlocks: any[] = (await this.deps.getChildBlocks(docId).catch(() => [])) || []

      // 2.1 获取文档内块 id 的实时文档序（1 次内核调用）
      //     同层兄弟顺序必须以此为准：SQL blocks 表的 sort 是块类型权重、created 为秒级，均非位置，
      //     直接按它们排序会导致超级块分栏等内容错位（编辑时还会因索引行重写而跳变）
      const liveOrders: string[] = this.deps.getDocBlocksOrders
        ? ((await this.deps.getDocBlocksOrders(docId).catch(() => [])) || [])
        : []
      const orderIndex = new Map<string, number>()
      for (let i = 0; i < liveOrders.length; i++) {
        if (liveOrders[i]) {
          orderIndex.set(liveOrders[i], i)
        }
      }
      const orderIndexReady = orderIndex.size > 0

      // 3. P1 优化：一次性拉取整篇文档的块索引行（含结构所需的 parent_id/type/subtype 与 IAL），
      //    取代此前对每个容器块逐次调用 getChildBlocks 的 N+1 内核往返（单次编译由 O(容器数) 次降为常数次）
      //    列名以 kernel/sql/database.go 的 blocks 表定义为准（subtype）
      //
      //    关键约束：内核 SQL 索引是**异步批量落库**的（kernel/sql/queue.go 中 time.AfterFunc(50ms) +
      //    索引队列），即最终一致，会短暂滞后于实时块树。若直接采用索引行渲染，编辑后首帧会拿到旧内容
      //    （表现为预览"慢一步"）。因此这里做内容级新鲜度校验：任一顶层块的实时 content/markdown 与
      //    索引行不一致即判定滞后——容器的 markdown 为其整棵子树的序列化，故文档内任何改动都必然
      //    反映到某个顶层块上，该校验可覆盖嵌套改动。
      //    滞后时先重试索引（代价远低于逐容器查询），仍滞后才回退实时路径，保证正确性不依赖索引。
      const indexQuery = `SELECT id, parent_id, root_id, type, subtype, content, markdown, ial, sort, created FROM blocks WHERE root_id = '${docId}' AND id != '${docId}' ORDER BY sort ASC, created ASC LIMIT 99999`
      const indexRows: any[] = (await this.deps.sql(indexQuery).catch(() => [])) || []
      const decision = analyzeIndexContent(liveTopBlocks, indexRows)

      // 3.1 由索引行构建 IAL 字典
      const ialMapById = new Map<string, Record<string, string>>()
      if (Array.isArray(indexRows)) {
        for (const row of indexRows) {
          if (row.id && row.ial) {
            ialMapById.set(row.id, parseIALString(row.ial))
          }
        }
      }

      // 3.2 联合查询 attributes 表：仅检索块级自定义属性 (type = 'b')，严禁混入行内标记属性 (type = 's')
      const attrQuery = `SELECT block_id, name, value FROM attributes WHERE root_id = '${docId}' AND type = 'b' LIMIT 99999`
      const attrRows = (await this.deps.sql(attrQuery).catch(() => [])) || []
      if (Array.isArray(attrRows)) {
        for (const row of attrRows) {
          if (row.block_id && row.name) {
            let m = ialMapById.get(row.block_id)
            if (!m) {
              m = {}
              ialMapById.set(row.block_id, m)
            }
            m[row.name] = row.value || ""
          }
        }
      }

      // 4. 解析单个块的 IAL（数据库 IAL + 即时覆盖层）
      const resolveIal = (id: string, rowIal?: string): Record<string, string> => {
        const ialMap: Record<string, string> = {
          ...(ialMapById.get(id) || (rowIal ? parseIALString(rowIal) : {})),
        }
        const override = this.attrOverrides.get(id)
        if (override) {
          Object.assign(ialMap, override)
        }
        return ialMap
      }

      // 5. 建树：结构（父子关系）取自索引行，同层顺序取自实时文档序；
      //    索引滞后的部分只重建对应子树（见 analyzeIndexContent），不做全量回退
      const indexTree = Array.isArray(indexRows) && indexRows.length > 0
        ? buildBlockTreeFromIndex(docId, indexRows, resolveIal, 8, orderIndex)
        : null

      const liveTopIds = liveTopBlocks.map((b: any) => b.id).filter(Boolean)

      /** 由实时顶层块数据构建节点（保留宿主已内联的 children，交由兜底递归按需补全） */
      const makeLiveNode = (live: any): ISiYuanBlockNode => ({
        id: live.id,
        parent_id: live.parent_id,
        root_id: live.root_id || docId,
        type: live.type,
        subType: live.subType,
        content: live.content || "",
        markdown: live.markdown || "",
        ial: resolveIal(live.id, live.ial),
        children: live.children,
      })

      /** 按实时 getChildBlocks 递归重建一棵子树（代价 = 该子树的容器数，而非全文档） */
      const rebuildSubtreeLive = async (node: ISiYuanBlockNode | undefined, depth = 0): Promise<void> => {
        if (!node || depth > 8 || !isContainerNode(node)) return
        const children = (await this.deps.getChildBlocks(node.id).catch(() => [])) || []
        if (!Array.isArray(children) || children.length === 0) return
        node.children = children
          .filter((c: any) => c?.id)
          .map((c: any) => ({
            id: c.id,
            parent_id: node.id,
            root_id: docId,
            type: c.type,
            subType: c.subType,
            content: c.content || "",
            markdown: c.markdown || "",
            ial: resolveIal(c.id, c.ial),
            children: [],
          }))
        for (const child of node.children) {
          await rebuildSubtreeLive(child, depth + 1)
        }
      }

      // 结构完整性：实时顶层块对应的索引行必须携带结构所需字段（type），否则无法判定容器性
      const indexRowById = new Map<string, any>()
      for (const row of indexRows) {
        if (row?.id) indexRowById.set(row.id, row)
      }
      const structureComplete = liveTopIds.every((id: string) => {
        const row = indexRowById.get(id)
        // 索引中缺失的顶层块由实时数据补齐（见 5.3），不参与该完整性校验
        return !row || Boolean(row.type)
      })

      let blockNodes: ISiYuanBlockNode[] = []
      let usedLegacyWalk = false

      if (indexTree && decision.usable && orderIndexReady && structureComplete) {
        this.fallbackWarnedDocId = ""
        // 5.1 叶子顶层块内容滞后 → 就地修正
        for (const [id, live] of decision.leafPatch) {
          const node = indexTree.byId.get(id)
          if (node) {
            node.content = live.content
            node.markdown = live.markdown
          }
        }
        // 5.2 容器顶层块内容滞后 → 刷新其自身内容并仅重建这些子树
        const liveById = new Map<string, any>()
        for (const live of liveTopBlocks) {
          if (live?.id) liveById.set(live.id, live)
        }
        for (const rootId of decision.rebuildRoots) {
          const node = indexTree.byId.get(rootId)
          const live = liveById.get(rootId)
          if (node && live) {
            node.content = live.content || ""
            node.markdown = live.markdown || ""
          }
          await rebuildSubtreeLive(node)
        }
        // 5.3 索引缺失的实时顶层块（新增）→ 按实时数据补齐并重建其子树
        for (const live of liveTopBlocks) {
          if (!live?.id || indexTree.byId.has(live.id)) continue
          const node = makeLiveNode(live)
          await rebuildSubtreeLive(node)
          indexTree.byId.set(node.id, node)
          indexTree.topLevel.push(node)
        }
        // 5.4 顶层成员与顺序以实时文档序为权威（不在其中即为已删除）
        blockNodes = indexTree.topLevel
          .filter((n) => orderIndex.has(n.id))
          .sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
      } else if (liveTopIds.length > 0) {
        // 兜底路径：索引完全不可用或缺少实时文档序时，走既有逐容器 getChildBlocks 递归
        usedLegacyWalk = true
        // 诊断埋点：该路径为 O(容器数) 次内核往返，明显慢于索引树路径，按文档去重提示一次
        if (this.fallbackWarnedDocId !== docId) {
          this.fallbackWarnedDocId = docId
          console.warn(
            `[DocumentCompiler] 索引结构不可用，回退逐容器查询（较慢）doc=${docId} 实时顶层=${liveTopIds.length} 索引行=${indexRows.length} 文档序=${liveOrders.length} 原因=${decision.reason || "缺少实时文档序"}`,
          )
        }
        blockNodes = liveTopBlocks.map((r: any) => makeLiveNode(r))
      } else if (indexTree) {
        // 极端兜底：getChildBlocks 无返回（只读/受限环境）时直接采用索引树顶层
        blockNodes = indexTree.topLevel
      }

      // 5.5 兜底路径下递归补全超级块与列表容器/列表项的子节点
      const populateChildrenRecursively = async (nodes: ISiYuanBlockNode[], depth = 0) => {
        if (!nodes || nodes.length === 0 || depth > 8) return
        for (const node of nodes) {
          const isContainer = isContainerNode(node)
          if (isContainer && (!node.children || node.children.length === 0)) {
            let rawChildren = await this.deps.getChildBlocks(node.id).catch(() => [])
            if (!rawChildren || rawChildren.length === 0) {
              const childSql = `SELECT id, parent_id, root_id, type, subtype as subType, content, markdown, ial FROM blocks WHERE parent_id = '${node.id}' ORDER BY sort ASC, created ASC`
              rawChildren = (await this.deps.sql(childSql).catch(() => [])) || []
            }
            if (Array.isArray(rawChildren) && rawChildren.length > 0) {
              const rootBlockIds = new Set(blockNodes.map(b => b.id))
              const validRawChildren = rawChildren.filter((c: any) => c.id !== node.id && !rootBlockIds.has(c.id))
              if (validRawChildren.length > 0) {
                node.children = validRawChildren.map((c: any) => {
                const cIalMap = ialMapById.get(c.id) || (c.ial ? parseIALString(c.ial) : {})
                const cOverride = this.attrOverrides.get(c.id)
                if (cOverride) {
                  Object.assign(cIalMap, cOverride)
                }
                return {
                  id: c.id,
                  parent_id: c.parent_id || node.id,
                  root_id: c.root_id || docId,
                  type: c.type,
                  subType: c.subType,
                  content: c.content || "",
                  markdown: c.markdown || "",
                  ial: cIalMap,
                }
              })
            }
          }
        }
          if (node.children && node.children.length > 0) {
            await populateChildrenRecursively(node.children, depth + 1)
          }
        }
      }

      // 仅兜底路径需要逐容器补全子节点；快速路径的层级已由索引树一次性构建完成
      if (usedLegacyWalk) {
        await populateChildrenRecursively(blockNodes)
      }

      // 5.6 递归冒泡与双向同步多媒体播放控制属性 (仅限视频播放控制属性，严禁冒泡 clicks/motion/slot 等动效与排版属性)
      const VIDEO_MEDIA_ATTRS = new Set([
        "custom-slides-autoplay",
        "custom-slides-loop",
        "custom-slides-muted",
        "custom-slides-controls",
      ])
      const syncMediaAttrsInTree = (nodes: ISiYuanBlockNode[]) => {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            syncMediaAttrsInTree(node.children)
            // 向上合并子节点中视频块的播放属性到父块
            for (const child of node.children) {
              if (child.ial) {
                for (const [k, v] of Object.entries(child.ial)) {
                  if (VIDEO_MEDIA_ATTRS.has(k) && !node.ial?.[k]) {
                    if (!node.ial) node.ial = {}
                    node.ial[k] = v
                  }
                }
              }
            }
            // 向下传递父容器设置的视频属性给包含视频的子块
            if (node.ial) {
              for (const [k, v] of Object.entries(node.ial)) {
                if (VIDEO_MEDIA_ATTRS.has(k)) {
                  for (const child of node.children) {
                    const isVid = child.type === "video" || child.type === "NodeVideo" || /<video\b/i.test(child.markdown || child.content || "")
                    if (isVid && !child.ial?.[k]) {
                      if (!child.ial) child.ial = {}
                      child.ial[k] = v
                    }
                  }
                }
              }
            }
          }
        }
      }

      syncMediaAttrsInTree(blockNodes)

      // 执行超级块自动检测与打标，自动写入即时覆盖层与持久化（不自动同步列宽比例）
      scanAndTagSuperBlocks(blockNodes, (record) => {
        const updates: Record<string, string> = { [ATTR_PAGE_LAYOUT]: record.layout }
        this.setBlockAttrOverride(record.blockId, updates)
        const saveFn = this.deps.setBlockAttrs || setBlockAttrs
        saveFn(record.blockId, updates).catch((err) => {
          console.warn("[DocumentCompiler] Failed to auto-tag superblock image layout:", err)
        })
      })

      // 执行列表超级块（表头双栏/三栏）自动识别与打标，自适应拖拽与自愈
      const prevTracked = this.trackedListSuperBlocks.get(docId) || []
      const listScanRes = scanAndTagListSuperBlocks(docId, blockNodes, {
        tracked: prevTracked,
        // 传入文档根合并属性：根节点不在顶层子块中，扫描器需据此判定真实当前版式（P0-8）
        docAttrs,
        onTagChange: (change) => {
          this.setBlockAttrOverride(change.blockId, change.attrs)
          if (change.blockId === docId) {
            Object.assign(docAttrs, change.attrs)
          }
          const updateNodeIal = (nodes: ISiYuanBlockNode[]) => {
            for (const n of nodes) {
              if (n.id === change.blockId) {
                if (!n.ial) n.ial = {}
                Object.assign(n.ial, change.attrs)
              }
              if (n.children && n.children.length > 0) {
                updateNodeIal(n.children)
              }
            }
          }
          updateNodeIal(blockNodes)
          const saveFn = this.deps.setBlockAttrs || setBlockAttrs
          saveFn(change.blockId, change.attrs).catch((err) => {
            console.warn("[DocumentCompiler] Failed to auto-tag list superblock attrs:", err)
          })
        },
      })
      this.trackedListSuperBlocks.set(docId, listScanRes.newTracked)

      // 6. 递归扫描所有块及子块中的思源块引用 ((block-id))
      const allRefIds = new Set<string>()
      const collectRefsRecursively = (nodes: ISiYuanBlockNode[]) => {
        for (const node of nodes) {
          const text = node.markdown || node.content || ""
          if (text.includes("((")) {
            const refs = extractBlockRefs(text)
            for (const ref of refs) {
              allRefIds.add(ref.blockId)
            }
          }
          if (node.children && node.children.length > 0) {
            collectRefsRecursively(node.children)
          }
        }
      }
      collectRefsRecursively(blockNodes)

      // 7. 批量检索引用的源内容
      const refContentMap: Record<string, string> = {}
      if (allRefIds.size > 0) {
        const quotedIds = Array.from(allRefIds).map(id => `'${id}'`).join(",")
        const refRows = (await this.deps.sql(`SELECT id, content, markdown FROM blocks WHERE id IN (${quotedIds})`).catch(() => [])) || []
        if (Array.isArray(refRows)) {
          for (const row of refRows) {
            if (row.id) {
              refContentMap[row.id] = row.markdown || row.content || ""
            }
          }
        }
      }

      // 8. 调用核心 AST 编译器
      const baseUrl = this.deps.getBaseUrl ? this.deps.getBaseUrl() : ""
      const slidesDoc = buildSlidesDocument(docId, docAttrs, blockNodes, { baseUrl, refContentMap })

      // 9. 动态检索思源工作空间自定义样式扩展 (/api/storage/getInlineStyles) 并生成全局 CSS
      try {
        const rawStyles = this.deps.getInlineStyles ? await this.deps.getInlineStyles().catch(() => null) : null
        slidesDoc.customThemeCss = generateCompleteSiYuanThemeCss(rawStyles)
      } catch {
        slidesDoc.customThemeCss = generateCompleteSiYuanThemeCss(null)
      }

      return slidesDoc
    } catch (err) {
      // 编译失败必须上抛而非返回空文档兜底：空文档会被调用方当作成功结果回写，
      // 导致预览/Dock 被一次性清空且错误态不可达（状态机审计 P0-3）。
      // 调用方（compileCurrentDocument）负责捕获并保留 lastGoodDoc。
      console.error("[DocumentCompilerService] Failed to compile document:", err)
      throw err instanceof Error ? err : new Error(String(err))
    }
  }
}

export const globalDocumentCompiler = new DocumentCompilerService()
