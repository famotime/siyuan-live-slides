import { describe, expect, it } from "vitest"
import { FEATURE_FLAGS, isAnimationEnabled } from "../src/feature-flags/feature-flags"
import type { AnimationEffectKey } from "../src/feature-flags/feature-flags"

const ALL_ANIM_KEYS: AnimationEffectKey[] = [
  "countup",
  "typewriter",
  "pulse",
  "float",
  "shimmer",
]

describe("Animation FeatureFlags (高级微动效构建期功能开关)", () => {
  it("默认状态下 advancedAnimations 与各细分动效均为启用状态", () => {
    expect(FEATURE_FLAGS.advancedAnimations).toBe(true)
    expect(isAnimationEnabled()).toBe(true)
    for (const key of ALL_ANIM_KEYS) {
      expect(isAnimationEnabled(key)).toBe(true)
    }
  })

  it("当未指定动效类型时，仅受 advancedAnimations 总开关控制", () => {
    expect(isAnimationEnabled()).toBe(FEATURE_FLAGS.advancedAnimations !== false)
  })

  it("当指定有效动效类型时，受对应 animationEffects 子开关控制", () => {
    for (const key of ALL_ANIM_KEYS) {
      const expected = FEATURE_FLAGS.advancedAnimations && (FEATURE_FLAGS.animationEffects?.[key] !== false)
      expect(isAnimationEnabled(key)).toBe(expected)
    }
  })

  it("未知动效在总开关开启时默认回退为 true", () => {
    expect(isAnimationEnabled("unknown-anim" as any)).toBe(true)
  })
})
