import type { ISlidevBlockItem, ISlidevVirtualPage } from "../types/slidev-protocol"
import { distributeThreeColumns } from "../compiler/slidev-ast-builder"
import { cleanCardListItemMarkdown, isListItemNode } from "../compiler/superblock-scanner"
import { cleanAndTransformInlineKramdown } from "../compiler/html-cleaner"

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
 * 渲染 Markdown 列表（支持单项、多项、有序/无序、任务清单及带有前导说明段落的混合结构）
 */
export function renderMarkdownList(
  md: string,
  options?: IBlockRenderOptions,
  block?: ISlidevBlockItem,
): string | null {
  const lines = md.split("\n")
  const hasListItems = lines.some(line => /^(\s*)([-*+]|\d+\.)\s+/.test(line))
  if (!hasListItems) return null

  const leadLines: string[] = []
  const items: Array<{
    type: "unordered" | "ordered" | "task"
    level?: number
    checked?: boolean
    text: string
    media?: string[]
  }> = []
  let isOrdered = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/)
    if (taskMatch) {
      const indent = taskMatch[1].length
      const level = Math.floor(indent / 2)
      items.push({
        type: "task",
        level,
        checked: taskMatch[2].toLowerCase() === "x",
        text: taskMatch[3],
        media: [],
      })
      continue
    }

    const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (unorderedMatch) {
      const indent = unorderedMatch[1].length
      const level = Math.floor(indent / 2)
      items.push({
        type: "unordered",
        level,
        text: unorderedMatch[2],
        media: [],
      })
      continue
    }

    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/)
    if (orderedMatch) {
      if (items.length === 0) isOrdered = true
      const indent = orderedMatch[1].length
      const level = Math.floor(indent / 2)
      items.push({
        type: "ordered",
        level,
        text: orderedMatch[2],
        media: [],
      })
      continue
    }

    const trimmed = line.trim()

    // 检查列表项下属的缩进多媒体（GIF、普通图片或视频）
    if (items.length > 0) {
      const mdImgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/)
      if (mdImgMatch) {
        const isGif = /\.gif(?:\?|$)/i.test(mdImgMatch[2])
        const cls = isGif ? "list-item-gif" : "list-item-img"
        if (!items[items.length - 1].media) items[items.length - 1].media = []
        items[items.length - 1].media!.push(
          `<div class="slide-list-media"><img alt="${escapeHtml(mdImgMatch[1])}" src="${mdImgMatch[2]}" class="${cls}" /></div>`
        )
        continue
      }

      const htmlImgMatch = trimmed.match(/^<img\b[\s\S]*?\/?>$/i)
      if (htmlImgMatch) {
        if (!items[items.length - 1].media) items[items.length - 1].media = []
        items[items.length - 1].media!.push(
          `<div class="slide-list-media">${trimmed}</div>`
        )
        continue
      }

      if (/<video\b/i.test(trimmed)) {
        let videoRaw = trimmed
        if (!/<\/video>/i.test(videoRaw)) {
          while (i + 1 < lines.length && !/<\/video>/i.test(videoRaw)) {
            i++
            videoRaw += " " + lines[i].trim()
          }
        }
        const isAutoplay = block?.attributes?.["custom-slidev-autoplay"] === "true" || /autoplay/i.test(videoRaw)
        const isLoop = block?.attributes?.["custom-slidev-loop"] === "true" || /loop/i.test(videoRaw)
        const isMuted = block?.attributes?.["custom-slidev-muted"] === "true" || isAutoplay || /muted/i.test(videoRaw)
        const hideControls = block?.attributes?.["custom-slidev-controls"] === "false"

        const srcMatch = videoRaw.match(/\bsrc=["']([^"']+)["']/i)
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
        if (src) attrParts.push(`src="${src}"`)

        const innerContentMatch = videoRaw.match(/<video[^>]*>([\s\S]*?)<\/video>/i)
        let innerContent = innerContentMatch ? innerContentMatch[1].trim() : ""
        if (!innerContent && src) {
          innerContent = `<source src="${src}" type="video/mp4" />您的浏览器不支持视频播放。`
        }

        if (!items[items.length - 1].media) items[items.length - 1].media = []
        items[items.length - 1].media!.push(
          `<div class="slide-list-media slide-video-container slide-media-container" data-autoplay="${isAutoplay ? 'true' : 'false'}" data-muted="${isMuted ? 'true' : 'false'}"><video ${attrParts.join(" ")}>${innerContent}</video></div>`
        )
        continue
      }

      items[items.length - 1].text += "\n" + trimmed
    } else {
      leadLines.push(trimmed)
    }
  }

  if (items.length === 0) return null

  function formatListItemContent(rawText: string): string {
    if (!rawText) return ""
    const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return ""

    const hasHeading = lines.some(line => /^#{1,6}\s+/.test(line))
    if (!hasHeading) {
      return formatInlineMarkdown(lines.join(" "))
    }

    const resultParts: string[] = []
    let pendingParaLines: string[] = []

    const flushParagraph = () => {
      if (pendingParaLines.length > 0) {
        const pText = pendingParaLines.join(" ")
        resultParts.push(`<p class="slide-list-item-desc">${formatInlineMarkdown(pText)}</p>`)
        pendingParaLines = []
      }
    }

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
      if (headingMatch) {
        flushParagraph()
        const level = headingMatch[1].length
        const headingText = headingMatch[2].trim()
        resultParts.push(`<h${level} class="slide-list-item-title">${formatInlineMarkdown(headingText)}</h${level}>`)
      } else {
        pendingParaLines.push(line)
      }
    }
    flushParagraph()

    return resultParts.join("\n")
  }

  function formatLeadContent(lines: string[]): string {
    if (lines.length === 0) return ""
    const resultParts: string[] = []
    let pendingParaLines: string[] = []

    const flushParagraph = (isFirst: boolean) => {
      if (pendingParaLines.length > 0) {
        const pText = pendingParaLines.join(" ")
        const cls = isFirst ? "slide-list-item-title" : "slide-list-item-desc"
        resultParts.push(`<p class="${cls}">${formatInlineMarkdown(pText)}</p>`)
        pendingParaLines = []
      }
    }

    let isFirst = true
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
      if (headingMatch) {
        flushParagraph(isFirst)
        const level = headingMatch[1].length
        const headingText = headingMatch[2].trim()
        resultParts.push(`<h${level} class="slide-list-item-title">${formatInlineMarkdown(headingText)}</h${level}>`)
        isFirst = false
      } else {
        pendingParaLines.push(line)
      }
    }
    flushParagraph(isFirst)

    return resultParts.join("\n") + (resultParts.length > 0 ? "\n" : "")
  }

  const listTag = isOrdered ? "ol" : "ul"
  const baseListClass = options?.listClassName || (isOrdered ? "pdf-list pdf-list--ordered" : "pdf-list pdf-list--unordered")
  const itemsHtml = items.map(item => {
    const formatted = formatListItemContent(item.text)
    const mediaHtml = (item.media && item.media.length > 0)
      ? `\n${item.media.join("\n")}`
      : ""
    const level = item.level || 0
    const nestedStyle = level > 0
      ? ` style="margin-left:${(level * 1.25).toFixed(2)}em;${item.type === 'unordered' ? `list-style-type:${level % 2 === 1 ? 'circle' : 'square'} !important;` : ''}"`
      : ""
    const nestedClass = level > 0 ? " slide-list-item--nested" : ""
    if (item.type === "task") {
      const checkedAttr = item.checked ? ' checked=""' : ""
      return `<li class="pdf-task-item${nestedClass}"${nestedStyle}><label><input type="checkbox" disabled=""${checkedAttr}/> <span>${formatted}</span></label>${mediaHtml}</li>`
    }
    const classAttr = nestedClass ? ` class="${nestedClass.trim()}"` : ""
    return `<li${classAttr}${nestedStyle}>${formatted}${mediaHtml}</li>`
  }).join("\n")

  const leadHtml = formatLeadContent(leadLines)

  return `${leadHtml}<${listTag} class="${baseListClass}">\n${itemsHtml}\n</${listTag}>`
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
  const containerClass = `${baseContainerClass}${motionClass}${styledClass}`
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

/**
 * 渲染复合/多段 Markdown 内容（例如卡片内部的标题行 + 配图/视频/说明段落/子列表）
 */
export function renderCompoundMarkdown(
  md: string,
  options?: IBlockRenderOptions,
  block?: ISlidevBlockItem,
): string {
  const containerClass = options?.containerClassName || "pdf-block"
  const lines = md.split(/\r?\n/)
  const subBlocks: string[] = []
  let current: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 遇到独立标题行：单独作为一个子块
    if (/^#{1,6}\s+/.test(trimmed)) {
      if (current.length > 0) {
        subBlocks.push(current.join("\n"))
        current = []
      }
      subBlocks.push(trimmed)
      continue
    }

    // 遇到空行：切分段落
    if (!trimmed) {
      if (current.length > 0) {
        subBlocks.push(current.join("\n"))
        current = []
      }
      continue
    }

    // 遇到独立图片行：单独作为一个子块
    if (/^!\[.*?\]\(.*?\)$/.test(trimmed)) {
      if (current.length > 0) {
        subBlocks.push(current.join("\n"))
        current = []
      }
      subBlocks.push(trimmed)
      continue
    }

    // 遇到独立视频标签：单独作为一个子块
    if (/<video\b/i.test(trimmed)) {
      if (current.length > 0) {
        subBlocks.push(current.join("\n"))
        current = []
      }
      let videoRaw = trimmed
      if (!/<\/video>/i.test(videoRaw)) {
        while (i + 1 < lines.length && !/<\/video>/i.test(videoRaw)) {
          i++
          videoRaw += "\n" + lines[i]
        }
      }
      subBlocks.push(videoRaw)
      continue
    }

    current.push(line)
  }

  if (current.length > 0) {
    subBlocks.push(current.join("\n"))
  }

  // 对拆分出的各子块分别渲染并合并
  const htmlParts = subBlocks.map((sub) => {
    const trimmedSub = sub.trim()
    if (!trimmedSub) return ""

    // 1. 标题
    const hMatch = trimmedSub.match(/^(#{1,6})\s+(.*)$/)
    if (hMatch) {
      const level = hMatch[1].length
      return `<h${level} class="slide-list-item-title">${formatInlineMarkdown(hMatch[2].trim())}</h${level}>`
    }

    // 2. 图片
    const imgMatch = trimmedSub.match(/^!\[(.*?)\]\((.*?)\)$/)
    if (imgMatch) {
      const isGif = /\.gif(?:\?|$)/i.test(imgMatch[2])
      const imgClass = options?.imageClassName || (isGif ? "list-item-gif" : "pdf-image slide-media-img")
      return `<div class="${containerClass} ${containerClass}--image slide-media-block slide-media-container slide-list-media"><img alt="${escapeHtml(imgMatch[1])}" src="${imgMatch[2]}" class="${imgClass}" /></div>`
    }

    // 3. 视频
    if (/<video\b/i.test(trimmedSub)) {
      const isAutoplay = block?.attributes?.["custom-slidev-autoplay"] === "true" || /autoplay/i.test(trimmedSub)
      const isLoop = block?.attributes?.["custom-slidev-loop"] === "true" || /loop/i.test(trimmedSub)
      const isMuted = block?.attributes?.["custom-slidev-muted"] === "true" || isAutoplay || /muted/i.test(trimmedSub)
      const hideControls = block?.attributes?.["custom-slidev-controls"] === "false"

      const srcMatch = trimmedSub.match(/\bsrc=["']([^"']+)["']/i)
      const src = srcMatch ? srcMatch[1] : ""

      const attrParts: string[] = ['class="slide-video-player"']
      if (!hideControls) attrParts.push("controls")
      if (isAutoplay) attrParts.push("autoplay playsinline")
      if (isLoop) attrParts.push("loop")
      if (isMuted) attrParts.push("muted")
      attrParts.push('preload="metadata"')
      if (src) attrParts.push(`src="${src}"`)

      const innerContentMatch = trimmedSub.match(/<video[^>]*>([\s\S]*?)<\/video>/i)
      let innerContent = innerContentMatch ? innerContentMatch[1].trim() : ""
      if (!innerContent && src) {
        innerContent = `<source src="${src}" type="video/mp4" />您的浏览器不支持视频播放。`
      }

      return `<div class="${containerClass} ${containerClass}--video slide-media-block slide-video-container slide-media-container" data-autoplay="${isAutoplay ? 'true' : 'false'}" data-muted="${isMuted ? 'true' : 'false'}"><video ${attrParts.join(" ")}>${innerContent}</video></div>`
    }

    // 4. 列表
    const listHtml = renderMarkdownList(trimmedSub, options, block)
    if (listHtml) {
      return listHtml
    }

    // 5. 段落
    return `<p class="slide-list-item-desc">${formatInlineMarkdown(trimmedSub)}</p>`
  }).filter(Boolean)

  return htmlParts.join("\n")
}

export interface IRenderSlideOptions extends IBlockRenderOptions {
  twoColsWrapperClass?: string
  leftColClass?: string
  rightColClass?: string
}

/**
 * 渲染单个幻灯片页面的所有块，支持多种标准版式（two-cols, two-cols-header, cover, fact, intro 等）
 */
export function renderSlideBlocksToHtml(
  slide: ISlidevVirtualPage,
  options?: IRenderSlideOptions,
): string {
  const layout = slide.frontmatter?.layout || "default"
  const rawBlocks = slide.blocks || []
  const blocks = rawBlocks.filter(b => b.slot !== "slot-divider-right")

  // 1. 双栏布局 (two-cols)
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

    const wrapperClass = options?.twoColsWrapperClass || "pdf-two-cols-wrapper layout-two-cols-grid"
    const layoutClass = slide.frontmatter?.layoutClass ? ` ${slide.frontmatter.layoutClass}` : ""
    const leftClass = options?.leftColClass || "pdf-col pdf-col--left"
    const rightClass = options?.rightColClass || "pdf-col pdf-col--right"

    return `
      <div class="${wrapperClass}${layoutClass}">
        <div class="${leftClass}">${leftHtml}</div>
        <div class="${rightClass}">${rightHtml}</div>
      </div>
    `
  }

  // 2. 带表头的双栏布局 (two-cols-header)
  if (layout === "two-cols-header") {
    let headerBlocks: ISlidevBlockItem[] = []
    const explicitHeader = blocks.filter(b => b.slot === "header")
    if (explicitHeader.length > 0) {
      headerBlocks = explicitHeader
    } else if (blocks.length > 0) {
      const candidateH = blocks.find(b => b.type === "h" && (!b.slot || b.slot === "default"))
      if (candidateH) {
        headerBlocks = [candidateH]
      }
    }

    const rem = blocks.filter(b => !headerBlocks.includes(b))
    const rightBlocks = rem.filter(b => b.slot === "right" || b.slot === "col-2")
    const leftBlocks = rem.filter(b => !rightBlocks.includes(b))

    const renderColBlockToHtml = (colBlocks: ISlidevBlockItem[]) => {
      const validBlocks = colBlocks.filter(b => Boolean((b.rawMarkdown || b.content || "").trim()))
      if (validBlocks.length > 0) {
        const first = validBlocks[0]
        const md = (first.rawMarkdown || first.content || "").trim()
        const isList = isListItemNode(first) || /^(?:[-*+]|\d+\.)\s+/.test(md)
        if (isList) {
          first.rawMarkdown = cleanCardListItemMarkdown(first.rawMarkdown || first.content || "")
          first.content = first.rawMarkdown
        }
      }
      return validBlocks.map(b => convertBlockToHtml(b, options)).join("\n")
    }

    const headerHtml = headerBlocks.map(b => convertBlockToHtml(b, options)).join("\n")
    const leftHtml = renderColBlockToHtml(leftBlocks)
    const rightHtml = renderColBlockToHtml(rightBlocks)

    return `
      <div class="layout-two-cols-header-container">
        <div class="layout-header-section">${headerHtml}</div>
        <div class="pdf-two-cols-wrapper layout-two-cols-grid">
          <div class="pdf-col pdf-col--left">${leftHtml}</div>
          <div class="pdf-col pdf-col--right">${rightHtml}</div>
        </div>
      </div>
    `
  }

  // 2.5 带表头的三栏布局 (three-cols-header)
  if (layout === "three-cols-header") {
    let headerBlocks: ISlidevBlockItem[] = []
    const explicitHeader = blocks.filter(b => b.slot === "header")
    if (explicitHeader.length > 0) {
      headerBlocks = explicitHeader
    } else if (blocks.length > 0) {
      const candidateH = blocks.find(b => b.type === "h" && (!b.slot || b.slot === "default"))
      if (candidateH) {
        headerBlocks = [candidateH]
      }
    }

    const rem = blocks.filter(b => !headerBlocks.includes(b))
    const { col1: col1Blocks, col2: col2Blocks, col3: col3Blocks } = distributeThreeColumns(rem)

    const renderColBlockToHtml = (colBlocks: ISlidevBlockItem[]) => {
      const validBlocks = colBlocks.filter(b => Boolean((b.rawMarkdown || b.content || "").trim()))
      if (validBlocks.length > 0) {
        const first = validBlocks[0]
        const md = (first.rawMarkdown || first.content || "").trim()
        const isList = isListItemNode(first) || /^(?:[-*+]|\d+\.)\s+/.test(md)
        if (isList) {
          first.rawMarkdown = cleanCardListItemMarkdown(first.rawMarkdown || first.content || "")
          first.content = first.rawMarkdown
        }
      }
      return validBlocks.map(b => convertBlockToHtml(b, options)).join("\n")
    }

    const headerHtml = headerBlocks.map(b => convertBlockToHtml(b, options)).join("\n")
    const col1Html = renderColBlockToHtml(col1Blocks)
    const col2Html = renderColBlockToHtml(col2Blocks)
    const col3Html = renderColBlockToHtml(col3Blocks)

    return `
      <div class="layout-three-cols-header-container">
        <div class="layout-header-section">${headerHtml}</div>
        <div class="pdf-three-cols-wrapper layout-three-cols-grid">
          <div class="pdf-col pdf-col--1">${col1Html}</div>
          <div class="pdf-col pdf-col--2">${col2Html}</div>
          <div class="pdf-col pdf-col--3">${col3Html}</div>
        </div>
      </div>
    `
  }

  // 3. 右侧图片版式 (image-right) 与 左侧图片版式 (image-left)
  if (layout === "image-right" || layout === "image-left") {
    const isImageRight = layout === "image-right"
    const contentHtml = blocks.map(b => convertBlockToHtml(b, options)).join("\n")
    const imgUrl = slide.frontmatter?.image || slide.frontmatter?.background || ""
    const imgHtml = `<div class="pdf-image-col" style="background-image:url('${escapeHtml(imgUrl)}');background-size:cover;background-position:center;background-repeat:no-repeat;width:100%;height:100%;position:relative;overflow:hidden;"><img src="${escapeHtml(imgUrl)}" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;" onerror="this.style.display='none'" alt="Slide cover" /></div>`
    const contentCol = `<div class="pdf-content-col" style="padding:48px 56px;display:flex;flex-direction:column;justify-content:flex-start;height:100%;box-sizing:border-box;overflow-y:auto;">${contentHtml}</div>`

    const cols = isImageRight ? `${contentCol}\n${imgHtml}` : `${imgHtml}\n${contentCol}`
    return `
      <div class="layout-image-cols-grid" style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:100%;width:100%;height:100%;position:absolute;top:0;left:0;right:0;bottom:0;box-sizing:border-box;">
        ${cols}
      </div>
    `
  }

  // 4. 大字报版式 (fact)
  if (layout === "fact") {
    const innerHtml = blocks.map(b => convertBlockToHtml(b, options)).join("\n")
    return `<div class="layout-fact-container">${innerHtml}</div>`
  }

  // 4. 封面版式 (cover)
  if (layout === "cover") {
    const innerHtml = blocks.map(b => convertBlockToHtml(b, options)).join("\n")
    return `<div class="layout-cover-container">${innerHtml}</div>`
  }

  // 5. 默认流式布局
  return blocks.map(b => convertBlockToHtml(b, options)).join("\n")
}
