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
        :page-index="targetPageIndex"
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
        :elem-max-height="elemMaxHeight"
        :is-code-block="isCodeBlock"
        :is-image="isImageBlock"
        :is-video="isVideoBlock"
        :video-autoplay="videoAutoplay"
        :video-loop="videoLoop"
        :video-muted="videoMuted"
        :video-controls="videoControls"
        :has-block-attrs="hasBlockAttrs"
        :is-note="isNoteBlock"
        :image-role="imageRole"
        :current-slide-layout="currentSlideLayout"
        @toggle-note="onToggleNoteBlock"
        @toggle-elem-click="toggleElemClick"
        @toggle-video-autoplay="onToggleVideoAutoplay"
        @toggle-video-loop="onToggleVideoLoop"
        @toggle-video-muted="onToggleVideoMuted"
        @toggle-video-controls="onToggleVideoControls"
        @update:image-role="onImageRoleChange"
        @update:elem-click="onElemClickStepChange"
        @update:elem-motion="onElemMotionChange"
        @update:elem-slot="onElemSlotChange"
        @update:elem-shiki-lines="onElemShikiLinesChange"
        @update:elem-max-height="onElemMaxHeightChange"
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
import { setBlockAttrs, insertBlock, appendBlock, updateBlock, deleteBlock, getBlockKramdown, chatAI } from '@/api'
import { mirrorBlockSelection } from '@/sync/selection-mirror'
import { syncDomBlockAttrs } from '@/sync/dom-attr-sync'
import PageInspectorSection from '@/ui/components/PageInspectorSection.vue'
import BlockInspectorSection from '@/ui/components/BlockInspectorSection.vue'
import DocInspectorSection from '@/ui/components/DocInspectorSection.vue'
import SlidevImportDialog from '@/ui/components/SlidevImportDialog.vue'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'
import { extractCleanNoteText } from '@/compiler/slidev-ast-builder'
import { extractImageUrl } from '@/compiler/superblock-scanner'
import { globalDocumentCompiler } from '@/compiler/document-compiler'
import { generateSpeakerNotesWithAIDetailed } from '@/ai/notes-generator'
import { resolveTargetSlide, isDividerBlockType } from '@/sync/inspector-slide-resolver'
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
  ATTR_ELEM_MAX_HEIGHT,
  ATTR_ELEM_NOTE,
  ATTR_ELEM_ROLE,
  ATTR_VIDEO_AUTOPLAY,
  ATTR_VIDEO_LOOP,
  ATTR_VIDEO_MUTED,
  ATTR_VIDEO_CONTROLS,
  ROLE_BACKGROUND,
  ROLE_IMAGE_LEFT,
  ROLE_IMAGE_RIGHT,
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
const currentTopBlockId = ref('')
const currentPageDividerId = ref('')
const currentPageDividerLayout = ref('')
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
const isDivider = computed(() => isDividerBlockType(activeBlockType.value))
const isCodeBlock = computed(() => activeBlockType.value === 'NodeCodeBlock')
const isImageExplicit = ref(false)
const isImageBlock = computed(() => {
  if (isImageExplicit.value) return true
  if (imageRole.value) return true
  const snippet = rawSnippet.value || ''
  if (extractImageUrl(snippet)) return true
  return false
})
const isVideoBlock = computed(() => {
  const type = activeBlockType.value || ''
  if (type === 'NodeVideo' || type === 'video') return true
  const snippet = rawSnippet.value || ''
  if (/<video\b/i.test(snippet) || /\.mp4\b/i.test(snippet)) return true
  return false
})
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
  if (isVideoBlock.value) return '视频块'
  switch (activeBlockType.value) {
    case 'NodeHeading': return '标题块'
    case 'NodeParagraph': return '段落块'
    case 'NodeCodeBlock': return '代码块'
    case 'NodeVideo': return '视频块'
    case 'NodeList':
    case 'NodeListItem': return '列表项'
    case 'NodeBlockquote': return '引述块'
    case 'NodeTable': return '表格块'
    case 'NodeSuperBlock':
    case 's':
    case 'sb': return '超级块'
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
  return resolveTargetSlide(latestDoc.value?.slides, {
    activeBlockId: activeBlockId.value,
    activeBlockType: activeBlockType.value,
    currentTopBlockId: currentTopBlockId.value,
    currentPageDividerId: currentPageDividerId.value,
    activeBlockAttrs: activeBlockAttrs.value,
  })
})

const currentSlideNotes = computed(() => targetSlide.value?.notes || '')
const currentSlideNoteBlockId = computed(() => targetSlide.value?.noteBlocks?.[0]?.id || '')

const currentSlideLayout = computed(() => {
  // 1. 若当前激活块就是分页符，优先以当前分页符实时属性为准
  if (isDivider.value) {
    const directLayout = activeBlockAttrs.value[ATTR_PAGE_LAYOUT] || activeBlockAttrs.value['custom-slidev-layout']
    if (directLayout) return directLayout
  }

  // 1.5 强关联推断：若当前选中块已配置了 col-1 / col-2 / col-3 插槽，该幻灯片必定为 three-cols-header
  const blockSlot = activeBlockAttrs.value[ATTR_ELEM_SLOT] || activeBlockAttrs.value['custom-slidev-slot']
  if (blockSlot && ['col-1', 'col-2', 'col-3'].includes(blockSlot)) {
    return 'three-cols-header'
  }

  // 1.8 前置分页符直传的持久化版式（毫秒级穿透，解决重编译前的竞态或初次加载）
  if (currentPageDividerLayout.value) {
    return currentPageDividerLayout.value
  }

  // 2. 检查当前页前置分页符或当前块是否存在即时覆盖层属性 (毫秒级穿透，解决异步落库重编译前的竞态时序)
  const divId = currentPageDividerId.value || (isDivider.value ? activeBlockId.value : '')
  if (divId) {
    const override = globalDocumentCompiler.getBlockAttrOverride(divId)
    if (override?.[ATTR_PAGE_LAYOUT]) {
      return override[ATTR_PAGE_LAYOUT]
    }
  }

  // 2.5 若存在前置分页符 ID，从已编译幻灯片中按 startBlockId 匹配版式
  if (divId && latestDoc.value?.slides) {
    const matched = latestDoc.value.slides.find(s => s.startBlockId === divId)
    if (matched?.frontmatter?.layout) {
      return matched.frontmatter.layout
    }
  }

  // 3. 从精确匹配的目标 slide 中获取 layout
  if (targetSlide.value?.frontmatter?.layout) {
    return targetSlide.value.frontmatter.layout
  }

  // 3.5 若目标 slide 中存在包含 col-1 / col-2 / col-3 的块，推断为 three-cols-header
  if (targetSlide.value?.blocks?.some(b => b.slot === 'col-1' || b.slot === 'col-2' || b.slot === 'col-3')) {
    return 'three-cols-header'
  }

  // 4. 文档级覆盖层兜底
  const docOverride = globalDocumentCompiler.getBlockAttrOverride(currentDocId.value)
  if (docOverride?.[ATTR_PAGE_LAYOUT]) {
    return docOverride[ATTR_PAGE_LAYOUT]
  }

  return 'default'
})

const targetPageIndex = computed(() => targetSlide.value?.pageIndex || 1)
const isNoteBlock = computed(() => Boolean(activeBlockAttrs.value[ATTR_ELEM_NOTE] || activeBlockAttrs.value['slidev-note']))

// 内容块属性绑定 (支持继承属性反射)
const elemClick = computed(() => {
  if (activeBlockAttrs.value[ATTR_ELEM_CLICK]) {
    return activeBlockAttrs.value[ATTR_ELEM_CLICK]
  }
  const aid = activeBlockId.value
  if (aid && targetSlide.value?.blocks) {
    const matched = targetSlide.value.blocks.find(b => b.id === aid)
    if (matched?.clicks) return matched.clicks
  }
  return ''
})

const elemMotion = computed(() => {
  if (activeBlockAttrs.value[ATTR_ELEM_MOTION]) {
    return activeBlockAttrs.value[ATTR_ELEM_MOTION]
  }
  const aid = activeBlockId.value
  if (aid && targetSlide.value?.blocks) {
    const matched = targetSlide.value.blocks.find(b => b.id === aid)
    if (matched?.motion) return typeof matched.motion === 'string' ? matched.motion : JSON.stringify(matched.motion)
  }
  return ''
})

const elemSlot = computed(() => {
  if (activeBlockAttrs.value[ATTR_ELEM_SLOT]) {
    return activeBlockAttrs.value[ATTR_ELEM_SLOT]
  }
  const aid = activeBlockId.value
  if (aid && targetSlide.value?.blocks) {
    const matched = targetSlide.value.blocks.find(b => b.id === aid)
    if (matched?.slot) return matched.slot
  }
  return ''
})
const elemShikiLines = ref('')
const elemMaxHeight = ref('')

// 视频块控制属性与切换
const videoAutoplay = computed(() => activeBlockAttrs.value[ATTR_VIDEO_AUTOPLAY] === 'true')
const videoLoop = computed(() => activeBlockAttrs.value[ATTR_VIDEO_LOOP] === 'true')
const videoMuted = computed(() => activeBlockAttrs.value[ATTR_VIDEO_MUTED] === 'true')
const videoControls = computed(() => activeBlockAttrs.value[ATTR_VIDEO_CONTROLS] !== 'false')

async function onToggleVideoAutoplay() {
  const nextVal = videoAutoplay.value ? 'false' : 'true'
  if (nextVal === 'true') {
    // 浏览器安全策略：未静音的视频绝对禁止无手势自动播放，故联动开启静音播放并同步持久化
    await saveAttrs({
      [ATTR_VIDEO_AUTOPLAY]: 'true',
      [ATTR_VIDEO_MUTED]: 'true',
    })
    activeBlockAttrs.value[ATTR_VIDEO_AUTOPLAY] = 'true'
    activeBlockAttrs.value[ATTR_VIDEO_MUTED] = 'true'
  } else {
    await saveAttr(ATTR_VIDEO_AUTOPLAY, 'false')
    activeBlockAttrs.value[ATTR_VIDEO_AUTOPLAY] = 'false'
  }
}

async function onToggleVideoLoop() {
  const nextVal = videoLoop.value ? 'false' : 'true'
  await saveAttr(ATTR_VIDEO_LOOP, nextVal)
}

async function onToggleVideoMuted() {
  const nextVal = videoMuted.value ? 'false' : 'true'
  await saveAttr(ATTR_VIDEO_MUTED, nextVal)
}

async function onToggleVideoControls() {
  const nextVal = videoControls.value ? 'false' : 'true'
  await saveAttr(ATTR_VIDEO_CONTROLS, nextVal)
}

// 文档全局属性绑定
const docTheme = computed(() => latestDoc.value?.config?.theme || activeBlockAttrs.value[ATTR_DOC_THEME] || 'default')
const docAspectRatio = computed(() => latestDoc.value?.config?.aspectRatio || activeBlockAttrs.value[ATTR_DOC_ASPECT_RATIO] || '16/9')
const docDefaultTransition = computed(() => latestDoc.value?.config?.defaultTransition || activeBlockAttrs.value[ATTR_DOC_DEFAULT_TRANSITION] || 'slide-left')

const imageRole = computed(() => {
  const role = activeBlockAttrs.value[ATTR_ELEM_ROLE] || activeBlockAttrs.value['slidev-role']
  if (role === ROLE_BACKGROUND || activeBlockAttrs.value[ATTR_PAGE_BACKGROUND] === 'true') {
    return 'background'
  }
  const layout = activeBlockAttrs.value[ATTR_PAGE_LAYOUT] || activeBlockAttrs.value['slidev-layout']
  if (layout === 'image-left' || layout === 'image-right') {
    return layout
  }
  // 智能推断：若当前块为图片且所属幻灯片页面背景图匹配本图片，则该图片角色必然为 background
  const snippet = rawSnippet.value || ''
  const imgUrl = extractImageUrl(snippet)
  if (imgUrl && targetSlide.value?.frontmatter?.background) {
    const slideBg = targetSlide.value.frontmatter.background
    if (slideBg === imgUrl || slideBg.endsWith(imgUrl) || imgUrl.endsWith(slideBg)) {
      return 'background'
    }
  }
  return ''
})

async function onImageRoleChange(role: string) {
  const targetId = activeBlockId.value
  if (!targetId) return

  const snippet = rawSnippet.value || ''
  const imgUrl = extractImageUrl(snippet) || ''
  const pageContainerId = currentPageDividerId.value || currentDocId.value

  if (!role) {
    const updates: Record<string, string> = {
      [ATTR_ELEM_ROLE]: '',
      [ATTR_PAGE_LAYOUT]: '',
    }
    if (activeBlockAttrs.value[ATTR_PAGE_BACKGROUND] === 'true') {
      updates[ATTR_PAGE_BACKGROUND] = ''
    }
    if (pageContainerId && imgUrl && pageBackground.value === imgUrl) {
      pageBackground.value = ''
      await setBlockAttrs(pageContainerId, { [ATTR_PAGE_BACKGROUND]: '' }).catch(() => {})
      globalDocumentCompiler.setBlockAttrOverride(pageContainerId, { [ATTR_PAGE_BACKGROUND]: '' })
      syncDomBlockAttrs(pageContainerId, { [ATTR_PAGE_BACKGROUND]: '' })
      if (targetSlide.value?.frontmatter) {
        delete targetSlide.value.frontmatter.background
      }
    }
    await saveAttrs(updates)

    // 若当前激活块位于列表项内部（如列表段落），联动清除外层 NodeListItem 上的演示属性
    if (typeof document !== 'undefined') {
      const activeEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${targetId}"]`) as HTMLElement | null
      const parentLi = activeEl?.closest('[data-type="NodeListItem"]') as HTMLElement | null
      const parentLiId = parentLi?.getAttribute('data-node-id')
      if (parentLiId && parentLiId !== targetId) {
        const liUpdates = { [ATTR_PAGE_LAYOUT]: '', [ATTR_ELEM_ROLE]: '' }
        syncDomBlockAttrs(parentLiId, liUpdates)
        globalDocumentCompiler.setBlockAttrOverride(parentLiId, liUpdates)
        await setBlockAttrs(parentLiId, liUpdates).catch(() => {})
      }
    }
  } else if (role === 'background') {
    const updates: Record<string, string> = {
      [ATTR_ELEM_ROLE]: 'background',
      [ATTR_PAGE_LAYOUT]: '',
    }
    if (pageContainerId && imgUrl) {
      pageBackground.value = imgUrl
      await setBlockAttrs(pageContainerId, { [ATTR_PAGE_BACKGROUND]: imgUrl }).catch(() => {})
      globalDocumentCompiler.setBlockAttrOverride(pageContainerId, { [ATTR_PAGE_BACKGROUND]: imgUrl })
      syncDomBlockAttrs(pageContainerId, { [ATTR_PAGE_BACKGROUND]: imgUrl })
      if (targetSlide.value) {
        if (!targetSlide.value.frontmatter) {
          targetSlide.value.frontmatter = {}
        }
        targetSlide.value.frontmatter.background = imgUrl
      }
    }
    await saveAttrs(updates)
  } else if (role === 'image-left' || role === 'image-right') {
    await saveAttrs({
      [ATTR_PAGE_LAYOUT]: role,
      [ATTR_ELEM_ROLE]: '',
    })
  }
}

async function saveAttrs(attrs: Record<string, string>) {
  const targetId = activeBlockId.value || currentDocId.value
  if (!targetId) return

  for (const [key, value] of Object.entries(attrs)) {
    activeBlockAttrs.value[key] = value
  }
  globalDocumentCompiler.setBlockAttrOverride(targetId, attrs)
  syncDomBlockAttrs(targetId, attrs)

  if (ATTR_PAGE_LAYOUT in attrs) {
    const value = attrs[ATTR_PAGE_LAYOUT]
    currentPageDividerLayout.value = value
    if (targetSlide.value) {
      if (!targetSlide.value.frontmatter) {
        targetSlide.value.frontmatter = {}
      }
      targetSlide.value.frontmatter.layout = value as any
    }
  }

  triggerSaveNotice('保存中...')
  try {
    await setBlockAttrs(targetId, attrs)
    triggerSaveNotice('已同步')
    if (plugin) {
      await plugin.compileCurrentDocument()
    }
  } catch (e) {
    triggerSaveNotice('同步失败')
  }
}

const hasBlockAttrs = computed(() => {
  return Boolean(
    activeBlockAttrs.value[ATTR_ELEM_CLICK] ||
    activeBlockAttrs.value[ATTR_ELEM_MOTION] ||
    activeBlockAttrs.value[ATTR_ELEM_SLOT] ||
    activeBlockAttrs.value[ATTR_ELEM_SHIKI_LINES] ||
    activeBlockAttrs.value[ATTR_ELEM_NOTE] ||
    activeBlockAttrs.value['slidev-note'] ||
    activeBlockAttrs.value[ATTR_ELEM_ROLE] ||
    activeBlockAttrs.value[ATTR_PAGE_LAYOUT] ||
    activeBlockAttrs.value[ATTR_VIDEO_AUTOPLAY] ||
    activeBlockAttrs.value[ATTR_VIDEO_LOOP] ||
    activeBlockAttrs.value[ATTR_VIDEO_MUTED] ||
    activeBlockAttrs.value[ATTR_VIDEO_CONTROLS]
  )
})

async function saveAttr(key: string, value: string) {
  const targetId = activeBlockId.value || currentDocId.value
  if (!targetId) return

  activeBlockAttrs.value[key] = value
  globalDocumentCompiler.setBlockAttrOverride(targetId, { [key]: value })
  syncDomBlockAttrs(targetId, { [key]: value })

  // 若修改的是版式，立即同步当前内存中 targetSlide 的 layout 与 currentPageDividerLayout，避免点击内容块时异步重编译未完成读取到旧数据
  if (key === ATTR_PAGE_LAYOUT) {
    currentPageDividerLayout.value = value
    if (targetSlide.value) {
      if (!targetSlide.value.frontmatter) {
        targetSlide.value.frontmatter = {}
      }
      targetSlide.value.frontmatter.layout = value as any
    }
  }

  triggerSaveNotice('保存中...')
  try {
    await setBlockAttrs(targetId, { [key]: value })
    triggerSaveNotice('已同步')
    if (plugin) {
      await plugin.compileCurrentDocument()
    }
  } catch (e) {
    triggerSaveNotice('同步失败')
  }
}

async function saveDocAttr(key: string, value: string) {
  const docId = currentDocId.value || activeBlockId.value
  if (!docId) return
  activeBlockAttrs.value[key] = value
  globalDocumentCompiler.setBlockAttrOverride(docId, { [key]: value })
  syncDomBlockAttrs(docId, { [key]: value })
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
      await plugin.compileCurrentDocument(docId)
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

  if (!isNoteBlock.value) {
    // 开启讲稿备注：将当前块转为思源标准提示块 (NodeCallout)
    triggerSaveNotice('转换中...')
    try {
      // 1. 获取目标块的原始内容
      let sourceText = rawSnippet.value
      try {
        const kramdownRes = await getBlockKramdown(targetId)
        if (kramdownRes?.kramdown) {
          sourceText = kramdownRes.kramdown
        }
      } catch (_) {}

      // 2. 清洗正文并构造思源标准提示块 Markdown (> [!NOTE] 💡 演讲备注)
      const cleanContent = extractCleanNoteText(sourceText) || sourceText.replace(/<[^>]+>/g, '').trim() || '在此输入本页讲稿提词...'
      const noteBody = cleanContent.split(/\r?\n/).map(line => `> ${line}`).join('\n')
      const calloutMd = `> [!NOTE] 💡 演讲备注\n${noteBody}\n{: custom-slidev-note="true"}`

      // 3. 将原块更新为标准提示块
      await updateBlock('markdown', calloutMd, targetId)

      // 4. 设置属性并覆盖缓存
      await setBlockAttrs(targetId, { [ATTR_ELEM_NOTE]: 'true' })
      globalDocumentCompiler.setBlockAttrOverride(targetId, { [ATTR_ELEM_NOTE]: 'true' })
      syncDomBlockAttrs(targetId, { [ATTR_ELEM_NOTE]: 'true' })
      activeBlockAttrs.value[ATTR_ELEM_NOTE] = 'true'
      activeBlockType.value = 'NodeCallout'

      triggerSaveNotice('已设为讲稿备注')
      showMessage('已转为讲稿备注提示块（不在幻灯片中渲染）')

      // 5. 立即重新编译文档以更新 Dock 面板模型
      if (plugin) {
        await plugin.compileCurrentDocument()
      }
    } catch (err) {
      console.error('[SiYuanSlidev] 转换讲稿备注提示块失败:', err)
      triggerSaveNotice('设置失败')
      showMessage('转为讲稿备注提示块失败')
    }
  } else {
    // 取消讲稿备注
    triggerSaveNotice('取消中...')
    try {
      await setBlockAttrs(targetId, { [ATTR_ELEM_NOTE]: '', 'slidev-note': '' })
      globalDocumentCompiler.setBlockAttrOverride(targetId, { [ATTR_ELEM_NOTE]: '', 'slidev-note': '' })
      syncDomBlockAttrs(targetId, { [ATTR_ELEM_NOTE]: '', 'slidev-note': '' })
      delete activeBlockAttrs.value[ATTR_ELEM_NOTE]
      delete activeBlockAttrs.value['slidev-note']

      triggerSaveNotice('已取消备注')
      showMessage('已取消讲稿备注')

      if (plugin) {
        await plugin.compileCurrentDocument()
      }
    } catch (err) {
      console.error('[SiYuanSlidev] 取消讲稿备注失败:', err)
      triggerSaveNotice('取消失败')
      showMessage('取消讲稿备注失败')
    }
  }
}

async function createNoteBlockOnCurrentSlide(noteContent?: string) {
  const content = noteContent || '在此输入本页讲稿提词...'
  const noteLines = content.split(/\r?\n/).map(l => `> ${l}`).join('\n')
  const markdownPayload = `> [!NOTE] 💡 演讲备注\n${noteLines}\n{: custom-slidev-note="true"}`

  const slides = latestDoc.value?.slides || []
  const curSlide = targetSlide.value
  const curIdx = curSlide ? slides.findIndex(s => s === curSlide) : -1

  let insertedRes: any = null
  if (curIdx !== -1 && curIdx < slides.length - 1) {
    const nextSlide = slides[curIdx + 1]
    insertedRes = await insertBlock('markdown', markdownPayload, nextSlide.startBlockId)
  } else {
    const lastBlock = curSlide?.noteBlocks?.slice(-1)[0] || curSlide?.blocks?.slice(-1)[0]
    const previousId = lastBlock?.id || curSlide?.startBlockId
    if (previousId) {
      insertedRes = await insertBlock('markdown', markdownPayload, undefined, previousId)
    } else {
      insertedRes = await appendBlock('markdown', markdownPayload, currentDocId.value)
    }
  }

  const newId = insertedRes?.[0]?.doOperations?.[0]?.id || insertedRes?.[0]?.id
  if (newId) {
    await setBlockAttrs(newId, { [ATTR_ELEM_NOTE]: 'true' })
    globalDocumentCompiler.setBlockAttrOverride(newId, { [ATTR_ELEM_NOTE]: 'true' })
    mirrorBlockSelection(newId, plugin?.app)
  }

  if (plugin) {
    await plugin.compileCurrentDocument()
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
      const formattedNoteMd = `> [!NOTE] 💡 演讲备注\n${result.notes.split(/\r?\n/).map(l => `> ${l}`).join('\n')}\n{: custom-slidev-note="true"}`
      await updateBlock('markdown', formattedNoteMd, existingNoteBlockId)
      await setBlockAttrs(existingNoteBlockId, { [ATTR_ELEM_NOTE]: 'true' })
      globalDocumentCompiler.setBlockAttrOverride(existingNoteBlockId, { [ATTR_ELEM_NOTE]: 'true' })
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
      await plugin.compileCurrentDocument()
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
  const currentSlot = activeBlockAttrs.value[ATTR_ELEM_SLOT] || ''
  if (currentSlot === slot) {
    saveAttr(ATTR_ELEM_SLOT, '')
  } else {
    saveAttr(ATTR_ELEM_SLOT, slot)
  }
}

function onElemShikiLinesChange(val: string) {
  elemShikiLines.value = val
  saveAttr(ATTR_ELEM_SHIKI_LINES, val)
}

function onElemMaxHeightChange(val: string) {
  elemMaxHeight.value = val
  saveAttr(ATTR_ELEM_MAX_HEIGHT, val)
}

async function onSetTwoColsContrast() {
  const isThreeCols = currentSlideLayout.value === 'three-cols-header'
  const slotVal = isThreeCols ? 'col-1' : 'left'
  await saveAttr(ATTR_ELEM_SLOT, slotVal)
  showMessage(isThreeCols ? '已将当前块设置为第 1 栏 (col-1)' : '已将当前块设置为双栏左栏 (left)')
}

async function onClearBlockAttrs() {
  const targetId = activeBlockId.value
  if (!targetId) return
  const clearMap = {
    [ATTR_ELEM_CLICK]: '',
    [ATTR_ELEM_MOTION]: '',
    [ATTR_ELEM_SLOT]: '',
    [ATTR_ELEM_SHIKI_LINES]: '',
    [ATTR_ELEM_MAX_HEIGHT]: '',
    [ATTR_ELEM_NOTE]: '',
    'slidev-note': '',
    [ATTR_PAGE_LAYOUT]: '',
    [ATTR_ELEM_ROLE]: '',
    [ATTR_PAGE_TRANSITION]: '',
    [ATTR_PAGE_BACKGROUND]: '',
    [ATTR_PAGE_IMAGE]: '',
    [ATTR_VIDEO_AUTOPLAY]: '',
    [ATTR_VIDEO_LOOP]: '',
    [ATTR_VIDEO_MUTED]: '',
    [ATTR_VIDEO_CONTROLS]: '',
  }
  syncDomBlockAttrs(targetId, clearMap)
  await setBlockAttrs(targetId, clearMap)
  globalDocumentCompiler.clearBlockAttrOverride(targetId)

  // 若当前激活块位于列表项内部（如列表段落），联动清除外层 NodeListItem 上的演示属性
  if (typeof document !== 'undefined') {
    const activeEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${targetId}"]`) as HTMLElement | null
    const parentLi = activeEl?.closest('[data-type="NodeListItem"]') as HTMLElement | null
    const parentLiId = parentLi?.getAttribute('data-node-id')
    if (parentLiId && parentLiId !== targetId) {
      syncDomBlockAttrs(parentLiId, clearMap)
      await setBlockAttrs(parentLiId, clearMap).catch(() => {})
      globalDocumentCompiler.clearBlockAttrOverride(parentLiId)
    }
  }

  activeBlockAttrs.value = {}
  elemShikiLines.value = ''
  elemMaxHeight.value = ''
  pageBackground.value = ''
  pageImage.value = ''
  showMessage('已清除本块演示属性')
  if (plugin) {
    await plugin.compileCurrentDocument()
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
    currentTopBlockId.value = info.topBlockId || info.id
    currentPageDividerId.value = info.pageDividerId || ''
    currentPageDividerLayout.value = info.pageDividerLayout || ''
    if (info.rootId) {
      currentDocId.value = info.rootId
    } else if ((info.type === 'doc' || info.type === 'NodeDocument') && info.id) {
      currentDocId.value = info.id
    }
    pageBackground.value = info.attrs[ATTR_PAGE_BACKGROUND] || ''
    pageImage.value = info.attrs[ATTR_PAGE_IMAGE] || ''
    elemShikiLines.value = info.attrs[ATTR_ELEM_SHIKI_LINES] || ''
    elemMaxHeight.value = info.attrs[ATTR_ELEM_MAX_HEIGHT] || ''
    isImageExplicit.value = Boolean(info.isImage)
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
