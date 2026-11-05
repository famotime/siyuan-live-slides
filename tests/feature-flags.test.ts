import { describe, expect, it } from "vitest"
import { isFeatureDisabled, isFeatureEnabled } from "../src/feature-flags/feature-flags"
import type { FeatureKey } from "../src/feature-flags/feature-flags"

const ALL_KEYS: FeatureKey[] = [
  "proMode",
  "presenterMode",
  "exportHtml",
  "exportPdf",
  "exportImage",
  "import",
  "aiScript",
]

describe("FeatureFlags (构建期功能开关)", () => {
  it("默认配置下全部 7 个功能开关均启用", () => {
    for (const key of ALL_KEYS) {
      expect(isFeatureDisabled(key), `功能 ${key} 应默认启用（入口保留）`).toBe(false)
      expect(isFeatureEnabled(key), `功能 ${key} 应默认启用（入口保留）`).toBe(true)
    }
  })

  it("isFeatureEnabled 与 isFeatureDisabled 对所有 key 互为补集", () => {
    for (const key of ALL_KEYS) {
      expect(isFeatureEnabled(key)).toBe(!isFeatureDisabled(key))
    }
  })
})
