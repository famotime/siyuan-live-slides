import { showMessage } from "siyuan"
import { triggerPdfExport } from "@/export/pdf-exporter"
import { buildStandaloneHtml, downloadHtmlFile } from "@/export/single-html-exporter"
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
  const layout = createLayoutActions(ctx, { saveAttr, saveAttrs, savePageAttr })

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
    onToggleNoteBlock: notes.onToggleNoteBlock,
    createNoteBlockOnCurrentSlide: notes.createNoteBlockOnCurrentSlide,
    onAddNoteBlock: notes.onAddNoteBlock,
    onLocateNoteBlock: notes.onLocateNoteBlock,
    onGenerateNotesWithAI: notes.onGenerateNotesWithAI,
    isBatchProcessing: notes.isBatchProcessing,
    onBatchAppendNotes: notes.onBatchAppendNotes,
    onBatchDeleteNotes: notes.onBatchDeleteNotes,
    toggleElemClick: layout.toggleElemClick,
    onElemClickStepChange: layout.onElemClickStepChange,
    onElemMotionChange: layout.onElemMotionChange,
    onElemSlotChange: layout.onElemSlotChange,
    onElemShikiLinesChange: layout.onElemShikiLinesChange,
    onElemMaxHeightChange: layout.onElemMaxHeightChange,
    onSetTwoColsContrast: layout.onSetTwoColsContrast,
    onClearBlockAttrs: layout.onClearBlockAttrs,
    onInsertDividerBefore: layout.onInsertDividerBefore,
    onInsertDividerAfter: layout.onInsertDividerAfter,
    onDeleteCurrentBlock: layout.onDeleteCurrentBlock,
    resetSuperBlockWidth: layout.resetSuperBlockWidth,
    applyCloverLayout: layout.applyCloverLayout,
    onExportHtml,
    onExportPdf,
  }
}
