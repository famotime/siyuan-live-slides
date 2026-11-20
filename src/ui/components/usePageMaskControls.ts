/**
 * 页面蒙版领域逻辑（自 PageInspectorSection 抽离）
 *
 * 职责：时钟/线性蒙版形态判定、默认与生效比例派生、方向选择时的
 * 比例自动升级/降级联动与帮助文案。
 */

import { computed } from 'vue'

/** 蒙版领域逻辑的输入源（getter 形式，兼容 props 只读语义） */
export interface IPageMaskControlsSource {
  pageMask: () => string | undefined
  pageMaskRatio: () => string | undefined
}

/** 蒙版变更事件发射器（update:pageMask / update:pageMaskRatio） */
export interface IPageMaskControlsEmitter {
  (e: 'update:pageMask', val: string): void
  (e: 'update:pageMaskRatio', val: string): void
}

export function usePageMaskControls(source: IPageMaskControlsSource, emit: IPageMaskControlsEmitter) {
  /** 蒙版展开比例预设档位 */
  const maskRatioPresets = [
    { label: '1:1 (2步)', value: '1:1' },
    { label: '1:1:1 (3步)', value: '1:1:1' },
    { label: '1:2:1 (非等宽)', value: '1:2:1' },
    { label: '1:1:1:1 (4步)', value: '1:1:1:1' },
  ]

  const isClockMask = computed(() => {
    const m = source.pageMask()
    return m === 'clockwise' || m === 'counter-clockwise' || m === 'cw' || m === 'ccw'
  })

  const defaultMaskRatio = computed(() => {
    return isClockMask.value ? '1:1:1:1' : '1:1'
  })

  const effectiveMaskRatio = computed(() => {
    return source.pageMaskRatio() || defaultMaskRatio.value
  })

  function selectClockMask(dir: 'clockwise' | 'counter-clockwise') {
    emit('update:pageMask', dir)
    if (!source.pageMaskRatio() || source.pageMaskRatio() === '1:1') {
      emit('update:pageMaskRatio', '1:1:1:1')
    }
  }

  function selectLinearMask(dir: 'down' | 'right') {
    emit('update:pageMask', dir)
    if (!source.pageMaskRatio() || source.pageMaskRatio() === '1:1:1:1') {
      emit('update:pageMaskRatio', '1:1')
    }
  }

  const maskHelpTooltip = computed(() => {
    const m = source.pageMask()
    if (m === 'clockwise' || m === 'counter-clockwise' || m === 'cw' || m === 'ccw') {
      return '时钟走时规则：\n• 顺时针：左上 → 右上 → 右下 → 左下\n• 逆时针：左上 → 左下 → 右下 → 右上\n• 每次点击时针旋转 90° 并扇形扫开 1/4 象限，全部揭开后翻页'
    }
    return '输入规则：\n• 权重比例（项数决定步数）：如 1:1 (2步等分)、1:1:1 (3步等分)、1:2:1 (按权重累计分段)\n• 绝对百分比：如 25:75:100 或 30:80 (指定每步展开的累计百分比)\n• 每次点击或按空格/向右键展露下一段，全部揭开后翻页'
  })

  return {
    maskRatioPresets,
    isClockMask,
    defaultMaskRatio,
    effectiveMaskRatio,
    selectClockMask,
    selectLinearMask,
    maskHelpTooltip,
  }
}
