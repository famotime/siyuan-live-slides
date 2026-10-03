import type {
  ISiYuanBlockNode,
  ISlidevBlockItem,
  ISlidevDocument,
  ISlidevVirtualPage,
} from "../types/slidev-protocol"
import type { IAssetRewriteOptions } from "./assets-rewriter"
import { extractBlockMarkdown } from "./ast-crawler"
import { rewriteAssetPaths, rewriteSingleAssetUrl } from "./assets-rewriter"
import {
  isPageBreak,
  parseDocumentConfig,
  parseElementAttrs,
  parsePageAttrs,
} from "./scope-mapper"

/**
 * 序列化 Frontmatter 对象为 YAML 字符串
 */
export function stringifyFrontmatter(data: Record<string, any>): string {
  const entries = Object.entries(data).filter(([_, val]) => val !== undefined && val !== null && val !== "")
  if (entries.length === 0) {
    return ""
  }

  const lines = entries.map(([key, val]) => {
    if (typeof val === "string") {
      // 若字符串包含特殊字符换行或冒号，用引号包裹
      if (val.includes(":") || val.includes("\n") || val.includes("#")) {
        return `${key}: "${val.replace(/"/g, '\\"')}"`
      }
      return `${key}: ${val}`
    }
    return `${key}: ${JSON.stringify(val)}`
  })

  return `---\n${lines.join("\n")}\n---`
}

/**
 * 处理代码块中的 Shiki 聚光高亮行标
 * 示例: ```ts 加上 {1-3|5} -> ```ts {1-3|5}
 */
export function injectShikiSpotlight(markdown: string, shikiLines?: string): string {
  if (!shikiLines || !markdown.startsWith("```")) {
    return markdown
  }

  const firstLineEnd = markdown.indexOf("\n")
  if (firstLineEnd === -1) {
    return markdown
  }

  const firstLine = markdown.slice(0, firstLineEnd).trim()
  const rest = markdown.slice(firstLineEnd)

  // 如果已经带有花括号标记，不重复注入
  if (firstLine.includes("{")) {
    return markdown
  }

  return `${firstLine} {${shikiLines}}${rest}`
}

/**
 * 包装带有 v-click 渐进出现的块
 */
export function wrapVClickDirective(markdown: string, clicks?: string): string {
  if (clicks === undefined || clicks === null) {
    return markdown
  }

  const trimmed = clicks.trim()
  if (trimmed === "" || trimmed === "+1") {
    return `<v-click>\n\n${markdown}\n\n</v-click>`
  }

  if (trimmed === "hide") {
    return `<v-click hide>\n\n${markdown}\n\n</v-click>`
  }

  return `<v-click at="${trimmed}">\n\n${markdown}\n\n</v-click>`
}

/**
 * 构建完整的 Slidev 虚拟文档与 Markdown 载荷
 */
export function buildSlidevDocument(
  docId: string,
  docAttrs: Record<string, string> | null | undefined,
  blocks: ISiYuanBlockNode[],
  options?: IAssetRewriteOptions,
): ISlidevDocument {
  const config = parseDocumentConfig(docAttrs)
  const slides: ISlidevVirtualPage[] = []

  // 1. 初始化第一页（封面页或默认页）
  const initialPageAttrs = parsePageAttrs(docAttrs)
  let currentPage: ISlidevVirtualPage = {
    pageIndex: 1,
    startBlockId: docId,
    frontmatter: {
      layout: initialPageAttrs.frontmatter.layout || "cover",
      ...initialPageAttrs.frontmatter,
    },
    notes: initialPageAttrs.notes,
    blocks: [],
    rawMarkdown: "",
  }
  slides.push(currentPage)

  // 2. 遍历所有块节点进行三层作用域归类
  for (const node of blocks) {
    if (isPageBreak(node)) {
      // 遇到水平分割线或显式切页标记，开启新幻灯片
      const pageMeta = parsePageAttrs(node.ial)
      currentPage = {
        pageIndex: slides.length + 1,
        startBlockId: node.id,
        frontmatter: {
          layout: pageMeta.frontmatter.layout || "default",
          ...pageMeta.frontmatter,
        },
        notes: pageMeta.notes,
        blocks: [],
        rawMarkdown: "",
      }

      // 如果背景路径是本地 assets，予以重写
      if (currentPage.frontmatter.background) {
        currentPage.frontmatter.background = rewriteSingleAssetUrl(
          currentPage.frontmatter.background,
          options,
        )
      }

      slides.push(currentPage)
      continue
    }

    // 普通内容块处理
    const elemAttrs = parseElementAttrs(node.ial)
    let rawMd = extractBlockMarkdown(node)

    // 重写本地资源路径
    rawMd = rewriteAssetPaths(rawMd, options)

    // 注入 Shiki 代码高亮行号
    if (elemAttrs.shikiLines) {
      rawMd = injectShikiSpotlight(rawMd, elemAttrs.shikiLines)
    }

    const blockItem: ISlidevBlockItem = {
      id: node.id,
      type: node.type,
      content: node.content || "",
      rawMarkdown: rawMd,
      clicks: elemAttrs.clicks,
      motion: elemAttrs.motion,
      shikiLines: elemAttrs.shikiLines,
      slot: elemAttrs.slot,
      attributes: node.ial,
    }

    currentPage.blocks.push(blockItem)
  }

  // 3. 为每一页组装 Slidev 规范 Markdown 片段
  for (let i = 0; i < slides.length; i++) {
    const page = slides[i]
    const parts: string[] = []

    // 注入 Frontmatter（第一页额外注入全局 config 配置）
    const fmData = { ...page.frontmatter }
    if (i === 0) {
      fmData.theme = config.theme
      fmData.aspectRatio = config.aspectRatio
      fmData.highlighter = config.highlighter
      fmData.transition = page.frontmatter.transition || config.defaultTransition
    }

    const fmYaml = stringifyFrontmatter(fmData)
    if (fmYaml) {
      parts.push(fmYaml)
    }

    // 组织多栏插槽或常规内容
    const leftBlocks = page.blocks.filter(b => b.slot === "left")
    const rightBlocks = page.blocks.filter(b => b.slot === "right")

    if (page.frontmatter.layout === "two-cols" && (leftBlocks.length > 0 || rightBlocks.length > 0)) {
      // 双栏布局：分别输出默认/左栏与 ::right:: 右栏
      const renderBlocks = (list: ISlidevBlockItem[]) =>
        list.map(b => wrapVClickDirective(b.rawMarkdown, b.clicks)).join("\n\n")

      const leftContent = renderBlocks(leftBlocks.length > 0 ? leftBlocks : page.blocks.filter(b => b.slot !== "right"))
      const rightContent = renderBlocks(rightBlocks)

      parts.push(leftContent)
      if (rightContent) {
        parts.push(`::right::\n\n${rightContent}`)
      }
    } else {
      // 常规单栏布局
      for (const block of page.blocks) {
        parts.push(wrapVClickDirective(block.rawMarkdown, block.clicks))
      }
    }

    // 注入演讲者备注 Notes
    if (page.notes) {
      parts.push(`<!--\n${page.notes}\n-->`)
    }

    page.rawMarkdown = parts.join("\n\n").trim()
  }

  // 4. 组装整篇幻灯片的 fullMarkdown
  const fullMarkdown = slides
    .map(s => s.rawMarkdown)
    .filter(Boolean)
    .join("\n\n---\n\n")

  return {
    docId,
    config,
    slides,
    fullMarkdown,
  }
}
