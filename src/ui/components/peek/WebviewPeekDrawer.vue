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
        <!-- 桌面端 / 移动端视图切换开关 -->
        <button
          class="spm-icon-btn spm-mode-toggle b3-tooltips b3-tooltips__s"
          :class="{ 'is-active': viewMode === 'mobile' }"
          :aria-label="viewMode === 'mobile' ? '当前为手机视图，点击切换为桌面视图' : '当前为桌面视图，点击切换为手机视图'"
          @click="toggleViewMode"
        >
          <SlidevIcon :name="viewMode === 'mobile' ? 'mobile' : 'desktop'" />
        </button>

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
      :class="{ 'is-mobile': viewMode === 'mobile' }"
      @wheel.ctrl="onCtrlWheel"
    >
      <div
        class="spm-webview-viewport"
        :class="{ 'is-mobile': viewMode === 'mobile' }"
      >
        <!-- 桌面端 (Electron 原生 webview) -->
        <webview
          v-if="isDesktop"
          ref="webviewRef"
          class="spm-webview-frame"
          :src="currentUrl"
          :useragent="currentUserAgent"
          allowpopups="true"
          partition="persist:slidev-peek"
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: inline-flex;"
        ></webview>

        <!-- Web / Docker 纯前端环境降级 (iframe + 友好引导卡片) -->
        <div
          v-else
          class="spm-webview-fallback"
        >
          <iframe
            class="spm-webview-fallback-frame"
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
  </div>
</template>

<script lang="ts">
export type TViewMode = 'desktop' | 'mobile'

// 现代主流移动端 UA (iOS 17 Safari 兼容度高，能完美唤起移动端页面)
export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1'

export const STORAGE_KEY_VIEW_MODE = 'siyuan-slidev-peek-view-mode'

let cachedViewMode: TViewMode = 'desktop'

export function getInitialViewMode(): TViewMode {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_VIEW_MODE)
      if (saved === 'mobile' || saved === 'desktop') {
        return saved
      }
    } catch {}
  }
  return cachedViewMode
}

export function saveViewMode(mode: TViewMode) {
  cachedViewMode = mode
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode)
    } catch {}
  }
}
</script>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'
import { isDesktopEnvironment, getRuntimeModule } from '@/engine/runtime-node'

const emit = defineEmits<{
  (e: 'external-jump', url: string): void
}>()

const props = withDefaults(
  defineProps<{
    url: string
    title?: string
    visible?: boolean
  }>(),
  {
    visible: true,
  }
)

const isDesktop = ref(isDesktopEnvironment())
const currentUrl = ref(props.url)
const urlInputValue = ref(props.url)
const isLoading = ref(false)
const canGoBack = ref(false)
const canGoForward = ref(false)
const zoomFactor = ref(1.0)
const isCopied = ref(false)
const viewMode = ref<TViewMode>(getInitialViewMode())

let defaultDesktopUserAgent =
  typeof navigator !== 'undefined' && !navigator.userAgent.includes('iPhone')
    ? navigator.userAgent
    : ''

const currentUserAgent = computed(() => {
  return viewMode.value === 'mobile' ? MOBILE_USER_AGENT : (defaultDesktopUserAgent || undefined)
})

const webviewRef = ref<any>(null)
const containerEl = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null
let globalErrorHandler: ((e: ErrorEvent) => void) | null = null
let unhandledRejectionHandler: ((e: PromiseRejectionEvent) => void) | null = null

watch(
  () => props.url,
  (newUrl) => {
    if (newUrl && newUrl !== currentUrl.value) {
      currentUrl.value = newUrl
      urlInputValue.value = newUrl
      if (viewMode.value === 'mobile') {
        applyViewMode(false)
      }
      if (webviewRef.value && typeof webviewRef.value.loadURL === 'function') {
        webviewRef.value.loadURL(newUrl)
      }
    }
  }
)

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) {
      // 抽屉隐藏时：停止正在进行的加载与音视频播放
      if (webviewRef.value) {
        try {
          if (typeof webviewRef.value.stop === 'function') {
            webviewRef.value.stop()
          }
        } catch {
          // 忽略已停止加载的异常
        }
      }
    } else {
      // 抽屉重新显示时重置缩放与视图模式
      applyZoomFactor()
      if (viewMode.value === 'mobile') {
        applyViewMode(false)
      }
    }
  }
)

onMounted(() => {
  setupWebviewListeners()
  if (containerEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      const wv = webviewRef.value
      if (wv && typeof wv.invalidate === 'function') {
        try {
          wv.invalidate()
        } catch {
          // 忽略宿主不支持 invalidate 的异常
        }
      }
    })
    resizeObserver.observe(containerEl.value)
  }

  // 针对 Electron 内核已知 webview teardown 异常的全局保底拦截
  globalErrorHandler = (event: ErrorEvent) => {
    const errorMsg = event.message || event.error?.message
    if (typeof errorMsg === 'string' && errorMsg.includes('Invalid guestInstanceId')) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return true
    }
  }
  window.addEventListener('error', globalErrorHandler, true)

  unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    const msg = typeof reason === 'string' ? reason : reason?.message
    if (typeof msg === 'string' && msg.includes('Invalid guestInstanceId')) {
      event.preventDefault()
    }
  }
  window.addEventListener('unhandledrejection', unhandledRejectionHandler)
})

onBeforeUnmount(() => {
  cleanupWebviewListeners()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (globalErrorHandler) {
    window.removeEventListener('error', globalErrorHandler, true)
    globalErrorHandler = null
  }
  if (unhandledRejectionHandler) {
    window.removeEventListener('unhandledrejection', unhandledRejectionHandler)
    unhandledRejectionHandler = null
  }

  // 组件最终销毁前平稳停止网络与渲染管道
  if (webviewRef.value) {
    try {
      if (typeof webviewRef.value.stop === 'function') {
        webviewRef.value.stop()
      }
    } catch {
      // 忽略
    }
  }
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
  const wv = webviewRef.value
  if (wv && typeof wv.getUserAgent === 'function' && !defaultDesktopUserAgent) {
    try {
      const ua = wv.getUserAgent()
      if (ua && !ua.includes('iPhone')) {
        defaultDesktopUserAgent = ua
      }
    } catch {}
  }
  if (viewMode.value === 'mobile') {
    applyViewMode(false)
  }
  applyZoomFactor()
  updateNavState()
}

function toggleViewMode() {
  const nextMode: TViewMode = viewMode.value === 'mobile' ? 'desktop' : 'mobile'
  viewMode.value = nextMode
  saveViewMode(nextMode)
  applyViewMode(true)
}

function applyViewMode(forceReload = false) {
  const wv = webviewRef.value
  if (!wv) return

  const targetUA = viewMode.value === 'mobile' ? MOBILE_USER_AGENT : defaultDesktopUserAgent
  if (typeof wv.setUserAgent === 'function' && targetUA) {
    try {
      wv.setUserAgent(targetUA)
    } catch (e) {
      console.warn('[WebviewPeekDrawer] setUserAgent error:', e)
    }
  }

  if (forceReload && typeof wv.reload === 'function') {
    try {
      wv.reload()
    } catch (e) {
      console.warn('[WebviewPeekDrawer] reload error:', e)
    }
  }
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
  const targetUrl = currentUrl.value
  if (typeof window !== 'undefined') {
    const electron = getRuntimeModule('electron')
    if (electron?.shell?.openExternal) {
      electron.shell.openExternal(targetUrl).catch(() => {
        window.open(targetUrl, '_blank')
      })
    } else {
      window.open(targetUrl, '_blank')
    }
  }
  emit('external-jump', targetUrl)
}
</script>

<style lang="scss" scoped>
.spm-webview-drawer {
  width: 100%;
  height: 100%;
  flex: 1 1 0%;
  min-height: 0;
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

.spm-mode-toggle {
  &.is-active {
    background: var(--b3-theme-primary-light, rgba(59, 130, 246, 0.12));
    border-color: var(--b3-theme-primary, #3b82f6);
    color: var(--b3-theme-primary, #3b82f6);

    &:hover {
      background: var(--b3-theme-primary-light, rgba(59, 130, 246, 0.2));
    }
  }
}

.spm-webview-body {
  flex: 1 1 0%;
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;
  background: var(--b3-theme-background, #ffffff);
  display: flex;
  justify-content: center;
  align-items: stretch;

  &.is-mobile {
    background: var(--b3-theme-surface, #f1f5f9);
    padding: 12px 0;
  }
}

.spm-webview-viewport {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

  &.is-mobile {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
    bottom: auto;
    width: 390px;
    max-width: 100%;
    height: 100%;
    border-radius: 12px;
    overflow: hidden;
    background: var(--b3-theme-background, #ffffff);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--b3-border-color, #e2e8f0);
  }
}

.spm-webview-frame,
webview.spm-webview-frame {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100% !important;
  height: 100% !important;
  flex: 1 1 100% !important;
  min-height: 0 !important;
  display: inline-flex !important;
  border: none !important;
  outline: none;
}

.spm-webview-fallback {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.spm-webview-fallback-frame {
  width: 100%;
  height: 100%;
  flex: 1 1 0%;
  min-height: 0;
  border: none;
  display: block;
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
  flex-shrink: 0;
}

:global(webview.spm-webview-frame) {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 100% !important;
  display: inline-flex !important;
}
</style>
