import { showMessage } from "siyuan"
import { deleteBlock, insertBlock, setBlockAttrs } from "@/api"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { extractImageUrl, findFourComponentSuperBlockInPage } from "@/compiler/superblock-scanner"
import { syncDomBlockAttrs } from "@/sync/dom-attr-sync"
import {
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MAX_HEIGHT,
  ATTR_ELEM_MOTION,
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
import type { IInspectorActionsContext } from "./attr-persistence"

export interface ILayoutActionsDeps {
  saveAttr: (key: string, value: string) => Promise<void>
  saveAttrs: (attrs: Record<string, string>) => Promise<void>
  savePageAttr: (key: string, value: string) => Promise<void>
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
      if (pageContainerId && imgUrl && ctx.pageBackground.value === imgUrl) {
        ctx.pageBackground.value = ""
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
        ctx.pageBackground.value = imgUrl
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
    saveAttr(ATTR_ELEM_MOTION, val)
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
    ctx.elemMaxHeight.value = val
    saveAttr(ATTR_ELEM_MAX_HEIGHT, val)
  }

  async function onSetTwoColsContrast() {
    const isThreeCols = ctx.currentSlideLayout.value === "three-cols-header"
    const slotVal = isThreeCols ? "col-1" : "left"
    await saveAttr(ATTR_ELEM_SLOT, slotVal)
    showMessage(isThreeCols ? "已将当前块设置为第 1 栏 (col-1)" : "已将当前块设置为双栏左栏 (left)")
  }

  async function onClearBlockAttrs() {
    const targetId = ctx.activeBlockId.value
    if (!targetId) return
    const clearMap = {
      [ATTR_ELEM_CLICK]: "",
      [ATTR_ELEM_MOTION]: "",
      [ATTR_ELEM_SLOT]: "",
      [ATTR_ELEM_SHIKI_LINES]: "",
      [ATTR_ELEM_MAX_HEIGHT]: "",
      [ATTR_ELEM_NOTE]: "",
      "slides-note": "",
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
    ctx.pageBackground.value = ""
    ctx.pageImage.value = ""
    showMessage("已清除本块演示属性")
    if (ctx.plugin) {
      await ctx.plugin.compileCurrentDocument()
    }
  }

  async function onInsertDividerBefore() {
    if (!ctx.activeBlockId.value) return
    try {
      await insertBlock("markdown", "---", ctx.activeBlockId.value, undefined)
      showMessage("已在上方插入分页符 (---)")
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
      showMessage("已在下方插入分页符 (---)")
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
        let scopeElements: Element[] = []

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
        let lastHeaderId: string | undefined = undefined

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

  return {
    onToggleVideoAutoplay,
    onToggleVideoLoop,
    onToggleVideoMuted,
    onToggleVideoControls,
    onImageRoleChange,
    toggleElemClick,
    onElemClickStepChange,
    onElemMotionChange,
    onElemSlotChange,
    onElemShikiLinesChange,
    onElemMaxHeightChange,
    onSetTwoColsContrast,
    onClearBlockAttrs,
    onInsertDividerBefore,
    onInsertDividerAfter,
    onDeleteCurrentBlock,
    resetSuperBlockWidth,
    applyCloverLayout,
  }
}
