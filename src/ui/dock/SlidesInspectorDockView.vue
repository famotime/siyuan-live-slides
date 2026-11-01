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
        <!-- 导入 Slidev 演示文档 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="导入 Slidev 演示文档 (.md / .zip)"
          @click="showImportDialog = true"
        >
          <SlidesIcon name="import" />
          <span>导入</span>
        </button>

        <!-- 快捷打开下方分屏预览 -->
        <button
          class="spm-icon-btn is-primary b3-tooltips b3-tooltips__s"
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
          class="spm-target-id b3-tooltips b3-tooltips__s"
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
        :page-mask="pageMask"
        :page-mask-ratio="pageMaskRatio"
        :page-mask-style="pageMaskStyle"
        :page-mask-initial="pageMaskInitial"
        :detected-sb-ratio="detectedSbRatio"
        :detected-sb-info="detectedSbInfo"
        :page-transition="pageTransition"
        :page-background="pageBackground"
        :page-spacing="pageSpacing"
        :page-image="pageImage"
        :page-notes="currentSlideNotes"
        :page-index="targetPageIndex"
        @update:page-layout="onLayoutChange"
        @update:page-layout-ratio="onLayoutRatioChange"
        @update:page-mask="onMaskChange"
        @update:page-mask-ratio="onMaskRatioChange"
        @update:page-mask-style="onMaskStyleChange"
        @update:page-mask-initial="onMaskInitialChange"
        @apply-super-block-layout="onApplySuperBlockLayout"
        @reset-superblock-ratio="onResetSuperBlockRatio"
        @update:page-transition="onTransitionChange"
        @update:page-background="onBackgroundChange"
        @update:page-spacing="onPageSpacingChange"
        @update:page-image="onImageChange"
        @add-note-block="onAddNoteBlock"
        @locate-note-block="onLocateNoteBlock"
        @generate-notes="onGenerateNotesWithAI"
        @batch-append-notes="onBatchAppendNotes"
        @batch-delete-notes="onBatchDeleteNotes"
        :is-batch-processing="isBatchProcessing"
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
        :parent-elem-click="parentContainerClicks"
        :parent-container-slot="parentContainerSlot"
        :parent-container-id="parentContainerId"
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
        @apply-super-block-layout="onApplySuperBlockLayout"
        @apply-super-block-ratio="onApplySuperBlockRatio"
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
        :is-exporting-images="isExportingImages"
        @update:doc-theme="onDocThemeChange"
        @update:doc-aspect-ratio="onDocAspectRatioChange"
        @update:doc-default-transition="onDocTransitionChange"
        @update:doc-spacing="onDocSpacingChange"
        @open-bottom-preview="onOpenBottomPreview"
        @open-presenter="onOpenPresenter"
        @ai-auto-split="onAiAutoSplit"
        @export-html="onExportHtml"
        @export-pdf="onExportPdf"
        @export-images="onExportImages"
      />
    </div>

    <!-- 导入 Slidev 演示对话框 -->
    <SlidesImportDialog
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
import SlidesImportDialog from '@/ui/components/SlidesImportDialog.vue'
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import { extractImageUrl } from '@/utils'
import { globalDocumentCompiler } from '@/compiler/document-compiler'
import {
  extractSuperBlockWidthRatios,
  getContentChildren,
  isHorizontalSuperBlock,
  isSuperBlock as isSuperBlockNode,
} from '@/compiler/superblock-scanner'
import { resolveTargetSlide, isDividerBlockType } from '@/sync/inspector-slide-resolver'
import { useInspectorActions } from '@/ui/dock/useInspectorActions'
import { createPageAttrResolver } from '@/ui/dock/useInspectorPageOverrides'
import type {
  IActiveBlockInfo,
  ISlidesDocument,
} from '@/types/slides-protocol'
import {
  ATTR_DOC_THEME,
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_SPACING,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
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
  if (blockSlot && (['col-1', 'col-2', 'col-3'].includes(blockSlot) || /^col-\d+$/.test(blockSlot))) {
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

  if (targetSlide.value?.blocks?.some(b => b.slot && (['col-1', 'col-2', 'col-3'].includes(b.slot) || /^col-\d+$/.test(b.slot)))) {
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

export interface IDetectedSuperBlockInfo {
  hasSuperBlock: boolean
  colCount: number
  ratio: string
  isCustomWidth: boolean
  recommendedLayout: string
}

function parseSuperBlockDom(sbEl: Element): IDetectedSuperBlockInfo | null {
  if (!sbEl) return null
  const layout = (sbEl.getAttribute('data-sb-layout') || '').toLowerCase()
  if (layout !== 'col') return null

  const children = Array.from(sbEl.querySelectorAll(':scope > [data-node-id]')) as HTMLElement[]
  if (children.length < 2) return null

  const colCount = children.length
  const rawPcts: (number | null)[] = children.map(c => {
    const style = c.getAttribute('style') || ''
    const mCalc = style.match(/calc\(\s*([\d.]+)%/)
    if (mCalc) return parseFloat(mCalc[1])
    const mWidth = style.match(/(?:^|;|\s)width:\s*([\d.]+)%/i)
    if (mWidth) return parseFloat(mWidth[1])
    return null
  })

  let ratio = ''
  let isCustomWidth = false
  if (rawPcts.some(p => p !== null)) {
    isCustomWidth = true
    const knownSum = rawPcts.reduce((a, b) => a + (b || 0), 0)
    const unknownCount = rawPcts.filter(p => p === null).length
    const fill = unknownCount > 0 ? Math.max(0, 100 - knownSum) / unknownCount : 100 / children.length
    const finalPcts = rawPcts.map(p => (p !== null ? p : fill))
    const sum = finalPcts.reduce((a, b) => a + b, 0) || 1
    const norm = finalPcts.map(p => (p / sum) * 100)

    if (norm.length === 2) {
      const [p1] = norm
      if (p1 >= 48 && p1 <= 52) ratio = '1:1'
      else if (p1 >= 31 && p1 <= 35) ratio = '1:2'
      else if (p1 >= 65 && p1 <= 69) ratio = '2:1'
      else if (p1 >= 28 && p1 <= 32) ratio = '3:7'
      else if (p1 >= 68 && p1 <= 72) ratio = '7:3'
      else if (p1 >= 38 && p1 <= 42) ratio = '4:6'
      else if (p1 >= 58 && p1 <= 62) ratio = '6:4'
      else {
        const r1 = Math.round(p1)
        ratio = `${r1}:${100 - r1}`
      }
    } else if (norm.length === 3) {
      const [p1, p2, p3] = norm
      if (p1 >= 31 && p1 <= 35 && p2 >= 31 && p2 <= 35 && p3 >= 31 && p3 <= 35) ratio = '1:1:1'
      else if (p1 >= 23 && p1 <= 27 && p2 >= 48 && p2 <= 52 && p3 >= 23 && p3 <= 27) ratio = '1:2:1'
      else if (p1 >= 48 && p1 <= 52 && p2 >= 23 && p2 <= 27 && p3 >= 23 && p3 <= 27) ratio = '2:1:1'
      else if (p1 >= 23 && p1 <= 27 && p2 >= 23 && p2 <= 27 && p3 >= 48 && p3 <= 52) ratio = '1:1:2'
      else {
        const r1 = Math.round(p1)
        const r2 = Math.round(p2)
        ratio = `${r1}:${r2}:${100 - r1 - r2}`
      }
    } else {
      ratio = norm.map(p => Math.round(p)).join(':')
    }
  } else {
    isCustomWidth = false
    ratio = Array.from({ length: colCount }, () => 1).join(':')
  }

  const recommendedLayout = colCount >= 2 ? 'cols-header' : 'two-cols'
  return {
    hasSuperBlock: true,
    colCount,
    ratio,
    isCustomWidth,
    recommendedLayout,
  }
}

function parseSuperBlockAst(slide: any): IDetectedSuperBlockInfo | null {
  if (!slide?.blocks) return null
  for (const b of slide.blocks) {
    const raw = b.rawNode
    if (raw && isSuperBlockNode(raw) && isHorizontalSuperBlock(raw)) {
      const contentChildren = getContentChildren(raw)
      const colCount = contentChildren.length
      const r = extractSuperBlockWidthRatios(raw)
      return {
        hasSuperBlock: true,
        colCount,
        ratio: r || Array.from({ length: colCount }, () => 1).join(':'),
        isCustomWidth: Boolean(r),
        recommendedLayout: colCount >= 2 ? 'cols-header' : 'two-cols',
      }
    }
  }
  return null
}

const detectedSbInfo = computed<IDetectedSuperBlockInfo | null>(() => {
  if (typeof document !== 'undefined') {
    // 1. 若当前选中的块本身是超级块或处于超级块内
    const activeId = activeBlockId.value
    if (activeId) {
      const activeEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${activeId}"]`)
      if (activeEl) {
        const sbEl = activeEl.getAttribute('data-type') === 'NodeSuperBlock' ? activeEl : activeEl.closest('[data-type="NodeSuperBlock"]')
        if (sbEl) {
          const parsed = parseSuperBlockDom(sbEl)
          if (parsed) return parsed
        }
      }
    }

    // 2. 检查当前页内的超级块 (从当前页分页符开始向后找兄弟节点，直到下一个分页符)
    const divId = currentPageDividerId.value || (isDivider.value ? activeBlockId.value : '')
    if (divId) {
      const divEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${divId}"]`)
      if (divEl) {
        let sibling = divEl.nextElementSibling
        while (sibling) {
          if (sibling.getAttribute('data-type') === 'NodeThematicBreak' || sibling.classList?.contains('protyle-wysiwyg__block--hr')) {
            break
          }
          const sbEl = sibling.getAttribute('data-type') === 'NodeSuperBlock' ? sibling : sibling.querySelector('[data-type="NodeSuperBlock"]')
          if (sbEl) {
            const parsed = parseSuperBlockDom(sbEl)
            if (parsed) return parsed
          }
          sibling = sibling.nextElementSibling
        }
      }
    } else {
      // 3. 首页（没有前置分页符）：从 protyle-wysiwyg 顶部开始找直到第一个分页符
      const firstDivider = document.querySelector('.protyle-wysiwyg [data-type="NodeThematicBreak"], .protyle-wysiwyg .protyle-wysiwyg__block--hr')
      const allSuperBlocks = Array.from(document.querySelectorAll('.protyle-wysiwyg [data-type="NodeSuperBlock"]'))
      for (const sb of allSuperBlocks) {
        if (!firstDivider || (sb.compareDocumentPosition(firstDivider) & Node.DOCUMENT_POSITION_FOLLOWING)) {
          const parsed = parseSuperBlockDom(sb)
          if (parsed) return parsed
        }
      }
    }
  }

  // 4. AST 回退
  return parseSuperBlockAst(targetSlide.value)
})

const detectedSbRatio = computed(() => detectedSbInfo.value?.ratio || '')

const isSuperBlock = computed(() => {
  const type = activeBlockType.value || ''
  if (type === 'NodeSuperBlock' || type === 's' || type === 'sb') return true
  if (typeof document !== 'undefined' && activeBlockId.value) {
    const el = document.querySelector(`.protyle-wysiwyg [data-node-id="${activeBlockId.value}"]`)
    if (el?.closest('[data-type="NodeSuperBlock"]')) return true
  }
  return false
})

const targetPageIndex = computed(() => targetSlide.value?.pageIndex || 1)
const isNoteBlock = computed(() => Boolean(activeBlockAttrs.value[ATTR_ELEM_NOTE] || activeBlockAttrs.value['slides-note']))

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

const elemClick = computed(() => {
  if (activeBlockAttrs.value[ATTR_ELEM_CLICK] !== undefined) {
    return activeBlockAttrs.value[ATTR_ELEM_CLICK] || ''
  }
  // 若当前聚焦的块是列表项容器的首行主文本，且自身未定义，展示容器的 clicks (主容器视觉权威)
  if (parentContainerId.value && isCurrentBlockMainText()) {
    return parentContainerClicks.value || ''
  }
  // 若当前聚焦的块归属于列表项容器内部其他子组件 (如图片)，且自身未显式定义 clicks，
  // 则严格遵循未单独开启逐步呈现，绝对不回退到匹配模型或父级 clicks，保持为 '' (跟随整栏)
  if (parentContainerId.value) {
    return ''
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
  onExportImages,
  isExportingImages,
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
    saveAttr(ATTR_PAGE_LAYOUT, val)
  }
}

function onLayoutRatioChange(val: string) {
  savePageAttr(ATTR_PAGE_LAYOUT_RATIO, val)
}

function onMaskChange(val: string) {
  savePageAttr(ATTR_PAGE_MASK, val)
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
  // 以思源页签承载演讲者控制台：桌面端 window.open 会被宿主甩给系统浏览器导致同步失效
  if (plugin?.openPresenterTab) {
    void plugin.openPresenterTab()
  }
}

function onAiAutoSplit() {
  if (plugin?.executeCommand) {
    plugin.executeCommand('slidesAiSplit')
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
