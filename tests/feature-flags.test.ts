import { describe, expect, it } from "vitest"
import { isFeatureDisabled, isFeatureEnabled, isLayoutEnabled } from "../src/feature-flags/feature-flags"
import type { FeatureKey, LayoutKey } from "../src/feature-flags/feature-flags"

const ALL_KEYS: FeatureKey[] = [
  "presenterMode",
  "exportHtml",
  "exportPdf",
  "exportImage",
  "import",
  "aiScript",
  "smartSplit",
  "smartAnimation",
  "speakerNotesBlocks",
]

const ALL_LAYOUT_KEYS: LayoutKey[] = [
  "two-cols",
  "cols-header",
  "clover",
  "timeline",
  "image-right",
  "image-left",
  "cover",
  "fact",
  "quote",
  "intro",
  "center",
]

describe("FeatureFlags (构建期功能开关)", () => {
  it("各 key 均具有确定的布尔状态且接口正常响应", () => {
    for (const key of ALL_KEYS) {
      expect(typeof isFeatureDisabled(key)).toBe("boolean")
      expect(typeof isFeatureEnabled(key)).toBe("boolean")
    }
  })

  it("isFeatureEnabled 与 isFeatureDisabled 对所有 key 互为补集", () => {
    for (const key of ALL_KEYS) {
      expect(isFeatureEnabled(key)).toBe(!isFeatureDisabled(key))
    }
  })

  it("页面版式开关 isLayoutEnabled 正常工作且 default 始终为 true", () => {
    expect(isLayoutEnabled("default")).toBe(true)
    for (const layout of ALL_LAYOUT_KEYS) {
      expect(typeof isLayoutEnabled(layout)).toBe("boolean")
      expect(isLayoutEnabled(layout)).toBe(true)
    }
  })
})
