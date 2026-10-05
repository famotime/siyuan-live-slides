import { getBlockAttrs, getChildBlocks, setBlockAttrs, sql } from "../api"
import { extractBlockRefs } from "./block-ref-resolver"
import { buildSlidevDocument } from "./slidev-ast-builder"
import {
  isSuperBlock,
  scanAndTagSuperBlocks,
  scanAndTagListSuperBlocks,
  ITrackedListSuperBlock,
} from "./superblock-scanner"
import type { ISiYuanBlockNode, ISlidevDocument } from "../types/slidev-protocol"
import { ATTR_PAGE_LAYOUT } from "../types/slidev-protocol"

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
}

const defaultDeps: IDocumentCompilerDeps = {
  getBlockAttrs,
  getChildBlocks,
  setBlockAttrs,
  sql,
  getBaseUrl: () => (typeof location !== "undefined" ? location.origin : ""),
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

      // 2. 优先通过 getChildBlocks 获取按思源文档真实排版顺序排列的所有子块
      let rawBlocks: any[] = await this.deps.getChildBlocks(docId).catch(() => [])

      // 3. 批量检索当前文档所有块的 IAL 属性字典 (显式添加 LIMIT 99999 突破默认 search.limit 截断)
      const ialQuery = `SELECT id, ial FROM blocks WHERE root_id = '${docId}' LIMIT 99999`
      const ialRows = (await this.deps.sql(ialQuery).catch(() => [])) || []
      const ialMapById = new Map<string, Record<string, string>>()
      if (Array.isArray(ialRows)) {
        for (const row of ialRows) {
          if (row.id && row.ial) {
            ialMapById.set(row.id, parseIALString(row.ial))
          }
        }
      }

      // 3.1 联合查询 attributes 表：思源官方结构化自定义属性键值对，补充合并到 ialMapById
      const attrQuery = `SELECT block_id, name, value FROM attributes WHERE root_id = '${docId}' LIMIT 99999`
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

      // 4. 容错降级：如果 getChildBlocks 为空，从 SQL 回退检索
      if (!rawBlocks || rawBlocks.length === 0) {
        const fallbackSql = `SELECT id, parent_id, root_id, type, sub_type as subType, content, markdown, ial FROM blocks WHERE root_id = '${docId}' AND id != '${docId}' ORDER BY created ASC LIMIT 99999`
        rawBlocks = (await this.deps.sql(fallbackSql).catch(() => [])) || []
      }

      // 5. 将 IAL 挂载到对应块节点上 (优先应用即时覆盖层)
      const blockNodes: ISiYuanBlockNode[] = (rawBlocks || []).map((r: any) => {
        const ialMap = ialMapById.get(r.id) || (r.ial ? parseIALString(r.ial) : {})
        const override = this.attrOverrides.get(r.id)
        if (override) {
          Object.assign(ialMap, override)
        }
        return {
          id: r.id,
          parent_id: r.parent_id,
          root_id: r.root_id || docId,
          type: r.type,
          subType: r.subType,
          content: r.content || "",
          markdown: r.markdown || "",
          ial: ialMap,
          children: r.children,
        }
      })

      // 5.5 递归补全超级块与列表容器/列表项的子节点 (支持官方缩写 's'、'sb'、'l'、'i' 与降级 SQL 查询)
      const populateChildrenRecursively = async (nodes: ISiYuanBlockNode[], depth = 0) => {
        if (!nodes || nodes.length === 0 || depth > 8) return
        for (const node of nodes) {
          const isContainer =
            isSuperBlock(node) ||
            node.type === "l" ||
            node.type === "NodeList" ||
            node.type === "i" ||
            node.type === "NodeListItem" ||
            node.type === "b" ||
            node.type === "NodeBlockquote"
          if (isContainer && (!node.children || node.children.length === 0)) {
            let rawChildren = await this.deps.getChildBlocks(node.id).catch(() => [])
            if (!rawChildren || rawChildren.length === 0) {
              const childSql = `SELECT id, parent_id, root_id, type, sub_type as subType, content, markdown, ial FROM blocks WHERE parent_id = '${node.id}' ORDER BY sort ASC, created ASC`
              rawChildren = (await this.deps.sql(childSql).catch(() => [])) || []
            }
            if (Array.isArray(rawChildren) && rawChildren.length > 0) {
              node.children = rawChildren.map((c: any) => {
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
          if (node.children && node.children.length > 0) {
            await populateChildrenRecursively(node.children, depth + 1)
          }
        }
      }

      await populateChildrenRecursively(blockNodes)

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

      // 执行超级块自动检测与打标，自动写入即时覆盖层与持久化
      scanAndTagSuperBlocks(blockNodes, (record) => {
        this.setBlockAttrOverride(record.blockId, { [ATTR_PAGE_LAYOUT]: record.layout })
        const saveFn = this.deps.setBlockAttrs || setBlockAttrs
        saveFn(record.blockId, { [ATTR_PAGE_LAYOUT]: record.layout }).catch((err) => {
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
      return slidevDoc
    } catch (err) {
      console.error("[DocumentCompilerService] Failed to compile document:", err)
      // 容错兜底：返回基础空文档
      return buildSlidevDocument(docId, {}, [], {})
    }
  }
}

export const globalDocumentCompiler = new DocumentCompilerService()
