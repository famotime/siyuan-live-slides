import type { ISlidevBlock, ISlidevDocument, ISlidevVirtualPage } from "../types/slidev-protocol"
import {
  convertBlockToHtml,
  escapeHtml,
  formatInlineMarkdown,
  renderSlideBlocksToHtml,
} from "./markdown-renderer"
import { generateCompleteSiYuanThemeCss } from "../compiler/theme-styles-generator"

export { convertBlockToHtml as convertBlockToPrintHtml, escapeHtml, formatInlineMarkdown }

export type TPdfPageRatio = "16:9" | "4:3" | "A4-landscape" | "A4-portrait"

export interface IPdfExportOptions {
  title?: string
  pageRatio?: TPdfPageRatio
  showNotes?: boolean
  showPageNumber?: boolean
  theme?: "light" | "dark"
  customInlineStyles?: any
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
    ${generateCompleteSiYuanThemeCss(options?.customInlineStyles)}

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
      padding: var(--slidev-padding-y, 36px) var(--slidev-padding-x, 56px);
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
      overflow: hidden;
    }
    .pdf-slide-page.spacing-compact {
      --slidev-padding-y: 20px;
      --slidev-padding-x: 36px;
      --slidev-header-gap: 10px;
      --slidev-title-margin-bottom: 6px;
    }
    .pdf-slide-page.spacing-normal {
      --slidev-padding-y: 36px;
      --slidev-padding-x: 56px;
      --slidev-header-gap: 16px;
      --slidev-title-margin-bottom: 10px;
    }
    .pdf-slide-page.spacing-loose {
      --slidev-padding-y: 48px;
      --slidev-padding-x: 64px;
      --slidev-header-gap: 24px;
      --slidev-title-margin-bottom: 16px;
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
    .pdf-code,
    pre {
      background: #f1f5f9;
      padding: 14px 18px;
      border-radius: 6px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 0.95rem;
      border-left: 4px solid #3b82f6;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .pdf-code code,
    pre code {
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      display: block !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .code-line {
      display: flex !important;
      align-items: flex-start !important;
      width: 100% !important;
      box-sizing: border-box !important;
      line-height: 1.6;
    }
    .code-line .line-no {
      display: inline-block !important;
      flex-shrink: 0 !important;
      min-width: 2.2em !important;
      text-align: right !important;
      margin-right: 12px !important;
      user-select: none !important;
      opacity: 0.45 !important;
    }
    .code-line .line-content {
      flex: 1 1 0% !important;
      min-width: 0 !important;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
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
    .pdf-image,
    .slide-media-img {
      max-width: 100% !important;
      max-height: 48vh !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
      border-radius: 6px;
      margin: auto;
      display: block;
    }
    .slide-media-block,
    .slide-media-container,
    .slide-video-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      max-height: 48vh;
      margin: 8px 0;
      overflow: hidden;
    }
    .slide-list-media {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      margin-top: 8px;
      margin-bottom: 6px;
      max-width: 100%;
      overflow: hidden;
    }
    .slide-list-media img,
    .slide-list-media video,
    .slide-list-media .list-item-gif {
      max-width: 100% !important;
      max-height: min(280px, 36vh) !important;
      width: auto !important;
      height: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
      object-fit: contain !important;
      border-radius: 6px;
      display: block;
      margin: 0 auto !important;
    }
    .slide-video-player {
      max-width: 100% !important;
      max-height: 48vh !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
      border-radius: 6px;
      background: #000;
      border: 1px solid #cbd5e1;
    }
    .pdf-two-cols-wrapper,
    .layout-two-cols-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) !important;
      gap: 36px;
      width: 100%;
      height: 100%;
      min-height: 0 !important;
      max-height: 100% !important;
      flex: 1 1 0%;
      align-items: stretch;
      overflow: hidden !important;
    }
    .layout-two-cols-header-container,
    .layout-three-cols-header-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0 !important;
      max-height: 100% !important;
      overflow: hidden !important;
    }
    .layout-header-section {
      width: 100%;
      margin-bottom: var(--slidev-header-gap, 16px) !important;
      flex-shrink: 0;
    }
    .layout-header-section h1,
    .layout-header-section h2,
    .layout-header-section h3 {
      margin-bottom: var(--slidev-title-margin-bottom, 10px) !important;
    }
    .pdf-three-cols-wrapper,
    .layout-three-cols-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) !important;
      gap: 24px;
      width: 100%;
      height: 100%;
      min-height: 0 !important;
      max-height: 100% !important;
      flex: 1 1 0%;
      align-items: stretch;
      box-sizing: border-box;
      overflow: hidden !important;
    }
    .pdf-col {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      width: 100%;
      max-width: 100%;
      height: 100%;
      max-height: 100%;
      min-height: 0;
      justify-content: flex-start;
      overflow: hidden;
      box-sizing: border-box;
      overflow-wrap: break-word;
      word-break: break-word;
      white-space: normal;
    }
    .pdf-col > .pdf-block,
    .pdf-col > .slide-block {
      flex: 1 1 0% !important;
      min-height: 0 !important;
      max-height: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
    }
    .pdf-col .slide-list-item-title,
    .pdf-col h1, .pdf-col h2, .pdf-col h3, .pdf-col h4, .pdf-col h5, .pdf-col h6,
    .pdf-col .slide-list-item-desc {
      flex: 0 0 auto !important;
      margin-top: 0 !important;
      margin-bottom: 6px !important;
    }
    .pdf-col .slide-list-media,
    .pdf-col .slide-video-container,
    .pdf-col .slide-media-container {
      flex: 1 1 0% !important;
      min-height: 0 !important;
      min-width: 0 !important;
      width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      max-width: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    .pdf-col li:has(.slide-list-media),
    .pdf-col li:has(.slide-media-container),
    .pdf-col li:has(.slide-video-container),
    .pdf-col li:has(img),
    .pdf-col li:has(video),
    .pdf-col .pdf-list-item:has(.slide-list-media),
    .pdf-col .pdf-list-item:has(.slide-media-container),
    .pdf-col .pdf-list-item:has(.slide-video-container),
    .pdf-col .pdf-list-item:has(img),
    .pdf-col .pdf-list-item:has(video) {
      flex: 1 1 0% !important;
      min-height: 0 !important;
      height: 100% !important;
      max-height: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      margin-bottom: 0 !important;
    }
    .pdf-col video,
    .layout-three-cols-grid video,
    .layout-two-cols-grid video,
    .pdf-col img,
    .layout-three-cols-grid img,
    .layout-two-cols-grid img,
    .pdf-col .slide-video-player {
      max-width: 100% !important;
      max-height: 100% !important;
      width: auto !important;
      height: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
      object-fit: contain !important;
      display: block !important;
      margin: 0 auto !important;
    }
    .pdf-col * {
      overflow-wrap: break-word;
      word-break: break-word;
      box-sizing: border-box;
    }
    .pdf-col pre {
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
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
    /* 两栏与三栏（超级块分栏）布局：紧凑自然行距，子列表保留圆点与层级缩进 */
    .layout-two-cols ul,
    .layout-two-cols-header ul,
    .layout-three-cols ul,
    .layout-three-cols-header ul,
    .two-cols-left ul,
    .two-cols-right ul,
    .three-cols-col ul,
    .pdf-two-cols-wrapper ul,
    .pdf-three-cols-wrapper ul,
    .pdf-col ul,
    .layout-two-cols-grid .pdf-list,
    .layout-three-cols-grid .pdf-list,
    .layout-two-cols-grid .pdf-list--unordered,
    .layout-three-cols-grid .pdf-list--unordered {
      list-style: disc !important;
      list-style-type: disc !important;
      padding-left: 1.25em !important;
      margin-left: 0 !important;
      margin-top: 0 !important;
      margin-bottom: 8px !important;
      flex: 0 0 auto !important;
      height: auto !important;
      display: block !important;
    }
    .layout-two-cols ol,
    .layout-two-cols-header ol,
    .layout-three-cols ol,
    .layout-three-cols-header ol,
    .two-cols-left ol,
    .two-cols-right ol,
    .three-cols-col ol,
    .pdf-two-cols-wrapper ol,
    .pdf-three-cols-wrapper ol,
    .pdf-col ol,
    .layout-two-cols-grid .pdf-list--ordered,
    .layout-three-cols-grid .pdf-list--ordered {
      list-style: decimal !important;
      list-style-type: decimal !important;
      padding-left: 1.25em !important;
      margin-left: 0 !important;
      margin-top: 0 !important;
      margin-bottom: 8px !important;
      flex: 0 0 auto !important;
      height: auto !important;
      display: block !important;
    }
    .layout-two-cols li,
    .layout-two-cols-header li,
    .layout-three-cols li,
    .layout-three-cols-header li,
    .two-cols-left li,
    .two-cols-right li,
    .three-cols-col li,
    .pdf-col li,
    .pdf-col .pdf-list-item {
      padding-left: 0.2em !important;
      margin-left: 0 !important;
      margin-bottom: 6px !important;
      flex: 0 0 auto !important;
      height: auto !important;
      display: list-item !important;
      line-height: 1.6 !important;
    }
    .layout-two-cols ul ul,
    .layout-three-cols ul ul,
    .three-cols-col ul ul,
    .pdf-col ul ul {
      list-style: circle !important;
      list-style-type: circle !important;
      padding-left: 1.25em !important;
      margin-top: 4px !important;
      margin-bottom: 4px !important;
    }
    /* 列表项内嵌标题与说明排版 */
    .slide-list-item-title,
    .pdf-list li > h1,
    .pdf-list li > h2,
    .pdf-list li > h3,
    .pdf-list li > h4,
    .pdf-list li > h5,
    .pdf-list li > h6,
    li > h1.slide-list-item-title,
    li > h2.slide-list-item-title,
    li > h3.slide-list-item-title,
    li > h4.slide-list-item-title {
      margin-top: 2px !important;
      margin-bottom: 6px !important;
      line-height: 1.35 !important;
      font-weight: 700 !important;
    }
    .pdf-list li > h1, li > h1.slide-list-item-title { font-size: 1.6rem !important; }
    .pdf-list li > h2, li > h2.slide-list-item-title { font-size: 1.4rem !important; }
    .pdf-list li > h3, li > h3.slide-list-item-title { font-size: 1.22rem !important; }
    .pdf-list li > h4, li > h4.slide-list-item-title { font-size: 1.1rem !important; }
    .slide-list-item-desc,
    .pdf-list li > p {
      margin-top: 4px !important;
      margin-bottom: 6px !important;
      font-size: 1.05rem;
      line-height: 1.55;
      opacity: 0.92;
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
    a {
      color: inherit;
      text-decoration: none;
      border-bottom: 1px dashed currentColor;
    }
    .slidev-ref-tag, a.slidev-ref-tag {
      display: inline-flex;
      align-items: center;
      background: rgba(16, 185, 129, 0.1);
      color: #059669;
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 0.88em;
      text-decoration: none;
      margin: 2px 4px 2px 0;
    }
    .theme-dark .slidev-ref-tag, .theme-dark a.slidev-ref-tag {
      background: rgba(52, 211, 153, 0.15);
      color: #34d399;
      border-color: rgba(52, 211, 153, 0.3);
    }
    .slidev-block-ref, .pdf-block--ref {
      background: rgba(16, 185, 129, 0.06);
      border-left: 3px solid #059669;
      border-radius: 0 6px 6px 0;
      padding: 10px 14px;
      margin: 8px 0;
    }
    .theme-dark .slidev-block-ref, .theme-dark .pdf-block--ref {
      background: rgba(52, 211, 153, 0.08);
      border-left-color: #34d399;
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

