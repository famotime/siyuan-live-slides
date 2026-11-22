import { confirm, showMessage } from "siyuan"
import { deleteBlock, insertBlock, setBlockAttrs } from "@/api"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { extractImageUrl, findFourComponentSuperBlockInPage, isImageBlock } from "@/compiler/superblock-scanner"
import { syncDomBlockAttrs } from "@/sync/dom-attr-sync"
import {
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MAX_HEIGHT,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_ANIM,
  ATTR_ELEM_ANIM_PROPS,
  ATTR_ELEM_NOTE,
  ATTR_ELEM_ROLE,
  ATTR_ELEM_SHIKI_LINES,
  ATTR_ELEM_SLOT,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_IMAGE,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
  ATTR_PAGE_TRANSITION,
  ATTR_VIDEO_AUTOPLAY,
  ATTR_VIDEO_CONTROLS,
  ATTR_VIDEO_LOOP,
  ATTR_VIDEO_MUTED,
  ROLE_IMAGE_LEFT,
  ROLE_IMAGE_RIGHT,
} from "@/types/slides-protocol"
import {
  clearAnimationsForDocument,
  runAutoAnimationForDocument,
} from "@/sync/auto-animation-normalizer"
import { executeConvertToSuperBlock } from "@/sync/superblock-transform"
import type { IInspectorActionsContext } from "./attr-persistence"

export interface ILayoutActionsDeps {
  saveAttr: (key: string, value: string) => Promise<void>
  saveAttrs: (attrs: Record<string, string>) => Promise<void>
  savePageAttr: (key: string, value: string) => Promise<void>
  triggerSaveNotice?: (msg?: string) => void
  isBatchProcessing?: any
}

/**
 * 版式与元素指令领域模块：视频开关与图片角色、块级 v-click/v-motion/slot/Shiki 指令、
 * 分页符插入与删除、双栏对比、超级块宽度重置与四叶草版式编排。
 */
export function createLayoutActions(ctx: IInspectorActionsContext, deps: ILayoutActionsDeps) {
  const { saveAttr, saveAttrs, savePageAttr } = deps

  async function onToggleVideoAutoplay() {
    const nextVal = ctx.videoAutoplay.value ? "false" : "true"
    if (nextVal === "true") {
      await saveAttrs({
        [ATTR_VIDEO_AUTOPLAY]: "true",
        [ATTR_VIDEO_MUTED]: "true",
      })
      ctx.activeBlockAttrs.value[ATTR_VIDEO_AUTOPLAY] = "true"
      ctx.activeBlockAttrs.value[ATTR_VIDEO_MUTED] = "true"
    } else {
      await saveAttr(ATTR_VIDEO_AUTOPLAY, "false")
      ctx.activeBlockAttrs.value[ATTR_VIDEO_AUTOPLAY] = "false"
    }
  }

  async function onToggleVideoLoop() {
    const nextVal = ctx.videoLoop.value ? "false" : "true"
    await saveAttr(ATTR_VIDEO_LOOP, nextVal)
  }

  async function onToggleVideoMuted() {
    const nextVal = ctx.videoMuted.value ? "false" : "true"
    await saveAttr(ATTR_VIDEO_MUTED, nextVal)
  }

  async function onToggleVideoControls() {
    const nextVal = ctx.videoControls.value ? "false" : "true"
    await saveAttr(ATTR_VIDEO_CONTROLS, nextVal)
  }

  async function onImageRoleChange(role: string) {
    const targetId = ctx.activeBlockId.value
    if (!targetId) return

    const snippet = ctx.rawSnippet.value || ""
    const imgUrl = extractImageUrl(snippet) || ""
    const pageContainerId = ctx.currentPageDividerId.value || ctx.currentDocId.value

    if (!role) {
      const updates: Record<string, string> = {
        [ATTR_ELEM_ROLE]: "",
        [ATTR_PAGE_LAYOUT]: "",
      }
      if (ctx.activeBlockAttrs.value[ATTR_PAGE_BACKGROUND] === "true") {
        updates[ATTR_PAGE_BACKGROUND] = ""
      }
      if (pageContainerId && imgUrl && ctx.pageBackground?.value === imgUrl) {
        if (ctx.pageBackground) ctx.pageBackground.value = ""
        await setBlockAttrs(pageContainerId, { [ATTR_PAGE_BACKGROUND]: "" }).catch(() => {})
        globalDocumentCompiler.setBlockAttrOverride(pageContainerId, { [ATTR_PAGE_BACKGROUND]: "" })
        syncDomBlockAttrs(pageContainerId, { [ATTR_PAGE_BACKGROUND]: "" })
        if (ctx.targetSlide.value?.frontmatter) {
          delete ctx.targetSlide.value.frontmatter.background
        }
      }
      await saveAttrs(updates)

      if (typeof document !== "undefined") {
        const activeEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${targetId}"]`) as HTMLElement | null
        const parentLi = activeEl?.closest('[data-type="NodeListItem"]') as HTMLElement | null
        const parentLiId = parentLi?.getAttribute("data-node-id")
        if (parentLiId && parentLiId !== targetId) {
          const liUpdates = { [ATTR_PAGE_LAYOUT]: "", [ATTR_ELEM_ROLE]: "" }
          syncDomBlockAttrs(parentLiId, liUpdates)
          globalDocumentCompiler.setBlockAttrOverride(parentLiId, liUpdates)
          await setBlockAttrs(parentLiId, liUpdates).catch(() => {})
        }
      }
    } else if (role === "background") {
      const updates: Record<string, string> = {
        [ATTR_ELEM_ROLE]: "background",
        [ATTR_PAGE_LAYOUT]: "",
      }
      if (pageContainerId && imgUrl) {
        if (ctx.pageBackground) ctx.pageBackground.value = imgUrl
        await setBlockAttrs(pageContainerId, { [ATTR_PAGE_BACKGROUND]: imgUrl }).catch(() => {})
        globalDocumentCompiler.setBlockAttrOverride(pageContainerId, { [ATTR_PAGE_BACKGROUND]: imgUrl })
        syncDomBlockAttrs(pageContainerId, { [ATTR_PAGE_BACKGROUND]: imgUrl })
        if (ctx.targetSlide.value) {
          if (!ctx.targetSlide.value.frontmatter) {
            ctx.targetSlide.value.frontmatter = {}
          }
          ctx.targetSlide.value.frontmatter.background = imgUrl
        }
      }
      await saveAttrs(updates)
    } else if (role === ROLE_IMAGE_LEFT || role === ROLE_IMAGE_RIGHT) {
      await saveAttrs({
        [ATTR_PAGE_LAYOUT]: role,
        [ATTR_ELEM_ROLE]: "",
      })
    }
  }

  /**
   * 页面版式切换时同步图文配图标记：
   * - 切到 image-left / image-right：将本页配图来源块（已有来源优先，否则取正文流中最后一张纯图片块）
   *   标记为对应版式，并清除同页其它残留的图左/图右标记，保证配图仅出现在侧边栏；
   * - 切到其它版式：清除本页所有图左/图右标记，避免残留标记在预扫描时把页面版式强制改回图文版式。
   */
  async function syncPageImageLayout(layout: string): Promise<void> {
    const slide = ctx.targetSlide.value
    if (!slide) return

    const isImageLayout = layout === ROLE_IMAGE_LEFT || layout === ROLE_IMAGE_RIGHT
    const blocks = slide.blocks || []
    const nodeOf = (b: any) => b.rawNode || { id: b.id, type: b.type, markdown: b.rawMarkdown, content: b.content, ial: b.attributes || b.attrs || b.ial }
    const layoutOf = (b: any): string => {
      const ial = b.rawNode?.ial || b.attributes || b.attrs || b.ial || {}
      return ial[ATTR_PAGE_LAYOUT] || ""
    }
    const isMarked = (v: string) => v === ROLE_IMAGE_LEFT || v === ROLE_IMAGE_RIGHT

    // 当前携带图左/图右标记的块（含已被提取到侧边栏、不在正文流中的来源块）
    const markedIds = new Map<string, string>()
    for (const b of blocks) {
      if (b.id && isMarked(layoutOf(b))) markedIds.set(b.id, layoutOf(b))
    }
    if (slide.imageBlockId) markedIds.set(slide.imageBlockId, markedIds.get(slide.imageBlockId) || "")

    let sourceId = ""
    if (isImageLayout) {
      sourceId = slide.imageBlockId || ""
      if (!sourceId) {
        for (let i = blocks.length - 1; i >= 0; i--) {
          const b = blocks[i]
          const role = (b.attributes || b.attrs || b.ial || {})[ATTR_ELEM_ROLE]
          if (!b.id || role === "background") continue
          if (isImageBlock(nodeOf(b))) {
            sourceId = b.id
            break
          }
        }
      }
    }

    const writes: Array<[string, string]> = []
    if (sourceId && markedIds.get(sourceId) !== layout) writes.push([sourceId, layout])
    for (const id of markedIds.keys()) {
      if (id !== sourceId) writes.push([id, ""])
    }

    for (const [id, value] of writes) {
      const updates = { [ATTR_PAGE_LAYOUT]: value }
      globalDocumentCompiler.setBlockAttrOverride(id, updates)
      syncDomBlockAttrs(id, updates)
      await setBlockAttrs(id, updates).catch(() => {})
    }
  }

  function toggleElemClick() {
    if (ctx.elemClick.value) {
      saveAttr(ATTR_ELEM_CLICK, "")
    } else {
      saveAttr(ATTR_ELEM_CLICK, "+1")
    }
  }

  function onElemClickStepChange(step: string) {
    saveAttr(ATTR_ELEM_CLICK, step)
  }

  function onElemMotionChange(val: string) {
    if (val) {
      saveAttr(ATTR_ELEM_MOTION, val)
      saveAttr(ATTR_ELEM_ANIM, "")
      saveAttr(ATTR_ELEM_ANIM_PROPS, "")
    } else {
      saveAttr(ATTR_ELEM_MOTION, "")
    }
  }

  function onElemAnimChange(type: string, propsJson?: string) {
    if (type) {
      saveAttr(ATTR_ELEM_ANIM, type)
      saveAttr(ATTR_ELEM_ANIM_PROPS, propsJson || "")
      saveAttr(ATTR_ELEM_MOTION, "")
    } else {
      saveAttr(ATTR_ELEM_ANIM, "")
      saveAttr(ATTR_ELEM_ANIM_PROPS, "")
    }
  }

  function onElemSlotChange(slot: string) {
    const currentSlot = ctx.activeBlockAttrs.value[ATTR_ELEM_SLOT] || ""
    if (currentSlot === slot) {
      saveAttr(ATTR_ELEM_SLOT, "")
    } else {
      saveAttr(ATTR_ELEM_SLOT, slot)
    }
  }

  function onElemShikiLinesChange(val: string) {
    ctx.elemShikiLines.value = val
    saveAttr(ATTR_ELEM_SHIKI_LINES, val)
  }

  function onElemMaxHeightChange(val: string) {
    const trimmed = val ? val.trim() : ""
    const normalized = /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed
    ctx.elemMaxHeight.value = normalized
    saveAttr(ATTR_ELEM_MAX_HEIGHT, normalized)
  }

  async function onSetTwoColsContrast() {
    const isThreeCols = ctx.currentSlideLayout.value === "three-cols-header"
    const slotVal = isThreeCols ? "col-1" : "left"
    await saveAttr(ATTR_ELEM_SLOT, slotVal)
    showMessage(isThreeCols ? "已将当前块设置为第 1 栏" : "已将当前块设置为双栏左栏")
  }

  async function onClearBlockAttrs() {
    const targetId = ctx.activeBlockId.value
    if (!targetId) return

    confirm(
      "清除块演示属性",
      "确定要清除当前块的所有演示属性（包含动画、插槽、备注等）吗？此操作无法撤销。",
      async () => {
        const clearMap = {
          [ATTR_ELEM_CLICK]: "",
          [ATTR_ELEM_MOTION]: "",
          [ATTR_ELEM_ANIM]: "",
          [ATTR_ELEM_ANIM_PROPS]: "",
          [ATTR_ELEM_SLOT]: "",
          [ATTR_ELEM_SHIKI_LINES]: "",
          [ATTR_ELEM_MAX_HEIGHT]: "",
          [ATTR_ELEM_NOTE]: "",
          [ATTR_PAGE_LAYOUT]: "",
          [ATTR_PAGE_LAYOUT_RATIO]: "",
          [ATTR_ELEM_ROLE]: "",
          [ATTR_PAGE_TRANSITION]: "",
          [ATTR_PAGE_BACKGROUND]: "",
          [ATTR_PAGE_IMAGE]: "",
          [ATTR_VIDEO_AUTOPLAY]: "",
          [ATTR_VIDEO_LOOP]: "",
          [ATTR_VIDEO_MUTED]: "",
          [ATTR_VIDEO_CONTROLS]: "",
        }
        syncDomBlockAttrs(targetId, clearMap)
        await setBlockAttrs(targetId, clearMap)
        globalDocumentCompiler.clearBlockAttrOverride(targetId)

        if (typeof document !== "undefined") {
          const activeEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${targetId}"]`) as HTMLElement | null
          const parentLi = activeEl?.closest('[data-type="NodeListItem"]') as HTMLElement | null
          const parentLiId = parentLi?.getAttribute("data-node-id")
          if (parentLiId && parentLiId !== targetId) {
            syncDomBlockAttrs(parentLiId, clearMap)
            await setBlockAttrs(parentLiId, clearMap).catch(() => {})
            globalDocumentCompiler.clearBlockAttrOverride(parentLiId)
          }
        }

        ctx.activeBlockAttrs.value = {}
        ctx.elemShikiLines.value = ""
        ctx.elemMaxHeight.value = ""
        if (ctx.pageBackground) ctx.pageBackground.value = ""
        ctx.pageImage.value = ""
        showMessage("已清除本块演示属性")
        if (ctx.plugin) {
          await ctx.plugin.compileCurrentDocument()
        }
      }
    )
  }

  async function onInsertDividerBefore() {
    if (!ctx.activeBlockId.value) return
    try {
      await insertBlock("markdown", "---", ctx.activeBlockId.value, undefined)
      showMessage("已在上方插入分页符")
      if (ctx.plugin) ctx.plugin.compileCurrentDocument()
    } catch (e) {
      showMessage("插入分页符失败")
    }
  }

  async function onInsertDividerAfter() {
    const targetId = ctx.activeBlockId.value || ctx.currentDocId.value
    if (!targetId) return
    try {
      await insertBlock("markdown", "---", undefined, targetId)
      showMessage("已在下方插入分页符")
      if (ctx.plugin) ctx.plugin.compileCurrentDocument()
    } catch (e) {
      showMessage("插入分页符失败")
    }
  }

  async function onDeleteCurrentBlock() {
    if (!ctx.activeBlockId.value) return
    try {
      await deleteBlock(ctx.activeBlockId.value)
      showMessage("已删除该分页符")
      ctx.activeBlockId.value = ""
      ctx.activeBlockType.value = ""
      if (ctx.plugin) ctx.plugin.compileCurrentDocument()
    } catch (e) {
      showMessage("删除失败")
    }
  }

  /**
   * 重置当前页面横向超级块的各列宽度分布为默认均分
   * 清空思源中各子块的 inline style width，恢复思源默认平均分布
   */
  async function resetSuperBlockWidth() {
    try {
      let sbEl: Element | null = null
      if (typeof document !== "undefined") {
        const activeId = ctx.activeBlockId.value
        if (activeId) {
          const activeEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${activeId}"]`)
          if (activeEl) {
            sbEl = activeEl.getAttribute("data-type") === "NodeSuperBlock" ? activeEl : activeEl.closest('[data-type="NodeSuperBlock"]')
          }
        }
        if (!sbEl) {
          const divId = ctx.currentPageDividerId.value || (ctx.activeBlockType.value === "hr" || ctx.activeBlockType.value === "NodeThematicBreak" ? ctx.activeBlockId.value : "")
          if (divId) {
            const divEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${divId}"]`)
            if (divEl) {
              let sibling = divEl.nextElementSibling
              while (sibling) {
                if (sibling.getAttribute("data-type") === "NodeThematicBreak" || sibling.classList?.contains("protyle-wysiwyg__block--hr")) {
                  break
                }
                const found = sibling.getAttribute("data-type") === "NodeSuperBlock" ? sibling : sibling.querySelector('[data-type="NodeSuperBlock"]')
                if (found) {
                  sbEl = found
                  break
                }
                sibling = sibling.nextElementSibling
              }
            }
          } else {
            // 首页
            const firstDivider = document.querySelector('.protyle-wysiwyg [data-type="NodeThematicBreak"], .protyle-wysiwyg .protyle-wysiwyg__block--hr')
            const allSuperBlocks = Array.from(document.querySelectorAll('.protyle-wysiwyg [data-type="NodeSuperBlock"]'))
            for (const sb of allSuperBlocks) {
              if (!firstDivider || (sb.compareDocumentPosition(firstDivider) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                sbEl = sb
                break
              }
            }
          }
        }
      }

      const childIds: string[] = []
      if (sbEl) {
        const children = Array.from(sbEl.querySelectorAll(":scope > [data-node-id]")) as HTMLElement[]
        for (const child of children) {
          const cid = child.getAttribute("data-node-id")
          if (cid) {
            childIds.push(cid)
            child.removeAttribute("style")
          }
        }
      } else if (ctx.targetSlide.value?.blocks) {
        // 从 AST 回退获取子块 ID
        for (const b of ctx.targetSlide.value.blocks) {
          if (b.children && b.children.length >= 2) {
            for (const c of b.children) {
              if (c.id) childIds.push(c.id)
            }
            break
          }
        }
      }

      if (childIds.length > 0) {
        for (const cid of childIds) {
          await setBlockAttrs(cid, { style: "" }).catch(() => {})
        }
      }

      // 重置页面上的分栏比例配置为均分
      await savePageAttr(ATTR_PAGE_LAYOUT_RATIO, "")

      showMessage("已重置超级块为平均分布比例")
      if (ctx.plugin) {
        await ctx.plugin.compileCurrentDocument()
      }
    } catch (e) {
      console.error("[layout-actions] resetSuperBlockWidth error:", e)
      showMessage("重置超级块比例失败")
    }
  }

  async function applyCloverLayout(): Promise<boolean> {
    try {
      interface IFourCandidate {
        sbId: string
        itemIds: string[]
        headerId?: string
      }
      let found: IFourCandidate | null = null

      // 1. DOM 优先搜索（若在浏览器 Protyle 环境下）
      if (typeof document !== "undefined") {
        const divId = ctx.currentPageDividerId.value || (ctx.activeBlockType.value === "hr" || ctx.activeBlockType.value === "NodeThematicBreak" ? ctx.activeBlockId.value : "")
        const activeId = ctx.activeBlockId.value
        const scopeElements: Element[] = []

        if (divId) {
          const divEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${divId}"]`)
          if (divEl) {
            let sibling = divEl.nextElementSibling
            while (sibling) {
              if (sibling.getAttribute("data-type") === "NodeThematicBreak" || sibling.classList?.contains("protyle-wysiwyg__block--hr")) {
                break
              }
              scopeElements.push(sibling)
              sibling = sibling.nextElementSibling
            }
          }
        } else {
          // 首页
          const firstDivider = document.querySelector('.protyle-wysiwyg [data-type="NodeThematicBreak"], .protyle-wysiwyg .protyle-wysiwyg__block--hr')
          const allWysiwygChildren = Array.from(document.querySelectorAll('.protyle-wysiwyg > [data-node-id]'))
          for (const el of allWysiwygChildren) {
            if (!firstDivider || (el.compareDocumentPosition(firstDivider) & Node.DOCUMENT_POSITION_FOLLOWING)) {
              scopeElements.push(el)
            } else {
              break
            }
          }
        }

        const candidates: IFourCandidate[] = []
        let lastHeaderId: string | undefined

        for (const el of scopeElements) {
          const dt = el.getAttribute("data-type")
          if (dt === "NodeHeading") {
            lastHeaderId = el.getAttribute("data-node-id") || undefined
          }

          const sbs: Element[] = []
          if (dt === "NodeSuperBlock") {
            sbs.push(el)
          } else {
            sbs.push(...Array.from(el.querySelectorAll('[data-type="NodeSuperBlock"]')))
          }

          for (const sb of sbs) {
            const sbLayout = (sb.getAttribute("data-sb-layout") || "").toLowerCase()
            if (sbLayout === "row") continue

            const sbId = sb.getAttribute("data-node-id") || ""
            let candidateItemIds: string[] = []

            // A: 优先检查内部列表项 (4 个列表项)
            const listItems = Array.from(sb.querySelectorAll('[data-type="NodeListItem"]'))
            if (listItems.length === 4) {
              candidateItemIds = listItems.map(li => li.getAttribute("data-node-id")).filter(Boolean) as string[]
            }

            // B: 兼容直接 4 个内容子块
            if (candidateItemIds.length !== 4) {
              const directChildren = Array.from(sb.querySelectorAll(':scope > [data-node-id]'))
              if (directChildren.length === 4) {
                candidateItemIds = directChildren.map(c => c.getAttribute("data-node-id")).filter(Boolean) as string[]
              }
            }

            if (candidateItemIds.length === 4) {
              candidates.push({
                sbId,
                itemIds: candidateItemIds,
                headerId: lastHeaderId,
              })
            }
          }
        }

        if (candidates.length > 0) {
          if (activeId) {
            found = candidates.find(c => {
              if (c.sbId === activeId) return true
              if (c.itemIds.includes(activeId)) return true
              const el = document.querySelector(`.protyle-wysiwyg [data-node-id="${c.sbId}"]`)
              const activeEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${activeId}"]`)
              return Boolean(el && activeEl && el.contains(activeEl))
            }) || null
          }
          if (!found) {
            found = candidates[0]
          }
        }
      }

      // 2. AST 回退（若 DOM 搜索未找到或在测试/无 DOM 环境）
      if (!found && ctx.targetSlide.value?.blocks) {
        const slide = ctx.targetSlide.value
        const astBlocks: any[] = []
        for (const b of slide.blocks) {
          if (b.rawNode) {
            astBlocks.push(b.rawNode)
          } else {
            astBlocks.push({
              id: b.id,
              type: b.type,
              content: b.content,
              markdown: b.rawMarkdown,
              children: b.children,
              ial: b.attributes || b.ial || {},
            })
          }
        }
        const astMatch = findFourComponentSuperBlockInPage(astBlocks, ctx.activeBlockId.value)
        if (astMatch && astMatch.items.length === 4) {
          found = {
            sbId: astMatch.superBlockNode.id,
            itemIds: astMatch.items.map(it => it.id),
            headerId: astMatch.headerNode?.id,
          }
        }
      }

      // 3. 执行设置：配置 clover 版式
      const pageTargetId = ctx.currentPageDividerId.value || ctx.currentDocId.value
      if (pageTargetId) {
        ctx.currentPageDividerLayout.value = "clover"
        if (ctx.targetSlide.value) {
          if (!ctx.targetSlide.value.frontmatter) {
            ctx.targetSlide.value.frontmatter = {}
          }
          ctx.targetSlide.value.frontmatter.layout = "clover"
        }
        globalDocumentCompiler.setBlockAttrOverride(pageTargetId, { [ATTR_PAGE_LAYOUT]: "clover" })
        syncDomBlockAttrs(pageTargetId, { [ATTR_PAGE_LAYOUT]: "clover" })
        await setBlockAttrs(pageTargetId, { [ATTR_PAGE_LAYOUT]: "clover" }).catch(() => {})
      }

      // 4. 若匹配到超级块或组件，自动补全表头与 col-1 ~ col-N 插槽
      if (found && found.itemIds.length > 0) {
        if (found.headerId) {
          globalDocumentCompiler.setBlockAttrOverride(found.headerId, { [ATTR_ELEM_SLOT]: "header" })
          syncDomBlockAttrs(found.headerId, { [ATTR_ELEM_SLOT]: "header" })
          await setBlockAttrs(found.headerId, { [ATTR_ELEM_SLOT]: "header" }).catch(() => {})
        }

        const slotCount = Math.min(4, found.itemIds.length)
        for (let i = 0; i < slotCount; i++) {
          const itemId = found.itemIds[i]
          const slotName = `col-${i + 1}`
          globalDocumentCompiler.setBlockAttrOverride(itemId, { [ATTR_ELEM_SLOT]: slotName })
          syncDomBlockAttrs(itemId, { [ATTR_ELEM_SLOT]: slotName })
          await setBlockAttrs(itemId, { [ATTR_ELEM_SLOT]: slotName }).catch(() => {})
        }
      }

      showMessage("已将本页版式设为四叶草（田字型）布局")
      if (ctx.plugin) {
        await ctx.plugin.compileCurrentDocument()
      }
      return true
    } catch (e) {
      console.error("[layout-actions] applyCloverLayout error:", e)
      showMessage("配置四叶草布局失败", 4000, "error")
      return false
    }
  }

  async function onAutoAnimateDocument() {
    const docId = ctx.currentDocId.value || ctx.plugin?.currentDocId
    if (!docId) {
      showMessage("请先在主编辑区打开幻灯片文档")
      return
    }
    if (deps.isBatchProcessing?.value) {
      showMessage("正在批量处理中，请稍候...")
      return
    }

    if (deps.isBatchProcessing) {
      deps.isBatchProcessing.value = true
    }
    try {
      await runAutoAnimationForDocument(docId, {
        onSuccessNotice: deps.triggerSaveNotice,
        compileCurrentDocFn: async () => {
          if (ctx.plugin) {
            await ctx.plugin.compileCurrentDocument()
          }
        },
      })
    } finally {
      if (deps.isBatchProcessing) {
        deps.isBatchProcessing.value = false
      }
    }
  }

  async function onClearAnimationsDocument() {
    const docId = ctx.currentDocId.value || ctx.plugin?.currentDocId
    if (!docId) {
      showMessage("请先在主编辑区打开幻灯片文档")
      return
    }
    if (deps.isBatchProcessing?.value) {
      showMessage("正在批量处理中，请稍候...")
      return
    }

    if (deps.isBatchProcessing) {
      deps.isBatchProcessing.value = true
    }
    try {
      const res = await clearAnimationsForDocument(docId, {
        onSuccessNotice: deps.triggerSaveNotice,
        compileCurrentDocFn: async () => {
          if (ctx.plugin) {
            await ctx.plugin.compileCurrentDocument()
          }
        },
      })
      if (res.successCount > 0 && ctx.activeBlockId.value && res.targets.some(t => t.blockId === ctx.activeBlockId.value)) {
        delete ctx.activeBlockAttrs.value[ATTR_ELEM_CLICK]
        delete ctx.activeBlockAttrs.value[ATTR_ELEM_MOTION]
      }
    } finally {
      if (deps.isBatchProcessing) {
        deps.isBatchProcessing.value = false
      }
    }
  }

  async function onConvertToSuperBlock() {
    const res = await executeConvertToSuperBlock({
      currentDocId: ctx.currentDocId?.value || "",
      activeBlockId: ctx.activeBlockId?.value || "",
    })

    if (!res.success) {
      showMessage(res.error || "合并为横向超级块失败")
      return
    }

    const notice = `🎉 已成功合并为横向超级块 (${res.colCount || 2} 列)`
    showMessage(notice)
    if (deps.triggerSaveNotice) {
      deps.triggerSaveNotice(notice)
    }

    if (ctx.plugin?.compileCurrentDocument) {
      await ctx.plugin.compileCurrentDocument(ctx.currentDocId?.value)
    }
  }

  return {
    onToggleVideoAutoplay,
    onToggleVideoLoop,
    onToggleVideoMuted,
    onToggleVideoControls,
    onImageRoleChange,
    syncPageImageLayout,
    toggleElemClick,
    onElemClickStepChange,
    onElemMotionChange,
    onElemAnimChange,
    onElemSlotChange,
    onElemShikiLinesChange,
    onElemMaxHeightChange,
    onSetTwoColsContrast,
    onClearBlockAttrs,
    onInsertDividerBefore,
    onInsertDividerAfter,
    onDeleteCurrentBlock,
    onConvertToSuperBlock,
    resetSuperBlockWidth,
    applyCloverLayout,
    onAutoAnimateDocument,
    onClearAnimationsDocument,
  }
}
