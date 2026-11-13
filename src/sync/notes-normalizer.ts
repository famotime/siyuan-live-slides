import { confirm, showMessage } from "siyuan"
import {
  getBlockAttrs,
  getBlockKramdown,
  getChildBlocks,
  setBlockAttrs,
  updateBlock,
} from "@/api"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { extractCleanNoteText } from "@/compiler/directive-wrapper"
import { isPageBreak } from "@/compiler/scope-mapper"
import { syncDomBlockAttrs } from "@/sync/dom-attr-sync"
import { ATTR_ELEM_NOTE } from "@/types/slides-protocol"

export interface INoteCandidate {
  id: string
  pageIndex: number
  type: string
  sourceMarkdown: string
  cleanContent: string
}

export interface IIdentifyNotesDeps {
  getChildBlocksFn?: typeof getChildBlocks
  getBlockAttrsFn?: typeof getBlockAttrs
  getBlockKramdownFn?: typeof getBlockKramdown
  updateBlockFn?: typeof updateBlock
  setBlockAttrsFn?: typeof setBlockAttrs
  syncDomFn?: typeof syncDomBlockAttrs
  confirmFn?: typeof confirm
  showMessageFn?: typeof showMessage
  compileFn?: () => Promise<void>
  onSuccessNotice?: (msg: string) => void
}

export interface IIdentifyNotesResult {
  totalScanned: number
  matchedCount: number
  successCount: number
  errorCount: number
}

/**
 * 判断块是否属于提示块 (Callout) 或引用块 (Blockquote)
 */
export function isCalloutOrBlockquote(block: any): boolean {
  if (!block) return false
  const t = String(block.type || "").toLowerCase()
  if (t === "callout" || t === "nodecallout" || t === "b" || t === "nodeblockquote") {
    return true
  }
  const md = String(block.markdown || "").trim()
  if (md.startsWith(">")) {
    return true
  }
  return false
}

/**
 * 判断块是否已符合标准讲稿块规范（已打标且具备标准提示块标题）
 */
export function isStandardNoteBlock(markdown: string, attrs?: Record<string, string>): boolean {
  const hasAttr = attrs?.[ATTR_ELEM_NOTE] === "true"
  if (!hasAttr) return false
  const trimmed = (markdown || "").trim()
  return /^>\s*\[!NOTE\]\s*(?:💡\s*)?(?:演讲备注|讲稿备注)/i.test(trimmed)
}

/**
 * 扫描指定文档中的所有候选讲稿块：
 * 规则：各页 --- 分隔线紧前方的最后一个提示块或引用块，以及文档末尾页紧贴末尾的提示块或引用块
 */
export async function scanDocumentForCandidateNotes(
  docId: string,
  deps?: Pick<IIdentifyNotesDeps, "getChildBlocksFn" | "getBlockAttrsFn" | "getBlockKramdownFn">
): Promise<INoteCandidate[]> {
  const getChildBlocksImpl = deps?.getChildBlocksFn || getChildBlocks
  const rawBlocks: any[] = await getChildBlocksImpl(docId).catch(() => [])
  if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) {
    return []
  }

  // 1. 按分页符将全篇顶层块分割为各页面块组
  const pages: any[][] = []
  let currentBlocks: any[] = []

  for (const node of rawBlocks) {
    const isDivider = isPageBreak({
      ...node,
      ial: {
        ...(node.ial || {}),
        ...(globalDocumentCompiler.getBlockAttrOverride(node.id) || {}),
      },
    })

    if (isDivider) {
      if (pages.length === 0 && currentBlocks.length === 0) {
        // 第一页起始分割线
        continue
      }
      pages.push(currentBlocks)
      currentBlocks = []
      continue
    }

    currentBlocks.push(node)
  }
  // 最后一页（无论末尾是否有 ---）
  pages.push(currentBlocks)

  // 2. 遍历各页，提取末尾紧邻的候选提示块或引用块
  const candidates: INoteCandidate[] = []

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageBlocks = pages[pageIdx]
    if (!pageBlocks || pageBlocks.length === 0) continue

    // 逆向跳过末尾偶发的纯空白段落块
    let candidateBlock: any = null
    for (let j = pageBlocks.length - 1; j >= 0; j--) {
      const b = pageBlocks[j]
      const isBlankP =
        (b.type === "p" || b.type === "NodeParagraph") &&
        !(b.content || "").trim() &&
        !(b.markdown || "").trim()
      if (isBlankP) continue
      candidateBlock = b
      break
    }

    if (!candidateBlock) continue

    // 判定是否为提示块或引用块
    if (!isCalloutOrBlockquote(candidateBlock)) {
      continue
    }

    // 获取块属性（结合即时覆盖层与可选接口查询）
    const overrideAttrs = globalDocumentCompiler.getBlockAttrOverride(candidateBlock.id) || {}
    let blockAttrs: Record<string, string> = {
      ...(candidateBlock.ial || {}),
      ...overrideAttrs,
    }

    if (!blockAttrs[ATTR_ELEM_NOTE] && deps?.getBlockAttrsFn) {
      const fetchedAttrs = await deps.getBlockAttrsFn(candidateBlock.id).catch(() => ({}))
      blockAttrs = { ...blockAttrs, ...fetchedAttrs, ...overrideAttrs }
    }

    // 获取块 Kramdown 文本
    let sourceText = candidateBlock.markdown || candidateBlock.content || ""
    if (deps?.getBlockKramdownFn) {
      try {
        const kdRes = await deps.getBlockKramdownFn(candidateBlock.id)
        if (kdRes?.kramdown) {
          sourceText = kdRes.kramdown
        }
      } catch (_) {}
    }

    // 若已经具备属性且已符合规范，则自动跳过
    if (isStandardNoteBlock(sourceText, blockAttrs)) {
      continue
    }

    const cleanContent = extractCleanNoteText(sourceText) || sourceText.replace(/<[^>]+>/g, "").trim()

    candidates.push({
      id: candidateBlock.id,
      pageIndex: pageIdx + 1,
      type: candidateBlock.type,
      sourceMarkdown: sourceText,
      cleanContent: cleanContent || "在此输入本页讲稿提词...",
    })
  }

  return candidates
}

/**
 * 将指定块物理规范化为标准讲稿提示块
 */
export async function normalizeNoteBlock(
  blockId: string,
  cleanContent: string,
  deps?: Pick<IIdentifyNotesDeps, "updateBlockFn" | "setBlockAttrsFn" | "syncDomFn">
): Promise<void> {
  const updateBlockImpl = deps?.updateBlockFn || updateBlock
  const setBlockAttrsImpl = deps?.setBlockAttrsFn || setBlockAttrs
  const syncDomImpl = deps?.syncDomFn || syncDomBlockAttrs

  const bodyLines = cleanContent.split(/\r?\n/).map(l => `> ${l}`).join("\n")
  const calloutMd = `> [!NOTE] 💡 演讲备注\n${bodyLines}\n{: ${ATTR_ELEM_NOTE}="true"}`

  await updateBlockImpl("markdown", calloutMd, blockId)
  await setBlockAttrsImpl(blockId, { [ATTR_ELEM_NOTE]: "true" })
  globalDocumentCompiler.setBlockAttrOverride(blockId, { [ATTR_ELEM_NOTE]: "true" })
  syncDomImpl(blockId, { [ATTR_ELEM_NOTE]: "true" })
}

/**
 * 扫描并规范化当前文档的所有讲稿块（含二次确认弹窗与进度反馈）
 */
export async function identifyAndNormalizeDocumentNotes(
  docId: string,
  deps?: IIdentifyNotesDeps
): Promise<IIdentifyNotesResult> {
  const showMsg = deps?.showMessageFn || showMessage
  const confirmModal = deps?.confirmFn || confirm

  if (!docId) {
    showMsg("请先在主编辑区打开幻灯片文档")
    return { totalScanned: 0, matchedCount: 0, successCount: 0, errorCount: 0 }
  }

  // 1. 扫描候选讲稿块
  const candidates = await scanDocumentForCandidateNotes(docId, deps)

  if (candidates.length === 0) {
    showMsg("未发现待规范化的候选讲稿块")
    return { totalScanned: 0, matchedCount: 0, successCount: 0, errorCount: 0 }
  }

  const count = candidates.length
  return new Promise<IIdentifyNotesResult>((resolve) => {
    confirmModal(
      "识别讲稿块",
      `扫描检测到 ${count} 处候选讲稿块（提示块或引用块），是否确认将其规范化为标准演讲备注？`,
      async () => {
        showMsg(`正在批量规范化 ${count} 个讲稿块...`)
        let successCount = 0
        let errorCount = 0

        for (const item of candidates) {
          try {
            await normalizeNoteBlock(item.id, item.cleanContent, deps)
            successCount++
          } catch (err) {
            console.error(`[SiYuanLiveSlides] 规范化讲稿块 ${item.id} 失败:`, err)
            errorCount++
          }
        }

        deps?.onSuccessNotice?.("已规范化讲稿")
        showMsg(`已成功识别并规范化 ${successCount} 个讲稿块`)

        if (deps?.compileFn) {
          await deps.compileFn().catch(() => {})
        }

        resolve({
          totalScanned: count,
          matchedCount: count,
          successCount,
          errorCount,
        })
      },
      () => {
        resolve({
          totalScanned: count,
          matchedCount: count,
          successCount: 0,
          errorCount: 0,
        })
      }
    )
  })
}
