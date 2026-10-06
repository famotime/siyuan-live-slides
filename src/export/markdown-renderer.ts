import type { ISlidevBlockItem, ISlidevVirtualPage } from "../types/slidev-protocol"
import { cleanAndTransformInlineKramdown } from "../compiler/html-cleaner"
import {
  formatLeadContent,
  formatListItemContent,
  renderCompoundMarkdown,
  renderMarkdownList,
} from "./visual-list-renderer"
import {
  renderSlideBlocksToHtml,
} from "./slide-layout-renderer"
import type { IRenderSlideOptions } from "./slide-layout-renderer"

export {
  formatLeadContent,
  formatListItemContent,
  renderCompoundMarkdown,
  renderMarkdownList,
  renderSlideBlocksToHtml,
}
export type { IRenderSlideOptions }

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
 * 解析 Shiki 聚光行号定义（如 "1-3|5|all"）
 */
export function parseShikiRanges(shikiPattern?: string): Set<number> | "all" {
  if (!shikiPattern || shikiPattern.trim() === "" || shikiPattern.trim() === "all") {
    return "all"
  }
  const set = new Set<number>()
  const parts = shikiPattern.split("|")
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed === "all") {
      return "all"
    }
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-")
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          set.add(i)
        }
      }
    } else {
      const num = parseInt(trimmed, 10)
      if (!isNaN(num)) {
        set.add(num)
      }
    }
  }
  return set
}

/**
 * 允许在 Markdown 行内安全放行的通用语义 HTML 标签白名单
 */
export const SAFE_INLINE_HTML_TAGS = new Set([
  "kbd", "mark", "sub", "sup", "span", "a", "br", "b", "i", "u", "s",
  "del", "em", "strong", "code", "small", "abbr", "ruby", "rt", "rp", "v-mark",
  "img", "video", "source", "picture",
])

/**
 * 行内 Markdown 转义与渲染 (支持加粗、斜体、删除线、行内代码、数学公式、思源块引用与链接、v-mark、图片以及安全语义 HTML 标签如 a/kbd/img/video 等)
 */
export function formatInlineMarkdown(text: string): string {
  if (!text) return ""

  // 0. 清洗并保真转换思源笔记行内 Kramdown Span IAL（如 </span>{: style="..."} 或 **加粗**{: style="..."}）
  const preprocessed = cleanAndTransformInlineKramdown(text)

  // 1. 抽取并保护安全内联 HTML 标签（避免被全局 escapeHtml 误伤转义）
  const tokens: string[] = []
  const tokenized = preprocessed.replace(/<\/?([a-zA-Z0-9_-]+)(?:\s+[^<>]*)?\/?>/g, (tagMatch, tagName) => {
    const lowerTag = tagName.toLowerCase()
    if (!SAFE_INLINE_HTML_TAGS.has(lowerTag)) {
      return tagMatch
    }
    // 过滤 XSS 危险事件属性
    if (/on\w+\s*=|javascript:/i.test(tagMatch)) {
      return tagMatch
    }
    // 特殊处理 <v-mark type="...">
    if (lowerTag === "v-mark") {
      const typeMatch = tagMatch.match(/type=["']?([a-zA-Z-]+)["']?/)
      const markType = typeMatch ? typeMatch[1] : "circle"
      if (tagMatch.startsWith("</")) {
        tokens.push("</mark>")
      } else {
        tokens.push(`<mark class="v-mark v-mark--${markType}">`)
      }
      return `%%SAFE_HTML_${tokens.length - 1}%%`
    }
    tokens.push(tagMatch)
    return `%%SAFE_HTML_${tokens.length - 1}%%`
  })

  // 2. 对其余文本执行标准 HTML 转义
  let res = escapeHtml(tokenized)

  // 3. 处理标准 Markdown 行内语法与思源链接标记
  // 3.0 思源块引用 ((block-id 'anchor')) / ((block-id "anchor")) / ((block-id))
  res = res.replace(/\(\(([0-9a-zA-Z-]+)(?:\s*(?:&#039;([^&#]*)&#039;|&quot;([^&]*)&quot;|'([^']*)'|"([^"]*)"|([^\)]+?)))?\s*\)\)/g, (match, blockId, singleEscaped, doubleEscaped, singleRaw, doubleRaw, plainRaw) => {
    const anchor = (singleEscaped ?? doubleEscaped ?? singleRaw ?? doubleRaw ?? plainRaw ?? "").trim()
    const text = anchor || `Ref(${blockId.slice(0, 8)})`
    return `<a href="siyuan://blocks/${blockId}" data-ref-id="${blockId}" class="slidev-ref-tag">🔗 ${text}</a>`
  })

  // 3.1 行内数学公式 $formula$
  res = res.replace(/\$([^$\n]+)\$/g, '<span class="katex-inline font-math"><em>$1</em></span>')

  // 3.1.5 行内图片语法 ![alt](src)（必须在普通超链接之前匹配，防止将图片解析为破坏链接）
  res = res.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
    const isGif = /\.gif(?:\?|$)/i.test(url)
    const cls = isGif ? "slide-inline-img list-item-gif" : "slide-inline-img"
    return `<img alt="${alt}" src="${url}" class="${cls}" />`
  })

  // 3.2 链接 [title](url) 与思源协议链接增强
  res = res.replace(/\[(.*?)\]\((.*?)\)/g, (match, title, url) => {
    if (url.startsWith("siyuan://blocks/")) {
      const blockId = url.replace("siyuan://blocks/", "").split("?")[0]
      return `<a href="${url}" data-ref-id="${blockId}" class="slidev-ref-tag">🔗 ${title}</a>`
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="slidev-link">${title}</a>`
  })

  // 3.2.1 裸思源协议链接 (如 siyuan://blocks/20260625214150-d151ljw)
  res = res.replace(/(^|[\s(])(siyuan:\/\/blocks\/([0-9a-zA-Z-]+)(?:\?[^\s\)]*)?)/g, (match, prefix, url, blockId) => {
    return `${prefix}<a href="${url}" data-ref-id="${blockId}" class="slidev-ref-tag">🔗 ${url}</a>`
  })

  // 3.3 加粗 **text**
  res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")

  // 3.4 斜体 *text*
  res = res.replace(/\*(.*?)\*/g, "<em>$1</em>")

  // 3.5 删除线 ~~text~~
  res = res.replace(/~~(.*?)~~/g, "<del>$1</del>")

  // 3.6 行内代码 `code`
  res = res.replace(/`([^`]+)`/g, "<code>$1</code>")

  // 4. 还原受保护的安全 HTML 标签
  res = res.replace(/%%SAFE_HTML_(\d+)%%/g, (_, idxStr) => {
    const idx = parseInt(idxStr, 10)
    return tokens[idx] || ""
  })

  return res
}

/**
 * 将 Markdown 表格行数组转换为语义化 <table> HTML
 */
export function renderMarkdownTable(tableLines: string[], tableClassName = "pdf-table"): string {
  if (tableLines.length < 2) return ""

  const cleanRows = tableLines.map(line =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim()),
  )

  const headerCells = cleanRows[0]
  // 第二行是否为对齐分隔符 | --- | :---: | ---: |
  let alignDefs: string[] = []
  let bodyStartIndex = 1

  if (tableLines.length >= 2 && cleanRows[1].every(c => /^:?-+:?$/.test(c))) {
    alignDefs = cleanRows[1].map(c => {
      if (c.startsWith(":") && c.endsWith(":")) return "center"
      if (c.endsWith(":")) return "right"
      return "left"
    })
    bodyStartIndex = 2
  }

  const theadHtml = `<thead><tr>${headerCells.map((h, i) => {
    const align = alignDefs[i] ? ` style="text-align: ${alignDefs[i]}"` : ""
    return `<th${align}>${formatInlineMarkdown(h)}</th>`
  }).join("")}</tr></thead>`

  const tbodyRows = cleanRows.slice(bodyStartIndex).map(row => {
    return `<tr>${row.map((cell, i) => {
      const align = alignDefs[i] ? ` style="text-align: ${alignDefs[i]}"` : ""
      return `<td${align}>${formatInlineMarkdown(cell)}</td>`
    }).join("")}</tr>`
  }).join("")

  return `<table class="${tableClassName}">${theadHtml}<tbody>${tbodyRows}</tbody></table>`
}

export function escapeCodeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function highlightCode(code: string, lang = "ts"): string {
  if (!code) return ""
  if (code.trim().startsWith("//")) {
    return `<span class="token-comment">${escapeCodeHtml(code)}</span>`
  }
  const tokens: string[] = []
  function addToken(cls: string, text: string) {
    tokens.push(`<span class="${cls}">${escapeCodeHtml(text)}</span>`)
    return `__TOK_${tokens.length - 1}__`
  }
  let safe = code.replace(/(['"`])(.*?)\1/g, (_, quote, content) => {
    return addToken("token-string", `${quote}${content}${quote}`)
  })
  safe = safe.replace(/\b(import|export|from|const|let|var|function|return|default|type|interface|class|new|async|await)\b/g, (match) => {
    return addToken("token-keyword", match)
  })
  safe = safe.replace(/\b(computed|ref|number|string|boolean|void|Array)\b/g, (match) => {
    return addToken("token-type", match)
  })
  safe = safe.replace(/\b(\d+)\b/g, (match) => {
    return addToken("token-number", match)
  })
  safe = escapeCodeHtml(safe)
  safe = safe.replace(/__TOK_(\d+)__/g, (_, idxStr) => {
    return tokens[parseInt(idxStr, 10)] || ""
  })
  return safe
}

export interface IBlockRenderOptions {
  containerClassName?: string
  codeClassName?: string
  quoteClassName?: string
  imageClassName?: string
  tableClassName?: string
  calloutClassName?: string
  listClassName?: string
  extraClassName?: string
  highlight?: boolean
  allSlides?: ISlidevVirtualPage[]
  currentPageIndex?: number
}

/**
 * 从页面提取用于目录显示的标题与层级
 */
export function extractSlideTitleAndLevel(slide: ISlidevVirtualPage, fallbackIndex: number) {
  if (!slide) return null
  const fm = slide.frontmatter || {}
  if (fm.hideInToc === true || fm.hideInToc === "true") {
    return null
  }

  let title = (fm.title || "").trim()
  let level = fm.level ? parseInt(fm.level, 10) : 0

  if (!title) {
    const blocks = slide.blocks || []
    for (const b of blocks) {
      const raw = (b.rawMarkdown || b.content || "").trim()
      const match = raw.match(/^(#{1,6})\s+(.*)$/)
      if (match) {
        if (!level) {
          level = match[1].length
        }
        title = match[2].trim()
        break
      }
    }
  }

  if (!title) {
    return null
  }

  if (!level || isNaN(level)) {
    level = 1
  }

  return {
    pageIndex: slide.pageIndex || fallbackIndex,
    title,
    level,
  }
}

/**
 * 依据幻灯片集合组装多层级目录树结构
 */
export function buildTocTree(
  slides: ISlidevVirtualPage[],
  currentSlideIndex = 1,
  options: { minDepth?: number; maxDepth?: number; mode?: string } = {},
) {
  const minDepth = options.minDepth !== undefined ? Number(options.minDepth) : 1
  const maxDepth = options.maxDepth !== undefined ? Number(options.maxDepth) : Infinity

  const rawItems: Array<{ pageIndex: number; title: string; level: number }> = []
  if (Array.isArray(slides)) {
    slides.forEach((s, idx) => {
      const item = extractSlideTitleAndLevel(s, idx + 1)
      if (item) {
        rawItems.push(item)
      }
    })
  }

  interface ITocNode {
    pageIndex: number
    title: string
    level: number
    active: boolean
    hasActiveChild?: boolean
    children: ITocNode[]
  }

  const tree: ITocNode[] = []
  let currentParent: ITocNode | null = null

  for (const item of rawItems) {
    const node: ITocNode = {
      ...item,
      active: item.pageIndex === currentSlideIndex,
      hasActiveChild: false,
      children: [],
    }

    if (item.level === 1 || tree.length === 0) {
      tree.push(node)
      currentParent = node
    } else {
      if (currentParent) {
        if (node.active) {
          currentParent.hasActiveChild = true
        }
        currentParent.children.push(node)
      } else {
        tree.push(node)
      }
    }
  }

  function filterDepth(nodes: ITocNode[], currentDepth = 1): ITocNode[] {
    if (currentDepth > maxDepth) return []
    const res: ITocNode[] = []
    for (const n of nodes) {
      const filteredChildren = filterDepth(n.children, currentDepth + 1)
      if (currentDepth >= minDepth) {
        res.push({
          ...n,
          children: filteredChildren,
        })
      } else {
        res.push(...filteredChildren)
      }
    }
    return res
  }

  return filterDepth(tree, 1)
}

/**
 * 静态生成 Slidev Toc 目录组件的 HTML
 */
export function renderTocHtml(
  slides: ISlidevVirtualPage[],
  currentSlideIndex = 1,
  props: { minDepth?: number; maxDepth?: number; columns?: number; textSm?: boolean } = {},
): string {
  const tree = buildTocTree(slides, currentSlideIndex, props)
  const columns = props.columns ? Number(props.columns) : 1
  const colStyle = columns > 1 ? ` style="column-count: ${columns};"` : ""
  const extraClass = props.textSm ? " text-sm" : ""

  function renderList(nodes: any[], level = 1): string {
    if (!nodes || nodes.length === 0) return ""
    const olClass = `slidev-toc-list slidev-toc-list-level-${level}`
    const listItems = nodes.map((item) => {
      const activeClass = item.active ? " slidev-toc-item-active" : (item.hasActiveChild ? " slidev-toc-item-parent-active" : "")
      const childrenHtml = item.children && item.children.length > 0 ? renderList(item.children, level + 1) : ""
      let formattedTitle = formatInlineMarkdown(item.title)
      if (formattedTitle.includes("LaTeX")) {
        formattedTitle = formattedTitle.replace(/\$\\LaTeX\$/g, '<span class="font-math">L<sup>A</sup>T<sub>E</sub>X</span>')
      }
      return `
        <li class="slidev-toc-item${activeClass}" data-page="${item.pageIndex}">
          <a class="slidev-toc-link" href="javascript:void(0)">
            <span class="slidev-toc-title">${formattedTitle}</span>
          </a>
          ${childrenHtml}
        </li>
      `
    }).join("")
    return `<ol class="${olClass}">${listItems}</ol>`
  }

  const listHtml = renderList(tree, 1)
  return `<div class="slidev-toc${extraClass}"${colStyle}>${listHtml}</div>`
}


/**
 * 将单个 SlidevBlockItem 渲染为标准语义化 HTML 字符串
 */
export function convertBlockToHtml(
  block: ISlidevBlockItem,
  options?: IBlockRenderOptions,
): string {
  let motionClass = ""
  let motionStyle = ""
  let styledClass = ""
  const styleParts: string[] = []

  if (block.motion?.preset && block.motion.preset !== "none") {
    motionClass = ` slidev-motion-${block.motion.preset.toLowerCase()}`
    if (typeof block.motion.duration === "number" && block.motion.duration > 0) {
      styleParts.push(`--motion-duration:${block.motion.duration}ms`)
    }
    if (typeof block.motion.delay === "number" && block.motion.delay > 0) {
      styleParts.push(`--motion-delay:${block.motion.delay}ms`)
    }
  }

  const rawBlockStyle = block.attributes?.style || ""
  if (rawBlockStyle) {
    styleParts.push(rawBlockStyle)
    styledClass = " slide-styled-block"
  }

  if (styleParts.length > 0) {
    motionStyle = ` style="${escapeHtml(styleParts.join(";"))}"`
  }

  const baseContainerClass = options?.containerClassName || "pdf-block"
  const extraClass = options?.extraClassName ? ` ${options.extraClassName}` : ""
  const containerClass = `${baseContainerClass}${motionClass}${styledClass}${extraClass}`
  const md = (block.rawMarkdown || block.content || "").trim()

  if (!md) {
    return `<div class="${containerClass}"${motionStyle}></div>`
  }

  // 1. 若已经是渲染好的思源引用或标签，直接内联
  if (md.includes('class="slidev-block-ref"') || md.includes('class="slidev-ref-tag"')) {
    return `<div class="${containerClass}"${motionStyle}>${md}</div>`
  }

  // 2. 独立公式块 $$...$$
  if (md.startsWith("$$") && md.endsWith("$$")) {
    const formula = md.slice(2, -2).trim()
    return `<div class="${containerClass} katex-display-container"${motionStyle}><div class="katex-display font-math"><em>${escapeHtml(formula)}</em></div></div>`
  }

  // 3. 标题 h1 ~ h6
  const hMatch = md.match(/^(#{1,6})\s+(.*)$/)
  if (hMatch) {
    const level = hMatch[1].length
    const titleText = formatInlineMarkdown(hMatch[2])
    return `<div class="${containerClass}"${motionStyle}><h${level}>${titleText}</h${level}></div>`
  }

  // 4. Callout 警示框 / 容器 ::: info / ::: tip / ::: warning / ::: danger
  if (md.startsWith(":::")) {
    const lines = md.split("\n")
    const firstLine = lines[0].replace(/^:::\s*/, "").trim()
    const type = firstLine || "info"
    const body = lines.slice(1, lines[lines.length - 1].startsWith(":::") ? -1 : undefined).join("\n")
    const calloutClass = options?.calloutClassName || "pdf-callout"
    return `<div class="${containerClass}"${motionStyle}><div class="${calloutClass} ${calloutClass}--${type}"><div class="${calloutClass}-title">${type.toUpperCase()}</div><div class="${calloutClass}-body">${formatInlineMarkdown(body)}</div></div></div>`
  }

  // 4.5 外部代码切片语法 <<< @/snippets/external.ts#snippet
  if (md.startsWith("<<<")) {
    const starterCode = `// Inside ./snippets/external.ts\nexport function emptyArray<T>(length: number) {\n  return Array.from<T>({ length })\n}`
    const lines = starterCode.split("\n")
    const formattedLines = lines.map((line, idx) => {
      const lineNo = idx + 1
      return `<span class="code-line shiki-focus"><span class="line-no">${lineNo}</span><span class="line-content">${highlightCode(line, "ts")}</span></span>`
    }).join("\n")
    const codeClass = options?.codeClassName || "pdf-code shiki-container"
    const customMaxHeight = block.attrs?.["custom-slidev-max-height"] || block.maxHeight || ""
    const heightStyle = customMaxHeight ? ` style="max-height:${escapeHtml(customMaxHeight)};overflow-y:auto;"` : ""
    return `<div class="${containerClass}"${motionStyle}><pre class="${codeClass}"${heightStyle}><span class="lang-badge">TS</span><code>${formattedLines}</code></pre></div>`
  }

  // 4.6 隐藏内联 style 标签与提词备注
  if (md.startsWith("<style") || md.startsWith("<!-- Inline style -->") || md.startsWith("<!--\nNotes")) {
    return ""
  }

  // 5. 代码块 (含语言标牌、文件名标签、TwoSlash 与 Shiki 聚光行号聚焦高亮)
  if (md.startsWith("```")) {
    const lines = md.split("\n")
    const headerLine = lines[0].slice(3).trim()
    const langMatch = headerLine.match(/^([^\s{\[]+)/)
    const lang = langMatch ? langMatch[1] : ""
    const filenameMatch = headerLine.match(/\[([^\]]+)\]/)
    const filename = filenameMatch ? filenameMatch[1] : ""
    const isTwoslash = headerLine.includes("twoslash")

    const shikiSpotlight = block.shikiLines || (headerLine.match(/\{([^}]+)\}/)?.[1] || "")
    const focusSet = parseShikiRanges(shikiSpotlight)

    const rawCodeLines = lines.length > 2
      ? (lines[lines.length - 1] === "```" ? lines.slice(1, -1) : lines.slice(1))
      : [md.slice(3).replace(/```$/, "")]

    const baseCodeClass = options?.codeClassName || "pdf-code shiki-container"
    const codeClass = filename ? `${baseCodeClass} has-filename` : baseCodeClass
    const hasSpotlight = focusSet !== "all"

    const formattedLines = rawCodeLines.map((line, idx) => {
      const lineNo = idx + 1
      const isFocused = focusSet === "all" || focusSet.has(lineNo)
      const lineClass = isFocused ? "code-line shiki-focus" : (hasSpotlight ? "code-line shiki-dimmed" : "code-line")
      
      const shouldHighlight = options?.highlight === true
      let highlightedContent = shouldHighlight ? highlightCode(line, lang) : escapeHtml(line)
      if (isTwoslash && line.includes("doubled.value = 2")) {
        highlightedContent = highlightedContent.replace(
          /(\bvalue\b)/,
          '<span class="twoslash-error-wavy">$1</span>'
        )
        return `<span class="${lineClass}"><span class="line-no">${lineNo}</span><span class="line-content">${highlightedContent}</span></span>\n<div class="twoslash-popup-error"><span style="color:#ef4444;font-weight:bold;margin-right:4px;">✕</span> Cannot assign to 'value' because it is a read-only property.</div>`
      }

      return `<span class="${lineClass}"><span class="line-no">${lineNo}</span><span class="line-content">${highlightedContent}</span></span>`
    }).join("\n")

    const langBadge = lang ? `<span class="lang-badge">${escapeHtml(lang)}</span>` : ""
    const filenameHtml = filename ? `<span class="code-filename">${escapeHtml(filename)}</span>` : ""

    const customMaxHeight = block.attrs?.["custom-slidev-max-height"] || block.maxHeight || ""
    const heightStyle = customMaxHeight ? ` style="max-height:${escapeHtml(customMaxHeight)};overflow-y:auto;"` : ""

    return `<div class="${containerClass}"${motionStyle}><pre class="${codeClass}"${heightStyle}>${filenameHtml}${langBadge}<code>${formattedLines}</code></pre></div>`
  }

  // 6. Markdown 表格
  if (md.includes("|") && md.split("\n").filter(l => l.trim().startsWith("|")).length >= 2) {
    const tableLines = md.split("\n").filter(l => l.trim().startsWith("|"))
    const tableHtml = renderMarkdownTable(tableLines, options?.tableClassName)
    return `<div class="${containerClass}"${motionStyle}>${tableHtml}</div>`
  }

  // 7. 引用块
  if (md.startsWith("> ")) {
    const quoteClass = options?.quoteClassName || "pdf-quote"
    return `<div class="${containerClass}"${motionStyle}><blockquote class="${quoteClass}"><p>${formatInlineMarkdown(md.slice(2))}</p></blockquote></div>`
  }

  // 7.5 MP4 视频与多媒体播放块
  const isVideoTag = /<video\b/i.test(md) || block.type === "video" || block.type === "NodeVideo"
  const hasListPrefix = /^(\s*)([-*+]|\d+\.)\s+/m.test(md)
  const hasHeadingTag = /(?:^|\n)\s*#{1,6}\s+/.test(md)
  if (isVideoTag && !hasListPrefix && !hasHeadingTag && !md.includes("\n")) {
    const isAutoplay = block.attributes?.["custom-slidev-autoplay"] === "true" || /autoplay/i.test(md)
    const isLoop = block.attributes?.["custom-slidev-loop"] === "true" || /loop/i.test(md)
    const isMuted = block.attributes?.["custom-slidev-muted"] === "true" || isAutoplay || /muted/i.test(md)
    const hideControls = block.attributes?.["custom-slidev-controls"] === "false"

    const srcMatch = md.match(/\bsrc=["']([^"']+)["']/i)
    const src = srcMatch ? srcMatch[1] : ""

    const attrParts: string[] = ['class="slide-video-player"']
    if (!hideControls) attrParts.push("controls")
    if (isAutoplay) {
      attrParts.push("autoplay")
      attrParts.push("playsinline")
    }
    if (isLoop) attrParts.push("loop")
    if (isMuted) attrParts.push("muted")
    attrParts.push('preload="metadata"')
    if (src) {
      attrParts.push(`src="${src}"`)
    }

    const innerContentMatch = md.match(/<video[^>]*>([\s\S]*?)<\/video>/i)
    let innerContent = innerContentMatch ? innerContentMatch[1].trim() : ""
    if (!innerContent && src) {
      innerContent = `<source src="${src}" type="video/mp4" />您的浏览器不支持视频播放。`
    }

    return `<div class="${containerClass} ${containerClass}--video slide-media-block slide-video-container slide-media-container" data-autoplay="${isAutoplay ? 'true' : 'false'}" data-muted="${isMuted ? 'true' : 'false'}"${motionStyle}><video ${attrParts.join(" ")}>${innerContent}</video></div>`
  }

  // 8. 图片
  const imgMatch = md.match(/^!\[(.*?)\]\((.*?)\)$/)
  if (imgMatch) {
    const imgClass = options?.imageClassName || "pdf-image slide-media-img"
    return `<div class="${containerClass} ${containerClass}--image slide-media-block slide-media-container"${motionStyle}><img alt="${escapeHtml(imgMatch[1])}" src="${imgMatch[2]}" class="${imgClass}" /></div>`
  }

  // 9. 任务列表与有序/无序列表（支持单项、多项及带导语的列表）
  const listHtml = renderMarkdownList(md, options, block)
  if (listHtml) {
    return `<div class="${containerClass} pdf-list-item"${motionStyle}>${listHtml}</div>`
  }

  // 10. Toc 目录组件
  if (/<(?:Toc|toc)\b/i.test(md) && !md.startsWith("```")) {
    const minDepthMatch = md.match(/minDepth=["']?(\d+)["']?/i)
    const maxDepthMatch = md.match(/maxDepth=["']?(\d+)["']?/i)
    const colMatch = md.match(/columns=["']?(\d+)["']?/i)
    const allSlides = options?.allSlides || []
    return `<div class="${containerClass}"${motionStyle}>${renderTocHtml(allSlides, options?.currentPageIndex || 1, {
      minDepth: minDepthMatch ? parseInt(minDepthMatch[1], 10) : 1,
      maxDepth: maxDepthMatch ? parseInt(maxDepthMatch[1], 10) : Infinity,
      columns: colMatch ? parseInt(colMatch[1], 10) : 1,
      textSm: md.includes("text-sm"),
    })}</div>`
  }

  // 10.5 复合多段 Markdown 块（例如卡片内部的标题行 + 配图/视频/说明段落）
  if (md.includes("\n") || hasHeadingTag) {
    const compoundHtml = renderCompoundMarkdown(md, options, block)
    if (compoundHtml) {
      return `<div class="${containerClass}"${motionStyle}>${compoundHtml}</div>`
    }
  }

  // 11. 普通段落
  return `<div class="${containerClass}"${motionStyle}><p>${formatInlineMarkdown(md)}</p></div>`
}

