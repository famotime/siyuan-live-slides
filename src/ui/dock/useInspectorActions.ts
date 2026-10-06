import { ref, type ComputedRef, type Ref } from "vue"
import { confirm, showMessage } from "siyuan"
import {
  appendBlock,
  chatAI,
  deleteBlock,
  getBlockKramdown,
  insertBlock,
  setBlockAttrs,
  updateBlock,
} from "@/api"
import { generateSpeakerNotesWithAIDetailed } from "@/ai/notes-generator"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { extractCleanNoteText } from "@/compiler/slidev-ast-builder"
import { extractImageUrl } from "@/compiler/superblock-scanner"
import { triggerPdfExport } from "@/export/pdf-exporter"
import { buildStandaloneHtml, downloadHtmlFile } from "@/export/single-html-exporter"
import { syncDomBlockAttrs } from "@/sync/dom-attr-sync"
import { mirrorBlockSelection } from "@/sync/selection-mirror"
import type { ISlidevDocument, ISlidevVirtualPage } from "@/types/slidev-protocol"
import {
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_SPACING,
  ATTR_DOC_THEME,
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
} from "@/types/slidev-protocol"

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
  latestDoc: Ref<ISlidevDocument | null>
  targetSlide: ComputedRef<ISlidevVirtualPage | null>
  currentSlideNoteBlockId: ComputedRef<string>
  currentSlideLayout: ComputedRef<string>
  isNoteBlock: ComputedRef<boolean>
  elemClick: ComputedRef<string>
  videoAutoplay: ComputedRef<boolean>
  videoLoop: ComputedRef<boolean>
  videoMuted: ComputedRef<boolean>
  videoControls: ComputedRef<boolean>
  pageBackground: Ref<string>
  pageImage: Ref<string>
  elemShikiLines: Ref<string>
  elemMaxHeight: Ref<string>
  saveStatus: Ref<string>
  plugin?: any
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

export function useInspectorActions(ctx: IInspectorActionsContext) {
  const isBatchProcessing = ref(false)
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
    const targetId = ctx.activeBlockId.value || ctx.currentDocId.value
    if (!targetId) return

    ctx.activeBlockAttrs.value[key] = value
    globalDocumentCompiler.setBlockAttrOverride(targetId, { [key]: value })
    syncDomBlockAttrs(targetId, { [key]: value })

    const parentId = ctx.parentContainerId?.value
    const shouldSyncParent = Boolean(parentId && isContainerMainText(targetId, parentId))
    if (key === ATTR_ELEM_CLICK && shouldSyncParent && parentId) {
      if (ctx.parentContainerClicks) {
        ctx.parentContainerClicks.value = value
      }
      globalDocumentCompiler.setBlockAttrOverride(parentId, { [ATTR_ELEM_CLICK]: value })
      syncDomBlockAttrs(parentId, { [ATTR_ELEM_CLICK]: value })
      setBlockAttrs(parentId, { [ATTR_ELEM_CLICK]: value }).catch(() => {})
    }

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

  function getPageTargetBlockId(): string {
    const isCurDivider = ctx.activeBlockType.value === "NodeThematicBreak" || 
                         ctx.activeBlockType.value === "NodeThematicBreakBlock" || 
                         ctx.activeBlockType.value === "hr" || 
                         ctx.activeBlockType.value === "thematicbreak"
    return ctx.currentPageDividerId.value || (isCurDivider ? ctx.activeBlockId.value : "") || ctx.currentDocId.value
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

  async function createNoteBlockOnCurrentSlide(noteContent?: string) {
    const content = noteContent || "在此输入本页讲稿提词..."
    const noteLines = content.split(/\r?\n/).map(l => `> ${l}`).join("\n")
    const markdownPayload = `> [!NOTE] 💡 演讲备注\n${noteLines}\n{: custom-slidev-note="true"}`

    const slides = ctx.latestDoc.value?.slides || []
    const curSlide = ctx.targetSlide.value
    const curIdx = curSlide ? slides.findIndex(s => s === curSlide) : -1

    let insertedRes: any = null
    if (curIdx !== -1 && curIdx < slides.length - 1) {
      const nextSlide = slides[curIdx + 1]
      insertedRes = await insertBlock("markdown", markdownPayload, nextSlide.startBlockId)
    } else {
      const lastBlock = curSlide?.noteBlocks?.slice(-1)[0] || curSlide?.blocks?.slice(-1)[0]
      const previousId = lastBlock?.id || curSlide?.startBlockId
      if (previousId) {
        insertedRes = await insertBlock("markdown", markdownPayload, undefined, previousId)
      } else {
        insertedRes = await appendBlock("markdown", markdownPayload, ctx.currentDocId.value)
      }
    }

    const newId = insertedRes?.[0]?.doOperations?.[0]?.id || insertedRes?.[0]?.id
    if (newId) {
      await setBlockAttrs(newId, { [ATTR_ELEM_NOTE]: "true" })
      globalDocumentCompiler.setBlockAttrOverride(newId, { [ATTR_ELEM_NOTE]: "true" })
      mirrorBlockSelection(newId, ctx.plugin?.app)
    }

    if (ctx.plugin) {
      await ctx.plugin.compileCurrentDocument()
    }
    return newId
  }

  async function onToggleNoteBlock() {
    const targetId = ctx.activeBlockId.value
    if (!targetId) return

    if (!ctx.isNoteBlock.value) {
      triggerSaveNotice("转换中...")
      try {
        let sourceText = ctx.rawSnippet.value
        try {
          const kramdownRes = await getBlockKramdown(targetId)
          if (kramdownRes?.kramdown) {
            sourceText = kramdownRes.kramdown
          }
        } catch (_) {}

        const cleanContent = extractCleanNoteText(sourceText) || sourceText.replace(/<[^>]+>/g, "").trim() || "在此输入本页讲稿提词..."
        const noteBody = cleanContent.split(/\r?\n/).map(line => `> ${line}`).join("\n")
        const calloutMd = `> [!NOTE] 💡 演讲备注\n${noteBody}\n{: custom-slidev-note="true"}`

        await updateBlock("markdown", calloutMd, targetId)
        await setBlockAttrs(targetId, { [ATTR_ELEM_NOTE]: "true" })
        globalDocumentCompiler.setBlockAttrOverride(targetId, { [ATTR_ELEM_NOTE]: "true" })
        syncDomBlockAttrs(targetId, { [ATTR_ELEM_NOTE]: "true" })
        ctx.activeBlockAttrs.value[ATTR_ELEM_NOTE] = "true"
        ctx.activeBlockType.value = "NodeCallout"

        triggerSaveNotice("已设为讲稿备注")
        showMessage("已转为讲稿备注提示块（不在幻灯片中渲染）")

        if (ctx.plugin) {
          await ctx.plugin.compileCurrentDocument()
        }
      } catch (err) {
        console.error("[SiYuanSlidev] 转换讲稿备注提示块失败:", err)
        triggerSaveNotice("设置失败")
        showMessage("转为讲稿备注提示块失败")
      }
    } else {
      triggerSaveNotice("取消中...")
      try {
        await setBlockAttrs(targetId, { [ATTR_ELEM_NOTE]: "", "slidev-note": "" })
        globalDocumentCompiler.setBlockAttrOverride(targetId, { [ATTR_ELEM_NOTE]: "", "slidev-note": "" })
        syncDomBlockAttrs(targetId, { [ATTR_ELEM_NOTE]: "", "slidev-note": "" })
        delete ctx.activeBlockAttrs.value[ATTR_ELEM_NOTE]
        delete ctx.activeBlockAttrs.value["slidev-note"]

        triggerSaveNotice("已取消备注")
        showMessage("已取消讲稿备注")

        if (ctx.plugin) {
          await ctx.plugin.compileCurrentDocument()
        }
      } catch (err) {
        console.error("[SiYuanSlidev] 取消讲稿备注失败:", err)
        triggerSaveNotice("取消失败")
        showMessage("取消讲稿备注失败")
      }
    }
  }

  async function onAddNoteBlock() {
    try {
      await createNoteBlockOnCurrentSlide()
      showMessage("已在正文末尾插入讲稿备注提示块")
    } catch (err) {
      showMessage("插入讲稿备注块失败")
      console.error(err)
    }
  }

  function onLocateNoteBlock() {
    const blockId = ctx.currentSlideNoteBlockId.value
    if (!blockId) {
      showMessage("未找到本页关联的讲稿备注块")
      return
    }
    const ok = mirrorBlockSelection(blockId, ctx.plugin?.app)
    if (ok) {
      showMessage("已在编辑区定位讲稿备注块")
    } else {
      showMessage("定位讲稿备注块失败")
    }
  }

  async function onGenerateNotesWithAI() {
    if (!ctx.currentDocId.value) return

    const slideToUse: ISlidevVirtualPage = ctx.targetSlide.value || {
      pageIndex: 1,
      startBlockId: ctx.activeBlockId.value || ctx.currentDocId.value,
      frontmatter: {},
      notes: "",
      blocks: ctx.rawSnippet.value && ctx.rawSnippet.value !== "---"
        ? [{ id: ctx.activeBlockId.value, type: ctx.activeBlockType.value, content: ctx.rawSnippet.value, rawMarkdown: "" }]
        : [],
      rawMarkdown: ctx.rawSnippet.value && ctx.rawSnippet.value !== "---" ? ctx.rawSnippet.value : "",
    }

    showMessage("正在调用思源 AI 提炼本页讲稿提词...")
    const result = await generateSpeakerNotesWithAIDetailed(slideToUse, chatAI)
    if (result.notes) {
      const existingNoteBlockId = ctx.currentSlideNoteBlockId.value
      if (existingNoteBlockId) {
        const formattedNoteMd = `> [!NOTE] 💡 演讲备注\n${result.notes.split(/\r?\n/).map(l => `> ${l}`).join("\n")}\n{: custom-slidev-note="true"}`
        await updateBlock("markdown", formattedNoteMd, existingNoteBlockId)
        await setBlockAttrs(existingNoteBlockId, { [ATTR_ELEM_NOTE]: "true" })
        globalDocumentCompiler.setBlockAttrOverride(existingNoteBlockId, { [ATTR_ELEM_NOTE]: "true" })
        mirrorBlockSelection(existingNoteBlockId, ctx.plugin?.app)
      } else {
        await createNoteBlockOnCurrentSlide(result.notes)
      }
      if (result.isAiGenerated) {
        showMessage("思源 AI 演讲提词卡生成成功！")
      } else {
        showMessage("未获取到思源 AI 响应，已生成预设提词卡模板", 5000)
      }
      if (ctx.plugin) {
        await ctx.plugin.compileCurrentDocument()
      }
    }
  }

  async function onBatchAppendNotes() {
    if (isBatchProcessing.value) return
    const slides = ctx.latestDoc.value?.slides || []
    if (slides.length === 0) {
      showMessage("当前文档无幻灯片页面")
      return
    }

    // 过滤出未配置讲稿的页面（跳过已有讲稿块或讲稿文本的页面）
    const targetSlidesWithIndex = slides
      .map((s, idx) => ({ slide: s, idx }))
      .filter(({ slide }) => {
        const hasBlocks = Array.isArray(slide.noteBlocks) && slide.noteBlocks.length > 0
        const hasText = Boolean(slide.notes?.trim())
        return !hasBlocks && !hasText
      })

    if (targetSlidesWithIndex.length === 0) {
      showMessage("所有幻灯片页面均已存在讲稿备注块，无需追加")
      return
    }

    const targetCount = targetSlidesWithIndex.length
    confirm(
      "批量追加讲稿备注",
      `将在未配置讲稿的 ${targetCount} 页末尾自动插入讲稿提示块，是否继续？`,
      async () => {
        if (isBatchProcessing.value) return
        isBatchProcessing.value = true
        showMessage("正在批量追加讲稿块...")
        let successCount = 0
        try {
          const content = "在此输入本页讲稿提词..."
          const noteLines = content.split(/\r?\n/).map(l => `> ${l}`).join("\n")
          const markdownPayload = `> [!NOTE] 💡 演讲备注\n${noteLines}\n{: custom-slidev-note="true"}`

          for (const { slide, idx } of targetSlidesWithIndex) {
            try {
              let insertedRes: any = null
              if (idx < slides.length - 1) {
                const nextSlide = slides[idx + 1]
                insertedRes = await insertBlock("markdown", markdownPayload, nextSlide.startBlockId)
              } else {
                const lastBlock = slide?.noteBlocks?.slice(-1)[0] || slide?.blocks?.slice(-1)[0]
                const previousId = lastBlock?.id || slide?.startBlockId
                if (previousId) {
                  insertedRes = await insertBlock("markdown", markdownPayload, undefined, previousId)
                } else {
                  insertedRes = await appendBlock("markdown", markdownPayload, ctx.currentDocId.value)
                }
              }

              const newId = insertedRes?.[0]?.doOperations?.[0]?.id || insertedRes?.[0]?.id
              if (newId) {
                await setBlockAttrs(newId, { [ATTR_ELEM_NOTE]: "true" })
                globalDocumentCompiler.setBlockAttrOverride(newId, { [ATTR_ELEM_NOTE]: "true" })
              }
              successCount++
            } catch (err) {
              console.error(`[SiYuanSlidev] 为第 ${idx + 1} 页追加讲稿块失败:`, err)
            }
          }

          if (ctx.plugin) {
            await ctx.plugin.compileCurrentDocument()
          }
          showMessage(`已成功为 ${successCount} 页追加讲稿备注块`)
        } catch (error) {
          console.error("[SiYuanSlidev] 批量追加讲稿块失败:", error)
          showMessage("批量追加讲稿块时出现异常")
        } finally {
          isBatchProcessing.value = false
        }
      }
    )
  }

  async function onBatchDeleteNotes() {
    if (isBatchProcessing.value) return
    const slides = ctx.latestDoc.value?.slides || []
    if (slides.length === 0) {
      showMessage("当前文档无幻灯片页面")
      return
    }

    // 收集所有页面的讲稿块
    const allNoteBlocks: { id: string; pageIndex: number }[] = []
    for (const slide of slides) {
      if (slide.noteBlocks && slide.noteBlocks.length > 0) {
        for (const nb of slide.noteBlocks) {
          if (nb.id) {
            allNoteBlocks.push({ id: nb.id, pageIndex: slide.pageIndex })
          }
        }
      }
    }

    if (allNoteBlocks.length === 0) {
      showMessage("当前文档中没有讲稿备注块，无需删除")
      return
    }

    const affectedPagesCount = new Set(allNoteBlocks.map(b => b.pageIndex)).size
    const totalBlocks = allNoteBlocks.length

    confirm(
      "危险操作：批量删除所有讲稿块",
      `此操作将从正文中物理删除全部 ${totalBlocks} 个讲稿备注块（涉及 ${affectedPagesCount} 页），删除后无法撤销。是否确认继续？`,
      async () => {
        if (isBatchProcessing.value) return
        isBatchProcessing.value = true
        showMessage("正在批量删除讲稿块...")
        let deletedCount = 0
        try {
          for (const item of allNoteBlocks) {
            try {
              await deleteBlock(item.id)
              globalDocumentCompiler.clearBlockAttrOverride(item.id)
              deletedCount++
            } catch (err) {
              console.error(`[SiYuanSlidev] 删除讲稿块 ${item.id} 失败:`, err)
            }
          }

          if (ctx.activeBlockId.value && allNoteBlocks.some(b => b.id === ctx.activeBlockId.value)) {
            delete ctx.activeBlockAttrs.value[ATTR_ELEM_NOTE]
            delete ctx.activeBlockAttrs.value["slidev-note"]
          }

          if (ctx.plugin) {
            await ctx.plugin.compileCurrentDocument()
          }
          showMessage(`已成功删除全部 ${deletedCount} 个讲稿备注块`)
        } catch (error) {
          console.error("[SiYuanSlidev] 批量删除讲稿块失败:", error)
          showMessage("批量删除讲稿块时出现异常")
        } finally {
          isBatchProcessing.value = false
        }
      }
    )
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
      "slidev-note": "",
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

  function onExportHtml() {
    if (!ctx.latestDoc.value) {
      showMessage("请先在主编辑区打开幻灯片文档")
      return
    }
    const html = buildStandaloneHtml(ctx.latestDoc.value)
    const ok = downloadHtmlFile("presentation.html", html)
    if (ok) {
      showMessage("已开始下载单文件离线 HTML 演示包")
    }
  }

  function onExportPdf() {
    if (!ctx.latestDoc.value) {
      showMessage("请先在主编辑区打开幻灯片文档")
      return
    }
    const ok = triggerPdfExport(ctx.latestDoc.value)
    if (ok) {
      showMessage("已唤起打印视窗，请在打印选项中选择「另存为 PDF」")
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
      console.error("[useInspectorActions] resetSuperBlockWidth error:", e)
      showMessage("重置超级块比例失败")
    }
  }

  return {
    triggerSaveNotice,
    saveAttrs,
    saveAttr,
    savePageAttr,
    applyPageLayoutAndRatio,
    resetSuperBlockWidth,
    saveDocAttr,
    onToggleVideoAutoplay,
    onToggleVideoLoop,
    onToggleVideoMuted,
    onToggleVideoControls,
    onImageRoleChange,
    onToggleNoteBlock,
    createNoteBlockOnCurrentSlide,
    onAddNoteBlock,
    onLocateNoteBlock,
    onGenerateNotesWithAI,
    isBatchProcessing,
    onBatchAppendNotes,
    onBatchDeleteNotes,
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
    onExportHtml,
    onExportPdf,
  }
}
