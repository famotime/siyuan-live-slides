<template>
  <div
    class="spm-presenter-tab"
    tabindex="0"
    @keydown="onKeyDown"
    @wheel="onWheel"
  >
    <!-- 顶栏状态 -->
    <header class="presenter-header">
      <div class="presenter-title-area">
        <div class="presenter-brand">
          <SlidesIcon name="presenter" class="brand-icon" />
          <span class="title-name">演讲者控制台</span>
        </div>
        <div class="header-pills">
          <span class="pill pill-page">P.{{ currentPage }} / {{ totalPages || 1 }}</span>
          <span v-if="currentMaxStep > 0" class="pill pill-step">
            <SlidesIcon name="step" class="pill-icon" />
            步进 {{ currentStep }} / {{ currentMaxStep }}
          </span>
        </div>
      </div>

      <div class="header-toolbar">
        <button
          class="btn-tool b3-tooltips b3-tooltips__s"
          aria-label="弹出大屏放映独立窗口 (16:9)"
          @click="openStandaloneWindow"
        >
          <SlidesIcon name="window" />
          <span class="btn-tool-label">独立放映</span>
        </button>

        <div class="timer-capsule">
          <SlidesIcon name="clock" class="timer-icon" />
          <span class="timer-digits">{{ formattedTime }}</span>
          <div class="timer-actions">
            <button
              class="timer-btn b3-tooltips b3-tooltips__s"
              :aria-label="isTimerRunning ? '暂停计时' : '继续计时'"
              @click="toggleTimer"
            >
              <SlidesIcon :name="isTimerRunning ? 'pause' : 'play'" />
            </button>
            <button
              class="timer-btn b3-tooltips b3-tooltips__s"
              aria-label="重置计时"
              @click="resetTimer"
            >
              <SlidesIcon name="reset" />
            </button>
          </div>
        </div>

        <div class="wall-clock b3-tooltips b3-tooltips__sw" aria-label="系统当前时间">
          <span>{{ wallClockTime }}</span>
        </div>
      </div>
    </header>

    <!-- 主展示网格 -->
    <main v-if="totalPages > 0" class="presenter-grid">
      <!-- 左侧：当前幻灯片与下一页完整缩略图预览 -->
      <section class="slide-panels">
        <div class="panel-box current-slide-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="panel-tag is-current">当前放映</span>
              <span class="panel-page-num">P.{{ currentPage }}</span>
            </div>
            <div class="panel-header-meta">
              <span v-if="currentMaxStep > 0" class="panel-step-pill">
                步进 {{ currentStep }} / {{ currentMaxStep }}
              </span>
              <span class="panel-layout-pill">{{ currentSlide?.frontmatter?.layout || 'default' }}</span>
            </div>
          </div>
          <div
            ref="currentPreviewRef"
            class="panel-preview"
            :aria-label="currentSlideTitle"
          >
            <div
              v-if="currentSlide"
              class="presenter-thumb-box"
              :style="{
                width: currentThumbMetrics.boxWidth + 'px',
                height: currentThumbMetrics.boxHeight + 'px',
              }"
            >
              <div
                class="presenter-thumb-viewport slide-viewport"
                :class="'slides-theme-' + activeSlidesTheme"
                :data-theme="currentSlideThemeMode"
                :data-slides-theme="activeSlidesTheme"
                :data-normalize-headings="isNormalizeHeadings ? 'true' : 'false'"
                :data-hide-unordered-markers="isHideUnorderedMarkers ? 'true' : 'false'"
                :data-hide-ordered-markers="isHideOrderedMarkers ? 'true' : 'false'"
                :style="{
                  width: slideAspect.baseWidth + 'px',
                  height: slideAspect.baseHeight + 'px',
                  transform: 'scale(' + currentThumbMetrics.scale + ')',
                }"
                v-html="currentSlideHtml"
              ></div>
            </div>
            <div v-else class="panel-fallback">
              <h2>{{ currentSlideTitle }}</h2>
              <p>{{ currentSlideSnippet }}</p>
            </div>
          </div>
        </div>

        <div
          class="panel-box next-slide-panel"
          :class="{ 'is-clickable': Boolean(nextSlide), 'b3-tooltips b3-tooltips__n': Boolean(nextSlide) }"
          :aria-label="nextSlide ? '点击直接跳至下一页' : ''"
          @click="nextSlide && goNextSlide()"
        >
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="panel-tag">下一页预告</span>
              <span v-if="currentPage < totalPages" class="panel-page-num">P.{{ currentPage + 1 }}</span>
            </div>
            <div class="panel-header-meta">
              <span v-if="currentPage >= totalPages" class="panel-end-pill">已到尾页</span>
              <span v-else-if="nextSlide" class="panel-layout-pill">{{ nextSlide.frontmatter?.layout || 'default' }}</span>
            </div>
          </div>
          <div
            ref="nextPreviewRef"
            class="panel-preview panel-preview--dim"
            :aria-label="nextSlideTitle"
          >
            <div
              v-if="nextSlide"
              class="presenter-thumb-box"
              :style="{
                width: nextThumbMetrics.boxWidth + 'px',
                height: nextThumbMetrics.boxHeight + 'px',
              }"
            >
              <div
                class="presenter-thumb-viewport slide-viewport"
                :class="'slides-theme-' + activeSlidesTheme"
                :data-theme="nextSlideThemeMode"
                :data-slides-theme="activeSlidesTheme"
                :data-normalize-headings="isNormalizeHeadings ? 'true' : 'false'"
                :data-hide-unordered-markers="isHideUnorderedMarkers ? 'true' : 'false'"
                :data-hide-ordered-markers="isHideOrderedMarkers ? 'true' : 'false'"
                :style="{
                  width: slideAspect.baseWidth + 'px',
                  height: slideAspect.baseHeight + 'px',
                  transform: 'scale(' + nextThumbMetrics.scale + ')',
                }"
                v-html="nextSlideHtml"
              ></div>
            </div>
            <div v-else class="panel-fallback">
              <h2>{{ nextSlideTitle }}</h2>
              <p>{{ nextSlideSnippet }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 右侧：演讲者私有讲稿备忘卡 (Notes) -->
      <section class="notes-panel">
        <div class="panel-header">
          <div class="panel-header-left">
            <SlidesIcon name="notes" class="panel-title-icon" />
            <span>讲稿备忘</span>
          </div>
          <div class="notes-size-controls">
            <button
              class="notes-btn b3-tooltips b3-tooltips__w"
              aria-label="减小字体"
              :disabled="notesFontSize <= 14"
              @click="decreaseFontSize"
            >
              <SlidesIcon name="minus" />
            </button>
            <span class="notes-size-value">{{ notesFontSize }}px</span>
            <button
              class="notes-btn b3-tooltips b3-tooltips__w"
              aria-label="增大字体"
              :disabled="notesFontSize >= 36"
              @click="increaseFontSize"
            >
              <SlidesIcon name="plus" />
            </button>
          </div>
        </div>
        <div
          class="notes-content"
          :class="{ 'is-empty': !currentNotes }"
          :style="{ fontSize: notesFontSize + 'px' }"
        >
          {{ currentNotes || '（本页未设置演讲者备忘录）' }}
        </div>
      </section>
    </main>

    <!-- 空数据等待态：显式给出原因与自救入口 -->
    <main v-else class="presenter-empty">
      <div class="empty-icon-wrap">
        <SlidesIcon name="refresh" class="empty-icon" />
      </div>
      <h2>{{ docConfig?.allSlidesHidden ? '所有页面均已隐藏' : '等待大屏放映数据' }}</h2>
      <p>{{ docConfig?.allSlidesHidden ? '当前文档的幻灯片页面均已设置为隐藏，请先取消至少一页的隐藏状态。' : '未检测到活跃的幻灯片数据，请先开启大屏放映端。' }}</p>
      <div class="empty-actions">
        <button
          class="btn-empty-action b3-tooltips b3-tooltips__n"
          aria-label="在思源中打开底部演示预览页签"
          @click="openBigScreen"
        >
          <SlidesIcon name="presenter" />
          <span>打开大屏放映页签</span>
        </button>
        <button
          class="btn-empty-action btn-empty-action--popout b3-tooltips b3-tooltips__n"
          aria-label="将放映端弹出为独立窗口 (16:9)"
          @click="openStandaloneWindow"
        >
          <SlidesIcon name="window" />
          <span>弹出独立放映窗口</span>
        </button>
      </div>
    </main>

    <!-- 底栏翻页与步进控制 -->
    <footer class="presenter-actions">
      <div class="nav-btn-group">
        <button
          class="btn-nav btn-nav--slide b3-tooltips b3-tooltips__ne"
          :disabled="currentPage <= 1"
          aria-label="快速返回上一页 (Shift + ←)"
          @click="goPrevSlide"
        >
          <SlidesIcon name="chevrons-left" />
          <span>上一页</span>
        </button>
        <button
          class="btn-nav btn-nav--step b3-tooltips b3-tooltips__n"
          :disabled="!canGoPrevStep"
          aria-label="回退一步 (←)"
          @click="goPrevStep"
        >
          <SlidesIcon name="chevron-left" />
          <span>上一步</span>
        </button>
      </div>

      <div class="actions-center">
        <div class="center-meta">
          <span class="progress-pill">{{ progressPercent }}%</span>
        </div>
        <button
          class="btn-restart b3-tooltips b3-tooltips__n"
          aria-label="从第一页重新放映 (Home)"
          @click="restartPresentation"
        >
          <SlidesIcon name="reset" />
          <span>重头放映</span>
        </button>
      </div>

      <div class="nav-btn-group">
        <!-- 步进点阵指示器：紧邻下一步按钮左侧，就近感知 -->
        <div
          v-if="currentMaxStep > 0"
          class="step-dots-bar b3-tooltips b3-tooltips__n"
          :aria-label="`步进进度: ${currentStep} / ${currentMaxStep}`"
        >
          <span
            v-for="idx in currentMaxStep"
            :key="idx"
            class="step-dot"
            :class="{ 'is-active': idx <= currentStep }"
          />
          <span class="step-dots-text">{{ currentStep }}/{{ currentMaxStep }}</span>
        </div>
        <button
          class="btn-nav btn-nav--step btn-nav--primary b3-tooltips b3-tooltips__n"
          :disabled="!canGoNextStep"
          aria-label="触发下一步骤或进入下一页 (Space / →)"
          @click="goNextStep"
        >
          <span>下一步</span>
          <SlidesIcon name="chevron-right" />
        </button>
        <button
          class="btn-nav btn-nav--slide b3-tooltips b3-tooltips__nw"
          :disabled="currentPage >= totalPages"
          aria-label="跳过本页剩余步骤，直接进入下一页 (Shift + →)"
          @click="goNextSlide"
        >
          <span>下一页</span>
          <SlidesIcon name="chevrons-right" />
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, inject } from 'vue'
import type { Plugin } from 'siyuan'
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import { WebSandboxBridge } from '@/engine/web-sandbox-bridge'
import { filterVisibleSlides } from '@/types/slides-protocol'
import type {
  ISlidesDocument,
  ISlidesPluginConfig,
  ISlidesVirtualPage,
  ISlidesBlockItem,
} from '@/types/slides-protocol'
import {
  computeSlideMaxStep,
  computeThumbnailScale,
  parseSlideAspectRatio,
  renderPresenterSlideThumbnailHtml,
} from './presenter-slide-thumbnail'
import {
  detectSiYuanThemeMode,
  isLightColor,
  observeSiYuanThemeMode,
  resolveEffectiveColorSchema,
} from '@/utils/color-utils'
import { usePresenterTimer } from './usePresenterTimer'
import { usePresenterSync } from './usePresenterSync'

const plugin = inject<Plugin>('plugin')
const sandboxBridge = inject<WebSandboxBridge>('sandboxBridge', new WebSandboxBridge())

const slides = ref<ISlidesVirtualPage[]>([])
const docConfig = ref<Partial<ISlidesPluginConfig>>({})
const currentPage = ref(1)
const currentStep = ref(0)
// 桥接侧上报的总页数与最大步数兜底：幻灯片数据未到位时也能显示正确页数/步数并解锁控制
const bridgeTotal = ref(0)
const bridgeMaxStep = ref(0)
const totalPages = computed(() => slides.value.length || bridgeTotal.value)

// 缩略图画布容器引用与实时测量尺寸
const currentPreviewRef = ref<HTMLElement | null>(null)
const nextPreviewRef = ref<HTMLElement | null>(null)
const currentContainerSize = ref({ width: 0, height: 0 })
const nextContainerSize = ref({ width: 0, height: 0 })

const hostThemeMode = ref<'light' | 'dark'>(detectSiYuanThemeMode())
const slideAspect = computed(() => parseSlideAspectRatio(docConfig.value?.aspectRatio))
const activeSlidesTheme = computed(() => docConfig.value?.theme || 'apple-basic')
const activeColorSchema = computed(() => resolveEffectiveColorSchema(docConfig.value?.colorSchema, hostThemeMode.value))
const isNormalizeHeadings = computed(() => Boolean(docConfig.value?.normalizeHeadingSizes))
const isHideUnorderedMarkers = computed(() => docConfig.value?.showUnorderedListMarkers === false)
const isHideOrderedMarkers = computed(() => docConfig.value?.showOrderedListMarkers === false)

const currentThumbMetrics = computed(() =>
  computeThumbnailScale(
    currentContainerSize.value.width,
    currentContainerSize.value.height,
    slideAspect.value.baseWidth,
    slideAspect.value.baseHeight,
    14,
  ),
)

const nextThumbMetrics = computed(() =>
  computeThumbnailScale(
    nextContainerSize.value.width,
    nextContainerSize.value.height,
    slideAspect.value.baseWidth,
    slideAspect.value.baseHeight,
    14,
  ),
)

function measurePreviewContainers() {
  if (currentPreviewRef.value) {
    currentContainerSize.value = {
      width: currentPreviewRef.value.clientWidth,
      height: currentPreviewRef.value.clientHeight,
    }
  }
  if (nextPreviewRef.value) {
    nextContainerSize.value = {
      width: nextPreviewRef.value.clientWidth,
      height: nextPreviewRef.value.clientHeight,
    }
  }
}

let previewResizeObserver: ResizeObserver | null = null

function attachResizeObserver() {
  if (typeof window === 'undefined' || typeof window.ResizeObserver !== 'function') return
  if (!previewResizeObserver) {
    previewResizeObserver = new window.ResizeObserver(() => {
      measurePreviewContainers()
    })
  }
  previewResizeObserver.disconnect()
  if (currentPreviewRef.value) {
    previewResizeObserver.observe(currentPreviewRef.value)
  }
  if (nextPreviewRef.value) {
    previewResizeObserver.observe(nextPreviewRef.value)
  }
}

watch(
  [currentPreviewRef, nextPreviewRef, totalPages],
  () => {
    void nextTick(() => {
      attachResizeObserver()
      measurePreviewContainers()
    })
  },
  { flush: 'post' },
)

// 演讲时长计时器与现实时间时钟 (FSM-8 体系，抽离至 usePresenterTimer)
const {
  elapsedSeconds,
  isTimerRunning,
  formattedTime,
  wallClockTime,
  toggleTimer,
  resetTimer,
  startTimers,
  stopTimers,
} = usePresenterTimer()

// 当前页与下一页计算
const currentSlide = computed(() => {
  if (slides.value.length === 0) return null
  return slides.value[currentPage.value - 1] || null
})

const nextSlide = computed(() => {
  if (currentPage.value >= slides.value.length) return null
  return slides.value[currentPage.value] || null
})

function resolveSlideThemeMode(slide?: ISlidesVirtualPage | null): 'light' | 'dark' {
  const fm = slide?.frontmatter
  if (fm?.colorSchema === 'light') return 'light'
  if (fm?.colorSchema === 'dark') return 'dark'
  if (typeof fm?.class === 'string') {
    const classes = fm.class.split(/\s+/)
    if (classes.includes('light')) return 'light'
    if (classes.includes('dark')) return 'dark'
  }
  const bg = fm?.background || docConfig.value?.background
  const isLight = isLightColor(bg)
  if (isLight === true) return 'light'
  if (isLight === false) return 'dark'
  return activeColorSchema.value
}

const currentSlideThemeMode = computed(() => resolveSlideThemeMode(currentSlide.value))
const nextSlideThemeMode = computed(() => resolveSlideThemeMode(nextSlide.value))

const currentMaxStep = computed(() => {
  if (currentSlide.value) {
    return computeSlideMaxStep(currentSlide.value)
  }
  return bridgeMaxStep.value
})

const canGoPrevStep = computed(() => currentPage.value > 1 || currentStep.value > 0)
const canGoNextStep = computed(
  () => currentPage.value < totalPages.value || currentStep.value < currentMaxStep.value,
)

const currentSlideHtml = computed(() =>
  renderPresenterSlideThumbnailHtml(currentSlide.value, {
    config: docConfig.value,
    allSlides: slides.value,
    pageIndex: currentPage.value,
    currentStep: currentStep.value,
  }),
)

const nextSlideHtml = computed(() =>
  renderPresenterSlideThumbnailHtml(nextSlide.value, {
    config: docConfig.value,
    allSlides: slides.value,
    pageIndex: currentPage.value + 1,
  }),
)

const currentSlideTitle = computed(() => {
  if (!currentSlide.value) return '无内容'
  const first = currentSlide.value.blocks?.[0]
  return first?.content || first?.rawMarkdown || `第 ${currentPage.value} 页`
})

// 摘要行过滤：纯资源路径块（图片等）不参与文字摘要，避免 assets/... 路径噪声占据预览行
function extractSnippet(blocks: ISlidesBlockItem[] | undefined): string {
  return (blocks || [])
    .slice(1)
    .map(b => (b.content || b.rawMarkdown || '').trim())
    .filter(s => s && !/^(image\s+)?assets\/\S*$/i.test(s) && !/^!\[[^\]]*\]\(assets\/[^)]*\)$/.test(s))
    .join(' | ')
    .slice(0, 120)
}

const currentSlideSnippet = computed(() => extractSnippet(currentSlide.value?.blocks))

const nextSlideTitle = computed(() => {
  if (!nextSlide.value) return '演示结束'
  const first = nextSlide.value.blocks?.[0]
  return first?.content || first?.rawMarkdown || `第 ${currentPage.value + 1} 页`
})

const nextSlideSnippet = computed(() => {
  if (!nextSlide.value) return '这是最后一页'
  return extractSnippet(nextSlide.value.blocks)
})

const currentNotes = computed(() => currentSlide.value?.notes || '')

const notesFontSize = ref(20)
function increaseFontSize() {
  if (notesFontSize.value < 36) notesFontSize.value += 2
}
function decreaseFontSize() {
  if (notesFontSize.value > 14) notesFontSize.value -= 2
}

const progressPercent = computed(() => {
  if (totalPages.value <= 1) return 100
  return Math.round((currentPage.value / totalPages.value) * 100)
})

// 跨窗口广播信道与沙箱同步协调 (抽离至 usePresenterSync)
const {
  initSync,
  broadcastPageChange,
  closeSync,
  adoptSlides,
} = usePresenterSync({
  currentPage,
  currentStep,
  bridgeTotal,
  bridgeMaxStep,
  slides,
  docConfig,
  currentMaxStep,
  sandboxBridge,
})

function syncToMain(page: number, step = 0) {
  const pageNum = Number(page) || 1
  const stepNum = Math.max(0, Number(step) || 0)
  sandboxBridge.navigatePage(pageNum, stepNum)
  broadcastPageChange(pageNum, stepNum, currentMaxStep.value)
}

function goNextStep() {
  if (currentStep.value < currentMaxStep.value) {
    currentStep.value++
    syncToMain(currentPage.value, currentStep.value)
    return
  }
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    currentStep.value = 0
    syncToMain(currentPage.value, 0)
  }
}

function goPrevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
    syncToMain(currentPage.value, currentStep.value)
    return
  }
  if (currentPage.value > 1) {
    currentPage.value--
    currentStep.value = 0
    syncToMain(currentPage.value, 0)
  }
}

function goNextSlide() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    currentStep.value = 0
    syncToMain(currentPage.value, 0)
  }
}

function goPrevSlide() {
  if (currentPage.value > 1) {
    currentPage.value--
    currentStep.value = 0
    syncToMain(currentPage.value, 0)
  }
}

function restartPresentation() {
  currentPage.value = 1
  currentStep.value = 0
  resetTimer()
  syncToMain(1, 0)
}

function openBigScreen() {
  const host = plugin as any
  if (typeof host?.openBottomPreviewTab === 'function') {
    void host.openBottomPreviewTab()
  }
}

function openStandaloneWindow() {
  const host = plugin as any
  if (typeof host?.openStandalonePreviewWindow === 'function') {
    void host.openStandalonePreviewWindow()
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === ' ' && (e.target as HTMLElement)?.closest?.('button')) return

  if ((e.shiftKey && e.key === 'ArrowRight') || e.key === 'ArrowDown') {
    e.preventDefault()
    goNextSlide()
    return
  }
  if ((e.shiftKey && e.key === 'ArrowLeft') || e.key === 'ArrowUp') {
    e.preventDefault()
    goPrevSlide()
    return
  }

  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault()
    goNextStep()
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault()
    goPrevStep()
  }
}

let lastWheelTime = 0
const WHEEL_COOLDOWN_MS = 280
const WHEEL_DELTA_THRESHOLD = 15

function onWheel(e: WheelEvent) {
  if (Math.abs(e.deltaY) < WHEEL_DELTA_THRESHOLD) return
  const scrollEl = (e.target as HTMLElement)?.closest?.('.notes-content')
  if (scrollEl) {
    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight
    if (maxScroll > 2) {
      if (e.deltaY > 0 && scrollEl.scrollTop < maxScroll - 1) return
      if (e.deltaY < 0 && scrollEl.scrollTop > 1) return
    }
  }
  const now = Date.now()
  if (now - lastWheelTime < WHEEL_COOLDOWN_MS) return
  lastWheelTime = now
  if (e.deltaY > 0) goNextStep()
  else goPrevStep()
}

let unobserveTheme: (() => void) | null = null

onMounted(() => {
  hostThemeMode.value = detectSiYuanThemeMode()
  unobserveTheme = observeSiYuanThemeMode((mode) => {
    hostThemeMode.value = mode
  })
  startTimers()
  initSync()

  const latestDoc = (plugin as any)?.latestCompiledDoc as ISlidesDocument | null | undefined
  if (latestDoc?.slides?.length) {
    slides.value = latestDoc.slides
    if (latestDoc.config) {
      docConfig.value = latestDoc.config
    }
    // 登记数据身份：跨文档直灌时重置页码，且 REQUEST_SYNC 应答可携带 docId
    adoptSlides(latestDoc.docId || '')
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', measurePreviewContainers)
  }
  void nextTick(() => {
    attachResizeObserver()
    measurePreviewContainers()
  })
})

onUnmounted(() => {
  if (unobserveTheme) {
    unobserveTheme()
    unobserveTheme = null
  }
  stopTimers()
  closeSync()
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', measurePreviewContainers)
  }
  if (previewResizeObserver) {
    previewResizeObserver.disconnect()
    previewResizeObserver = null
  }
})

defineExpose({
  updateDocument(doc: ISlidesDocument) {
    const rawSlides = doc?.slides || []
    const visibleSlides = filterVisibleSlides(rawSlides)
    if (rawSlides.length > 0) {
      slides.value = visibleSlides
    }
    if (doc?.config) {
      docConfig.value = {
        ...doc.config,
        allSlidesHidden: rawSlides.length > 0 && visibleSlides.length === 0,
      }
    }
    // P1-D1：文档切换时直灌数据同步重置页码与步进，避免角标停留在超出新文档页数的陈旧页码
    adoptSlides(doc?.docId || '')
  },
  applyConfigUpdate(partialConfig: Record<string, any>) {
    if (docConfig.value) {
      docConfig.value = { ...docConfig.value, ...partialConfig }
    }
  },
})
</script>

<style scoped src="./SlidesPresenterTab.scss"></style>
<style lang="scss" src="./SlidesPresenterThumbnail.scss"></style>
