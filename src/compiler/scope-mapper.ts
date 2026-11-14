import type {
  ISiYuanBlockNode,
  ISlidePageFrontmatter,
  ISlidesMotionConfig,
  ISlideAnimConfig,
  ISlidesPluginConfig,
} from "../types/slides-protocol"
import {
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_COLOR_SCHEMA,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_THEME,
  ATTR_DOC_SPACING,
  ATTR_DOC_BACKGROUND,
  ATTR_DOC_SHOW_UNORDERED_LIST_MARKERS,
  ATTR_DOC_SHOW_ORDERED_LIST_MARKERS,
  ATTR_PAGE_SPACING,
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_ANIM,
  ATTR_ELEM_ANIM_PROPS,
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
  ATTR_PAGE_HEADER,
  ATTR_PAGE_MASK,
  ATTR_PAGE_MASK_RATIO,
  ATTR_PAGE_MASK_STYLE,
  ATTR_PAGE_MASK_INITIAL,
  ATTR_PAGE_NOTES,
  ATTR_PAGE_SLIDE,
  ATTR_PAGE_TRANSITION,
} from "../types/slides-protocol"
import { isAnimationEnabled } from "../feature-flags/feature-flags"

import { getRuntimeSettings } from "../settings"

/** 默认全局配置 */
export const DEFAULT_SLIDES_CONFIG: ISlidesPluginConfig = {
  theme: "apple-basic",
  aspectRatio: "16/9",
  defaultTransition: "slide-left",
  colorSchema: "auto",
  spacing: "normal",
  background: "",
  normalizeHeadingSizes: false,
  showUnorderedListMarkers: true,
  showOrderedListMarkers: true,
}

/**
 * 解析文档根节点全局属性 (Document Scope)
 */
export function parseDocumentConfig(
  attrs?: Record<string, string> | null,
): ISlidesPluginConfig {
  const globalSettings = getRuntimeSettings()
  if (!attrs) {
    return {
      ...DEFAULT_SLIDES_CONFIG,
      normalizeHeadingSizes: globalSettings.normalizeHeadingSizes,
      showUnorderedListMarkers: globalSettings.showUnorderedListMarkers,
      showOrderedListMarkers: globalSettings.showOrderedListMarkers,
    }
  }

  const showUnorderedListMarkers =
    attrs[ATTR_DOC_SHOW_UNORDERED_LIST_MARKERS] !== undefined
      ? attrs[ATTR_DOC_SHOW_UNORDERED_LIST_MARKERS] !== "false"
      : globalSettings.showUnorderedListMarkers

  const showOrderedListMarkers =
    attrs[ATTR_DOC_SHOW_ORDERED_LIST_MARKERS] !== undefined
      ? attrs[ATTR_DOC_SHOW_ORDERED_LIST_MARKERS] !== "false"
      : globalSettings.showOrderedListMarkers

  return {
    theme: attrs[ATTR_DOC_THEME]?.trim() || DEFAULT_SLIDES_CONFIG.theme,
    aspectRatio: (attrs[ATTR_DOC_ASPECT_RATIO]?.trim() as any) || DEFAULT_SLIDES_CONFIG.aspectRatio,
    defaultTransition: attrs[ATTR_DOC_DEFAULT_TRANSITION]?.trim() || DEFAULT_SLIDES_CONFIG.defaultTransition,
    colorSchema: (attrs[ATTR_DOC_COLOR_SCHEMA]?.trim() as any) || DEFAULT_SLIDES_CONFIG.colorSchema,
    spacing: (attrs[ATTR_DOC_SPACING]?.trim() as any) || DEFAULT_SLIDES_CONFIG.spacing,
    background: attrs[ATTR_DOC_BACKGROUND]?.trim() || "",
    normalizeHeadingSizes: globalSettings.normalizeHeadingSizes,
    showUnorderedListMarkers,
    showOrderedListMarkers,
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
    if (frontmatter.layout === "two-cols" && attrs[ATTR_PAGE_HEADER] === undefined) {
      frontmatter.header = false
    }
  }

  if (attrs[ATTR_PAGE_HEADER] !== undefined) {
    const rawHeader = attrs[ATTR_PAGE_HEADER].trim().toLowerCase()
    frontmatter.header = rawHeader !== "false"
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
        ATTR_PAGE_HEADER,
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
  anim?: ISlideAnimConfig
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
    anim?: ISlideAnimConfig
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

  // 讲稿备注块识别：命中 custom-slides-note
  const noteAttr = attrs[ATTR_ELEM_NOTE]
  if (noteAttr !== undefined && noteAttr !== null && noteAttr !== "" && noteAttr !== "false" && noteAttr !== "0") {
    result.isNote = true
  }

  // 页面背景图识别：命中 custom-slides-role="background" 或 custom-slides-background="true"
  const roleAttr = attrs[ATTR_ELEM_ROLE]
  const bgAttr = attrs[ATTR_PAGE_BACKGROUND]
  if (roleAttr === ROLE_BACKGROUND || bgAttr === "true" || bgAttr === "1") {
    result.isBackground = true
  }

  // 图左 / 图右图片排版识别：命中 custom-slides-layout="image-left" | "image-right" 或 custom-slides-role
  const layoutAttr = attrs[ATTR_PAGE_LAYOUT]
  if (layoutAttr === ROLE_IMAGE_LEFT || layoutAttr === ROLE_IMAGE_RIGHT) {
    result.imageLayout = layoutAttr
  } else if (roleAttr === ROLE_IMAGE_LEFT || roleAttr === ROLE_IMAGE_RIGHT) {
    result.imageLayout = roleAttr
  }

  const clickAttr = attrs[ATTR_ELEM_CLICK]
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

  if (attrs[ATTR_ELEM_ANIM]) {
    const rawAnim = attrs[ATTR_ELEM_ANIM].trim().toLowerCase()
    if (rawAnim && isAnimationEnabled(rawAnim)) {
      let animConfig: ISlideAnimConfig = { type: rawAnim }
      if (attrs[ATTR_ELEM_ANIM_PROPS]) {
        try {
          const parsedProps = JSON.parse(attrs[ATTR_ELEM_ANIM_PROPS])
          if (typeof parsedProps === "object" && parsedProps !== null) {
            animConfig = { ...animConfig, ...parsedProps }
          }
        } catch {
          // 容错兼容分号分隔键值对 (如 duration:1500;decimals:1)
          const parts = attrs[ATTR_ELEM_ANIM_PROPS].split(";")
          for (const part of parts) {
            const [k, v] = part.split(":").map(s => s?.trim())
            if (k && v !== undefined) {
              const num = Number(v)
              ;(animConfig as any)[k] = isNaN(num) ? v : num
            }
          }
        }
      }
      result.anim = animConfig
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
