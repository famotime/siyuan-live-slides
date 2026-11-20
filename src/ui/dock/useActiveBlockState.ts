/**
 * 活动块状态派生领域逻辑（自 SlidesInspectorDockView 抽离）
 *
 * 职责：按 activeBlockId 从目标页 blocks 查找活动块（统一单点查找），
 * 并派生六类块属性读取值（click / motion / anim / animProps / content / slot）。
 * 属性读取统一遵循优先级：IAL 显式值 > 父容器回退语义 > 编译模型回退。
 */

import { computed, type Ref } from 'vue'
import {
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_ANIM,
  ATTR_ELEM_ANIM_PROPS,
  ATTR_ELEM_SLOT,
  type ISlidesBlockItem,
  type ISlidesVirtualPage,
} from '@/types/slides-protocol'

/** 活动块状态领域逻辑的输入源 */
export interface IActiveBlockStateSource {
  activeBlockId: Ref<string>
  targetSlide: Ref<ISlidesVirtualPage | null | undefined>
  activeBlockAttrs: Ref<Record<string, string>>
  parentContainerId: Ref<string>
  parentContainerClicks: Ref<string>
  /** 判断当前块是否为其列表项容器的首行主文本（DOM 探测，由宿主注入） */
  isCurrentBlockMainText: () => boolean
}

export function useActiveBlockState(source: IActiveBlockStateSource) {
  /** 当前聚焦块在编译模型中的匹配项（单点查找，供全部派生值复用） */
  const matchedBlock = computed<ISlidesBlockItem | null>(() => {
    const aid = source.activeBlockId.value
    if (!aid) return null
    return source.targetSlide.value?.blocks?.find(b => b.id === aid) || null
  })

  const elemClick = computed(() => {
    if (source.activeBlockAttrs.value[ATTR_ELEM_CLICK] !== undefined) {
      return source.activeBlockAttrs.value[ATTR_ELEM_CLICK] || ''
    }
    // 若当前聚焦的块是列表项容器的首行主文本，且自身未定义，展示容器的 clicks (主容器视觉权威)
    if (source.parentContainerId.value && source.isCurrentBlockMainText()) {
      return source.parentContainerClicks.value || ''
    }
    // 若当前聚焦的块归属于列表项容器内部其他子组件 (如图片)，且自身未显式定义 clicks，
    // 则严格遵循未单独开启逐步呈现，绝对不回退到匹配模型或父级 clicks，保持为 '' (跟随整栏)
    if (source.parentContainerId.value) {
      return ''
    }
    if (matchedBlock.value?.clicks) return matchedBlock.value.clicks
    return ''
  })

  const elemMotion = computed(() => {
    if (source.activeBlockAttrs.value[ATTR_ELEM_MOTION]) {
      return source.activeBlockAttrs.value[ATTR_ELEM_MOTION]
    }
    const motion = matchedBlock.value?.motion
    if (motion) return typeof motion === 'string' ? motion : JSON.stringify(motion)
    return ''
  })

  const elemAnim = computed(() => {
    if (source.activeBlockAttrs.value[ATTR_ELEM_ANIM] !== undefined) {
      return source.activeBlockAttrs.value[ATTR_ELEM_ANIM] || ''
    }
    if (matchedBlock.value?.anim?.type) return String(matchedBlock.value.anim.type)
    return ''
  })

  const elemAnimProps = computed(() => {
    if (source.activeBlockAttrs.value[ATTR_ELEM_ANIM_PROPS] !== undefined) {
      return source.activeBlockAttrs.value[ATTR_ELEM_ANIM_PROPS] || ''
    }
    if (matchedBlock.value?.anim) {
      const { type, ...props } = matchedBlock.value.anim
      return JSON.stringify(props)
    }
    return ''
  })

  const activeBlockContent = computed(() => {
    if (matchedBlock.value) return matchedBlock.value.rawMarkdown || matchedBlock.value.content || ''
    return ''
  })

  const elemSlot = computed(() => {
    if (source.activeBlockAttrs.value[ATTR_ELEM_SLOT]) {
      return source.activeBlockAttrs.value[ATTR_ELEM_SLOT]
    }
    if (matchedBlock.value?.slot) return matchedBlock.value.slot
    return ''
  })

  return {
    matchedBlock,
    elemClick,
    elemMotion,
    elemAnim,
    elemAnimProps,
    activeBlockContent,
    elemSlot,
  }
}

export type IActiveBlockState = ReturnType<typeof useActiveBlockState>
