<template>
  <div
    class="spm-presenter-tab"
    tabindex="0"
    @keydown="onKeyDown"
    @wheel="onWheel"
  >
    <!-- 顶栏状态 -->
    <header class="presenter-header">
      <div class="presenter-title">
        <span class="title-name">🎤 Slidev 演讲者控制台</span>
        <span class="title-divider">|</span>
        <span>第 {{ currentPage }} / {{ totalPages || 1 }} 页</span>
        <span v-if="currentMaxStep > 0" class="header-step-badge">
          ⚡ 步进 {{ currentStep }} / {{ currentMaxStep }}
        </span>
      </div>

      <div class="header-timer">
        <button
          class="btn-popout-window"
          title="将大屏放映弹出为 16:9 独立窗口，便于会议软件按窗口共享或双屏扩展投屏"
          @click="openStandaloneWindow"
        >
          🗗 弹出独立放映窗口
        </button>
        <div class="timer-badge">⏱ 已演讲: {{ formattedTime }}</div>
        <div class="timer-controls">
          <button @click="toggleTimer">{{ isTimerRunning ? '暂停' : '开始' }}</button>
          <button @click="resetTimer">重置</button>
        </div>
      </div>
    </header>

    <!-- 主展示网格 -->
    <main v-if="totalPages > 0" class="presenter-grid">
      <!-- 左侧：当前幻灯片与下一页完整缩略图预览 -->
      <section class="slide-panels">
        <div class="panel-box current-slide-panel">
          <div class="panel-header">
            <span>当前大屏放映 (Page {{ currentPage }})</span>
            <div class="panel-header-meta">
              <span v-if="currentMaxStep > 0" class="panel-step-pill">
                步进: {{ currentStep }} / {{ currentMaxStep }}
              </span>
              <span>布局: {{ currentSlide?.frontmatter?.layout || 'default' }}</span>
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
                :class="'slidev-theme-' + activeSlidevTheme"
                :data-theme="activeColorSchema"
                :data-slidev-theme="activeSlidevTheme"
                :data-normalize-headings="isNormalizeHeadings ? 'true' : 'false'"
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
          :class="{ 'is-clickable': Boolean(nextSlide) }"
          :title="nextSlide ? '点击直接跳至下一页' : ''"
          @click="nextSlide && goNextSlide()"
        >
          <div class="panel-header">
            <span>下一页预告 (Page {{ currentPage + 1 }})</span>
            <span v-if="currentPage >= totalPages">已到达最后一页</span>
            <span v-else-if="nextSlide">布局: {{ nextSlide.frontmatter?.layout || 'default' }}</span>
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
                :class="'slidev-theme-' + activeSlidevTheme"
                :data-theme="activeColorSchema"
                :data-slidev-theme="activeSlidevTheme"
                :data-normalize-headings="isNormalizeHeadings ? 'true' : 'false'"
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

      <!-- 右侧：演讲者提词卡 (Notes) -->
      <section class="notes-panel">
        <div class="panel-header">
          <span>📝 演讲者私有备忘录 (Speaker Notes)</span>
          <div class="notes-size-controls">
            <button @click="decreaseFontSize">A-</button>
            <span class="notes-size-value">{{ notesFontSize }}px</span>
            <button @click="increaseFontSize">A+</button>
          </div>
        </div>
        <div class="notes-content" :style="{ fontSize: notesFontSize + 'px' }">
          {{ currentNotes || '（本页未设置演讲者备忘录）' }}
        </div>
      </section>
    </main>

    <!-- 空数据等待态：显式给出原因与自救入口，替代无声占位符 -->
    <main v-else class="presenter-empty">
      <div class="empty-icon">📡</div>
      <h2>等待大屏放映数据…</h2>
      <p>演讲者控制台需要「演示预览」页签（大屏放映端）提供幻灯片数据。</p>
      <p class="empty-hint">若预览页签在另一窗口放映，本控制台将自动通过广播信道接入。</p>
      <div class="empty-actions">
        <button class="btn-empty-action" @click="openBigScreen">打开大屏放映页签</button>
        <button class="btn-empty-action btn-empty-action--popout" @click="openStandaloneWindow">
          🗗 弹出独立放映窗口
        </button>
      </div>
    </main>

    <!-- 底栏翻页与步进控制 -->
    <footer class="presenter-actions">
      <div class="nav-btn-group">
        <button
          class="btn-nav-slide"
          :disabled="currentPage <= 1"
          title="跳过本页步进，直接返回上一页 (Shift+Left)"
          @click="goPrevSlide"
        >
          ⏮ 上一页
        </button>
        <button
          class="btn-nav"
          :disabled="!canGoPrevStep"
          title="回退一步或返回上一页 (Left)"
          @click="goPrevStep"
        >
          ◀ 上一步 (Left)
        </button>
      </div>

      <div class="actions-center">
        <span>进度: {{ progressPercent }}%</span>
        <span v-if="currentMaxStep > 0" class="step-progress-text">
          步进: {{ currentStep }} / {{ currentMaxStep }}
        </span>
        <span class="hint-text">空格/方向键逐步触发，Shift+方向键整页快跳</span>
        <button class="btn-ghost" @click="restartPresentation">⏮ 重头放映</button>
      </div>

      <div class="nav-btn-group">
        <button
          class="btn-nav"
          :disabled="!canGoNextStep"
          title="触发下一个 v-click 对象显示或进入下一页 (Right / Space)"
          @click="goNextStep"
        >
          {{ currentStep < currentMaxStep ? `下一步 (${currentStep + 1}/${currentMaxStep}) ▶` : '下一步 (Right) ▶' }}
        </button>
        <button
          class="btn-nav-slide"
          :disabled="currentPage >= totalPages"
          title="跳过本页剩余步进，直接进入下一页 (Shift+Right)"
          @click="goNextSlide"
        >
          下一页 ⏭
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, inject } from 'vue'
import type { Plugin } from 'siyuan'
import { WebSandboxBridge } from '@/engine/web-sandbox-bridge'
import type {
  ISlidevDocument,
  ISlidevPluginConfig,
  ISlidevVirtualPage,
  ISlidevBlockItem,
} from '@/types/slidev-protocol'
import {
  computeSlideMaxStep,
  computeThumbnailScale,
  parseSlideAspectRatio,
  renderPresenterSlideThumbnailHtml,
} from './presenter-slide-thumbnail'

const plugin = inject<Plugin>('plugin')
const sandboxBridge = inject<WebSandboxBridge>('sandboxBridge', new WebSandboxBridge())

const slides = ref<ISlidevVirtualPage[]>([])
const docConfig = ref<Partial<ISlidevPluginConfig>>({})
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

const slideAspect = computed(() => parseSlideAspectRatio(docConfig.value?.aspectRatio))
const activeSlidevTheme = computed(() => docConfig.value?.theme || 'default')
const activeColorSchema = computed(() => (docConfig.value?.colorSchema === 'light' ? 'light' : 'dark'))
const isNormalizeHeadings = computed(() => Boolean(docConfig.value?.normalizeHeadingSizes))

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

// 计时器状态
const elapsedSeconds = ref(0)
const isTimerRunning = ref(true)
let timerInterval: number | null = null

const formattedTime = computed(() => {
  const m = String(Math.floor(elapsedSeconds.value / 60)).padStart(2, '0')
  const s = String(elapsedSeconds.value % 60).padStart(2, '0')
  return `${m}:${s}`
})

function toggleTimer() {
  isTimerRunning.value = !isTimerRunning.value
}

function resetTimer() {
  elapsedSeconds.value = 0
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
function extractSnippet(blocks: ISlidevBlockItem[] | undefined): string {
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
  if (notesFontSize.value > 12) notesFontSize.value -= 2
}

const progressPercent = computed(() => {
  if (totalPages.value <= 1) return 100
  return Math.round((currentPage.value / totalPages.value) * 100)
})

// 跨窗口广播信道：与预览沙盒（可能在另一思源窗口）双向同步页码、步进与数据
let broadcastChannel: BroadcastChannel | null = null
try {
  broadcastChannel = new BroadcastChannel('siyuan-slidev-sync')
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

/**
 * 翻页与步进动作双通道幂等下发：
 * - 宿主桥接 navigatePage(page, step)：同窗口预览沙盒的权威通路
 * - BroadcastChannel SYNC_PAGE { page, step }：预览沙盒位于另一独立窗口时的跨窗口通路
 */
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

/**
 * 步进优先向后：先走完当前页内的 v-click / 动态蒙版步进，全部触发后再进入下一页
 */
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

/**
 * 步进优先向前：当前页已触发步进时先回退一步，步进归零后再返回上一页
 */
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

/**
 * 整页快跳向后：直接跳过当前页剩余步进，进入下一页
 */
function goNextSlide() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    currentStep.value = 0
    syncToMain(currentPage.value, 0)
  }
}

/**
 * 整页快跳向前：直接返回上一页起始态
 */
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
  // 焦点落在按钮上时空格交给原生点击，避免与翻页双触发
  if (e.key === ' ' && (e.target as HTMLElement)?.closest?.('button')) return

  // Shift + 左右方向键 或 上下方向键：直接整页快跳
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

  // 默认左右方向键 / 空格 / PageDown / PageUp：步进优先
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault()
    goNextStep()
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault()
    goPrevStep()
  }
}

// 滚轮翻页/步进（备注区可滚动时优先滚动备注）
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

onMounted(() => {
  timerInterval = window.setInterval(() => {
    if (isTimerRunning.value) {
      elapsedSeconds.value++
    }
  }, 1000)

  // 同窗口权威通路：沙盒每次翻页或步进都经宿主桥接上报 SLIDE_CHANGED
  unbindSlideChanged = sandboxBridge.onSlideChanged((page, total, _blockId, step, maxStep) => {
    currentPage.value = page
    if (total > 0) bridgeTotal.value = total
    if (typeof step === 'number') currentStep.value = Math.max(0, step)
    if (typeof maxStep === 'number') bridgeMaxStep.value = Math.max(0, maxStep)
  })

  // 广播信道：请求任何窗口中的预览沙盒立即回放当前页码与数据
  try {
    broadcastChannel?.postMessage({ type: 'REQUEST_SYNC' })
  } catch (e) {}

  // 宿主侧兜底：本窗口已编译过文档时直接取用，避免等待广播应答
  const latestDoc = (plugin as any)?.latestCompiledDoc as ISlidevDocument | null | undefined
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
  if (timerInterval) {
    window.clearInterval(timerInterval)
    timerInterval = null
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
  /** 宿主推送全量文档数据（与 Dock 面板同源的直连通路） */
  updateDocument(doc: ISlidevDocument) {
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
.spm-presenter-tab {
  --bg-dark: #0f1117;
  --card-bg: #1a1d26;
  --border-color: #2e3346;
  --text-main: #f1f5f9;
  --text-muted: #94a3b8;
  --accent-color: #3b82f6;
  --accent-green: #10b981;

  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  background: var(--bg-dark);
  color: var(--text-main);
  font-family: system-ui, -apple-system, sans-serif;
  outline: none;
  /* 以容器宽度驱动响应式：页签可能停靠右侧窄栏、主窗口或独立窗口，媒体查询无法感知 */
  container-type: inline-size;
}

.spm-presenter-tab * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  /* 关键防线：杜绝 flex/grid 子项以内容最小宽度撑破容器导致整栏被挤出屏幕 */
  min-width: 0;
}

/* Top Bar */
.presenter-header {
  height: 52px;
  flex-shrink: 0;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 20px;
}

.presenter-title {
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.title-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-divider {
  opacity: 0.5;
}

.header-step-badge {
  background: rgba(59, 130, 246, 0.18);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.38);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.header-timer {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 15px;
}

.btn-popout-window {
  background: rgba(59, 130, 246, 0.14);
  border: 1px solid rgba(59, 130, 246, 0.45);
  color: #60a5fa;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, -apple-system, sans-serif;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.btn-popout-window:hover {
  background: rgba(59, 130, 246, 0.28);
  border-color: #60a5fa;
  color: #ffffff;
}

.timer-badge {
  background: rgba(16, 185, 129, 0.15);
  color: var(--accent-green);
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
}

.timer-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.timer-controls button,
.notes-size-controls button,
.btn-ghost,
.btn-empty-action {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}

.timer-controls button:hover,
.notes-size-controls button:hover,
.btn-ghost:hover,
.btn-empty-action:hover {
  background: var(--border-color);
  color: var(--text-main);
}

/* Main Grid */
.presenter-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

.slide-panels {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.panel-box {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.current-slide-panel {
  flex: 1.4;
}

.next-slide-panel {
  flex: 1;
}

.next-slide-panel.is-clickable {
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.next-slide-panel.is-clickable:hover {
  border-color: var(--accent-color);
}

.panel-header {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

.panel-header span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.panel-step-pill {
  background: rgba(59, 130, 246, 0.18);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.panel-preview {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 7px;
  background: #12141b;
  overflow: hidden;
  position: relative;
}

.panel-preview--dim {
  opacity: 0.88;
}

.presenter-thumb-box {
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.12);
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
  font-size: clamp(1.05rem, 4cqi, 1.6rem);
  margin-bottom: 8px;
  color: #60a5fa;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-fallback p {
  font-size: clamp(0.8rem, 2.6cqi, 1.05rem);
  opacity: 0.8;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Notes Panel */
.notes-panel {
  min-height: 0;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notes-size-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.notes-size-controls button {
  padding: 1px 6px;
}

.notes-size-value {
  font-size: 11px;
  opacity: 0.8;
}

.notes-content {
  flex: 1;
  min-height: 0;
  padding: 20px;
  font-size: 1.25rem;
  line-height: 1.8;
  overflow-y: auto;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  color: #e2e8f0;
}

/* Empty state */
.presenter-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  padding: 40px;
  text-align: center;
  background: #181920;
}

.empty-icon {
  font-size: 42px;
}

.presenter-empty h2 {
  font-size: 1.5rem;
  color: #60a5fa;
}

.presenter-empty p {
  font-size: 1rem;
  color: var(--text-muted);
}

.empty-hint {
  opacity: 0.75;
  font-size: 0.85rem !important;
}

.empty-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.btn-empty-action {
  padding: 6px 18px;
  font-size: 13px;
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.btn-empty-action--popout {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  font-weight: 600;
}

/* Bottom Action Bar */
.presenter-actions {
  min-height: 48px;
  flex-shrink: 0;
  background: var(--card-bg);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 20px;
}

.nav-btn-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.btn-nav {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-nav:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-nav-slide {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn-nav-slide:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  border-color: var(--accent-color);
}

.btn-nav-slide:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.step-progress-text {
  color: #60a5fa;
  font-weight: 600;
}

.actions-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 13px;
  color: var(--text-muted);
  min-width: 0;
}

/* 窄容器（右侧 Dock 栏 / 窄独立窗口）：切换为纵向布局，
   上方双卡并排呈现当前页与下一页 16:9 缩略图，下方备注面板占据主导高度 */
@container (max-width: 719px) {
  .presenter-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, auto) minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
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
    padding: 6px 10px;
  }

  .notes-content {
    padding: 14px;
    font-size: 1.05rem;
  }

  .presenter-header {
    padding: 0 12px;
  }

  .presenter-actions {
    padding: 6px 12px;
  }

  .hint-text,
  .header-step-badge {
    display: none;
  }

  .btn-nav {
    padding: 6px 10px;
    font-size: 13px;
  }

  .btn-nav-slide {
    padding: 6px 8px;
    font-size: 11px;
  }
}

@container (max-width: 420px) {
  .slide-panels {
    grid-template-columns: minmax(0, 1fr);
  }

  .panel-preview {
    max-height: 150px;
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

  &[data-theme="light"] {
    --slide-bg: #ffffff;
    --slide-text: #1e293b;
    --slide-accent: #059669;
    --slide-code-bg: #f8fafc;
  }

  &[data-theme="dark"] {
    --slide-bg: #121214;
    --slide-text: #e2e8f0;
    --slide-accent: #34d399;
    --slide-code-bg: #1e1e24;
  }

  &.slidev-theme-seriph {
    --slide-font: "PT Serif", "Charter", "Georgia", "Cambria", "Times New Roman", "Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", serif;
    --slide-accent: #f59e0b;
    &[data-theme="light"] {
      --slide-bg: #fdfbf7;
      --slide-text: #2a2521;
      --slide-accent: #b45309;
      --slide-code-bg: #f4efe6;
    }
    &[data-theme="dark"] {
      --slide-bg: #1c1a17;
      --slide-text: #e8e3d9;
      --slide-accent: #f59e0b;
      --slide-code-bg: #26231f;
    }
  }

  &.slidev-theme-apple-basic {
    --slide-font: -apple-system, "SF Pro Display", "SF Pro Text", BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
    --slide-accent: #2997ff;
    &[data-theme="light"] {
      --slide-bg: #ffffff;
      --slide-text: #1d1d1f;
      --slide-accent: #0071e3;
    }
    &[data-theme="dark"] {
      --slide-bg: #000000;
      --slide-text: #f5f5f7;
      --slide-accent: #2997ff;
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
    padding: var(--slidev-padding-y, 32px) var(--slidev-padding-x, 48px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }

  .slide-content.spacing-compact {
    --slidev-padding-y: 20px;
    --slidev-padding-x: 36px;
    --slidev-header-gap: 10px;
    --slidev-title-margin-bottom: 6px;
  }

  .slide-content.spacing-normal {
    --slidev-padding-y: 32px;
    --slidev-padding-x: 48px;
    --slidev-header-gap: 16px;
    --slidev-title-margin-bottom: 10px;
  }

  .slide-content.spacing-loose {
    --slidev-padding-y: 48px;
    --slidev-padding-x: 56px;
    --slidev-header-gap: 24px;
    --slidev-title-margin-bottom: 16px;
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

  &.slidev-theme-default .layout-cover h1,
  &.slidev-theme-default .layout-cover .slide-block h1 {
    background: linear-gradient(135deg, #10b981, #06b6d4) !important;
    -webkit-background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
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

  .layout-fact h1 {
    font-size: 4.5rem !important;
    font-weight: 900 !important;
    color: var(--slide-accent) !important;
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
    margin-bottom: var(--slidev-header-gap, 16px) !important;
    flex-shrink: 0;
  }

  .layout-header-section h1,
  .layout-header-section h2,
  .layout-header-section h3 {
    margin-bottom: var(--slidev-title-margin-bottom, 10px) !important;
  }

  .pdf-two-cols-wrapper,
  .layout-two-cols-grid,
  .layout-cols-wrapper,
  .layout-cols-grid {
    display: grid;
    grid-template-columns: var(--slide-grid-cols, minmax(0, 1fr) minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr) !important;
    gap: 28px;
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
    gap: 24px;
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
    gap: 20px;
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
    gap: 12px;
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
    margin-bottom: 12px;
    line-height: 1.6;
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

  .slide-block h1 { font-size: 2.2rem; font-weight: 700; margin-bottom: 12px; }
  .slide-block h2 { font-size: 1.7rem; font-weight: 600; margin-bottom: 10px; }
  .slide-block h3 { font-size: 1.3rem; font-weight: 600; margin-bottom: 8px; }
  .slide-block h4 { font-size: 1.15rem; font-weight: 600; margin-bottom: 6px; }
  .slide-block p { font-size: 1.15rem; line-height: 1.6; }

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
    margin: 6px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
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
  .has-superblock-cols .slidev-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
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
  &[data-normalize-headings="true"] .slidev-page-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
  &[data-normalize-headings="true"] .slide-content:not(.layout-cover) > .slide-block:first-child :is(h1, h2, h3, h4, h5, h6) {
    font-size: 1.7rem !important;
    font-weight: 600 !important;
    line-height: 1.25 !important;
    margin-bottom: 10px !important;
  }

  &[data-normalize-headings="true"] .has-superblock-cols .slidev-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
  &[data-normalize-headings="true"] .has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
    font-size: 1.3rem !important;
    font-weight: 600 !important;
    line-height: 1.3 !important;
    margin-bottom: 8px !important;
    text-align: center !important;
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

  .slidev-ref-tag,
  a.slidev-ref-tag {
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

  .slidev-block-ref {
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
