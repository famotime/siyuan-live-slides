import type { ISlidevDocument } from "../types/slidev-protocol"

/**
 * 构建适合调用系统打印 / 导出高保真 PDF 讲义的 HTML 结构
 */
export function buildPrintableHtml(doc: ISlidevDocument): string {
  const slidesHtml = doc.slides.map((slide, idx) => {
    const blocksHtml = slide.blocks.map(b => {
      const text = b.rawMarkdown || b.content || ""
      return `<div class="pdf-block">${text}</div>`
    }).join("\n")

    return `
      <section class="pdf-slide-page layout-${slide.frontmatter.layout || 'default'}">
        <header class="pdf-slide-header">Page ${idx + 1}</header>
        <div class="pdf-slide-body">${blocksHtml}</div>
        ${slide.notes ? `<footer class="pdf-slide-notes">备注: ${slide.notes}</footer>` : ''}
      </section>
    `
  }).join("\n")

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Slidev PDF 讲义导出</title>
  <style>
    @page {
      size: 16in 9in;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #111; }
    .pdf-slide-page {
      width: 100vw;
      height: 100vh;
      page-break-after: always;
      break-after: page;
      padding: 40px 60px;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .pdf-slide-header { font-size: 14px; color: #888; margin-bottom: 20px; }
    .pdf-slide-body { flex: 1; display: flex; flex-direction: column; gap: 16px; font-size: 24px; line-height: 1.5; }
    .pdf-slide-notes { font-size: 14px; color: #059669; border-top: 1px dashed #ccc; padding-top: 8px; margin-top: auto; }
    .layout-cover { justify-content: center; align-items: center; text-align: center; }
  </style>
</head>
<body>
  ${slidesHtml}
</body>
</html>`
}

/**
 * 打开隐藏打印视窗调用系统打印机保存为 PDF
 */
export function triggerPdfExport(doc: ISlidevDocument): boolean {
  if (typeof window === "undefined") {
    return false
  }

  const html = buildPrintableHtml(doc)
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
  }, 300)

  return true
}
