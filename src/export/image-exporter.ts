import JSZip from "jszip"
import { WebSandboxBridge } from "../engine/web-sandbox-bridge"
import { resolveDocumentTitle, sanitizeFileName } from "../plugin/preview-tab-title"
import type { ISlidesDocument } from "../types/slides-protocol"

export { resolveDocumentTitle, sanitizeFileName }

export interface IImageExportOptions {
  title?: string
  mode?: "current" | "all"
  scale?: number
  format?: "png" | "jpeg"
  onProgress?: (current: number, total: number, pageIndex: number) => void
}

/**
 * 将 Blob 触发下载为本地文件
 */
export function downloadBlob(filename: string, blob: Blob): boolean {
  if (typeof document === "undefined") {
    return false
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

/**
 * 将 Base64 DataURL 触发下载为本地文件
 */
export function downloadDataUrl(filename: string, dataUrl: string): boolean {
  if (typeof document === "undefined") {
    return false
  }
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  return true
}

/**
 * 将 DataURL 图片拷贝至系统剪贴板
 */
export async function copyDataUrlToClipboard(dataUrl: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard || typeof ClipboardItem === "undefined") {
    return false
  }
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type || "image/png"]: blob }),
    ])
    return true
  } catch (err) {
    console.warn("[image-exporter] 复制图像至剪贴板失败:", err)
    return false
  }
}

/**
 * 驱动指定沙箱桥梁捕获单页图像
 */
export async function exportCurrentSlideImage(
  bridge: WebSandboxBridge,
  options?: IImageExportOptions,
): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  return new Promise((resolve) => {
    let unsubs: Array<() => void> = []
    const cleanup = () => {
      unsubs.forEach(fn => fn())
      unsubs = []
    }

    const unsubPage = bridge.onCapturePageDone((res) => {
      cleanup()
      resolve({ success: true, dataUrl: res.dataUrl })
    })
    unsubs.push(unsubPage)

    const unsubError = bridge.onCaptureError((err: string) => {
      cleanup()
      resolve({ success: false, error: err })
    })
    unsubs.push(unsubError)

    bridge.startImageExport({
      mode: "current",
      scale: options?.scale || 2,
      format: options?.format || "png",
    })
  })
}

/**
 * 驱动沙箱逐页导出全部幻灯片并打包为 ZIP 压缩包
 */
export async function exportAllSlidesZip(
  bridge: WebSandboxBridge,
  options?: IImageExportOptions,
): Promise<{ success: boolean; total?: number; error?: string }> {
  const images: Array<{ pageIndex: number; dataUrl: string }> = []
  const safeTitle = sanitizeFileName(options?.title || "presentation")

  return new Promise((resolve) => {
    let unsubs: Array<() => void> = []
    const cleanup = () => {
      unsubs.forEach(fn => fn())
      unsubs = []
    }

    const unsubProgress = bridge.onCaptureProgress((p) => {
      options?.onProgress?.(p.current, p.total, p.pageIndex)
    })
    unsubs.push(unsubProgress)

    const unsubPage = bridge.onCapturePageDone((res) => {
      if (res.mode === "all" || !res.mode) {
        images.push({ pageIndex: res.pageIndex, dataUrl: res.dataUrl })
      }
    })
    unsubs.push(unsubPage)

    const unsubComplete = async () => {
      cleanup()
      try {
        if (images.length === 0) {
          resolve({ success: false, error: "未采集到幻灯片图像数据" })
          return
        }
        const zip = new JSZip()
        const ext = options?.format === "jpeg" ? "jpg" : "png"
        for (const item of images) {
          const padIdx = String(item.pageIndex).padStart(2, "0")
          const base64Data = item.dataUrl.split(",")[1]
          zip.file(`slide-${padIdx}.${ext}`, base64Data, { base64: true })
        }
        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" })
        const ok = downloadBlob(`${safeTitle}.zip`, blob)
        resolve({ success: ok, total: images.length })
      } catch (err: any) {
        resolve({ success: false, error: err?.message || String(err) })
      }
    }
    unsubs.push(bridge.onCaptureComplete(unsubComplete))

    const unsubError = bridge.onCaptureError((err: string) => {
      cleanup()
      resolve({ success: false, error: err })
    })
    unsubs.push(unsubError)

    bridge.startImageExport({
      mode: "all",
      scale: options?.scale || 2,
      format: options?.format || "png",
    })
  })
}

/**
 * 无预览视窗时，后台创建隐形临时沙箱并执行图片导出
 */
export async function runHeadlessImageExport(
  doc: ISlidesDocument,
  options?: IImageExportOptions,
): Promise<{ success: boolean; total?: number; error?: string }> {
  if (typeof document === "undefined") {
    return { success: false, error: "环境不支持 DOM 沙箱挂载" }
  }

  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.left = "-9999px"
  iframe.style.top = "-9999px"
  iframe.style.width = "1920px"
  iframe.style.height = "1080px"
  iframe.style.opacity = "0"
  iframe.style.pointerEvents = "none"
  iframe.src = "/plugins/siyuan-live-slides/slides-client/index.html"
  document.body.appendChild(iframe)

  const bridge = new WebSandboxBridge()
  bridge.attach(iframe)

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("静默后台沙箱加载超时")), 12000)
      bridge.onClientReady(() => {
        clearTimeout(timer)
        resolve()
      })
    })

    bridge.updateSlides(doc.slides, doc.config, doc.fullMarkdown)
    await new Promise(r => setTimeout(r, 250))

    if (options?.mode === "current") {
      const res = await exportCurrentSlideImage(bridge, options)
      return { success: res.success, total: 1, error: res.error }
    } else {
      const title = options?.title || (await resolveDocumentTitle(doc, doc.docId))
      return await exportAllSlidesZip(bridge, { ...options, title })
    }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  } finally {
    bridge.detach()
    iframe.remove()
  }
}
