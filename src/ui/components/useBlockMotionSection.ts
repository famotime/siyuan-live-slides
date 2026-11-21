/**
 * 块级动效领域逻辑（自 BlockInspectorSection 抽离）
 *
 * 职责：
 * 1. 入场动效解析（字符串 / JSON 负载 / none / 损坏 JSON 回退）与乐观预设选择；
 * 2. 持续强调与文本动效（countup / typewriter）的属性解析、字段推导与内容自动提取；
 * 3. 动效试播舞台（stagePlayKey 驱动、countup 数值滚动、typewriter 逐字、舞台样式）。
 *
 * 预设清单统一派生自 motion-presets.ts 单一来源，不再本地重复维护。
 */

import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { isAnimationEnabled, isElementAnimationEnabled, isAnyElementAnimationEnabled } from '@/feature-flags/feature-flags'
import { MOTION_PRESETS, EMPHASIS_PRESETS } from '@/ui/components/motion-presets'

export type TAnimTab = 'entrance' | 'emphasis' | 'text'

/** 动效领域逻辑的输入源（getter 形式，兼容 props 只读语义） */
export interface IBlockMotionSource {
  elemMotion: () => string
  elemAnim: () => string
  elemAnimProps: () => string | undefined
  activeBlockContent: () => string | undefined
}

/** 动效变更事件发射器（update:elemMotion / update:elemAnim） */
export interface IBlockMotionEmitter {
  (e: 'update:elemMotion', val: string): void
  (e: 'update:elemAnim', val: string, propsJson?: string): void
}

/** 解析后的入场动效描述 */
export interface IParsedMotion {
  preset: string
  duration: number
  delay: number
}

export function useBlockMotionSection(source: IBlockMotionSource, emit: IBlockMotionEmitter) {
  // ── 入场预设选项：派生自 motion-presets 单一来源并受 Feature Flags 细粒度过滤 ──
  const motionPresetOptions = computed(() =>
    MOTION_PRESETS.filter(p => isAnimationEnabled(p.name)).map(p => ({ label: p.label, value: p.name })),
  )

  // ── 入场动效解析 ──
  const parsedMotion = computed<IParsedMotion | null>(() => {
    const raw = source.elemMotion()
    if (!raw || raw.trim() === '' || raw.trim() === 'none') {
      return null
    }
    try {
      const obj = JSON.parse(raw)
      if (typeof obj === 'object' && obj !== null) {
        return {
          preset: obj.preset || obj.type || 'slide-up',
          duration: typeof obj.duration === 'number' ? obj.duration : 0,
          delay: typeof obj.delay === 'number' ? obj.delay : 0,
        }
      }
    } catch {
      // 字符串预设
    }
    return {
      preset: raw.trim(),
      duration: 0,
      delay: 0,
    }
  })

  const localPreset = ref<string | null>(null)
  const hasMotion = computed(() => Boolean(parsedMotion.value))
  const currentPreset = computed(() => localPreset.value || parsedMotion.value?.preset || 'slide-up')
  const currentDuration = computed(() => parsedMotion.value?.duration || 0)
  const currentDelay = computed(() => parsedMotion.value?.delay || 0)

  watch(
    () => source.elemMotion(),
    () => {
      localPreset.value = null
    },
  )

  // ── Feature Flags 状态检测 ──
  const isEntranceEnabled = computed(() => isElementAnimationEnabled('entrance'))
  const hasEmphasisEffects = computed(() => isElementAnimationEnabled('emphasis'))
  const hasTextEffects = computed(() => isElementAnimationEnabled('text'))
  const hasAnyMotionFeatureEnabled = computed(() => isAnyElementAnimationEnabled())

  // 可用 Tab 清单
  const availableAnimTabs = computed<TAnimTab[]>(() => {
    const tabs: TAnimTab[] = []
    if (isEntranceEnabled.value) tabs.push('entrance')
    if (hasEmphasisEffects.value) tabs.push('emphasis')
    if (hasTextEffects.value) tabs.push('text')
    return tabs
  })

  // 是否展示 Tab 切换栏（仅在可用 Tab > 1 时展示，<=1 时自动隐藏 tab 切换栏）
  const showTabSwitch = computed(() => availableAnimTabs.value.length > 1)
  const isAdvAnimEnabled = computed(() => showTabSwitch.value)

  function isEffectEnabled(effect: string) {
    return isAnimationEnabled(effect)
  }

  // ── 强调与文本高级动效解析 ──
  const currentAnimType = computed(() => (source.elemAnim() || '').trim().toLowerCase())
  const parsedAnimProps = computed<Record<string, any>>(() => {
    const raw = source.elemAnimProps()
    if (!raw) return {}
    try {
      const obj = JSON.parse(raw)
      return typeof obj === 'object' && obj !== null ? obj : {}
    } catch {
      return {}
    }
  })

  const currentAnimDuration = computed(() => {
    if (typeof parsedAnimProps.value.duration === 'number' && parsedAnimProps.value.duration > 0) {
      return parsedAnimProps.value.duration
    }
    return currentAnimType.value === 'countup' || currentAnimType.value === 'typewriter' ? 1500 : 2400
  })

  // ── Tab 状态：根据当前生效的属性初始化/自适应 Tab ──
  const activeAnimTab = ref<TAnimTab>(availableAnimTabs.value[0] || 'entrance')

  watch(
    [() => source.elemMotion(), () => source.elemAnim(), () => availableAnimTabs.value],
    ([motion, anim, tabs]) => {
      let targetTab: TAnimTab | null = null
      if (anim) {
        if (['pulse', 'float', 'shimmer'].includes(anim) && hasEmphasisEffects.value) {
          targetTab = 'emphasis'
        } else if (['countup', 'typewriter'].includes(anim) && hasTextEffects.value) {
          targetTab = 'text'
        }
      } else if (motion && isEntranceEnabled.value) {
        targetTab = 'entrance'
      }

      if (targetTab && tabs.includes(targetTab)) {
        activeAnimTab.value = targetTab
      } else if (tabs.length > 0 && !tabs.includes(activeAnimTab.value)) {
        activeAnimTab.value = tabs[0]
      }
    },
    { immediate: true },
  )

  const hasAnyMotion = computed(() => hasMotion.value || Boolean(currentAnimType.value))

  function toggleAllMotion() {
    if (hasAnyMotion.value) {
      emit('update:elemMotion', '')
      emit('update:elemAnim', '')
    } else {
      // 默认开启当前选中的 Tab（若不可用则回退到首个可用 Tab）
      const tabToActivate = availableAnimTabs.value.includes(activeAnimTab.value)
        ? activeAnimTab.value
        : (availableAnimTabs.value[0] || 'entrance')

      if (tabToActivate === 'emphasis' && hasEmphasisEffects.value) {
        const effect = isEffectEnabled('pulse') ? 'pulse' : isEffectEnabled('float') ? 'float' : 'shimmer'
        setEmphasisType(effect)
      } else if (tabToActivate === 'text' && hasTextEffects.value) {
        const effect = isEffectEnabled('countup') ? 'countup' : 'typewriter'
        setTextAnimType(effect)
      } else if (tabToActivate === 'entrance' && isEntranceEnabled.value) {
        emit('update:elemMotion', 'slide-up')
        emit('update:elemAnim', '')
      }
    }
  }

  function switchAnimTab(tab: TAnimTab) {
    if (!availableAnimTabs.value.includes(tab)) return
    activeAnimTab.value = tab
    if (tab === 'entrance') {
      emit('update:elemAnim', '')
      emit('update:elemMotion', currentPreset.value || 'slide-up')
    } else if (tab === 'emphasis') {
      const effect = isEffectEnabled('pulse') ? 'pulse' : isEffectEnabled('float') ? 'float' : 'shimmer'
      setEmphasisType(effect)
    } else if (tab === 'text') {
      const effect = isEffectEnabled('countup') ? 'countup' : 'typewriter'
      setTextAnimType(effect)
    }
  }

  function setEmphasisType(type: string) {
    emit('update:elemMotion', '')
    const nextProps = { ...parsedAnimProps.value, duration: currentAnimDuration.value }
    emit('update:elemAnim', type, JSON.stringify(nextProps))
  }

  function setTextAnimType(type: string) {
    emit('update:elemMotion', '')
    if (type === 'countup') {
      if (countUpProps.value.to === 0 && countUpProps.value.from === 0 && !countUpProps.value.prefix && !countUpProps.value.suffix) {
        autoExtractFromContent()
      } else {
        emit('update:elemAnim', 'countup', JSON.stringify(countUpProps.value))
      }
    } else {
      const nextProps = { ...parsedAnimProps.value, duration: currentAnimDuration.value }
      emit('update:elemAnim', type, JSON.stringify(nextProps))
    }
  }

  function setAnimDuration(duration: number) {
    const nextProps = { ...parsedAnimProps.value, duration }
    if (currentAnimType.value) {
      emit('update:elemAnim', currentAnimType.value, JSON.stringify(nextProps))
    }
  }

  // ── CountUp 专属参数计算属性与操作 ──
  const countUpProps = computed(() => {
    return {
      from: typeof parsedAnimProps.value.from === 'number' ? parsedAnimProps.value.from : 0,
      to: typeof parsedAnimProps.value.to === 'number' ? parsedAnimProps.value.to : 0,
      prefix: parsedAnimProps.value.prefix || '',
      suffix: parsedAnimProps.value.suffix || '',
      decimals: typeof parsedAnimProps.value.decimals === 'number' ? parsedAnimProps.value.decimals : 0,
      duration: typeof parsedAnimProps.value.duration === 'number' ? parsedAnimProps.value.duration : 1500,
    }
  })

  function updateCountUpField(field: string, val: any) {
    const nextProps = {
      ...countUpProps.value,
      [field]: val,
    }
    emit('update:elemAnim', 'countup', JSON.stringify(nextProps))
  }

  function autoExtractFromContent() {
    const text = source.activeBlockContent() || ''
    const match = text.match(/([^\d\s]*)([\d,]+(?:\.\d+)?)([^\d\s]*)/)
    if (match) {
      const prefix = match[1] || ''
      const numRaw = match[2].replace(/,/g, '')
      const suffix = match[3] || ''
      const to = parseFloat(numRaw) || 0
      let decimals = 0
      if (numRaw.includes('.')) {
        decimals = numRaw.split('.')[1].length
      }
      const nextProps = {
        from: 0,
        to,
        prefix,
        suffix,
        decimals,
        duration: parsedAnimProps.value.duration || 1500,
      }
      emit('update:elemAnim', 'countup', JSON.stringify(nextProps))
    } else {
      const nextProps = {
        from: 0,
        to: 100,
        prefix: '',
        suffix: '%',
        decimals: 0,
        duration: 1500,
      }
      emit('update:elemAnim', 'countup', JSON.stringify(nextProps))
    }
  }

  // ── 动效即时试播舞台 (Live Preview Stage) 与 WYSIWYG 联动 ──
  const stagePlayKey = ref(0)
  const currentStageCountUpValue = ref('0')
  const currentStageTypewriterText = ref('')
  let countUpRafId: number | null = null
  let typewriterTimerId: any = null

  const activeTabTitle = computed(() => {
    if (activeAnimTab.value === 'emphasis') return '持续强调动效'
    if (activeAnimTab.value === 'text') return '文本微动效'
    return '入场微动效'
  })

  const activeMotionSummaryBadge = computed(() => {
    if (activeAnimTab.value === 'entrance') {
      const p = MOTION_PRESETS.find(m => m.name === currentPreset.value)
      const label = p ? p.label : currentPreset.value
      const dur = currentDuration.value > 0 ? `${currentDuration.value}ms` : '450ms'
      const del = currentDelay.value > 0 ? ` · 延时${currentDelay.value}ms` : ''
      return `${label} · ${dur}${del}`
    }
    if (activeAnimTab.value === 'emphasis') {
      const p = EMPHASIS_PRESETS.find(m => m.name === currentAnimType.value)
      const label = p ? p.label : '呼吸微光'
      const dur = (currentAnimDuration.value / 1000).toFixed(1) + 's'
      return `${label} · 周期${dur}`
    }
    if (activeAnimTab.value === 'text') {
      if (currentAnimType.value === 'countup') {
        const p = countUpProps.value
        const targetStr = `${p.prefix}${p.to}${p.suffix}`
        return `数字滚动 · 目标 ${targetStr}`
      }
      if (currentAnimType.value === 'typewriter') {
        const dur = (currentAnimDuration.value / 1000).toFixed(1) + 's'
        return `打字机 · 耗时${dur}`
      }
      return '文本动效'
    }
    return '未激活'
  })

  const entranceStageStyle = computed(() => {
    const dur = currentDuration.value > 0 ? currentDuration.value : 450
    const del = currentDelay.value > 0 ? currentDelay.value : 0
    return {
      '--motion-duration': `${dur}ms`,
      '--motion-delay': `${del}ms`,
    }
  })

  const emphasisStageStyle = computed(() => {
    const dur = currentAnimDuration.value > 0 ? currentAnimDuration.value : 2400
    return {
      '--emphasis-duration': `${dur}ms`,
    }
  })

  function cancelTextStageTimers() {
    if (countUpRafId !== null) {
      cancelAnimationFrame(countUpRafId)
      countUpRafId = null
    }
    if (typewriterTimerId !== null) {
      clearTimeout(typewriterTimerId)
      typewriterTimerId = null
    }
  }

  function triggerTextWYSIWYG() {
    cancelTextStageTimers()

    if (activeAnimTab.value === 'text') {
      if (currentAnimType.value === 'countup') {
        const from = typeof countUpProps.value.from === 'number' ? countUpProps.value.from : 0
        const to = typeof countUpProps.value.to === 'number' ? countUpProps.value.to : 0
        const duration = countUpProps.value.duration || 1500
        const decimals = countUpProps.value.decimals || 0
        const startTime = performance.now()
        currentStageCountUpValue.value = from.toFixed(decimals)

        const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t))
        function update(now: number) {
          const elapsed = now - startTime
          const progress = Math.min(1, Math.max(0, elapsed / duration))
          const val = from + (to - from) * easeOutExpo(progress)
          currentStageCountUpValue.value = val.toFixed(decimals)
          if (progress < 1) {
            countUpRafId = requestAnimationFrame(update)
          } else {
            countUpRafId = null
          }
        }
        countUpRafId = requestAnimationFrame(update)
      } else if (currentAnimType.value === 'typewriter') {
        let rawText = (source.activeBlockContent() || '').trim()
        if (rawText) {
          rawText = rawText.replace(/^[#*`>-\s]+/, '').split('\n')[0].trim()
        }
        if (!rawText) {
          rawText = 'Slidev 演示微动效系统'
        }
        const fullText = rawText.length > 24 ? rawText.slice(0, 24) + '...' : rawText
        const len = fullText.length
        const duration = currentAnimDuration.value || 1500
        const stepMs = Math.max(25, duration / len)
        let idx = 0
        currentStageTypewriterText.value = ''

        function step() {
          idx++
          currentStageTypewriterText.value = fullText.slice(0, idx)
          if (idx < len) {
            typewriterTimerId = setTimeout(step, stepMs)
          } else {
            typewriterTimerId = null
          }
        }
        typewriterTimerId = setTimeout(step, stepMs)
      }
    }
  }

  function replayLiveStage() {
    stagePlayKey.value++
    triggerTextWYSIWYG()
  }

  watch(
    [
      () => activeAnimTab.value,
      () => currentPreset.value,
      () => currentDuration.value,
      () => currentDelay.value,
      () => currentAnimType.value,
      () => currentAnimDuration.value,
      () => countUpProps.value.to,
      () => countUpProps.value.from,
      () => countUpProps.value.prefix,
      () => countUpProps.value.suffix,
      () => countUpProps.value.decimals,
      () => countUpProps.value.duration,
    ],
    () => {
      replayLiveStage()
    },
  )

  onMounted(() => {
    if (hasAnyMotion.value) {
      replayLiveStage()
    }
  })

  onBeforeUnmount(() => {
    cancelTextStageTimers()
  })

  function handleMotionChange(payload: { preset: string; duration: number; delay: number }) {
    localPreset.value = payload.preset
    replayLiveStage()
    emitMotionChange(payload.preset, payload.duration, payload.delay)
  }

  function selectPreset(preset: string) {
    localPreset.value = preset
    replayLiveStage()
    emitMotionChange(preset, currentDuration.value, currentDelay.value)
  }

  function updateDuration(duration: number) {
    replayLiveStage()
    emitMotionChange(currentPreset.value, duration, currentDelay.value)
  }

  function updateDelay(delay: number) {
    replayLiveStage()
    emitMotionChange(currentPreset.value, currentDuration.value, delay)
  }

  function emitMotionChange(preset: string, duration: number, delay: number) {
    if (!preset || preset === 'none') {
      emit('update:elemMotion', '')
      return
    }
    emit('update:elemAnim', '')
    if (!duration && !delay) {
      emit('update:elemMotion', preset)
      return
    }
    const payload: Record<string, any> = { preset }
    if (duration > 0) payload.duration = duration
    if (delay > 0) payload.delay = delay
    emit('update:elemMotion', JSON.stringify(payload))
  }

  return {
    // 预设选项
    motionPresetOptions,
    // 入场动效状态
    parsedMotion,
    localPreset,
    hasMotion,
    currentPreset,
    currentDuration,
    currentDelay,
    // Feature Flags
    isEntranceEnabled,
    isAdvAnimEnabled,
    hasEmphasisEffects,
    hasTextEffects,
    hasAnyMotionFeatureEnabled,
    availableAnimTabs,
    showTabSwitch,
    isEffectEnabled,
    // 强调与文本动效
    currentAnimType,
    parsedAnimProps,
    currentAnimDuration,
    activeAnimTab,
    hasAnyMotion,
    toggleAllMotion,
    switchAnimTab,
    setEmphasisType,
    setTextAnimType,
    setAnimDuration,
    // CountUp
    countUpProps,
    updateCountUpField,
    autoExtractFromContent,
    // 试播舞台
    stagePlayKey,
    currentStageCountUpValue,
    currentStageTypewriterText,
    activeTabTitle,
    activeMotionSummaryBadge,
    entranceStageStyle,
    emphasisStageStyle,
    replayLiveStage,
    // 变更入口
    handleMotionChange,
    selectPreset,
    updateDuration,
    updateDelay,
  }
}
