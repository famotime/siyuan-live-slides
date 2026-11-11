import { confirm, showMessage } from "siyuan"
import { setBlockAttrs } from "@/api"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { syncDomBlockAttrs } from "@/sync/dom-attr-sync"
import type { ISlidesBlockItem, ISlidesDocument, ISlidesVirtualPage } from "@/types/slides-protocol"
import { ATTR_ELEM_CLICK, ATTR_ELEM_NOTE } from "@/types/slides-protocol"

export interface IAnimatableItem {
  id: string
  type: string
  isHeading: boolean
  currentClicks?: string
  rawBlock: any
}

export interface IAutoAnimateTarget {
  blockId: string
  pageIndex: number
  targetClick: string
}

export interface IAutoAnimateScanResult {
  totalPages: number
  animatedPagesCount: number
  targets: IAutoAnimateTarget[]
}

export interface IAutoAnimateDeps {
  compileDocFn?: (docId: string) => Promise<ISlidesDocument>
  setBlockAttrsFn?: typeof setBlockAttrs
  syncDomFn?: typeof syncDomBlockAttrs
  confirmFn?: typeof confirm
  showMessageFn?: typeof showMessage
  onSuccessNotice?: (msg: string) => void
  compileCurrentDocFn?: () => Promise<void>
}

/**
 * 判断块是否属于标题块 (h1 - h6)
 */
export function isHeadingBlock(block: any): boolean {
  if (!block) return false
  const t = String(block.type || "").toLowerCase()
  if (t === "h" || t === "nodeheading") return true
  const sub = String(block.subType || "").toLowerCase()
  if (/^h[1-6]$/.test(sub)) return true
  const md = String(block.rawMarkdown || block.markdown || "").trim()
  if (/^#{1,6}\s+/.test(md)) return true
  return false
}

/**
 * 判断块是否为列表项容器 (NodeListItem / i)
 */
export function isListItemBlock(block: any): boolean {
  if (!block) return false
  const t = String(block.type || "").toLowerCase()
  return t === "i" || t === "nodelistitem"
}

/**
 * 按阅读顺序展平单页幻灯片的所有有效内容项（深入列表项与超级块子块，自动排除备注块与分隔线）
 */
export function flattenSlideContentItems(blocks: ISlidesBlockItem[]): IAnimatableItem[] {
  const result: IAnimatableItem[] = []

  const walk = (items: any[]) => {
    for (const b of items) {
      if (!b) continue

      // 自动跳过讲稿备注块
      if (
        b.isNote ||
        b.attributes?.[ATTR_ELEM_NOTE] === "true" ||
        b.attributes?.["slides-note"] === "true" ||
        b.ial?.[ATTR_ELEM_NOTE] === "true" ||
        b.ial?.["slides-note"] === "true"
      ) {
        continue
      }

      // 跳过水平分割线
      if (
        b.type === "tb" ||
        b.type === "thematic-break" ||
        b.type === "NodeThematicBreak" ||
        String(b.markdown || b.rawMarkdown || "").trim() === "---"
      ) {
        continue
      }

      // 跳过插槽分界标记
      if (b.slot === "slot-divider-right" || String(b.rawMarkdown || b.markdown || "").trim() === "::right::") {
        continue
      }

      // 标题块
      if (isHeadingBlock(b)) {
        result.push({
          id: b.id,
          type: b.type,
          isHeading: true,
          currentClicks: b.clicks || b.attributes?.[ATTR_ELEM_CLICK] || b.ial?.[ATTR_ELEM_CLICK],
          rawBlock: b,
        })
        continue
      }

      // 列表项：作为独立原子项呈现
      if (isListItemBlock(b)) {
        result.push({
          id: b.id,
          type: b.type || "i",
          isHeading: false,
          currentClicks: b.clicks || b.attributes?.[ATTR_ELEM_CLICK] || b.ial?.[ATTR_ELEM_CLICK],
          rawBlock: b,
        })
        continue
      }

      // 容器块（超级块、分栏、列表等非列表项容器且含有子块）：递归按顺序展开其内部子块
      const children = (b.children && b.children.length > 0) ? b.children : b.rawNode?.children
      if (Array.isArray(children) && children.length > 0) {
        walk(children)
        continue
      }

      // 普通正文叶子块（段落、表格、代码块、视频、图片等）
      result.push({
        id: b.id,
        type: b.type,
        isHeading: false,
        currentClicks: b.clicks || b.attributes?.[ATTR_ELEM_CLICK] || b.ial?.[ATTR_ELEM_CLICK],
        rawBlock: b,
      })
    }
  }

  walk(blocks || [])
  return result
}

/**
 * 扫描单页幻灯片中符合顺延 (+1) 动效规则的后续内容块：
 * - 封面页（第 1 页或 layout=cover）直接跳过
 * - 页面标题与第一个内容块直接显示
 * - 紧随其后的所有后续块在尚未配置动效时补充目标值 "+1"
 */
export function scanSlideForAutoAnimation(slide: ISlidesVirtualPage): IAutoAnimateTarget[] {
  // 1. 自动跳过封面页（第 1 页或 layout 为 cover 的页面）
  if (slide.pageIndex === 1 || slide.frontmatter?.layout === "cover") {
    return []
  }

  // 2. 展平提取该页按阅读顺序排列的所有有效内容项
  const items = flattenSlideContentItems(slide.blocks || [])
  if (items.length === 0) {
    return []
  }

  // 3. 定位首个非标题内容块的索引
  let firstContentItemIndex = -1
  for (let i = 0; i < items.length; i++) {
    if (!items[i].isHeading) {
      firstContentItemIndex = i
      break
    }
  }

  // 若该页除标题外无其他正文项，无需配置动效
  if (firstContentItemIndex === -1) {
    return []
  }

  // 4. 首个内容块之前的标题以及该首个内容块直接显示
  //    紧随首个内容块之后的后续块依次配置顺延 (+1)
  const targets: IAutoAnimateTarget[] = []

  for (let i = firstContentItemIndex + 1; i < items.length; i++) {
    const item = items[i]
    // 增量补充模式：仅当该块尚未配置任何动效时才追加 "+1"
    const hasClick = Boolean(item.currentClicks && String(item.currentClicks).trim() !== "")
    if (!hasClick && item.id) {
      targets.push({
        blockId: item.id,
        pageIndex: slide.pageIndex,
        targetClick: "+1",
      })
    }
  }

  return targets
}

/**
 * 扫描整篇文档，获取所有正文页待配置顺延动效的目标块列表
 */
export async function scanDocumentForAutoAnimation(
  docId: string,
  deps?: Pick<IAutoAnimateDeps, "compileDocFn">
): Promise<IAutoAnimateScanResult> {
  const compileFn = deps?.compileDocFn || ((id: string) => globalDocumentCompiler.compile(id))
  const doc = await compileFn(docId).catch(() => null)
  if (!doc || !Array.isArray(doc.slides) || doc.slides.length === 0) {
    return { totalPages: 0, animatedPagesCount: 0, targets: [] }
  }

  const allTargets: IAutoAnimateTarget[] = []
  const affectedPages = new Set<number>()

  for (const slide of doc.slides) {
    const pageTargets = scanSlideForAutoAnimation(slide)
    if (pageTargets.length > 0) {
      allTargets.push(...pageTargets)
      affectedPages.add(slide.pageIndex)
    }
  }

  return {
    totalPages: doc.slides.length,
    animatedPagesCount: affectedPages.size,
    targets: allTargets,
  }
}

/**
 * 执行整篇文档智能动效配置编排（包含弹窗确认、批量更新、即时覆盖层与重新编译）
 */
export async function runAutoAnimationForDocument(
  docId: string,
  deps?: IAutoAnimateDeps
): Promise<IAutoAnimateScanResult & { successCount: number; errorCount: number }> {
  const showMsg = deps?.showMessageFn || showMessage
  const confirmModal = deps?.confirmFn || confirm
  const setAttrsImpl = deps?.setBlockAttrsFn || setBlockAttrs
  const syncDomImpl = deps?.syncDomFn || syncDomBlockAttrs

  if (!docId) {
    showMsg("请先在主编辑区打开幻灯片文档")
    return { totalPages: 0, animatedPagesCount: 0, targets: [], successCount: 0, errorCount: 0 }
  }

  const scanRes = await scanDocumentForAutoAnimation(docId, deps)
  if (scanRes.targets.length === 0) {
    showMsg("未检测到需要配置顺延动效的后续块")
    return { ...scanRes, successCount: 0, errorCount: 0 }
  }

  const count = scanRes.targets.length
  const pageCount = scanRes.animatedPagesCount

  return new Promise((resolve) => {
    confirmModal(
      "智能设置动效",
      `扫描检测到可为 ${pageCount} 页中的 ${count} 个后续块配置顺延 (+1) 动效，是否继续？`,
      async () => {
        showMsg(`正在批量配置 ${count} 个后续块动效...`)
        let successCount = 0
        let errorCount = 0

        for (const target of scanRes.targets) {
          try {
            await setAttrsImpl(target.blockId, { [ATTR_ELEM_CLICK]: target.targetClick })
            globalDocumentCompiler.setBlockAttrOverride(target.blockId, { [ATTR_ELEM_CLICK]: target.targetClick })
            syncDomImpl(target.blockId, { [ATTR_ELEM_CLICK]: target.targetClick })
            successCount++
          } catch (err) {
            console.error(`[SiYuanLiveSlides] 为块 ${target.blockId} 配置动效失败:`, err)
            errorCount++
          }
        }

        deps?.onSuccessNotice?.("已配置智能动效")
        showMsg(`已成功为 ${successCount} 个后续块配置顺延 (+1) 动效`)

        if (deps?.compileCurrentDocFn) {
          await deps.compileCurrentDocFn().catch(() => {})
        }

        resolve({
          ...scanRes,
          successCount,
          errorCount,
        })
      },
      () => {
        resolve({
          ...scanRes,
          successCount: 0,
          errorCount: 0,
        })
      }
    )
  })
}
