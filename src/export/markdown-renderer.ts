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
 * 行内 Markdown 转义与渲染 (加粗、斜体、删除线、行内代码、数学公式、链接、v-mark手绘圈选)
 */
export function formatInlineMarkdown(text: string): string {
  if (!text) return ""
  let res = escapeHtml(text)

  // 1. 手绘标记 <v-mark type="circle">text</v-mark> 或 <v-mark>text</v-mark>
  res = res.replace(/&lt;v-mark(?:\s+type=&quot;([a-zA-Z-]+)&quot;)?&gt;([\s\S]*?)&lt;\/v-mark&gt;/g, (_, type, content) => {
    const markType = type || "circle"
    return `<mark class="v-mark v-mark--${markType}">${content}</mark>`
  })

  // 2. 行内数学公式 $formula$
  res = res.replace(/\$([^$\n]+)\$/g, '<span class="katex-inline font-math"><em>$1</em></span>')

  // 3. 链接 [title](url)
  res = res.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="slidev-link">$1</a>')

  // 4. 加粗 **text**
  res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")

  // 5. 斜体 *text*
  res = res.replace(/\*(.*?)\*/g, "<em>$1</em>")

  // 6. 删除线 ~~text~~
  res = res.replace(/~~(.*?)~~/g, "<del>$1</del>")

  // 7. 行内代码 `code`
  res = res.replace(/`([^`]+)`/g, "<code>$1</code>")

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

export interface IBlockRenderOptions {
  containerClassName?: string
  codeClassName?: string
  quoteClassName?: string
  imageClassName?: string
  tableClassName?: string
  calloutClassName?: string
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
  if (block.motion?.preset && block.motion.preset !== "none") {
    motionClass = ` slidev-motion-${block.motion.preset.toLowerCase()}`
    const styleParts: string[] = []
    if (typeof block.motion.duration === "number" && block.motion.duration > 0) {
      styleParts.push(`--motion-duration:${block.motion.duration}ms`)
    }
    if (typeof block.motion.delay === "number" && block.motion.delay > 0) {
      styleParts.push(`--motion-delay:${block.motion.delay}ms`)
    }
    if (styleParts.length > 0) {
      motionStyle = ` style="${styleParts.join(";")}"`
    }
  }

  const baseContainerClass = options?.containerClassName || "pdf-block"
  const containerClass = `${baseContainerClass}${motionClass}`
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

  // 5. 代码块 (含语言标牌与 Shiki 聚光行号聚焦高亮)
  if (md.startsWith("```")) {
    const lines = md.split("\n")
    const headerLine = lines[0].slice(3).trim()
    // 匹配语言与可能的聚光高亮如 "ts {1-3|5}"
    const langMatch = headerLine.match(/^([^\s{]+)/)
    const lang = langMatch ? langMatch[1] : ""
    const shikiSpotlight = block.shikiLines || (headerLine.match(/\{([^}]+)\}/)?.[1] || "")
    const focusSet = parseShikiRanges(shikiSpotlight)

    const rawCodeLines = lines.length > 2
      ? (lines[lines.length - 1] === "```" ? lines.slice(1, -1) : lines.slice(1))
      : [md.slice(3).replace(/```$/, "")]

    const codeClass = options?.codeClassName || "pdf-code shiki-container"
    const hasSpotlight = focusSet !== "all"

    const formattedLines = rawCodeLines.map((line, idx) => {
      const lineNo = idx + 1
      const isFocused = focusSet === "all" || focusSet.has(lineNo)
      const lineClass = isFocused ? "code-line shiki-focus" : (hasSpotlight ? "code-line shiki-dimmed" : "code-line")
      return `<span class="${lineClass}"><span class="line-no">${lineNo}</span><span class="line-content">${escapeHtml(line)}</span></span>`
    }).join("\n")

    const langBadge = lang ? `<span class="lang-badge">${escapeHtml(lang)}</span>` : ""

    return `<div class="${containerClass}"${motionStyle}><pre class="${codeClass}">${langBadge}<code>${formattedLines}</code></pre></div>`
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

  // 8. 图片
  const imgMatch = md.match(/^!\[(.*?)\]\((.*?)\)$/)
  if (imgMatch) {
    const imgClass = options?.imageClassName || "pdf-image"
    return `<div class="${containerClass} ${containerClass}--image"${motionStyle}><img alt="${escapeHtml(imgMatch[1])}" src="${imgMatch[2]}" class="${imgClass}" /></div>`
  }

  // 9. 任务列表项 - [ ] 或 - [x]
  const taskMatch = md.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/)
  if (taskMatch) {
    const isChecked = taskMatch[1].toLowerCase() === "x"
    const taskText = formatInlineMarkdown(taskMatch[2])
    const checkedAttr = isChecked ? ' checked=""' : ""
    return `<div class="${containerClass} pdf-list-item pdf-task-item"${motionStyle}><label><input type="checkbox" disabled=""${checkedAttr}/> <span>${taskText}</span></label></div>`
  }

  // 10. 无序列表项
  if (/^[-*+]\s+/.test(md)) {
    const listText = md.replace(/^[-*+]\s+/, "")
    return `<div class="${containerClass} pdf-list-item"${motionStyle}><li>${formatInlineMarkdown(listText)}</li></div>`
  }

  // 11. 有序列表项
  if (/^\d+\.\s+/.test(md)) {
    const listText = md.replace(/^\d+\.\s+/, "")
    return `<div class="${containerClass} pdf-list-item pdf-list-item--ordered"${motionStyle}><li>${formatInlineMarkdown(listText)}</li></div>`
  }

  // 12. 普通段落
  return `<div class="${containerClass}"${motionStyle}><p>${formatInlineMarkdown(md)}</p></div>`
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
  const blocks = slide.blocks || []

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
    const leftClass = options?.leftColClass || "pdf-col pdf-col--left"
    const rightClass = options?.rightColClass || "pdf-col pdf-col--right"

    return `
      <div class="${wrapperClass}">
        <div class="${leftClass}">${leftHtml}</div>
        <div class="${rightClass}">${rightHtml}</div>
      </div>
    `
  }

  // 2. 带表头的双栏布局 (two-cols-header)
  if (layout === "two-cols-header") {
    const hasRightSlot = blocks.some(b => b.slot === "right")
    const headerBlocks: ISlidevBlockItem[] = []
    const leftBlocks: ISlidevBlockItem[] = []
    const rightBlocks: ISlidevBlockItem[] = []

    if (hasRightSlot) {
      let isHeader = true
      for (const b of blocks) {
        if (b.slot === "right") {
          isHeader = false
          rightBlocks.push(b)
        } else if (b.slot === "left") {
          isHeader = false
          leftBlocks.push(b)
        } else if (isHeader && (b.type === "h" || headerBlocks.length === 0)) {
          headerBlocks.push(b)
        } else {
          leftBlocks.push(b)
        }
      }
    } else {
      if (blocks.length > 0) {
        headerBlocks.push(blocks[0])
        const rem = blocks.slice(1)
        const mid = Math.ceil(rem.length / 2)
        leftBlocks.push(...rem.slice(0, mid))
        rightBlocks.push(...rem.slice(mid))
      }
    }

    const headerHtml = headerBlocks.map(b => convertBlockToHtml(b, options)).join("\n")
    const leftHtml = leftBlocks.map(b => convertBlockToHtml(b, options)).join("\n")
    const rightHtml = rightBlocks.map(b => convertBlockToHtml(b, options)).join("\n")

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

  // 3. 大字报版式 (fact)
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
