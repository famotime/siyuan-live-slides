import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import DocInspectorSection from '../src/ui/components/DocInspectorSection.vue'

describe('DocInspectorSection 高级设置简洁折叠菜单', () => {
  const docInspectorPath = path.resolve(__dirname, '../src/ui/components/DocInspectorSection.vue')
  const scssPath = path.resolve(__dirname, '../src/index.scss')

  const docInspectorCode = fs.readFileSync(docInspectorPath, 'utf8')
  const scssCode = fs.readFileSync(scssPath, 'utf8')

  it('DocInspectorSection 组件应正常加载导出', () => {
    expect(DocInspectorSection).toBeDefined()
    expect(typeof DocInspectorSection).toBe('object')
  })

  it('高级设置折叠菜单应默认折叠，仅通过手动点击展开', () => {
    expect(docInspectorCode).toContain('const isAdvancedExpanded = ref(false)')
    expect(docInspectorCode).toContain('class="spm-advanced-toggle"')
    expect(docInspectorCode).toContain(':aria-expanded="isAdvancedExpanded"')
    expect(docInspectorCode).toContain('@click="isAdvancedExpanded = !isAdvancedExpanded"')
    expect(docInspectorCode).toContain('<div v-if="isAdvancedExpanded" class="spm-advanced-content">')
  })

  it('高级设置菜单应位于「演示全局操作」下方，并包含三项全局配置卡片', () => {
    const actionsIndex = docInspectorCode.indexOf('演示全局操作')
    const advancedIndex = docInspectorCode.indexOf('class="spm-advanced-menu"')
    const advancedContentIndex = docInspectorCode.indexOf('class="spm-advanced-content"')

    expect(actionsIndex).toBeGreaterThan(-1)
    expect(advancedIndex).toBeGreaterThan(actionsIndex)
    expect(advancedContentIndex).toBeGreaterThan(advancedIndex)

    const webServeIndex = docInspectorCode.indexOf('本地网络伺服预览')
    const headingSizeIndex = docInspectorCode.indexOf('固定特定标题大小')
    const listMarkersIndex = docInspectorCode.indexOf('列表前缀标记')

    expect(webServeIndex).toBeGreaterThan(advancedContentIndex)
    expect(headingSizeIndex).toBeGreaterThan(webServeIndex)
    expect(listMarkersIndex).toBeGreaterThan(headingSizeIndex)
  })

  it('全局样式表应包含高级设置极简折叠菜单所需样式', () => {
    expect(scssCode).toContain('.spm-advanced-menu')
    expect(scssCode).toContain('.spm-advanced-toggle')
    expect(scssCode).toContain('.spm-advanced-chevron')
    expect(scssCode).toContain('.spm-advanced-content')
  })
})
