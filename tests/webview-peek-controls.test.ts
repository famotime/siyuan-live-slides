import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { useWebviewPeekControls } from "../src/ui/components/peek/useWebviewPeekControls"
import {
  getInitialViewMode,
  saveViewMode,
  describePeekNetError,
  STORAGE_KEY_VIEW_MODE,
  MOBILE_USER_AGENT,
} from "../src/ui/components/peek/peek-webview-utils"

/**
 * useWebviewPeekControls 与 peek-webview-utils 领域测试
 *
 * 覆盖：缩放状态机（步进/上下限/滚轮驱动/应用回写）、导航状态（前进后退刷新委托）、
 * 视图模式持久化记忆与容错、Chromium 网络错误中文排查提示映射。
 */

function createWebviewStub(overrides: Partial<Record<string, any>> = {}) {
  const calls: string[] = []
  return {
    calls,
    webview: {
      setZoomFactor: vi.fn(() => calls.push("setZoomFactor")),
      canGoBack: vi.fn(() => false),
      canGoForward: vi.fn(() => false),
      goBack: vi.fn(() => calls.push("goBack")),
      goForward: vi.fn(() => calls.push("goForward")),
      reload: vi.fn(() => calls.push("reload")),
      ...overrides,
    },
  }
}

describe("useWebviewPeekControls (Peek 微型浏览器控制解耦)", () => {
  describe("缩放状态机", () => {
    it("初始缩放为 1.0，zoomIn/zoomOut 按 0.1 步进并回写 webview", () => {
      const { webview } = createWebviewStub()
      const controls = useWebviewPeekControls({ getWebview: () => webview })
      expect(controls.zoomFactor.value).toBe(1.0)
      controls.zoomIn()
      expect(controls.zoomFactor.value).toBe(1.1)
      expect(webview.setZoomFactor).toHaveBeenLastCalledWith(1.1)
      controls.zoomOut()
      expect(controls.zoomFactor.value).toBe(1.0)
    })

    it("缩放上限 2.5、下限 0.5", () => {
      const { webview } = createWebviewStub()
      const controls = useWebviewPeekControls({ getWebview: () => webview })
      for (let i = 0; i < 20; i++) controls.zoomIn()
      expect(controls.zoomFactor.value).toBe(2.5)
      for (let i = 0; i < 30; i++) controls.zoomOut()
      expect(controls.zoomFactor.value).toBe(0.5)
    })

    it("resetZoom 应恢复 1.0 并回写", () => {
      const { webview } = createWebviewStub()
      const controls = useWebviewPeekControls({ getWebview: () => webview })
      controls.zoomIn()
      controls.resetZoom()
      expect(controls.zoomFactor.value).toBe(1.0)
      expect(webview.setZoomFactor).toHaveBeenLastCalledWith(1.0)
    })

    it("onCtrlWheel 上滚放大、下滚缩小且阻止默认行为", () => {
      const { webview } = createWebviewStub()
      const controls = useWebviewPeekControls({ getWebview: () => webview })
      controls.onCtrlWheel({ deltaY: -120, preventDefault: vi.fn() } as any)
      expect(controls.zoomFactor.value).toBe(1.1)
      controls.onCtrlWheel({ deltaY: 120, preventDefault: vi.fn() } as any)
      expect(controls.zoomFactor.value).toBe(1.0)
      controls.onCtrlWheel({ deltaY: 0, preventDefault: vi.fn() } as any)
      expect(controls.zoomFactor.value).toBe(1.0)
    })

    it("webview 不支持 setZoomFactor 时不应抛错", () => {
      const controls = useWebviewPeekControls({ getWebview: () => ({}) })
      expect(() => controls.applyZoomFactor()).not.toThrow()
      const none = useWebviewPeekControls({ getWebview: () => null })
      expect(() => none.applyZoomFactor()).not.toThrow()
    })
  })

  describe("导航状态", () => {
    it("updateNavState 应同步 canGoBack/canGoForward", () => {
      const { webview } = createWebviewStub({ canGoBack: vi.fn(() => true), canGoForward: vi.fn(() => true) })
      const controls = useWebviewPeekControls({ getWebview: () => webview })
      controls.updateNavState()
      expect(controls.canGoBack.value).toBe(true)
      expect(controls.canGoForward.value).toBe(true)
    })

    it("goBack/goForward/reload 应委托至 webview 对应方法", () => {
      const { calls, webview } = createWebviewStub()
      const controls = useWebviewPeekControls({ getWebview: () => webview })
      controls.goBack()
      controls.goForward()
      controls.reload()
      expect(calls).toEqual(["goBack", "goForward", "reload"])
    })

    it("webview 缺失或方法不存在时应静默跳过", () => {
      const controls = useWebviewPeekControls({ getWebview: () => null })
      expect(() => { controls.goBack(); controls.goForward(); controls.reload(); controls.updateNavState() }).not.toThrow()
      const bare = useWebviewPeekControls({ getWebview: () => ({}) })
      expect(() => { bare.goBack(); bare.reload(); bare.updateNavState() }).not.toThrow()
    })
  })
})

describe("peek-webview-utils (视图模式持久化与网络错误文案)", () => {
  const originalStorage = globalThis.window

  beforeEach(() => {
    const storage = new Map<string, string>()
    ;(globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
      },
    }
  })

  afterEach(() => {
    if (originalStorage === undefined) {
      delete (globalThis as any).window
    } else {
      ;(globalThis as any).window = originalStorage
    }
  })

  it("视图模式默认 desktop，保存后可恢复记忆", () => {
    expect(getInitialViewMode()).toBe("desktop")
    saveViewMode("mobile")
    expect(getInitialViewMode()).toBe("mobile")
    saveViewMode("desktop")
    expect(getInitialViewMode()).toBe("desktop")
  })

  it("持久化键名应为 siyuan-slides-peek-view-mode，移动 UA 为 iOS Safari", () => {
    expect(STORAGE_KEY_VIEW_MODE).toBe("siyuan-slides-peek-view-mode")
    expect(MOBILE_USER_AGENT).toContain("iPhone")
    expect(MOBILE_USER_AGENT).toContain("Mobile")
  })

  it("describePeekNetError 应将代理/解析/证书类错误映射为可操作中文提示", () => {
    expect(describePeekNetError("ERR_PROXY_CONNECTION_FAILED")).toContain("代理服务器")
    expect(describePeekNetError("err_name_not_resolved")).toContain("域名解析失败")
    expect(describePeekNetError("ERR_CERT_AUTHORITY_INVALID")).toContain("证书校验失败")
    expect(describePeekNetError("ERR_CONNECTION_REFUSED")).toContain("连接被拒绝")
  })

  it("未覆盖错误码应回退到内网代理排查提示，不做臆测", () => {
    expect(describePeekNetError("ERR_UNKNOWN_CODE")).toContain("网络代理")
    expect(describePeekNetError("")).toContain("网络代理")
  })
})
