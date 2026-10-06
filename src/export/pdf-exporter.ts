import type { ISlidevBlock, ISlidevDocument, ISlidevVirtualPage } from "../types/slidev-protocol"
import {
  convertBlockToHtml,
  escapeHtml,
  formatInlineMarkdown,
  renderSlideBlocksToHtml,
} from "./markdown-renderer"
import {
  generatePdfExportStyles,
  getPageSizeCss,
} from "./pdf-template-styles"
import type { TPdfPageRatio } from "./pdf-template-styles"

export { convertBlockToHtml as convertBlockToPrintHtml, escapeHtml, formatInlineMarkdown }
export type { TPdfPageRatio }

export interface IPdfExportOptions {
  title?: string
  pageRatio?: TPdfPageRatio
  showNotes?: boolean
  showPageNumber?: boolean
  theme?: "light" | "dark"
  customInlineStyles?: any
}

/**
 * 构建高保真可打印 / 导出 PDF 的独立 HTML 结构
 */
export function buildPrintableHtml(doc: ISlidevDocument, options?: IPdfExportOptions): string {
  const title = options?.title || "Slidev 演示讲义"
  const pageRatio = options?.pageRatio || "16:9"
  const showNotes = options?.showNotes ?? true
  const showPageNumber = options?.showPageNumber ?? true
  const theme = options?.theme || "light"

  const slidesHtml = doc.slides.map((slide, idx) => {
    const layout = slide.frontmatter.layout || "default"
    const pageSp = slide.frontmatter.spacing
    const spacing = (pageSp && pageSp !== "inherit") ? pageSp : (doc.config.spacing || "normal")
    const contentHtml = renderSlideBlocksToHtml(slide)
    const pageNumText = `${idx + 1} / ${doc.slides.length}`

    return `
      <section class="pdf-slide-page layout-${layout} theme-${theme} spacing-${spacing}">
        <header class="pdf-slide-header">
          <span class="pdf-doc-title">${escapeHtml(title)}</span>
          ${showPageNumber ? `<span class="pdf-page-badge">P. ${pageNumText}</span>` : ""}
        </header>
        <div class="pdf-slide-body">
          ${contentHtml}
        </div>
        ${showNotes && slide.notes ? `
          <footer class="pdf-slide-notes">
            <strong>演讲备注:</strong> ${escapeHtml(slide.notes)}
          </footer>
        ` : ""}
      </section>
    `
  }).join("\n")

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} - 高保真讲义</title>
  <style>
    ${generatePdfExportStyles({ pageRatio, customInlineStyles: options?.customInlineStyles })}
  </style>
</head>
<body>
  ${slidesHtml}
</body>
</html>`
}

/**
 * 触发打印窗口或调用系统打印机导出为 PDF
 */
export function triggerPdfExport(doc: ISlidevDocument, options?: IPdfExportOptions): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false
  }

  const html = buildPrintableHtml(doc, options)

  // 优先在当前页面创建隐藏 iframe 进行打印（在 Electron 桌面端和各主流浏览器中表现最稳定）
  try {
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "none"
    iframe.style.visibility = "hidden"
    document.body.appendChild(iframe)

    const docObj = iframe.contentWindow?.document
    if (docObj) {
      docObj.open()
      docObj.write(html)
      docObj.close()

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } finally {
          setTimeout(() => {
            iframe.remove()
          }, 2000)
        }
      }, 350)
      return true
    }
  } catch (e) {
    console.warn("[pdf-exporter] iframe 打印模式异常，降级尝试 window.open:", e)
  }

  // 降级使用 window.open
  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    return false
  }

  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()

  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 350)

  return true
}
