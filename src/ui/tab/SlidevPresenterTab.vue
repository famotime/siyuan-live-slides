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
      </div>

      <div class="header-timer">
        <div class="timer-badge">⏱ 已演讲: {{ formattedTime }}</div>
        <div class="timer-controls">
          <button @click="toggleTimer">{{ isTimerRunning ? '暂停' : '开始' }}</button>
          <button @click="resetTimer">重置</button>
        </div>
      </div>
    </header>

    <!-- 主展示网格 -->
    <main v-if="totalPages > 0" class="presenter-grid">
      <!-- 左侧：当前幻灯片与下一页预览 -->
      <section class="slide-panels">
        <div class="panel-box current-slide-panel">
          <div class="panel-header">
            <span>当前大屏放映 (Page {{ currentPage }})</span>
            <span>布局: {{ currentSlide?.frontmatter?.layout || 'default' }}</span>
          </div>
          <div class="panel-preview">
            <h2>{{ currentSlideTitle }}</h2>
            <p>{{ currentSlideSnippet }}</p>
          </div>
        </div>

        <div class="panel-box next-slide-panel">
          <div class="panel-header">
            <span>下一页预告 (Page {{ currentPage + 1 }})</span>
            <span v-if="currentPage >= totalPages">已到达最后一页</span>
          </div>
          <div class="panel-preview panel-preview--dim">
            <h2>{{ nextSlideTitle }}</h2>
            <p>{{ nextSlideSnippet }}</p>
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
      <button class="btn-empty-action" @click="openBigScreen">打开大屏放映页签</button>
    </main>

    <!-- 底栏翻页 -->
    <footer class="presenter-actions">
      <button class="btn-nav" :disabled="currentPage <= 1" @click="goPrevSlide">◀ 上一页 (Left)</button>
      <div class="actions-center">
        <span>进度: {{ progressPercent }}%</span>
        <span class="hint-text">按空格/方向键翻页，大屏联动</span>
        <button class="btn-ghost" @click="restartPresentation">⏮ 重头放映</button>
      </div>
      <button class="btn-nav" :disabled="currentPage >= totalPages" @click="goNextSlide">下一页 (Right) ▶</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import type { Plugin } from 'siyuan'
import { WebSandboxBridge } from '@/engine/web-sandbox-bridge'
import type { ISlidevDocument, ISlidevVirtualPage, ISlidevBlockItem } from '@/types/slidev-protocol'

const plugin = inject<Plugin>('plugin')
const sandboxBridge = inject<WebSandboxBridge>('sandboxBridge', new WebSandboxBridge())

const slides = ref<ISlidevVirtualPage[]>([])
const currentPage = ref(1)
// 桥接侧上报的总页数兜底：幻灯片数据未到位时也能显示正确页数并解锁翻页
const bridgeTotal = ref(0)
const totalPages = computed(() => slides.value.length || bridgeTotal.value)

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

// 跨窗口广播信道：与预览沙盒（可能在另一思源窗口）双向同步页码与数据
let broadcastChannel: BroadcastChannel | null = null
try {
  broadcastChannel = new BroadcastChannel('siyuan-slidev-sync')
  broadcastChannel.onmessage = (event: MessageEvent) => {
    const data = event.data
    if (!data) return
    if (data.type === 'SYNC_PAGE' && typeof data.page === 'number') {
      currentPage.value = data.page
    }
    if (data.type === 'SYNC_SLIDES' && Array.isArray(data.slides)) {
      slides.value = data.slides
    }
  }
} catch (e) {
  broadcastChannel = null
}

/**
 * 翻页动作双通道下发：
 * - 宿主桥接 navigatePage：同窗口预览沙盒的权威通路（与 Dock 面板同源）
 * - BroadcastChannel SYNC_PAGE：预览沙盒位于另一思源窗口时的跨窗口通路
 */
function syncToMain(page: number) {
  const pageNum = Number(page) || 1
  sandboxBridge.navigatePage(pageNum)
  try {
    broadcastChannel?.postMessage({ type: 'SYNC_PAGE', page: pageNum })
  } catch (e) {}
}

function goNextSlide() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    syncToMain(currentPage.value)
  }
}

function goPrevSlide() {
  if (currentPage.value > 1) {
    currentPage.value--
    syncToMain(currentPage.value)
  }
}

function restartPresentation() {
  currentPage.value = 1
  resetTimer()
  syncToMain(1)
}

function openBigScreen() {
  const host = plugin as any
  if (typeof host?.openBottomPreviewTab === 'function') {
    void host.openBottomPreviewTab()
  }
}

function onKeyDown(e: KeyboardEvent) {
  // 焦点落在按钮上时空格交给原生点击，避免与翻页双触发
  if (e.key === ' ' && (e.target as HTMLElement)?.closest?.('button')) return
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault()
    goNextSlide()
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault()
    goPrevSlide()
  }
}

// 滚轮翻页（备注区可滚动时优先滚动备注）
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
  if (e.deltaY > 0) goNextSlide()
  else goPrevSlide()
}

let unbindSlideChanged: (() => void) | null = null

onMounted(() => {
  timerInterval = window.setInterval(() => {
    if (isTimerRunning.value) {
      elapsedSeconds.value++
    }
  }, 1000)

  // 同窗口权威通路：沙盒每次翻页都经宿主桥接上报 SLIDE_CHANGED
  unbindSlideChanged = sandboxBridge.onSlideChanged((page, total) => {
    currentPage.value = page
    if (total > 0) bridgeTotal.value = total
  })

  // 广播信道：请求任何窗口中的预览沙盒立即回放当前页码与数据
  try {
    broadcastChannel?.postMessage({ type: 'REQUEST_SYNC' })
  } catch (e) {}

  // 宿主侧兜底：本窗口已编译过文档时直接取用，避免等待广播应答
  const latestDoc = (plugin as any)?.latestCompiledDoc as ISlidevDocument | null | undefined
  if (latestDoc?.slides?.length) {
    slides.value = latestDoc.slides
  }
})

onUnmounted(() => {
  if (timerInterval) {
    window.clearInterval(timerInterval)
    timerInterval = null
  }
  if (unbindSlideChanged) unbindSlideChanged()
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

.header-timer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 15px;
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

.panel-header {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

.panel-header span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-preview {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
  text-align: center;
  background: #181920;
  overflow: hidden;
}

.panel-preview--dim {
  opacity: 0.75;
}

.panel-preview h2 {
  font-size: 1.8rem;
  font-size: clamp(1.05rem, 4cqi, 1.8rem);
  margin-bottom: 8px;
  color: #60a5fa;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-preview p {
  font-size: 1.1rem;
  font-size: clamp(0.8rem, 2.6cqi, 1.1rem);
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

.btn-empty-action {
  margin-top: 10px;
  padding: 6px 18px;
  font-size: 13px;
  border-color: var(--accent-color);
  color: var(--accent-color);
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

/* 窄容器（右侧 Dock 栏 / 窄独立窗口）：切换为纵向单列布局，
   备注面板置于下方并占据主导高度，保证提词内容始终可见 */
@container (max-width: 719px) {
  .presenter-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, auto) minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
  }

  .slide-panels {
    gap: 10px;
  }

  .current-slide-panel,
  .next-slide-panel {
    flex: 0 0 auto;
  }

  .current-slide-panel {
    min-height: 118px;
  }

  .next-slide-panel {
    min-height: 92px;
  }

  .panel-preview {
    padding: 12px;
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

  .hint-text {
    display: none;
  }

  .btn-nav {
    padding: 6px 10px;
    font-size: 13px;
  }
}
</style>
