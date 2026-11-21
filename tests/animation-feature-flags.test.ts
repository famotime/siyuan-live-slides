import { describe, expect, it } from "vitest"
import {
  FEATURE_FLAGS,
  isAnimationEnabled,
  isElementAnimationEnabled,
  isAnyElementAnimationEnabled,
  ENTRANCE_EFFECT_KEYS,
  EMPHASIS_EFFECT_KEYS,
  TEXT_EFFECT_KEYS,
} from "../src/feature-flags/feature-flags"
import type { ElementAnimationCategoryKey } from "../src/feature-flags/feature-flags"

const ALL_CATEGORIES: ElementAnimationCategoryKey[] = [
  "entrance",
  "emphasis",
  "text",
]

describe("Animation FeatureFlags (元素动效三大分类及微动效构建期功能开关)", () => {
  it("默认状态下发布配置符合构建预期（入场开启、持续强调与文本动效关闭）", () => {
    expect(FEATURE_FLAGS.elementAnimations.entrance.enabled).toBe(true)
    expect(isElementAnimationEnabled("entrance")).toBe(true)
    expect(FEATURE_FLAGS.elementAnimations.emphasis.enabled).toBe(false)
    expect(isElementAnimationEnabled("emphasis")).toBe(false)
    expect(FEATURE_FLAGS.elementAnimations.text.enabled).toBe(false)
    expect(isElementAnimationEnabled("text")).toBe(false)
    expect(isAnyElementAnimationEnabled()).toBe(true)
  })

  it("在分类启用状态下各分类下的所有具体微动效预设均为启用状态", () => {
    const origConfig = JSON.parse(JSON.stringify(FEATURE_FLAGS.elementAnimations))
    try {
      FEATURE_FLAGS.elementAnimations.entrance.enabled = true
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = true
      FEATURE_FLAGS.elementAnimations.text.enabled = true

      for (const key of ENTRANCE_EFFECT_KEYS) {
        expect(FEATURE_FLAGS.elementAnimations.entrance.effects[key]).toBe(true)
        expect(isAnimationEnabled(key)).toBe(true)
      }
      for (const key of EMPHASIS_EFFECT_KEYS) {
        expect(FEATURE_FLAGS.elementAnimations.emphasis.effects[key]).toBe(true)
        expect(isAnimationEnabled(key)).toBe(true)
      }
      for (const key of TEXT_EFFECT_KEYS) {
        expect(FEATURE_FLAGS.elementAnimations.text.effects[key]).toBe(true)
        expect(isAnimationEnabled(key)).toBe(true)
      }
      // 未指定动效类型时，判定是否有任意持续强调或文本动效开启
      expect(isAnimationEnabled()).toBe(true)
    } finally {
      FEATURE_FLAGS.elementAnimations = origConfig
    }
  })

  it("支持三大分类部分关闭：单项分类关闭不影响其余分类及其下具体动效", () => {
    const origConfig = JSON.parse(JSON.stringify(FEATURE_FLAGS.elementAnimations))
    try {
      FEATURE_FLAGS.elementAnimations.entrance.enabled = true
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = true
      FEATURE_FLAGS.elementAnimations.text.enabled = true

      // 1. 关闭入场过渡
      FEATURE_FLAGS.elementAnimations.entrance.enabled = false
      expect(isElementAnimationEnabled("entrance")).toBe(false)
      expect(isElementAnimationEnabled("emphasis")).toBe(true)
      expect(isElementAnimationEnabled("text")).toBe(true)
      expect(isAnyElementAnimationEnabled()).toBe(true)
      expect(isAnimationEnabled("slide-up")).toBe(false)
      expect(isAnimationEnabled("pulse")).toBe(true)

      // 2. 恢复入场，关闭持续强调
      FEATURE_FLAGS.elementAnimations.entrance.enabled = true
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = false
      expect(isElementAnimationEnabled("entrance")).toBe(true)
      expect(isElementAnimationEnabled("emphasis")).toBe(false)
      expect(isElementAnimationEnabled("text")).toBe(true)
      expect(isAnimationEnabled("pulse")).toBe(false)
      expect(isAnimationEnabled("float")).toBe(false)
      expect(isAnimationEnabled("shimmer")).toBe(false)
      expect(isAnimationEnabled("countup")).toBe(true)
      expect(isAnimationEnabled("slide-up")).toBe(true)

      // 3. 恢复持续强调，关闭文本动效
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = true
      FEATURE_FLAGS.elementAnimations.text.enabled = false
      expect(isElementAnimationEnabled("entrance")).toBe(true)
      expect(isElementAnimationEnabled("emphasis")).toBe(true)
      expect(isElementAnimationEnabled("text")).toBe(false)
      expect(isAnimationEnabled("countup")).toBe(false)
      expect(isAnimationEnabled("typewriter")).toBe(false)
      expect(isAnimationEnabled("pulse")).toBe(true)
    } finally {
      FEATURE_FLAGS.elementAnimations = origConfig
    }
  })

  it("支持各分类下具体动效的细粒度开关控制", () => {
    const origConfig = JSON.parse(JSON.stringify(FEATURE_FLAGS.elementAnimations))
    try {
      FEATURE_FLAGS.elementAnimations.entrance.enabled = true
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = true
      FEATURE_FLAGS.elementAnimations.text.enabled = true

      // 关闭入场过渡中的 bounce
      FEATURE_FLAGS.elementAnimations.entrance.effects.bounce = false
      expect(isAnimationEnabled("bounce")).toBe(false)
      expect(isAnimationEnabled("slide-up")).toBe(true)
      expect(isElementAnimationEnabled("entrance")).toBe(true)

      // 关闭持续强调中的 pulse
      FEATURE_FLAGS.elementAnimations.emphasis.effects.pulse = false
      expect(isAnimationEnabled("pulse")).toBe(false)
      expect(isAnimationEnabled("float")).toBe(true)
      expect(isElementAnimationEnabled("emphasis")).toBe(true)

      // 关闭文本动效中的 typewriter
      FEATURE_FLAGS.elementAnimations.text.effects.typewriter = false
      expect(isAnimationEnabled("typewriter")).toBe(false)
      expect(isAnimationEnabled("countup")).toBe(true)
      expect(isElementAnimationEnabled("text")).toBe(true)
    } finally {
      FEATURE_FLAGS.elementAnimations = origConfig
    }
  })

  it("当分类下所有具体子动效被关闭时，该分类自动判定为未启用", () => {
    const origConfig = JSON.parse(JSON.stringify(FEATURE_FLAGS.elementAnimations))
    try {
      for (const k of EMPHASIS_EFFECT_KEYS) {
        FEATURE_FLAGS.elementAnimations.emphasis.effects[k] = false
      }
      expect(isElementAnimationEnabled("emphasis")).toBe(false)

      for (const k of TEXT_EFFECT_KEYS) {
        FEATURE_FLAGS.elementAnimations.text.effects[k] = false
      }
      expect(isElementAnimationEnabled("text")).toBe(false)

      for (const k of ENTRANCE_EFFECT_KEYS) {
        FEATURE_FLAGS.elementAnimations.entrance.effects[k] = false
      }
      expect(isElementAnimationEnabled("entrance")).toBe(false)
    } finally {
      FEATURE_FLAGS.elementAnimations = origConfig
    }
  })

  it("支持元素动效三大分类全部关闭：全为 false 时 isAnyElementAnimationEnabled 为 false", () => {
    const origConfig = JSON.parse(JSON.stringify(FEATURE_FLAGS.elementAnimations))
    try {
      FEATURE_FLAGS.elementAnimations.entrance.enabled = false
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = false
      FEATURE_FLAGS.elementAnimations.text.enabled = false

      expect(isElementAnimationEnabled("entrance")).toBe(false)
      expect(isElementAnimationEnabled("emphasis")).toBe(false)
      expect(isElementAnimationEnabled("text")).toBe(false)
      expect(isAnyElementAnimationEnabled()).toBe(false)
      expect(isAnimationEnabled()).toBe(false)
    } finally {
      FEATURE_FLAGS.elementAnimations = origConfig
    }
  })

  it("未知动效默认回退为 true", () => {
    expect(isAnimationEnabled("unknown-anim")).toBe(true)
  })
})
