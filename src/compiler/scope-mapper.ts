import type {
  ISiYuanBlockNode,
  ISlidePageFrontmatter,
  ISlidesMotionConfig,
  ISlidesPluginConfig,
} from "../types/slides-protocol"
import {
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_COLOR_SCHEMA,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_HIGHLIGHTER,
  ATTR_DOC_THEME,
  ATTR_DOC_SPACING,
  ATTR_PAGE_SPACING,
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_NOTE,
  ATTR_ELEM_ROLE,
  ATTR_ELEM_MAX_HEIGHT,
  ROLE_BACKGROUND,
  ROLE_IMAGE_LEFT,
  ROLE_IMAGE_RIGHT,
  ATTR_ELEM_SHIKI_LINES,
  ATTR_ELEM_SLOT,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_CLASS,
  ATTR_PAGE_IMAGE,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
  ATTR_PAGE_MASK,
  ATTR_PAGE_MASK_RATIO,
  ATTR_PAGE_MASK_STYLE,
  ATTR_PAGE_MASK_INITIAL,
  ATTR_PAGE_NOTES,
  ATTR_PAGE_SLIDE,
  ATTR_PAGE_TRANSITION,
} from "../types/slides-protocol"

import { getRuntimeSettings } from "../settings"

/** 默认全局配置 */
export const DEFAULT_SLIDES_CONFIG: ISlidesPluginConfig = {
  theme: "default",
  aspectRatio: "16/9",
  highlighter: "shiki",
  defaultTransition: "slide-left",
  colorSchema: "auto",
  spacing: "normal",
  normalizeHeadingSizes: false,
}

/**
 * 解析文档根节点全局属性 (Document Scope)
 */
export function parseDocumentConfig(
  attrs?: Record<string, string> | null,
): ISlidesPluginConfig {
  const globalSettings = getRuntimeSettings()
  if (!attrs) {
    return { ...DEFAULT_SLIDES_CONFIG, normalizeHeadingSizes: globalSettings.normalizeHeadingSizes }
  }

  return {
    theme: attrs[ATTR_DOC_THEME]?.trim() || DEFAULT_SLIDES_CONFIG.theme,
    aspectRatio: (attrs[ATTR_DOC_ASPECT_RATIO]?.trim() as any) || DEFAULT_SLIDES_CONFIG.aspectRatio,
    highlighter: (attrs[ATTR_DOC_HIGHLIGHTER]?.trim() as any) || DEFAULT_SLIDES_CONFIG.highlighter,
    defaultTransition: attrs[ATTR_DOC_DEFAULT_TRANSITION]?.trim() || DEFAULT_SLIDES_CONFIG.defaultTransition,
    colorSchema: (attrs[ATTR_DOC_COLOR_SCHEMA]?.trim() as any) || DEFAULT_SLIDES_CONFIG.colorSchema,
    spacing: (attrs[ATTR_DOC_SPACING]?.trim() as any) || DEFAULT_SLIDES_CONFIG.spacing,
    normalizeHeadingSizes: globalSettings.normalizeHeadingSizes,
  }
}

/**
 * 判断是否为分页分界块 (Thematic Break 或显式标记 custom-slides-slide)
 */
export function isPageBreak(node: ISiYuanBlockNode): boolean {
  // 1. 显式属性标记 custom-slides-slide = "true" | "page" | "cover" | "end"
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

  if (attrs[ATTR_PAGE_IMAGE]) {
    frontmatter.image = attrs[ATTR_PAGE_IMAGE].trim()
  }

  if (attrs[ATTR_PAGE_CLASS]) {
    frontmatter.class = attrs[ATTR_PAGE_CLASS].trim()
  }

  if (attrs[ATTR_PAGE_SPACING]) {
    frontmatter.spacing = attrs[ATTR_PAGE_SPACING].trim()
  }

  if (attrs[ATTR_PAGE_LAYOUT_RATIO]) {
    frontmatter.layoutRatio = attrs[ATTR_PAGE_LAYOUT_RATIO].trim()
  }

  if (attrs[ATTR_PAGE_MASK]) {
    frontmatter.mask = attrs[ATTR_PAGE_MASK].trim()
  }

  if (attrs[ATTR_PAGE_MASK_RATIO]) {
    frontmatter.maskRatio = attrs[ATTR_PAGE_MASK_RATIO].trim()
  }

  if (attrs[ATTR_PAGE_MASK_STYLE]) {
    frontmatter.maskStyle = attrs[ATTR_PAGE_MASK_STYLE].trim()
  }

  if (attrs[ATTR_PAGE_MASK_INITIAL]) {
    frontmatter.maskInitial = attrs[ATTR_PAGE_MASK_INITIAL].trim()
  }

  if (attrs[ATTR_PAGE_NOTES]) {
    notes = attrs[ATTR_PAGE_NOTES].trim()
  }

  // 保留所有其他扩展 custom-slides-* 属性到 frontmatter (如 layoutClass, level, title, hideInToc 等)
  for (const [k, v] of Object.entries(attrs)) {
    if (
      k.startsWith("custom-slides-") &&
      ![
        ATTR_PAGE_LAYOUT,
        ATTR_PAGE_LAYOUT_RATIO,
        ATTR_PAGE_MASK,
        ATTR_PAGE_MASK_RATIO,
        ATTR_PAGE_MASK_STYLE,
        ATTR_PAGE_MASK_INITIAL,
        ATTR_PAGE_TRANSITION,
        ATTR_PAGE_BACKGROUND,
        ATTR_PAGE_IMAGE,
        ATTR_PAGE_CLASS,
        ATTR_PAGE_SPACING,
        ATTR_PAGE_NOTES,
        ATTR_PAGE_SLIDE,
      ].includes(k)
    ) {
      const propKey = k.replace(/^custom-slides-/, "")
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
  motion?: ISlidesMotionConfig
  shikiLines?: string
  maxHeight?: string
  slot?: "left" | "right" | "default" | string
  isNote?: boolean
  isBackground?: boolean
  imageLayout?: "image-left" | "image-right" | string
  style?: string
} {
  const result: {
    clicks?: string
    motion?: ISlidesMotionConfig
    shikiLines?: string
    maxHeight?: string
    slot?: string
    isNote?: boolean
    isBackground?: boolean
    imageLayout?: string
    style?: string
  } = {}

  if (!attrs) {
    return result
  }

  // 讲稿备注块识别：命中 custom-slides-note 或 slidev-note
  const noteAttr = attrs[ATTR_ELEM_NOTE] ?? attrs["slides-note"]
  if (noteAttr !== undefined && noteAttr !== null && noteAttr !== "" && noteAttr !== "false" && noteAttr !== "0") {
    result.isNote = true
  }

  // 页面背景图识别：命中 custom-slides-role="background" 或 custom-slides-background="true"
  const roleAttr = attrs[ATTR_ELEM_ROLE] ?? attrs["slides-role"]
  const bgAttr = attrs[ATTR_PAGE_BACKGROUND] ?? attrs["slides-background"]
  if (roleAttr === ROLE_BACKGROUND || bgAttr === "true" || bgAttr === "1") {
    result.isBackground = true
  }

  // 图左 / 图右图片排版识别：命中 custom-slides-layout="image-left" | "image-right" 或 custom-slides-role
  const layoutAttr = attrs[ATTR_PAGE_LAYOUT] ?? attrs["slides-layout"]
  if (layoutAttr === ROLE_IMAGE_LEFT || layoutAttr === ROLE_IMAGE_RIGHT) {
    result.imageLayout = layoutAttr
  } else if (roleAttr === ROLE_IMAGE_LEFT || roleAttr === ROLE_IMAGE_RIGHT) {
    result.imageLayout = roleAttr
  }

  const clickAttr = attrs[ATTR_ELEM_CLICK] ?? attrs["custom-slides-clicks"] ?? attrs["slides-click"] ?? attrs["slides-clicks"]
  if (clickAttr !== undefined && clickAttr !== null) {
    result.clicks = clickAttr.trim()
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

  if (attrs[ATTR_ELEM_MAX_HEIGHT]) {
    result.maxHeight = attrs[ATTR_ELEM_MAX_HEIGHT].trim()
  }

  if (attrs[ATTR_ELEM_SLOT]) {
    result.slot = attrs[ATTR_ELEM_SLOT].trim()
  }

  if (attrs.style && attrs.style.trim()) {
    result.style = attrs.style.trim()
  }

  return result
}

export const mapElementAttrs = parseElementAttrs
