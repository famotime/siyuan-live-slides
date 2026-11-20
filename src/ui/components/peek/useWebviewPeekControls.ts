/**
 * Peek 微型浏览器控制领域逻辑（自 WebviewPeekDrawer 抽离）
 *
 * 职责：缩放状态机（0.5~2.5 步进 0.1、滚轮驱动、应用回写）与
 * 导航状态（canGoBack/canGoForward 同步、前进/后退/刷新委托）。
 * webview 实例以 getter 注入，全部方法对缺失实例与方法安全降级。
 */

import { ref } from 'vue'

/** 微型浏览器控制的宿主上下文（webview 实例延迟获取） */
export interface IWebviewPeekControlsOptions {
  getWebview: () => any | null
}

/** 缩放边界与步进 */
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.5
const ZOOM_STEP = 0.1

export function useWebviewPeekControls(options: IWebviewPeekControlsOptions) {
  const { getWebview } = options

  const zoomFactor = ref(1.0)
  const canGoBack = ref(false)
  const canGoForward = ref(false)

  function applyZoomFactor() {
    const wv = getWebview()
    if (wv && typeof wv.setZoomFactor === 'function') {
      try {
        wv.setZoomFactor(zoomFactor.value)
      } catch (e) {
        console.warn('[WebviewPeekDrawer] setZoomFactor error:', e)
      }
    }
  }

  function zoomIn() {
    zoomFactor.value = Math.min(ZOOM_MAX, Math.round((zoomFactor.value + ZOOM_STEP) * 10) / 10)
    applyZoomFactor()
  }

  function zoomOut() {
    zoomFactor.value = Math.max(ZOOM_MIN, Math.round((zoomFactor.value - ZOOM_STEP) * 10) / 10)
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

  function updateNavState() {
    const wv = getWebview()
    if (!wv) return
    if (typeof wv.canGoBack === 'function') {
      canGoBack.value = wv.canGoBack()
    }
    if (typeof wv.canGoForward === 'function') {
      canGoForward.value = wv.canGoForward()
    }
  }

  function goBack() {
    const wv = getWebview()
    if (wv && typeof wv.goBack === 'function') {
      wv.goBack()
    }
  }

  function goForward() {
    const wv = getWebview()
    if (wv && typeof wv.goForward === 'function') {
      wv.goForward()
    }
  }

  function reload() {
    const wv = getWebview()
    if (wv && typeof wv.reload === 'function') {
      wv.reload()
    }
  }

  return {
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
  }
}
