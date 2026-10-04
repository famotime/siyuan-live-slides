import type {
  ISiYuanBlockNode,
  ISlidePageFrontmatter,
  ISlidevMotionConfig,
  ISlidevPluginConfig,
} from "../types/slidev-protocol"
import {
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_COLOR_SCHEMA,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_HIGHLIGHTER,
  ATTR_DOC_THEME,
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_SHIKI_LINES,
  ATTR_ELEM_SLOT,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_CLASS,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_NOTES,
  ATTR_PAGE_SLIDE,
  ATTR_PAGE_TRANSITION,
} from "../types/slidev-protocol"

/** 默认全局配置 */
export const DEFAULT_SLIDEV_CONFIG: ISlidevPluginConfig = {
  theme: "default",
  aspectRatio: "16/9",
  highlighter: "shiki",
  defaultTransition: "slide-left",
  colorSchema: "auto",
}

/**
 * 解析文档根节点全局属性 (Document Scope)
 */
export function parseDocumentConfig(
  attrs?: Record<string, string> | null,
): ISlidevPluginConfig {
  if (!attrs) {
    return { ...DEFAULT_SLIDEV_CONFIG }
  }

  return {
    theme: attrs[ATTR_DOC_THEME]?.trim() || DEFAULT_SLIDEV_CONFIG.theme,
    aspectRatio: (attrs[ATTR_DOC_ASPECT_RATIO]?.trim() as any) || DEFAULT_SLIDEV_CONFIG.aspectRatio,
    highlighter: (attrs[ATTR_DOC_HIGHLIGHTER]?.trim() as any) || DEFAULT_SLIDEV_CONFIG.highlighter,
    defaultTransition: attrs[ATTR_DOC_DEFAULT_TRANSITION]?.trim() || DEFAULT_SLIDEV_CONFIG.defaultTransition,
    colorSchema: (attrs[ATTR_DOC_COLOR_SCHEMA]?.trim() as any) || DEFAULT_SLIDEV_CONFIG.colorSchema,
  }
}

/**
 * 判断是否为分页分界块 (Thematic Break 或显式标记 custom-slidev-slide)
 */
export function isPageBreak(node: ISiYuanBlockNode): boolean {
  // 1. 显式属性标记 custom-slidev-slide = "true" | "page" | "cover" | "end"
  const slideAttr = node.ial?.[ATTR_PAGE_SLIDE]
  if (slideAttr && (slideAttr === "true" || slideAttr === "page" || slideAttr === "cover" || slideAttr === "end")) {
    return true
  }

  // 2. 原生思源水平分割线块 (ThematicBreak, 思源内核中 type 为 "tb" 或 "NodeThematicBreak", markdown 为 "---" / "***")
  if (
    node.type === "tb"
    || node.type === "thematic-break"
    || node.type === "NodeThematicBreak"
    || node.markdown?.trim() === "---"
    || node.markdown?.trim() === "***"
    || (node.type === "b" && (node.markdown?.trim() === "---" || node.content?.trim() === "---"))
  ) {
    return true
  }

  return false
}

/**
 * 解析页面级属性 (Page Scope，承载于水平分割线或起始块)
 */
export function parsePageAttrs(
  attrs?: Record<string, string> | null,
): { frontmatter: ISlidePageFrontmatter; notes: string } {
  const frontmatter: ISlidePageFrontmatter = {}
  let notes = ""

  if (!attrs) {
    return { frontmatter, notes }
  }

  if (attrs[ATTR_PAGE_LAYOUT]) {
    frontmatter.layout = attrs[ATTR_PAGE_LAYOUT].trim()
  }

  if (attrs[ATTR_PAGE_TRANSITION]) {
    frontmatter.transition = attrs[ATTR_PAGE_TRANSITION].trim()
  }

  if (attrs[ATTR_PAGE_BACKGROUND]) {
    frontmatter.background = attrs[ATTR_PAGE_BACKGROUND].trim()
  }

  if (attrs[ATTR_PAGE_CLASS]) {
    frontmatter.class = attrs[ATTR_PAGE_CLASS].trim()
  }

  if (attrs[ATTR_PAGE_NOTES]) {
    notes = attrs[ATTR_PAGE_NOTES].trim()
  }

  // 保留所有其他扩展 custom-slidev-* 属性到 frontmatter (如 layoutClass, level, title, hideInToc 等)
  for (const [k, v] of Object.entries(attrs)) {
    if (
      k.startsWith("custom-slidev-") &&
      ![
        ATTR_PAGE_LAYOUT,
        ATTR_PAGE_TRANSITION,
        ATTR_PAGE_BACKGROUND,
        ATTR_PAGE_CLASS,
        ATTR_PAGE_NOTES,
        ATTR_PAGE_SLIDE,
      ].includes(k)
    ) {
      const propKey = k.replace(/^custom-slidev-/, "")
      try {
        frontmatter[propKey] = JSON.parse(v)
      } catch {
        frontmatter[propKey] = v
      }
    }
  }

  return { frontmatter, notes }
}

/**
 * 解析元素动效级属性 (Element Scope，承载于普通内容块)
 */
export function parseElementAttrs(
  attrs?: Record<string, string> | null,
): {
  clicks?: string
  motion?: ISlidevMotionConfig
  shikiLines?: string
  slot?: "left" | "right" | "default" | string
} {
  const result: {
    clicks?: string
    motion?: ISlidevMotionConfig
    shikiLines?: string
    slot?: string
  } = {}

  if (!attrs) {
    return result
  }

  if (attrs[ATTR_ELEM_CLICK] !== undefined && attrs[ATTR_ELEM_CLICK] !== null) {
    result.clicks = attrs[ATTR_ELEM_CLICK].trim()
  }

  if (attrs[ATTR_ELEM_MOTION]) {
    try {
      const parsed = JSON.parse(attrs[ATTR_ELEM_MOTION])
      if (typeof parsed === "object" && parsed !== null) {
        result.motion = {
          preset: parsed.preset || parsed.type || "fade-in",
          ...parsed,
        }
      } else {
        result.motion = { preset: String(parsed).trim() }
      }
    } catch {
      // 容错处理：若非 JSON 则保留字符串预设
      result.motion = { preset: attrs[ATTR_ELEM_MOTION].trim() }
    }
  }

  if (attrs[ATTR_ELEM_SHIKI_LINES]) {
    result.shikiLines = attrs[ATTR_ELEM_SHIKI_LINES].trim()
  }

  if (attrs[ATTR_ELEM_SLOT]) {
    result.slot = attrs[ATTR_ELEM_SLOT].trim()
  }

  return result
}
