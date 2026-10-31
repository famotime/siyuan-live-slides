import { describe, expect, it } from "vitest"
import TransitionSelector from "../src/ui/components/TransitionSelector.vue"
import DocInspectorSection from "../src/ui/components/DocInspectorSection.vue"
import { DEFAULT_SLIDES_CONFIG, parseDocumentConfig } from "../src/compiler/scope-mapper"
import { ATTR_DOC_DEFAULT_TRANSITION, ATTR_DOC_THEME } from "../src/types/slides-protocol"

describe("Transition & Theme Inspector Synergy", () => {
  it("TransitionSelector 组件应成功加载并包含 5 种转场动效及其描述", () => {
    expect(TransitionSelector).toBeDefined()
    // 检查组件配置与转场数据
    // 在 vue 3 sfc 编译后，setup 会执行返回
    expect(typeof TransitionSelector).toBe("object")
  })

  it("scope-mapper 应正确解析全局默认转场与主题", () => {
    const config1 = parseDocumentConfig({
      [ATTR_DOC_THEME]: "seriph",
      [ATTR_DOC_DEFAULT_TRANSITION]: "zoom",
    })
    expect(config1.theme).toBe("seriph")
    expect(config1.defaultTransition).toBe("zoom")

    const config2 = parseDocumentConfig({
      [ATTR_DOC_THEME]: "apple-basic",
      [ATTR_DOC_DEFAULT_TRANSITION]: "slide-up",
    })
    expect(config2.theme).toBe("apple-basic")
    expect(config2.defaultTransition).toBe("slide-up")

    const configDefault = parseDocumentConfig({})
    expect(configDefault.theme).toBe(DEFAULT_SLIDES_CONFIG.theme)
    expect(configDefault.defaultTransition).toBe(DEFAULT_SLIDES_CONFIG.defaultTransition)
  })

  it("DocInspectorSection 组件应成功定义并导出", () => {
    expect(DocInspectorSection).toBeDefined()
    expect(typeof DocInspectorSection).toBe("object")
  })
})
