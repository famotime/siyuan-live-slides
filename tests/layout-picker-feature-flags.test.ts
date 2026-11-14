import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

describe("LayoutPicker Feature Flags 版式过滤机制测试", () => {
  const layoutPickerPath = path.resolve(__dirname, "../src/ui/components/LayoutPicker.vue")
  const content = fs.readFileSync(layoutPickerPath, "utf-8")

  it("LayoutPicker 应引入并使用 isLayoutEnabled", () => {
    expect(content).toContain("import { isLayoutEnabled } from '@/feature-flags/feature-flags'")
  })

  it("LayoutPicker 应通过 visibleLayoutGroups 响应式过滤非开启版式", () => {
    expect(content).toContain("visibleLayoutGroups = computed(")
    expect(content).toContain("isLayoutEnabled(item.name)")
    expect(content).toContain("group.items.length > 0")
  })

  it("模板应循环渲染 visibleLayoutGroups 而非未过滤的原始 layoutGroups", () => {
    expect(content).toContain('v-for="group in visibleLayoutGroups"')
    expect(content).not.toContain('v-for="group in layoutGroups"')
  })
})
