import type { ISlidevBlockItem } from "../types/slidev-protocol"
import { escapeHtml, formatInlineMarkdown } from "./markdown-renderer"
import type { IBlockRenderOptions } from "./markdown-renderer"

/**
 * 格式化列表项内嵌富文本，支持内嵌标题识别
 */
export function formatListItemContent(rawText: string): string {
  if (!rawText) return ""
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return ""

  const hasHeading = lines.some(line => /^#{1,6}\s+/.test(line))
  if (!hasHeading) {
    return lines.map(l => formatInlineMarkdown(l)).join("<br/>")
  }

  const resultParts: string[] = []
  let pendingParaLines: string[] = []

  const flushParagraph = () => {
    if (pendingParaLines.length > 0) {
      const pText = pendingParaLines.map(l => formatInlineMarkdown(l)).join("<br/>")
      resultParts.push(`<p class="slide-list-item-desc">${pText}</p>`)
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

/**
 * 格式化列表前置说明导语段落（首行作为栏目标题去圆点，后续各行作为说明段落自然分行）
 */
export function formatLeadContent(lines: string[]): string {
  if (lines.length === 0) return ""
  const resultParts: string[] = []

  // 1. 首行独立作为栏目标题
  const firstLine = lines[0]
  const firstHeadingMatch = firstLine.match(/^(#{1,6})\s+(.*)$/)
  if (firstHeadingMatch) {
    const level = firstHeadingMatch[1].length
    const headingText = firstHeadingMatch[2].trim()
    resultParts.push(`<h${level} class="slide-list-item-title">${formatInlineMarkdown(headingText)}</h${level}>`)
  } else {
    resultParts.push(`<p class="slide-list-item-title">${formatInlineMarkdown(firstLine)}</p>`)
  }

  // 2. 剩余行作为说明段落，自然换行
  if (lines.length > 1) {
    const descLines = lines.slice(1)
    let pendingParaLines: string[] = []

    const flushParagraph = () => {
      if (pendingParaLines.length > 0) {
        const pText = pendingParaLines.map(l => formatInlineMarkdown(l)).join("<br/>")
        resultParts.push(`<p class="slide-list-item-desc">${pText}</p>`)
        pendingParaLines = []
      }
    }

    for (const line of descLines) {
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
  }

  return resultParts.join("\n") + (resultParts.length > 0 ? "\n" : "")
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
    if (!trimmed || /^\{:.*?\}$/.test(trimmed)) continue

    // 检查列表项下属的缩进多媒体（GIF、普通图片或视频）
    if (items.length > 0) {
      const mdImgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)(?:\{:?[^}]*\})?$/)
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
        const cleanImgHtml = trimmed.replace(/\s+style="[^"]*"/gi, "")
        if (!items[items.length - 1].media) items[items.length - 1].media = []
        items[items.length - 1].media!.push(
          `<div class="slide-list-media">${cleanImgHtml}</div>`
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
  let isFirstParagraph = true
  const htmlParts = subBlocks.map((sub) => {
    const trimmedSub = sub.trim()
    if (!trimmedSub) return ""

    // 1. 标题
    const hMatch = trimmedSub.match(/^(#{1,6})\s+(.*)$/)
    if (hMatch) {
      isFirstParagraph = false
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
      isFirstParagraph = false
      return listHtml
    }

    // 5. 段落 (首个段落作为卡片/分栏首行标题，赋予 slide-list-item-title，后续换行/段落作为说明描述)
    if (isFirstParagraph) {
      isFirstParagraph = false
      const subLines = trimmedSub.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (subLines.length === 1) {
        return `<p class="slide-list-item-title">${formatInlineMarkdown(subLines[0])}</p>`
      }
      const titleLine = subLines[0]
      const descLines = subLines.slice(1)
      const descHtml = descLines.map(l => formatInlineMarkdown(l)).join("<br/>")
      return `<p class="slide-list-item-title">${formatInlineMarkdown(titleLine)}</p>\n<p class="slide-list-item-desc">${descHtml}</p>`
    }
    return `<p class="slide-list-item-desc">${formatInlineMarkdown(trimmedSub)}</p>`
  }).filter(Boolean)

  return htmlParts.join("\n")
}
