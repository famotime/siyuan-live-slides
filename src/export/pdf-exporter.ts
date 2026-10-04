import type { ISlidevBlock, ISlidevDocument, ISlidevVirtualPage } from "../types/slidev-protocol"
import {
  convertBlockToHtml,
  escapeHtml,
  formatInlineMarkdown,
  renderSlideBlocksToHtml,
} from "./markdown-renderer"

export { convertBlockToHtml as convertBlockToPrintHtml, escapeHtml, formatInlineMarkdown }

export type TPdfPageRatio = "16:9" | "4:3" | "A4-landscape" | "A4-portrait"

export interface IPdfExportOptions {
  title?: string
  pageRatio?: TPdfPageRatio
  showNotes?: boolean
  showPageNumber?: boolean
  theme?: "light" | "dark"
}

/**
 * 获取对应纸张比例的 CSS @page 尺寸定义
 */
function getPageSizeCss(ratio: TPdfPageRatio): string {
  switch (ratio) {
    case "4:3":
      return "size: 12in 9in;"
    case "A4-landscape":
      return "size: 297mm 210mm;"
    case "A4-portrait":
      return "size: 210mm 297mm;"
    case "16:9":
    default:
      return "size: 16in 9in;"
  }
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

  const sizeCss = getPageSizeCss(pageRatio)

  const slidesHtml = doc.slides.map((slide, idx) => {
    const layout = slide.frontmatter.layout || "default"
    const contentHtml = renderSlideBlocksToHtml(slide)
    const pageNumText = `${idx + 1} / ${doc.slides.length}`

    return `
      <section class="pdf-slide-page layout-${layout} theme-${theme}">
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
    @page {
      ${sizeCss}
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #f8fafc;
      color: #1e293b;
    }
    .pdf-slide-page {
      width: 100vw;
      height: 100vh;
      page-break-after: always;
      break-after: page;
      padding: 40px 60px;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
      overflow: hidden;
    }
    .pdf-slide-page.theme-dark {
      background: #0f1117;
      color: #f1f5f9;
    }
    .pdf-slide-header {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
    }
    .theme-dark .pdf-slide-header {
      border-bottom-color: #2e3346;
      color: #94a3b8;
    }
    .pdf-slide-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-size: 20px;
      line-height: 1.6;
      overflow: hidden;
    }
    .pdf-block h1 { font-size: 2.5rem; font-weight: 800; color: #2563eb; margin-bottom: 12px; }
    .pdf-block h2 { font-size: 1.9rem; font-weight: 700; color: #1d4ed8; margin-bottom: 10px; }
    .pdf-block h3 { font-size: 1.4rem; font-weight: 600; margin-bottom: 8px; }
    .pdf-block h4 { font-size: 1.2rem; font-weight: 600; margin-bottom: 6px; }
    .pdf-block p { font-size: 1.15rem; color: inherit; }
    .pdf-code {
      background: #f1f5f9;
      padding: 14px 18px;
      border-radius: 6px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 0.95rem;
      border-left: 4px solid #3b82f6;
      white-space: pre-wrap;
    }
    .theme-dark .pdf-code {
      background: #1e1e24;
      border-left-color: #60a5fa;
    }
    .pdf-quote {
      border-left: 4px solid #10b981;
      background: rgba(16, 185, 129, 0.08);
      padding: 10px 16px;
      border-radius: 0 4px 4px 0;
      font-style: italic;
    }
    .pdf-image {
      max-width: 100%;
      max-height: 48vh;
      object-fit: contain;
      border-radius: 6px;
    }
    .pdf-two-cols-wrapper,
    .layout-two-cols-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 36px;
      width: 100%;
      height: 100%;
      flex: 1 1 0%;
      align-items: start;
    }
    .layout-two-cols-header-container,
    .layout-three-cols-header-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }
    .layout-header-section {
      width: 100%;
      margin-bottom: 24px;
      flex-shrink: 0;
    }
    .pdf-three-cols-wrapper,
    .layout-three-cols-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
      gap: 24px;
      width: 100%;
      height: 100%;
      flex: 1 1 0%;
      align-items: start;
      box-sizing: border-box;
    }
    .pdf-col {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-wrap: break-word;
      word-break: break-word;
      white-space: normal;
    }
    .pdf-col * {
      overflow-wrap: break-word;
      word-break: break-word;
      box-sizing: border-box;
    }
    .pdf-col pre {
      white-space: pre-wrap;
      word-break: break-word;
      max-width: 100%;
    }
    .pdf-list-item {
      padding-left: 20px;
    }
    .pdf-list {
      padding-left: 24px;
      margin: 8px 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pdf-list li {
      font-size: 1.15rem;
      line-height: 1.6;
    }
    .pdf-task-item {
      list-style: none;
      margin-left: -20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pdf-task-item input[type="checkbox"] {
      width: 1.15em;
      height: 1.15em;
      cursor: pointer;
    }
    kbd {
      display: inline-block;
      padding: 2px 7px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 0.85em;
      font-weight: 600;
      line-height: 1.25;
      color: inherit;
      background: rgba(125, 125, 125, 0.12);
      border: 1px solid rgba(125, 125, 125, 0.35);
      border-bottom-width: 2px;
      border-radius: 5px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
      margin: 0 2px;
      vertical-align: middle;
      white-space: nowrap;
    }
    .theme-dark kbd {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.25);
      border-bottom-color: rgba(255, 255, 255, 0.4);
      color: #f1f5f9;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }
    .pdf-block--ref {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px;
    }
    .pdf-slide-notes {
      font-size: 14px;
      color: #059669;
      border-top: 1px dashed #cbd5e1;
      padding-top: 12px;
      margin-top: auto;
      line-height: 1.5;
    }
    .theme-dark .pdf-slide-notes {
      color: #34d399;
      border-top-color: #334155;
    }
    /* Layouts */
    .layout-cover .pdf-slide-body {
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .layout-cover h1 {
      font-size: 3.2rem;
    }
    .layout-center .pdf-slide-body {
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .layout-fact .pdf-slide-body {
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .layout-fact h1 {
      font-size: 4.5rem;
      color: #ef4444;
    }
    @media print {
      .slidev-motion-fade-in,
      .slidev-motion-slide-up,
      .slidev-motion-slide-down,
      .slidev-motion-slide-left,
      .slidev-motion-slide-right,
      .slidev-motion-zoom-in,
      .slidev-motion-pop,
      .slidev-motion-bounce {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
    }
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

