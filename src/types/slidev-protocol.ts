/**
 * 思源 Slidev 块属性协议字典与虚拟 AST 类型定义
 * 依据 docs/技术规格定义.md 规格实现
 */

// 1. 文档全局级属性常量 (Document Scope)
export const ATTR_DOC_THEME = "custom-slidev-theme"
export const ATTR_DOC_ASPECT_RATIO = "custom-slidev-aspect-ratio"
export const ATTR_DOC_HIGHLIGHTER = "custom-slidev-highlighter"
export const ATTR_DOC_DEFAULT_TRANSITION = "custom-slidev-default-transition"
export const ATTR_DOC_COLOR_SCHEMA = "custom-slidev-color-schema"
export const ATTR_DOC_SPACING = "custom-slidev-spacing"

// 2. 幻灯片页面级属性常量 (Page Scope，承载于水平分割线或根块)
export const ATTR_PAGE_SLIDE = "custom-slidev-slide"
export const ATTR_PAGE_LAYOUT = "custom-slidev-layout"
export const ATTR_PAGE_TRANSITION = "custom-slidev-transition"
export const ATTR_PAGE_BACKGROUND = "custom-slidev-background"
export const ATTR_PAGE_IMAGE = "custom-slidev-image"
export const ATTR_PAGE_NOTES = "custom-slidev-notes"
export const ATTR_PAGE_CLASS = "custom-slidev-class"
export const ATTR_PAGE_SPACING = "custom-slidev-spacing"
export const ATTR_PAGE_LAYOUT_RATIO = "custom-slidev-layout-ratio"
export const ATTR_PAGE_MASK = "custom-slidev-mask"
export const ATTR_PAGE_MASK_RATIO = "custom-slidev-mask-ratio"
export const ATTR_PAGE_MASK_STYLE = "custom-slidev-mask-style"
export const ATTR_PAGE_MASK_INITIAL = "custom-slidev-mask-initial"

// 3. 元素动效级与内容属性常量 (Element Scope)
export const ATTR_ELEM_CLICK = "custom-slidev-click"
export const ATTR_ELEM_MOTION = "custom-slidev-motion"
export const ATTR_ELEM_SHIKI_LINES = "custom-slidev-shiki-lines"
export const ATTR_ELEM_SLOT = "custom-slidev-slot"
export const ATTR_ELEM_NOTE = "custom-slidev-note"
export const ATTR_ELEM_ROLE = "custom-slidev-role"
export const ATTR_ELEM_MAX_HEIGHT = "custom-slidev-max-height"
export const ATTR_VIDEO_AUTOPLAY = "custom-slidev-autoplay"
export const ATTR_VIDEO_LOOP = "custom-slidev-loop"
export const ATTR_VIDEO_MUTED = "custom-slidev-muted"
export const ATTR_VIDEO_CONTROLS = "custom-slidev-controls"
export const ROLE_BACKGROUND = "background"
export const ROLE_IMAGE_LEFT = "image-left"
export const ROLE_IMAGE_RIGHT = "image-right"

/** 全局演示文档配置 */
export interface ISlidevPluginConfig {
  theme: string
  aspectRatio: "16/9" | "4/3" | "16/10" | string
  highlighter: "shiki" | "prism"
  defaultTransition: string
  colorSchema: "auto" | "dark" | "light"
  spacing?: "compact" | "normal" | "loose"
  normalizeHeadingSizes?: boolean
}

/** 页面版式类型 */
export type TSlideLayout =
  | "default"
  | "cover"
  | "two-cols"
  | "cols-header"
  | "two-cols-header"
  | "three-cols-header"
  | "clover"
  | "image-right"
  | "image-left"
  | "center"
  | "fact"
  | "intro"
  | "quote"
  | "statement"
  | string

/**
 * 判断指定版式是否属于表头多栏版式体系（统一 cols-header 或历史兼容 two-cols-header / three-cols-header）
 */
export function isColsHeaderLayout(layout?: string): boolean {
  return layout === "cols-header" || layout === "two-cols-header" || layout === "three-cols-header"
}

/** 页面 Frontmatter 配置元数据 */
export interface ISlidePageFrontmatter {
  layout?: TSlideLayout
  transition?: string
  background?: string
  image?: string
  class?: string
  clicks?: number
  layoutRatio?: string
  mask?: "down" | "right" | string
  maskRatio?: string
  maskStyle?: "solid" | "blur" | string
  maskInitial?: "hidden" | "revealed" | string
  [key: string]: any
}

/**
 * 解析动态蒙版分段比例或断点
 * 支持形式：
 * 1. 权重比例：如 "1:1" -> [50, 100], "1:1:1" -> [33.33, 66.67, 100], "1:2:1" -> [25, 75, 100]
 * 2. 绝对累计百分比断点：如 "25:75:100" -> [25, 75, 100], "30:80" -> [30, 80, 100]
 * 默认回退：[50, 100]
 */
export function parseMaskRatio(ratioStr?: string): { steps: number; breakpoints: number[] } {
  if (!ratioStr || typeof ratioStr !== "string") {
    return { steps: 2, breakpoints: [50, 100] }
  }
  const clean = ratioStr.trim()
  if (!clean) {
    return { steps: 2, breakpoints: [50, 100] }
  }
  const parts = clean.split(":").map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0)
  if (parts.length === 0) {
    return { steps: 2, breakpoints: [50, 100] }
  }
  if (parts.length === 1) {
    const val = Math.min(100, Math.max(1, parts[0]))
    if (val === 100) return { steps: 1, breakpoints: [100] }
    return { steps: 2, breakpoints: [Math.round(val * 100) / 100, 100] }
  }

  // 判断是否为直接的百分比断点列表：
  const isMonotonic = parts.every((val, idx) => idx === 0 || val > parts[idx - 1])
  const maxVal = parts[parts.length - 1]
  const isLikelyPercentBreakpoints = isMonotonic && (maxVal === 100 || parts.some(p => p > 10))

  if (isLikelyPercentBreakpoints) {
    const bps = parts.map(p => Math.min(100, Math.round(p * 100) / 100))
    if (bps[bps.length - 1] < 100) {
      bps.push(100)
    }
    return { steps: bps.length, breakpoints: bps }
  }

  // 否则作为权重计算累计百分比（如 1:2:1 或 1:1:1）
  const totalWeight = parts.reduce((acc, cur) => acc + cur, 0)
  if (totalWeight <= 0) {
    return { steps: 2, breakpoints: [50, 100] }
  }
  let accumulated = 0
  const bps: number[] = []
  for (let i = 0; i < parts.length; i++) {
    accumulated += parts[i]
    if (i === parts.length - 1) {
      bps.push(100)
    } else {
      bps.push(Math.round((accumulated / totalWeight) * 10000) / 100)
    }
  }
  return { steps: bps.length, breakpoints: bps }
}

/** 元素微动效配置结构 */
export interface ISlidevMotionConfig {
  preset: string
  delay?: number
  duration?: number
  [key: string]: any
}

/** 单个元素块的数据项 */
export interface ISlidevBlockItem {
  id: string
  type: string
  content: string
  rawMarkdown: string
  clicks?: string
  motion?: ISlidevMotionConfig
  shikiLines?: string
  maxHeight?: string
  slot?: "header" | "left" | "right" | "col-1" | "col-2" | "col-3" | "default" | string
  isNote?: boolean
  parentClicks?: string
  parentContainerId?: string
  attributes?: Record<string, string>
  attrs?: Record<string, string>
  ial?: Record<string, string>
  children?: ISlidevBlockItem[] | any[]
  rawNode?: ISiYuanBlockNode
  isColFirst?: boolean
}

export type ISlidevBlock = ISlidevBlockItem


/** 虚拟幻灯片单页模型 (Virtual Slide Page) */
export interface ISlidevVirtualPage {
  pageIndex: number // 1-based
  startBlockId: string
  frontmatter: ISlidePageFrontmatter
  notes: string
  noteBlocks?: ISlidevBlockItem[]
  blocks: ISlidevBlockItem[]
  rawMarkdown: string
  allBlockIds?: string[]
}

/** 整个文档解析后生成的虚拟 Slidev 文档模型 */
export interface ISlidevDocument {
  docId: string
  config: ISlidevPluginConfig
  slides: ISlidevVirtualPage[]
  fullMarkdown: string
  customThemeCss?: string
}

/** 思源原始块节点结构接口 */
export interface ISiYuanBlockNode {
  id: string
  parent_id?: string
  root_id?: string
  type: string
  subType?: string
  content?: string
  markdown?: string
  ial?: Record<string, string>
  children?: ISiYuanBlockNode[]
}

/** 当前激活块的编辑与演示元信息接口 */
export interface IActiveBlockInfo {
  id: string
  rootId?: string
  type: string
  subType?: string
  content?: string
  markdown?: string
  attrs: Record<string, string>
  isDivider?: boolean
  isCode?: boolean
  isImage?: boolean
  topBlockId?: string
  pageDividerId?: string
  pageDividerLayout?: string
  pageDividerLayoutRatio?: string
  parentContainerId?: string
  parentContainerSlot?: string
  parentContainerClicks?: string
}
