import { describe, expect, it } from "vitest"
import { reactive, toRef } from "vue"
import { useActiveBlockState } from "../src/ui/dock/useActiveBlockState"
import { ATTR_ELEM_CLICK, ATTR_ELEM_MOTION, ATTR_ELEM_ANIM, ATTR_ELEM_ANIM_PROPS, ATTR_ELEM_SLOT } from "../src/types/slides-protocol"
import type { ISlidesBlockItem } from "../src/types/slides-protocol"

/**
 * useActiveBlockState 领域测试
 *
 * 覆盖：活动块按 id 从目标页查找、六类块属性派生（click/motion/anim/animProps/
 * content/slot）的 IAL 显式值优先级、父容器回退语义与损坏 JSON 容错。
 */

function block(overrides: Partial<ISlidesBlockItem>): ISlidesBlockItem {
  return { id: "b1", type: "NodeParagraph", content: "", rawMarkdown: "", ...overrides } as ISlidesBlockItem
}

function createHarness(overrides: Partial<{
  activeBlockId: string
  blocks: ISlidesBlockItem[]
  attrs: Record<string, string>
  parentContainerId: string
  parentContainerClicks: string
  isCurrentBlockMainText: boolean
}> = {}) {
  const state = reactive({
    activeBlockId: overrides.activeBlockId ?? "",
    targetSlide: overrides.blocks ? { blocks: overrides.blocks } : null,
    activeBlockAttrs: overrides.attrs ?? {},
    parentContainerId: overrides.parentContainerId ?? "",
    parentContainerClicks: overrides.parentContainerClicks ?? "",
  })
  const section = useActiveBlockState({
    activeBlockId: toRef(state, "activeBlockId"),
    targetSlide: toRef(state, "targetSlide"),
    activeBlockAttrs: toRef(state, "activeBlockAttrs"),
    parentContainerId: toRef(state, "parentContainerId"),
    parentContainerClicks: toRef(state, "parentContainerClicks"),
    isCurrentBlockMainText: () => overrides.isCurrentBlockMainText ?? false,
  })
  return { section, state }
}

describe("useActiveBlockState (活动块状态派生解耦)", () => {
  describe("matchedBlock (活动块查找)", () => {
    it("按 activeBlockId 从目标页 blocks 命中活动块", () => {
      const { section } = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1" }), block({ id: "b2" })] })
      expect(section.matchedBlock.value?.id).toBe("b1")
    })

    it("未命中或空 id 时应返回 null", () => {
      const miss = createHarness({ activeBlockId: "zzz", blocks: [block({ id: "b1" })] })
      expect(miss.section.matchedBlock.value).toBeNull()
      const empty = createHarness({})
      expect(empty.section.matchedBlock.value).toBeNull()
    })
  })

  describe("elemClick (逐步呈现派生)", () => {
    it("IAL 显式值优先，即使为空串也遵循显式未开启", () => {
      const explicit = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1", clicks: "3" })], attrs: { [ATTR_ELEM_CLICK]: "" } })
      expect(explicit.section.elemClick.value).toBe("")
      const valued = createHarness({ attrs: { [ATTR_ELEM_CLICK]: "5" } })
      expect(valued.section.elemClick.value).toBe("5")
    })

    it("列表项容器首行主文本未定义时应回退容器 clicks", () => {
      const { section } = createHarness({
        parentContainerId: "p1",
        parentContainerClicks: "2",
        isCurrentBlockMainText: true,
      })
      expect(section.elemClick.value).toBe("2")
    })

    it("归属容器内部但非主文本（如图片）时应保持未开启，不回退父级 clicks", () => {
      const { section } = createHarness({
        parentContainerId: "p1",
        parentContainerClicks: "2",
        isCurrentBlockMainText: false,
      })
      expect(section.elemClick.value).toBe("")
    })

    it("无父容器时应回退编译模型 matched.clicks", () => {
      const { section } = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1", clicks: "4" })] })
      expect(section.elemClick.value).toBe("4")
    })

    it("无任何来源时应返回空串", () => {
      const { section } = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1" })] })
      expect(section.elemClick.value).toBe("")
    })
  })

  describe("elemMotion (入场动效派生)", () => {
    it("IAL 显式值优先", () => {
      const { section } = createHarness({ blocks: [block({ id: "b1", motion: { preset: "fade-in" } as any })], attrs: { [ATTR_ELEM_MOTION]: "slide-up" } })
      expect(section.elemMotion.value).toBe("slide-up")
    })

    it("编译模型字符串 motion 直接透传，对象 motion 序列化为 JSON", () => {
      const str = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1", motion: "bounce" as any })] })
      expect(str.section.elemMotion.value).toBe("bounce")
      const obj = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1", motion: { preset: "zoom-in", duration: 600 } as any })] })
      expect(JSON.parse(obj.section.elemMotion.value)).toEqual({ preset: "zoom-in", duration: 600 })
    })

    it("无来源时应返回空串", () => {
      const { section } = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1" })] })
      expect(section.elemMotion.value).toBe("")
    })
  })

  describe("elemAnim / elemAnimProps (强调与文本动效派生)", () => {
    it("elemAnim 优先 IAL 显式值（含空串），否则回退编译模型 anim.type", () => {
      const explicit = createHarness({ blocks: [block({ id: "b1", anim: { type: "pulse" } as any })], attrs: { [ATTR_ELEM_ANIM]: "" } })
      expect(explicit.section.elemAnim.value).toBe("")
      const model = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1", anim: { type: "float" } as any })] })
      expect(model.section.elemAnim.value).toBe("float")
    })

    it("elemAnimProps 回退编译模型 anim 时应剥离 type 字段", () => {
      const { section } = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1", anim: { type: "countup", from: 0, to: 100 } as any })] })
      expect(JSON.parse(section.elemAnimProps.value)).toEqual({ from: 0, to: 100 })
    })

    it("elemAnimProps IAL 显式值优先且空串尊重显式未开启", () => {
      const { section } = createHarness({ blocks: [block({ id: "b1", anim: { type: "pulse" } as any })], attrs: { [ATTR_ELEM_ANIM_PROPS]: "" } })
      expect(section.elemAnimProps.value).toBe("")
    })
  })

  describe("activeBlockContent (块内容派生)", () => {
    it("优先 rawMarkdown，其次 content，无匹配返回空串", () => {
      const md = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1", rawMarkdown: "正文", content: "<p>正文</p>" })] })
      expect(md.section.activeBlockContent.value).toBe("正文")
      const fallback = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1", rawMarkdown: "", content: "纯文本" })] })
      expect(fallback.section.activeBlockContent.value).toBe("纯文本")
      const none = createHarness({ activeBlockId: "zzz", blocks: [block({ id: "b1" })] })
      expect(none.section.activeBlockContent.value).toBe("")
    })
  })

  describe("elemSlot (插槽派生)", () => {
    it("IAL 显式值优先，否则回退编译模型 slot，无来源返回空串", () => {
      const explicit = createHarness({ blocks: [block({ id: "b1", slot: "header" })], attrs: { [ATTR_ELEM_SLOT]: "col-1" } })
      expect(explicit.section.elemSlot.value).toBe("col-1")
      const model = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1", slot: "col-2" })] })
      expect(model.section.elemSlot.value).toBe("col-2")
      const none = createHarness({ activeBlockId: "b1", blocks: [block({ id: "b1" })] })
      expect(none.section.elemSlot.value).toBe("")
    })
  })
})
