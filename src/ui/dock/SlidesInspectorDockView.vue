<template>
  <div class="spm-slides-inspector">
    <!-- 面板顶栏 -->
    <div class="spm-inspector-topbar">
      <div class="spm-inspector-title">
        <svg class="slides-icon" style="fill: none !important" aria-hidden="true" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span>演示配置</span>
      </div>

      <div class="spm-inspector-topbar-actions">
        <!-- 导入 Slidev 演示文档（import 开关关闭时隐藏入口） -->
        <button
          v-if="isFeatureEnabled('import')"
          class="spm-icon-btn b3-tooltips b3-tooltips__sw"
          aria-label="导入 Slidev 演示文档 (.md / .zip)"
          @click="showImportDialog = true"
        >
          <SlidesIcon name="import" />
          <span>导入</span>
        </button>

        <!-- 快捷打开下方分屏预览 -->
        <button
          class="spm-icon-btn is-primary b3-tooltips b3-tooltips__sw"
          aria-label="在下方分屏开启幻灯片预览 (Alt+P)"
          @click="onOpenBottomPreview"
        >
          <SlidesIcon name="split-preview" />
          <span>分屏预览</span>
        </button>
      </div>
    </div>

    <!-- 状态指示条：当前聚焦块元信息 -->
    <div class="spm-target-banner">
      <div class="spm-target-info">
        <span class="spm-target-tag" :class="targetTagClass">{{ targetTagLabel }}</span>
        <span
          class="spm-target-id b3-tooltips b3-tooltips__se"
          :aria-label="copyNotice || '点击复制 ID: ' + (activeBlockId || currentDocId)"
          @click="onCopyBlockId"
        >
          <SlidesIcon name="copy" />
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
        :page-layout-ratio="pageLayoutRatio"
        :page-header="pageHeader"
        :page-mask="pageMask"
        :page-mask-ratio="pageMaskRatio"
        :page-mask-style="pageMaskStyle"
        :page-mask-initial="pageMaskInitial"
        :detected-sb-ratio="detectedSbRatio"
        :detected-sb-info="detectedSbInfo"
        :page-transition="pageTransition"
        :page-spacing="pageSpacing"
        :page-image="pageImage"
        :page-notes="currentSlideNotes"
        :page-index="targetPageIndex"
        :is-generating-notes="isGeneratingNotes"
        :can-convert-to-super-block="canConvertToSuperBlock"
        @update:page-layout="onLayoutChange"
        @update:page-layout-ratio="onLayoutRatioChange"
        @update:page-header="onPageHeaderChange"
        @update:page-mask="onMaskChange"
        @update:page-mask-ratio="onMaskRatioChange"
        @update:page-mask-style="onMaskStyleChange"
        @update:page-mask-initial="onMaskInitialChange"
        @apply-super-block-layout="onApplySuperBlockLayout"
        @reset-superblock-ratio="onResetSuperBlockRatio"
        @update:page-transition="onTransitionChange"
        @update:page-spacing="onPageSpacingChange"
        @update:page-image="onImageChange"
        @add-note-block="onAddNoteBlock"
        @locate-note-block="onLocateNoteBlock"
        @generate-notes="onGenerateNotesWithAI"
        @open-setting="onOpenSetting"
        @insert-divider-after="onInsertDividerAfter"
        @delete-divider="onDeleteCurrentBlock"
        @convert-to-super-block="onConvertToSuperBlock"
      />

      <!-- 场景 B：普通内容块 (段落、标题、列表、表格、代码块等) -->
      <BlockInspectorSection
        v-else-if="activeBlockId && !isDocRoot"
        :elem-click="elemClick"
        :elem-motion="elemMotion"
        :elem-anim="elemAnim"
        :elem-anim-props="elemAnimProps"
        :active-block-content="activeBlockContent"
        :elem-slot="elemSlot"
        :elem-shiki-lines="elemShikiLines"
        :elem-max-height="elemMaxHeight"
        :is-code-block="isCodeBlock"
        :is-image="isImageBlock"
        :is-video="isVideoBlock"
        :is-super-block="isSuperBlock"
        :detected-sb-info="detectedSbInfo"
        :video-autoplay="videoAutoplay"
        :video-loop="videoLoop"
        :video-muted="videoMuted"
        :video-controls="videoControls"
        :has-block-attrs="hasBlockAttrs"
        :is-note="isNoteBlock"
        :image-role="imageRole"
        :current-slide-layout="currentSlideLayout"
        :current-slide-layout-ratio="pageLayoutRatio"
        :current-slide-header="currentSlideHeader"
        :parent-elem-click="parentContainerClicks"
        :parent-container-slot="parentContainerSlot"
        :parent-container-id="parentContainerId"
        :can-convert-to-super-block="canConvertToSuperBlock"
        @toggle-note="onToggleNoteBlock"
        @toggle-elem-click="toggleElemClick"
        @toggle-video-autoplay="onToggleVideoAutoplay"
        @toggle-video-loop="onToggleVideoLoop"
        @toggle-video-muted="onToggleVideoMuted"
        @toggle-video-controls="onToggleVideoControls"
        @update:image-role="onImageRoleChange"
        @update:elem-click="onElemClickStepChange"
        @update:elem-motion="onElemMotionChange"
        @update:elem-anim="onElemAnimChange"
        @update:elem-slot="onElemSlotChange"
        @update:elem-shiki-lines="onElemShikiLinesChange"
        @update:elem-max-height="onElemMaxHeightChange"
        @apply-super-block-layout="onApplySuperBlockLayout"
        @apply-super-block-ratio="onApplySuperBlockRatio"
        @insert-divider-before="onInsertDividerBefore"
        @insert-divider-after="onInsertDividerAfter"
        @set-two-cols-contrast="onSetTwoColsContrast"
        @clear-block-attrs="onClearBlockAttrs"
        @convert-to-super-block="onConvertToSuperBlock"
      />

      <!-- 场景 C：全局文档演示配置 (未聚焦具体块或选中文档头) -->
      <DocInspectorSection
        v-else
        :doc-theme="docTheme"
        :doc-background="docBackground"
        :doc-aspect-ratio="docAspectRatio"
        :doc-default-transition="docDefaultTransition"
        :doc-spacing="docSpacing"
        :is-batch-processing="isBatchProcessing"
        @update:doc-theme="onDocThemeChange"
        @update:doc-background="onDocBackgroundChange"
        @update:doc-aspect-ratio="onDocAspectRatioChange"
        @update:doc-default-transition="onDocTransitionChange"
        @update:doc-spacing="onDocSpacingChange"
        @open-bottom-preview="onOpenBottomPreview"
        @open-presenter="onOpenPresenter"
        @add-or-identify-notes="onAddOrIdentifyNotesBlocks"
        @clear-notes="onBatchDeleteNotes"
        @auto-animate="onAutoAnimateDocument"
        @clear-animations="onClearAnimationsDocument"
        @ai-auto-split="onAiAutoSplit"
        @clear-dividers="onClearDividers"
        @export-html="onExportHtml"
        @export-pdf="onExportPdf"
        @open-setting="onOpenSetting"
      />
    </div>

    <!-- 导入 Slidev 演示对话框（import 开关关闭时不渲染） -->
    <SlidesImportDialog
      v-if="showImportDialog && isFeatureEnabled('import')"
      @close="showImportDialog = false"
      @success="onImportSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, onUnmounted, watch } from 'vue'
import PageInspectorSection from '@/ui/components/PageInspectorSection.vue'
import BlockInspectorSection from '@/ui/components/BlockInspectorSection.vue'
import DocInspectorSection from '@/ui/components/DocInspectorSection.vue'
import SlidesImportDialog from '@/ui/components/SlidesImportDialog.vue'
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import { extractImageUrl } from '@/utils'
import { globalDocumentCompiler } from '@/compiler/document-compiler'
import { resolveTargetSlide, isDividerBlockType } from '@/sync/inspector-slide-resolver'
import { useInspectorActions } from '@/ui/dock/useInspectorActions'
import { useActiveBlockState } from '@/ui/dock/useActiveBlockState'
import { createPageAttrResolver } from '@/ui/dock/useInspectorPageOverrides'
import { useSuperBlockInspector, type IDetectedSuperBlockInfo } from '@/ui/dock/useSuperBlockInspector'
import { isFeatureEnabled } from '@/feature-flags/feature-flags'
import { clearSlideDividers, runAiAutoSplit } from '@/plugin/ai-auto-split-action'
import type {
  IActiveBlockInfo,
  ISlidesDocument,
} from '@/types/slides-protocol'
import {
  ATTR_DOC_THEME,
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_SPACING,
  ATTR_DOC_BACKGROUND,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
  ATTR_PAGE_HEADER,
  ATTR_PAGE_MASK,
  ATTR_PAGE_MASK_RATIO,
  ATTR_PAGE_MASK_STYLE,
  ATTR_PAGE_MASK_INITIAL,
  ATTR_PAGE_TRANSITION,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_IMAGE,
  ATTR_PAGE_SPACING,
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_ANIM,
  ATTR_ELEM_ANIM_PROPS,
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
} from '@/types/slides-protocol'

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
const parentContainerId = ref('')
const parentContainerSlot = ref('')
const parentContainerClicks = ref('')
const latestDoc = ref<ISlidesDocument | null>(null)
const saveStatus = ref('')
const copyNotice = ref('')

function onCopyBlockId() {
  const id = activeBlockId.value || currentDocId.value
  if (!id) return
  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
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
  let baseLabel = '内容块'
  switch (activeBlockType.value) {
    case 'NodeHeading': baseLabel = '标题块'; break
    case 'NodeParagraph': baseLabel = '段落块'; break
    case 'NodeCodeBlock': baseLabel = '代码块'; break
    case 'NodeVideo': baseLabel = '视频块'; break
    case 'NodeList':
    case 'NodeListItem': baseLabel = '列表项'; break
    case 'NodeBlockquote': baseLabel = '引述块'; break
    case 'NodeTable': baseLabel = '表格块'; break
    case 'NodeSuperBlock':
    case 's':
    case 'sb': baseLabel = '超级块'; break
    default: baseLabel = '内容块'; break
  }
  if (parentContainerId.value) {
    if (parentContainerSlot.value) {
      const colName = parentContainerSlot.value.replace(/^col-(\d+)$/, '第 $1 栏')
      return `${colName} › ${baseLabel}`
    }
    return `分栏容器 › ${baseLabel}`
  }
  return baseLabel
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
const pageSpacing = computed(() => activeBlockAttrs.value[ATTR_PAGE_SPACING] || 'inherit')

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
  if (isDivider.value) {
    const directLayout = activeBlockAttrs.value[ATTR_PAGE_LAYOUT] || activeBlockAttrs.value['custom-slides-layout']
    if (directLayout) return directLayout
  }

  const blockSlot = activeBlockAttrs.value[ATTR_ELEM_SLOT] || activeBlockAttrs.value['custom-slides-slot']
  if (blockSlot && (blockSlot === 'header' || ['col-1', 'col-2', 'col-3'].includes(blockSlot) || /^col-\d+$/.test(blockSlot))) {
    return 'cols-header'
  }

  if (currentPageDividerLayout.value) {
    return currentPageDividerLayout.value
  }

  const divId = currentPageDividerId.value || (isDivider.value ? activeBlockId.value : '')
  if (divId) {
    const override = globalDocumentCompiler.getBlockAttrOverride(divId)
    if (override?.[ATTR_PAGE_LAYOUT]) {
      return override[ATTR_PAGE_LAYOUT]
    }
  }

  if (divId && latestDoc.value?.slides) {
    const matched = latestDoc.value.slides.find(s => s.startBlockId === divId)
    if (matched?.frontmatter?.layout) {
      return matched.frontmatter.layout
    }
  }

  if (targetSlide.value?.frontmatter?.layout) {
    return targetSlide.value.frontmatter.layout
  }

  if (targetSlide.value?.blocks?.some(b => b.slot && (b.slot === 'header' || ['col-1', 'col-2', 'col-3'].includes(b.slot) || /^col-\d+$/.test(b.slot)))) {
    return 'cols-header'
  }

  const docOverride = globalDocumentCompiler.getBlockAttrOverride(currentDocId.value)
  if (docOverride?.[ATTR_PAGE_LAYOUT]) {
    return docOverride[ATTR_PAGE_LAYOUT]
  }

  return 'default'
})

// 分页符页面属性统一走三级查找工厂（直接属性 → 编译器覆写层 → frontmatter 回退）
const pageAttrResolver = createPageAttrResolver({
  activeBlockId,
  activeBlockType,
  activeBlockAttrs,
  currentPageDividerId,
})
const pageLayoutRatio = pageAttrResolver.resolvePageAttr({
  attrKey: ATTR_PAGE_LAYOUT_RATIO,
  mode: 'truthy',
  fallback: () => targetSlide.value?.frontmatter?.layoutRatio || '',
})
const pageHeader = pageAttrResolver.resolvePageAttr({
  attrKey: ATTR_PAGE_HEADER,
  fallback: () => {
    if (targetSlide.value?.frontmatter?.header !== undefined) {
      return targetSlide.value.frontmatter.header
    }
    return true
  },
})
const currentSlideHeader = computed(() => {
  return pageHeader.value !== false && pageHeader.value !== 'false'
})
const pageMask = pageAttrResolver.resolvePageAttr({
  attrKey: ATTR_PAGE_MASK,
  fallback: () => targetSlide.value?.frontmatter?.mask || '',
})
const pageMaskRatio = pageAttrResolver.resolvePageAttr({
  attrKey: ATTR_PAGE_MASK_RATIO,
  fallback: () => targetSlide.value?.frontmatter?.maskRatio || '',
})
const pageMaskStyle = pageAttrResolver.resolvePageAttr({
  attrKey: ATTR_PAGE_MASK_STYLE,
  fallback: () => targetSlide.value?.frontmatter?.maskStyle || 'solid',
})
const pageMaskInitial = pageAttrResolver.resolvePageAttr({
  attrKey: ATTR_PAGE_MASK_INITIAL,
  fallback: () => targetSlide.value?.frontmatter?.maskInitial || 'hidden',
})

export type { IDetectedSuperBlockInfo } from '@/ui/dock/useSuperBlockInspector'

const {
  detectedSbInfo,
  detectedSbRatio,
  isSuperBlock,
  canConvertToSuperBlock,
} = useSuperBlockInspector({
  activeBlockId,
  activeBlockType,
  currentPageDividerId,
  isDivider,
  targetSlide,
})

const targetPageIndex = computed(() => targetSlide.value?.pageIndex || 1)
const isNoteBlock = computed(() => Boolean(activeBlockAttrs.value[ATTR_ELEM_NOTE]))

// 内容块属性绑定
function isCurrentBlockMainText(): boolean {
  if (!parentContainerId.value) return false
  if (activeBlockId.value === parentContainerId.value) return true
  if (typeof document === 'undefined') return true
  const parentEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${parentContainerId.value}"]`) ||
                   document.querySelector(`[data-node-id="${parentContainerId.value}"]`)
  if (!parentEl) return false
  const firstChild = parentEl.querySelector(':scope > [data-node-id], :scope > div > [data-node-id]')
  return firstChild?.getAttribute('data-node-id') === activeBlockId.value
}

// 活动块状态派生抽离：单点查找 + 六类属性读取统一由 useActiveBlockState 提供
const {
  elemClick,
  elemMotion,
  elemAnim,
  elemAnimProps,
  activeBlockContent,
  elemSlot,
} = useActiveBlockState({
  activeBlockId,
  targetSlide,
  activeBlockAttrs,
  parentContainerId,
  parentContainerClicks,
  isCurrentBlockMainText,
})
const elemShikiLines = ref('')
const elemMaxHeight = ref('')

const videoAutoplay = computed(() => activeBlockAttrs.value[ATTR_VIDEO_AUTOPLAY] === 'true')
const videoLoop = computed(() => activeBlockAttrs.value[ATTR_VIDEO_LOOP] === 'true')
const videoMuted = computed(() => activeBlockAttrs.value[ATTR_VIDEO_MUTED] === 'true')
const videoControls = computed(() => activeBlockAttrs.value[ATTR_VIDEO_CONTROLS] !== 'false')

// 文档全局属性绑定
const docTheme = computed(() => latestDoc.value?.config?.theme || activeBlockAttrs.value[ATTR_DOC_THEME] || 'apple-basic')
const docAspectRatio = computed(() => latestDoc.value?.config?.aspectRatio || activeBlockAttrs.value[ATTR_DOC_ASPECT_RATIO] || '16/9')
const docDefaultTransition = computed(() => latestDoc.value?.config?.defaultTransition || activeBlockAttrs.value[ATTR_DOC_DEFAULT_TRANSITION] || 'slide-left')
const docSpacing = computed(() => latestDoc.value?.config?.spacing || activeBlockAttrs.value[ATTR_DOC_SPACING] || 'normal')
const docBackground = computed(() => latestDoc.value?.config?.background || activeBlockAttrs.value[ATTR_DOC_BACKGROUND] || '')

const imageRole = computed(() => {
  const role = activeBlockAttrs.value[ATTR_ELEM_ROLE] || activeBlockAttrs.value['slides-role']
  if (role === ROLE_BACKGROUND || activeBlockAttrs.value[ATTR_PAGE_BACKGROUND] === 'true') {
    return 'background'
  }
  const layout = activeBlockAttrs.value[ATTR_PAGE_LAYOUT] || activeBlockAttrs.value['slides-layout']
  if (layout === 'image-left' || layout === 'image-right') {
    return layout
  }
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

const hasBlockAttrs = computed(() => {
  return Boolean(
    activeBlockAttrs.value[ATTR_ELEM_CLICK] ||
    activeBlockAttrs.value[ATTR_ELEM_MOTION] ||
    activeBlockAttrs.value[ATTR_ELEM_ANIM] ||
    activeBlockAttrs.value[ATTR_ELEM_ANIM_PROPS] ||
    activeBlockAttrs.value[ATTR_ELEM_SLOT] ||
    activeBlockAttrs.value[ATTR_ELEM_SHIKI_LINES] ||
    activeBlockAttrs.value[ATTR_ELEM_NOTE] ||
    activeBlockAttrs.value['slides-note'] ||
    activeBlockAttrs.value[ATTR_ELEM_ROLE] ||
    activeBlockAttrs.value[ATTR_PAGE_LAYOUT] ||
    activeBlockAttrs.value[ATTR_VIDEO_AUTOPLAY] ||
    activeBlockAttrs.value[ATTR_VIDEO_LOOP] ||
    activeBlockAttrs.value[ATTR_VIDEO_MUTED] ||
    activeBlockAttrs.value[ATTR_VIDEO_CONTROLS]
  )
})

// 引入抽象的 actions 组合逻辑
const {
  saveAttr,
  savePageAttr,
  applyPageLayoutAndRatio,
  applyCloverLayout,
  resetSuperBlockWidth,
  saveDocAttr,
  onToggleVideoAutoplay,
  onToggleVideoLoop,
  onToggleVideoMuted,
  onToggleVideoControls,
  onImageRoleChange,
  onToggleNoteBlock,
  onAddNoteBlock,
  onLocateNoteBlock,
  onGenerateNotesWithAI,
  isGeneratingNotes,
  isBatchProcessing,
  onBatchDeleteNotes,
  onAddOrIdentifyNotesBlocks,
  onAutoAnimateDocument,
  onClearAnimationsDocument,
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
  onExportHtml,
  onExportPdf,
} = useInspectorActions({
  activeBlockId,
  activeBlockType,
  activeBlockAttrs,
  rawSnippet,
  currentDocId,
  currentPageDividerId,
  currentPageDividerLayout,
  parentContainerId,
  parentContainerClicks,
  latestDoc,
  targetSlide,
  currentSlideNoteBlockId,
  currentSlideLayout,
  isNoteBlock,
  elemClick,
  videoAutoplay,
  videoLoop,
  videoMuted,
  videoControls,
  pageBackground,
  pageImage,
  elemShikiLines,
  elemMaxHeight,
  saveStatus,
  plugin,
})


// 场景 A 事件
async function onLayoutChange(val: string) {
  if (val === 'clover') {
    const success = await applyCloverLayout()
    if (!success) {
      return
    }
  } else {
    // 页面版式必须作为页面级属性写入分页符或首页根，严禁作为普通块属性写入当前选中的段落
    savePageAttr(ATTR_PAGE_LAYOUT, val)
  }
}

function onLayoutRatioChange(val: string) {
  savePageAttr(ATTR_PAGE_LAYOUT_RATIO, val)
}

function onPageHeaderChange(val: boolean) {
  savePageAttr(ATTR_PAGE_HEADER, val ? 'true' : 'false')
}

async function onMaskChange(val: string) {
  await savePageAttr(ATTR_PAGE_MASK, val)
  const isClock = val === 'clockwise' || val === 'counter-clockwise' || val === 'cw' || val === 'ccw'
  if (isClock) {
    if (!pageMaskRatio.value || pageMaskRatio.value === '1:1') {
      await savePageAttr(ATTR_PAGE_MASK_RATIO, '1:1:1:1')
    }
  }
}

function onMaskRatioChange(val: string) {
  savePageAttr(ATTR_PAGE_MASK_RATIO, val)
}

function onMaskStyleChange(val: string) {
  savePageAttr(ATTR_PAGE_MASK_STYLE, val)
}

function onMaskInitialChange(val: string) {
  savePageAttr(ATTR_PAGE_MASK_INITIAL, val)
}

function onApplySuperBlockLayout(info: any) {
  if (!info) return
  const layout = info.recommendedLayout || (info.colCount && info.colCount >= 2 ? 'cols-header' : 'two-cols')
  const ratio = info.ratio || (info.colCount ? Array(info.colCount).fill(1).join(':') : '1:1')
  applyPageLayoutAndRatio(layout, ratio)
}

function onApplySuperBlockRatio(ratio: string) {
  savePageAttr(ATTR_PAGE_LAYOUT_RATIO, ratio)
}

async function onResetSuperBlockRatio() {
  await resetSuperBlockWidth()
}

function onTransitionChange(val: string) {
  saveAttr(ATTR_PAGE_TRANSITION, val)
}

function onImageChange(val: string) {
  pageImage.value = val
  saveAttr(ATTR_PAGE_IMAGE, val)
}

function onPageSpacingChange(val: string) {
  saveAttr(ATTR_PAGE_SPACING, val === 'inherit' ? '' : val)
}

// 场景 C 事件
function onDocThemeChange(theme: string) {
  saveDocAttr(ATTR_DOC_THEME, theme)
}

function onDocBackgroundChange(val: string) {
  saveDocAttr(ATTR_DOC_BACKGROUND, val)
}

function onDocAspectRatioChange(ratio: string) {
  saveDocAttr(ATTR_DOC_ASPECT_RATIO, ratio)
}

function onDocTransitionChange(trans: string) {
  saveDocAttr(ATTR_DOC_DEFAULT_TRANSITION, trans)
}

function onDocSpacingChange(spacing: string) {
  saveDocAttr(ATTR_DOC_SPACING, spacing)
}

// 顶栏操作
function onOpenBottomPreview() {
  if (plugin?.openBottomPreviewTab) {
    plugin.openBottomPreviewTab()
  }
}

function onOpenPresenter() {
  // 以思源页签承载演讲者控制台：桌面端 window.open 会被宿主甩给系统浏览器导致同步失效
  if (plugin?.openPresenterTab) {
    void plugin.openPresenterTab()
  }
}

let isOpeningSetting = false
function onOpenSetting() {
  if (isOpeningSetting) return
  isOpeningSetting = true
  try {
    if (plugin && typeof plugin.openSetting === 'function') {
      plugin.openSetting()
    } else if (plugin && plugin.setting && typeof plugin.setting.open === 'function') {
      plugin.setting.open(plugin.name || 'siyuan-live-slides')
    }
  } finally {
    setTimeout(() => {
      isOpeningSetting = false
    }, 500)
  }
}

function onAiAutoSplit() {
  // 思源 Plugin 类没有 executeCommand，直接调用抽出的分页回调
  if (plugin && isFeatureEnabled('aiScript')) {
    void runAiAutoSplit(plugin)
  }
}

async function onClearDividers() {
  if (plugin && isFeatureEnabled('aiScript')) {
    if (isBatchProcessing.value) return
    isBatchProcessing.value = true
    try {
      await clearSlideDividers(plugin)
    } finally {
      isBatchProcessing.value = false
    }
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
    parentContainerId.value = info.parentContainerId || ''
    parentContainerSlot.value = info.parentContainerSlot || ''
    parentContainerClicks.value = info.parentContainerClicks || ''
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
  updateDocument(doc: ISlidesDocument) {
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
