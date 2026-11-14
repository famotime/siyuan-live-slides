import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('PageInspectorSection 卡片化呈现与分区结构测试', () => {
  const pageInspectorPath = path.resolve(__dirname, '../src/ui/components/PageInspectorSection.vue')
  const layoutPickerPath = path.resolve(__dirname, '../src/ui/components/LayoutPicker.vue')
  const transitionSelectorPath = path.resolve(__dirname, '../src/ui/components/TransitionSelector.vue')

  const pageInspectorContent = fs.readFileSync(pageInspectorPath, 'utf8')
  const layoutPickerContent = fs.readFileSync(layoutPickerPath, 'utf8')
  const transitionSelectorContent = fs.readFileSync(transitionSelectorPath, 'utf8')

  it('1. 页面版式与转场动效必须包裹在 .spm-card-control 卡片样式中并拥有统一图标标题', () => {
    // 页面版式卡片包裹
    expect(pageInspectorContent).toMatch(
      /<div class="spm-card-control">[\s\S]*?<SlidesIcon name="layout" \/>\s*<span>页面版式<\/span>[\s\S]*?<LayoutPicker/
    )
    // 转场动效卡片包裹
    expect(pageInspectorContent).toMatch(
      /<div class="spm-card-control">[\s\S]*?<SlidesIcon name="transition" \/>\s*<span>转场动效<\/span>[\s\S]*?<TransitionSelector/
    )
  })

  it('2. LayoutPicker 与 TransitionSelector 必须传入 hide-header 以消除卡片内部重复标题与外衬', () => {
    expect(pageInspectorContent).toMatch(/<LayoutPicker[\s\S]*?hide-header/)
    expect(pageInspectorContent).toMatch(/<TransitionSelector[\s\S]*?hide-header/)

    // LayoutPicker 组件自身应支持 hideHeader prop 并具备 no-header 样式处理
    expect(layoutPickerContent).toContain('hideHeader?: boolean')
    expect(layoutPickerContent).toContain('spm-layout-picker--no-header')

    // TransitionSelector 组件自身应支持 hideHeader prop 并具备 no-header 样式处理
    expect(transitionSelectorContent).toContain('hideHeader?: boolean')
    expect(transitionSelectorContent).toContain('spm-transition-selector--no-header')
  })

  it('3. 必须包含「页面动效」与「其他配置」小标题分区', () => {
    expect(pageInspectorContent).toMatch(/<div class="spm-section-header"[^>]*>\s*<span>页面动效<\/span>\s*<\/div>/)
    expect(pageInspectorContent).toMatch(/<div class="spm-section-header"[^>]*>\s*<span>其他配置<\/span>\s*<\/div>/)
  })

  it('4. 分区及各卡片必须遵循正确的纵向层级顺序', () => {
    const layoutIdx = pageInspectorContent.indexOf('<span>页面版式</span>')
    const spacingIdx = pageInspectorContent.indexOf('<span>页面间距</span>')
    const motionSectionIdx = pageInspectorContent.indexOf('<span>页面动效</span>')
    const transitionIdx = pageInspectorContent.indexOf('<span>转场动效</span>')
    const maskIdx = pageInspectorContent.indexOf('<span>页面动态蒙版</span>')
    const otherSectionIdx = pageInspectorContent.indexOf('<span>其他配置</span>')
    const notesIdx = pageInspectorContent.indexOf('<span>演讲者提词</span>')
    const quickActionIdx = pageInspectorContent.indexOf('class="spm-control-title">快捷操作')

    expect(layoutIdx).toBeGreaterThan(0)
    expect(spacingIdx).toBeGreaterThan(layoutIdx)
    expect(motionSectionIdx).toBeGreaterThan(spacingIdx)
    expect(transitionIdx).toBeGreaterThan(motionSectionIdx)
    expect(maskIdx).toBeGreaterThan(transitionIdx)
    expect(otherSectionIdx).toBeGreaterThan(maskIdx)
    expect(notesIdx).toBeGreaterThan(otherSectionIdx)
    expect(quickActionIdx).toBeGreaterThan(notesIdx)
  })
})
