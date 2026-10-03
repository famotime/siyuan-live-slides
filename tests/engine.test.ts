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
  it("默认模式应为 web-sandbox，并支持切换与优雅停止", () => {
    const manager = new EngineManager()
    expect(manager.getMode()).toBe("web-sandbox")

    manager.setMode("pro-cli")
    expect(manager.getMode()).toBe("pro-cli")

    manager.stopProMode()
    expect(manager.getMode()).toBe("web-sandbox")

    manager.destroy()
  })
})

describe("CliDevServerBridge (Slidev 标准 Markdown 构建与同步)", () => {
  const sampleDoc = {
    docId: "doc-cli-1",
    config: {
      theme: "seriph",
      aspectRatio: "16/9",
      highlighter: "shiki",
      defaultTransition: "slide-left",
      colorSchema: "dark",
    },
    fullMarkdown: "",
    slides: [
      {
        pageIndex: 1,
        startBlockId: "p1",
        frontmatter: { layout: "cover" },
        notes: "演讲者首演备注",
        blocks: [
          { id: "b1", type: "h", content: "Slidev 演示主题", rawMarkdown: "# Slidev 演示主题" },
        ],
        rawMarkdown: "",
      },
      {
        pageIndex: 2,
        startBlockId: "p2",
        frontmatter: { layout: "two-cols", transition: "fade" },
        notes: "双栏讲解备忘",
        blocks: [
          { id: "b2", type: "p", content: "左栏内容", rawMarkdown: "左栏内容" },
          { id: "b3", type: "p", content: "右栏内容", rawMarkdown: "右栏内容", slot: "right" },
        ],
        rawMarkdown: "",
      },
    ],
  } as any

  it("应生成符合 Slidev 官方规范的标准 slides.md", () => {
    const manager = new EngineManager()
    const md = manager.cliBridge.buildStandardSlidevMarkdown(sampleDoc)

    expect(md).toContain("theme: seriph")
    expect(md).toContain('aspectRatio: "16/9"')
    expect(md).toContain("colorSchema: dark")
    expect(md).toContain("# Slidev 演示主题")
    expect(md).toContain("<!--\n演讲者首演备注\n-->")
    expect(md).toContain("---\nlayout: two-cols\ntransition: fade\n---")
    expect(md).toContain("::right::")
    expect(md).toContain("<!--\n双栏讲解备忘\n-->")
  })

  it("应成功调用 putFileFn 将 slides.md 写入目标路径", async () => {
    const manager = new EngineManager()
    const mockPutFile = vi.fn().mockResolvedValue({ code: 0 })

    const result = await manager.cliBridge.syncToWorkspaceFile(
      sampleDoc,
      "/data/storage/petal/siyuan-slidev/slides.md",
      mockPutFile,
    )

    expect(result.success).toBe(true)
    expect(result.path).toBe("/data/storage/petal/siyuan-slidev/slides.md")
    expect(mockPutFile).toHaveBeenCalledTimes(1)
    expect(manager.cliBridge.getLastSyncTime()).toBeTypeOf("number")
  })
})

