import { describe, expect, it, vi } from "vitest"
import { usePageMaskControls } from "../src/ui/components/usePageMaskControls"

/**
 * usePageMaskControls 领域测试
 *
 * 覆盖：时钟/线性蒙版判定、默认比例派生、方向选择时的比例自动升级与降级、帮助文案。
 */

function createHarness(overrides: Partial<{ pageMask: string; pageMaskRatio: string }> = {}) {
  const emitted: Array<{ event: string; args: any[] }> = []
  const controls = usePageMaskControls(
    {
      pageMask: () => overrides.pageMask,
      pageMaskRatio: () => overrides.pageMaskRatio,
    },
    ((event: string, ...args: any[]) => { emitted.push({ event, args }) }) as any,
  )
  return { controls, emitted }
}

describe("usePageMaskControls (页面蒙版领域解耦)", () => {
  describe("isClockMask (蒙版形态判定)", () => {
    it("顺/逆时针别名均判定为时钟蒙版", () => {
      for (const m of ["clockwise", "counter-clockwise", "cw", "ccw"]) {
        expect(createHarness({ pageMask: m }).controls.isClockMask.value).toBe(true)
      }
    })

    it("线性方向为非时钟蒙版", () => {
      for (const m of ["down", "right"]) {
        expect(createHarness({ pageMask: m }).controls.isClockMask.value).toBe(false)
      }
    })
  })

  describe("默认比例与生效比例", () => {
    it("时钟蒙版默认 1:1:1:1，线性蒙版默认 1:1", () => {
      expect(createHarness({ pageMask: "clockwise" }).controls.defaultMaskRatio.value).toBe("1:1:1:1")
      expect(createHarness({ pageMask: "down" }).controls.defaultMaskRatio.value).toBe("1:1")
    })

    it("显式比例优先于默认值", () => {
      const h = createHarness({ pageMask: "clockwise", pageMaskRatio: "1:2:1" })
      expect(h.controls.effectiveMaskRatio.value).toBe("1:2:1")
      expect(h.controls.effectiveMaskRatio.value).not.toBe(h.controls.defaultMaskRatio.value)
    })
  })

  describe("selectClockMask / selectLinearMask (方向选择联动)", () => {
    it("选择时钟方向且原比例为空或 1:1 时应自动升级为 1:1:1:1", () => {
      for (const ratio of [undefined, "1:1"]) {
        const h = createHarness({ pageMaskRatio: ratio })
        h.controls.selectClockMask("counter-clockwise")
        expect(h.emitted).toContainEqual({ event: "update:pageMask", args: ["counter-clockwise"] })
        expect(h.emitted).toContainEqual({ event: "update:pageMaskRatio", args: ["1:1:1:1"] })
      }
    })

    it("已显式配置多段比例时选择时钟方向不应覆盖", () => {
      const h = createHarness({ pageMaskRatio: "1:2:1" })
      h.controls.selectClockMask("cw")
      expect(h.emitted).toEqual([{ event: "update:pageMask", args: ["cw"] }])
    })

    it("选择线性方向且原比例为空或 1:1:1:1 时应降级为 1:1", () => {
      for (const ratio of [undefined, "1:1:1:1"]) {
        const h = createHarness({ pageMaskRatio: ratio })
        h.controls.selectLinearMask("right")
        expect(h.emitted).toContainEqual({ event: "update:pageMask", args: ["right"] })
        expect(h.emitted).toContainEqual({ event: "update:pageMaskRatio", args: ["1:1"] })
      }
    })

    it("线性方向下已显式配置其他比例时不应覆盖", () => {
      const h = createHarness({ pageMaskRatio: "25:75:100" })
      h.controls.selectLinearMask("down")
      expect(h.emitted).toEqual([{ event: "update:pageMask", args: ["down"] }])
    })
  })

  describe("maskRatioPresets 与帮助文案", () => {
    it("比例预设应包含 1:1、1:1:1、1:2:1、1:1:1:1 四档", () => {
      const h = createHarness({})
      expect(h.controls.maskRatioPresets.map(p => p.value)).toEqual(["1:1", "1:1:1", "1:2:1", "1:1:1:1"])
    })

    it("时钟蒙版输出走时规则文案，其余输出输入规则文案", () => {
      const clock = createHarness({ pageMask: "cw" })
      expect(clock.controls.maskHelpTooltip.value).toContain("时钟走时规则")
      const linear = createHarness({ pageMask: "down" })
      expect(linear.controls.maskHelpTooltip.value).toContain("输入规则")
    })
  })
})
