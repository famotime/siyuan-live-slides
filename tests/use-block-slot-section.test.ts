import { describe, expect, it } from "vitest"
import { useBlockSlotSection } from "../src/ui/components/useBlockSlotSection"

/**
 * useBlockSlotSection 领域测试
 *
 * 覆盖：多栏版式判定、插槽归属激活态互认、分栏数三来源探测优先级、
 * 可用插槽清单生成与插槽控制描述文案。
 */

function createSlotHarness(overrides: Partial<{
  elemSlot: string
  currentSlideLayout: string
  currentSlideLayoutRatio: string
  currentSlideHeader: boolean | string
  isSuperBlock: boolean
  isImage: boolean
  imageRole: string
  isVideo: boolean
  isCodeBlock: boolean
  detectedSbInfo: any
}> = {}) {
  return useBlockSlotSection({
    elemSlot: () => overrides.elemSlot ?? "",
    currentSlideLayout: () => overrides.currentSlideLayout,
    currentSlideLayoutRatio: () => overrides.currentSlideLayoutRatio,
    currentSlideHeader: () => overrides.currentSlideHeader,
    isSuperBlock: () => overrides.isSuperBlock,
    isImage: () => overrides.isImage,
    imageRole: () => overrides.imageRole,
    isVideo: () => overrides.isVideo,
    isCodeBlock: () => overrides.isCodeBlock,
    detectedSbInfo: () => overrides.detectedSbInfo,
  })
}

describe("useBlockSlotSection (块级多栏插槽领域解耦)", () => {
  describe("effectiveLayout (插槽智能推断)", () => {
    it("已分配 header 或 col-1~col-6 插槽的块应强制推断为 cols-header", () => {
      const h = createSlotHarness({ elemSlot: "header", currentSlideLayout: "default" })
      expect(h.effectiveLayout.value).toBe("cols-header")
      const c = createSlotHarness({ elemSlot: "col-3", currentSlideLayout: "default" })
      expect(c.effectiveLayout.value).toBe("cols-header")
    })

    it("未分配插槽的块应透传上层版式", () => {
      const h = createSlotHarness({ elemSlot: "", currentSlideLayout: "timeline" })
      expect(h.effectiveLayout.value).toBe("timeline")
    })
  })

  describe("isMultiColsLayout (多栏版式判定)", () => {
    it("四种多栏版式应判定为 true，其余为 false", () => {
      for (const layout of ["two-cols", "cols-header", "two-cols-header", "three-cols-header"]) {
        const h = createSlotHarness({ currentSlideLayout: layout })
        expect(h.isMultiColsLayout.value).toBe(true)
      }
      const h = createSlotHarness({ currentSlideLayout: "cover" })
      expect(h.isMultiColsLayout.value).toBe(false)
    })
  })

  describe("hasLayoutControls (排版控制显隐)", () => {
    it("多栏版式 / 已有插槽 / 超级块 / 图片 / 视频 / 代码块任一命中即显示", () => {
      expect(createSlotHarness({ currentSlideLayout: "two-cols" }).hasLayoutControls.value).toBe(true)
      expect(createSlotHarness({ elemSlot: "col-1" }).hasLayoutControls.value).toBe(true)
      expect(createSlotHarness({ isSuperBlock: true }).hasLayoutControls.value).toBe(true)
      expect(createSlotHarness({ detectedSbInfo: { hasSuperBlock: true, colCount: 2, ratio: "1:1", isCustomWidth: false, recommendedLayout: "cols-header" } }).hasLayoutControls.value).toBe(true)
      expect(createSlotHarness({ isImage: true }).hasLayoutControls.value).toBe(true)
      expect(createSlotHarness({ isVideo: true }).hasLayoutControls.value).toBe(true)
      expect(createSlotHarness({ isCodeBlock: true }).hasLayoutControls.value).toBe(true)
    })

    it("纯文本块且无任何排版上下文应隐藏", () => {
      expect(createSlotHarness({}).hasLayoutControls.value).toBe(false)
    })
  })

  describe("detectedColumnsCount (分栏数三来源探测优先级)", () => {
    it("优先级 1：页面显式分栏比例段数（2~6 栏）", () => {
      const h = createSlotHarness({ currentSlideLayoutRatio: "1:2:3" })
      expect(h.detectedColumnsCount.value).toBe(3)
      const six = createSlotHarness({ currentSlideLayoutRatio: "1:1:1:1:1:1" })
      expect(six.detectedColumnsCount.value).toBe(6)
    })

    it("优先级 2：超级块列数", () => {
      const h = createSlotHarness({ detectedSbInfo: { hasSuperBlock: true, colCount: 4, ratio: "1:1:1:1", isCustomWidth: false, recommendedLayout: "cols-header" } })
      expect(h.detectedColumnsCount.value).toBe(4)
    })

    it("优先级 3：当前块自身 col-N 插槽编号", () => {
      const h = createSlotHarness({ elemSlot: "col-5" })
      expect(h.detectedColumnsCount.value).toBe(5)
    })

    it("回退：three-cols-header → 3；two-cols* → 2；超块 ratio 段数；默认 2", () => {
      expect(createSlotHarness({ currentSlideLayout: "three-cols-header" }).detectedColumnsCount.value).toBe(3)
      expect(createSlotHarness({ currentSlideLayout: "two-cols-header" }).detectedColumnsCount.value).toBe(2)
      expect(createSlotHarness({ detectedSbInfo: { hasSuperBlock: true, colCount: 0, ratio: "2:1", isCustomWidth: false, recommendedLayout: "" } }).detectedColumnsCount.value).toBe(2)
      expect(createSlotHarness({}).detectedColumnsCount.value).toBe(2)
    })
  })

  describe("availableSlots (可用插槽清单)", () => {
    it("2 栏时应生成 default/header + 带左右标注的两栏", () => {
      const h = createSlotHarness({})
      expect(h.availableSlots.value).toEqual([
        { value: "default", label: "默认" },
        { value: "header", label: "标题" },
        { value: "col-1", label: "第 1 栏 (左)" },
        { value: "col-2", label: "第 2 栏 (右)" },
      ])
    })

    it("3 栏时应生成 col-1~col-3 通用标注", () => {
      const h = createSlotHarness({ currentSlideLayoutRatio: "1:1:1" })
      expect(h.availableSlots.value.map(s => s.value)).toEqual(["default", "header", "col-1", "col-2", "col-3"])
      expect(h.availableSlots.value[4].label).toBe("第 3 栏")
    })
  })

  describe("isSlotActive (插槽激活态互认)", () => {
    it("default 与空插槽互认", () => {
      expect(createSlotHarness({}).isSlotActive("default")).toBe(true)
      expect(createSlotHarness({ elemSlot: "default" }).isSlotActive("default")).toBe(true)
    })

    it("col-1 与 left、col-2 与 center 旧值互认", () => {
      expect(createSlotHarness({ elemSlot: "left" }).isSlotActive("col-1")).toBe(true)
      expect(createSlotHarness({ elemSlot: "col-1" }).isSlotActive("left")).toBe(true)
      expect(createSlotHarness({ elemSlot: "center" }).isSlotActive("col-2")).toBe(true)
    })

    it("right 在 2 栏语境下激活 col-2，在 3 栏语境下激活 col-3", () => {
      expect(createSlotHarness({ elemSlot: "right" }).isSlotActive("col-2")).toBe(true)
      expect(createSlotHarness({ elemSlot: "right" }).isSlotActive("col-3")).toBe(false)
      const three = createSlotHarness({ currentSlideLayoutRatio: "1:1:1", elemSlot: "right" })
      expect(three.isSlotActive("col-3")).toBe(true)
      expect(three.isSlotActive("col-2")).toBe(false)
    })

    it("未激活的组合应返回 false", () => {
      expect(createSlotHarness({ elemSlot: "col-2" }).isSlotActive("col-1")).toBe(false)
      expect(createSlotHarness({}).isSlotActive("col-1")).toBe(false)
    })
  })

  describe("slotControlDesc (插槽控制描述文案)", () => {
    it("带通栏标题的版式应输出『带通栏标题』文案", () => {
      const h = createSlotHarness({ currentSlideHeader: true })
      expect(h.slotControlDesc.value).toContain("带通栏标题")
      expect(h.slotControlDesc.value).toContain("2 栏")
    })

    it("关闭通栏标题时应输出『纯分栏对比』文案", () => {
      const h = createSlotHarness({ currentSlideHeader: false })
      expect(h.slotControlDesc.value).toContain("纯分栏对比")
      const strFalse = createSlotHarness({ currentSlideHeader: "false" })
      expect(strFalse.slotControlDesc.value).toContain("纯分栏对比")
    })

    it("slotControlTitle 应为『多栏插槽归属』", () => {
      expect(createSlotHarness({}).slotControlTitle.value).toBe("多栏插槽归属")
    })
  })
})
