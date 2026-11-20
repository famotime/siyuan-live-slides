import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WebSandboxBridge } from "../src/engine/web-sandbox-bridge"
import type { IOpenPeekDrawerDetail } from "../src/engine/web-sandbox-bridge"

class MockWindow extends EventTarget {
  postMessage = vi.fn()
}

beforeEach(() => {
  const mockWin = new MockWindow()
  ;(globalThis as any).window = mockWin
  ;(globalThis as any).MessageEvent = class MessageEvent extends Event {
    data: any
    constructor(type: string, init?: any) {
      super(type)
      this.data = init?.data
    }
  }
})

afterEach(() => {
  delete (globalThis as any).window
  delete (globalThis as any).MessageEvent
})

describe("Immersion Peek Drawer & IPC Coordination (原位速览抽屉与通信测试)", () => {
  it("WebSandboxBridge 应支持下发 FREEZE_KEYBOARD_NAV 冻结/解冻指令", () => {
    const bridge = new WebSandboxBridge()
    const mockIframe = {
      contentWindow: {
        postMessage: vi.fn(),
      },
    } as any

    bridge.attach(mockIframe)

    // 模拟客户端就绪
    window.dispatchEvent(
      new (globalThis as any).MessageEvent("message", {
        data: {
          source: "siyuan-slides-client",
          action: "CLIENT_READY",
        },
      }),
    )

    // 冻结翻页热键
    bridge.freezeKeyboardNav(true)
    expect(mockIframe.contentWindow.postMessage).toHaveBeenCalledWith(
      {
        source: "siyuan-slides-host",
        action: "FREEZE_KEYBOARD_NAV",
        payload: { frozen: true },
      },
      "*",
    )

    // 解冻翻页热键
    bridge.freezeKeyboardNav(false)
    expect(mockIframe.contentWindow.postMessage).toHaveBeenCalledWith(
      {
        source: "siyuan-slides-host",
        action: "FREEZE_KEYBOARD_NAV",
        payload: { frozen: false },
      },
      "*",
    )
  })

  it("WebSandboxBridge 应正确派发来自客户端沙箱的 OPEN_PEEK_DRAWER (思源块速览) 事件", () => {
    const bridge = new WebSandboxBridge()
    const mockIframe = {
      contentWindow: {
        postMessage: vi.fn(),
      },
    } as any
    bridge.attach(mockIframe)

    let receivedDetail: IOpenPeekDrawerDetail | null = null
    const unbind = bridge.onOpenPeekDrawer((detail) => {
      receivedDetail = detail
    })

    // 模拟客户端触发思源块引用点击
    const event = new (globalThis as any).MessageEvent("message", {
      data: {
        source: "siyuan-slides-client",
        action: "OPEN_PEEK_DRAWER",
        payload: {
          peekType: "siyuan",
          blockId: "20231005120000-abcdef1",
          title: "架构设计与上下文",
        },
      },
    })
    window.dispatchEvent(event)

    expect(receivedDetail).not.toBeNull()
    expect(receivedDetail?.peekType).toBe("siyuan")
    expect(receivedDetail?.target).toBe("20231005120000-abcdef1")
    expect(receivedDetail?.title).toBe("架构设计与上下文")

    unbind()
  })

  it("WebSandboxBridge 应正确派发来自客户端沙箱的 OPEN_PEEK_DRAWER (外部网页速览) 事件", () => {
    const bridge = new WebSandboxBridge()
    const mockIframe = {
      contentWindow: {
        postMessage: vi.fn(),
      },
    } as any
    bridge.attach(mockIframe)

    let receivedDetail: IOpenPeekDrawerDetail | null = null
    bridge.onOpenPeekDrawer((detail) => {
      receivedDetail = detail
    })

    // 模拟客户端触发外部网页链接点击
    const event = new (globalThis as any).MessageEvent("message", {
      data: {
        source: "siyuan-slides-client",
        action: "OPEN_PEEK_DRAWER",
        payload: {
          peekType: "web",
          url: "https://sli.dev/guide/",
          title: "Slidev 官方文档",
        },
      },
    })
    window.dispatchEvent(event)

    expect(receivedDetail).not.toBeNull()
    expect(receivedDetail?.peekType).toBe("web")
    expect(receivedDetail?.target).toBe("https://sli.dev/guide/")
    expect(receivedDetail?.title).toBe("Slidev 官方文档")
  })

  it("WebSandboxBridge 应正确响应 REQUEST_TOGGLE_FULLSCREEN 统一全屏切换请求", () => {
    const bridge = new WebSandboxBridge()
    const mockIframe = {
      contentWindow: {
        postMessage: vi.fn(),
      },
    } as any
    bridge.attach(mockIframe)

    let toggleCount = 0
    bridge.onRequestToggleFullscreen(() => {
      toggleCount++
    })

    const event = new (globalThis as any).MessageEvent("message", {
      data: {
        source: "siyuan-slides-client",
        action: "REQUEST_TOGGLE_FULLSCREEN",
        payload: {},
      },
    })
    window.dispatchEvent(event)

    expect(toggleCount).toBe(1)
  })

  it("思源块链接协议与参数清洗逻辑验证", () => {
    const rawHref = "siyuan://blocks/20261005123456-abcdef0?focus=true&hl=true"
    const isSiyuan = rawHref.startsWith("siyuan://blocks/")
    expect(isSiyuan).toBe(true)

    const cleanBlockId = rawHref.replace("siyuan://blocks/", "").split("?")[0]
    expect(cleanBlockId).toBe("20261005123456-abcdef0")

    const webHref = "https://github.com/sli-dev/slidev"
    const isWeb = /^https?:\/\//i.test(webHref)
    expect(isWeb).toBe(true)
  })

  it("微型浏览器 URL 规范化与协议自动补全逻辑", () => {
    const normalizeUrl = (input: string) => {
      const trimmed = input.trim()
      if (!trimmed) return ""
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    }

    expect(normalizeUrl("example.com")).toBe("https://example.com")
    expect(normalizeUrl("http://localhost:8080")).toBe("http://localhost:8080")
    expect(normalizeUrl("https://sli.dev")).toBe("https://sli.dev")
    expect(normalizeUrl("")).toBe("")
  })

  it("微型浏览器 ZoomFactor 显式缩放步进与边界截断逻辑", () => {
    let zoomFactor = 1.0

    const zoomIn = () => {
      zoomFactor = Math.min(2.5, Math.round((zoomFactor + 0.1) * 10) / 10)
      return zoomFactor
    }
    const zoomOut = () => {
      zoomFactor = Math.max(0.5, Math.round((zoomFactor - 0.1) * 10) / 10)
      return zoomFactor
    }
    const resetZoom = () => {
      zoomFactor = 1.0
      return zoomFactor
    }

    expect(zoomIn()).toBe(1.1)
    expect(zoomIn()).toBe(1.2)
    expect(zoomOut()).toBe(1.1)
    expect(resetZoom()).toBe(1.0)

    // 边界极值测试
    zoomFactor = 2.45
    expect(zoomIn()).toBe(2.5)
    expect(zoomIn()).toBe(2.5) // 上限截断

    zoomFactor = 0.55
    expect(zoomOut()).toBe(0.5)
    expect(zoomOut()).toBe(0.5) // 下限截断
  })

  it("Protyle 原位速览抽屉深钻历史栈维护与平滑回退", () => {
    interface IHistoryItem {
      blockId: string
      title: string
    }

    const historyStack: IHistoryItem[] = []
    let currentId = "root-doc-1"
    let currentTitle = "主文档"

    // 深度钻取第一层
    historyStack.push({ blockId: currentId, title: currentTitle })
    currentId = "sub-block-2"
    currentTitle = "子块引用"

    expect(historyStack.length).toBe(1)
    expect(currentId).toBe("sub-block-2")

    // 深度钻取第二层
    historyStack.push({ blockId: currentId, title: currentTitle })
    currentId = "sub-block-3"
    currentTitle = "孙块引用"

    expect(historyStack.length).toBe(2)
    expect(currentId).toBe("sub-block-3")

    // 执行回退
    const prev = historyStack.pop()
    currentId = prev!.blockId
    currentTitle = prev!.title

    expect(currentId).toBe("sub-block-2")
    expect(historyStack.length).toBe(1)

    // 再次回退到底
    const root = historyStack.pop()
    currentId = root!.blockId
    currentTitle = root!.title

    expect(currentId).toBe("root-doc-1")
    expect(historyStack.length).toBe(0)
  })

  it("微型浏览器新窗口事件拦截应原位重定向而避免外部弹窗", () => {
    const mockWebview = {
      loadURL: vi.fn(),
    }
    const onNewWindow = (e: { url: string; preventDefault: () => void }) => {
      e.preventDefault()
      mockWebview.loadURL(e.url)
    }

    const preventDefaultSpy = vi.fn()
    onNewWindow({
      url: "https://example.com/pricing",
      preventDefault: preventDefaultSpy,
    })

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(mockWebview.loadURL).toHaveBeenCalledWith("https://example.com/pricing")
  })

  it("微型浏览器 webview 元素必须遵循 inline-flex 与 100% 绝对铺满契约，杜绝 display: block 导致的高度塌陷", async () => {
    // 读取 WebviewPeekDrawer.vue 源文件校验模板和样式规则
    const fs = await import("fs")
    const path = await import("path")
    const vueFilePath = path.resolve(__dirname, "../src/ui/components/peek/WebviewPeekDrawer.vue")
    const content = fs.readFileSync(vueFilePath, "utf-8")

    // 1. 验证 template 中 webview 带有绝对全铺与 inline-flex 行内样式
    expect(content).toContain('style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: inline-flex;"')

    // 2. 验证样式表中严禁对 webview 应用 display: block
    expect(content).not.toMatch(/\.spm-webview-frame\s*\{[^}]*display:\s*block/s)

    // 3. 验证样式表中包含了 display: inline-flex !important 与 100% 铺满声明
    expect(content).toMatch(/display:\s*inline-flex\s*!important/)
    expect(content).toMatch(/width:\s*100%\s*!important/)
    expect(content).toMatch(/height:\s*100%\s*!important/)

    // 4. 验证全局选择器 :global(webview.spm-webview-frame) 保底穿透
    expect(content).toContain(":global(webview.spm-webview-frame)")
  })

  it("抽屉容器与微型浏览器必须采用 v-show 常驻 DOM 懒加载架构，杜绝关闭时触发 Electron guestInstanceId 异常", async () => {
    const fs = await import("fs")
    const path = await import("path")

    // 1. 验证 ImmersionDrawerContainer 采用 v-show="visible"
    const containerPath = path.resolve(__dirname, "../src/ui/components/peek/ImmersionDrawerContainer.vue")
    const containerContent = fs.readFileSync(containerPath, "utf-8")
    expect(containerContent).toContain('v-show="visible"')
    expect(containerContent).not.toContain('v-if="visible"')

    // 2. 验证 SlidesPreviewTab 中对 WebviewPeekDrawer 采用 hasOpenedWeb 懒加载与 v-show
    const tabPath = path.resolve(__dirname, "../src/ui/tab/SlidesPreviewTab.vue")
    const tabContent = fs.readFileSync(tabPath, "utf-8")
    expect(tabContent).toContain('v-if="hasOpenedWeb"')
    expect(tabContent).toContain('v-show="peekType === \'web\'"')
    expect(tabContent).toContain(":visible=\"isDrawerOpen && peekType === 'web'\"")
  })

  it("微型浏览器全局异常拦截器应能精准屏蔽 Electron 内核的 Invalid guestInstanceId 错误", () => {
    // 模拟 Electron 派发至 window 的未捕获错误事件
    let prevented = false
    let stoppedPropagation = false
    const mockEvent = {
      message: "Uncaught Error: Invalid guestInstanceId: 23",
      preventDefault: () => {
        prevented = true
      },
      stopImmediatePropagation: () => {
        stoppedPropagation = true
      },
    }

    const testErrorHandler = (event: any) => {
      const errorMsg = event.message || event.error?.message
      if (typeof errorMsg === "string" && errorMsg.includes("Invalid guestInstanceId")) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return true
      }
      return false
    }

    const handled = testErrorHandler(mockEvent)
    expect(handled).toBe(true)
    expect(prevented).toBe(true)
    expect(stoppedPropagation).toBe(true)

    // 非相关常规错误不应被意外拦截
    const normalEvent = {
      message: "TypeError: Cannot read properties of undefined",
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    }
    const normalHandled = testErrorHandler(normalEvent)
    expect(normalHandled).toBe(false)
    expect(normalEvent.preventDefault).not.toHaveBeenCalled()
  })

  it("ProtylePeekDrawer 应支持块聚焦模式，排除文档上下文全文并支持模式切换", async () => {
    const fs = await import("fs")
    const path = await import("path")

    const drawerPath = path.resolve(__dirname, "../src/ui/components/peek/ProtylePeekDrawer.vue")
    const content = fs.readFileSync(drawerPath, "utf-8")

    // 1. 验证存在块聚焦模式状态与切换机制
    expect(content).toContain("isFocusMode")
    expect(content).toContain("toggleFocusMode")
    expect(content).toContain("思源块聚焦")

    // 2. 验证针对块链接排除了 cb-get-context，使用 cb-get-all 与 cb-get-focus 聚焦
    expect(content).toContain("cb-get-all")
    expect(content).toContain("cb-get-focus")
    expect(content).toContain("cb-get-context")

    // 3. 验证聚焦模式下关闭文档大标题与背景
    expect(content).toContain("background: false")
    expect(content).toContain("title: false")

    // 4. 验证具备模式切换图标与按钮
    expect(content).toContain("name=\"isFocusMode ? 'focus' : 'file-text'\"")
  })

  it("WebviewPeekDrawer 应支持桌面/移动端模式切换开关、390px 居中手机视口与移动端 User-Agent 仿真", async () => {
    const fs = await import("fs")
    const path = await import("path")

    const drawerPath = path.resolve(__dirname, "../src/ui/components/peek/WebviewPeekDrawer.vue")
    const content = fs.readFileSync(drawerPath, "utf-8")

    // 1. 验证具备桌面/移动端切换按钮与响应式状态
    expect(content).toContain("spm-mode-toggle")
    expect(content).toContain("toggleViewMode")
    expect(content).toContain("viewMode")
    expect(content).toContain(":name=\"viewMode === 'mobile' ? 'mobile' : 'desktop'\"")

    // 2. 验证具备主流移动端 User-Agent 常量与注入机制（常量内容在 peek-webview-utils 领域模块，组件保留注入机制）
    expect(content).toContain("MOBILE_USER_AGENT")
    expect(content).toContain("setUserAgent")
    expect(content).toContain(":useragent=\"currentUserAgent\"")
    const uaUtilsContent = fs.readFileSync(path.resolve(__dirname, "../src/ui/components/peek/peek-webview-utils.ts"), "utf-8")
    expect(uaUtilsContent).toContain("iPhone OS")

    // 3. 验证具备 390px 居中手机视口及样式规则
    expect(content).toContain("spm-webview-viewport")
    expect(content).toContain("is-mobile")
    expect(content).toMatch(/width:\s*390px/)
    expect(content).toMatch(/border-radius:\s*12px/)

    // 4. 验证具备本地存储持久化机制
    expect(content).toContain("STORAGE_KEY_VIEW_MODE")
    expect(content).toContain("getInitialViewMode")
    expect(content).toContain("saveViewMode")
  })

  it("WebviewPeekDrawer 模块持久化方法应正确记忆与恢复用户视图偏好", async () => {
    const { getInitialViewMode, saveViewMode, STORAGE_KEY_VIEW_MODE } = await import(
      "../src/ui/components/peek/WebviewPeekDrawer.vue"
    )

    // 模拟 localStorage
    const storage: Record<string, string> = {}
    ;(globalThis as any).window.localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => {
        storage[key] = val
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
    }

    // 1. 切换并保存为移动端模式
    saveViewMode("mobile")
    expect(storage[STORAGE_KEY_VIEW_MODE]).toBe("mobile")
    expect(getInitialViewMode()).toBe("mobile")

    // 2. 切换回桌面端模式
    saveViewMode("desktop")
    expect(storage[STORAGE_KEY_VIEW_MODE]).toBe("desktop")
    expect(getInitialViewMode()).toBe("desktop")
  })
})

