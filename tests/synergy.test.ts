import { describe, expect, it, vi } from "vitest"
import { SLIDES_PRESET_TEMPLATES } from "../src/synergy/preset-templates"
import { PropertyManagerBridge } from "../src/synergy/property-manager-bridge"

describe("PropertyManagerBridge (属性管家协同桥接)", () => {
  it("应输出符合属性管家规范的预设模板", () => {
    const bridge = new PropertyManagerBridge()
    const templates = bridge.getPresetTemplates()

    expect(templates.length).toBeGreaterThanOrEqual(9)
    const coverTpl = templates.find(t => t.id === "slides-cover")
    expect(coverTpl).toBeDefined()
    expect(coverTpl?.attrs.some(a => a.key === "custom-slides-layout" && a.value === "cover")).toBe(true)

    const twoColsTpl = templates.find(t => t.id === "slides-two-cols")
    expect(twoColsTpl?.attrs.some(a => a.value === "two-cols")).toBe(true)

    const clickTpl = templates.find(t => t.id === "slides-elem-click")
    expect(clickTpl).toBeDefined()
    expect(clickTpl?.attrs.some(a => a.key === "custom-slides-click" && a.value === "+1")).toBe(true)

    const shikiTpl = templates.find(t => t.id === "slides-shiki-lines")
    expect(shikiTpl).toBeDefined()
    expect(shikiTpl?.attrs.some(a => a.key === "custom-slides-shiki-lines" && a.value === "1-3")).toBe(true)
  })

  it("应生成正确的全库属性检索与转场统计 SQL", () => {
    const bridge = new PropertyManagerBridge()
    const scanSql = bridge.buildScanSlidesBlocksSql()
    expect(scanSql).toContain("SELECT block_id, name, value FROM attributes WHERE name LIKE 'custom-slides-%'")

    const statsSql = bridge.buildTransitionStatsSql()
    expect(statsSql).toContain("custom-slides-transition")
    expect(statsSql).toContain("GROUP BY value")
  })

  it("应支持全库批量重构转场属性", async () => {
    const bridge = new PropertyManagerBridge()
    const mockSqlExecutor = vi.fn().mockResolvedValue([
      { block_id: "block-101" },
      { block_id: "block-102" },
    ])
    const mockSetAttrs = vi.fn().mockResolvedValue(true)

    const result = await bridge.batchUpdateTransitions(
      "fade",
      "slide-left",
      mockSqlExecutor,
      mockSetAttrs,
    )

    expect(result.updatedCount).toBe(2)
    expect(mockSetAttrs).toHaveBeenCalledTimes(2)
    expect(mockSetAttrs).toHaveBeenCalledWith("block-101", {
      "custom-slides-transition": "slide-left",
    })
    expect(mockSetAttrs).toHaveBeenCalledWith("block-102", {
      "custom-slides-transition": "slide-left",
    })
  })

  it("应支持导出符合属性管家标准规范的模板 JSON", () => {
    const bridge = new PropertyManagerBridge()
    const jsonStr = bridge.exportTemplatesJson()
    expect(jsonStr).toContain('"templates"')
    expect(jsonStr).toContain('"counter"')
    const parsed = JSON.parse(jsonStr)
    expect(Array.isArray(parsed.templates)).toBe(true)
    expect(parsed.counter).toBe(parsed.templates.length)
  })

  it("应正确格式化转场统计简报文本", () => {
    const bridge = new PropertyManagerBridge()
    expect(bridge.formatTransitionSummary([])).toBe("全库目前暂无已设置即现转场效果的块")
    const summary = bridge.formatTransitionSummary([
      { value: "slide-left", count: 12 },
      { value: "fade", count: 5 },
    ])
    expect(summary).toContain("slide-left: 12 个")
    expect(summary).toContain("fade: 5 个")
  })

  it("应支持全库批量重构版式属性 (batchUpdateLayout)", async () => {
    const bridge = new PropertyManagerBridge()
    const mockSqlExecutor = vi.fn().mockResolvedValue([
      { block_id: "divider-1" },
      { block_id: "divider-2" },
      { block_id: "divider-3" },
    ])
    const mockSetAttrs = vi.fn().mockResolvedValue(true)

    const result = await bridge.batchUpdateLayout(
      "cover",
      "fact",
      mockSqlExecutor,
      mockSetAttrs,
    )

    expect(result.updatedCount).toBe(3)
    expect(mockSetAttrs).toHaveBeenCalledTimes(3)
    expect(mockSetAttrs).toHaveBeenCalledWith("divider-1", {
      "custom-slides-layout": "fact",
    })
  })
})

