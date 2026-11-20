/**
 * 块级多栏插槽领域逻辑（自 BlockInspectorSection 抽离）
 *
 * 职责：多栏版式判定、分栏数三来源探测（页面比例 → 超级块 → 自身插槽）、
 * 可用插槽清单生成、插槽激活态互认（兼容 left/center/right 旧值）。
 * 纯派生领域逻辑，不持有可变状态，便于脱离组件实例单测。
 */

import { computed } from 'vue'
import { countRatioColumns } from '@/ui/components/column-ratio'

/** 超级块探测信息（与 useSuperBlockInspector 探测结果同构） */
export interface IDetectedSbInfo {
  hasSuperBlock: boolean
  colCount: number
  ratio: string
  isCustomWidth: boolean
  recommendedLayout: string
}

/** 多栏插槽领域逻辑的输入源（getter 形式，兼容 props 只读语义） */
export interface IBlockSlotSource {
  elemSlot: () => string
  currentSlideLayout: () => string | undefined
  currentSlideLayoutRatio: () => string | undefined
  currentSlideHeader: () => boolean | string | undefined
  isSuperBlock: () => boolean | undefined
  isImage: () => boolean | undefined
  imageRole: () => string | undefined
  isVideo: () => boolean | undefined
  isCodeBlock: () => boolean | undefined
  detectedSbInfo: () => IDetectedSbInfo | null | undefined
}

export function useBlockSlotSection(source: IBlockSlotSource) {
  const effectiveLayout = computed(() => {
    const l = source.currentSlideLayout() || ''
    // 智能推断：如果当前块已经分配了 header 或 col-1 ~ col-6 插槽，无论上层传入什么，它必然属于 cols-header
    if (['header', 'col-1', 'col-2', 'col-3', 'col-4', 'col-5', 'col-6'].includes(source.elemSlot())) {
      return 'cols-header'
    }
    return l
  })

  const isMultiColsLayout = computed(() => {
    const l = effectiveLayout.value
    return ['two-cols', 'cols-header', 'two-cols-header', 'three-cols-header'].includes(l)
  })

  const hasLayoutControls = computed(() => {
    return isMultiColsLayout.value ||
      Boolean(source.elemSlot()) ||
      Boolean(source.isSuperBlock()) ||
      Boolean(source.detectedSbInfo()?.hasSuperBlock) ||
      Boolean(source.isImage()) ||
      Boolean(source.imageRole()) ||
      Boolean(source.isVideo()) ||
      Boolean(source.isCodeBlock())
  })

  const detectedColumnsCount = computed(() => {
    // 1. 若当前页显式配置了分栏比例，以比例段数为准 (2~6 栏)
    const fromPage = countRatioColumns(source.currentSlideLayoutRatio())
    if (fromPage) return fromPage
    // 2. 超级块信息
    const sbInfo = source.detectedSbInfo()
    if (sbInfo?.colCount && sbInfo.colCount >= 2) {
      return Math.min(sbInfo.colCount, 6)
    }
    // 3. 当前块自身插槽
    const match = source.elemSlot()?.match(/^col-(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num >= 2 && num <= 6) return num
    }
    if (source.currentSlideLayout() === 'three-cols-header') return 3
    if (source.currentSlideLayout() === 'two-cols-header' || source.currentSlideLayout() === 'two-cols') return 2
    if (sbInfo?.ratio?.includes(':')) {
      const parts = sbInfo.ratio.split(':').filter(Boolean)
      if (parts.length >= 2) return Math.min(parts.length, 6)
    }
    return 2 // 默认按 2 栏起步
  })

  const slotControlTitle = computed(() => {
    return '多栏插槽归属'
  })

  const slotControlDesc = computed(() => {
    const header = source.currentSlideHeader()
    const hasHeader = header !== false && header !== 'false'
    const headerText = hasHeader ? '带通栏标题' : '纯分栏对比'
    return `在多栏版式（${detectedColumnsCount.value} 栏，${headerText}）中的内容块位置，未分配栏位的块将按通栏文本排版`
  })

  const availableSlots = computed(() => {
    const cols = detectedColumnsCount.value
    const slots = [
      { value: 'default', label: '默认' },
      { value: 'header', label: '标题' },
    ]
    for (let i = 1; i <= cols; i++) {
      let label = `第 ${i} 栏`
      if (cols === 2) {
        label = i === 1 ? '第 1 栏 (左)' : '第 2 栏 (右)'
      }
      slots.push({ value: `col-${i}`, label })
    }
    return slots
  })

  function isSlotActive(val: string): boolean {
    const s = source.elemSlot() || ''
    if (val === 'default' || !val) {
      return !s || s === 'default'
    }
    if (s === val) return true
    if (val === 'col-1' && s === 'left') return true
    if (val === 'col-2' && s === 'center') return true
    if (val === 'col-3' && s === 'right' && detectedColumnsCount.value === 3) return true
    if (val === 'col-2' && s === 'right' && detectedColumnsCount.value === 2) return true
    if (val === 'left' && s === 'col-1') return true
    if (val === 'right' && (s === 'col-2' || s === 'col-3')) return true
    return false
  }

  return {
    effectiveLayout,
    isMultiColsLayout,
    hasLayoutControls,
    detectedColumnsCount,
    slotControlTitle,
    slotControlDesc,
    availableSlots,
    isSlotActive,
  }
}
