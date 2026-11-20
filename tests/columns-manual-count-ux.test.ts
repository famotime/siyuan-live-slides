import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('多栏栏数手工指定与表头插槽 UX 架构 (columns-manual-count-ux)', () => {
  const pageInspectorPath = path.resolve(__dirname, '../src/ui/components/PageInspectorSection.vue')
  const blockInspectorPath = path.resolve(__dirname, '../src/ui/components/BlockInspectorSection.vue')
  const dockViewPath = path.resolve(__dirname, '../src/ui/dock/SlidesInspectorDockView.vue')
  // RF-026：块级插槽领域实现已抽离至 useBlockSlotSection
  const slotSectionPath = path.resolve(__dirname, '../src/ui/components/useBlockSlotSection.ts')

  const pageContent = fs.readFileSync(pageInspectorPath, 'utf8')
  const blockContent = fs.readFileSync(blockInspectorPath, 'utf8')
  const dockContent = fs.readFileSync(dockViewPath, 'utf8')
  const slotSectionContent = fs.readFileSync(slotSectionPath, 'utf8')

  // RF-029：页面级分栏比例领域实现已抽离至 usePageColumnRatio + column-ratio 共享工具
  const columnRatioPath = path.resolve(__dirname, '../src/ui/components/usePageColumnRatio.ts')
  const columnRatioContent = fs.readFileSync(columnRatioPath, 'utf8')

  it('1. PageInspectorSection 必须提供 2~6 栏手工指定分段控制与 setColumnCount 处理', () => {
    // 包含 2~6 栏选择按钮组（模板）与领域实现（usePageColumnRatio）
    expect(pageContent).toContain('setColumnCount(col)')
    expect(pageContent).toContain('[2, 3, 4, 5, 6]')
    expect(columnRatioContent).toMatch(/function setColumnCount\(col: number\)/)
    // 手工指定栏数应生成均分比例并重定向至 cols-header
    expect(columnRatioContent).toContain("'cols-header'")
    expect(columnRatioContent).toContain('buildEqualRatio(col)')
  })

  it('2. PageInspectorSection detectedColumnsCount 必须优先根据 pageLayoutRatio 冒号段数精确计算栏数', () => {
    // 段数解析统一收敛到 column-ratio 共享工具
    expect(columnRatioContent).toContain('countRatioColumns(source.pageLayoutRatio())')
    const sharedRatioContent = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/column-ratio.ts'), 'utf8')
    expect(sharedRatioContent).toContain("r.split(':').filter(Boolean).length")
  })

  it('3. BlockInspectorSection 必须始终提供「标题」插槽，废弃 two-cols 无标题分支', () => {
    // 视图消费领域模块解构的 availableSlots
    expect(blockContent).toContain('availableSlots')
    // 插槽清单实现位于 useBlockSlotSection：必须始终包含 header 作为标题
    expect(slotSectionContent).toContain("{ value: 'header', label: '标题' }")
    // 不得存在 l === 'two-cols' 剥夺表头/标题的写死分支
    expect(blockContent).not.toMatch(/if\s*\(l\s*===\s*['"]two-cols['"]\)\s*\{\s*return\s*\[\s*\{\s*value:\s*['"]['"],\s*label:\s*['"]默认['"]\s*\},/)
    expect(slotSectionContent).not.toMatch(/if\s*\(l\s*===\s*['"]two-cols['"]\)\s*\{\s*return\s*\[\s*\{\s*value:\s*['"]['"],\s*label:\s*['"]默认['"]\s*\},/)
  })

  it('4. BlockInspectorSection 必须接收 currentSlideLayoutRatio 并联动计算 detectedColumnsCount', () => {
    expect(blockContent).toContain('currentSlideLayoutRatio?: string')
    // 组件将 ratio 注入领域模块，探测逻辑在 useBlockSlotSection 中消费
    expect(blockContent).toContain('currentSlideLayoutRatio: () => props.currentSlideLayoutRatio')
    expect(slotSectionContent).toContain('source.currentSlideLayoutRatio()')
    expect(slotSectionContent).toContain("ratio.split(':').filter(Boolean)")
  })

  it('5. SlidesInspectorDockView 必须向 BlockInspectorSection 注入 currentSlideLayoutRatio，并识别 header 插槽归属多栏', () => {
    expect(dockContent).toContain(':current-slide-layout-ratio="pageLayoutRatio"')
    expect(dockContent).toMatch(/blockSlot\s*===\s*['"]header['"]/)
  })
})
