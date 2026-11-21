<template>
  <div class="spm-motion-selector" :class="{ 'spm-motion-selector--no-header': hideHeader }">
    <div v-if="!hideHeader" class="spm-motion-selector__header">{{ title || '入场微动效' }}</div>

    <!-- 1. 动效即时试播舞台 (Live Preview Stage) -->
    <div v-if="!hideStage" class="spm-motion-stage-card">
      <div class="spm-motion-stage-header">
        <div class="spm-stage-title-wrap">
          <span class="spm-stage-title">即时试播</span>
          <span class="spm-stage-badge">{{ activePresetSummary }}</span>
        </div>
        <button
          type="button"
          class="spm-btn-stage-replay b3-tooltips b3-tooltips__s"
          aria-label="重新播放入场动效"
          @click="replayLiveStage"
        >
          <SlidesIcon name="play" />
          <span>重播</span>
        </button>
      </div>

      <div class="spm-motion-stage-viewport">
        <!-- 模拟幻灯片内容块在当前选定动效下的运动 -->
        <div
          :key="stagePlayKey"
          class="spm-motion-stage-sample"
          :class="['stage-motion-' + currentPresetName]"
          :style="stageSampleStyle"
        >
          <div class="spm-sample-header-bar">
            <span class="spm-sample-dot"></span>
            <span class="spm-sample-title-line"></span>
          </div>
          <div class="spm-sample-text-line"></div>
          <div class="spm-sample-text-line short"></div>
        </div>
      </div>
    </div>

    <!-- 2. 可视化微动效网格 (Visual Motion Grid) -->
    <div class="spm-motion-grid">
      <div
        v-for="item in MOTION_PRESETS"
        v-show="isEffectEnabled(item.name)"
        :key="item.name"
        class="spm-motion-item b3-tooltips b3-tooltips__s"
        :class="{ active: currentPresetName === item.name }"
        :aria-label="item.label + '：' + item.desc"
        @click="selectPreset(item.name)"
      >
        <!-- 微型动效舞台，hover 或 active 时播放轨迹 -->
        <div class="spm-motion-mini-stage">
          <div class="spm-motion-mini-elem" :class="'mini-anim-' + item.name"></div>
        </div>
        <span class="spm-motion-item-label">{{ item.label }}</span>
      </div>
    </div>

    <!-- 3. 时长与延迟参数精细调节 -->
    <div class="spm-motion-params">
      <div class="spm-param-row">
        <label class="spm-param-label">持续时长</label>
        <select
          class="spm-select spm-param-select"
          :value="duration || 0"
          @change="onDurationChange(Number(($event.target as HTMLSelectElement).value))"
        >
          <option
            v-for="opt in MOTION_DURATION_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="spm-param-row">
        <label class="spm-param-label">触发延迟</label>
        <select
          class="spm-select spm-param-select"
          :value="delay || 0"
          @change="onDelayChange(Number(($event.target as HTMLSelectElement).value))"
        >
          <option
            v-for="opt in MOTION_DELAY_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import { isAnimationEnabled } from '@/feature-flags/feature-flags'
import {
  MOTION_PRESETS,
  MOTION_DURATION_OPTIONS,
  MOTION_DELAY_OPTIONS,
} from '@/ui/components/motion-presets'

function isEffectEnabled(effect: string): boolean {
  return isAnimationEnabled(effect)
}

const props = defineProps<{
  modelValue?: string
  duration?: number
  delay?: number
  hideHeader?: boolean
  hideStage?: boolean
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:duration', value: number): void
  (e: 'update:delay', value: number): void
  (e: 'change', payload: { preset: string; duration: number; delay: number }): void
}>()

const currentPresetName = computed(() => {
  const val = props.modelValue || ''
  if (!val || val === 'none') return 'slide-up'
  return val
})

const activePresetSummary = computed(() => {
  const p = MOTION_PRESETS.find(m => m.name === currentPresetName.value)
  const label = p ? p.label : currentPresetName.value
  const d = props.duration ? `${props.duration}ms` : '450ms'
  const del = props.delay ? ` · 延时${props.delay}ms` : ''
  return `${label} · ${d}${del}`
})

const stagePlayKey = ref(0)

function replayLiveStage() {
  stagePlayKey.value++
}

watch(
  () => [props.modelValue, props.duration, props.delay],
  () => {
    replayLiveStage()
  }
)

const stageSampleStyle = computed(() => {
  const dur = props.duration && props.duration > 0 ? props.duration : 450
  const del = props.delay && props.delay > 0 ? props.delay : 0
  return {
    '--motion-duration': `${dur}ms`,
    '--motion-delay': `${del}ms`,
  }
})

function selectPreset(name: string) {
  emit('update:modelValue', name)
  emit('change', {
    preset: name,
    duration: props.duration || 0,
    delay: props.delay || 0,
  })
}

function onDurationChange(val: number) {
  emit('update:duration', val)
  emit('change', {
    preset: currentPresetName.value,
    duration: val,
    delay: props.delay || 0,
  })
}

function onDelayChange(val: number) {
  emit('update:delay', val)
  emit('change', {
    preset: currentPresetName.value,
    duration: props.duration || 0,
    delay: val,
  })
}
</script>

<style scoped>
.spm-motion-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spm-motion-selector__header {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #475569);
  margin-bottom: 2px;
}

/* 1. 动效即时试播舞台卡片 */
.spm-motion-stage-card {
  background: var(--b3-theme-surface, #f8fafc);
  border: 1px solid var(--b3-border-color, #e2e8f0);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

.spm-motion-stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.spm-stage-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spm-stage-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #1e293b);
}

.spm-stage-badge {
  font-size: 10px;
  color: var(--b3-theme-primary, #3b82f6);
  background: var(--b3-theme-primary-lightest, rgba(59, 130, 246, 0.12));
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 500;
}

.spm-btn-stage-replay {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color, #e2e8f0);
  background: var(--b3-theme-background, #ffffff);
  color: var(--b3-theme-on-surface, #475569);
  cursor: pointer;
  transition: all 0.15s ease;
}

.spm-btn-stage-replay:hover {
  background: var(--b3-theme-primary-lightest, rgba(59, 130, 246, 0.1));
  border-color: var(--b3-theme-primary, #3b82f6);
  color: var(--b3-theme-primary, #3b82f6);
}

.spm-btn-stage-replay :deep(.slides-icon) {
  width: 11px;
  height: 11px;
}

/* 舞台视口模拟画布 */
.spm-motion-stage-viewport {
  position: relative;
  height: 52px;
  background: var(--b3-theme-background, #ffffff);
  border: 1px dashed var(--b3-border-color, #cbd5e1);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);
}

.spm-motion-stage-sample {
  width: 78%;
  background: var(--b3-theme-surface, #f1f5f9);
  border: 1px solid var(--b3-border-color, #e2e8f0);
  border-radius: 4px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.spm-sample-header-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 1px;
}

.spm-sample-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--b3-theme-primary, #3b82f6);
}

.spm-sample-title-line {
  height: 5px;
  width: 45%;
  background: var(--b3-theme-primary, #3b82f6);
  opacity: 0.85;
  border-radius: 2px;
}

.spm-sample-text-line {
  height: 4px;
  width: 90%;
  background: var(--b3-theme-on-surface, #94a3b8);
  opacity: 0.35;
  border-radius: 2px;
}

.spm-sample-text-line.short {
  width: 60%;
}

/* 试播舞台关键帧动画应用 */
.stage-motion-fade-in {
  animation: stageMotionFadeIn var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both;
}
.stage-motion-slide-up {
  animation: stageMotionSlideUp var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both;
}
.stage-motion-slide-down {
  animation: stageMotionSlideDown var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both;
}
.stage-motion-slide-left {
  animation: stageMotionSlideLeft var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both;
}
.stage-motion-slide-right {
  animation: stageMotionSlideRight var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both;
}
.stage-motion-zoom-in {
  animation: stageMotionZoomIn var(--motion-duration, 0.4s) cubic-bezier(0.34, 1.56, 0.64, 1) var(--motion-delay, 0s) both;
}
.stage-motion-bounce {
  animation: stageMotionBounce var(--motion-duration, 0.6s) cubic-bezier(0.34, 1.56, 0.64, 1) var(--motion-delay, 0s) both;
}

@keyframes stageMotionFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes stageMotionSlideUp {
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes stageMotionSlideDown {
  from { opacity: 0; transform: translateY(-22px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes stageMotionSlideLeft {
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes stageMotionSlideRight {
  from { opacity: 0; transform: translateX(-24px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes stageMotionZoomIn {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes stageMotionBounce {
  0% { opacity: 0; transform: translateY(24px); }
  60% { opacity: 1; transform: translateY(-5px); }
  80% { transform: translateY(2px); }
  100% { transform: translateY(0); }
}

/* 2. 可视化微动效网格 */
.spm-motion-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

@media (max-width: 260px) {
  .spm-motion-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.spm-motion-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 4px 5px;
  border-radius: 5px;
  border: 1px solid var(--b3-border-color, #e2e8f0);
  background: var(--b3-theme-background, #ffffff);
  color: var(--b3-theme-on-surface, #475569);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.spm-motion-item:hover {
  background: var(--b3-theme-primary-lightest, rgba(59, 130, 246, 0.08));
  border-color: var(--b3-theme-primary, #3b82f6);
  color: var(--b3-theme-primary, #3b82f6);
}

.spm-motion-item.active {
  background: var(--b3-theme-primary-lightest, rgba(59, 130, 246, 0.14));
  border-color: var(--b3-theme-primary, #3b82f6);
  color: var(--b3-theme-primary, #3b82f6);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.2);
}

/* 微型预览舞台 */
.spm-motion-mini-stage {
  width: 32px;
  height: 22px;
  background: var(--b3-theme-surface, #f1f5f9);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 4px;
  position: relative;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.spm-motion-mini-elem {
  width: 18px;
  height: 10px;
  background: var(--b3-theme-primary, #3b82f6);
  border-radius: 2px;
  opacity: 0.85;
}

.spm-motion-item-label {
  font-size: 11px;
  line-height: 1.2;
}

/* hover 或 active 时循环演示轨迹 */
.spm-motion-item:hover .mini-anim-slide-up,
.spm-motion-item.active .mini-anim-slide-up {
  animation: miniAnimSlideUp 1.2s infinite ease-in-out;
}

.spm-motion-item:hover .mini-anim-fade-in,
.spm-motion-item.active .mini-anim-fade-in {
  animation: miniAnimFadeIn 1.2s infinite ease-in-out;
}

.spm-motion-item:hover .mini-anim-slide-down,
.spm-motion-item.active .mini-anim-slide-down {
  animation: miniAnimSlideDown 1.2s infinite ease-in-out;
}

.spm-motion-item:hover .mini-anim-slide-left,
.spm-motion-item.active .mini-anim-slide-left {
  animation: miniAnimSlideLeft 1.2s infinite ease-in-out;
}

.spm-motion-item:hover .mini-anim-slide-right,
.spm-motion-item.active .mini-anim-slide-right {
  animation: miniAnimSlideRight 1.2s infinite ease-in-out;
}

.spm-motion-item:hover .mini-anim-zoom-in,
.spm-motion-item.active .mini-anim-zoom-in {
  animation: miniAnimZoomIn 1.2s infinite ease-in-out;
}

.spm-motion-item:hover .mini-anim-bounce,
.spm-motion-item.active .mini-anim-bounce {
  animation: miniAnimBounce 1.4s infinite cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes miniAnimSlideUp {
  0% { transform: translateY(7px); opacity: 0; }
  40%, 75% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-2px); opacity: 0; }
}

@keyframes miniAnimFadeIn {
  0% { opacity: 0.1; }
  45%, 75% { opacity: 1; }
  100% { opacity: 0.1; }
}

@keyframes miniAnimSlideDown {
  0% { transform: translateY(-7px); opacity: 0; }
  40%, 75% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(2px); opacity: 0; }
}

@keyframes miniAnimSlideLeft {
  0% { transform: translateX(8px); opacity: 0; }
  40%, 75% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(-2px); opacity: 0; }
}

@keyframes miniAnimSlideRight {
  0% { transform: translateX(-8px); opacity: 0; }
  40%, 75% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(2px); opacity: 0; }
}

@keyframes miniAnimZoomIn {
  0% { transform: scale(0.35); opacity: 0; }
  45%, 75% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.15); opacity: 0; }
}

@keyframes miniAnimBounce {
  0% { transform: translateY(8px); opacity: 0; }
  40% { transform: translateY(-3px); opacity: 1; }
  60% { transform: translateY(1px); }
  75%, 85% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(0); opacity: 0; }
}

/* 3. 时长与延迟参数精细调节 */
.spm-motion-params {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.spm-param-row {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spm-param-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface, #64748b);
  opacity: 0.75;
}

.spm-param-select {
  width: 100%;
  font-size: 11px;
  padding: 3px 6px;
  height: 26px;
  border-radius: 4px;
}
</style>
