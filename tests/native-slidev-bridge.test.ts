import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NativeSlidevBridge } from "../src/engine/native-slidev-bridge"

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

describe("NativeSlidevBridge (官方标准通信适配桥接器)", () => {
  it("navigateToPage 应发送遵循 Slidev 规范的 postMessage", () => {
    const bridge = new NativeSlidevBridge()
    const mockPostMessage = vi.fn()
    const mockIframe = {
      contentWindow: { postMessage: mockPostMessage },
    } as unknown as HTMLIFrameElement

    bridge.attach(mockIframe)
    bridge.navigateToPage(3)

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "slidev",
        sender: "siyuan",
        type: "navigate",
        no: 3,
      }),
      "*",
    )

    bridge.detach()
  })

  it("应正确接收并分发来自 Slidev 的 update-state 消息", () => {
    const bridge = new NativeSlidevBridge()
    const pageHandler = vi.fn()
    bridge.onPageChanged(pageHandler)

    bridge.attach({} as HTMLIFrameElement)

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          target: "slidev",
          type: "update-state",
          navState: {
            no: 2,
            clicks: 1,
            total: 5,
            hasNext: true,
            hasPrev: true,
          },
        },
      }),
    )

    expect(pageHandler).toHaveBeenCalledWith(
      2,
      5,
      expect.objectContaining({ no: 2, clicks: 1, total: 5 }),
    )
    expect(bridge.getCurrentState().clicks).toBe(1)

    bridge.detach()
  })
})
