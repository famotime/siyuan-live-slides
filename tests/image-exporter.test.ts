import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  copyDataUrlToClipboard,
  downloadBlob,
  downloadDataUrl,
  exportAllSlidesZip,
  exportCurrentSlideImage,
} from "../src/export/image-exporter"

describe("ImageExporter (幻灯片图片导出器单元测试)", () => {
  it("在非浏览器环境调用 downloadBlob 与 downloadDataUrl 应安全返回 false", () => {
    const blob = new Blob(["test"], { type: "image/png" })
    expect(downloadBlob("test.png", blob)).toBe(false)
    expect(downloadDataUrl("test.png", "data:image/png;base64,123")).toBe(false)
  })

  it("exportCurrentSlideImage 应正确监听沙箱 CAPTURE_PAGE_DONE 并返回 dataUrl", async () => {
    let pageDoneHandler: any = null
    const mockBridge = {
      startImageExport: vi.fn(),
      onCapturePageDone: vi.fn((handler) => {
        pageDoneHandler = handler
        return vi.fn()
      }),
      onCaptureError: vi.fn(() => vi.fn()),
    } as any

    const exportPromise = exportCurrentSlideImage(mockBridge, { mode: "current" })
    expect(mockBridge.startImageExport).toHaveBeenCalledWith({
      mode: "current",
      scale: 2,
      format: "png",
    })

    // 模拟沙箱回传
    pageDoneHandler({ pageIndex: 3, dataUrl: "data:image/png;base64,ABC" })

    const result = await exportPromise
    expect(result.success).toBe(true)
    expect(result.dataUrl).toBe("data:image/png;base64,ABC")
  })

  it("exportAllSlidesZip 应逐页收集图片并打包为包含 slide-01.png 的 ZIP", async () => {
    let progressHandler: any = null
    let pageDoneHandler: any = null
    let completeHandler: any = null

    const mockBridge = {
      startImageExport: vi.fn(),
      onCaptureProgress: vi.fn((handler) => {
        progressHandler = handler
        return vi.fn()
      }),
      onCapturePageDone: vi.fn((handler) => {
        pageDoneHandler = handler
        return vi.fn()
      }),
      onCaptureComplete: vi.fn((handler) => {
        completeHandler = handler
        return vi.fn()
      }),
      onCaptureError: vi.fn(() => vi.fn()),
    } as any

    const progressTracker: number[] = []
    const exportPromise = exportAllSlidesZip(mockBridge, {
      title: "My Presentation",
      onProgress: (current) => progressTracker.push(current),
    })

    expect(mockBridge.startImageExport).toHaveBeenCalledWith({
      mode: "all",
      scale: 2,
      format: "png",
    })

    const validBase64 = Buffer.from("dummy-png-data").toString("base64")
    // 模拟 2 页回传
    progressHandler({ current: 1, total: 2, pageIndex: 1 })
    pageDoneHandler({ pageIndex: 1, dataUrl: `data:image/png;base64,${validBase64}`, mode: "all" })

    progressHandler({ current: 2, total: 2, pageIndex: 2 })
    pageDoneHandler({ pageIndex: 2, dataUrl: `data:image/png;base64,${validBase64}`, mode: "all" })

    // 模拟 DOM 环境以便 downloadBlob 执行
    const clickSpy = vi.fn()
    const mockAnchor = { href: "", download: "", click: clickSpy }
    const fakeDoc = {
      createElement: vi.fn(() => mockAnchor),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    }
    const origDoc = (globalThis as any).document
    const origURL = (globalThis as any).URL
    ;(globalThis as any).document = fakeDoc
    ;(globalThis as any).URL = {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    }

    // 触发完成
    completeHandler({ total: 2 })

    const result = await exportPromise
    expect(result.success).toBe(true)
    expect(result.total).toBe(2)
    expect(progressTracker).toEqual([1, 2])
    expect(mockAnchor.download).toBe("My Presentation-slides.zip")
    expect(clickSpy).toHaveBeenCalled()

    // 恢复
    ;(globalThis as any).document = origDoc
    ;(globalThis as any).URL = origURL
  })

  it("exportCurrentSlideImage 沙箱报错时应返回失败信息", async () => {
    let errorHandler: any = null
    const mockBridge = {
      startImageExport: vi.fn(),
      onCapturePageDone: vi.fn(() => vi.fn()),
      onCaptureError: vi.fn((handler) => {
        errorHandler = handler
        return vi.fn()
      }),
    } as any

    const exportPromise = exportCurrentSlideImage(mockBridge)
    errorHandler("Canvas render failed")

    const result = await exportPromise
    expect(result.success).toBe(false)
    expect(result.error).toBe("Canvas render failed")
  })
})
