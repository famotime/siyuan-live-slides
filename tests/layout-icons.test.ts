import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

describe("LayoutPicker & SlidesIcon 版式线框图标体系测试", () => {
  const layoutPickerPath = path.resolve(__dirname, "../src/ui/components/LayoutPicker.vue")
  const slidevIconPath = path.resolve(__dirname, "../src/ui/components/SlidesIcon.vue")

  const layoutPickerContent = fs.readFileSync(layoutPickerPath, "utf-8")
  const slidevIconContent = fs.readFileSync(slidevIconPath, "utf-8")

  const pickerLayouts = [
    "cover",
    "default",
    "cols-header",
    "clover",
    "image-right",
    "image-left",
    "center",
    "fact",
    "intro",
    "quote",
    "timeline",
  ]

  const expectedSvgLayouts = [
    "cover",
    "default",
    "two-cols",
    "cols-header",
    "two-cols-header",
    "three-cols-header",
    "clover",
    "timeline",
    "steps",
    "image-right",
    "image-left",
    "center",
    "fact",
    "intro",
    "quote",
  ]

  it("LayoutPicker 应定义合并后的通用表头多栏 (cols-header) 及其他标准版式", () => {
    pickerLayouts.forEach(layout => {
      expect(layoutPickerContent).toContain(`name: '${layout}'`)
    })
  })

  it("LayoutPicker 应包含三大场景分组结构 (内容分栏、图文排版、聚焦与强调)", () => {
    expect(layoutPickerContent).toContain("内容分栏")
    expect(layoutPickerContent).toContain("图文排版")
    expect(layoutPickerContent).toContain("聚焦与强调")
    expect(layoutPickerContent).toContain("spm-layout-group")
  })

  it("LayoutPicker 不应包含旧版 emoji 符号，应统一采用 SlidesIcon 渲染", () => {
    const legacyEmojis = ["🎯", "📄", "▥", "☲", "☰", "🖼️", "🎨", "🀄", "🔢", "👤", "💬"]
    legacyEmojis.forEach(emoji => {
      expect(layoutPickerContent).not.toContain(emoji)
    })
    expect(layoutPickerContent).toContain("<SlidesIcon :name=\"'layout-' + layout.name\" />")
  })

  it("SlidesIcon 应包含所有版式（含 cols-header 及历史版式）的专属线框 SVG 定义", () => {
    expectedSvgLayouts.forEach(layout => {
      expect(slidevIconContent).toContain(`layout-${layout}`)
    })
  })

  it("SlidesIcon 应包含页面设置所需的 search、settings、notes 辅助图标", () => {
    expect(slidevIconContent).toContain("name === 'search'")
    expect(slidevIconContent).toContain("name === 'settings'")
    expect(slidevIconContent).toContain("name === 'notes'")
  })

  it("SlidesIcon 应包含抽屉浏览器双端切换所需的 desktop 与 mobile 矢量图标", () => {
    expect(slidevIconContent).toContain("name === 'desktop'")
    expect(slidevIconContent).toContain("name === 'mobile'")
  })

  it("SlidesIcon 应包含缩略图总览所需的 layout-grid (4个小方格) 矢量图标定义", () => {
    const currentIconContent = fs.readFileSync(slidevIconPath, "utf-8")
    expect(currentIconContent).toContain("name === 'layout-grid'")
  })
})
