import { describe, expect, it } from "vitest"
import { isFeatureDisabled, isFeatureEnabled } from "../src/feature-flags/feature-flags"
import type { FeatureKey } from "../src/feature-flags/feature-flags"

const ALL_KEYS: FeatureKey[] = [
  "presenterMode",
  "exportHtml",
  "exportPdf",
  "exportImage",
  "import",
  "aiScript",
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
})
