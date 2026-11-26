import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { ref } from "vue"
import { parsePageAttrs } from "@/compiler/scope-mapper"
import { buildSlidesDocument } from "@/compiler/slides-ast-builder"
import {
  ATTR_PAGE_HIDE,
  filterVisibleSlides,
  getVisibleSlidesDoc,
  isSlideHidden,
  type ISlidesDocument,
} from "@/types/slides-protocol"
import { CursorTracker } from "@/sync/cursor-tracker"
import { buildPrintableHtml } from "@/export/pdf-exporter"
import { buildStandaloneHtml, extractDocAssetUrls } from "@/export/single-html-exporter"
import { runHeadlessImageExport } from "@/export/image-exporter"
import { usePreviewExport } from "@/ui/tab/usePreviewExport"

function makeSampleDoc(hideFlags: boolean[]): ISlidesDocument {
  const blocks: any[] = []
  hideFlags.forEach((hidden, idx) => {
    if (idx > 0) {
      blocks.push({
        id: `div-${idx + 1}`,
        type: "tb",
        markdown: "---",
        ial: hidden ? { [ATTR_PAGE_HIDE]: "true" } : {},
      })
    }
    blocks.push({
      id: `p-${idx + 1}`,
      type: "p",
      content: `第 ${idx + 1} 页内容`,
      markdown: `第 ${idx + 1} 页内容`,
      ial: {},
    })
  })
  const docAttrs = hideFlags[0] ? { [ATTR_PAGE_HIDE]: "true" } : {}
  return buildSlidesDocument("doc-root", docAttrs, blocks)
}

describe("页面隐藏 (custom-slides-hide) 协议与端到端行为", () => {
  it("parsePageAttrs 显式解析 custom-slides-hide", () => {
    expect(parsePageAttrs({ [ATTR_PAGE_HIDE]: "true" }).frontmatter.hide).toBe(true)
    expect(parsePageAttrs({ [ATTR_PAGE_HIDE]: "false" }).frontmatter.hide).toBe(false)
    expect(parsePageAttrs({}).frontmatter.hide).toBeUndefined()
  })

  it("filterVisibleSlides 与 getVisibleSlidesDoc 跳过隐藏页并连续重排页码", () => {
    const doc = makeSampleDoc([false, true, false, true])
    expect(doc.slides).toHaveLength(4)
    expect(isSlideHidden(doc.slides[1])).toBe(true)
    expect(isSlideHidden(doc.slides[0])).toBe(false)

    const visible = filterVisibleSlides(doc.slides)
    expect(visible).toHaveLength(2)
    expect(visible.map(s => s.pageIndex)).toEqual([1, 2])
    expect(visible[0].rawMarkdown).toContain("第 1 页内容")
    expect(visible[1].rawMarkdown).toContain("第 3 页内容")

    const visibleDoc = getVisibleSlidesDoc(doc)
    expect(visibleDoc.config.allSlidesHidden).toBe(false)
    expect(visibleDoc.slides).toHaveLength(2)
  })

  it("支持第 1 页隐藏与全部页面隐藏时的 allSlidesHidden 标记", () => {
    const firstHidden = makeSampleDoc([true, false])
    const v1 = getVisibleSlidesDoc(firstHidden)
    expect(v1.slides).toHaveLength(1)
    expect(v1.slides[0].pageIndex).toBe(1)
    expect(v1.slides[0].rawMarkdown).toContain("第 2 页内容")

    const allHidden = makeSampleDoc([true, true])
    const v2 = getVisibleSlidesDoc(allHidden)
    expect(v2.slides).toHaveLength(0)
    expect(v2.config.allSlidesHidden).toBe(true)
  })

  it("CursorTracker 命中隐藏页时触发占位提示，命中可见页时清除占位并按可见页码跳转", () => {
    vi.useFakeTimers()
    try {
      const doc = makeSampleDoc([false, true, false])
      const bridge = {
        navigatePage: vi.fn(),
        highlightElement: vi.fn(),
        showHiddenPlaceholder: vi.fn(),
      } as any
      const tracker = new CursorTracker(bridge)
      tracker.setDocId("doc-root")
      tracker.updateSlidesIndex(doc.slides)

      expect(tracker.getPageByBlockId("p-2")).toBeNull()
      expect(tracker.getPageByBlockId("p-3")).toBe(2)

      // 1. 光标进入隐藏的第 2 页
      tracker.onCursorFocusBlock("p-2")
      vi.advanceTimersByTime(120)
      expect(bridge.showHiddenPlaceholder).toHaveBeenCalledWith({
        pageIndex: 2,
        startBlockId: "div-2",
      })
      expect(bridge.navigatePage).not.toHaveBeenCalled()

      // 2. 光标进入可见的第 3 页（可见序号为 2）
      tracker.onCursorFocusBlock("p-3")
      vi.advanceTimersByTime(120)
      expect(bridge.showHiddenPlaceholder).toHaveBeenLastCalledWith(null)
      expect(bridge.navigatePage).toHaveBeenCalledWith(2)
      expect(bridge.highlightElement).toHaveBeenCalledWith("p-3")
    } finally {
      vi.useRealTimers()
    }
  })

  it("PDF 与单文件 HTML 导出跳过隐藏页且仅采集可见页资源", () => {
    const doc = buildSlidesDocument("doc-root", {}, [
      { id: "p-1", type: "p", content: "![img1](assets/visible.png)", markdown: "![img1](assets/visible.png)", ial: {} },
      { id: "div-2", type: "tb", markdown: "---", ial: { [ATTR_PAGE_HIDE]: "true" } },
      { id: "p-2", type: "p", content: "隐藏页秘钥内容 ![img2](assets/secret.png)", markdown: "隐藏页秘钥内容 ![img2](assets/secret.png)", ial: {} },
      { id: "div-3", type: "tb", markdown: "---", ial: {} },
      { id: "p-3", type: "p", content: "第三页可见内容", markdown: "第三页可见内容", ial: {} },
    ])

    const pdfHtml = buildPrintableHtml(doc)
    expect(pdfHtml).not.toContain("隐藏页秘钥内容")
    expect(pdfHtml).toContain("第三页可见内容")
    expect(pdfHtml).toContain("P. 2 / 2")

    const standaloneHtml = buildStandaloneHtml(doc)
    expect(standaloneHtml).not.toContain("隐藏页秘钥内容")
    expect(standaloneHtml).toContain("第三页可见内容")

    const assets = extractDocAssetUrls(doc)
    expect(assets).toContain("assets/visible.png")
    expect(assets).not.toContain("assets/secret.png")
  })

  it("全部页面隐藏时无头图片导出与预览导出入口阻止导出并提示", async () => {
    const allHiddenDoc = makeSampleDoc([true, true])

    const imgRes = await runHeadlessImageExport(allHiddenDoc)
    expect(imgRes.success).toBe(false)
    expect(imgRes.error).toContain("隐藏")

    const showMessage = vi.fn()
    const exportStandaloneHtml = vi.fn()
    const triggerPdfExport = vi.fn()
    const previewExport = usePreviewExport(
      {
        getLatestDoc: () => allHiddenDoc,
        plugin: {},
        sandboxBridge: {} as any,
        currentPage: ref(1),
        totalPages: ref(0),
      },
      {
        showMessage,
        resolveDocumentTitle: vi.fn().mockResolvedValue("测试"),
        exportStandaloneHtml,
        downloadHtmlFile: vi.fn(),
        triggerPdfExport,
        exportAllSlidesZip: vi.fn(),
        exportCurrentSlideImage: vi.fn(),
        downloadDataUrl: vi.fn(),
        copyDataUrlToClipboard: vi.fn(),
      },
    )

    await previewExport.onExportHtml()
    previewExport.onExportPdf()
    expect(exportStandaloneHtml).not.toHaveBeenCalled()
    expect(triggerPdfExport).not.toHaveBeenCalled()
    expect(showMessage).toHaveBeenCalledWith("当前文档所有页面均已隐藏，无可导出的可见幻灯片")
  })

  it("PageInspectorSection 包含已隐藏徽章与隐藏切换按钮", () => {
    const vueSource = readFileSync(
      resolve(process.cwd(), "src/ui/components/PageInspectorSection.vue"),
      "utf-8",
    )
    expect(vueSource).toContain("spm-hidden-badge")
    expect(vueSource).toContain("已隐藏")
    expect(vueSource).toContain("togglePageHide")
    expect(vueSource).toContain("隐藏此页")
    expect(vueSource).toContain("取消隐藏")
  })
})
