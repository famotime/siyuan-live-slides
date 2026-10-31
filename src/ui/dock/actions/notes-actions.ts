import { ref } from "vue"
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
import { extractCleanNoteText } from "@/compiler/slides-ast-builder"
import { syncDomBlockAttrs } from "@/sync/dom-attr-sync"
import { mirrorBlockSelection } from "@/sync/selection-mirror"
import type { ISlidesVirtualPage } from "@/types/slides-protocol"
import { ATTR_ELEM_NOTE } from "@/types/slides-protocol"
import type { IInspectorActionsContext } from "./attr-persistence"

export interface INotesActionsDeps {
  triggerSaveNotice: (msg?: string) => void
}

export interface INotesActions {
  isBatchProcessing: ReturnType<typeof ref<boolean>>
  createNoteBlockOnCurrentSlide: (noteContent?: string) => Promise<string | undefined>
  onToggleNoteBlock: () => Promise<void>
  onAddNoteBlock: () => Promise<void>
  onLocateNoteBlock: () => void
  onGenerateNotesWithAI: () => Promise<void>
  onBatchAppendNotes: () => Promise<void>
  onBatchDeleteNotes: () => Promise<void>
}

/**
 * 备注与 AI 领域模块：讲稿备注块的创建/转换/定位、
 * 思源 AI 提词生成，以及跨页批量追加与批量删除（含并发守卫）。
 */
export function createNotesActions(ctx: IInspectorActionsContext, deps: INotesActionsDeps): INotesActions {
  const isBatchProcessing = ref(false)
  const { triggerSaveNotice } = deps

  async function createNoteBlockOnCurrentSlide(noteContent?: string) {
    const content = noteContent || "在此输入本页讲稿提词..."
    const noteLines = content.split(/\r?\n/).map(l => `> ${l}`).join("\n")
    const markdownPayload = `> [!NOTE] 💡 演讲备注\n${noteLines}\n{: custom-slides-note="true"}`

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
        const calloutMd = `> [!NOTE] 💡 演讲备注\n${noteBody}\n{: custom-slides-note="true"}`

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
        console.error("[SiYuanLiveSlides] 转换讲稿备注提示块失败:", err)
        triggerSaveNotice("设置失败")
        showMessage("转为讲稿备注提示块失败")
      }
    } else {
      triggerSaveNotice("取消中...")
      try {
        await setBlockAttrs(targetId, { [ATTR_ELEM_NOTE]: "", "slides-note": "" })
        globalDocumentCompiler.setBlockAttrOverride(targetId, { [ATTR_ELEM_NOTE]: "", "slides-note": "" })
        syncDomBlockAttrs(targetId, { [ATTR_ELEM_NOTE]: "", "slides-note": "" })
        delete ctx.activeBlockAttrs.value[ATTR_ELEM_NOTE]
        delete ctx.activeBlockAttrs.value["slides-note"]

        triggerSaveNotice("已取消备注")
        showMessage("已取消讲稿备注")

        if (ctx.plugin) {
          await ctx.plugin.compileCurrentDocument()
        }
      } catch (err) {
        console.error("[SiYuanLiveSlides] 取消讲稿备注失败:", err)
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

    const slideToUse: ISlidesVirtualPage = ctx.targetSlide.value || {
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
        const formattedNoteMd = `> [!NOTE] 💡 演讲备注\n${result.notes.split(/\r?\n/).map(l => `> ${l}`).join("\n")}\n{: custom-slides-note="true"}`
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
          const markdownPayload = `> [!NOTE] 💡 演讲备注\n${noteLines}\n{: custom-slides-note="true"}`

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
              console.error(`[SiYuanLiveSlides] 为第 ${idx + 1} 页追加讲稿块失败:`, err)
            }
          }

          if (ctx.plugin) {
            await ctx.plugin.compileCurrentDocument()
          }
          showMessage(`已成功为 ${successCount} 页追加讲稿备注块`)
        } catch (error) {
          console.error("[SiYuanLiveSlides] 批量追加讲稿块失败:", error)
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
              console.error(`[SiYuanLiveSlides] 删除讲稿块 ${item.id} 失败:`, err)
            }
          }

          if (ctx.activeBlockId.value && allNoteBlocks.some(b => b.id === ctx.activeBlockId.value)) {
            delete ctx.activeBlockAttrs.value[ATTR_ELEM_NOTE]
            delete ctx.activeBlockAttrs.value["slides-note"]
          }

          if (ctx.plugin) {
            await ctx.plugin.compileCurrentDocument()
          }
          showMessage(`已成功删除全部 ${deletedCount} 个讲稿备注块`)
        } catch (error) {
          console.error("[SiYuanLiveSlides] 批量删除讲稿块失败:", error)
          showMessage("批量删除讲稿块时出现异常")
        } finally {
          isBatchProcessing.value = false
        }
      }
    )
  }

  return {
    isBatchProcessing,
    createNoteBlockOnCurrentSlide,
    onToggleNoteBlock,
    onAddNoteBlock,
    onLocateNoteBlock,
    onGenerateNotesWithAI,
    onBatchAppendNotes,
    onBatchDeleteNotes,
  }
}
