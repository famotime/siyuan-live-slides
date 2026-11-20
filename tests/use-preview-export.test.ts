import { describe, expect, it, vi, beforeEach } from "vitest"
import { ref } from "vue"
import { usePreviewExport } from "../src/ui/tab/usePreviewExport"
import type { ISlidesDocument } from "../src/types/slides-protocol"

/**
 * usePreviewExport 领域测试
 *
 * 覆盖：HTML/PDF/全部图片/当前页图片/复制剪贴板五类导出编排的
 * 前置文档校验、进行中防重入、进度与成败消息、文件名派生与剪贴板回退下载。
 */

function createHarness(doc: ISlidesDocument | null, services: any) {
  const currentPage = ref(2)
  const totalPages = ref(10)
  const exportor = usePreviewExport(
    {
      getLatestDoc: () => doc,
      plugin: { currentDocId: "doc-1" },
      sandboxBridge: {} as any,
      currentPage,
      totalPages,
    },
    services,
  )
  return { exportor, currentPage, totalPages }
}

const mockDoc = { docId: "doc-1", slides: [{}, {}], config: {} } as unknown as ISlidesDocument

function createServices(overrides: any = {}) {
  return {
    showMessage: vi.fn(),
    resolveDocumentTitle: vi.fn(async () => "我的演示"),
    exportStandaloneHtml: vi.fn(async () => "<html>standalone</html>"),
    downloadHtmlFile: vi.fn(() => true),
    triggerPdfExport: vi.fn(() => true),
    exportAllSlidesZip: vi.fn(async () => ({ success: true, total: 10 })),
    exportCurrentSlideImage: vi.fn(async () => ({ success: true, dataUrl: "data:image/png;base64,abc" })),
    downloadDataUrl: vi.fn(),
    copyDataUrlToClipboard: vi.fn(async () => true),
    ...overrides,
  }
}

describe("usePreviewExport (预览页签导出编排)", () => {
  let services: any
  beforeEach(() => {
    services = createServices()
  })

  describe("onExportHtml (单文件离线 HTML)", () => {
    it("无文档时应提示先打开文档且不执行导出", async () => {
      const { exportor } = createHarness(null, services)
      await exportor.onExportHtml()
      expect(services.exportStandaloneHtml).not.toHaveBeenCalled()
      expect(services.showMessage).toHaveBeenCalledWith("请先在主编辑区打开幻灯片文档")
    })

    it("正常导出应解析标题、内联资源并触发下载与成功提示", async () => {
      const { exportor } = createHarness(mockDoc, services)
      await exportor.onExportHtml()
      expect(services.resolveDocumentTitle).toHaveBeenCalledWith(mockDoc, "doc-1", expect.anything())
      expect(services.exportStandaloneHtml).toHaveBeenCalledWith(mockDoc, { title: "我的演示" })
      expect(services.downloadHtmlFile).toHaveBeenCalledWith("我的演示.html", "<html>standalone</html>")
      expect(services.showMessage).toHaveBeenCalledWith("已开始下载单文件离线 HTML 演示包 (我的演示.html)")
    })
  })

  describe("onExportPdf (PDF 讲义)", () => {
    it("无文档时应提示先打开文档", async () => {
      const { exportor } = createHarness(null, services)
      await exportor.onExportPdf()
      expect(services.triggerPdfExport).not.toHaveBeenCalled()
      expect(services.showMessage).toHaveBeenCalledWith("请先在主编辑区打开幻灯片文档")
    })

    it("唤起打印视窗成功后应提示另存为 PDF", async () => {
      const { exportor } = createHarness(mockDoc, services)
      await exportor.onExportPdf()
      expect(services.triggerPdfExport).toHaveBeenCalledWith(mockDoc)
      expect(services.showMessage).toHaveBeenCalledWith("已唤起打印视窗，请在打印选项中选择「另存为 PDF」")
    })
  })

  describe("onExportAllImages (全部图片 ZIP)", () => {
    it("无文档时应提示先打开文档且不进入导出态", async () => {
      const { exportor } = createHarness(null, services)
      await exportor.onExportAllImages()
      expect(services.exportAllSlidesZip).not.toHaveBeenCalled()
      expect(exportor.isExportingAllImages.value).toBe(false)
    })

    it("导出中重复触发应提示稍候且不重复导出", async () => {
      const { exportor } = createHarness(mockDoc, services)
      let release!: (v?: any) => void
      services.exportAllSlidesZip.mockImplementation(() => new Promise(resolve => { release = resolve }))
      const first = exportor.onExportAllImages()
      expect(exportor.isExportingAllImages.value).toBe(true)
      await exportor.onExportAllImages()
      expect(services.exportAllSlidesZip).toHaveBeenCalledTimes(1)
      release({ success: true, total: 10 })
      await first
      expect(exportor.isExportingAllImages.value).toBe(false)
    })

    it("进度回调应通过 showMessage 报告当前进度", async () => {
      const { exportor } = createHarness(mockDoc, services)
      services.exportAllSlidesZip.mockImplementation(async (_bridge: any, opts: any) => {
        opts.onProgress(3, 10)
        return { success: true, total: 10 }
      })
      await exportor.onExportAllImages()
      expect(services.showMessage).toHaveBeenCalledWith("正在导出幻灯片图片 (3 / 10)...", 1500)
    })

    it("导出失败应提示错误信息并复位导出态", async () => {
      const { exportor } = createHarness(mockDoc, services)
      services.exportAllSlidesZip.mockResolvedValue({ success: false, error: "渲染超时" })
      await exportor.onExportAllImages()
      expect(services.showMessage).toHaveBeenCalledWith("导出图片失败：渲染超时")
      expect(exportor.isExportingAllImages.value).toBe(false)
    })
  })

  describe("onExportCurrentSlide (当前页图片)", () => {
    it("成功时应按多页规则派生文件名并下载", async () => {
      const { exportor, currentPage, totalPages } = createHarness(mockDoc, services)
      await exportor.onExportCurrentSlide()
      expect(services.downloadDataUrl).toHaveBeenCalledWith("我的演示-2.png", "data:image/png;base64,abc")
      expect(services.showMessage).toHaveBeenCalledWith("已下载当前页高清图片 (我的演示-2.png)")

      totalPages.value = 1
      await exportor.onExportCurrentSlide()
      expect(services.downloadDataUrl).toHaveBeenLastCalledWith("我的演示.png", "data:image/png;base64,abc")
    })

    it("失败时应提示错误信息", async () => {
      const { exportor } = createHarness(mockDoc, services)
      services.exportCurrentSlideImage.mockResolvedValue({ success: false, error: "画布为空" })
      await exportor.onExportCurrentSlide()
      expect(services.downloadDataUrl).not.toHaveBeenCalled()
      expect(services.showMessage).toHaveBeenCalledWith("导出当前页图片失败：画布为空")
    })
  })

  describe("onCopyCurrentSlide (复制到剪贴板)", () => {
    it("剪贴板可用时应复制并提示成功", async () => {
      const { exportor } = createHarness(mockDoc, services)
      await exportor.onCopyCurrentSlide()
      expect(services.copyDataUrlToClipboard).toHaveBeenCalledWith("data:image/png;base64,abc")
      expect(services.showMessage).toHaveBeenCalledWith("已成功将第 2 页幻灯片复制到剪贴板！")
      expect(services.downloadDataUrl).not.toHaveBeenCalled()
    })

    it("剪贴板权限不可用时应自动回退为下载", async () => {
      const { exportor } = createHarness(mockDoc, services)
      services.copyDataUrlToClipboard.mockResolvedValue(false)
      await exportor.onCopyCurrentSlide()
      expect(services.downloadDataUrl).toHaveBeenCalledWith("我的演示-2.png", "data:image/png;base64,abc")
      expect(services.showMessage).toHaveBeenCalledWith("剪贴板权限不可用，已自动下载为 我的演示-2.png")
    })

    it("截图失败应提示复制失败", async () => {
      const { exportor } = createHarness(mockDoc, services)
      services.exportCurrentSlideImage.mockResolvedValue({ success: false, error: "沙箱离线" })
      await exportor.onCopyCurrentSlide()
      expect(services.showMessage).toHaveBeenCalledWith("复制失败：沙箱离线")
    })
  })
})
