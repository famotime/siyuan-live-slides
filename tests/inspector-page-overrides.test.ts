import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { ref } from "vue"
import { createPageAttrResolver } from "../src/ui/dock/useInspectorPageOverrides"
import { globalDocumentCompiler } from "../src/compiler/document-compiler"
import { ATTR_PAGE_MASK, ATTR_PAGE_MASK_STYLE, ATTR_PAGE_LAYOUT_RATIO } from "../src/types/slidev-protocol"

/**
 * RF-017 单测：分页符属性三级查找工厂
 * 优先级：激活分页符直接属性 → 编译器内存覆写层 → 目标页 frontmatter 回退
 */

function buildSource(overrides: Partial<Record<string, string>> = {}) {
  return {
    activeBlockId: ref("block-101"),
    activeBlockType: ref("NodeParagraph"),
    activeBlockAttrs: ref<Record<string, string>>({ ...overrides }),
    currentPageDividerId: ref("div-1"),
  }
}

describe("createPageAttrResolver (分页符属性三级查找工厂)", () => {
  beforeEach(() => {
    globalDocumentCompiler.clearBlockAttrOverride("div-1")
    globalDocumentCompiler.clearBlockAttrOverride("block-101")
  })

  afterEach(() => {
    globalDocumentCompiler.clearBlockAttrOverride("div-1")
    globalDocumentCompiler.clearBlockAttrOverride("block-101")
    vi.restoreAllMocks()
  })

  it("非分页符激活时应读取分页符的编译器覆写层", () => {
    const source = buildSource()
    globalDocumentCompiler.setBlockAttrOverride("div-1", { [ATTR_PAGE_MASK]: "dark" })
    const { resolvePageAttr } = createPageAttrResolver(source)
    const pageMask = resolvePageAttr({ attrKey: ATTR_PAGE_MASK, fallback: () => "" })

    expect(pageMask.value).toBe("dark")
  })

  it("覆写层与直接属性均缺失时应回退到 frontmatter 取值函数", () => {
    const source = buildSource()
    const { resolvePageAttr } = createPageAttrResolver(source)
    const pageMaskStyle = resolvePageAttr({
      attrKey: ATTR_PAGE_MASK_STYLE,
      fallback: () => "dashed",
    })

    expect(pageMaskStyle.value).toBe("dashed")
  })

  it("激活分页符时直接属性优先于覆写层（defined 模式空串也生效）", () => {
    const source = buildSource({ [ATTR_PAGE_MASK]: "" })
    source.activeBlockType.value = "NodeThematicBreak"
    globalDocumentCompiler.setBlockAttrOverride("block-101", { [ATTR_PAGE_MASK]: "dark" })
    const { resolvePageAttr } = createPageAttrResolver(source)
    const pageMask = resolvePageAttr({ attrKey: ATTR_PAGE_MASK, fallback: () => "" })

    // defined 模式：直接属性存在（即使为空串）即返回空串，不落入覆写层
    expect(pageMask.value).toBe("")
  })

  it("truthy 模式下直接属性为空串时应继续落入覆写层", () => {
    const source = buildSource({ [ATTR_PAGE_LAYOUT_RATIO]: "" })
    source.activeBlockType.value = "NodeThematicBreak"
    // 前置分页符 ID (div-1) 优先于激活块自身 ID 作为覆写查询目标
    globalDocumentCompiler.setBlockAttrOverride("div-1", { [ATTR_PAGE_LAYOUT_RATIO]: "1-2" })
    const { resolvePageAttr } = createPageAttrResolver(source)
    const ratio = resolvePageAttr({
      attrKey: ATTR_PAGE_LAYOUT_RATIO,
      fallback: () => "",
      mode: "truthy",
    })

    expect(ratio.value).toBe("1-2")
  })

  it("truthy 模式下覆写层为空串时应继续回退到 fallback", () => {
    const source = buildSource()
    globalDocumentCompiler.setBlockAttrOverride("div-1", { [ATTR_PAGE_LAYOUT_RATIO]: "" })
    const { resolvePageAttr } = createPageAttrResolver(source)
    const ratio = resolvePageAttr({
      attrKey: ATTR_PAGE_LAYOUT_RATIO,
      fallback: () => "1-1",
      mode: "truthy",
    })

    expect(ratio.value).toBe("1-1")
  })

  it("激活分页符且无前置分页符 ID 时应以激活块自身 ID 查询覆写层", () => {
    const source = buildSource()
    source.activeBlockType.value = "NodeThematicBreak"
    source.currentPageDividerId.value = ""
    globalDocumentCompiler.setBlockAttrOverride("block-101", { [ATTR_PAGE_MASK_STYLE]: "blur" })
    const { resolvePageAttr } = createPageAttrResolver(source)
    const maskStyle = resolvePageAttr({ attrKey: ATTR_PAGE_MASK_STYLE, fallback: () => "solid" })

    expect(maskStyle.value).toBe("blur")
  })

  it("isDivider 应随激活块类型联动", () => {
    const source = buildSource()
    const { isDivider } = createPageAttrResolver(source)

    expect(isDivider.value).toBe(false)
    source.activeBlockType.value = "NodeThematicBreak"
    expect(isDivider.value).toBe(true)
  })

  // 说明：编译器覆写层为普通 Map（非响应式），computed 仅随响应式来源
  // (activeBlockAttrs / currentPageDividerId / activeBlockType) 变化重算，
  // 与重构前视图行为一致；覆写写入方会同时更新这些响应式来源以触发刷新。
})
