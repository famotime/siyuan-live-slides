import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('侧栏全局操作与页面检查器按钮布局规范', () => {
  const docInspectorPath = path.resolve(__dirname, '../src/ui/components/DocInspectorSection.vue')
  const pageInspectorPath = path.resolve(__dirname, '../src/ui/components/PageInspectorSection.vue')
  const dockViewPath = path.resolve(__dirname, '../src/ui/dock/SlidesInspectorDockView.vue')
  const previewTabPath = path.resolve(__dirname, '../src/ui/tab/SlidesPreviewTab.vue')

  const docInspectorCode = fs.readFileSync(docInspectorPath, 'utf8')
  const pageInspectorCode = fs.readFileSync(pageInspectorPath, 'utf8')
  const dockViewCode = fs.readFileSync(dockViewPath, 'utf8')
  const previewTabCode = fs.readFileSync(previewTabPath, 'utf8')

  it('DocInspectorSection「演示全局操作」应包含增加讲稿块、清除讲稿块、智能动效、清除动效且移除识别讲稿块与导出图片', () => {
    expect(docInspectorCode).toContain('<span>增加讲稿块</span>')
    expect(docInspectorCode).toContain('<span>清除讲稿块</span>')
    expect(docInspectorCode).toContain('<span>智能动效</span>')
    expect(docInspectorCode).toContain('<span>清除动效</span>')

    expect(docInspectorCode).not.toContain('识别讲稿块')
    expect(docInspectorCode).not.toContain('导出图片')
    expect(docInspectorCode).not.toContain('exportImages')

    const addNotesIdx = docInspectorCode.indexOf('<span>增加讲稿块</span>')
    const clearNotesIdx = docInspectorCode.indexOf('<span>清除讲稿块</span>')
    const autoAnimIdx = docInspectorCode.indexOf('<span>智能动效</span>')
    const clearAnimIdx = docInspectorCode.indexOf('<span>清除动效</span>')

    expect(clearNotesIdx).toBeGreaterThan(addNotesIdx)
    expect(autoAnimIdx).toBeGreaterThan(clearNotesIdx)
    expect(clearAnimIdx).toBeGreaterThan(autoAnimIdx)
  })

  it('PageInspectorSection「演讲者提词」应取消跨页全部追加与全部删除按钮，保留单页操作', () => {
    expect(pageInspectorCode).not.toContain('全部追加')
    expect(pageInspectorCode).not.toContain('全部删除')
    expect(pageInspectorCode).not.toContain('batchAppendNotes')
    expect(pageInspectorCode).not.toContain('batchDeleteNotes')

    expect(pageInspectorCode).toContain('添加讲稿备注块')
    expect(pageInspectorCode).toContain('定位讲稿块')
    expect(pageInspectorCode).toContain('追加讲稿块')
  })

  it('SlidesInspectorDockView 应正确绑定全局讲稿增删与全篇动效清理事件', () => {
    expect(dockViewCode).toContain('@add-or-identify-notes="onAddOrIdentifyNotesBlocks"')
    expect(dockViewCode).toContain('@clear-notes="onBatchDeleteNotes"')
    expect(dockViewCode).toContain('@clear-animations="onClearAnimationsDocument"')
    expect(dockViewCode).not.toContain('@batch-append-notes')
    expect(dockViewCode).not.toContain('@export-images')
  })

  it('SlidesPreviewTab 顶部工具栏中的图片导出菜单应保持保留', () => {
    expect(previewTabCode).toContain("isFeatureEnabled('exportImage')")
    expect(previewTabCode).toContain('导出全篇为图片包 (ZIP)')
  })
})
