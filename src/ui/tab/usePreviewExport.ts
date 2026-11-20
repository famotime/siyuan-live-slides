/**
 * 预览页签导出编排领域逻辑（自 SlidesPreviewTab 抽离）
 *
 * 职责：统一编排单文件 HTML、PDF 讲义、全部图片 ZIP、当前页图片与剪贴板复制
 * 五类导出动作，收敛前置文档校验、进行中防重入、进度与成败消息提示。
 * 导出服务以注入形式传入，便于脱离宿主环境单测。
 */

import { ref, type Ref } from 'vue'
import { showMessage } from 'siyuan'
import type { WebSandboxBridge } from '@/engine/web-sandbox-bridge'
import { exportStandaloneHtml, downloadHtmlFile } from '@/export/single-html-exporter'
import { triggerPdfExport } from '@/export/pdf-exporter'
import {
  exportAllSlidesZip,
  exportCurrentSlideImage,
  downloadDataUrl,
  copyDataUrlToClipboard,
  resolveDocumentTitle,
} from '@/export/image-exporter'
import type { ISlidesDocument } from '@/types/slides-protocol'

/** 导出编排的宿主上下文 */
export interface IPreviewExportOptions {
  getLatestDoc: () => ISlidesDocument | null
  plugin: any
  sandboxBridge: WebSandboxBridge
  currentPage: Ref<number>
  totalPages: Ref<number>
}

/** 导出编排依赖的底层服务（默认实现来自 export 模块，可注入覆盖以便单测） */
export interface IPreviewExportServices {
  showMessage: (msg: string, timeout?: number) => void
  resolveDocumentTitle: typeof resolveDocumentTitle
  exportStandaloneHtml: typeof exportStandaloneHtml
  downloadHtmlFile: typeof downloadHtmlFile
  triggerPdfExport: typeof triggerPdfExport
  exportAllSlidesZip: typeof exportAllSlidesZip
  exportCurrentSlideImage: typeof exportCurrentSlideImage
  downloadDataUrl: typeof downloadDataUrl
  copyDataUrlToClipboard: typeof copyDataUrlToClipboard
}

const defaultServices: IPreviewExportServices = {
  showMessage,
  resolveDocumentTitle,
  exportStandaloneHtml,
  downloadHtmlFile,
  triggerPdfExport,
  exportAllSlidesZip,
  exportCurrentSlideImage,
  downloadDataUrl,
  copyDataUrlToClipboard,
}

export function usePreviewExport(
  options: IPreviewExportOptions,
  services: IPreviewExportServices = defaultServices,
) {
  const { getLatestDoc, plugin, sandboxBridge, currentPage, totalPages } = options

  /** 全篇逐页导出图片进行中标志（防重入） */
  const isExportingAllImages = ref(false)

  async function onExportHtml() {
    const doc = getLatestDoc()
    if (!doc) {
      services.showMessage('请先在主编辑区打开幻灯片文档')
      return
    }
    const title = await services.resolveDocumentTitle(doc, (plugin as any)?.currentDocId, plugin)
    services.showMessage('正在导出单文件离线 HTML（内联媒体资源中...）', 2000)
    const html = await services.exportStandaloneHtml(doc, { title })
    const ok = services.downloadHtmlFile(`${title}.html`, html)
    if (ok) {
      services.showMessage(`已开始下载单文件离线 HTML 演示包 (${title}.html)`)
    }
  }

  function onExportPdf() {
    const doc = getLatestDoc()
    if (!doc) {
      services.showMessage('请先在主编辑区打开幻灯片文档')
      return
    }
    const ok = services.triggerPdfExport(doc)
    if (ok) {
      services.showMessage('已唤起打印视窗，请在打印选项中选择「另存为 PDF」')
    }
  }

  async function onExportAllImages() {
    if (isExportingAllImages.value) {
      services.showMessage('正在逐页导出幻灯片图片中，请稍候...', 2000)
      return
    }
    const doc = getLatestDoc()
    if (!doc) {
      services.showMessage('请先在主编辑区打开幻灯片文档')
      return
    }
    isExportingAllImages.value = true
    try {
      services.showMessage('正在逐页导出幻灯片图片...', 2000)
      const title = await services.resolveDocumentTitle(doc, (plugin as any)?.currentDocId, plugin)
      const res = await services.exportAllSlidesZip(sandboxBridge, {
        title,
        onProgress: (current: number, total: number) => {
          services.showMessage(`正在导出幻灯片图片 (${current} / ${total})...`, 1500)
        },
      })
      if (res.success) {
        services.showMessage(`🎉 成功导出 ${res.total || 0} 张高清图片并保存为 ${title}.zip！`, 4000)
      } else {
        services.showMessage(`导出图片失败：${(res as any).error || '未知异常'}`)
      }
    } finally {
      isExportingAllImages.value = false
    }
  }

  async function onExportCurrentSlide() {
    const doc = getLatestDoc()
    if (!doc) {
      services.showMessage('请先在主编辑区打开幻灯片文档')
      return
    }
    services.showMessage('正在导出当前幻灯片图片...', 1500)
    const res = await services.exportCurrentSlideImage(sandboxBridge)
    if (res.success && res.dataUrl) {
      const title = await services.resolveDocumentTitle(doc, (plugin as any)?.currentDocId, plugin)
      const page = currentPage.value || 1
      const total = totalPages.value || 1
      const filename = total > 1 ? `${title}-${page}.png` : `${title}.png`
      services.downloadDataUrl(filename, res.dataUrl)
      services.showMessage(`已下载当前页高清图片 (${filename})`)
    } else {
      services.showMessage(`导出当前页图片失败：${(res as any).error || '未知异常'}`)
    }
  }

  async function onCopyCurrentSlide() {
    const doc = getLatestDoc()
    if (!doc) {
      services.showMessage('请先在主编辑区打开幻灯片文档')
      return
    }
    services.showMessage('正在复制当前幻灯片截图到剪贴板...', 1500)
    const res = await services.exportCurrentSlideImage(sandboxBridge)
    if (res.success && res.dataUrl) {
      const ok = await services.copyDataUrlToClipboard(res.dataUrl)
      if (ok) {
        services.showMessage(`已成功将第 ${currentPage.value || 1} 页幻灯片复制到剪贴板！`)
      } else {
        const title = await services.resolveDocumentTitle(doc, (plugin as any)?.currentDocId, plugin)
        const page = currentPage.value || 1
        const total = totalPages.value || 1
        const filename = total > 1 ? `${title}-${page}.png` : `${title}.png`
        services.downloadDataUrl(filename, res.dataUrl)
        services.showMessage(`剪贴板权限不可用，已自动下载为 ${filename}`)
      }
    } else {
      services.showMessage(`复制失败：${(res as any).error || '未知异常'}`)
    }
  }

  return {
    isExportingAllImages,
    onExportHtml,
    onExportPdf,
    onExportAllImages,
    onExportCurrentSlide,
    onCopyCurrentSlide,
  }
}
