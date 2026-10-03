import type { ISlidevBlock, ISlidevDocument, ISlidevVirtualPage } from "../types/slidev-protocol"

export type TPdfPageRatio = "16:9" | "4:3" | "A4-landscape" | "A4-portrait"

export interface IPdfExportOptions {
  title?: string
  pageRatio?: TPdfPageRatio
  showNotes?: boolean
  showPageNumber?: boolean
  theme?: "light" | "dark"
}

/**
 * 将单块 Markdown / 内容转换为适合打印的高保真 HTML
 */
export function convertBlockToPrintHtml(block: ISlidevBlock): string {
  const md = (block.rawMarkdown || block.content || "").trim()
  if (!md) return ""

  // 若已经是展开的块引用卡片，直接保留其结构
  if (md.includes('class="slidev-block-ref"') || md.includes('class="slidev-ref-tag"')) {
    return `<div class="pdf-block pdf-block--ref">${md}</div>`
  }

  // 标题识别
  if (md.startsWith("#### ")) {
    return `<div class="pdf-block"><h4>${escapeHtml(md.slice(5))}</h4></div>`
  }
  if (md.startsWith("### ")) {
    return `<div class="pdf-block"><h3>${escapeHtml(md.slice(4))}</h3></div>`
  }
  if (md.startsWith("## ")) {
    return `<div class="pdf-block"><h2>${escapeHtml(md.slice(3))}</h2></div>`
  }
  if (md.startsWith("# ")) {
    return `<div class="pdf-block"><h1>${escapeHtml(md.slice(2))}</h1></div>`
  }

  // 代码块
  if (md.startsWith("```")) {
    const lines = md.split("\n")
    const codeContent = lines.slice(1, -1).join("\n") || md.slice(3, -3)
    return `<div class="pdf-block"><pre class="pdf-code"><code>${escapeHtml(codeContent)}</code></pre></div>`
  }

  // 引用块
  if (md.startsWith("> ")) {
    return `<div class="pdf-block"><blockquote class="pdf-quote"><p>${formatInlineMarkdown(md.slice(2))}</p></blockquote></div>`
  }

  // 图片
  const imgMatch = md.match(/^!\[(.*?)\]\((.*?)\)$/)
  if (imgMatch) {
    return `<div class="pdf-block pdf-block--image"><img alt="${escapeHtml(imgMatch[1])}" src="${imgMatch[2]}" class="pdf-image" /></div>`
  }

  // 无序列表项
  if (/^[-*+]\s+/.test(md)) {
    const listText = md.replace(/^[-*+]\s+/, "")
    return `<div class="pdf-block pdf-list-item"><li>${formatInlineMarkdown(listText)}</li></div>`
  }

  // 有序列表项
  if (/^\d+\.\s+/.test(md)) {
    const listText = md.replace(/^\d+\.\s+/, "")
    return `<div class="pdf-block pdf-list-item pdf-list-item--ordered"><li>${formatInlineMarkdown(listText)}</li></div>`
  }

  // 普通段落
  return `<div class="pdf-block"><p>${formatInlineMarkdown(md)}</p></div>`
}

/**
 * 行内 Markdown 转义与渲染 (加粗、斜体、行内代码、图片)
 */
function formatInlineMarkdown(text: string): string {
  let res = escapeHtml(text)
  // 加粗 **text**
  res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  // 斜体 *text*
  res = res.replace(/\*(.*?)\*/g, "<em>$1</em>")
  // 行内代码 `code`
  res = res.replace(/`([^`]+)`/g, "<code>$1</code>")
  return res
}

/**
 * HTML 特殊字符转义
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * 渲染单个幻灯片页面的 HTML 内容
 */
function renderSlideContent(slide: ISlidevVirtualPage): string {
  const layout = slide.frontmatter.layout || "default"
  const blocks = slide.blocks || []

  if (layout === "two-cols") {
    const hasRightSlot = blocks.some(b => b.slot === "right")
    let leftBlocks: ISlidevBlock[] = []
    let rightBlocks: ISlidevBlock[] = []

    if (hasRightSlot) {
      leftBlocks = blocks.filter(b => b.slot !== "right")
      rightBlocks = blocks.filter(b => b.slot === "right")
    } else {
      const mid = Math.ceil(blocks.length / 2)
      leftBlocks = blocks.slice(0, mid)
      rightBlocks = blocks.slice(mid)
    }

    const leftHtml = leftBlocks.map(convertBlockToPrintHtml).join("\n")
    const rightHtml = rightBlocks.map(convertBlockToPrintHtml).join("\n")

    return `
      <div class="pdf-two-cols-wrapper">
        <div class="pdf-col pdf-col--left">${leftHtml}</div>
        <div class="pdf-col pdf-col--right">${rightHtml}</div>
      </div>
    `
  }

  return blocks.map(convertBlockToPrintHtml).join("\n")
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
    const contentHtml = renderSlideContent(slide)
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
    .pdf-two-cols-wrapper {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
      width: 100%;
      height: 100%;
      align-items: start;
    }
    .pdf-col {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .pdf-list-item {
      padding-left: 20px;
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
  if (typeof window === "undefined") {
    return false
  }

  const html = buildPrintableHtml(doc, options)
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

