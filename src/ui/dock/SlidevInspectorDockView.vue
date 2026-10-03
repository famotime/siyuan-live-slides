<template>
  <div class="spm-slidev-inspector">
    <!-- 面板顶栏 -->
    <div class="spm-inspector-topbar">
      <div class="spm-inspector-title">
        <svg class="spm-inspector-icon" aria-hidden="true">
          <use xlink:href="#iconSlidev"></use>
        </svg>
        <span>演示配置</span>
      </div>

      <div class="spm-inspector-topbar-actions">
        <!-- 导入 Slidev 演示文档 -->
        <button
          class="spm-btn-pill spm-btn-secondary"
          title="导入 Slidev 演示文档 (.md / .zip)"
          @click="showImportDialog = true"
        >
          📥 导入
        </button>

        <!-- 快捷打开下方分屏预览 -->
        <button
          class="spm-btn-pill spm-btn-primary"
          title="在当前文档下方开启分屏预览 (Alt+P)"
          @click="onOpenBottomPreview"
        >
          🖥️ 分屏预览
        </button>
      </div>
    </div>

    <!-- 状态指示条：当前聚焦块元信息 -->
    <div class="spm-target-banner">
      <div class="spm-target-info">
        <span class="spm-target-tag" :class="targetTagClass">{{ targetTagLabel }}</span>
        <span class="spm-target-id" :title="activeBlockId || currentDocId">
          ID: {{ displayShortId }}
        </span>
      </div>
      <span v-if="saveStatus" class="spm-save-status">{{ saveStatus }}</span>
    </div>

    <div class="spm-inspector-body">
      <!-- 场景 A：分页符页面级配置 (水平分割线 ---) -->
      <PageInspectorSection
        v-if="isDivider"
        :page-layout="pageLayout"
        :page-transition="pageTransition"
        :page-background="pageBackground"
        :page-notes="pageNotes"
        @update:page-layout="onLayoutChange"
        @update:page-transition="onTransitionChange"
        @update:page-background="onBackgroundChange"
        @update:page-notes="onNotesChange"
        @generate-notes="onGenerateNotesWithAI"
        @insert-divider-after="onInsertDividerAfter"
        @delete-divider="onDeleteCurrentBlock"
      />

      <!-- 场景 B：普通内容块 (段落、标题、列表、表格、代码块等) -->
      <BlockInspectorSection
        v-else-if="activeBlockId && !isDocRoot"
        :block-content-snippet="blockContentSnippet"
        :elem-click="elemClick"
        :elem-slot="elemSlot"
        :elem-shiki-lines="elemShikiLines"
        :is-code-block="isCodeBlock"
        :has-block-attrs="hasBlockAttrs"
        @toggle-elem-click="toggleElemClick"
        @update:elem-click="onElemClickStepChange"
        @update:elem-slot="onElemSlotChange"
        @update:elem-shiki-lines="onElemShikiLinesChange"
        @insert-divider-before="onInsertDividerBefore"
        @insert-divider-after="onInsertDividerAfter"
        @set-two-cols-contrast="onSetTwoColsContrast"
        @clear-block-attrs="onClearBlockAttrs"
      />

      <!-- 场景 C：全局文档演示配置 (未聚焦具体块或选中文档头) -->
      <DocInspectorSection
        v-else
        :doc-theme="docTheme"
        :doc-aspect-ratio="docAspectRatio"
        :doc-default-transition="docDefaultTransition"
        @update:doc-theme="onDocThemeChange"
        @update:doc-aspect-ratio="onDocAspectRatioChange"
        @update:doc-default-transition="onDocTransitionChange"
        @open-bottom-preview="onOpenBottomPreview"
        @open-presenter="onOpenPresenter"
        @ai-auto-split="onAiAutoSplit"
        @export-html="onExportHtml"
        @export-pdf="onExportPdf"
      />
    </div>

    <!-- 导入 Slidev 演示对话框 -->
    <SlidevImportDialog
      v-if="showImportDialog"
      @close="showImportDialog = false"
      @success="onImportSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import type { Plugin } from 'siyuan'
import { showMessage } from 'siyuan'
import { setBlockAttrs, insertBlock, deleteBlock, chatAI } from '@/api'
import PageInspectorSection from '@/ui/components/PageInspectorSection.vue'
import BlockInspectorSection from '@/ui/components/BlockInspectorSection.vue'
import DocInspectorSection from '@/ui/components/DocInspectorSection.vue'
import SlidevImportDialog from '@/ui/components/SlidevImportDialog.vue'
import { generateSpeakerNotesWithAI } from '@/ai/notes-generator'
import { buildStandaloneHtml, downloadHtmlFile } from '@/export/single-html-exporter'
import { triggerPdfExport } from '@/export/pdf-exporter'
import type {
  IActiveBlockInfo,
  ISlidevDocument,
} from '@/types/slidev-protocol'
import {
  ATTR_DOC_THEME,
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_TRANSITION,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_NOTES,
  ATTR_ELEM_CLICK,
  ATTR_ELEM_SLOT,
  ATTR_ELEM_SHIKI_LINES,
} from '@/types/slidev-protocol'

const plugin = inject<any>('plugin')
const showImportDialog = ref(false)

function onImportSuccess(data: { docId: string }) {
  showImportDialog.value = false
  currentDocId.value = data.docId
  if (plugin?.compileCurrentDocument) {
    plugin.compileCurrentDocument(data.docId)
  }
}

// 当前激活块元信息
const activeBlockId = ref('')
const activeBlockType = ref('')
const activeBlockAttrs = ref<Record<string, string>>({})
const blockContentSnippet = ref('')
const currentDocId = ref('')
const latestDoc = ref<ISlidevDocument | null>(null)
const saveStatus = ref('')

let saveTimer: number | null = null

function triggerSaveNotice(msg = '已同步') {
  saveStatus.value = msg
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveStatus.value = ''
  }, 1200)
}

// 目标标签
const isDivider = computed(() => activeBlockType.value === 'NodeThematicBreak')
const isCodeBlock = computed(() => activeBlockType.value === 'NodeCodeBlock')
const isDocRoot = computed(() => !activeBlockId.value || activeBlockId.value === currentDocId.value)

const displayShortId = computed(() => {
  const id = activeBlockId.value || currentDocId.value || ''
  return id.length > 8 ? id.slice(-8) : id || '无'
})

const targetTagLabel = computed(() => {
  if (isDivider.value) return '分页符 (---)'
  if (isDocRoot.value) return '全局文档'
  switch (activeBlockType.value) {
    case 'NodeHeading': return '标题块'
    case 'NodeParagraph': return '段落块'
    case 'NodeCodeBlock': return '代码块'
    case 'NodeList':
    case 'NodeListItem': return '列表项'
    case 'NodeBlockquote': return '引述块'
    case 'NodeTable': return '表格块'
    default: return '内容块'
  }
})

const targetTagClass = computed(() => {
  if (isDivider.value) return 'tag-divider'
  if (isDocRoot.value) return 'tag-doc'
  return 'tag-block'
})

// 分页符属性绑定
const pageLayout = computed(() => activeBlockAttrs.value[ATTR_PAGE_LAYOUT] || 'default')
const pageTransition = computed(() => activeBlockAttrs.value[ATTR_PAGE_TRANSITION] || 'slide-left')
const pageBackground = ref('')
const pageNotes = ref('')

// 内容块属性绑定
const elemClick = computed(() => activeBlockAttrs.value[ATTR_ELEM_CLICK] || '')
const elemSlot = computed(() => activeBlockAttrs.value[ATTR_ELEM_SLOT] || '')
const elemShikiLines = ref('')

// 文档全局属性绑定
const docTheme = computed(() => latestDoc.value?.config?.theme || 'default')
const docAspectRatio = computed(() => latestDoc.value?.config?.aspectRatio || '16/9')
const docDefaultTransition = computed(() => latestDoc.value?.config?.defaultTransition || 'slide-left')

const hasBlockAttrs = computed(() => {
  return Boolean(
    activeBlockAttrs.value[ATTR_ELEM_CLICK] ||
    activeBlockAttrs.value[ATTR_ELEM_SLOT] ||
    activeBlockAttrs.value[ATTR_ELEM_SHIKI_LINES] ||
    activeBlockAttrs.value[ATTR_PAGE_LAYOUT]
  )
})


async function saveAttr(key: string, value: string) {
  const targetId = activeBlockId.value || currentDocId.value
  if (!targetId) return

  activeBlockAttrs.value[key] = value
  triggerSaveNotice('保存中...')
  try {
    await setBlockAttrs(targetId, { [key]: value })
    triggerSaveNotice('已同步至属性')
    if (plugin) {
      plugin.compileCurrentDocument()
    }
  } catch (e) {
    triggerSaveNotice('同步失败')
  }
}

async function saveDocAttr(key: string, value: string) {
  const docId = currentDocId.value
  if (!docId) return
  triggerSaveNotice('更新全局配置...')
  try {
    await setBlockAttrs(docId, { [key]: value })
    triggerSaveNotice('已更新')
    if (plugin) {
      plugin.compileCurrentDocument(docId)
    }
  } catch (e) {
    triggerSaveNotice('更新失败')
  }
}

// 场景 A 事件
function onLayoutChange(val: string) {
  saveAttr(ATTR_PAGE_LAYOUT, val)
}

function onTransitionChange(val: string) {
  saveAttr(ATTR_PAGE_TRANSITION, val)
}

function onBackgroundChange(val: string) {
  pageBackground.value = val
  saveAttr(ATTR_PAGE_BACKGROUND, val)
}

function onNotesChange(val?: string) {
  if (val !== undefined) {
    pageNotes.value = val
  }
  saveAttr(ATTR_PAGE_NOTES, pageNotes.value)
}

async function onGenerateNotesWithAI() {
  if (!currentDocId.value) return
  showMessage('正在调用思源 AI 提炼本页讲稿提词...')
  const dummySlide = {
    pageIndex: 1,
    startBlockId: activeBlockId.value,
    frontmatter: {},
    notes: '',
    blocks: [{ id: activeBlockId.value, type: activeBlockType.value, content: blockContentSnippet.value, rawMarkdown: '' }],
    rawMarkdown: '',
  }
  const generated = await generateSpeakerNotesWithAI(dummySlide as any, chatAI)
  if (generated) {
    pageNotes.value = generated
    saveAttr(ATTR_PAGE_NOTES, generated)
    showMessage('已成功生成口播提词！')
  }
}

// 场景 B 事件
function toggleElemClick() {
  if (elemClick.value) {
    saveAttr(ATTR_ELEM_CLICK, '')
  } else {
    saveAttr(ATTR_ELEM_CLICK, '+1')
  }
}

function onElemClickStepChange(step: string) {
  saveAttr(ATTR_ELEM_CLICK, step)
}

function onElemSlotChange(slot: string) {
  saveAttr(ATTR_ELEM_SLOT, slot)
}

function onElemShikiLinesChange(val: string) {
  elemShikiLines.value = val
  saveAttr(ATTR_ELEM_SHIKI_LINES, val)
}

async function onSetTwoColsContrast() {
  await saveAttr(ATTR_ELEM_SLOT, 'left')
  showMessage('已将当前块设置为双栏左栏 (left)')
}

async function onClearBlockAttrs() {
  const targetId = activeBlockId.value
  if (!targetId) return
  await setBlockAttrs(targetId, {
    [ATTR_ELEM_CLICK]: '',
    [ATTR_ELEM_SLOT]: '',
    [ATTR_ELEM_SHIKI_LINES]: '',
    [ATTR_PAGE_LAYOUT]: '',
    [ATTR_PAGE_TRANSITION]: '',
    [ATTR_PAGE_BACKGROUND]: '',
    [ATTR_PAGE_NOTES]: '',
  })
  activeBlockAttrs.value = {}
  elemShikiLines.value = ''
  pageBackground.value = ''
  pageNotes.value = ''
  showMessage('已清除本块演示属性')
  if (plugin) {
    plugin.compileCurrentDocument()
  }
}

// 场景 C 事件
function onDocThemeChange(theme: string) {
  saveDocAttr(ATTR_DOC_THEME, theme)
}

function onDocAspectRatioChange(ratio: string) {
  saveDocAttr(ATTR_DOC_ASPECT_RATIO, ratio)
}

function onDocTransitionChange(trans: string) {
  saveDocAttr(ATTR_DOC_DEFAULT_TRANSITION, trans)
}

// 快捷操作
async function onInsertDividerBefore() {
  if (!activeBlockId.value) return
  try {
    await insertBlock('markdown', '---', activeBlockId.value, undefined)
    showMessage('已在上方插入分页符 (---)')
    if (plugin) plugin.compileCurrentDocument()
  } catch (e) {
    showMessage('插入分页符失败')
  }
}

async function onInsertDividerAfter() {
  const targetId = activeBlockId.value || currentDocId.value
  if (!targetId) return
  try {
    await insertBlock('markdown', '---', undefined, targetId)
    showMessage('已在下方插入分页符 (---)')
    if (plugin) plugin.compileCurrentDocument()
  } catch (e) {
    showMessage('插入分页符失败')
  }
}

async function onDeleteCurrentBlock() {
  if (!activeBlockId.value) return
  try {
    await deleteBlock(activeBlockId.value)
    showMessage('已删除该分页符')
    activeBlockId.value = ''
    activeBlockType.value = ''
    if (plugin) plugin.compileCurrentDocument()
  } catch (e) {
    showMessage('删除失败')
  }
}

function onOpenBottomPreview() {
  if (plugin?.openBottomPreviewTab) {
    plugin.openBottomPreviewTab()
  }
}

function onOpenPresenter() {
  window.open('/plugins/siyuan-slidev/slidev-client/presenter.html', 'SlidevPresenter', 'width=1200,height=800')
}

function onAiAutoSplit() {
  if (plugin?.executeCommand) {
    plugin.executeCommand('slidevAiSplit')
  }
}

function onExportHtml() {
  if (!latestDoc.value) {
    showMessage('请先在主编辑区打开幻灯片文档')
    return
  }
  const html = buildStandaloneHtml(latestDoc.value)
  const ok = downloadHtmlFile('presentation.html', html)
  if (ok) {
    showMessage('已开始下载单文件离线 HTML 演示包')
  }
}

function onExportPdf() {
  if (!latestDoc.value) {
    showMessage('请先在主编辑区打开幻灯片文档')
    return
  }
  const ok = triggerPdfExport(latestDoc.value)
  if (ok) {
    showMessage('已唤起打印视窗，请在打印选项中选择「另存为 PDF」')
  }
}

// 暴露给外部调用的驱动方法
defineExpose({
  setActiveBlock(info: IActiveBlockInfo) {
    activeBlockId.value = info.id
    activeBlockType.value = info.type
    activeBlockAttrs.value = { ...info.attrs }
    blockContentSnippet.value = (info.content || info.markdown || '').slice(0, 50)
    pageBackground.value = info.attrs[ATTR_PAGE_BACKGROUND] || ''
    pageNotes.value = info.attrs[ATTR_PAGE_NOTES] || ''
    elemShikiLines.value = info.attrs[ATTR_ELEM_SHIKI_LINES] || ''
  },
  updateDocument(doc: ISlidevDocument) {
    latestDoc.value = doc
    currentDocId.value = doc.docId
  },
  openImportDialog() {
    showImportDialog.value = true
  },
  setCurrentDocId(docId: string) {
    currentDocId.value = docId
  },
})
</script>

<style scoped>
.spm-slidev-inspector {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--b3-theme-background, #ffffff);
  color: var(--b3-theme-on-background, #2c3e50);
  overflow: hidden;
  box-sizing: border-box;
}

.spm-inspector-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--b3-theme-surface, #f8fafc);
  border-bottom: 1px solid var(--b3-border-color, #e2e8f0);
  flex-shrink: 0;
}

.spm-inspector-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
  color: var(--b3-theme-on-surface, #1e293b);
}

.spm-inspector-icon {
  width: 16px;
  height: 16px;
}

.spm-target-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--b3-theme-surface-hover, #f1f5f9);
  border-bottom: 1px solid var(--b3-border-color, #e2e8f0);
  font-size: 11px;
  flex-shrink: 0;
}

.spm-target-info {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.spm-target-tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
}

.tag-divider {
  background: #fef3c7;
  color: #d97706;
}

.tag-block {
  background: #e0e7ff;
  color: #4f46e5;
}

.tag-doc {
  background: #e2e8f0;
  color: #475569;
}

.spm-target-id {
  color: var(--b3-theme-on-surface, #64748b);
  font-family: monospace;
}

.spm-save-status {
  color: #10b981;
  font-weight: 500;
}

.spm-inspector-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spm-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spm-section-header {
  display: flex;
  flex-direction: column;
  border-left: 3px solid #3b82f6;
  padding-left: 8px;
  font-weight: 600;
  font-size: 13px;
}

.spm-section-sub {
  font-weight: normal;
  font-size: 11px;
  color: var(--b3-theme-on-surface, #64748b);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spm-card-control {
  padding: 10px;
  background: var(--b3-theme-surface, #f8fafc);
  border: 1px solid var(--b3-border-color, #e2e8f0);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.spm-control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.spm-control-title {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  font-weight: 600;
}

.spm-control-desc {
  font-size: 11px;
  font-weight: normal;
  color: var(--b3-theme-on-surface, #64748b);
}

.spm-toggle-btn {
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid var(--b3-border-color, #cbd5e1);
  background: var(--b3-theme-background, #ffffff);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s ease;
}

.spm-toggle-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
  font-weight: 600;
}

.spm-segmented-group {
  display: flex;
  background: var(--b3-theme-background, #ffffff);
  border: 1px solid var(--b3-border-color, #e2e8f0);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.spm-segmented-item {
  flex: 1;
  padding: 4px 6px;
  font-size: 11px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  color: var(--b3-theme-on-surface, #64748b);
  transition: all 0.15s ease;
  text-align: center;
}

.spm-segmented-item.active {
  background: #3b82f6;
  color: #ffffff;
  font-weight: 600;
}

.spm-quick-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.spm-chip {
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid var(--b3-border-color, #e2e8f0);
  background: var(--b3-theme-background, #ffffff);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--b3-theme-on-surface, #475569);
}

.spm-chip:hover {
  border-color: #3b82f6;
}

.spm-chip.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  font-weight: 600;
}

.spm-chip-clear {
  color: #ef4444;
}

.spm-field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.spm-field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.spm-field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #475569);
}

.spm-input, .spm-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid var(--b3-border-color, #e2e8f0);
  border-radius: 4px;
  background: var(--b3-theme-background, #ffffff);
  color: var(--b3-theme-on-background, #1e293b);
  outline: none;
}

.spm-input:focus, .spm-textarea:focus {
  border-color: #3b82f6;
}

.spm-action-group {
  margin-top: 6px;
  padding: 10px;
  border-radius: 6px;
  background: var(--b3-theme-surface, #f8fafc);
  border: 1px solid var(--b3-border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spm-action-group-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #64748b);
}

.spm-action-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.spm-btn-action {
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color, #cbd5e1);
  background: var(--b3-theme-background, #ffffff);
  color: var(--b3-theme-on-surface, #334155);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.spm-btn-action:hover {
  background: var(--b3-theme-surface-hover, #e2e8f0);
  border-color: #3b82f6;
}

.spm-btn-action.spm-btn-primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
  font-weight: 600;
  text-align: center;
}

.spm-btn-action.spm-btn-danger {
  color: #ef4444;
  border-color: #fca5a5;
}

.spm-btn-action.spm-btn-danger:hover {
  background: #fee2e2;
}

.spm-btn-action.spm-btn-warn {
  color: #d97706;
}

.spm-btn-pill {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  border: none;
  cursor: pointer;
  background: #3b82f6;
  color: #ffffff;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: all 0.2s;
}

.spm-btn-pill.spm-btn-secondary {
  background: var(--b3-theme-surface, #ffffff);
  border: 1px solid var(--b3-border-color, #cbd5e1);
  color: var(--b3-theme-on-surface, #1e293b);
  &:hover {
    background: var(--b3-theme-surface-hover, #f1f5f9);
    border-color: #94a3b8;
  }
}

.spm-inspector-topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spm-btn-text {
  background: none;
  border: none;
  font-size: 11px;
  color: #3b82f6;
  cursor: pointer;
}

.spm-mt-2 {
  margin-top: 6px;
}
</style>
