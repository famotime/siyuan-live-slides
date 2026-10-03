import { getBlockAttrs, getChildBlocks, sql } from "../api"
import { extractBlockRefs } from "./block-ref-resolver"
import { buildSlidevDocument } from "./slidev-ast-builder"
import type { ISiYuanBlockNode, ISlidevDocument } from "../types/slidev-protocol"

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
  sql: (query: string) => Promise<any[]>
  getBaseUrl?: () => string
}

const defaultDeps: IDocumentCompilerDeps = {
  getBlockAttrs,
  getChildBlocks,
  sql,
  getBaseUrl: () => (typeof location !== "undefined" ? location.origin : ""),
}

/**
 * 文档编译编排服务：从思源笔记拉取块与 IAL、解析关联引用并构建 Slidev 虚拟文档模型
 */
export class DocumentCompilerService {
  private deps: IDocumentCompilerDeps

  constructor(deps?: Partial<IDocumentCompilerDeps>) {
    this.deps = {
      ...defaultDeps,
      ...(deps || {}),
    }
  }

  public async compile(docId: string): Promise<ISlidevDocument> {
    try {
      // 1. 获取文档属性
      const docAttrs = await this.deps.getBlockAttrs(docId).catch(() => ({}))

      // 2. 优先通过 getChildBlocks 获取按思源文档真实排版顺序排列的所有子块
      let rawBlocks: any[] = await this.deps.getChildBlocks(docId).catch(() => [])

      // 3. 批量检索当前文档所有块的 IAL 属性字典
      const ialQuery = `SELECT id, ial FROM blocks WHERE root_id = '${docId}'`
      const ialRows = (await this.deps.sql(ialQuery).catch(() => [])) || []
      const ialMapById = new Map<string, Record<string, string>>()
      if (Array.isArray(ialRows)) {
        for (const row of ialRows) {
          if (row.id && row.ial) {
            ialMapById.set(row.id, parseIALString(row.ial))
          }
        }
      }

      // 4. 容错降级：如果 getChildBlocks 为空，从 SQL 回退检索
      if (!rawBlocks || rawBlocks.length === 0) {
        const fallbackSql = `SELECT id, parent_id, root_id, type, sub_type as subType, content, markdown, ial FROM blocks WHERE root_id = '${docId}' AND id != '${docId}' ORDER BY created ASC`
        rawBlocks = (await this.deps.sql(fallbackSql).catch(() => [])) || []
      }

      // 5. 将 IAL 挂载到对应块节点上
      const blockNodes: ISiYuanBlockNode[] = (rawBlocks || []).map((r: any) => {
        const ialMap = ialMapById.get(r.id) || (r.ial ? parseIALString(r.ial) : {})
        return {
          id: r.id,
          parent_id: r.parent_id,
          root_id: r.root_id || docId,
          type: r.type,
          subType: r.subType,
          content: r.content || "",
          markdown: r.markdown || "",
          ial: ialMap,
        }
      })

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
