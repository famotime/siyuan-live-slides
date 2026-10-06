import type { ISlidevBlockItem, ISlidevVirtualPage } from "../types/slidev-protocol"
import { distributeThreeColumns } from "../compiler/slidev-ast-builder"
import { cleanCardListItemMarkdown, isListItemNode } from "../utils"
import { convertBlockToHtml, escapeHtml } from "./markdown-renderer"
import type { IBlockRenderOptions } from "./markdown-renderer"

export interface IRenderSlideOptions extends IBlockRenderOptions {
  twoColsWrapperClass?: string
  leftColClass?: string
  rightColClass?: string
}

/**
 * 渲染单个幻灯片页面的所有块，支持多种标准版式（two-cols, two-cols-header, three-cols-header, cover, fact, image-left, image-right 等）
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
