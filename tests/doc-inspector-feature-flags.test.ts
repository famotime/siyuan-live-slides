import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

describe("DocInspectorSection Feature Flags 全局配置操作开关测试", () => {
  const docInspectorPath = path.resolve(__dirname, "../src/ui/components/DocInspectorSection.vue")
  const content = fs.readFileSync(docInspectorPath, "utf-8")

  it("智能分页与清除分页应通过 smartSplit 与 aiScript 门控", () => {
    expect(content).toMatch(/v-if="isFeatureEnabled\('smartSplit'\)\s*&&\s*isFeatureEnabled\('aiScript'\)"[\s\S]*?<span>智能分页<\/span>/)
    expect(content).toMatch(/v-if="isFeatureEnabled\('smartSplit'\)\s*&&\s*isFeatureEnabled\('aiScript'\)"[\s\S]*?<span>清除分页<\/span>/)
  })

  it("智能动效与清除动效应通过 smartAnimation 门控", () => {
    expect(content).toMatch(/v-if="isFeatureEnabled\('smartAnimation'\)"[\s\S]*?<span>智能动效<\/span>/)
    expect(content).toMatch(/v-if="isFeatureEnabled\('smartAnimation'\)"[\s\S]*?<span>清除动效<\/span>/)
  })

  it("增加讲稿块与清除讲稿块应通过 speakerNotesBlocks 门控", () => {
    expect(content).toMatch(/v-if="isFeatureEnabled\('speakerNotesBlocks'\)"[\s\S]*?<span>增加讲稿块<\/span>/)
    expect(content).toMatch(/v-if="isFeatureEnabled\('speakerNotesBlocks'\)"[\s\S]*?<span>清除讲稿块<\/span>/)
  })
})
