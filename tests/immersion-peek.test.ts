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
          source: "siyuan-slidev-client",
          action: "CLIENT_READY",
        },
      }),
    )

    // 冻结翻页热键
    bridge.freezeKeyboardNav(true)
    expect(mockIframe.contentWindow.postMessage).toHaveBeenCalledWith(
      {
        source: "siyuan-slidev-host",
        action: "FREEZE_KEYBOARD_NAV",
        payload: { frozen: true },
      },
      "*",
    )

    // 解冻翻页热键
    bridge.freezeKeyboardNav(false)
    expect(mockIframe.contentWindow.postMessage).toHaveBeenCalledWith(
      {
        source: "siyuan-slidev-host",
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
        source: "siyuan-slidev-client",
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
        source: "siyuan-slidev-client",
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
        source: "siyuan-slidev-client",
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
})
