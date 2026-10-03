/**
 * 思源 Slidev 块属性协议字典与虚拟 AST 类型定义
 * 依据 docs/technical-specification-and-roadmap.md 规格实现
 */

// 1. 文档全局级属性常量 (Document Scope)
export const ATTR_DOC_THEME = "custom-slidev-theme"
export const ATTR_DOC_ASPECT_RATIO = "custom-slidev-aspect-ratio"
export const ATTR_DOC_HIGHLIGHTER = "custom-slidev-highlighter"
export const ATTR_DOC_DEFAULT_TRANSITION = "custom-slidev-default-transition"
export const ATTR_DOC_COLOR_SCHEMA = "custom-slidev-color-schema"

// 2. 幻灯片页面级属性常量 (Page Scope，承载于水平分割线或根块)
export const ATTR_PAGE_SLIDE = "custom-slidev-slide"
export const ATTR_PAGE_LAYOUT = "custom-slidev-layout"
export const ATTR_PAGE_TRANSITION = "custom-slidev-transition"
export const ATTR_PAGE_BACKGROUND = "custom-slidev-background"
export const ATTR_PAGE_NOTES = "custom-slidev-notes"
export const ATTR_PAGE_CLASS = "custom-slidev-class"

// 3. 元素动效级属性常量 (Element Scope)
export const ATTR_ELEM_CLICK = "custom-slidev-click"
export const ATTR_ELEM_MOTION = "custom-slidev-motion"
export const ATTR_ELEM_SHIKI_LINES = "custom-slidev-shiki-lines"
export const ATTR_ELEM_SLOT = "custom-slidev-slot"

/** 全局演示文档配置 */
export interface ISlidevPluginConfig {
  theme: string
  aspectRatio: "16/9" | "4/3" | "16/10" | string
  highlighter: "shiki" | "prism"
  defaultTransition: string
  colorSchema: "auto" | "dark" | "light"
}

/** 页面版式类型 */
export type TSlideLayout =
  | "default"
  | "cover"
  | "two-cols"
  | "center"
  | "fact"
  | "intro"
  | "quote"
  | "statement"
  | string

/** 页面 Frontmatter 配置元数据 */
export interface ISlidePageFrontmatter {
  layout?: TSlideLayout
  transition?: string
  background?: string
  class?: string
  clicks?: number
  [key: string]: any
}

/** 单个元素块的数据项 */
export interface ISlidevBlockItem {
  id: string
  type: string
  content: string
  rawMarkdown: string
  clicks?: string
  motion?: Record<string, any>
  shikiLines?: string
  slot?: "left" | "right" | "default" | string
  attributes?: Record<string, string>
}

export type ISlidevBlock = ISlidevBlockItem


/** 虚拟幻灯片单页模型 (Virtual Slide Page) */
export interface ISlidevVirtualPage {
  pageIndex: number // 1-based
  startBlockId: string
  frontmatter: ISlidePageFrontmatter
  notes: string
  blocks: ISlidevBlockItem[]
  rawMarkdown: string
}

/** 整个文档解析后生成的虚拟 Slidev 文档模型 */
export interface ISlidevDocument {
  docId: string
  config: ISlidevPluginConfig
  slides: ISlidevVirtualPage[]
  fullMarkdown: string
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
