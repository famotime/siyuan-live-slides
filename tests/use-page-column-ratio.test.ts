import { describe, expect, it, vi } from "vitest"
import { usePageColumnRatio } from "../src/ui/components/usePageColumnRatio"

/**
 * usePageColumnRatio 领域测试
 *
 * 覆盖：多栏版式判定、分栏数五来源探测优先级、手工指定栏数与版式重定向、
 * 比例预设矩阵、等分激活判定与重置。
 */

function createHarness(overrides: Partial<{
  pageLayout: string
  pageHeader: boolean | string
  pageLayoutRatio: string
  detectedSbRatio: string
  detectedSbInfo: any
}> = {}) {
  const emitted: Array<{ event: string; args: any[] }> = []
  const ratio = usePageColumnRatio(
    {
      pageLayout: () => overrides.pageLayout ?? "",
      pageHeader: () => overrides.pageHeader,
      pageLayoutRatio: () => overrides.pageLayoutRatio,
      detectedSbRatio: () => overrides.detectedSbRatio,
      detectedSbInfo: () => overrides.detectedSbInfo,
    },
    ((event: string, ...args: any[]) => { emitted.push({ event, args }) }) as any,
  )
  return { ratio, emitted }
}

describe("usePageColumnRatio (页面分栏比例领域解耦)", () => {
  describe("版式判定", () => {
    it("isMultiColLayout 应包含双栏、表头分栏与图文六种版式", () => {
      for (const layout of ["two-cols", "cols-header", "two-cols-header", "three-cols-header", "image-left", "image-right"]) {
        expect(createHarness({ pageLayout: layout }).ratio.isMultiColLayout.value).toBe(true)
      }
      expect(createHarness({ pageLayout: "cover" }).ratio.isMultiColLayout.value).toBe(false)
    })

    it("isColsHeaderLayout 应包含四种表头分栏版式", () => {
      for (const layout of ["cols-header", "two-cols-header", "three-cols-header", "two-cols"]) {
        expect(createHarness({ pageLayout: layout }).ratio.isColsHeaderLayout.value).toBe(true)
      }
      expect(createHarness({ pageLayout: "image-left" }).ratio.isColsHeaderLayout.value).toBe(false)
    })

    it("effectivePageHeader 应识别 false 与 'false' 关闭态", () => {
      expect(createHarness({ pageHeader: false }).ratio.effectivePageHeader.value).toBe(false)
      expect(createHarness({ pageHeader: "false" }).ratio.effectivePageHeader.value).toBe(false)
      expect(createHarness({ pageHeader: true }).ratio.effectivePageHeader.value).toBe(true)
      expect(createHarness({}).ratio.effectivePageHeader.value).toBe(true)
    })
  })

  describe("detectedColumnsCount (分栏数探测优先级)", () => {
    it("优先级 1：页面显式比例段数（2~6）", () => {
      expect(createHarness({ pageLayoutRatio: "1:2:1" }).ratio.detectedColumnsCount.value).toBe(3)
    })

    it("优先级 2：超级块比例段数", () => {
      expect(createHarness({ detectedSbRatio: "2:1:1:1" }).ratio.detectedColumnsCount.value).toBe(4)
    })

    it("优先级 3/4：超级块列数与插槽清单", () => {
      expect(createHarness({ detectedSbInfo: { colCount: 5 } }).ratio.detectedColumnsCount.value).toBe(5)
      expect(createHarness({ detectedSbInfo: { slots: ["col-1", "col-2", "col-3"] } }).ratio.detectedColumnsCount.value).toBe(3)
    })

    it("回退：three-cols-header → 3；默认 → 2", () => {
      expect(createHarness({ pageLayout: "three-cols-header" }).ratio.detectedColumnsCount.value).toBe(3)
      expect(createHarness({}).ratio.detectedColumnsCount.value).toBe(2)
    })
  })

  describe("setColumnCount (手工指定栏数)", () => {
    it("应为 2~6 栏生成对应均分比例", () => {
      const cases: Array<[number, string]> = [
        [2, "1:1"], [3, "1:1:1"], [4, "1:1:1:1"], [5, "1:1:1:1:1"], [6, "1:1:1:1:1:1"],
      ]
      for (const [col, expected] of cases) {
        const h = createHarness({})
        h.ratio.setColumnCount(col)
        expect(h.emitted).toContainEqual({ event: "update:pageLayoutRatio", args: [expected] })
      }
    })

    it("越界栏数应被忽略", () => {
      const h = createHarness({})
      h.ratio.setColumnCount(1)
      h.ratio.setColumnCount(7)
      expect(h.emitted).toEqual([])
    })

    it("旧双栏/三栏版式手工指定栏数时应重定向为 cols-header", () => {
      for (const layout of ["two-cols", "two-cols-header", "three-cols-header"]) {
        const h = createHarness({ pageLayout: layout })
        h.ratio.setColumnCount(4)
        expect(h.emitted).toContainEqual({ event: "update:pageLayout", args: ["cols-header"] })
        expect(h.emitted).toContainEqual({ event: "update:pageLayoutRatio", args: ["1:1:1:1"] })
      }
    })
  })

  describe("currentRatioPresets (比例预设矩阵)", () => {
    it("按栏数输出对应预设清单", () => {
      const two = createHarness({ pageLayoutRatio: "1:1" })
      expect(two.ratio.currentRatioPresets.value.map(p => p.value)).toEqual(["", "1:2", "2:1", "3:7", "7:3", "4:6", "6:4"])
      const three = createHarness({ pageLayoutRatio: "1:1:1" })
      expect(three.ratio.currentRatioPresets.value.map(p => p.value)).toEqual(["", "1:2:1", "2:1:1", "1:1:2", "1:3:1"])
      const five = createHarness({ pageLayoutRatio: "1:1:1:1:1" })
      expect(five.ratio.currentRatioPresets.value.map(p => p.value)).toEqual([""])
    })

    it("currentActiveRatio 应透传显式比例", () => {
      expect(createHarness({ pageLayoutRatio: "3:7" }).ratio.currentActiveRatio.value).toBe("3:7")
    })
  })

  describe("isRatioActive 与等分重置", () => {
    it("空 chip 应在无比例或等分比例时激活", () => {
      expect(createHarness({}).ratio.isRatioActive("")).toBe(true)
      expect(createHarness({ pageLayoutRatio: "1:1" }).ratio.isRatioActive("")).toBe(true)
      expect(createHarness({ pageLayoutRatio: "3:7" }).ratio.isRatioActive("")).toBe(false)
    })

    it("三栏语境下空 chip 应与 1:1:1 互认", () => {
      expect(createHarness({ pageLayoutRatio: "1:1:1" }).ratio.isRatioActive("")).toBe(true)
    })

    it("非空 chip 精确匹配", () => {
      expect(createHarness({ pageLayoutRatio: "3:7" }).ratio.isRatioActive("3:7")).toBe(true)
      expect(createHarness({ pageLayoutRatio: "3:7" }).ratio.isRatioActive("7:3")).toBe(false)
    })

    it("onResetRatioToEqual 应发射当前栏数均分比例并请求重置超级块比例", () => {
      const h = createHarness({ pageLayoutRatio: "1:2:1" })
      h.ratio.onResetRatioToEqual()
      expect(h.emitted).toContainEqual({ event: "update:pageLayoutRatio", args: ["1:1:1"] })
      expect(h.emitted).toContainEqual({ event: "resetSuperblockRatio", args: [] })
    })
  })
})
