<template>
  <div class="spm-slidev-inspector">
    <!-- 面板顶栏 -->
    <div class="spm-inspector-topbar">
      <div class="spm-inspector-title">
        <svg class="slidev-icon" style="fill: none !important" aria-hidden="true" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span>演示配置</span>
      </div>

      <div class="spm-inspector-topbar-actions">
        <!-- 导入 Slidev 演示文档 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="导入 Slidev 演示文档 (.md / .zip)"
          @click="showImportDialog = true"
        >
          <SlidevIcon name="import" />
          <span>导入</span>
        </button>

        <!-- 快捷打开下方分屏预览 -->
        <button
          class="spm-icon-btn is-primary b3-tooltips b3-tooltips__s"
          aria-label="在下方分屏开启幻灯片预览 (Alt+P)"
          @click="onOpenBottomPreview"
        >
          <SlidevIcon name="split-preview" />
          <span>分屏预览</span>
        </button>
      </div>
    </div>

    <!-- 状态指示条：当前聚焦块元信息 -->
    <div class="spm-target-banner">
      <div class="spm-target-info">
        <span class="spm-target-tag" :class="targetTagClass">{{ targetTagLabel }}</span>
        <span
          class="spm-target-id b3-tooltips b3-tooltips__s"
          :aria-label="copyNotice || '点击复制 ID: ' + (activeBlockId || currentDocId)"
          @click="onCopyBlockId"
        >
          <SlidevIcon name="copy" />
          <span>#{{ displayShortId }}</span>
        </span>
      </div>
      <span v-if="saveStatus" class="spm-save-status">● {{ saveStatus }}</span>
    </div>

    <!-- 安全净化后的单行代码/文字预览条 (防 HTML 模板破损泄露) -->
    <div
      v-if="sanitizedSnippet"
      class="spm-context-quote"
      :title="rawSnippet"
    >
      {{ sanitizedSnippet }}
    </div>

    <div class="spm-inspector-body">
      <!-- 场景 A：分页符页面级配置 (水平分割线 ---) -->
      <PageInspectorSection
        v-if="isDivider"
        :page-layout="pageLayout"
        :page-transition="pageTransition"
        :page-background="pageBackground"
        :page-image="pageImage"
        :page-notes="currentSlideNotes"
        @update:page-layout="onLayoutChange"
        @update:page-transition="onTransitionChange"
        @update:page-background="onBackgroundChange"
        @update:page-image="onImageChange"
        @add-note-block="onAddNoteBlock"
        @locate-note-block="onLocateNoteBlock"
        @generate-notes="onGenerateNotesWithAI"
        @insert-divider-after="onInsertDividerAfter"
        @delete-divider="onDeleteCurrentBlock"
      />

      <!-- 场景 B：普通内容块 (段落、标题、列表、表格、代码块等) -->
      <BlockInspectorSection
        v-else-if="activeBlockId && !isDocRoot"
        :elem-click="elemClick"
        :elem-motion="elemMotion"
        :elem-slot="elemSlot"
        :elem-shiki-lines="elemShikiLines"
        :is-code-block="isCodeBlock"
        :has-block-attrs="hasBlockAttrs"
        :is-note="isNoteBlock"
        @toggle-note="onToggleNoteBlock"
        @toggle-elem-click="toggleElemClick"
        @update:elem-click="onElemClickStepChange"
        @update:elem-motion="onElemMotionChange"
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
import { showMessage } from 'siyuan'
import { setBlockAttrs, insertBlock, appendBlock, updateBlock, deleteBlock, chatAI } from '@/api'
import { mirrorBlockSelection } from '@/sync/selection-mirror'
import PageInspectorSection from '@/ui/components/PageInspectorSection.vue'
import BlockInspectorSection from '@/ui/components/BlockInspectorSection.vue'
import DocInspectorSection from '@/ui/components/DocInspectorSection.vue'
import SlidevImportDialog from '@/ui/components/SlidevImportDialog.vue'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'
import { generateSpeakerNotesWithAIDetailed } from '@/ai/notes-generator'
import { buildStandaloneHtml, downloadHtmlFile } from '@/export/single-html-exporter'
import { triggerPdfExport } from '@/export/pdf-exporter'
import type {
  IActiveBlockInfo,
  ISlidevDocument,
  ISlidevVirtualPage,
} from '@/types/slidev-protocol'
import {
  ATTR_DOC_THEME,
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_TRANSITION,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_IMAGE,
  ATTR_PAGE_NOTES,
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_SLOT,
  ATTR_ELEM_SHIKI_LINES,
  ATTR_ELEM_NOTE,
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
const rawSnippet = ref('')
const currentDocId = ref('')
const latestDoc = ref<ISlidevDocument | null>(null)
const saveStatus = ref('')
const copyNotice = ref('')

let saveTimer: number | null = null

function triggerSaveNotice(msg = '已同步') {
  saveStatus.value = msg
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveStatus.value = ''
  }, 1200)
}

function onCopyBlockId() {
  const id = activeBlockId.value || currentDocId.value
  if (!id) return
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(id).then(() => {
      copyNotice.value = '已复制！'
      setTimeout(() => {
        copyNotice.value = ''
      }, 1500)
    }).catch(() => {})
  }
}

// 目标标签计算
const isDivider = computed(() => activeBlockType.value === 'NodeThematicBreak')
const isCodeBlock = computed(() => activeBlockType.value === 'NodeCodeBlock')
const isDocRoot = computed(() => 
  !activeBlockId.value || 
  activeBlockId.value === currentDocId.value || 
  activeBlockType.value === 'doc' || 
  activeBlockType.value === 'NodeDocument'
)

const displayShortId = computed(() => {
  const id = activeBlockId.value || currentDocId.value || ''
  return id.length > 8 ? id.slice(-8) : id || '无'
})

const sanitizedSnippet = computed(() => {
  if (!rawSnippet.value) return ''
  return rawSnippet.value
    .replace(/<[^>]+>/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 45)
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
const pageImage = ref('')

// 讲稿备注与当前页模型响应式绑定
const targetSlide = computed(() => {
  if (!latestDoc.value?.slides) return null
  const aid = activeBlockId.value
  if (aid) {
    let s = latestDoc.value.slides.find(slide => slide.startBlockId === aid)
    if (s) return s
    s = latestDoc.value.slides.find(slide => slide.blocks?.some(b => b.id === aid))
    if (s) return s
    s = latestDoc.value.slides.find(slide => slide.noteBlocks?.some(b => b.id === aid))
    if (s) return s
  }
  return latestDoc.value.slides[0] || null
})

const currentSlideNotes = computed(() => targetSlide.value?.notes || '')
const currentSlideNoteBlockId = computed(() => targetSlide.value?.noteBlocks?.[0]?.id || '')
const isNoteBlock = computed(() => Boolean(activeBlockAttrs.value[ATTR_ELEM_NOTE] || activeBlockAttrs.value['slidev-note']))

// 内容块属性绑定
const elemClick = computed(() => activeBlockAttrs.value[ATTR_ELEM_CLICK] || '')
const elemMotion = computed(() => activeBlockAttrs.value[ATTR_ELEM_MOTION] || '')
const elemSlot = computed(() => activeBlockAttrs.value[ATTR_ELEM_SLOT] || '')
const elemShikiLines = ref('')

// 文档全局属性绑定
const docTheme = computed(() => latestDoc.value?.config?.theme || activeBlockAttrs.value[ATTR_DOC_THEME] || 'default')
const docAspectRatio = computed(() => latestDoc.value?.config?.aspectRatio || activeBlockAttrs.value[ATTR_DOC_ASPECT_RATIO] || '16/9')
const docDefaultTransition = computed(() => latestDoc.value?.config?.defaultTransition || activeBlockAttrs.value[ATTR_DOC_DEFAULT_TRANSITION] || 'slide-left')

const hasBlockAttrs = computed(() => {
  return Boolean(
    activeBlockAttrs.value[ATTR_ELEM_CLICK] ||
    activeBlockAttrs.value[ATTR_ELEM_MOTION] ||
    activeBlockAttrs.value[ATTR_ELEM_SLOT] ||
    activeBlockAttrs.value[ATTR_ELEM_SHIKI_LINES] ||
    activeBlockAttrs.value[ATTR_ELEM_NOTE] ||
    activeBlockAttrs.value['slidev-note'] ||
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
    triggerSaveNotice('已同步')
    if (plugin) {
      plugin.compileCurrentDocument()
    }
  } catch (e) {
    triggerSaveNotice('同步失败')
  }
}

async function saveDocAttr(key: string, value: string) {
  const docId = currentDocId.value || activeBlockId.value
  if (!docId) return
  activeBlockAttrs.value[key] = value
  if (latestDoc.value?.config) {
    if (key === ATTR_DOC_THEME) latestDoc.value.config.theme = value
    if (key === ATTR_DOC_ASPECT_RATIO) latestDoc.value.config.aspectRatio = value
    if (key === ATTR_DOC_DEFAULT_TRANSITION) latestDoc.value.config.defaultTransition = value
  }
  triggerSaveNotice('更新中...')
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

function onImageChange(val: string) {
  pageImage.value = val
  saveAttr(ATTR_PAGE_IMAGE, val)
}

async function onToggleNoteBlock() {
  const targetId = activeBlockId.value
  if (!targetId) return
  const nextVal = isNoteBlock.value ? '' : 'true'
  await saveAttr(ATTR_ELEM_NOTE, nextVal)
  if (nextVal) {
    showMessage('已设为讲稿备注（不在幻灯片中渲染）')
  } else {
    showMessage('已取消讲稿备注')
  }
}

async function createNoteBlockOnCurrentSlide(noteContent?: string) {
  const content = noteContent || '在此输入本页讲稿提词...'
  const noteLines = content.split(/\r?\n/).map(l => `> ${l}`).join('\n')
  const markdownPayload = `> 💡 **演讲备注**\n${noteLines}\n{: custom-slidev-note="true"}`

  const slides = latestDoc.value?.slides || []
  const curSlide = targetSlide.value
  const curIdx = curSlide ? slides.findIndex(s => s === curSlide) : -1

  let insertedRes: any = null
  if (curIdx !== -1 && curIdx < slides.length - 1) {
    const nextSlide = slides[curIdx + 1]
    insertedRes = await insertBlock('markdown', markdownPayload, nextSlide.startBlockId)
  } else {
    const lastBlock = curSlide?.noteBlocks?.slice(-1)[0] || curSlide?.blocks?.slice(-1)[0]
    if (lastBlock?.id) {
      insertedRes = await insertBlock('markdown', markdownPayload, undefined, lastBlock.id)
    } else {
      insertedRes = await appendBlock('markdown', markdownPayload, currentDocId.value)
    }
  }

  const newId = insertedRes?.[0]?.doOperations?.[0]?.id || insertedRes?.[0]?.id
  if (newId) {
    await setBlockAttrs(newId, { [ATTR_ELEM_NOTE]: 'true' })
    mirrorBlockSelection(newId, plugin?.app)
  }

  if (plugin) {
    plugin.compileCurrentDocument()
  }
  return newId
}

async function onAddNoteBlock() {
  try {
    await createNoteBlockOnCurrentSlide()
    showMessage('已在正文末尾插入讲稿备注提示块')
  } catch (err) {
    showMessage('插入讲稿备注块失败')
    console.error(err)
  }
}

function onLocateNoteBlock() {
  const blockId = currentSlideNoteBlockId.value
  if (!blockId) {
    showMessage('未找到本页关联的讲稿备注块')
    return
  }
  const ok = mirrorBlockSelection(blockId, plugin?.app)
  if (ok) {
    showMessage('已在编辑区定位讲稿备注块')
  } else {
    showMessage('定位讲稿备注块失败')
  }
}

async function onGenerateNotesWithAI() {
  if (!currentDocId.value) return

  const slideToUse: ISlidevVirtualPage = targetSlide.value || {
    pageIndex: 1,
    startBlockId: activeBlockId.value || currentDocId.value,
    frontmatter: {},
    notes: '',
    blocks: rawSnippet.value && rawSnippet.value !== '---'
      ? [{ id: activeBlockId.value, type: activeBlockType.value, content: rawSnippet.value, rawMarkdown: '' }]
      : [],
    rawMarkdown: rawSnippet.value && rawSnippet.value !== '---' ? rawSnippet.value : '',
  }

  showMessage('正在调用思源 AI 提炼本页讲稿提词...')
  const result = await generateSpeakerNotesWithAIDetailed(slideToUse, chatAI)
  if (result.notes) {
    const existingNoteBlockId = currentSlideNoteBlockId.value
    if (existingNoteBlockId) {
      const formattedNoteMd = `> 💡 **演讲备注**\n${result.notes.split(/\r?\n/).map(l => `> ${l}`).join('\n')}\n{: custom-slidev-note="true"}`
      await updateBlock('markdown', formattedNoteMd, existingNoteBlockId)
      await setBlockAttrs(existingNoteBlockId, { [ATTR_ELEM_NOTE]: 'true' })
      mirrorBlockSelection(existingNoteBlockId, plugin?.app)
    } else {
      await createNoteBlockOnCurrentSlide(result.notes)
    }
    if (result.isAiGenerated) {
      showMessage('思源 AI 演讲提词卡生成成功！')
    } else {
      showMessage('未获取到思源 AI 响应，已生成预设提词卡模板', 5000)
    }
    if (plugin) {
      plugin.compileCurrentDocument()
    }
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

function onElemMotionChange(val: string) {
  saveAttr(ATTR_ELEM_MOTION, val)
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
    [ATTR_ELEM_MOTION]: '',
    [ATTR_ELEM_SLOT]: '',
    [ATTR_ELEM_SHIKI_LINES]: '',
    [ATTR_ELEM_NOTE]: '',
    'slidev-note': '',
    [ATTR_PAGE_LAYOUT]: '',
    [ATTR_PAGE_TRANSITION]: '',
    [ATTR_PAGE_BACKGROUND]: '',
    [ATTR_PAGE_IMAGE]: '',
  })
  activeBlockAttrs.value = {}
  elemShikiLines.value = ''
  pageBackground.value = ''
  pageImage.value = ''
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
    rawSnippet.value = info.content || info.markdown || ''
    if (info.rootId) {
      currentDocId.value = info.rootId
    } else if ((info.type === 'doc' || info.type === 'NodeDocument') && info.id) {
      currentDocId.value = info.id
    }
    pageBackground.value = info.attrs[ATTR_PAGE_BACKGROUND] || ''
    pageImage.value = info.attrs[ATTR_PAGE_IMAGE] || ''
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
