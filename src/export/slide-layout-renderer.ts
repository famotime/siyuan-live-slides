import type { ISlidesBlockItem, ISlidesVirtualPage } from "../types/slides-protocol"
import { isColsHeaderLayout } from "../types/slides-protocol"
import { distributeNColumns } from "../compiler/slides-ast-builder"
import { cleanCardListItemMarkdown, isListItemNode, parseRatioToGridCols } from "../utils"
import { convertBlockToHtml, escapeHtml } from "./markdown-renderer"
import type { IBlockRenderOptions } from "./markdown-renderer"

export interface IRenderSlideOptions extends IBlockRenderOptions {
  twoColsWrapperClass?: string
  leftColClass?: string
  rightColClass?: string
}

function isHeadingBlock(b: ISlidesBlockItem): boolean {
  if (!b) return false
  if (b.type === "h" || b.type === "NodeHeading") return true
  const md = (b.rawMarkdown || b.content || "").trim()
  return /^#{1,6}\s+/.test(md)
}

/**
 * 渲染单个幻灯片页面的所有块，支持多种标准版式（two-cols, cols-header, two-cols-header, three-cols-header, cover, fact, image-left, image-right 等）
 */
export function renderSlideBlocksToHtml(
  slide: ISlidesVirtualPage,
  options?: IRenderSlideOptions,
): string {
  const layout = slide.frontmatter?.layout || "default"
  const rawBlocks = slide.blocks || []
  const blocks = rawBlocks.filter(b => b.slot !== "slot-divider-right")
  const isCover = layout === "cover"
  const pageFirstH = !isCover ? blocks.find(isHeadingBlock) : null

  // 1. 双栏布局 (two-cols)
  if (layout === "two-cols") {
    const hasRightSlot = blocks.some(b => b.slot === "right")
    let leftBlocks: ISlidesBlockItem[] = []
    let rightBlocks: ISlidesBlockItem[] = []

    if (hasRightSlot) {
      leftBlocks = blocks.filter(b => b.slot !== "right")
      rightBlocks = blocks.filter(b => b.slot === "right")
    } else {
      const mid = Math.ceil(blocks.length / 2)
      leftBlocks = blocks.slice(0, mid)
      rightBlocks = blocks.slice(mid)
    }

    const cleanFirstList = (list: ISlidesBlockItem[]) => {
      const valid = list.filter(b => Boolean((b.rawMarkdown || b.content || "").trim()))
      if (valid.length > 0) {
        const first = valid[0]
        const md = (first.rawMarkdown || first.content || "").trim()
        const isList = isListItemNode(first) || /^(?:[-*+]|\d+\.)\s+/.test(md)
        if (isList) {
          first.rawMarkdown = cleanCardListItemMarkdown(first.rawMarkdown || first.content || "")
          first.content = first.rawMarkdown
        }
      }
    }
    cleanFirstList(leftBlocks)
    cleanFirstList(rightBlocks)

    const leftHtml = leftBlocks.map(b => convertBlockToHtml(b, options)).join("\n")
    const rightHtml = rightBlocks.map(b => convertBlockToHtml(b, options)).join("\n")

    const wrapperClass = options?.twoColsWrapperClass || "pdf-two-cols-wrapper layout-two-cols-grid"
    const layoutClass = slide.frontmatter?.layoutClass ? ` ${slide.frontmatter.layoutClass}` : ""
    const leftClass = options?.leftColClass || "pdf-col pdf-col--left"
    const rightClass = options?.rightColClass || "pdf-col pdf-col--right"
    const gridCols = parseRatioToGridCols(slide.frontmatter?.layoutRatio, 2)
    const gridStyle = `style="grid-template-columns: ${gridCols};"`

    return `
      <div class="${wrapperClass}${layoutClass}" ${gridStyle}>
        <div class="${leftClass}">${leftHtml}</div>
        <div class="${rightClass}">${rightHtml}</div>
      </div>
    `
  }

  // 2. 带表头的多栏布局 (通用 cols-header 与历史兼容 two-cols-header, three-cols-header，以及四叶草 2x2 clover)
  if (layout === "clover" || isColsHeaderLayout(layout)) {
    const isClover = layout === "clover"
    let headerBlocks: ISlidesBlockItem[] = []
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

    // 确定栏数 targetCols (自适应 2~N 栏，四叶草固定为 4 象限)
    let targetCols = 2
    if (isClover) {
      targetCols = 4
    } else if (layout === "three-cols-header") {
      targetCols = 3
    } else if (layout === "two-cols-header") {
      targetCols = 2
    } else {
      let maxCol = 0
      for (const b of rem) {
        const m = (b.slot || "").match(/^col-(\d+)$/i)
        if (m) maxCol = Math.max(maxCol, parseInt(m[1], 10))
      }
      if (maxCol >= 2) {
        targetCols = maxCol
      } else if (slide.frontmatter?.layoutRatio) {
        const r = slide.frontmatter.layoutRatio.trim()
        if (r.includes(":")) {
          const parts = r.split(":").map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0)
          if (parts.length >= 2) targetCols = parts.length
        } else {
          const tokens = r.split(/\s+/).filter(Boolean)
          if (tokens.length >= 2) targetCols = tokens.length
        }
      } else if (rem.length === 1 && rem[0].children && rem[0].children.length >= 2) {
        targetCols = Math.min(6, rem[0].children.length)
      }
    }

    const cols = distributeNColumns(rem, targetCols)

    const hasColSlots = rem.some(b => b.slot && /^(?:col-\d+|left|right)$/i.test(b.slot))
    const isSuperBlockCols =
      layout === "clover" ||
      layout === "two-cols-header" ||
      layout === "three-cols-header" ||
      (isColsHeaderLayout(layout) && hasColSlots)

    const renderColBlockToHtml = (colBlocks: ISlidesBlockItem[]) => {
      const validBlocks = colBlocks.filter(b => Boolean((b.rawMarkdown || b.content || "").trim()))
      if (isSuperBlockCols && validBlocks.length > 0) {
        const first = validBlocks[0]
        const md = (first.rawMarkdown || first.content || "").trim()
        const isList = isListItemNode(first) || /^(?:[-*+]|\d+\.)\s+/.test(md)
        if (isList) {
          first.rawMarkdown = cleanCardListItemMarkdown(first.rawMarkdown || first.content || "")
          first.content = first.rawMarkdown
        }
        first.isColFirst = true
      }
      const colFirstH = isSuperBlockCols ? validBlocks.find(isHeadingBlock) : null
      return validBlocks.map(b => {
        const extraClass = b === colFirstH ? "slides-col-first-heading-block" : ""
        return convertBlockToHtml(b, { ...options, extraClassName: extraClass })
      }).join("\n")
    }

    const headerFirstH = headerBlocks.find(isHeadingBlock)
    const headerHtml = headerBlocks.map(b => {
      const extraClass = b === headerFirstH ? "slides-page-first-heading-block" : ""
      return convertBlockToHtml(b, { ...options, extraClassName: extraClass })
    }).join("\n")
    const gridCols = isClover
      ? "repeat(2, minmax(0, 1fr))"
      : parseRatioToGridCols(slide.frontmatter?.layoutRatio, targetCols)
    const gridStyle = isClover
      ? `style="grid-template-columns: ${gridCols}; grid-template-rows: repeat(2, minmax(0, 1fr));"`
      : `style="grid-template-columns: ${gridCols};"`

    const containerClasses = [
      isClover ? "layout-clover-container" : "layout-cols-header-container",
      targetCols === 2 ? "layout-two-cols-header-container" : "",
      targetCols === 3 ? "layout-three-cols-header-container" : "",
      `layout-${layout}-container`,
      isSuperBlockCols ? "has-superblock-cols" : "",
    ].filter(Boolean).join(" ")

    const wrapperClasses = [
      isClover ? "layout-clover-grid pdf-clover-wrapper" : "layout-cols-wrapper layout-cols-grid",
      targetCols === 2 ? "pdf-two-cols-wrapper layout-two-cols-grid" : "",
      targetCols === 3 ? "pdf-three-cols-wrapper layout-three-cols-grid" : "",
      isSuperBlockCols ? "has-superblock-cols" : "",
    ].filter(Boolean).join(" ")

    const colsHtml = cols.map((colBlocks, idx) => {
      const colNum = idx + 1
      const colClass = [
        "pdf-col",
        targetCols === 2 && colNum === 1 ? "pdf-col--left" : "",
        targetCols === 2 && colNum === 2 ? "pdf-col--right" : "",
        `pdf-col--${colNum}`,
        `col-${colNum}`,
      ].filter(Boolean).join(" ")
      return `<div class="${colClass}">${renderColBlockToHtml(colBlocks)}</div>`
    }).join("\n")

    return `
      <div class="${containerClasses}">
        <div class="layout-header-section">${headerHtml}</div>
        <div class="${wrapperClasses}" ${gridStyle}>
          ${colsHtml}
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
    const gridCols = parseRatioToGridCols(slide.frontmatter?.layoutRatio, 2)
    return `
      <div class="layout-image-cols-grid" style="display:grid;grid-template-columns:${gridCols};grid-template-rows:100%;width:100%;height:100%;position:absolute;top:0;left:0;right:0;bottom:0;box-sizing:border-box;">
        ${cols}
      </div>
    `
  }

  // 4. 大字报版式 (fact) - 极致放大的核心指标与发光微光氛围
  if (layout === "fact") {
    const validBlocks = blocks.filter(b => Boolean((b.rawMarkdown || b.content || "").trim()))
    const firstBlock = validBlocks[0]
    const otherBlocks = validBlocks.slice(1)

    const firstHtml = firstBlock ? convertBlockToHtml(firstBlock, { ...options, extraClassName: "fact-value" }) : ""
    const otherHtml = otherBlocks.map(b => convertBlockToHtml(b, { ...options, extraClassName: "fact-label" })).join("\n")

    return `
      <div class="layout-fact-container">
        <div class="fact-hero-glow" aria-hidden="true"></div>
        <div class="fact-content-box">
          <div class="fact-value-wrapper">${firstHtml}</div>
          ${otherHtml ? `<div class="fact-divider-line"></div><div class="fact-label-wrapper">${otherHtml}</div>` : ""}
        </div>
      </div>
    `
  }

  // 4.5 时间线 / 步骤流程版式 (timeline / steps)
  if (layout === "timeline" || layout === "steps") {
    let headerBlocks: ISlidesBlockItem[] = []
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
    const headerHtml = headerBlocks.map(b => convertBlockToHtml(b, { ...options, extraClassName: "slides-page-first-heading-block" })).join("\n")

    let stepItems: ISlidesBlockItem[] = []
    if (rem.length === 1 && rem[0].children && rem[0].children.length >= 2) {
      stepItems = rem[0].children
    } else if (rem.length >= 2) {
      stepItems = rem
    } else if (rem.length === 1) {
      const md = (rem[0].rawMarkdown || rem[0].content || "").trim()
      const listLines = md.split("\n").filter(l => /^(\s*)([-*+]|\d+\.)\s+/.test(l))
      if (listLines.length >= 2) {
        stepItems = listLines.map((line, idx) => ({
          id: `${rem[0].id}-step-${idx}`,
          type: "p",
          rawMarkdown: line.replace(/^(\s*)([-*+]|\d+\.)\s+/, "").trim(),
          content: line.replace(/^(\s*)([-*+]|\d+\.)\s+/, "").trim(),
        }))
      } else {
        stepItems = rem
      }
    }

    const stepsCount = Math.max(1, Math.min(6, stepItems.length))
    const stepsHtml = stepItems.map((item, idx) => {
      const stepNum = idx + 1
      const itemHtml = convertBlockToHtml(item, options)
      return `
        <div class="timeline-step-item" style="--step-index: ${stepNum};">
          <div class="timeline-node-container">
            <div class="timeline-node-badge">${stepNum}</div>
            ${stepNum < stepItems.length ? '<div class="timeline-connector-line"></div>' : ""}
          </div>
          <div class="timeline-step-content">${itemHtml}</div>
        </div>
      `
    }).join("\n")

    return `
      <div class="layout-timeline-container layout-steps-container">
        ${headerHtml ? `<div class="layout-header-section">${headerHtml}</div>` : ""}
        <div class="timeline-track-wrapper" style="--timeline-steps: ${stepsCount};">
          ${stepsHtml}
        </div>
      </div>
    `
  }

  // 5. 引言版式 (quote)
  if (layout === "quote") {
    const validBlocks = blocks.filter(b => Boolean((b.rawMarkdown || b.content || "").trim()))
    let quoteBlocks = validBlocks
    let authorBlock: ISlidesBlockItem | null = null

    // 检查末尾块是否为作者/出处（以 —、--、—— 开头，或显式 author 角色）
    if (validBlocks.length >= 2) {
      const last = validBlocks[validBlocks.length - 1]
      const md = (last.rawMarkdown || last.content || "").trim()
      if (/^(?:—|--|——|-)\s*/.test(md) || last.ial?.["custom-slides-role"] === "author") {
        authorBlock = last
        quoteBlocks = validBlocks.slice(0, -1)
      }
    }

    const quoteHtml = quoteBlocks.map(b => convertBlockToHtml(b, { ...options, extraClassName: "quote-body" })).join("\n")
    const authorHtml = authorBlock ? convertBlockToHtml(authorBlock, { ...options, extraClassName: "quote-author" }) : ""

    return `
      <div class="layout-quote-container">
        <div class="quote-watermark-icon" aria-hidden="true">“</div>
        <div class="quote-content-body">
          <div class="quote-text">${quoteHtml}</div>
          ${authorHtml ? `<div class="quote-footer">${authorHtml}</div>` : ""}
        </div>
      </div>
    `
  }

  // 6. 人物介绍版式 (intro)
  if (layout === "intro") {
    const avatarUrl = slide.frontmatter?.image || slide.frontmatter?.background || ""
    const contentBlocks = blocks.filter(b => {
      // 若某个块本身是与 avatarUrl 完全匹配的图片块，避免在右侧重复渲染
      const md = (b.rawMarkdown || b.content || "").trim()
      if (avatarUrl && md.includes(avatarUrl)) return false
      return true
    })
    const contentHtml = contentBlocks.map(b => convertBlockToHtml(b, options)).join("\n")

    const avatarHtml = avatarUrl
      ? `<div class="intro-avatar-box"><img class="intro-avatar-img" src="${escapeHtml(avatarUrl)}" alt="Avatar" onerror="this.style.display='none'" /></div>`
      : `<div class="intro-avatar-box intro-avatar-box--placeholder"><svg class="intro-avatar-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>`

    return `
      <div class="layout-intro-container">
        <div class="intro-avatar-col">${avatarHtml}</div>
        <div class="intro-info-col">${contentHtml}</div>
      </div>
    `
  }

  // 7. 居中版式 (center)
  if (layout === "center") {
    const innerHtml = blocks.map(b => convertBlockToHtml(b, options)).join("\n")
    return `<div class="layout-center-container">${innerHtml}</div>`
  }

  // 8. 封面版式 (cover)
  if (layout === "cover") {
    const innerHtml = blocks.map(b => convertBlockToHtml(b, options)).join("\n")
    return `<div class="layout-cover-container">${innerHtml}</div>`
  }

  // 9. 默认流式布局
  return blocks.map(b => {
    const extraClass = b === pageFirstH ? "slides-page-first-heading-block" : ""
    return convertBlockToHtml(b, { ...options, extraClassName: extraClass })
  }).join("\n")
}
