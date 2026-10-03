import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EngineManager } from "../src/engine/engine-manager"
import { WebSandboxBridge } from "../src/engine/web-sandbox-bridge"

// 模拟浏览器全局 window 环境
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

describe("WebSandboxBridge (沙箱通信管道)", () => {
  it("应该正确初始化并在未就绪时缓存消息队列", () => {
    const bridge = new WebSandboxBridge()
    const mockPostMessage = vi.fn()
    const mockIframe = {
      contentWindow: {
        postMessage: mockPostMessage,
      },
    } as unknown as HTMLIFrameElement

    bridge.attach(mockIframe)

    // 发送消息（此时尚未收到 CLIENT_READY，因此进入 pending 队列）
    bridge.navigatePage(2)
    expect(mockPostMessage).not.toHaveBeenCalled()

    // 模拟沙箱发送 CLIENT_READY
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: "siyuan-slidev-client",
          action: "CLIENT_READY",
          payload: {},
        },
      }),
    )

    // 应该自动冲刷队列，发出之前的 navigatePage
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "siyuan-slidev-host",
        action: "NAVIGATE_PAGE",
        payload: { pageIndex: 2 },
      }),
      "*",
    )

    bridge.detach()
  })

  it("就绪后应立即发送 updateSlides 消息", () => {
    const bridge = new WebSandboxBridge()
    const mockPostMessage = vi.fn()
    const mockIframe = {
      contentWindow: {
        postMessage: mockPostMessage,
      },
    } as unknown as HTMLIFrameElement

    bridge.attach(mockIframe)

    // 触发就绪
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: "siyuan-slidev-client",
          action: "CLIENT_READY",
          payload: {},
        },
      }),
    )

    bridge.updateSlides([], { theme: "default", aspectRatio: "16/9", highlighter: "shiki", defaultTransition: "fade", colorSchema: "auto" })

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "siyuan-slidev-host",
        action: "UPDATE_SLIDES",
      }),
      "*",
    )

    bridge.detach()
  })

  it("应该正确分发 SLIDE_CHANGED 与 BLOCK_CLICKED 回调", () => {
    const bridge = new WebSandboxBridge()
    const slideHandler = vi.fn()
    const clickHandler = vi.fn()

    bridge.onSlideChanged(slideHandler)
    bridge.onBlockClicked(clickHandler)

    bridge.attach({} as HTMLIFrameElement)

    // 模拟沙箱发送 SLIDE_CHANGED
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: "siyuan-slidev-client",
          action: "SLIDE_CHANGED",
          payload: { currentPage: 3, totalPages: 5, currentBlockId: "block-99" },
        },
      }),
    )

    expect(slideHandler).toHaveBeenCalledWith(3, 5, "block-99")

    // 模拟沙箱发送 BLOCK_CLICKED
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: "siyuan-slidev-client",
          action: "BLOCK_CLICKED",
          payload: { clickedBlockId: "item-101", currentPage: 3 },
        },
      }),
    )

    expect(clickHandler).toHaveBeenCalledWith("item-101", 3)

    bridge.detach()
  })
})

describe("EngineManager (双模引擎调度器)", () => {
  it("默认模式应为 web-sandbox，并支持切换", () => {
    const manager = new EngineManager()
    expect(manager.getMode()).toBe("web-sandbox")

    manager.setMode("pro-cli")
    expect(manager.getMode()).toBe("pro-cli")

    manager.destroy()
  })
})
