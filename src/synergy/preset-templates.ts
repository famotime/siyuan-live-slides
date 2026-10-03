import {
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_CLASS,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_NOTES,
  ATTR_PAGE_SLIDE,
  ATTR_PAGE_TRANSITION,
} from "../types/slidev-protocol"

export interface ISlidevPresetTemplate {
  id: string
  name: string
  open: boolean
  attrs: Array<{ key: string; value: string }>
}

/**
 * 为「属性管家」定制的开箱即用 Slidev 演示属性预设字典
 */
export const SLIDEV_PRESET_TEMPLATES: ISlidevPresetTemplate[] = [
  {
    id: "slidev-cover",
    name: "幻灯片 - 封面页 (Cover)",
    open: true,
    attrs: [
      { key: ATTR_PAGE_SLIDE, value: "true" },
      { key: ATTR_PAGE_LAYOUT, value: "cover" },
      { key: ATTR_PAGE_TRANSITION, value: "fade" },
      { key: ATTR_PAGE_BACKGROUND, value: "" },
    ],
  },
  {
    id: "slidev-two-cols",
    name: "幻灯片 - 双栏对比 (Two Columns)",
    open: true,
    attrs: [
      { key: ATTR_PAGE_SLIDE, value: "true" },
      { key: ATTR_PAGE_LAYOUT, value: "two-cols" },
      { key: ATTR_PAGE_TRANSITION, value: "slide-left" },
    ],
  },
  {
    id: "slidev-fact",
    name: "幻灯片 - 大字报与核心指标 (Fact)",
    open: true,
    attrs: [
      { key: ATTR_PAGE_SLIDE, value: "true" },
      { key: ATTR_PAGE_LAYOUT, value: "fact" },
      { key: ATTR_PAGE_TRANSITION, value: "zoom" },
    ],
  },
  {
    id: "slidev-intro",
    name: "幻灯片 - 章节导引与作者 (Intro)",
    open: true,
    attrs: [
      { key: ATTR_PAGE_SLIDE, value: "true" },
      { key: ATTR_PAGE_LAYOUT, value: "intro" },
      { key: ATTR_PAGE_TRANSITION, value: "slide-up" },
    ],
  },
  {
    id: "slidev-quote",
    name: "幻灯片 - 金句与强调 (Quote)",
    open: true,
    attrs: [
      { key: ATTR_PAGE_SLIDE, value: "true" },
      { key: ATTR_PAGE_LAYOUT, value: "quote" },
      { key: ATTR_PAGE_TRANSITION, value: "fade" },
    ],
  },
]
