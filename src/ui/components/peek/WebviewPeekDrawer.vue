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
          <SlidesIcon name="arrow-left" />
        </button>

        <!-- 前进 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :disabled="!canGoForward"
          aria-label="前进"
          @click="goForward"
        >
          <SlidesIcon name="arrow-right" />
        </button>

        <!-- 刷新 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :aria-label="isLoading ? '正在加载...' : '刷新页面'"
          @click="reload"
        >
          <SlidesIcon name="refresh" />
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
          <SlidesIcon name="copy" />
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
          <SlidesIcon :name="viewMode === 'mobile' ? 'mobile' : 'desktop'" />
        </button>

        <!-- 显式缩放控制器 -->
        <div class="spm-zoom-controller">
          <button
            class="spm-icon-btn b3-tooltips b3-tooltips__s"
            aria-label="缩小 (Ctrl + -)"
            :disabled="zoomFactor <= 0.5"
            @click="zoomOut"
          >
            <SlidesIcon name="minus" />
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
            <SlidesIcon name="plus" />
          </button>
        </div>

        <!-- 在系统浏览器中打开 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="在系统默认浏览器中打开 ↗"
          @click="openInSystemBrowser"
        >
          <SlidesIcon name="external-link" />
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
        <!-- 桌面端 (Electron 原生 webview)
             注意 1：此处刻意不声明 partition 属性，强制复用宿主默认 Session。
             原因：思源桌面端在本地内核模式下会以 --no-proxy-server 启动（app/electron/main.js），
             随后仅对主窗体 Session 调用 setProxy 下发「设置 → 网络代理」的代理配置；
             Electron 的 session.setProxy 是按 Session 生效的，一旦使用 partition="persist:xxx"
             就会落到一个从未配置代理的独立 Session，外网地址（GitHub 等）在公司代理环境下恒为空白页。
             复用默认 Session 同时可继承内核访问授权码 Cookie，保证带锁屏密码时 /assets 本地资源仍可加载。
             注意 2：src 仅绑定挂载时的初始值（initialUrl），严禁改绑 currentUrl——
             Electron 中 webview 的 src 属性一变即强制 loadURL() 整页重载，会把 SPA 站点
             的页内路由（pushState 已渲染的新页面）顶掉，未配置 SPA fallback 的托管站直接落到 404。 -->
        <webview
          v-if="isDesktop"
          ref="webviewRef"
          class="spm-webview-frame"
          :src="initialUrl"
          :useragent="currentUserAgent"
          allowpopups="true"
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

        <!-- 加载失败诊断卡片：Electron 内核的代理/证书/DNS 类失败不会自曝错误码，这里显式呈现，
             并把「网络代理」这一内网环境最常见成因直接指出来 -->
        <div
          v-if="loadError"
          class="spm-load-error"
        >
          <SlidesIcon
            name="alert"
            class="spm-load-error__icon"
          />
          <div class="spm-load-error__title">页面加载失败</div>
          <div class="spm-load-error__code">
            {{ loadError.description }}
            <span class="spm-load-error__code-num">({{ loadError.errorCode }})</span>
          </div>
          <div class="spm-load-error__url">{{ loadError.validatedURL }}</div>
          <p class="spm-load-error__hint">{{ loadError.hint }}</p>
          <div class="spm-load-error__actions">
            <button
              class="spm-icon-btn"
              aria-label="重试"
              @click="retryAfterError"
            >
              <SlidesIcon name="refresh" />
              <span>重试</span>
            </button>
            <button
              class="spm-icon-btn is-primary"
              aria-label="用系统浏览器打开"
              @click="openInSystemBrowser"
            >
              <SlidesIcon name="external-link" />
              <span>用系统浏览器打开 ↗</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// 纯函数工具抽离至 peek-webview-utils（RF-030），此处 re-export 保持既有 import 路径兼容
export type { TViewMode, IPeekLoadError } from './peek-webview-utils'
export {
  MOBILE_USER_AGENT,
  STORAGE_KEY_VIEW_MODE,
  getInitialViewMode,
  saveViewMode,
  describePeekNetError,
} from './peek-webview-utils'
</script>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import { isDesktopEnvironment, isRemoteKernelHost, openUrlInSystemBrowser } from '@/engine/runtime-node'
import { resolvePeekUrl } from '@/utils/peek-url'
import { useWebviewPeekControls } from '@/ui/components/peek/useWebviewPeekControls'
import { MOBILE_USER_AGENT, getInitialViewMode, saveViewMode, describePeekNetError } from '@/ui/components/peek/peek-webview-utils'
import type { TViewMode, IPeekLoadError } from '@/ui/components/peek/peek-webview-utils'

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

// 远程内核模式下宿主主窗体禁用 webviewTag 并拦截 will-attach-webview，<webview> 元素完全失效，
// 必须降级走 iframe 分支，否则抽屉恒为空白
const isDesktop = ref(isDesktopEnvironment() && !isRemoteKernelHost())
const currentUrl = ref(props.url)
const urlInputValue = ref(props.url)
// webview 的 src 属性只在挂载时取一次初始值，此后永不回写（见模板中「注意 2」）：
// currentUrl 会随 did-navigate / did-navigate-in-page 持续更新为 webview 的实时地址，
// 若把 :src 绑到它上面，SPA 站点页内路由（pushState）会经由 Vue 改写 src 属性，
// 触发 Electron 强制 loadURL() 整页重载，把已渲染的路由页顶成托管站的 404 页。
// 因此 currentUrl / urlInputValue 在桌面端仅作地址栏展示，导航一律走 loadURL()。
const initialUrl = props.url
const isLoading = ref(false)
const loadError = ref<IPeekLoadError | null>(null)
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

// 缩放状态机与导航控制抽离（RF-030）：状态与委托由 useWebviewPeekControls 提供
const {
  zoomFactor,
  applyZoomFactor,
  zoomIn,
  zoomOut,
  resetZoom,
  onCtrlWheel,
  canGoBack,
  canGoForward,
  updateNavState,
  goBack,
  goForward,
  reload,
} = useWebviewPeekControls({ getWebview: () => webviewRef.value })

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
  // 加载失败诊断：常规失败走 did-fail-load，证书/代理等提交前失败走 did-fail-provisional-load
  wv.addEventListener('did-fail-load', onDidFailLoad)
  wv.addEventListener('did-fail-provisional-load', onDidFailLoad)
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
    wv.removeEventListener('did-fail-load', onDidFailLoad)
    wv.removeEventListener('did-fail-provisional-load', onDidFailLoad)
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
  loadError.value = null
}

/**
 * 加载失败处理：区分主框架与子资源失败，忽略主动打断（ERR_ABORTED = -3）
 */
function onDidFailLoad(e: any) {
  if (e && e.isMainFrame === false) return
  if (e && Number(e.errorCode) === -3) return

  const description = String(e?.errorDescription || 'ERR_FAILED')
  loadError.value = {
    errorCode: Number(e?.errorCode ?? 0),
    description,
    validatedURL: String(e?.validatedURL || currentUrl.value),
    hint: describePeekNetError(description),
  }
  isLoading.value = false
}

function retryAfterError() {
  loadError.value = null
  reload()
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

function navigateToUrl() {
  const resolution = resolvePeekUrl(urlInputValue.value)
  if (!resolution.url) return

  // 工作区之外的本地文件无法在微型浏览器内加载，就地外跳系统浏览器
  if (resolution.external) {
    currentUrl.value = resolution.url
    openInSystemBrowser()
    return
  }

  currentUrl.value = resolution.url
  urlInputValue.value = resolution.url
  if (webviewRef.value && typeof webviewRef.value.loadURL === 'function') {
    webviewRef.value.loadURL(resolution.url)
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
  openUrlInSystemBrowser(targetUrl)
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

.spm-load-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  background: var(--b3-theme-background, #ffffff);

  &__icon {
    width: 32px;
    height: 32px;
    color: var(--b3-theme-error, #ef4444);
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-background, #1e293b);
  }

  &__code {
    font-size: 12px;
    font-family: var(--b3-font-family-code, monospace);
    color: var(--b3-theme-error, #ef4444);
    word-break: break-all;
  }

  &__code-num {
    color: var(--b3-theme-on-surface, #64748b);
  }

  &__url {
    max-width: 100%;
    font-size: 11px;
    color: var(--b3-theme-on-surface, #94a3b8);
    word-break: break-all;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__hint {
    max-width: 420px;
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--b3-theme-on-surface, #475569);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
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
