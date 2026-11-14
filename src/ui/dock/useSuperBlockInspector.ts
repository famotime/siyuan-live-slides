import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import {
  extractSuperBlockWidthRatios,
  getContentChildren,
  isHorizontalSuperBlock,
  isSuperBlock as isSuperBlockNode,
} from '@/compiler/superblock-scanner'
import { checkCanConvertToSuperBlock } from '@/sync/superblock-transform'
import type { ISlidesVirtualPage } from '@/types/slides-protocol'

export interface IDetectedSuperBlockInfo {
  hasSuperBlock: boolean
  colCount: number
  ratio: string
  isCustomWidth: boolean
  recommendedLayout: string
}

export function parseSuperBlockDom(sbEl: Element): IDetectedSuperBlockInfo | null {
  if (!sbEl) return null
  const layout = (sbEl.getAttribute('data-sb-layout') || '').toLowerCase()
  if (layout !== 'col') return null

  const children = Array.from(sbEl.querySelectorAll(':scope > [data-node-id]')) as HTMLElement[]
  if (children.length < 2) return null

  const colCount = children.length
  const rawPcts: (number | null)[] = children.map(c => {
    const style = c.getAttribute('style') || ''
    const mCalc = style.match(/calc\(\s*([\d.]+)%/)
    if (mCalc) return parseFloat(mCalc[1])
    const mWidth = style.match(/(?:^|;|\s)width:\s*([\d.]+)%/i)
    if (mWidth) return parseFloat(mWidth[1])
    return null
  })

  let ratio = ''
  let isCustomWidth = false
  if (rawPcts.some(p => p !== null)) {
    isCustomWidth = true
    const knownSum = rawPcts.reduce((a, b) => a + (b || 0), 0)
    const unknownCount = rawPcts.filter(p => p === null).length
    const fill = unknownCount > 0 ? Math.max(0, 100 - knownSum) / unknownCount : 100 / children.length
    const finalPcts = rawPcts.map(p => (p !== null ? p : fill))
    const sum = finalPcts.reduce((a, b) => a + b, 0) || 1
    const norm = finalPcts.map(p => (p / sum) * 100)

    if (norm.length === 2) {
      const [p1] = norm
      if (p1 >= 48 && p1 <= 52) ratio = '1:1'
      else if (p1 >= 31 && p1 <= 35) ratio = '1:2'
      else if (p1 >= 65 && p1 <= 69) ratio = '2:1'
      else if (p1 >= 28 && p1 <= 32) ratio = '3:7'
      else if (p1 >= 68 && p1 <= 72) ratio = '7:3'
      else if (p1 >= 38 && p1 <= 42) ratio = '4:6'
      else if (p1 >= 58 && p1 <= 62) ratio = '6:4'
      else {
        const r1 = Math.round(p1)
        ratio = `${r1}:${100 - r1}`
      }
    } else if (norm.length === 3) {
      const [p1, p2, p3] = norm
      if (p1 >= 31 && p1 <= 35 && p2 >= 31 && p2 <= 35 && p3 >= 31 && p3 <= 35) ratio = '1:1:1'
      else if (p1 >= 23 && p1 <= 27 && p2 >= 48 && p2 <= 52 && p3 >= 23 && p3 <= 27) ratio = '1:2:1'
      else if (p1 >= 48 && p1 <= 52 && p2 >= 23 && p2 <= 27 && p3 >= 23 && p3 <= 27) ratio = '2:1:1'
      else if (p1 >= 23 && p1 <= 27 && p2 >= 23 && p2 <= 27 && p3 >= 48 && p3 <= 52) ratio = '1:1:2'
      else {
        const r1 = Math.round(p1)
        const r2 = Math.round(p2)
        ratio = `${r1}:${r2}:${100 - r1 - r2}`
      }
    } else {
      ratio = norm.map(p => Math.round(p)).join(':')
    }
  } else {
    isCustomWidth = false
    ratio = Array.from({ length: colCount }, () => 1).join(':')
  }

  const recommendedLayout = colCount >= 2 ? 'cols-header' : 'two-cols'
  return {
    hasSuperBlock: true,
    colCount,
    ratio,
    isCustomWidth,
    recommendedLayout,
  }
}

export function parseSuperBlockAst(slide: any): IDetectedSuperBlockInfo | null {
  if (!slide?.blocks) return null
  for (const b of slide.blocks) {
    const raw = b.rawNode
    if (raw && isSuperBlockNode(raw) && isHorizontalSuperBlock(raw)) {
      const contentChildren = getContentChildren(raw)
      const colCount = contentChildren.length
      const r = extractSuperBlockWidthRatios(raw)
      return {
        hasSuperBlock: true,
        colCount,
        ratio: r || Array.from({ length: colCount }, () => 1).join(':'),
        isCustomWidth: Boolean(r),
        recommendedLayout: colCount >= 2 ? 'cols-header' : 'two-cols',
      }
    }
  }
  return null
}

export interface ISuperBlockInspectorOptions {
  activeBlockId: Ref<string>
  activeBlockType: Ref<string>
  currentPageDividerId: Ref<string>
  isDivider: ComputedRef<boolean>
  targetSlide: ComputedRef<ISlidesVirtualPage | null | undefined>
}

/**
 * Inspector 侧栏超级块 DOM/AST 探测与块多选状态组合式函数
 */
export function useSuperBlockInspector(options: ISuperBlockInspectorOptions) {
  const { activeBlockId, activeBlockType, currentPageDividerId, isDivider, targetSlide } = options

  const detectedSbInfo = computed<IDetectedSuperBlockInfo | null>(() => {
    if (typeof document !== 'undefined') {
      // 1. 若当前选中的块本身是超级块或处于超级块内
      const activeId = activeBlockId.value
      if (activeId) {
        const activeEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${activeId}"]`)
        if (activeEl) {
          const sbEl = activeEl.getAttribute('data-type') === 'NodeSuperBlock' ? activeEl : activeEl.closest('[data-type="NodeSuperBlock"]')
          if (sbEl) {
            const parsed = parseSuperBlockDom(sbEl)
            if (parsed) return parsed
          }
        }
      }

      // 2. 检查当前页内的超级块 (从当前页分页符开始向后找兄弟节点，直到下一个分页符)
      const divId = currentPageDividerId.value || (isDivider.value ? activeBlockId.value : '')
      if (divId) {
        const divEl = document.querySelector(`.protyle-wysiwyg [data-node-id="${divId}"]`)
        if (divEl) {
          let sibling = divEl.nextElementSibling
          while (sibling) {
            if (sibling.getAttribute('data-type') === 'NodeThematicBreak' || sibling.classList?.contains('protyle-wysiwyg__block--hr')) {
              break
            }
            const sbEl = sibling.getAttribute('data-type') === 'NodeSuperBlock' ? sibling : sibling.querySelector('[data-type="NodeSuperBlock"]')
            if (sbEl) {
              const parsed = parseSuperBlockDom(sbEl)
              if (parsed) return parsed
            }
            sibling = sibling.nextElementSibling
          }
        }
      } else {
        // 3. 首页（没有前置分页符）：从 protyle-wysiwyg 顶部开始找直到第一个分页符
        const firstDivider = document.querySelector('.protyle-wysiwyg [data-type="NodeThematicBreak"], .protyle-wysiwyg .protyle-wysiwyg__block--hr')
        const allSuperBlocks = Array.from(document.querySelectorAll('.protyle-wysiwyg [data-type="NodeSuperBlock"]'))
        for (const sb of allSuperBlocks) {
          if (!firstDivider || (sb.compareDocumentPosition(firstDivider) & Node.DOCUMENT_POSITION_FOLLOWING)) {
            const parsed = parseSuperBlockDom(sb)
            if (parsed) return parsed
          }
        }
      }
    }

    // 4. AST 回退
    return parseSuperBlockAst(targetSlide.value)
  })

  const detectedSbRatio = computed(() => detectedSbInfo.value?.ratio || '')

  const isSuperBlock = computed(() => {
    const type = activeBlockType.value || ''
    if (type === 'NodeSuperBlock' || type === 's' || type === 'sb') return true
    if (typeof document !== 'undefined' && activeBlockId.value) {
      const el = document.querySelector(`.protyle-wysiwyg [data-node-id="${activeBlockId.value}"]`)
      if (el?.closest('[data-type="NodeSuperBlock"]')) return true
    }
    return false
  })

  // 块多选与列表项合并横向超级块可用状态监听
  const canConvertToSuperBlock = ref(false)

  function updateCanConvert() {
    canConvertToSuperBlock.value = checkCanConvertToSuperBlock(activeBlockId.value, activeBlockType.value)
  }

  onMounted(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('selectionchange', updateCanConvert)
      document.addEventListener('mouseup', updateCanConvert)
      document.addEventListener('keyup', updateCanConvert)
    }
    updateCanConvert()
  })

  onUnmounted(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('selectionchange', updateCanConvert)
      document.removeEventListener('mouseup', updateCanConvert)
      document.removeEventListener('keyup', updateCanConvert)
    }
  })

  watch([activeBlockId, activeBlockType], () => {
    updateCanConvert()
  })

  return {
    detectedSbInfo,
    detectedSbRatio,
    isSuperBlock,
    canConvertToSuperBlock,
  }
}
