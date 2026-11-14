import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('多栏栏数手工指定与表头插槽 UX 架构 (columns-manual-count-ux)', () => {
  const pageInspectorPath = path.resolve(__dirname, '../src/ui/components/PageInspectorSection.vue')
  const blockInspectorPath = path.resolve(__dirname, '../src/ui/components/BlockInspectorSection.vue')
  const dockViewPath = path.resolve(__dirname, '../src/ui/dock/SlidesInspectorDockView.vue')

  const pageContent = fs.readFileSync(pageInspectorPath, 'utf8')
  const blockContent = fs.readFileSync(blockInspectorPath, 'utf8')
  const dockContent = fs.readFileSync(dockViewPath, 'utf8')

  it('1. PageInspectorSection 必须提供 2~6 栏手工指定分段控制与 setColumnCount 处理', () => {
    // 包含 2~6 栏选择按钮组
    expect(pageContent).toContain('setColumnCount(col)')
    expect(pageContent).toContain('[2, 3, 4, 5, 6]')
    // setColumnCount 函数应为 2~6 栏生成对应均分比例并重定向至 cols-header
    expect(pageContent).toMatch(/function setColumnCount\(col: number\)/)
    expect(pageContent).toContain("'1:1:1'")
    expect(pageContent).toContain("'1:1:1:1'")
  })

  it('2. PageInspectorSection detectedColumnsCount 必须优先根据 pageLayoutRatio 冒号段数精确计算栏数', () => {
    expect(pageContent).toContain("const ratio = (props.pageLayoutRatio || '').trim()")
    expect(pageContent).toContain("ratio.split(':').filter(Boolean).length")
  })

  it('3. BlockInspectorSection 必须始终提供「标题」插槽，废弃 two-cols 无标题分支', () => {
    // availableSlots 中必须始终包含 header 作为标题
    expect(blockContent).toContain("{ value: 'header', label: '标题' }")
    // 不得存在 l === 'two-cols' 剥夺表头/标题的写死分支
    expect(blockContent).not.toMatch(/if\s*\(l\s*===\s*['"]two-cols['"]\)\s*\{\s*return\s*\[\s*\{\s*value:\s*['"]['"],\s*label:\s*['"]默认['"]\s*\},/)
  })

  it('4. BlockInspectorSection 必须接收 currentSlideLayoutRatio 并联动计算 detectedColumnsCount', () => {
    expect(blockContent).toContain('currentSlideLayoutRatio?: string')
    expect(blockContent).toContain("const ratio = (props.currentSlideLayoutRatio || '').trim()")
  })

  it('5. SlidesInspectorDockView 必须向 BlockInspectorSection 注入 currentSlideLayoutRatio，并识别 header 插槽归属多栏', () => {
    expect(dockContent).toContain(':current-slide-layout-ratio="pageLayoutRatio"')
    expect(dockContent).toMatch(/blockSlot\s*===\s*['"]header['"]/)
  })
})
