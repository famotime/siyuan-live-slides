import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { WebSandboxBridge } from "../src/engine/web-sandbox-bridge"
import { usePreviewExport } from "../src/ui/tab/usePreviewExport"
import { ref } from "vue"

const PROJECT_ROOT = path.resolve(__dirname, "..")

// 模拟浏览器全局 window 环境（与 tests/engine.test.ts 同源做法）
class MockWindow extends EventTarget {
  postMessage = vi.fn()
}

beforeEach(() => {
  ;(globalThis as any).window = new MockWindow()
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

function makeMockIframe(postMessageImpl?: (...args: any[]) => void) {
  const postMessage = vi.fn(postMessageImpl || (() => {}))
  return {
    iframe: { contentWindow: { postMessage } } as unknown as HTMLIFrameElement,
    postMessage,
  }
}

function dispatchClientReady() {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { source: "siyuan-slides-client", action: "CLIENT_READY", payload: {} },
    }),
  )
}

describe("WebSandboxBridge 握手队列语义 (状态机审计 P1-A)", () => {
  it("detach 不再清空 pendingMessages：页签重开重附后缓存消息继续冲刷", () => {
    const bridge = new WebSandboxBridge()
    const first = makeMockIframe()
    bridge.attach(first.iframe)
    bridge.navigatePage(3)
    bridge.detach()

    // 重新挂载新 iframe（页签重开）
    const second = makeMockIframe()
    bridge.attach(second.iframe)
    dispatchClientReady()

    expect(second.postMessage).toHaveBeenCalledTimes(1)
    expect(second.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: "NAVIGATE_PAGE", payload: { pageIndex: 3 } }),
      "*",
    )
    // 旧 iframe 未收到任何消息
    expect(first.postMessage).not.toHaveBeenCalled()
    bridge.detach()
  })

  it("resetReady 后消息转入待发队列，再次握手时冲刷（非死代码）", () => {
    const bridge = new WebSandboxBridge()
    const { iframe, postMessage } = makeMockIframe()
    bridge.attach(iframe)
    dispatchClientReady()

    // 就绪后消息直接投递
    bridge.navigatePage(2)
    expect(postMessage).toHaveBeenCalledTimes(1)

    // 模拟 iframe 重载：resetReady 后消息必须排队而非打进死窗口
    bridge.resetReady()
    bridge.navigatePage(5)
    expect(postMessage).toHaveBeenCalledTimes(1)

    dispatchClientReady()
    expect(postMessage).toHaveBeenCalledTimes(2)
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "NAVIGATE_PAGE", payload: { pageIndex: 5 } }),
      "*",
    )
    bridge.detach()
  })

  it("冲刷途中投递失败时消息回队重试，不静默丢弃", () => {
    const bridge = new WebSandboxBridge()
    let shouldThrow = true
    const { iframe, postMessage } = makeMockIframe(() => {
      if (shouldThrow) throw new Error("target window gone")
    })
    bridge.attach(iframe)
    bridge.updateSlides([{ pageIndex: 1 } as any], {} as any)

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    dispatchClientReady()
    // 投递失败：消息保留在队列
    expect(postMessage).toHaveBeenCalledTimes(1)

    // 沙箱恢复：下次握手成功冲刷
    shouldThrow = false
    dispatchClientReady()
    expect(postMessage).toHaveBeenCalledTimes(2)
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "UPDATE_SLIDES" }),
      "*",
    )
    warnSpy.mockRestore()
    bridge.detach()
  })
})

describe("导出防重入与错误收口 (状态机审计 P1-B1/P1-B2)", () => {
  it("命令导出图片的置位必须先于 await 编译（TOCTOU 源码守护）", () => {
    const source = fs.readFileSync(path.join(PROJECT_ROOT, "src/plugin/command-registry.ts"), "utf-8")
    const setFlagPos = source.indexOf("isCommandExportingImages = true")
    const awaitCompilePos = source.indexOf("await plugin.compileCurrentDocument()")
    expect(setFlagPos).toBeGreaterThan(-1)
    expect(awaitCompilePos).toBeGreaterThan(-1)
    expect(setFlagPos).toBeLessThan(awaitCompilePos)
  })

  function makeServices() {
    return {
      showMessage: vi.fn(),
      resolveDocumentTitle: vi.fn(async () => "测试文档"),
      exportStandaloneHtml: vi.fn(async () => "<html></html>"),
      downloadHtmlFile: vi.fn(() => true),
      triggerPdfExport: vi.fn(() => true),
      exportAllSlidesZip: vi.fn(async () => ({ success: true, total: 3 })),
      exportCurrentSlideImage: vi.fn(async () => ({ success: true, dataUrl: "data:image/png;base64,x" })),
      downloadDataUrl: vi.fn(),
      copyDataUrlToClipboard: vi.fn(async () => true),
    }
  }

  it("HTML 导出进行中重复触发被拦截，底层导出函数仅执行一次", async () => {
    let resolveExport!: (v: string) => void
    const services = makeServices()
    services.exportStandaloneHtml.mockImplementation(
      () => new Promise<string>(resolve => { resolveExport = resolve }),
    )
    const { onExportHtml } = usePreviewExport({
      getLatestDoc: () => ({ docId: "d1", slides: [], config: {} } as any),
      plugin: {},
      sandboxBridge: {} as any,
      currentPage: ref(1),
      totalPages: ref(1),
    }, services as any)

    const first = onExportHtml()
    const second = onExportHtml()
    // 等待前置 resolveDocumentTitle 微任务完成后，底层导出才开始执行
    await new Promise(resolve => setTimeout(resolve, 0))
    resolveExport("<html></html>")
    await Promise.all([first, second])

    expect(services.exportStandaloneHtml).toHaveBeenCalledTimes(1)
    expect(services.showMessage).toHaveBeenCalledWith(
      expect.stringContaining("正在执行相同导出操作"),
      2000,
    )
  })

  it("导出函数抛出异常时收敛为用户可见失败提示，不再无下文", async () => {
    const services = makeServices()
    services.exportStandaloneHtml.mockRejectedValue(new Error("inline failed"))
    const { onExportHtml } = usePreviewExport({
      getLatestDoc: () => ({ docId: "d1", slides: [], config: {} } as any),
      plugin: {},
      sandboxBridge: {} as any,
      currentPage: ref(1),
      totalPages: ref(1),
    }, services as any)

    await onExportHtml()

    expect(services.showMessage).toHaveBeenCalledWith(
      expect.stringContaining("导出执行失败"),
      4000,
    )
    expect(services.showMessage).toHaveBeenCalledWith(expect.stringContaining("inline failed"), 4000)
  })

  it("失败后防重入锁释放：再次导出可正常执行", async () => {
    const services = makeServices()
    services.exportStandaloneHtml
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("<html></html>")
    const { onExportHtml } = usePreviewExport({
      getLatestDoc: () => ({ docId: "d1", slides: [], config: {} } as any),
      plugin: {},
      sandboxBridge: {} as any,
      currentPage: ref(1),
      totalPages: ref(1),
    }, services as any)

    await onExportHtml()
    await onExportHtml()

    expect(services.exportStandaloneHtml).toHaveBeenCalledTimes(2)
    expect(services.downloadHtmlFile).toHaveBeenCalledTimes(1)
  })
})
