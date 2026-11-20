/**
 * 页面分栏比例领域逻辑（自 PageInspectorSection 抽离）
 *
 * 职责：多栏版式判定、分栏数五来源探测（页面比例 → 超级块比例/列数/插槽 → 版式回退）、
 * 手工指定栏数与版式重定向、比例预设矩阵、等分激活判定与重置。
 * 比例段数解析复用 column-ratio 共享工具，与块级插槽领域保持一致。
 */

import { computed } from 'vue'
import { countRatioColumns, buildEqualRatio } from '@/ui/components/column-ratio'

/** 分栏比例领域逻辑的输入源（getter 形式，兼容 props 只读语义） */
export interface IPageColumnRatioSource {
  pageLayout: () => string
  pageHeader: () => boolean | string | undefined
  pageLayoutRatio: () => string | undefined
  detectedSbRatio: () => string | undefined
  detectedSbInfo: () => any
}

/** 分栏比例变更事件发射器（update:pageLayout / update:pageLayoutRatio / resetSuperblockRatio） */
export interface IPageColumnRatioEmitter {
  (e: 'update:pageLayout', val: string): void
  (e: 'update:pageLayoutRatio', val: string): void
  (e: 'resetSuperblockRatio'): void
}

export function usePageColumnRatio(source: IPageColumnRatioSource, emit: IPageColumnRatioEmitter) {
  const isMultiColLayout = computed(() => {
    return ['two-cols', 'cols-header', 'two-cols-header', 'three-cols-header', 'image-left', 'image-right'].includes(source.pageLayout())
  })

  const isColsHeaderLayout = computed(() => {
    return ['cols-header', 'two-cols-header', 'three-cols-header', 'two-cols'].includes(source.pageLayout())
  })

  const effectivePageHeader = computed(() => {
    const header = source.pageHeader()
    if (header === false || header === 'false') return false
    return true
  })

  const detectedColumnsCount = computed(() => {
    // 1. 若显式指定了多段比例，以比例段数为准精确控制 (2~6 栏)
    const fromPage = countRatioColumns(source.pageLayoutRatio())
    if (fromPage) return fromPage
    // 2. 超级块比例或列数推断
    const fromSbRatio = countRatioColumns(source.detectedSbRatio())
    if (fromSbRatio) return fromSbRatio
    const sbInfo = source.detectedSbInfo()
    if (sbInfo?.colCount && sbInfo.colCount >= 2) {
      return Math.min(sbInfo.colCount, 6)
    }
    if (sbInfo?.slots && Array.isArray(sbInfo.slots)) {
      const count = sbInfo.slots.length
      if (count >= 2 && count <= 6) return count
    }
    if (source.pageLayout() === 'three-cols-header') {
      return 3
    }
    return 2
  })

  function setColumnCount(col: number) {
    if (col < 2 || col > 6) return
    const newRatio = buildEqualRatio(col)
    const layout = source.pageLayout()
    if (layout === 'two-cols' || layout === 'two-cols-header' || layout === 'three-cols-header') {
      emit('update:pageLayout', 'cols-header')
    }
    emit('update:pageLayoutRatio', newRatio)
  }

  function isRatioActive(chipValue: string): boolean {
    const r = (source.pageLayoutRatio() || '').trim()
    const cols = detectedColumnsCount.value
    const equalRatio = buildEqualRatio(cols)
    if (chipValue === '') {
      return !r || r === equalRatio
    }
    return r === chipValue
  }

  const currentRatioPresets = computed(() => {
    const cols = detectedColumnsCount.value
    if (cols === 3) {
      return [
        { label: '默认 1:1:1', value: '' },
        { label: '1:2:1 (主中)', value: '1:2:1' },
        { label: '2:1:1 (主左)', value: '2:1:1' },
        { label: '1:1:2 (主右)', value: '1:1:2' },
        { label: '1:3:1', value: '1:3:1' },
      ]
    }
    if (cols === 4) {
      return [
        { label: '默认 1:1:1:1', value: '' },
        { label: '1:2:2:1', value: '1:2:2:1' },
        { label: '2:1:1:2', value: '2:1:1:2' },
      ]
    }
    if (cols === 5) {
      return [
        { label: '默认 1:1:1:1:1', value: '' },
      ]
    }
    if (cols === 6) {
      return [
        { label: '默认 1:1:1:1:1:1', value: '' },
      ]
    }
    return [
      { label: '默认 1:1', value: '' },
      { label: '1:2', value: '1:2' },
      { label: '2:1', value: '2:1' },
      { label: '3:7', value: '3:7' },
      { label: '7:3', value: '7:3' },
      { label: '4:6', value: '4:6' },
      { label: '6:4', value: '6:4' },
    ]
  })

  const currentActiveRatio = computed(() => {
    return source.pageLayoutRatio() || ''
  })

  function onResetRatioToEqual() {
    const cols = detectedColumnsCount.value || 2
    emit('update:pageLayoutRatio', buildEqualRatio(cols))
    emit('resetSuperblockRatio')
  }

  return {
    isMultiColLayout,
    isColsHeaderLayout,
    effectivePageHeader,
    detectedColumnsCount,
    setColumnCount,
    isRatioActive,
    currentRatioPresets,
    currentActiveRatio,
    onResetRatioToEqual,
  }
}
