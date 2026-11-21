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

  it('高级设置折叠菜单应默认折叠，并具备醒目的药丸徽标与交互状态提示', () => {
    expect(docInspectorCode).toContain('const isAdvancedExpanded = ref(false)')
    expect(docInspectorCode).toContain('class="spm-advanced-toggle')
    expect(docInspectorCode).toContain(':aria-expanded="isAdvancedExpanded"')
    expect(docInspectorCode).toContain('@click="isAdvancedExpanded = !isAdvancedExpanded"')
    expect(docInspectorCode).toContain('<div v-if="isAdvancedExpanded" class="spm-advanced-content">')
    expect(docInspectorCode).toContain('class="spm-advanced-pill"')
    expect(docInspectorCode).toContain('class="spm-advanced-settings-icon"')
    expect(docInspectorCode).toContain('class="spm-advanced-state-text"')
  })

  it('高级设置菜单应位于「演示全局操作」下方，并包含三项全局配置卡片', () => {
    const actionsIndex = docInspectorCode.indexOf('演示全局操作')
    const advancedIndex = docInspectorCode.indexOf('class="spm-advanced-menu"')
    const advancedContentIndex = docInspectorCode.indexOf('class="spm-advanced-content"')

    expect(actionsIndex).toBeGreaterThan(-1)
    expect(advancedIndex).toBeGreaterThan(actionsIndex)
    expect(advancedContentIndex).toBeGreaterThan(advancedIndex)

    const webServeIndex = docInspectorCode.indexOf('本地网络伺服预览')
    const headingSizeIndex = docInspectorCode.indexOf('固定页面标题大小')
    const listMarkersIndex = docInspectorCode.indexOf('列表前缀标记')

    expect(webServeIndex).toBeGreaterThan(advancedContentIndex)
    expect(headingSizeIndex).toBeGreaterThan(webServeIndex)
    expect(listMarkersIndex).toBeGreaterThan(headingSizeIndex)
  })

  it('全局样式表应包含高级设置视觉醒目强化所需样式与重音指示条', () => {
    expect(scssCode).toContain('.spm-advanced-menu')
    expect(scssCode).toContain('.spm-advanced-toggle')
    expect(scssCode).toContain('.spm-advanced-chevron')
    expect(scssCode).toContain('.spm-advanced-content')
    expect(scssCode).toContain('border-left: 3.5px solid var(--b3-theme-primary')
    expect(scssCode).toContain('.spm-advanced-pill')
  })

  it('高级设置菜单中应包含 AI 演讲提词服务配置卡片并支持接管横幅与输入框置灰', () => {
    expect(docInspectorCode).toContain('AI 演讲提词服务')
    expect(docInspectorCode).toContain('class="api-switch-managed-tip"')
    expect(docInspectorCode).toContain('managedAiConfig.profileName')
    expect(docInspectorCode).toContain(':disabled="Boolean(managedAiConfig)"')
    expect(docInspectorCode).toContain('@click="openSettingsDialog"')
    expect(docInspectorCode).toContain('onAiModelChange')
    expect(docInspectorCode).toContain('onAiBaseUrlChange')
    expect(docInspectorCode).toContain('onAiApiKeyChange')
  })
})
