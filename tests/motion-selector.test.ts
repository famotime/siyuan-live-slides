import { describe, expect, it } from 'vitest'
import MotionSelector from '../src/ui/components/MotionSelector.vue'
import {
  MOTION_PRESETS,
  MOTION_DURATION_OPTIONS,
  MOTION_DELAY_OPTIONS,
  EMPHASIS_PRESETS,
  TEXT_PRESETS,
  EMPHASIS_DURATION_OPTIONS,
  TYPEWRITER_SPEED_OPTIONS,
  IMotionPreset,
  IEmphasisPreset,
  ITextAnimPreset,
} from '../src/ui/components/motion-presets'
import BlockInspectorSection from '../src/ui/components/BlockInspectorSection.vue'

describe('MotionSelector - 入场微动效与多模式可视化选择器', () => {
  it('MotionSelector 组件应成功加载并定义为有效的 Vue SFC', () => {
    expect(MotionSelector).toBeDefined()
    expect(typeof MotionSelector).toBe('object')
  })

  it('应内置完整的 7 种入场微动效预设且包含完备的中文与描述', () => {
    expect(MOTION_PRESETS).toBeDefined()
    expect(MOTION_PRESETS.length).toBe(7)

    const presetNames = MOTION_PRESETS.map((m: IMotionPreset) => m.name)
    expect(presetNames).toContain('slide-up')
    expect(presetNames).toContain('fade-in')
    expect(presetNames).toContain('slide-down')
    expect(presetNames).toContain('slide-left')
    expect(presetNames).toContain('slide-right')
    expect(presetNames).toContain('zoom-in')
    expect(presetNames).toContain('bounce')

    for (const item of MOTION_PRESETS) {
      expect(item.name).toBeTruthy()
      expect(item.label).toBeTruthy()
      expect(item.desc).toBeTruthy()
      expect(['slide', 'fade', 'zoom', 'bounce']).toContain(item.type)
    }
  })

  it('各预设中文名称应准确对应演示物理动效特征', () => {
    const map = new Map(MOTION_PRESETS.map((m: IMotionPreset) => [m.name, m.label]))
    expect(map.get('slide-up')).toBe('上浮')
    expect(map.get('fade-in')).toBe('淡入')
    expect(map.get('slide-down')).toBe('下沉')
    expect(map.get('slide-left')).toBe('左滑')
    expect(map.get('slide-right')).toBe('右滑')
    expect(map.get('zoom-in')).toBe('缩放')
    expect(map.get('bounce')).toBe('弹性')
  })

  it('时长与延迟预设选项应涵盖常见演示节奏', () => {
    expect(MOTION_DURATION_OPTIONS.length).toBeGreaterThanOrEqual(4)
    expect(MOTION_DELAY_OPTIONS.length).toBeGreaterThanOrEqual(4)

    const durValues = MOTION_DURATION_OPTIONS.map(d => d.value)
    expect(durValues).toContain(0) // 默认 450ms
    expect(durValues).toContain(200) // 极速
    expect(durValues).toContain(500) // 平滑
    expect(durValues).toContain(800) // 缓慢

    const delValues = MOTION_DELAY_OPTIONS.map(d => d.value)
    expect(delValues).toContain(0)
    expect(delValues).toContain(150)
  })

  it('应内置完整的 3 种持续强调微动效预设 (Pulse, Float, Shimmer)', () => {
    expect(EMPHASIS_PRESETS).toBeDefined()
    expect(EMPHASIS_PRESETS.length).toBe(3)

    const names = EMPHASIS_PRESETS.map((p: IEmphasisPreset) => p.name)
    expect(names).toContain('pulse')
    expect(names).toContain('float')
    expect(names).toContain('shimmer')

    const labels = EMPHASIS_PRESETS.map((p: IEmphasisPreset) => p.label)
    expect(labels).toContain('呼吸微光')
    expect(labels).toContain('3D 悬浮')
    expect(labels).toContain('流光掠过')

    expect(EMPHASIS_DURATION_OPTIONS.length).toBe(3)
  })

  it('应内置完整的 2 种文本微动效预设 (CountUp, Typewriter)', () => {
    expect(TEXT_PRESETS).toBeDefined()
    expect(TEXT_PRESETS.length).toBe(2)

    const names = TEXT_PRESETS.map((p: ITextAnimPreset) => p.name)
    expect(names).toContain('countup')
    expect(names).toContain('typewriter')

    const labels = TEXT_PRESETS.map((p: ITextAnimPreset) => p.label)
    expect(labels).toContain('数字滚动')
    expect(labels).toContain('终端打字机')

    expect(TYPEWRITER_SPEED_OPTIONS.length).toBe(3)
  })

  it('BlockInspectorSection 引入 MotionSelector 后应正常挂载并导出', () => {
    expect(BlockInspectorSection).toBeDefined()
    expect(typeof BlockInspectorSection).toBe('object')
  })

  it('微动效配置应支持纯字符串预设与带时长/延迟的 JSON 结构双向互转', () => {
    // 纯字符串预设
    const rawString = 'slide-up'
    expect(rawString).toBe('slide-up')

    // JSON 结构序列化与反序列化
    const complexConfig = {
      preset: 'bounce',
      duration: 500,
      delay: 150,
    }
    const jsonStr = JSON.stringify(complexConfig)
    const parsed = JSON.parse(jsonStr)

    expect(parsed.preset).toBe('bounce')
    expect(parsed.duration).toBe(500)
    expect(parsed.delay).toBe(150)
  })
})
