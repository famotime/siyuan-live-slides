import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WebSandboxBridge } from "../src/engine/web-sandbox-bridge"
import type {
  ISlidevDocument,
  IActiveBlockInfo,
} from "../src/types/slidev-protocol"

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

describe("Preview & Inspector Protocol & State Coordination", () => {
  it("应支持对当前激活块元信息进行类型推断与属性提取", () => {
    const blockInfo: IActiveBlockInfo = {
      id: "block-item-1",
      rootId: "doc-123",
      type: "NodeParagraph",
      content: "测试段落内容",
      attrs: {
        "custom-slidev-click": "+1",
        "custom-slidev-slot": "left",
      },
      isDivider: false,
      isCode: false,
    }

    expect(blockInfo.id).toBe("block-item-1")
    expect(blockInfo.attrs["custom-slidev-click"]).toBe("+1")
    expect(blockInfo.attrs["custom-slidev-slot"]).toBe("left")
    expect(blockInfo.isDivider).toBe(false)
  })

  it("WebSandboxBridge 状态桥接器应正确缓存并向沙箱投递更新", () => {
    const bridge = new WebSandboxBridge()
    const mockDoc: ISlidevDocument = {
      docId: "doc-123",
      config: {
        theme: "default",
        aspectRatio: "16/9",
        highlighter: "shiki",
        defaultTransition: "slide-left",
        colorSchema: "auto",
      },
      slides: [
        {
          pageIndex: 1,
          startBlockId: "block-1",
          frontmatter: { layout: "cover" },
          notes: "Speaker note",
          blocks: [],
          rawMarkdown: "# Slide 1",
        },
      ],
      fullMarkdown: "# Slide 1",
    }

    const mockPostMessage = vi.fn()
    const mockIframe = {
      contentWindow: {
        postMessage: mockPostMessage,
      },
    } as any

    bridge.attach(mockIframe)

    // 发送 slides 更新
    bridge.updateSlides(mockDoc.slides, mockDoc.config, mockDoc.fullMarkdown)

    // 此时客户端尚未 ready，应处于排队状态
    expect(mockPostMessage).not.toHaveBeenCalled()

    // 模拟客户端就绪
    window.dispatchEvent(
      new (globalThis as any).MessageEvent("message", {
        data: {
          source: "siyuan-slidev-client",
          action: "CLIENT_READY",
        },
      }),
    )

    // 冲刷队列
    expect(mockPostMessage).toHaveBeenCalled()
    const sentMsg = mockPostMessage.mock.calls[0][0]
    expect(sentMsg.action).toBe("UPDATE_SLIDES")
    expect(sentMsg.payload.slides).toHaveLength(1)

    bridge.detach()
  })

  it("分屏预览模式下 Pin 图钉锁定逻辑判定", () => {
    let isPinned = false
    let pinnedDocId = ""

    function updatePreview(docId: string) {
      if (isPinned && pinnedDocId && docId !== pinnedDocId) {
        return false // 忽略更新
      }
      return true // 执行更新
    }

    // 未锁定状态：跟随任意文档
    expect(updatePreview("doc-A")).toBe(true)
    expect(updatePreview("doc-B")).toBe(true)

    // 锁定在 doc-A
    isPinned = true
    pinnedDocId = "doc-A"

    // 切换到 doc-B 时被拦截
    expect(updatePreview("doc-B")).toBe(false)
    // 自身 doc-A 更新时正常放行
    expect(updatePreview("doc-A")).toBe(true)

    // 解锁后恢复自由跟随
    isPinned = false
    expect(updatePreview("doc-B")).toBe(true)
  })
})
