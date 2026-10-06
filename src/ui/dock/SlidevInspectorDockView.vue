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
        :page-layout-ratio="pageLayoutRatio"
        :detected-sb-ratio="detectedSbRatio"
        :page-transition="pageTransition"
        :page-background="pageBackground"
        :page-spacing="pageSpacing"
        :page-image="pageImage"
        :page-notes="currentSlideNotes"
        :page-index="targetPageIndex"
        @update:page-layout="onLayoutChange"
        @update:page-layout-ratio="onLayoutRatioChange"
        @update:page-transition="onTransitionChange"
        @update:page-background="onBackgroundChange"
        @update:page-spacing="onPageSpacingChange"
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
        :doc-spacing="docSpacing"
        @update:doc-theme="onDocThemeChange"
        @update:doc-aspect-ratio="onDocAspectRatioChange"
        @update:doc-default-transition="onDocTransitionChange"
        @update:doc-spacing="onDocSpacingChange"
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
import PageInspectorSection from '@/ui/components/PageInspectorSection.vue'
import BlockInspectorSection from '@/ui/components/BlockInspectorSection.vue'
import DocInspectorSection from '@/ui/components/DocInspectorSection.vue'
import SlidevImportDialog from '@/ui/components/SlidevImportDialog.vue'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'
import { extractImageUrl } from '@/utils'
import { globalDocumentCompiler } from '@/compiler/document-compiler'
import { resolveTargetSlide, isDividerBlockType } from '@/sync/inspector-slide-resolver'
import { useInspectorActions } from '@/ui/dock/useInspectorActions'
import type {
  IActiveBlockInfo,
  ISlidevDocument,
} from '@/types/slidev-protocol'
import {
  ATTR_DOC_THEME,
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_SPACING,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
  ATTR_PAGE_TRANSITION,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_IMAGE,
  ATTR_PAGE_SPACING,
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
    const directLayout = activeBlockAttrs.value[ATTR_PAGE_LAYOUT] || activeBlockAttrs.value['custom-slidev-layout']
    if (directLayout) return directLayout
  }

  const blockSlot = activeBlockAttrs.value[ATTR_ELEM_SLOT] || activeBlockAttrs.value['custom-slidev-slot']
  if (blockSlot && ['col-1', 'col-2', 'col-3'].includes(blockSlot)) {
    return 'three-cols-header'
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

  if (targetSlide.value?.blocks?.some(b => b.slot === 'col-1' || b.slot === 'col-2' || b.slot === 'col-3')) {
    return 'three-cols-header'
  }

  const docOverride = globalDocumentCompiler.getBlockAttrOverride(currentDocId.value)
  if (docOverride?.[ATTR_PAGE_LAYOUT]) {
    return docOverride[ATTR_PAGE_LAYOUT]
  }

  return 'default'
})

const pageLayoutRatio = computed(() => {
  if (isDivider.value) {
    const directRatio = activeBlockAttrs.value[ATTR_PAGE_LAYOUT_RATIO] || activeBlockAttrs.value['custom-slidev-layout-ratio']
    if (directRatio) return directRatio
  }
  const divId = currentPageDividerId.value || (isDivider.value ? activeBlockId.value : '')
  if (divId) {
    const override = globalDocumentCompiler.getBlockAttrOverride(divId)
    if (override?.[ATTR_PAGE_LAYOUT_RATIO]) {
      return override[ATTR_PAGE_LAYOUT_RATIO]
    }
  }
  return targetSlide.value?.frontmatter?.layoutRatio || ''
})

const detectedSbRatio = computed(() => {
  if (typeof document === 'undefined') return ''
  const divId = currentPageDividerId.value || (isDivider.value ? activeBlockId.value : '')
  if (!divId) return ''
  const divEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${divId}"]`)
  if (!divEl) return ''
  let sibling = divEl.nextElementSibling
  while (sibling) {
    if (sibling.getAttribute('data-type') === 'NodeThematicBreak' || sibling.classList?.contains('protyle-wysiwyg__block--hr')) {
      break
    }
    const sbEl = sibling.getAttribute('data-type') === 'NodeSuperBlock' ? sibling : sibling.querySelector('[data-type="NodeSuperBlock"]')
    if (sbEl && sbEl.getAttribute('data-sb-layout') === 'col') {
      const children = Array.from(sbEl.querySelectorAll(':scope > [data-node-id]')) as HTMLElement[]
      if (children.length >= 2) {
        const rawPcts: (number | null)[] = children.map(c => {
          const m = (c.getAttribute('style') || '').match(/calc\(([\d.]+)%/)
          return m ? parseFloat(m[1]) : null
        })
        if (rawPcts.some(p => p !== null)) {
          const knownSum = rawPcts.reduce((a, b) => a + (b || 0), 0)
          const unknownCount = rawPcts.filter(p => p === null).length
          const fill = unknownCount > 0 ? (100 - knownSum) / unknownCount : 100 / children.length
          const finalPcts = rawPcts.map(p => p !== null ? p : fill)
          const sum = finalPcts.reduce((a, b) => a + b, 0) || 1
          const norm = finalPcts.map(p => (p / sum) * 100)
          if (norm.length === 2) {
            const [p1] = norm
            if (p1 >= 48 && p1 <= 52) return '1:1'
            if (p1 >= 31 && p1 <= 35) return '1:2'
            if (p1 >= 65 && p1 <= 69) return '2:1'
            if (p1 >= 28 && p1 <= 32) return '3:7'
            if (p1 >= 68 && p1 <= 72) return '7:3'
            if (p1 >= 38 && p1 <= 42) return '4:6'
            if (p1 >= 58 && p1 <= 62) return '6:4'
            const r1 = Math.round(p1)
            return `${r1}:${100 - r1}`
          }
          if (norm.length === 3) {
            const [p1, p2, p3] = norm
            if (p1 >= 31 && p1 <= 35 && p2 >= 31 && p2 <= 35 && p3 >= 31 && p3 <= 35) return '1:1:1'
            if (p1 >= 23 && p1 <= 27 && p2 >= 48 && p2 <= 52 && p3 >= 23 && p3 <= 27) return '1:2:1'
            const r1 = Math.round(p1)
            const r2 = Math.round(p2)
            return `${r1}:${r2}:${100 - r1 - r2}`
          }
          return norm.map(p => Math.round(p)).join(':')
        }
      }
    }
    sibling = sibling.nextElementSibling
  }
  return ''
})

const targetPageIndex = computed(() => targetSlide.value?.pageIndex || 1)
const isNoteBlock = computed(() => Boolean(activeBlockAttrs.value[ATTR_ELEM_NOTE] || activeBlockAttrs.value['slidev-note']))

// 内容块属性绑定
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

const videoAutoplay = computed(() => activeBlockAttrs.value[ATTR_VIDEO_AUTOPLAY] === 'true')
const videoLoop = computed(() => activeBlockAttrs.value[ATTR_VIDEO_LOOP] === 'true')
const videoMuted = computed(() => activeBlockAttrs.value[ATTR_VIDEO_MUTED] === 'true')
const videoControls = computed(() => activeBlockAttrs.value[ATTR_VIDEO_CONTROLS] !== 'false')

// 文档全局属性绑定
const docTheme = computed(() => latestDoc.value?.config?.theme || activeBlockAttrs.value[ATTR_DOC_THEME] || 'default')
const docAspectRatio = computed(() => latestDoc.value?.config?.aspectRatio || activeBlockAttrs.value[ATTR_DOC_ASPECT_RATIO] || '16/9')
const docDefaultTransition = computed(() => latestDoc.value?.config?.defaultTransition || activeBlockAttrs.value[ATTR_DOC_DEFAULT_TRANSITION] || 'slide-left')
const docSpacing = computed(() => latestDoc.value?.config?.spacing || activeBlockAttrs.value[ATTR_DOC_SPACING] || 'normal')

const imageRole = computed(() => {
  const role = activeBlockAttrs.value[ATTR_ELEM_ROLE] || activeBlockAttrs.value['slidev-role']
  if (role === ROLE_BACKGROUND || activeBlockAttrs.value[ATTR_PAGE_BACKGROUND] === 'true') {
    return 'background'
  }
  const layout = activeBlockAttrs.value[ATTR_PAGE_LAYOUT] || activeBlockAttrs.value['slidev-layout']
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

// 引入抽象的 actions 组合逻辑
const {
  saveAttr,
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
} = useInspectorActions({
  activeBlockId,
  activeBlockType,
  activeBlockAttrs,
  rawSnippet,
  currentDocId,
  currentPageDividerId,
  currentPageDividerLayout,
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
function onLayoutChange(val: string) {
  saveAttr(ATTR_PAGE_LAYOUT, val)
}

function onLayoutRatioChange(val: string) {
  saveAttr(ATTR_PAGE_LAYOUT_RATIO, val)
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

function onPageSpacingChange(val: string) {
  saveAttr(ATTR_PAGE_SPACING, val === 'inherit' ? '' : val)
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
  if (typeof window !== 'undefined') {
    window.open('/plugins/siyuan-slidev/slidev-client/presenter.html', 'SlidevPresenter', 'width=1200,height=800')
  }
}

function onAiAutoSplit() {
  if (plugin?.executeCommand) {
    plugin.executeCommand('slidevAiSplit')
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
