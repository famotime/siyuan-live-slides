<template>
  <div class="spm-webview-drawer">
    <!-- 顶部导航控制条 -->
    <div class="spm-webview-toolbar">
      <div class="spm-webview-toolbar__nav">
        <!-- 后退 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :disabled="!canGoBack"
          aria-label="后退"
          @click="goBack"
        >
          <SlidevIcon name="arrow-left" />
        </button>

        <!-- 前进 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :disabled="!canGoForward"
          aria-label="前进"
          @click="goForward"
        >
          <SlidevIcon name="arrow-right" />
        </button>

        <!-- 刷新 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :aria-label="isLoading ? '正在加载...' : '刷新页面'"
          @click="reload"
        >
          <SlidevIcon name="refresh" />
        </button>
      </div>

      <!-- 地址栏与直达输入 -->
      <div class="spm-webview-toolbar__address">
        <input
          v-model="urlInputValue"
          type="text"
          class="b3-text-field spm-url-input"
          placeholder="https://..."
          spellcheck="false"
          @keydown.enter="navigateToUrl"
        />
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :aria-label="isCopied ? '已复制地址！' : '复制网址'"
          @click="copyUrl"
        >
          <SlidevIcon name="copy" />
        </button>
      </div>

      <div class="spm-webview-toolbar__actions">
        <!-- 显式缩放控制器 -->
        <div class="spm-zoom-controller">
          <button
            class="spm-icon-btn b3-tooltips b3-tooltips__s"
            aria-label="缩小 (Ctrl + -)"
            :disabled="zoomFactor <= 0.5"
            @click="zoomOut"
          >
            <SlidevIcon name="minus" />
          </button>
          <button
            class="spm-zoom-badge b3-tooltips b3-tooltips__s"
            aria-label="重置 100% (Ctrl + 0)"
            @click="resetZoom"
          >
            {{ Math.round(zoomFactor * 100) }}%
          </button>
          <button
            class="spm-icon-btn b3-tooltips b3-tooltips__s"
            aria-label="放大 (Ctrl + +)"
            :disabled="zoomFactor >= 2.5"
            @click="zoomIn"
          >
            <SlidevIcon name="plus" />
          </button>
        </div>

        <!-- 在系统浏览器中打开 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="在系统默认浏览器中打开 ↗"
          @click="openInSystemBrowser"
        >
          <SlidevIcon name="external-link" />
          <span>外跳</span>
        </button>
      </div>
    </div>

    <!-- 视口内容容器 -->
    <div
      ref="containerEl"
      class="spm-webview-body"
      @wheel.ctrl="onCtrlWheel"
    >
      <!-- 桌面端 (Electron 原生 webview) -->
      <webview
        v-if="isDesktop"
        ref="webviewRef"
        class="spm-webview-frame"
        :src="currentUrl"
        allowpopups="true"
        partition="persist:slidev-peek"
      ></webview>

      <!-- Web / Docker 纯前端环境降级 (iframe + 友好引导卡片) -->
      <div
        v-else
        class="spm-webview-fallback"
      >
        <iframe
          class="spm-webview-frame"
          :src="currentUrl"
          frameborder="0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        ></iframe>
        <div class="spm-fallback-bar">
          <span>如页面受同源策略 (X-Frame-Options) 拦截无法显示，请</span>
          <button
            class="spm-icon-btn is-primary"
            @click="openInSystemBrowser"
          >
            在新标签页中打开 ↗
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'
import { isDesktopEnvironment } from '@/engine/runtime-node'

const props = defineProps<{
  url: string
  title?: string
}>()

const isDesktop = ref(isDesktopEnvironment())
const currentUrl = ref(props.url)
const urlInputValue = ref(props.url)
const isLoading = ref(false)
const canGoBack = ref(false)
const canGoForward = ref(false)
const zoomFactor = ref(1.0)
const isCopied = ref(false)

const webviewRef = ref<any>(null)
const containerEl = ref<HTMLElement | null>(null)

watch(
  () => props.url,
  (newUrl) => {
    if (newUrl && newUrl !== currentUrl.value) {
      currentUrl.value = newUrl
      urlInputValue.value = newUrl
      if (webviewRef.value && typeof webviewRef.value.loadURL === 'function') {
        webviewRef.value.loadURL(newUrl)
      }
    }
  }
)

onMounted(() => {
  setupWebviewListeners()
})

onBeforeUnmount(() => {
  cleanupWebviewListeners()
})

function setupWebviewListeners() {
  const wv = webviewRef.value
  if (!wv) return

  wv.addEventListener('dom-ready', onDomReady)
  wv.addEventListener('did-start-loading', onDidStartLoading)
  wv.addEventListener('did-stop-loading', onDidStopLoading)
  wv.addEventListener('did-navigate', onDidNavigate)
  wv.addEventListener('did-navigate-in-page', onDidNavigateInPage)
  // 关键：拦截 target="_blank" 与 window.open，原地重定向加载
  wv.addEventListener('new-window', onNewWindow)
}

function cleanupWebviewListeners() {
  const wv = webviewRef.value
  if (!wv) return

  try {
    wv.removeEventListener('dom-ready', onDomReady)
    wv.removeEventListener('did-start-loading', onDidStartLoading)
    wv.removeEventListener('did-stop-loading', onDidStopLoading)
    wv.removeEventListener('did-navigate', onDidNavigate)
    wv.removeEventListener('did-navigate-in-page', onDidNavigateInPage)
    wv.removeEventListener('new-window', onNewWindow)
  } catch (e) {
    // 忽略卸载时的异常
  }
}

function onDomReady() {
  applyZoomFactor()
  updateNavState()
}

function onDidStartLoading() {
  isLoading.value = true
}

function onDidStopLoading() {
  isLoading.value = false
  updateNavState()
  if (webviewRef.value && typeof webviewRef.value.getURL === 'function') {
    const activeUrl = webviewRef.value.getURL()
    if (activeUrl && activeUrl !== 'about:blank') {
      currentUrl.value = activeUrl
      urlInputValue.value = activeUrl
    }
  }
}

function onDidNavigate(e: any) {
  if (e?.url) {
    currentUrl.value = e.url
    urlInputValue.value = e.url
  }
  updateNavState()
}

function onDidNavigateInPage(e: any) {
  if (e?.url) {
    currentUrl.value = e.url
    urlInputValue.value = e.url
  }
  updateNavState()
}

function onNewWindow(e: any) {
  if (e && e.url) {
    e.preventDefault()
    // 原位在当前微型浏览器中加载，杜绝外部弹窗抢焦点打断放映
    if (webviewRef.value && typeof webviewRef.value.loadURL === 'function') {
      webviewRef.value.loadURL(e.url)
    }
  }
}

function updateNavState() {
  const wv = webviewRef.value
  if (!wv) return
  if (typeof wv.canGoBack === 'function') {
    canGoBack.value = wv.canGoBack()
  }
  if (typeof wv.canGoForward === 'function') {
    canGoForward.value = wv.canGoForward()
  }
}

function goBack() {
  if (webviewRef.value && typeof webviewRef.value.goBack === 'function') {
    webviewRef.value.goBack()
  }
}

function goForward() {
  if (webviewRef.value && typeof webviewRef.value.goForward === 'function') {
    webviewRef.value.goForward()
  }
}

function reload() {
  if (webviewRef.value && typeof webviewRef.value.reload === 'function') {
    webviewRef.value.reload()
  }
}

function navigateToUrl() {
  let target = urlInputValue.value.trim()
  if (!target) return
  if (!/^https?:\/\//i.test(target)) {
    target = `https://${target}`
  }
  currentUrl.value = target
  urlInputValue.value = target
  if (webviewRef.value && typeof webviewRef.value.loadURL === 'function') {
    webviewRef.value.loadURL(target)
  }
}

function applyZoomFactor() {
  const wv = webviewRef.value
  if (wv && typeof wv.setZoomFactor === 'function') {
    try {
      wv.setZoomFactor(zoomFactor.value)
    } catch (e) {
      console.warn('[WebviewPeekDrawer] setZoomFactor error:', e)
    }
  }
}

function zoomIn() {
  zoomFactor.value = Math.min(2.5, Math.round((zoomFactor.value + 0.1) * 10) / 10)
  applyZoomFactor()
}

function zoomOut() {
  zoomFactor.value = Math.max(0.5, Math.round((zoomFactor.value - 0.1) * 10) / 10)
  applyZoomFactor()
}

function resetZoom() {
  zoomFactor.value = 1.0
  applyZoomFactor()
}

function onCtrlWheel(e: WheelEvent) {
  e.preventDefault()
  if (e.deltaY < 0) {
    zoomIn()
  } else if (e.deltaY > 0) {
    zoomOut()
  }
}

async function copyUrl() {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(currentUrl.value)
      isCopied.value = true
      setTimeout(() => {
        isCopied.value = false
      }, 2000)
    } catch (e) {
      console.warn('Copy url failed:', e)
    }
  }
}

function openInSystemBrowser() {
  if (typeof window !== 'undefined') {
    window.open(currentUrl.value, '_blank')
  }
}
</script>

<style lang="scss" scoped>
.spm-webview-drawer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--b3-theme-background, #ffffff);
}

.spm-webview-toolbar {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  background: var(--b3-theme-surface, #f8fafc);
  border-bottom: 1px solid var(--b3-border-color, #e2e8f0);
  flex-shrink: 0;
  gap: 8px;

  &__nav {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  &__address {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
}

.spm-url-input {
  flex: 1;
  height: 26px;
  font-size: 12px;
  padding: 0 8px;
  border-radius: 4px;
  background: var(--b3-theme-background, #ffffff);
  border: 1px solid var(--b3-border-color, #e2e8f0);
  color: var(--b3-theme-on-background, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:focus {
    border-color: var(--b3-theme-primary, #3b82f6);
    outline: none;
  }
}

.spm-zoom-controller {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--b3-theme-background, #ffffff);
  border: 1px solid var(--b3-border-color, #e2e8f0);
  border-radius: 4px;
  padding: 1px 2px;
}

.spm-zoom-badge {
  border: none;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #475569);
  padding: 0 4px;
  cursor: pointer;
  line-height: 22px;

  &:hover {
    color: var(--b3-theme-primary, #3b82f6);
  }
}

.spm-webview-body {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.spm-webview-frame {
  width: 100%;
  height: 100%;
  flex: 1;
  border: none;
  display: block;
}

.spm-webview-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.spm-fallback-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 11px;
  background: var(--b3-theme-surface, #f8fafc);
  border-top: 1px solid var(--b3-border-color, #e2e8f0);
  color: var(--b3-theme-on-surface, #64748b);
}
</style>
