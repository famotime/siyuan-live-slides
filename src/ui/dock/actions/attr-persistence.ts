import { type ComputedRef, type Ref } from "vue"
import { setBlockAttrs } from "@/api"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { syncDomBlockAttrs } from "@/sync/dom-attr-sync"
import type { ISlidesDocument, ISlidesVirtualPage } from "@/types/slides-protocol"
import {
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_BACKGROUND,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_THEME,
  ATTR_ELEM_CLICK,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
  ATTR_PAGE_HEADER,
} from "@/types/slides-protocol"

export interface IInspectorActionsContext {
  activeBlockId: Ref<string>
  activeBlockType: Ref<string>
  activeBlockAttrs: Ref<Record<string, string>>
  rawSnippet: Ref<string>
  currentDocId: Ref<string>
  currentPageDividerId: Ref<string>
  currentPageDividerLayout: Ref<string>
  parentContainerId?: Ref<string>
  parentContainerClicks?: Ref<string>
  latestDoc: Ref<ISlidesDocument | null>
  targetSlide: ComputedRef<ISlidesVirtualPage | null>
  currentSlideNoteBlockId: ComputedRef<string>
  currentSlideLayout: ComputedRef<string>
  isNoteBlock: ComputedRef<boolean>
  elemClick: ComputedRef<string>
  videoAutoplay: ComputedRef<boolean>
  videoLoop: ComputedRef<boolean>
  videoMuted: ComputedRef<boolean>
  videoControls: ComputedRef<boolean>
  pageBackground?: Ref<string>
  pageImage: Ref<string>
  elemShikiLines: Ref<string>
  elemMaxHeight: Ref<string>
  saveStatus: Ref<string>
  plugin?: any
}

export interface IAttrPersistence {
  triggerSaveNotice: (msg?: string) => void
  saveAttrs: (attrs: Record<string, string>) => Promise<void>
  saveAttr: (key: string, value: string) => Promise<void>
  getPageTargetBlockId: () => string
  savePageAttr: (key: string, value: string) => Promise<void>
  applyPageLayoutAndRatio: (layout: string, ratio: string) => Promise<void>
  saveDocAttr: (key: string, value: string) => Promise<void>
}

function isContainerMainText(activeId: string, parentContainerId?: string): boolean {
  if (!parentContainerId) return false
  if (activeId === parentContainerId) return true
  if (typeof document === "undefined") return true
  const parentEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${parentContainerId}"]`) ||
                   document.querySelector(`[data-node-id="${parentContainerId}"]`)
  if (!parentEl) return false
  const firstChild = parentEl.querySelector(':scope > [data-node-id], :scope > div > [data-node-id]')
  return firstChild?.getAttribute('data-node-id') === activeId
}

/**
 * 属性持久化领域模块：统一负责
 * 激活块/分页符/文档根三类写入目标的属性落库（内核 API + 内存覆写层 + DOM 同步）、
 * 父容器点击动效联动与 frontmatter 即时更新。
 */
export function createAttrPersistence(ctx: IInspectorActionsContext): IAttrPersistence {
  let saveTimer: number | null = null

  function triggerSaveNotice(msg = "已同步") {
    ctx.saveStatus.value = msg
    if (saveTimer) {
      if (typeof window !== "undefined") {
        window.clearTimeout(saveTimer)
      } else {
        clearTimeout(saveTimer)
      }
    }
    const timerCallback = () => {
      ctx.saveStatus.value = ""
    }
    if (typeof window !== "undefined") {
      saveTimer = window.setTimeout(timerCallback, 1200)
    } else {
      saveTimer = setTimeout(timerCallback, 1200) as any
    }
  }

  async function saveAttrs(attrs: Record<string, string>) {
    const targetId = ctx.activeBlockId.value || ctx.currentDocId.value
    if (!targetId) return

    for (const [key, value] of Object.entries(attrs)) {
      ctx.activeBlockAttrs.value[key] = value
    }
    globalDocumentCompiler.setBlockAttrOverride(targetId, attrs)
    syncDomBlockAttrs(targetId, attrs)

    const parentId = ctx.parentContainerId?.value
    const shouldSyncParent = Boolean(parentId && isContainerMainText(targetId, parentId))
    if (ATTR_ELEM_CLICK in attrs && shouldSyncParent && parentId) {
      const clickVal = attrs[ATTR_ELEM_CLICK]
      if (ctx.parentContainerClicks) {
        ctx.parentContainerClicks.value = clickVal
      }
      globalDocumentCompiler.setBlockAttrOverride(parentId, { [ATTR_ELEM_CLICK]: clickVal })
      syncDomBlockAttrs(parentId, { [ATTR_ELEM_CLICK]: clickVal })
      setBlockAttrs(parentId, { [ATTR_ELEM_CLICK]: clickVal }).catch(() => {})
    }

    if (ATTR_PAGE_LAYOUT in attrs) {
      const value = attrs[ATTR_PAGE_LAYOUT]
      ctx.currentPageDividerLayout.value = value
      if (ctx.targetSlide.value) {
        if (!ctx.targetSlide.value.frontmatter) {
          ctx.targetSlide.value.frontmatter = {}
        }
        ctx.targetSlide.value.frontmatter.layout = value as any
      }
    }

    if (ATTR_PAGE_LAYOUT_RATIO in attrs) {
      const value = attrs[ATTR_PAGE_LAYOUT_RATIO]
      if (ctx.targetSlide.value) {
        if (!ctx.targetSlide.value.frontmatter) {
          ctx.targetSlide.value.frontmatter = {}
        }
        ctx.targetSlide.value.frontmatter.layoutRatio = value
      }
    }

    if (ATTR_PAGE_HEADER in attrs) {
      const value = attrs[ATTR_PAGE_HEADER]
      if (ctx.targetSlide.value) {
        if (!ctx.targetSlide.value.frontmatter) {
          ctx.targetSlide.value.frontmatter = {}
        }
        ctx.targetSlide.value.frontmatter.header = value === 'true'
      }
    }

    triggerSaveNotice("保存中...")
    try {
      await setBlockAttrs(targetId, attrs)
      triggerSaveNotice("已同步")
      if (ctx.plugin) {
        await ctx.plugin.compileCurrentDocument()
      }
    } catch (e) {
      triggerSaveNotice("同步失败")
    }
  }

  async function saveAttr(key: string, value: string) {
    await saveAttrs({ [key]: value })
  }

  function getPageTargetBlockId(): string {
    const isCurDivider = ctx.activeBlockType.value === "NodeThematicBreak" ||
                         ctx.activeBlockType.value === "NodeThematicBreakBlock" ||
                         ctx.activeBlockType.value === "hr" ||
                         ctx.activeBlockType.value === "thematicbreak"
    if (isCurDivider && ctx.activeBlockId.value) {
      return ctx.activeBlockId.value
    }
    if (ctx.currentPageDividerId.value) {
      return ctx.currentPageDividerId.value
    }
    // FSM-3 缺陷防御：优先从当前虚拟页提取分页符 ID，防止虚拟滚动卸载 DOM 时误将局部页面版式写入文档根
    if (ctx.targetSlide.value?.startBlockId && ctx.targetSlide.value.startBlockId !== ctx.currentDocId.value) {
      return ctx.targetSlide.value.startBlockId
    }
    return ctx.currentDocId.value
  }

  async function savePageAttr(key: string, value: string) {
    const targetId = getPageTargetBlockId()
    if (!targetId) return

    if (targetId === ctx.activeBlockId.value) {
      ctx.activeBlockAttrs.value[key] = value
    }
    globalDocumentCompiler.setBlockAttrOverride(targetId, { [key]: value })
    syncDomBlockAttrs(targetId, { [key]: value })

    if (key === ATTR_PAGE_LAYOUT) {
      ctx.currentPageDividerLayout.value = value
      if (ctx.targetSlide.value) {
        if (!ctx.targetSlide.value.frontmatter) {
          ctx.targetSlide.value.frontmatter = {}
        }
        ctx.targetSlide.value.frontmatter.layout = value as any
      }
    }

    if (key === ATTR_PAGE_LAYOUT_RATIO) {
      if (ctx.targetSlide.value) {
        if (!ctx.targetSlide.value.frontmatter) {
          ctx.targetSlide.value.frontmatter = {}
        }
        ctx.targetSlide.value.frontmatter.layoutRatio = value
      }
    }

    if (key === ATTR_PAGE_HEADER) {
      if (ctx.targetSlide.value) {
        if (!ctx.targetSlide.value.frontmatter) {
          ctx.targetSlide.value.frontmatter = {}
        }
        ctx.targetSlide.value.frontmatter.header = value === 'true'
      }
    }

    triggerSaveNotice("保存中...")
    try {
      await setBlockAttrs(targetId, { [key]: value })
      triggerSaveNotice("已同步")
      if (ctx.plugin) {
        await ctx.plugin.compileCurrentDocument()
      }
    } catch (e) {
      triggerSaveNotice("同步失败")
    }
  }

  async function applyPageLayoutAndRatio(layout: string, ratio: string) {
    const targetId = getPageTargetBlockId()
    if (!targetId) return

    const updates: Record<string, string> = {
      [ATTR_PAGE_LAYOUT]: layout,
      [ATTR_PAGE_LAYOUT_RATIO]: ratio,
    }

    if (targetId === ctx.activeBlockId.value) {
      ctx.activeBlockAttrs.value[ATTR_PAGE_LAYOUT] = layout
      ctx.activeBlockAttrs.value[ATTR_PAGE_LAYOUT_RATIO] = ratio
    }
    ctx.currentPageDividerLayout.value = layout
    globalDocumentCompiler.setBlockAttrOverride(targetId, updates)
    syncDomBlockAttrs(targetId, updates)

    if (ctx.targetSlide.value) {
      if (!ctx.targetSlide.value.frontmatter) {
        ctx.targetSlide.value.frontmatter = {}
      }
      ctx.targetSlide.value.frontmatter.layout = layout as any
      ctx.targetSlide.value.frontmatter.layoutRatio = ratio
    }

    triggerSaveNotice("应用排版中...")
    try {
      await setBlockAttrs(targetId, updates)
      triggerSaveNotice("已应用分栏与比例")
      if (ctx.plugin) {
        await ctx.plugin.compileCurrentDocument()
      }
    } catch (e) {
      triggerSaveNotice("应用失败")
    }
  }

  async function saveDocAttr(key: string, value: string) {
    const docId = ctx.currentDocId.value || ctx.activeBlockId.value
    if (!docId) return
    ctx.activeBlockAttrs.value[key] = value
    globalDocumentCompiler.setBlockAttrOverride(docId, { [key]: value })
    syncDomBlockAttrs(docId, { [key]: value })
    if (ctx.latestDoc.value?.config) {
      if (key === ATTR_DOC_THEME) ctx.latestDoc.value.config.theme = value
      if (key === ATTR_DOC_ASPECT_RATIO) ctx.latestDoc.value.config.aspectRatio = value
      if (key === ATTR_DOC_DEFAULT_TRANSITION) ctx.latestDoc.value.config.defaultTransition = value
      if (key === ATTR_DOC_BACKGROUND) ctx.latestDoc.value.config.background = value
    }
    triggerSaveNotice("更新中...")
    try {
      await setBlockAttrs(docId, { [key]: value })
      triggerSaveNotice("已更新")
      if (ctx.plugin) {
        await ctx.plugin.compileCurrentDocument(docId)
      }
    } catch (e) {
      triggerSaveNotice("更新失败")
    }
  }

  return {
    triggerSaveNotice,
    saveAttrs,
    saveAttr,
    getPageTargetBlockId,
    savePageAttr,
    applyPageLayoutAndRatio,
    saveDocAttr,
  }
}
