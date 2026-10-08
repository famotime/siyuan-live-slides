import { getBlockAttrs, getChildBlocks, getInlineStyles, setBlockAttrs, sql } from "../api"
import { extractBlockRefs } from "./block-ref-resolver"
import { buildSlidevDocument } from "./slidev-ast-builder"
import { generateCompleteSiYuanThemeCss } from "./theme-styles-generator"
import {
  isSuperBlock,
  scanAndTagSuperBlocks,
  scanAndTagListSuperBlocks,
  ITrackedListSuperBlock,
} from "./superblock-scanner"
import type { ISiYuanBlockNode, ISlidevDocument } from "../types/slidev-protocol"
import { ATTR_PAGE_LAYOUT, ATTR_PAGE_LAYOUT_RATIO } from "../types/slidev-protocol"

/**
 * 辅助解析思源数据库中的 IAL 字段文本为键值对字典
 */
export function parseIALString(ialStr: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!ialStr || typeof ialStr !== "string") {
    return result
  }
  const clean = ialStr.replace(/^\{:\s*/, "").replace(/\s*\}$/, "")
  const regex = /([\w-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(clean)) !== null) {
    const key = match[1]
    const val = match[2] ?? match[3] ?? match[4] ?? ""
    result[key] = val
  }
  return result
}

export interface IDocumentCompilerDeps {
  getBlockAttrs: (id: string) => Promise<Record<string, string>>
  getChildBlocks: (id: string) => Promise<any[]>
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
    const parentId = effectiveParentId(row)
    const bucket = childrenByParent.get(parentId)
    if (bucket) {
      bucket.push(row)
    } else {
      childrenByParent.set(parentId, [row])
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

  public async compile(docId: string): Promise<ISlidevDocument> {
    try {
      // 1. 获取文档属性并注入即时覆盖缓存
      const docAttrs = (await this.deps.getBlockAttrs(docId).catch(() => ({}))) || {}
      const docOverride = this.attrOverrides.get(docId)
      if (docOverride) {
        Object.assign(docAttrs, docOverride)
      }

      // 2. 获取文档顶层块：getChildBlocks 返回实时、权威的顶层顺序（1 次内核调用）
      const liveTopBlocks: any[] = (await this.deps.getChildBlocks(docId).catch(() => [])) || []

      // 3. P1 优化：一次性拉取整篇文档的块索引行（含结构所需的 parent_id/type/subtype 与 IAL），
      //    取代此前对每个容器块逐次调用 getChildBlocks 的 N+1 内核往返（单次编译由 O(容器数) 次降为常数次）
      //    列名以 kernel/sql/database.go 的 blocks 表定义为准（subtype）
      const indexQuery = `SELECT id, parent_id, root_id, type, subtype, content, markdown, ial, sort, created FROM blocks WHERE root_id = '${docId}' AND id != '${docId}' ORDER BY sort ASC, created ASC LIMIT 99999`
      const indexRows = (await this.deps.sql(indexQuery).catch(() => [])) || []

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

      // 5. 建树：优先用索引树（0 次额外内核调用），并与实时顶层块集合做一致性校验；
      //    索引滞后或结构不一致时回退到逐容器 getChildBlocks 的既有路径，保证预览内容不缺失
      const indexTree = Array.isArray(indexRows) && indexRows.length > 0
        ? buildBlockTreeFromIndex(docId, indexRows, resolveIal)
        : null

      const liveTopIds = liveTopBlocks.map((b: any) => b.id).filter(Boolean)
      const indexTopIds = new Set((indexTree?.topLevel || []).map((n) => n.id))
      // 索引行必须覆盖实时顶层块且携带结构所需字段（type），否则视为索引滞后/数据不全而回退
      const indexRowById = new Map<string, any>()
      for (const row of indexRows) {
        if (row?.id) {
          indexRowById.set(row.id, row)
        }
      }
      const indexTreeUsable = Boolean(
        indexTree &&
        liveTopIds.length > 0 &&
        liveTopIds.length === indexTopIds.size &&
        liveTopIds.every((id: string) => {
          const row = indexRowById.get(id)
          return indexTopIds.has(id) && Boolean(row && row.type)
        }),
      )

      let blockNodes: ISiYuanBlockNode[] = []
      let usedLegacyWalk = false

      if (indexTree && indexTreeUsable) {
        // 快速路径：按实时顶层顺序重排索引树顶层节点
        blockNodes = liveTopIds
          .map((id: string) => indexTree.byId.get(id))
          .filter((n): n is ISiYuanBlockNode => Boolean(n))
      } else if (liveTopIds.length > 0) {
        // 兜底路径：保留既有逐容器 getChildBlocks 递归（索引未覆盖实时结构时使用）
        usedLegacyWalk = true
        const legacyNodes: ISiYuanBlockNode[] = liveTopBlocks.map((r: any) => ({
          id: r.id,
          parent_id: r.parent_id,
          root_id: r.root_id || docId,
          type: r.type,
          subType: r.subType,
          content: r.content || "",
          markdown: r.markdown || "",
          ial: resolveIal(r.id, r.ial),
          children: r.children,
        }))
        blockNodes = legacyNodes
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

      // 5.6 递归冒泡与双向同步多媒体播放控制属性 (custom-slidev-autoplay, custom-slidev-muted 等)
      const syncMediaAttrsInTree = (nodes: ISiYuanBlockNode[]) => {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            syncMediaAttrsInTree(node.children)
            // 向上合并子节点中视频块的属性到父块
            for (const child of node.children) {
              if (child.ial) {
                for (const [k, v] of Object.entries(child.ial)) {
                  if (k.startsWith("custom-slidev-") && !node.ial?.[k]) {
                    if (!node.ial) node.ial = {}
                    node.ial[k] = v
                  }
                }
              }
            }
            // 向下传递父容器设置的视频属性给包含视频的子块
            if (node.ial) {
              for (const [k, v] of Object.entries(node.ial)) {
                if (k.startsWith("custom-slidev-")) {
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

      // 6. 扫描所有块中的思源块引用 ((block-id))
      const allRefIds = new Set<string>()
      for (const node of blockNodes) {
        const text = node.markdown || node.content || ""
        if (text.includes("((")) {
          const refs = extractBlockRefs(text)
          for (const ref of refs) {
            allRefIds.add(ref.blockId)
          }
        }
      }

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
      const slidevDoc = buildSlidevDocument(docId, docAttrs, blockNodes, { baseUrl, refContentMap })

      // 9. 动态检索思源工作空间自定义样式扩展 (/api/storage/getInlineStyles) 并生成全局 CSS
      try {
        const rawStyles = this.deps.getInlineStyles ? await this.deps.getInlineStyles().catch(() => null) : null
        slidevDoc.customThemeCss = generateCompleteSiYuanThemeCss(rawStyles)
      } catch {
        slidevDoc.customThemeCss = generateCompleteSiYuanThemeCss(null)
      }

      return slidevDoc
    } catch (err) {
      console.error("[DocumentCompilerService] Failed to compile document:", err)
      // 容错兜底：返回基础空文档
      const fallbackDoc = buildSlidevDocument(docId, {}, [], {})
      fallbackDoc.customThemeCss = generateCompleteSiYuanThemeCss(null)
      return fallbackDoc
    }
  }
}

export const globalDocumentCompiler = new DocumentCompilerService()
