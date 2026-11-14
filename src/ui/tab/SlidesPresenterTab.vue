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
      <h2>等待大屏放映数据</h2>
      <p>未检测到活跃的幻灯片数据，请先开启大屏放映端。</p>
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

// 演讲时长计时器 (FSM-8 优化：基于绝对时间戳计算，彻底免疫后台标签页节流带来的时钟漂移)
const elapsedSeconds = ref(0)
const isTimerRunning = ref(true)
let timerInterval: number | null = null
let timerStartedAt = Date.now()
let accumulatedElapsedMs = 0

const formattedTime = computed(() => {
  const m = String(Math.floor(elapsedSeconds.value / 60)).padStart(2, '0')
  const s = String(elapsedSeconds.value % 60).padStart(2, '0')
  return `${m}:${s}`
})

function updateTimerTick() {
  if (isTimerRunning.value) {
    const totalMs = accumulatedElapsedMs + (Date.now() - timerStartedAt)
    elapsedSeconds.value = Math.floor(totalMs / 1000)
  }
}

function toggleTimer() {
  if (isTimerRunning.value) {
    accumulatedElapsedMs += Date.now() - timerStartedAt
    isTimerRunning.value = false
  } else {
    timerStartedAt = Date.now()
    isTimerRunning.value = true
    updateTimerTick()
  }
}

function resetTimer() {
  timerStartedAt = Date.now()
  accumulatedElapsedMs = 0
  elapsedSeconds.value = 0
}

// 现实时间时钟 (Wall Clock)
const wallClockTime = ref('')
let clockInterval: number | null = null

function updateWallClock() {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  wallClockTime.value = `${h}:${m}`
}

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

// 跨窗口广播信道：与预览沙盒双向同步页码、步进与数据
let broadcastChannel: BroadcastChannel | null = null
try {
  broadcastChannel = new BroadcastChannel('siyuan-slides-sync')
  broadcastChannel.onmessage = (event: MessageEvent) => {
    const data = event.data
    if (!data) return
    if (data.type === 'SYNC_PAGE' && typeof data.page === 'number') {
      currentPage.value = data.page
      currentStep.value = typeof data.step === 'number' ? Math.max(0, data.step) : 0
      if (typeof data.maxStep === 'number') {
        bridgeMaxStep.value = Math.max(0, data.maxStep)
      }
    }
    if (data.type === 'SYNC_SLIDES' && Array.isArray(data.slides)) {
      slides.value = data.slides
      if (data.config && typeof data.config === 'object') {
        docConfig.value = data.config
      }
    }
    if (data.type === 'REQUEST_SYNC' && slides.value.length > 0) {
      try {
        broadcastChannel?.postMessage({
          type: 'SYNC_SLIDES',
          slides: JSON.parse(JSON.stringify(slides.value)),
          config: JSON.parse(JSON.stringify(docConfig.value || {})),
        })
        broadcastChannel?.postMessage({
          type: 'SYNC_PAGE',
          page: currentPage.value,
          step: currentStep.value,
          maxStep: currentMaxStep.value,
        })
      } catch (e) {}
    }
  }
} catch (e) {
  broadcastChannel = null
}

function syncToMain(page: number, step = 0) {
  const pageNum = Number(page) || 1
  const stepNum = Math.max(0, Number(step) || 0)
  sandboxBridge.navigatePage(pageNum, stepNum)
  try {
    broadcastChannel?.postMessage({
      type: 'SYNC_PAGE',
      page: pageNum,
      step: stepNum,
      maxStep: currentMaxStep.value,
    })
  } catch (e) {}
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

let unbindSlideChanged: (() => void) | null = null
let unobserveTheme: (() => void) | null = null

onMounted(() => {
  hostThemeMode.value = detectSiYuanThemeMode()
  unobserveTheme = observeSiYuanThemeMode((mode) => {
    hostThemeMode.value = mode
  })
  timerStartedAt = Date.now()
  accumulatedElapsedMs = 0
  timerInterval = window.setInterval(updateTimerTick, 500)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', updateTimerTick)
  }

  updateWallClock()
  clockInterval = window.setInterval(updateWallClock, 1000)

  unbindSlideChanged = sandboxBridge.onSlideChanged((page, total, _blockId, step, maxStep) => {
    currentPage.value = page
    if (total > 0) bridgeTotal.value = total
    if (typeof step === 'number') currentStep.value = Math.max(0, step)
    if (typeof maxStep === 'number') bridgeMaxStep.value = Math.max(0, maxStep)
  })

  try {
    broadcastChannel?.postMessage({ type: 'REQUEST_SYNC' })
  } catch (e) {}

  const latestDoc = (plugin as any)?.latestCompiledDoc as ISlidesDocument | null | undefined
  if (latestDoc?.slides?.length) {
    slides.value = latestDoc.slides
    if (latestDoc.config) {
      docConfig.value = latestDoc.config
    }
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
  if (timerInterval) {
    window.clearInterval(timerInterval)
    timerInterval = null
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', updateTimerTick)
  }
  if (clockInterval) {
    window.clearInterval(clockInterval)
    clockInterval = null
  }
  if (unbindSlideChanged) unbindSlideChanged()
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', measurePreviewContainers)
  }
  if (previewResizeObserver) {
    previewResizeObserver.disconnect()
    previewResizeObserver = null
  }
  try {
    broadcastChannel?.close()
  } catch (e) {}
  broadcastChannel = null
})

defineExpose({
  updateDocument(doc: ISlidesDocument) {
    if (doc?.slides?.length) {
      slides.value = doc.slides
    }
    if (doc?.config) {
      docConfig.value = doc.config
    }
  },
})
</script>

<style scoped>
/* ==========================================================================
   演讲者视图语义化 Token 体系（自动适配思源亮色与暗色模式）
   ========================================================================== */
.spm-presenter-tab {
  /* 基础表面与背景 */
  --pres-bg: var(--b3-theme-background, #ffffff);
  --pres-surface: var(--b3-theme-surface, #f8fafc);
  --pres-surface-card: var(--b3-theme-surface, #ffffff);
  --pres-surface-hover: var(--b3-list-hover, rgba(0, 0, 0, 0.04));
  --pres-border: var(--b3-border-color, rgba(0, 0, 0, 0.09));
  --pres-border-subtle: rgba(140, 140, 140, 0.16);

  /* 文本层次：严格满足 WCAG AAA 对比度 */
  --pres-text-primary: var(--b3-theme-on-background, #1e293b);
  --pres-text-secondary: var(--b3-theme-on-surface, #475569);
  --pres-text-muted: var(--b3-theme-on-surface-light, #94a3b8);

  /* 品牌色与状态色 */
  --pres-primary: var(--b3-theme-primary, #3b82f6);
  --pres-primary-rgb: var(--b3-theme-primary-rgb, 59, 130, 246);
  --pres-primary-bg: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  --pres-primary-border: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.32);
  --pres-primary-hover: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.18);

  --pres-success: #10b981;
  --pres-success-bg: rgba(16, 185, 129, 0.12);
  --pres-success-border: rgba(16, 185, 129, 0.3);

  /* 幻灯片缩略图外托盘底色与阴影 */
  --pres-preview-tray: rgba(0, 0, 0, 0.035);
  --pres-preview-border: rgba(0, 0, 0, 0.08);
  --pres-preview-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);

  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  background: var(--pres-bg);
  color: var(--pres-text-primary);
  font-family: var(--b3-font-family, system-ui, -apple-system, sans-serif);
  outline: none;
  container-type: inline-size;
}

/* 暗色主题增强优化 */
:global(.body--dark) .spm-presenter-tab,
:global([data-theme-mode="dark"]) .spm-presenter-tab {
  --pres-preview-tray: #0e1017;
  --pres-preview-border: rgba(255, 255, 255, 0.1);
  --pres-preview-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  --pres-border-subtle: rgba(255, 255, 255, 0.08);
}

.spm-presenter-tab * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  min-width: 0;
}

/* ==========================================================================
   Header: 顶栏状态与工具条 (确保 overflow: visible 防止 tooltip 被裁剪)
   ========================================================================== */
.presenter-header {
  height: 48px;
  flex-shrink: 0;
  background: var(--pres-surface);
  border-bottom: 1px solid var(--pres-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  overflow: visible;
  position: relative;
  z-index: 10;
}

.presenter-title-area {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.presenter-brand {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--pres-text-primary);
  flex-shrink: 0;
}

.brand-icon {
  font-size: 16px;
  color: var(--pres-primary);
}

.header-pills {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.pill-page {
  background: var(--pres-surface-hover);
  color: var(--pres-text-secondary);
  border: 1px solid var(--pres-border-subtle);
}

.pill-step {
  background: var(--pres-primary-bg);
  color: var(--pres-primary);
  border: 1px solid var(--pres-primary-border);
}

.pill-icon {
  font-size: 11px;
}

.header-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.btn-tool {
  background: var(--pres-primary-bg);
  border: 1px solid var(--pres-primary-border);
  color: var(--pres-primary);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-tool:hover {
  background: var(--pres-primary-hover);
  border-color: var(--pres-primary);
}

.timer-capsule {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--pres-success-bg);
  border: 1px solid var(--pres-success-border);
  color: var(--pres-success);
  padding: 3px 8px;
  border-radius: 6px;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 13px;
  font-weight: 600;
}

.timer-icon {
  font-size: 14px;
}

.timer-digits {
  letter-spacing: 0.5px;
}

.timer-actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 2px;
}

.timer-btn {
  background: transparent;
  border: none;
  color: var(--pres-success);
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.timer-btn:hover {
  background: rgba(16, 185, 129, 0.2);
}

.wall-clock {
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 13px;
  color: var(--pres-text-muted);
  font-weight: 500;
  padding: 0 4px;
}

/* ==========================================================================
   Main Grid: 左右主网格布局
   ========================================================================== */
.presenter-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
  gap: 14px;
  padding: 14px;
  overflow: hidden;
}

.slide-panels {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.panel-box {
  background: var(--pres-surface-card);
  border: 1px solid var(--pres-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.current-slide-panel {
  flex: 1.35;
}

.next-slide-panel {
  flex: 1;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.next-slide-panel.is-clickable {
  cursor: pointer;
}

.next-slide-panel.is-clickable:hover {
  border-color: var(--pres-primary);
  box-shadow: 0 2px 8px rgba(var(--pres-primary-rgb), 0.15);
}

.panel-header {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--pres-text-secondary);
  background: var(--pres-surface);
  border-bottom: 1px solid var(--pres-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

.panel-header-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.panel-title-icon {
  font-size: 14px;
  color: var(--pres-primary);
}

.panel-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--pres-surface-hover);
  color: var(--pres-text-secondary);
}

.panel-tag.is-current {
  background: var(--pres-primary-bg);
  color: var(--pres-primary);
}

.panel-page-num {
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 11px;
  color: var(--pres-text-muted);
}

.panel-header-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.panel-step-pill {
  background: var(--pres-primary-bg);
  color: var(--pres-primary);
  border: 1px solid var(--pres-primary-border);
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}

.panel-layout-pill {
  font-size: 10px;
  color: var(--pres-text-muted);
  border: 1px solid var(--pres-border-subtle);
  padding: 1px 6px;
  border-radius: 4px;
}

.panel-end-pill {
  font-size: 11px;
  color: var(--pres-text-muted);
}

.panel-preview {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 8px;
  background: var(--pres-preview-tray);
  overflow: hidden;
  position: relative;
}

.panel-preview--dim {
  opacity: 0.92;
}

.presenter-thumb-box {
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: var(--pres-preview-shadow);
  border: 1px solid var(--pres-preview-border);
  flex-shrink: 0;
}

.presenter-thumb-viewport {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  pointer-events: none;
  user-select: none;
  overflow: hidden;
}

.panel-fallback {
  width: 100%;
  padding: 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.panel-fallback h2 {
  font-size: clamp(1rem, 3.6cqi, 1.4rem);
  margin-bottom: 6px;
  color: var(--pres-primary);
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-fallback p {
  font-size: clamp(0.78rem, 2.4cqi, 0.95rem);
  color: var(--pres-text-muted);
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ==========================================================================
   Notes Panel: 讲稿备忘区
   ========================================================================== */
.notes-panel {
  min-height: 0;
  background: var(--pres-surface-card);
  border: 1px solid var(--pres-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.notes-size-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.notes-btn {
  background: transparent;
  border: 1px solid var(--pres-border);
  color: var(--pres-text-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.notes-btn:hover:not(:disabled) {
  background: var(--pres-surface-hover);
  color: var(--pres-text-primary);
}

.notes-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.notes-size-value {
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 11px;
  color: var(--pres-text-muted);
  min-width: 32px;
  text-align: center;
}

.notes-content {
  flex: 1;
  min-height: 0;
  padding: 20px;
  line-height: 1.8;
  overflow-y: auto;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--pres-text-primary);
  user-select: text;
}

.notes-content.is-empty {
  color: var(--pres-text-muted);
  font-style: italic;
  opacity: 0.7;
}

/* ==========================================================================
   Empty State: 空数据引导态
   ========================================================================== */
.presenter-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 40px;
  text-align: center;
  background: var(--pres-surface);
}

.empty-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--pres-primary-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  font-size: 26px;
  color: var(--pres-primary);
}

.presenter-empty h2 {
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--pres-text-primary);
}

.presenter-empty p {
  font-size: 0.95rem;
  color: var(--pres-text-muted);
  max-width: 420px;
  line-height: 1.6;
}

.empty-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.btn-empty-action {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid var(--pres-border);
  background: var(--pres-surface-card);
  color: var(--pres-text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.btn-empty-action:hover {
  background: var(--pres-surface-hover);
  border-color: var(--pres-primary);
}

.btn-empty-action--popout {
  background: var(--pres-primary-bg);
  border-color: var(--pres-primary-border);
  color: var(--pres-primary);
}

.btn-empty-action--popout:hover {
  background: var(--pres-primary-hover);
  border-color: var(--pres-primary);
}

/* ==========================================================================
   Bottom Action Bar: 底栏控制 (确保 overflow: visible 防止 tooltip 被截断)
   ========================================================================== */
.presenter-actions {
  min-height: 48px;
  flex-shrink: 0;
  background: var(--pres-surface);
  border-top: 1px solid var(--pres-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 16px;
  overflow: visible;
  position: relative;
  z-index: 10;
}

.nav-btn-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.btn-nav {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid var(--pres-border);
  background: var(--pres-surface-card);
  color: var(--pres-text-primary);
  transition: all 0.15s ease;
}

.btn-nav:hover:not(:disabled) {
  background: var(--pres-surface-hover);
  border-color: var(--pres-primary);
}

.btn-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-nav--primary {
  background: var(--pres-primary);
  color: #ffffff;
  border-color: var(--pres-primary);
}

.btn-nav--primary:hover:not(:disabled) {
  opacity: 0.9;
  background: var(--pres-primary);
}

.btn-restart {
  background: transparent;
  border: 1px solid var(--pres-border);
  color: var(--pres-text-muted);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-restart:hover {
  background: var(--pres-surface-hover);
  color: var(--pres-text-primary);
}

.actions-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 0;
}

.center-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.progress-pill {
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 12px;
  color: var(--pres-text-secondary);
  font-weight: 600;
}

.step-dots-bar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--pres-primary-bg);
  padding: 3px 8px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--pres-primary-border);
  flex-shrink: 0;
}

.step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(var(--pres-primary-rgb), 0.3);
  transition: all 0.15s ease;
}

.step-dot.is-active {
  background: var(--pres-primary);
  transform: scale(1.15);
}

.step-dots-text {
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  color: var(--pres-primary);
  margin-left: 2px;
}

/* ==========================================================================
   Container Queries: 窄栏与侧边栏响应式自适应
   ========================================================================== */
@container (max-width: 719px) {
  .presenter-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, auto) minmax(0, 1fr);
    gap: 10px;
    padding: 10px;
  }

  .slide-panels {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    gap: 10px;
    align-items: stretch;
  }

  .current-slide-panel,
  .next-slide-panel {
    flex: none;
    min-height: 0;
  }

  .panel-preview {
    aspect-ratio: 16 / 9;
    padding: 6px;
  }

  .panel-header {
    padding: 5px 8px;
  }

  .notes-content {
    padding: 12px;
    font-size: 1.05rem;
  }

  .presenter-header {
    padding: 0 10px;
  }

  .presenter-actions {
    padding: 5px 10px;
  }

  .btn-tool-label,
  .wall-clock {
    display: none;
  }

  .btn-nav {
    padding: 5px 8px;
    font-size: 11px;
  }
}

@container (max-width: 440px) {
  .slide-panels {
    grid-template-columns: minmax(0, 1fr);
  }

  .panel-preview {
    max-height: 140px;
  }
}
</style>

<style lang="scss">
/* 演讲者视图内嵌幻灯片缩略图沙箱样式（严格约束在 .spm-presenter-tab .presenter-thumb-viewport 作用域下，零全局泄漏） */
.spm-presenter-tab .presenter-thumb-viewport {
  --slide-bg: #121214;
  --slide-text: #e2e8f0;
  --slide-accent: #10b981;
  --slide-code-bg: #1e1e24;
  --slide-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  --slide-accent: #10b981;
  --slide-accent-secondary: #06b6d4;

  &[data-theme="light"] {
    --slide-bg: #f8fafc;
    --slide-text: #0f172a;
    --slide-text-secondary: #475569;
    --slide-accent: #059669;
    --slide-accent-secondary: #0284c7;
    --slide-code-bg: #f1f5f9;
  }

  &[data-theme="dark"] {
    --slide-bg: #090d16;
    --slide-text: #f1f5f9;
    --slide-text-secondary: #94a3b8;
    --slide-accent: #10b981;
    --slide-accent-secondary: #38bdf8;
    --slide-code-bg: #0f172a;
  }

  &.slides-theme-seriph {
    --slide-font: "PT Serif", "Charter", "Georgia", "Cambria", "Times New Roman", "Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", serif;
    --slide-accent: #b45309;
    --slide-accent-secondary: #9a3412;
    letter-spacing: 0.02em;

    &[data-theme="light"] {
      --slide-bg: #fcfbf7;
      --slide-text: #231f1d;
      --slide-text-secondary: #57534e;
      --slide-accent: #b45309;
      --slide-accent-secondary: #9a3412;
      --slide-code-bg: #f5f0e6;
    }
    &[data-theme="dark"] {
      --slide-bg: #171513;
      --slide-text: #f5f2eb;
      --slide-text-secondary: #a8a29e;
      --slide-accent: #f59e0b;
      --slide-accent-secondary: #fb923c;
      --slide-code-bg: #24201c;
    }
  }

  &.slides-theme-apple-basic {
    --slide-font: -apple-system, "SF Pro Display", "SF Pro Text", BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
    --slide-accent: #0071e3;
    --slide-accent-secondary: #0077ed;
    letter-spacing: -0.025em;

    &[data-theme="light"] {
      --slide-bg: #ffffff;
      --slide-text: #000000;
      --slide-text-secondary: #6e6e73;
      --slide-accent: #0071e3;
      --slide-accent-secondary: #0077ed;
      --slide-code-bg: #f5f5f7;
    }
    &[data-theme="dark"] {
      --slide-bg: #000000;
      --slide-text: #ffffff;
      --slide-text-secondary: #86868b;
      --slide-accent: #2997ff;
      --slide-accent-secondary: #64d2ff;
      --slide-code-bg: #161617;
    }
  }

  background: var(--slide-bg);
  color: var(--slide-text);
  font-family: var(--slide-font);
  display: flex;
  flex-direction: column;
  text-align: left;
  box-sizing: border-box;

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .slide-content {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 100%;
    flex: 1 1 0%;
    padding: var(--slides-padding-y, 32px) var(--slides-padding-x, 48px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }

  .slide-content.spacing-compact {
    --slides-padding-y: 16px;
    --slides-padding-x: 28px;
    --slides-block-gap: 8px;
    --slides-list-gap: 4px;
    --slides-cols-gap: 20px;
    --slides-title-margin-bottom: 8px;
    --slides-header-gap: 10px;
    --slides-line-height: 1.45;
  }

  .slide-content.spacing-normal {
    --slides-padding-y: 32px;
    --slides-padding-x: 48px;
    --slides-block-gap: 14px;
    --slides-list-gap: 6px;
    --slides-cols-gap: 32px;
    --slides-title-margin-bottom: 12px;
    --slides-header-gap: 16px;
    --slides-line-height: 1.6;
  }

  .slide-content.spacing-loose {
    --slides-padding-y: 52px;
    --slides-padding-x: 72px;
    --slides-block-gap: 22px;
    --slides-list-gap: 10px;
    --slides-cols-gap: 44px;
    --slides-title-margin-bottom: 18px;
    --slides-header-gap: 24px;
    --slides-line-height: 1.75;
  }

  /* Cover, Center, Fact 版式 */
  .layout-cover,
  .layout-center,
  .layout-fact,
  .layout-cover-container,
  .layout-fact-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    width: 100%;
    flex: 1;
  }

  .layout-cover h1,
  .layout-cover .slide-block h1 {
    font-size: 3.8rem !important;
    font-weight: 800 !important;
    line-height: 1.15 !important;
    letter-spacing: -0.025em !important;
    margin-bottom: 16px !important;
  }

  &.slides-theme-tech .layout-cover h1,
  &.slides-theme-tech .layout-cover .slide-block h1 {
    background: linear-gradient(135deg, var(--slide-accent), var(--slide-accent-secondary)) !important;
    -webkit-background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
  }

  /* 复杂背景图文字防穿透保护（与沙箱及独立导出端保持一致） */
  .slide-content[style*="background-image"] h1,
  .slide-content[style*="background-image"] h2,
  .slide-content[style*="background-image"] h3,
  .slide-content[style*="background-image"] p,
  .slide-content[style*="background-image"] li {
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75), 0 2px 8px rgba(0, 0, 0, 0.45);
  }
  &[data-theme="light"] .slide-content[style*="background-image"] h1,
  &[data-theme="light"] .slide-content[style*="background-image"] h2,
  &[data-theme="light"] .slide-content[style*="background-image"] h3,
  &[data-theme="light"] .slide-content[style*="background-image"] p,
  &[data-theme="light"] .slide-content[style*="background-image"] li {
    text-shadow: 0 1px 3px rgba(255, 255, 255, 0.85);
  }

  /* 封面页在背景图或显式设置文字颜色时，禁用透明渐变镂空，避免与 text-shadow 叠加成浮雕黑芯并遵循主题及实际文字色 */
  &.slides-theme-tech .slide-content[style*="background-image"].layout-cover h1,
  &.slides-theme-tech .slide-content[style*="background-image"].layout-cover .slide-block h1,
  &.slides-theme-tech .layout-cover .slide-block[style^="color:"] h1,
  &.slides-theme-tech .layout-cover .slide-block[style*=" color:"] h1,
  &.slides-theme-tech .layout-cover .slide-block[style*=";color:"] h1,
  &.slides-theme-tech .layout-cover h1[style^="color:"],
  &.slides-theme-tech .layout-cover h1[style*=" color:"],
  &.slides-theme-tech .layout-cover h1[style*=";color:"] {
    background: none !important;
    -webkit-background-clip: initial !important;
    -webkit-text-fill-color: initial !important;
  }
  .layout-cover h1 span[style^="color:"],
  .layout-cover h1 span[style*=" color:"],
  .layout-cover h1 span[style*=";color:"],
  .layout-cover h1 font[color] {
    -webkit-background-clip: initial !important;
    -webkit-text-fill-color: currentColor !important;
  }

  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2,
  &.slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3 {
    color: var(--slide-accent);
    border-left: 4px solid var(--slide-accent);
    padding: 4px 14px;
    padding-left: 14px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--slide-accent) 13%, transparent), transparent 76%);
    border-radius: 0 6px 6px 0;
    letter-spacing: -0.015em;
  }

  &.slides-theme-seriph .layout-cover h1 {
    color: var(--slide-accent) !important;
    border-bottom: 2px solid var(--slide-accent);
    display: inline-block;
    padding-bottom: 10px;
  }

  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3 {
    display: block;
    position: relative;
    color: var(--slide-accent);
    border-bottom: 1.5px solid color-mix(in srgb, var(--slide-accent) 45%, transparent);
    padding-bottom: 10px;
    margin-bottom: 14px;
  }

  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2::after,
  &.slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 3px;
    height: 1.5px;
    pointer-events: none;
    background: linear-gradient(90deg, var(--slide-accent) 0%, color-mix(in srgb, var(--slide-accent) 35%, transparent) 50%, transparent 92%);
  }

  &.slides-theme-apple-basic .layout-cover h1 {
    color: var(--slide-text) !important;
    letter-spacing: -0.045em !important;
  }

  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2,
  &.slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3 {
    border: none !important;
    background: none !important;
    padding: 0 !important;
    margin-bottom: 16px !important;
    letter-spacing: -0.04em !important;
    font-weight: 800 !important;
  }

  /* 当存在页面背景图时，内容页顶部标题回退高对比正文字色与半透明底衬 */
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2,
  &[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2,
  .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3 {
    color: var(--slide-text);
  }

  &.slides-theme-tech[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
  &.slides-theme-tech[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
  &.slides-theme-tech[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
  &.slides-theme-tech[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
  &.slides-theme-tech[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
  &.slides-theme-tech[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
  &.slides-theme-tech .slide-content[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3 {
    background: linear-gradient(90deg, color-mix(in srgb, var(--slide-bg) 42%, transparent), transparent 82%);
  }

  .slide-block[style^="color:"] h1,
  .slide-block[style*=" color:"] h1,
  .slide-block[style*=";color:"] h1,
  .slide-block[style^="color:"] h2,
  .slide-block[style*=" color:"] h2,
  .slide-block[style*=";color:"] h2,
  .slide-block[style^="color:"] h3,
  .slide-block[style*=" color:"] h3,
  .slide-block[style*=";color:"] h3 {
    color: inherit !important;
  }

  .layout-cover h2,
  .layout-cover .slide-block h2 {
    font-size: 1.85rem !important;
    font-weight: 600 !important;
    opacity: 0.85 !important;
    margin-bottom: 12px !important;
  }

  .layout-cover p,
  .layout-cover .slide-block p {
    font-size: 1.45rem !important;
    line-height: 1.5 !important;
    opacity: 0.85 !important;
  }

  .layout-fact h1,
  .layout-fact-container h1,
  .layout-fact .fact-value,
  .layout-fact-container .fact-value,
  .layout-fact .slide-block:first-child,
  .layout-fact-container .fact-value-wrapper {
    font-size: clamp(5rem, 10vw, 7.5rem) !important;
    font-weight: 900 !important;
    line-height: 1.05 !important;
    color: var(--slide-accent) !important;
    background: linear-gradient(135deg, var(--slide-accent), #60a5fa) !important;
    -webkit-background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    filter: drop-shadow(0 4px 16px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.35));
    margin-bottom: 8px !important;
  }
  .layout-fact-container .fact-divider-line {
    width: 60px;
    height: 3px;
    background: var(--slide-accent);
    margin: 14px auto 18px;
    border-radius: 2px;
  }
  .layout-fact p,
  .layout-fact-container p,
  .layout-fact .fact-label,
  .layout-fact-container .fact-label,
  .layout-fact .slide-block:not(:first-child),
  .layout-fact-container .fact-label-wrapper {
    font-size: 1.6rem !important;
    opacity: 0.88 !important;
    line-height: 1.5 !important;
  }

  /* Timeline / Steps 时间线 (演播室) */
  .layout-timeline-container,
  .layout-steps-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 24px 40px;
    flex: 1;
  }
  .timeline-track-wrapper {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    gap: 20px;
    margin: auto 0;
    position: relative;
  }
  .timeline-step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    text-align: center;
    position: relative;
  }
  .timeline-node-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin-bottom: 18px;
  }
  .timeline-node-badge {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--slide-accent, var(--b3-theme-primary));
    color: #ffffff;
    font-size: 1.2rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.4);
    z-index: 2;
  }
  .timeline-connector-line {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, var(--slide-accent, #3b82f6), rgba(125, 125, 125, 0.25));
    transform: translateY(-50%);
    z-index: 1;
  }
  .timeline-step-content {
    width: 100%;
    padding: 12px;
    background: rgba(125, 125, 125, 0.06);
    border: 1px solid rgba(125, 125, 125, 0.14);
    border-radius: 10px;
    box-sizing: border-box;
  }
  .timeline-step-content h1,
  .timeline-step-content h2,
  .timeline-step-content h3 {
    font-size: 1.2rem !important;
    font-weight: 700 !important;
    margin-bottom: 6px !important;
  }
  .timeline-step-content p,
  .timeline-step-content li {
    font-size: 1rem !important;
    line-height: 1.4 !important;
  }

  /* Quote 引言版式 (演播室) */
  .layout-quote,
  .layout-quote-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    position: relative;
    box-sizing: border-box;
    padding: 36px 64px;
    flex: 1;
  }
  .quote-watermark-icon {
    position: absolute;
    top: 10%;
    left: 8%;
    font-size: 14rem;
    line-height: 1;
    font-family: Georgia, serif;
    opacity: 0.08;
    pointer-events: none;
    user-select: none;
    color: currentColor;
  }
  .quote-content-body {
    position: relative;
    z-index: 1;
    max-width: 800px;
    width: 100%;
    text-align: center;
  }
  .quote-text,
  .quote-body {
    font-size: 2.1rem !important;
    font-style: italic !important;
    line-height: 1.6 !important;
    font-family: var(--slides-font-serif, "Noto Serif SC", Georgia, serif) !important;
    margin-bottom: 20px !important;
  }
  .quote-footer,
  .quote-author {
    font-size: 1.2rem !important;
    opacity: 0.75 !important;
    text-align: right !important;
    font-style: normal !important;
  }

  /* Intro 介绍版式 (演播室) */
  .layout-intro,
  .layout-intro-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 48px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 32px 48px;
    flex: 1;
  }
  .intro-avatar-col {
    flex-shrink: 0;
  }
  .intro-avatar-box {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.35);
    background: rgba(125, 125, 125, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .intro-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .intro-avatar-svg {
    width: 100px;
    height: 100px;
    opacity: 0.35;
    fill: currentColor;
  }
  .intro-info-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .intro-info-col h1 {
    font-size: 2.6rem !important;
    font-weight: 800 !important;
    margin-bottom: 8px !important;
  }
  .intro-info-col h2, .intro-info-col h3 {
    font-size: 1.35rem !important;
    font-weight: 600 !important;
    color: var(--slide-accent) !important;
    margin-bottom: 14px !important;
  }
  .intro-info-col p {
    font-size: 1.2rem !important;
    line-height: 1.5 !important;
    opacity: 0.9 !important;
  }

  /* 多栏与四叶草网格布局 */
  .layout-cols-header-container,
  .layout-two-cols-header-container,
  .layout-three-cols-header-container,
  .layout-clover-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0 !important;
    max-height: 100% !important;
    overflow: hidden !important;
  }

  .layout-header-section {
    width: 100%;
    margin-bottom: var(--slides-header-gap, 16px) !important;
    flex-shrink: 0;
  }

  .layout-header-section h1,
  .layout-header-section h2,
  .layout-header-section h3 {
    margin-bottom: var(--slides-title-margin-bottom, 10px) !important;
  }

  .pdf-two-cols-wrapper,
  .layout-two-cols-grid,
  .layout-cols-wrapper,
  .layout-cols-grid {
    display: grid;
    grid-template-columns: var(--slide-grid-cols, minmax(0, 1fr) minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr) !important;
    gap: var(--slides-cols-gap, 32px);
    width: 100%;
    height: 100%;
    min-height: 0 !important;
    max-height: 100% !important;
    flex: 1 1 0%;
    align-items: stretch;
    overflow: hidden !important;
  }

  .pdf-three-cols-wrapper,
  .layout-three-cols-grid {
    display: grid;
    grid-template-columns: var(--slide-grid-cols, repeat(3, minmax(0, 1fr)));
    grid-template-rows: minmax(0, 1fr) !important;
    gap: calc(var(--slides-cols-gap, 32px) * 0.75);
    width: 100%;
    height: 100%;
    min-height: 0 !important;
    max-height: 100% !important;
    flex: 1 1 0%;
    align-items: stretch;
    overflow: hidden !important;
  }

  .pdf-clover-wrapper,
  .layout-clover-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(2, minmax(0, 1fr)) !important;
    gap: calc(var(--slides-cols-gap, 32px) * 0.625);
    width: 100%;
    height: 100%;
    min-height: 0 !important;
    max-height: 100% !important;
    flex: 1 1 0%;
    align-items: stretch;
    overflow: hidden !important;
  }

  .pdf-col,
  .two-cols-left,
  .two-cols-right {
    display: flex;
    flex-direction: column;
    gap: var(--slides-block-gap, 14px);
    min-width: 0;
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    min-height: 0;
    justify-content: flex-start;
    overflow: hidden;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }

  /* 基础块与排版 */
  .slide-block,
  .pdf-block {
    margin-bottom: var(--slides-block-gap, 14px);
    line-height: var(--slides-line-height, 1.6);
  }

  .slide-styled-block {
    border-radius: 6px;
    padding: 8px 14px;
    margin: 6px 0;
  }

  span[style*="background-color"],
  span[style*="background:"] {
    border-radius: 3px;
    padding: 1px 5px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  .slide-block h1 { font-size: 2.2rem; font-weight: 700; margin-bottom: var(--slides-title-margin-bottom, 12px); }
  .slide-block h2 { font-size: 1.7rem; font-weight: 600; margin-bottom: calc(var(--slides-title-margin-bottom, 10px) * 0.85); }
  .slide-block h3 { font-size: 1.3rem; font-weight: 600; margin-bottom: calc(var(--slides-title-margin-bottom, 8px) * 0.75); }
  .slide-block h4 { font-size: 1.15rem; font-weight: 600; margin-bottom: 6px; }
  .slide-block p { font-size: 1.15rem; line-height: var(--slides-line-height, 1.6); }

  /* 列表与多栏列表项 */
  div.pdf-list-item {
    display: flex !important;
    flex-direction: column !important;
    list-style: none !important;
    padding-left: 0 !important;
  }

  .slide-block ul,
  .slide-block ol,
  .pdf-list {
    padding-left: 1.35em;
    margin: calc(var(--slides-block-gap, 14px) * 0.6) 0;
    display: flex;
    flex-direction: column;
    gap: var(--slides-list-gap, 6px);
  }

  .slide-block ul,
  .pdf-list--unordered {
    list-style: disc !important;
    list-style-type: disc !important;
  }

  .slide-block ol,
  .pdf-list--ordered {
    list-style: decimal !important;
    list-style-type: decimal !important;
  }

  .slide-block li,
  .pdf-list li {
    font-size: 1.15rem;
    line-height: 1.6;
    display: list-item;
  }

  .pdf-task-item {
    list-style: none !important;
    margin-left: -1.1em;
    display: flex !important;
    align-items: center;
    gap: 8px;
  }

  .slide-list-item-title,
  .pdf-list li > h1,
  .pdf-list li > h2,
  .pdf-list li > h3,
  .pdf-list li > h4 {
    margin-top: 2px !important;
    margin-bottom: 6px !important;
    line-height: 1.35 !important;
    font-weight: 700 !important;
  }

  .slide-list-item-desc,
  .pdf-list li > p {
    margin-top: 4px !important;
    margin-bottom: 6px !important;
    font-size: 1.05rem;
    line-height: 1.55;
    opacity: 0.92;
  }

  /* 超级块分栏首行标题去圆点居中 */
  .has-superblock-cols .pdf-col > *:first-child .slide-list-item-title,
  .has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6),
  .has-superblock-cols .pdf-col > *:first-child p.slide-list-item-title,
  .has-superblock-cols .pdf-col > *:first-child p:first-of-type,
  .has-superblock-cols .pdf-col > *:first-child :is(ul, ol) > li:first-child,
  .has-superblock-cols .slides-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
    list-style: none !important;
    list-style-type: none !important;
    text-align: center !important;
    margin-left: 0 !important;
    padding-left: 0 !important;
    width: 100% !important;
  }

  .has-superblock-cols .pdf-col > *:first-child :is(ul, ol) > li:first-child::marker {
    content: "" !important;
    display: none !important;
  }

  /* 全局标题字号规范化 */
  &[data-normalize-headings="true"] .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
  &[data-normalize-headings="true"] .slide-content:not(.layout-cover) > .slide-block:first-child :is(h1, h2, h3, h4, h5, h6) {
    font-size: 1.7rem !important;
    font-weight: 600 !important;
    line-height: 1.25 !important;
    margin-bottom: 10px !important;
  }

  &[data-normalize-headings="true"] .has-superblock-cols .slides-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
  &[data-normalize-headings="true"] .has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
    font-size: 1.3rem !important;
    font-weight: 600 !important;
    line-height: 1.3 !important;
    margin-bottom: 8px !important;
    text-align: center !important;
  }

  &[data-hide-unordered-markers="true"] ul,
  &[data-hide-unordered-markers="true"] .pdf-list--unordered,
  &[data-hide-unordered-markers="true"] ul > li {
    list-style: none !important;
    list-style-type: none !important;
    padding-left: 0 !important;
  }

  &[data-hide-ordered-markers="true"] ol,
  &[data-hide-ordered-markers="true"] .pdf-list--ordered,
  &[data-hide-ordered-markers="true"] ol > li {
    list-style: none !important;
    list-style-type: none !important;
    padding-left: 0 !important;
  }

  /* 多媒体自适应约束 */
  .slide-media-block,
  .slide-media-container,
  .slide-video-container,
  .slide-block--image,
  .slide-block--video {
    flex: 1 1 0% !important;
    min-height: 0 !important;
    min-width: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: flex-start !important;
    width: 100% !important;
    max-height: 100% !important;
    overflow: hidden !important;
    margin: 4px 0 !important;
  }

  .pdf-col > .slide-block:has(img),
  .pdf-col > .slide-block:has(video),
  .pdf-col > .slide-block:has(.slide-list-media),
  .pdf-col > .slide-block:has(.slide-media-container) {
    flex: 1 1 0% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    margin-bottom: 0 !important;
  }

  .slide-list-media {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: flex-start !important;
    width: 100% !important;
    max-width: 100% !important;
    flex: 1 1 0% !important;
    min-height: 0 !important;
    margin-top: 6px !important;
    overflow: hidden !important;
  }

  .slide-block img,
  .slide-media-img,
  .slide-video-player,
  .slide-block video,
  .slide-list-media img,
  .slide-list-media video {
    max-width: 100% !important;
    max-height: 100% !important;
    width: auto !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    object-fit: contain !important;
    display: block !important;
    margin: 0 auto !important;
    border-radius: 6px;
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.16);
  }

  li:has(.slide-list-media) .slide-list-media img,
  li:has(.slide-list-media) .slide-list-media video {
    max-height: 330px !important;
  }

  /* 代码块、表格、引用框、Callout、链接与块引用标签 */
  pre,
  .shiki-container {
    position: relative;
    background: var(--slide-code-bg);
    padding: 14px 18px;
    border-radius: 8px;
    font-family: "JetBrains Mono", Consolas, monospace;
    font-size: 0.92rem;
    white-space: pre-wrap !important;
    word-break: break-all !important;
    overflow-wrap: anywhere !important;
    overflow: hidden !important;
    max-width: 100% !important;
    border: 1px solid rgba(125, 125, 125, 0.15);
  }

  .lang-badge {
    position: absolute;
    top: 8px;
    right: 12px;
    font-size: 0.72rem;
    text-transform: uppercase;
    font-weight: 700;
    opacity: 0.5;
  }

  .code-line {
    display: flex !important;
    align-items: flex-start !important;
    width: 100% !important;
    line-height: 1.55;
  }

  .code-line .line-no {
    display: inline-block !important;
    flex-shrink: 0 !important;
    min-width: 2.2em !important;
    text-align: right !important;
    margin-right: 12px !important;
    opacity: 0.45 !important;
  }

  .code-line.shiki-dimmed {
    opacity: 0.25;
  }

  .token-comment { color: #6b7280; font-style: italic; }
  .token-keyword { color: #10b981; font-weight: 500; }
  .token-string { color: #f59e0b; }
  .token-number { color: #f97316; }
  .token-type { color: #3b82f6; }

  blockquote,
  .pdf-quote {
    border-left: 4px solid var(--slide-accent);
    background: rgba(16, 185, 129, 0.08);
    padding: 10px 16px;
    border-radius: 0 6px 6px 0;
    font-style: italic;
    margin: 8px 0;
  }

  table,
  .pdf-table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 0.95rem;
  }

  table th,
  table td,
  .pdf-table th,
  .pdf-table td {
    border: 1px solid rgba(125, 125, 125, 0.22);
    padding: 8px 12px;
  }

  table th,
  .pdf-table th {
    background: rgba(125, 125, 125, 0.12);
    font-weight: 600;
  }

  .pdf-callout,
  .slide-callout {
    border-left: 4px solid var(--slide-accent);
    background: rgba(59, 130, 246, 0.08);
    border-radius: 6px;
    padding: 12px 16px;
    margin: 10px 0;
  }

  .pdf-callout-title,
  .slide-callout-title {
    font-weight: 700;
    font-size: 0.85rem;
    margin-bottom: 4px;
    color: var(--slide-accent);
  }

  a {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px dashed currentColor;
  }

  .slides-ref-tag,
  a.slides-ref-tag {
    display: inline-flex;
    align-items: center;
    background: color-mix(in srgb, var(--slide-accent) 12%, transparent);
    color: var(--slide-accent);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 0.88em;
    border: 1px solid color-mix(in srgb, var(--slide-accent) 25%, transparent);
    margin: 2px 4px 2px 0;
  }

  .slides-block-ref {
    display: block;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--slide-accent) 8%, transparent);
    border-left: 3px solid var(--slide-accent);
    border-radius: 0 6px 6px 0;
    margin: 8px 0;
  }

  kbd {
    display: inline-block;
    padding: 2px 7px;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 0.85em;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 5px;
    margin: 0 2px;
  }

  /* 当前页尚未触发的 v-click 块：半透明剧透态（25% 透明度 + 虚线轮廓） */
  .slide-block.presenter-v-click-pending {
    opacity: 0.25;
    outline: 1.5px dashed rgba(59, 130, 246, 0.65);
    outline-offset: 3px;
    border-radius: 6px;
    filter: grayscale(30%);
    transition: opacity 0.2s ease, outline-color 0.2s ease;
  }

  /* 当前步刚刚触发显示的 v-click 块：高亮轮廓提示 */
  .slide-block.presenter-v-click-active {
    outline: 2px solid rgba(59, 130, 246, 0.75);
    outline-offset: 3px;
    border-radius: 6px;
    transition: outline-color 0.2s ease;
  }
}
</style>
