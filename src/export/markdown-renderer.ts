import type { ISlidevBlockItem, ISlidevVirtualPage } from "../types/slidev-protocol"

/**
 * HTML 特殊字符转义
 */
export function escapeHtml(str: string): string {
  if (!str) return ""
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * 行内 Markdown 转义与渲染 (加粗、斜体、行内代码)
 */
export function formatInlineMarkdown(text: string): string {
  if (!text) return ""
  let res = escapeHtml(text)
  // 加粗 **text**
  res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  // 斜体 *text*
  res = res.replace(/\*(.*?)\*/g, "<em>$1</em>")
  // 行内代码 `code`
  res = res.replace(/`([^`]+)`/g, "<code>$1</code>")
  return res
}

export interface IBlockRenderOptions {
  containerClassName?: string
  codeClassName?: string
  quoteClassName?: string
  imageClassName?: string
}

/**
 * 将单个 SlidevBlockItem 渲染为标准语义化 HTML 字符串
 */
export function convertBlockToHtml(
  block: ISlidevBlockItem,
  options?: IBlockRenderOptions,
): string {
  const containerClass = options?.containerClassName || "pdf-block"
  const md = (block.rawMarkdown || block.content || "").trim()

  if (!md) {
    return `<div class="${containerClass}"></div>`
  }

  // 1. 若已经是渲染好的思源引用或标签，直接内联
  if (md.includes('class="slidev-block-ref"') || md.includes('class="slidev-ref-tag"')) {
    return `<div class="${containerClass}">${md}</div>`
  }

  // 2. 标题
  if (md.startsWith("### ")) {
    return `<div class="${containerClass}"><h3>${escapeHtml(md.slice(4))}</h3></div>`
  }
  if (md.startsWith("## ")) {
    return `<div class="${containerClass}"><h2>${escapeHtml(md.slice(3))}</h2></div>`
  }
  if (md.startsWith("# ")) {
    return `<div class="${containerClass}"><h1>${escapeHtml(md.slice(2))}</h1></div>`
  }

  // 3. 代码块
  if (md.startsWith("```")) {
    const lines = md.split("\n")
    const codeContent = lines.length > 2 ? lines.slice(1, -1).join("\n") : md.slice(3, -3)
    const codeClass = options?.codeClassName || "pdf-code"
    return `<div class="${containerClass}"><pre class="${codeClass}"><code>${escapeHtml(codeContent)}</code></pre></div>`
  }

  // 4. 引用块
  if (md.startsWith("> ")) {
    const quoteClass = options?.quoteClassName || "pdf-quote"
    return `<div class="${containerClass}"><blockquote class="${quoteClass}"><p>${formatInlineMarkdown(md.slice(2))}</p></blockquote></div>`
  }

  // 5. 图片
  const imgMatch = md.match(/^!\[(.*?)\]\((.*?)\)$/)
  if (imgMatch) {
    const imgClass = options?.imageClassName || "pdf-image"
    return `<div class="${containerClass} ${containerClass}--image"><img alt="${escapeHtml(imgMatch[1])}" src="${imgMatch[2]}" class="${imgClass}" /></div>`
  }

  // 6. 无序列表项
  if (/^[-*+]\s+/.test(md)) {
    const listText = md.replace(/^[-*+]\s+/, "")
    return `<div class="${containerClass} pdf-list-item"><li>${formatInlineMarkdown(listText)}</li></div>`
  }

  // 7. 有序列表项
  if (/^\d+\.\s+/.test(md)) {
    const listText = md.replace(/^\d+\.\s+/, "")
    return `<div class="${containerClass} pdf-list-item pdf-list-item--ordered"><li>${formatInlineMarkdown(listText)}</li></div>`
  }

  // 8. 普通段落
  return `<div class="${containerClass}"><p>${formatInlineMarkdown(md)}</p></div>`
}

export interface IRenderSlideOptions extends IBlockRenderOptions {
  twoColsWrapperClass?: string
  leftColClass?: string
  rightColClass?: string
}

/**
 * 渲染单个幻灯片页面的所有块，支持 two-cols 双栏自适应与单栏流式布局
 */
export function renderSlideBlocksToHtml(
  slide: ISlidevVirtualPage,
  options?: IRenderSlideOptions,
): string {
  const layout = slide.frontmatter?.layout || "default"
  const blocks = slide.blocks || []

  if (layout === "two-cols") {
    const hasRightSlot = blocks.some(b => b.slot === "right")
    let leftBlocks: ISlidevBlockItem[] = []
    let rightBlocks: ISlidevBlockItem[] = []

    if (hasRightSlot) {
      leftBlocks = blocks.filter(b => b.slot !== "right")
      rightBlocks = blocks.filter(b => b.slot === "right")
    } else {
      const mid = Math.ceil(blocks.length / 2)
      leftBlocks = blocks.slice(0, mid)
      rightBlocks = blocks.slice(mid)
    }

    const leftHtml = leftBlocks.map(b => convertBlockToHtml(b, options)).join("\n")
    const rightHtml = rightBlocks.map(b => convertBlockToHtml(b, options)).join("\n")

    const wrapperClass = options?.twoColsWrapperClass || "pdf-two-cols-wrapper"
    const leftClass = options?.leftColClass || "pdf-col pdf-col--left"
    const rightClass = options?.rightColClass || "pdf-col pdf-col--right"

    return `
      <div class="${wrapperClass}">
        <div class="${leftClass}">${leftHtml}</div>
        <div class="${rightClass}">${rightHtml}</div>
      </div>
    `
  }

  return blocks.map(b => convertBlockToHtml(b, options)).join("\n")
}
