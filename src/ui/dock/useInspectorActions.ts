import { ref } from "vue"
import { showMessage } from "siyuan"
import { triggerPdfExport } from "@/export/pdf-exporter"
import { exportStandaloneHtml, downloadHtmlFile } from "@/export/single-html-exporter"
import { runHeadlessImageExport, resolveDocumentTitle } from "@/export/image-exporter"
import { hasAllSlidesHidden } from "@/types/slides-protocol"
import { createAttrPersistence, type IInspectorActionsContext } from "./actions/attr-persistence"
import { createNotesActions } from "./actions/notes-actions"
import { createLayoutActions } from "./actions/layout-actions"

export type { IInspectorActionsContext } from "./actions/attr-persistence"

/**
 * Inspector Actions 统一门面：装配属性持久化、备注与 AI、版式与元素指令三个领域模块，
 * 并保留单文件 HTML / PDF 导出快捷操作。视图层依赖的返回面保持稳定。
 */
export function useInspectorActions(ctx: IInspectorActionsContext) {
  const {
    triggerSaveNotice,
    saveAttrs,
    saveAttr,
    savePageAttr,
    applyPageLayoutAndRatio,
    saveDocAttr,
  } = createAttrPersistence(ctx)

  const notes = createNotesActions(ctx, { triggerSaveNotice })
  const layout = createLayoutActions(ctx, {
    saveAttr,
    saveAttrs,
    savePageAttr,
    triggerSaveNotice,
    isBatchProcessing: notes.isBatchProcessing,
  })

  function ensureHasVisibleSlides() {
    const doc = ctx.latestDoc.value
    if (!doc) {
      showMessage("请先在主编辑区打开幻灯片文档")
      return null
    }
    if (hasAllSlidesHidden(doc)) {
      showMessage("当前文档所有页面均已隐藏，无可导出的可见幻灯片")
      return null
    }
    return doc
  }

  async function onExportHtml() {
    const doc = ensureHasVisibleSlides()
    if (!doc) return
    const title = await resolveDocumentTitle(doc, ctx.currentDocId?.value, ctx.plugin)
    showMessage("正在导出单文件离线 HTML（内联媒体资源中...）", 2000)
    const html = await exportStandaloneHtml(doc, { title })
    const ok = downloadHtmlFile(`${title}.html`, html)
    if (ok) {
      showMessage(`已开始下载单文件离线 HTML 演示包 (${title}.html)`)
    }
  }

  function onExportPdf() {
    const doc = ensureHasVisibleSlides()
    if (!doc) return
    const ok = triggerPdfExport(doc)
    if (ok) {
      showMessage("已唤起打印视窗，请在打印选项中选择「另存为 PDF」")
    }
  }

  const isExportingImages = ref(false)

  async function onExportImages() {
    if (isExportingImages.value) {
      showMessage("正在导出图片中，请稍候...", 2000)
      return
    }
    const doc = ensureHasVisibleSlides()
    if (!doc) return
    isExportingImages.value = true
    try {
      showMessage("正在启动后台沙箱并逐页导出幻灯片图片...")
      const title = await resolveDocumentTitle(doc, ctx.currentDocId?.value, ctx.plugin)
      const res = await runHeadlessImageExport(doc, {
        title,
        onProgress: (current, total) => {
          showMessage(`正在导出幻灯片图片 (${current} / ${total})...`, 2000)
        },
      })
      if (res.success) {
        showMessage(`🎉 成功导出 ${res.total || 0} 张幻灯片高清图片并已保存为 ${title}.zip！`, 4000)
      } else {
        showMessage(`导出图片失败：${res.error || "未知异常"}`)
      }
    } finally {
      isExportingImages.value = false
    }
  }

  return {
    triggerSaveNotice,
    saveAttrs,
    saveAttr,
    savePageAttr,
    applyPageLayoutAndRatio,
    saveDocAttr,
    onToggleVideoAutoplay: layout.onToggleVideoAutoplay,
    onToggleVideoLoop: layout.onToggleVideoLoop,
    onToggleVideoMuted: layout.onToggleVideoMuted,
    onToggleVideoControls: layout.onToggleVideoControls,
    onImageRoleChange: layout.onImageRoleChange,
    syncPageImageLayout: layout.syncPageImageLayout,
    onToggleNoteBlock: notes.onToggleNoteBlock,
    createNoteBlockOnCurrentSlide: notes.createNoteBlockOnCurrentSlide,
    onAddNoteBlock: notes.onAddNoteBlock,
    onLocateNoteBlock: notes.onLocateNoteBlock,
    onGenerateNotesWithAI: notes.onGenerateNotesWithAI,
    isGeneratingNotes: notes.isGeneratingNotes,
    isBatchProcessing: notes.isBatchProcessing,
    onBatchAppendNotes: notes.onBatchAppendNotes,
    onBatchDeleteNotes: notes.onBatchDeleteNotes,
    onIdentifyNotesBlocks: notes.onIdentifyNotesBlocks,
    onAddOrIdentifyNotesBlocks: notes.onAddOrIdentifyNotesBlocks,
    toggleElemClick: layout.toggleElemClick,
    onElemClickStepChange: layout.onElemClickStepChange,
    onElemMotionChange: layout.onElemMotionChange,
    onElemAnimChange: layout.onElemAnimChange,
    onElemSlotChange: layout.onElemSlotChange,
    onElemAlignChange: layout.onElemAlignChange,
    onElemShikiLinesChange: layout.onElemShikiLinesChange,
    onElemMaxHeightChange: layout.onElemMaxHeightChange,
    onSetTwoColsContrast: layout.onSetTwoColsContrast,
    onClearBlockAttrs: layout.onClearBlockAttrs,
    onInsertDividerBefore: layout.onInsertDividerBefore,
    onInsertDividerAfter: layout.onInsertDividerAfter,
    onDeleteCurrentBlock: layout.onDeleteCurrentBlock,
    onConvertToSuperBlock: layout.onConvertToSuperBlock,
    resetSuperBlockWidth: layout.resetSuperBlockWidth,
    applyCloverLayout: layout.applyCloverLayout,
    onAutoAnimateDocument: layout.onAutoAnimateDocument,
    onClearAnimationsDocument: layout.onClearAnimationsDocument,
    isExportingImages,
    onExportHtml,
    onExportPdf,
    onExportImages,
  }
}
