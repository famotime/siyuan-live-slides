import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

describe("LayoutPicker & SlidevIcon 版式线框图标体系测试", () => {
  const layoutPickerPath = path.resolve(__dirname, "../src/ui/components/LayoutPicker.vue")
  const slidevIconPath = path.resolve(__dirname, "../src/ui/components/SlidevIcon.vue")

  const layoutPickerContent = fs.readFileSync(layoutPickerPath, "utf-8")
  const slidevIconContent = fs.readFileSync(slidevIconPath, "utf-8")

  const expectedLayouts = [
    "cover",
    "default",
    "two-cols",
    "two-cols-header",
    "three-cols-header",
    "image-right",
    "image-left",
    "center",
    "fact",
    "intro",
    "quote",
  ]

  it("LayoutPicker 应定义所有 11 种标准版式", () => {
    expectedLayouts.forEach(layout => {
      expect(layoutPickerContent).toContain(`name: '${layout}'`)
    })
  })

  it("LayoutPicker 不应包含旧版 emoji 符号，应统一采用 SlidevIcon 渲染", () => {
    const legacyEmojis = ["🎯", "📄", "▥", "☲", "☰", "🖼️", "🎨", "🀄", "🔢", "👤", "💬"]
    legacyEmojis.forEach(emoji => {
      expect(layoutPickerContent).not.toContain(emoji)
    })
    expect(layoutPickerContent).toContain("<SlidevIcon :name=\"'layout-' + layout.name\" />")
  })

  it("SlidevIcon 应包含所有 11 种版式的专属线框 SVG 定义", () => {
    expectedLayouts.forEach(layout => {
      expect(slidevIconContent).toContain(`layout-${layout}`)
    })
  })

  it("SlidevIcon 应包含页面设置所需的 search、settings、notes 辅助图标", () => {
    expect(slidevIconContent).toContain("name === 'search'")
    expect(slidevIconContent).toContain("name === 'settings'")
    expect(slidevIconContent).toContain("name === 'notes'")
  })
})
