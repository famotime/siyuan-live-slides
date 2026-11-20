import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  EMPHASIS_PRESETS,
  TEXT_PRESETS,
  EMPHASIS_DURATION_OPTIONS,
  TYPEWRITER_SPEED_OPTIONS,
} from '../src/ui/components/motion-presets'
import BlockInspectorSection from '../src/ui/components/BlockInspectorSection.vue'

describe('Visual Motion Grid & Shared Live Preview Stage (持续强调与文本动效可视化升级)', () => {
  const blockInspectorPath = path.resolve(__dirname, '../src/ui/components/BlockInspectorSection.vue')
  const scssPath = path.resolve(__dirname, '../src/index.scss')

  const blockInspectorContent = fs.readFileSync(blockInspectorPath, 'utf8')
  const scssContent = fs.readFileSync(scssPath, 'utf8')

  it('1. 持续强调预设 (EMPHASIS_PRESETS) 必须包含 Pulse, Float, Shimmer 三大微动效且元数据完备', () => {
    expect(EMPHASIS_PRESETS.length).toBe(3)
    const names = EMPHASIS_PRESETS.map(p => p.name)
    expect(names).toEqual(['pulse', 'float', 'shimmer'])

    for (const p of EMPHASIS_PRESETS) {
      expect(p.label).toBeTruthy()
      expect(p.desc).toBeTruthy()
      expect(p.icon).toBeTruthy()
      expect(p.type).toBe('emphasis')
    }
  })

  it('2. 文本动效预设 (TEXT_PRESETS) 必须包含 CountUp 与 Typewriter 且元数据完备', () => {
    expect(TEXT_PRESETS.length).toBe(2)
    const names = TEXT_PRESETS.map(p => p.name)
    expect(names).toEqual(['countup', 'typewriter'])

    for (const p of TEXT_PRESETS) {
      expect(p.label).toBeTruthy()
      expect(p.desc).toBeTruthy()
      expect(p.icon).toBeTruthy()
      expect(p.type).toBe('text')
    }
  })

  it('3. BlockInspectorSection 必须在动效开启后常驻置顶统一试播舞台 (spm-motion-stage-card)', () => {
    // 舞台必须在 Tab 切换栏之上或之前常驻
    expect(blockInspectorContent).toContain('spm-motion-stage-card')
    expect(blockInspectorContent).toContain('spm-motion-stage-viewport')
    expect(blockInspectorContent).toContain('activeMotionSummaryBadge')
    expect(blockInspectorContent).toContain('replayLiveStage')

    // 必须包含入场、强调与文本三类子舞台视口
    expect(blockInspectorContent).toContain('stage-motion-')
    expect(blockInspectorContent).toContain('stage-emphasis-')
    expect(blockInspectorContent).toContain('spm-stage-text-viewport')
    expect(blockInspectorContent).toContain('spm-stage-countup-display')
    expect(blockInspectorContent).toContain('spm-stage-typewriter-display')
  })

  it('4. BlockInspectorSection 必须为持续强调提供 3 列等宽微动效卡片网格，且内嵌微缩动画舞台', () => {
    expect(blockInspectorContent).toContain('spm-motion-grid--cols-3')
    expect(blockInspectorContent).toContain('mini-anim-emphasis-')
    expect(blockInspectorContent).toContain('EMPHASIS_PRESETS')
  })

  it('5. BlockInspectorSection 必须为文本动效提供 2 列等宽微动效卡片网格，且内嵌动态翻滚与打字微缩元素', () => {
    expect(blockInspectorContent).toContain('spm-motion-grid--cols-2')
    expect(blockInspectorContent).toContain('mini-text-countup-wrap')
    expect(blockInspectorContent).toContain('mini-text-typewriter-wrap')
    expect(blockInspectorContent).toContain('TEXT_PRESETS')
  })

  it('6. Tab 面板切换必须具备平滑淡入防抖容器 (spm-tab-panel-fade)', () => {
    expect(blockInspectorContent).toContain('spm-tab-panel-fade')
    expect(scssContent).toContain('.spm-tab-panel-fade')
    expect(scssContent).toMatch(/@keyframes\s+spmFadeIn/)
  })

  it('7. 全局样式必须为微缩动画网格与舞台视口提供统一高度与防御规则，且必须完整导出 7 种入场舞台 @keyframes', () => {
    expect(scssContent).toContain('.spm-motion-stage-card')
    expect(scssContent).toMatch(/\.spm-motion-stage-viewport[\s\S]*?height:\s*52px;/)
    expect(scssContent).toMatch(/\.spm-motion-item[\s\S]*?min-height:\s*52px;/)

    // 关键：全局 index.scss 必须完整包含 7 种入场动效的舞台 keyframes，杜绝试播舞台失效无动画
    expect(scssContent).toContain('@keyframes stageMotionSlideUp')
    expect(scssContent).toContain('@keyframes stageMotionFadeIn')
    expect(scssContent).toContain('@keyframes stageMotionSlideDown')
    expect(scssContent).toContain('@keyframes stageMotionSlideLeft')
    expect(scssContent).toContain('@keyframes stageMotionSlideRight')
    expect(scssContent).toContain('@keyframes stageMotionZoomIn')
    expect(scssContent).toContain('@keyframes stageMotionBounce')

    expect(scssContent).toContain('.mini-anim-emphasis-pulse')
    expect(scssContent).toContain('.mini-anim-emphasis-float')
    expect(scssContent).toContain('.mini-anim-emphasis-shimmer')
    expect(scssContent).toContain('.mini-text-countup-wrap')
    expect(scssContent).toContain('.mini-text-typewriter-wrap')
  })

  it('8. BlockInspectorSection 针对入场动效选择必须实现乐观预览联动与重播', () => {
    // 组件保留乐观契约（localPreset 解构与重播入口）
    expect(blockInspectorContent).toContain('localPreset')
    expect(blockInspectorContent).toContain('replayLiveStage')
    // 乐观重播核心实现位于 useBlockMotionSection 领域模块
    const motionSectionContent = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/useBlockMotionSection.ts'), 'utf8')
    expect(motionSectionContent).toContain('replayLiveStage()')
    expect(motionSectionContent).toContain('localPreset.value = payload.preset')
  })

  it('9. BlockInspectorSection 组件成功导出且类型完整', () => {
    expect(BlockInspectorSection).toBeDefined()
    expect(typeof BlockInspectorSection).toBe('object')
  })
})
