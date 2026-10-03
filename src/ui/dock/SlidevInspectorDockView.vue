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
      <div v-if="isDivider" class="spm-section spm-section--page">
        <div class="spm-section-header">
          <span>幻灯片页面设置</span>
          <span class="spm-section-sub">当前页 Frontmatter</span>
        </div>

        <!-- 版式选择 -->
        <LayoutPicker
          :model-value="pageLayout"
          @change="onLayoutChange"
        />

        <!-- 转场动效选择 -->
        <TransitionSelector
          :model-value="pageTransition"
          @change="onTransitionChange"
        />

        <!-- 页面背景 -->
        <div class="spm-field-group">
          <label class="spm-field-label">页面背景 (Background)</label>
          <div class="spm-quick-chips">
            <button
              v-for="bg in presetBackgrounds"
              :key="bg.value"
              class="spm-chip"
              :class="{ active: pageBackground === bg.value }"
              @click="onBackgroundChange(bg.value)"
            >
              {{ bg.label }}
            </button>
          </div>
          <input
            v-model="pageBackground"
            class="spm-input"
            placeholder="自定义颜色 (#1e1e24) 或资源路径"
            @change="onBackgroundChange(pageBackground)"
          />
        </div>

        <!-- 演讲备忘提词 (Notes) -->
        <div class="spm-field-group">
          <div class="spm-field-label-row">
            <label class="spm-field-label">演讲者提词 (Notes)</label>
            <button
              class="spm-btn-text"
              title="使用思源 AI 自动提炼提词"
              @click="onGenerateNotesWithAI"
            >
              🤖 AI 提词
            </button>
          </div>
          <textarea
            v-model="pageNotes"
            class="spm-textarea"
            rows="3"
            placeholder="口播备忘录，仅演讲者视图可见..."
            @change="onNotesChange"
          ></textarea>
        </div>

        <!-- 分页符快捷操作 -->
        <div class="spm-action-group">
          <div class="spm-action-group-title">分页快捷操作</div>
          <div class="spm-action-buttons">
            <button class="spm-btn-action" @click="onInsertDividerAfter">
              ➕ 在此后插入新页
            </button>
            <button class="spm-btn-action spm-btn-danger" @click="onDeleteCurrentBlock">
              🗑️ 删除此分页符
            </button>
          </div>
        </div>
      </div>

      <!-- 场景 B：普通内容块 (段落、标题、列表、表格、代码块等) -->
      <div v-else-if="activeBlockId && !isDocRoot" class="spm-section spm-section--block">
        <div class="spm-section-header">
          <span>元素动效与排版</span>
          <span class="spm-section-sub">{{ blockContentSnippet || '已聚焦块' }}</span>
        </div>

        <!-- 逐步出现 (v-click) -->
        <div class="spm-card-control">
          <div class="spm-control-row">
            <div class="spm-control-title">
              <span>✨ 逐步出现 (v-click)</span>
              <span class="spm-control-desc">翻页时按步长逐个呈现</span>
            </div>
            <button
              class="spm-toggle-btn"
              :class="{ active: Boolean(elemClick) }"
              @click="toggleElemClick"
            >
              {{ elemClick ? '已开启' : '关闭' }}
            </button>
          </div>

          <div v-if="elemClick" class="spm-quick-chips spm-mt-2">
            <button
              v-for="step in ['+1', '1', '2', 'hide']"
              :key="step"
              class="spm-chip"
              :class="{ active: elemClick === step }"
              @click="onElemClickStepChange(step)"
            >
              {{ step === '+1' ? '顺延 (+1)' : step === 'hide' ? '隐藏 (hide)' : '第 ' + step + ' 步' }}
            </button>
          </div>
        </div>

        <!-- 多栏布局插槽 (Slot) -->
        <div class="spm-card-control">
          <div class="spm-control-title">
            <span>▥ 双栏插槽 (Slot)</span>
            <span class="spm-control-desc">在 two-cols 等分栏布局中的归属</span>
          </div>
          <div class="spm-segmented-group">
            <button
              class="spm-segmented-item"
              :class="{ active: !elemSlot || elemSlot === 'default' }"
              @click="onElemSlotChange('')"
            >
              默认
            </button>
            <button
              class="spm-segmented-item"
              :class="{ active: elemSlot === 'left' }"
              @click="onElemSlotChange('left')"
            >
              左栏 (left)
            </button>
            <button
              class="spm-segmented-item"
              :class="{ active: elemSlot === 'right' }"
              @click="onElemSlotChange('right')"
            >
              右栏 (right)
            </button>
          </div>
        </div>

        <!-- 代码逐行聚光高亮 (仅代码块) -->
        <div v-if="isCodeBlock" class="spm-card-control">
          <div class="spm-control-title">
            <span>🔍 代码逐行聚光 (Shiki)</span>
            <span class="spm-control-desc">翻页时动态聚光高亮特定行</span>
          </div>
          <div class="spm-quick-chips">
            <button
              v-for="shiki in ['1-3', 'all', '1|2|3', '2-5']"
              :key="shiki"
              class="spm-chip"
              :class="{ active: elemShikiLines === shiki }"
              @click="onElemShikiLinesChange(shiki)"
            >
              {{ shiki }}
            </button>
            <button
              v-if="elemShikiLines"
              class="spm-chip spm-chip-clear"
              @click="onElemShikiLinesChange('')"
            >
              清空
            </button>
          </div>
          <input
            v-model="elemShikiLines"
            class="spm-input spm-mt-2"
            placeholder="自定义高亮区间，如 1-3|5|all"
            @change="onElemShikiLinesChange(elemShikiLines)"
          />
        </div>

        <!-- 内容块快捷操作 -->
        <div class="spm-action-group">
          <div class="spm-action-group-title">块快捷操作</div>
          <div class="spm-action-buttons">
            <button class="spm-btn-action" @click="onInsertDividerBefore">
              ➕ 在上方插入分页符 (---)
            </button>
            <button class="spm-btn-action" @click="onInsertDividerAfter">
              ➕ 在下方插入分页符 (---)
            </button>
            <button class="spm-btn-action" @click="onSetTwoColsContrast">
              ▥ 设为双栏对比
            </button>
            <button
              v-if="hasBlockAttrs"
              class="spm-btn-action spm-btn-warn"
              @click="onClearBlockAttrs"
            >
              🧹 清除本块演示属性
            </button>
          </div>
        </div>
      </div>

      <!-- 场景 C：全局文档演示配置 (未聚焦具体块或选中文档头) -->
      <div v-else class="spm-section spm-section--doc">
        <div class="spm-section-header">
          <span>全局演示配置</span>
          <span class="spm-section-sub">当前文档级 Slidev 参数</span>
        </div>

        <!-- 主题切换 -->
        <div class="spm-card-control">
          <div class="spm-control-title">
            <span>🎨 幻灯片主题 (Theme)</span>
          </div>
          <div class="spm-segmented-group">
            <button
              class="spm-segmented-item"
              :class="{ active: docTheme === 'default' }"
              @click="onDocThemeChange('default')"
            >
              默认 default
            </button>
            <button
              class="spm-segmented-item"
              :class="{ active: docTheme === 'seriph' }"
              @click="onDocThemeChange('seriph')"
            >
              优雅 seriph
            </button>
            <button
              class="spm-segmented-item"
              :class="{ active: docTheme === 'apple-basic' }"
              @click="onDocThemeChange('apple-basic')"
            >
              极简 apple
            </button>
          </div>
        </div>

        <!-- 画幅比例 -->
        <div class="spm-card-control">
          <div class="spm-control-title">
            <span>📐 画幅比例 (Aspect Ratio)</span>
          </div>
          <div class="spm-segmented-group">
            <button
              class="spm-segmented-item"
              :class="{ active: docAspectRatio === '16/9' }"
              @click="onDocAspectRatioChange('16/9')"
            >
              16 : 9 (宽屏)
            </button>
            <button
              class="spm-segmented-item"
              :class="{ active: docAspectRatio === '4/3' }"
              @click="onDocAspectRatioChange('4/3')"
            >
              4 : 3 (标屏)
            </button>
            <button
              class="spm-segmented-item"
              :class="{ active: docAspectRatio === '16/10' }"
              @click="onDocAspectRatioChange('16/10')"
            >
              16 : 10
            </button>
          </div>
        </div>

        <!-- 全局默认转场 -->
        <div class="spm-card-control">
          <div class="spm-control-title">
            <span>↔ 全局默认转场</span>
          </div>
          <div class="spm-quick-chips">
            <button
              v-for="trans in ['slide-left', 'fade', 'zoom', 'slide-up']"
              :key="trans"
              class="spm-chip"
              :class="{ active: docDefaultTransition === trans }"
              @click="onDocTransitionChange(trans)"
            >
              {{ trans }}
            </button>
          </div>
        </div>

        <!-- 全局快捷操作 -->
        <div class="spm-action-group">
          <div class="spm-action-group-title">演示全局操作</div>
          <div class="spm-action-buttons">
            <button class="spm-btn-action spm-btn-primary" @click="onOpenBottomPreview">
              🖥️ 在下方分屏打开预览 (Alt+P)
            </button>
            <button class="spm-btn-action" @click="onOpenPresenter">
              🎤 打开双屏演讲者控制台 (Alt+M)
            </button>
            <button class="spm-btn-action" @click="onAiAutoSplit">
              🤖 AI 智能大纲断页建议
            </button>
            <button class="spm-btn-action" @click="onExportHtml">
              📥 导出单文件 HTML
            </button>
            <button class="spm-btn-action" @click="onExportPdf">
              🖨️ 导出 PDF 讲义
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import type { Plugin } from 'siyuan'
import { showMessage } from 'siyuan'
import { setBlockAttrs, insertBlock, deleteBlock, chatAI } from '@/api'
import LayoutPicker from '@/ui/components/LayoutPicker.vue'
import TransitionSelector from '@/ui/components/TransitionSelector.vue'
import { generateSpeakerNotesWithAI } from '@/ai/notes-generator'
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

const presetBackgrounds = [
  { label: '默认', value: '' },
  { label: '暗黑 #1e1e24', value: '#1e1e24' },
  { label: '极夜 #0f172a', value: '#0f172a' },
  { label: '极简白 #ffffff', value: '#ffffff' },
]

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

function onNotesChange() {
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
  if (!latestDoc.value) return
  import('@/export/single-html-exporter').then(({ buildStandaloneHtml, downloadHtmlFile }) => {
    const html = buildStandaloneHtml(latestDoc.value!)
    downloadHtmlFile('presentation.html', html)
  })
}

function onExportPdf() {
  if (!latestDoc.value) return
  import('@/export/pdf-exporter').then(({ triggerPdfExport }) => {
    triggerPdfExport(latestDoc.value!)
  })
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
