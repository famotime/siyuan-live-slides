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
          source: "siyuan-slides-client",
          action: "CLIENT_READY",
          payload: {},
        },
      }),
    )

    // 应该自动冲刷队列，发出之前的 navigatePage
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "siyuan-slides-host",
        action: "NAVIGATE_PAGE",
        payload: { pageIndex: 2 },
      }),
      "*",
    )

    bridge.detach()
  })

  it("FSM-6 优化: 握手等待期高频 UPDATE_SLIDES 应执行 LWW 合并，就绪后仅冲刷最后一份", () => {
    const bridge = new WebSandboxBridge()
    const mockPostMessage = vi.fn()
    const mockIframe = {
      contentWindow: {
        postMessage: mockPostMessage,
      },
    } as unknown as HTMLIFrameElement

    bridge.attach(mockIframe)

    // 连续推送 3 次大文档更新
    bridge.updateSlides([], undefined, "# Version 1")
    bridge.updateSlides([], undefined, "# Version 2")
    bridge.updateSlides([], undefined, "# Version 3 (Final)")

    // 此时尚未就绪，不应触发 postMessage
    expect(mockPostMessage).not.toHaveBeenCalled()

    // 模拟客户端就绪握手
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: "siyuan-slides-client",
          action: "CLIENT_READY",
          payload: {},
        },
      }),
    )

    // 冲刷时仅向沙箱发送合并后的最新版本 1 次，杜绝连续多次重绘卡顿
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "siyuan-slides-host",
        action: "UPDATE_SLIDES",
        payload: expect.objectContaining({ fullMarkdown: "# Version 3 (Final)" }),
      }),
      "*",
    )

    bridge.detach()
  })

  it("toggleOverview 应发送 TOGGLE_OVERVIEW 消息切换缩略图总览", () => {
    const bridge = new WebSandboxBridge()
    const mockPostMessage = vi.fn()
    const mockIframe = {
      contentWindow: {
        postMessage: mockPostMessage,
      },
    } as unknown as HTMLIFrameElement

    bridge.attach(mockIframe)

    // 模拟沙箱就绪
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: "siyuan-slides-client",
          action: "CLIENT_READY",
          payload: {},
        },
      }),
    )

    bridge.toggleOverview()
    bridge.detach()

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "siyuan-slides-host",
        action: "TOGGLE_OVERVIEW",
        payload: {},
      }),
      "*",
    )
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
          source: "siyuan-slides-client",
          action: "CLIENT_READY",
          payload: {},
        },
      }),
    )

    bridge.updateSlides([], { theme: "default", aspectRatio: "16/9", highlighter: "shiki", defaultTransition: "fade", colorSchema: "auto" })

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "siyuan-slides-host",
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
          source: "siyuan-slides-client",
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
          source: "siyuan-slides-client",
          action: "BLOCK_CLICKED",
          payload: { clickedBlockId: "item-101", currentPage: 3 },
        },
      }),
    )

    expect(clickHandler).toHaveBeenCalledWith("item-101", 3)

    bridge.detach()
  })
})

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

  it("在环境具备时应成功执行 startProMode 并更新当前模式为 pro-cli", async () => {
    const manager = new EngineManager()
    vi.spyOn(manager.envDetector, "detect").mockResolvedValue({
      hasNode: true,
      hasSlidevCli: true,
      nodeVersion: "v22.18.0",
      slidevVersion: "53.0.0",
      platform: "win32",
      isDesktop: true,
    })
    vi.spyOn(manager.scaffolder, "scaffold").mockResolvedValue({
      success: true,
      slidesPath: "/data/storage/petal/siyuan-live-slides/pro-workspace/slides.md",
      packageJsonPath: "/data/storage/petal/siyuan-live-slides/pro-workspace/package.json",
    })
    vi.spyOn(manager.processManager, "startServer").mockResolvedValue({
      success: true,
      port: 3030,
      url: "http://localhost:3030?embedded=true",
    })

    const res = await manager.startProMode(sampleDoc)
    expect(res.success).toBe(true)
    expect(res.port).toBe(3030)
    expect(res.url).toContain("3030")
    expect(manager.getMode()).toBe("pro-cli")

    manager.stopProMode()
    expect(manager.getMode()).toBe("web-sandbox")
    manager.destroy()
  })

  it("在环境缺乏 Node 时应拦截并提示错误", async () => {
    const manager = new EngineManager()
    vi.spyOn(manager.envDetector, "detect").mockResolvedValue({
      hasNode: false,
      hasSlidevCli: false,
      platform: "browser",
      isDesktop: false,
    })

    const res = await manager.startProMode(sampleDoc)
    expect(res.success).toBe(false)
    expect(res.error).toContain("未检测到 Node.js 环境")
    expect(manager.getMode()).toBe("web-sandbox")
  })
})

describe("CliDevServerBridge (Slidev 标准 Markdown 构建与同步)", () => {

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
      "/data/storage/petal/siyuan-live-slides/slides.md",
      mockPutFile,
    )

    expect(result.success).toBe(true)
    expect(result.path).toBe("/data/storage/petal/siyuan-live-slides/slides.md")
    expect(mockPutFile).toHaveBeenCalledTimes(1)
    expect(manager.cliBridge.getLastSyncTime()).toBeTypeOf("number")
  })
})

