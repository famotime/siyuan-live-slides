<template>
  <div class="spm-transition-selector">
    <div class="spm-transition-selector__header">转场动效</div>
    <div class="spm-transition-list">
      <div
        v-for="trans in transitions"
        :key="trans.name"
        class="spm-transition-item"
        :class="{ active: modelValue === trans.name }"
        @click="selectTransition(trans.name)"
      >
        <div class="spm-transition-meta">
          <span class="spm-transition-label">{{ trans.label }}</span>
          <span class="spm-transition-name">({{ trans.name }})</span>
        </div>
        <!-- 悬停动效预览小方块 -->
        <div class="spm-transition-preview-box">
          <div class="spm-anim-cube" :class="'anim-' + trans.name"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const transitions = [
  { name: 'slide-left', label: '向左滑入' },
  { name: 'slide-right', label: '向右滑入' },
  { name: 'slide-up', label: '向上推入' },
  { name: 'fade', label: '淡入淡出' },
  { name: 'zoom', label: '缩放进入' },
]

function selectTransition(name: string) {
  emit('update:modelValue', name)
  emit('change', name)
}
</script>

<style scoped>
.spm-transition-selector {
  padding: 8px;
}

.spm-transition-selector__header {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--b3-theme-on-surface, #475569);
}

.spm-transition-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spm-transition-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  background: var(--b3-theme-surface, #f8fafc);
  transition: all 0.15s ease;
}

.spm-transition-item:hover {
  background: var(--b3-theme-surface-hover, #f1f5f9);
  border-color: #3b82f6;
}

.spm-transition-item.active {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
  color: #3b82f6;
  font-weight: 600;
}

.spm-transition-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.spm-transition-name {
  font-size: 10px;
  opacity: 0.6;
}

.spm-transition-preview-box {
  width: 24px;
  height: 18px;
  background: #e2e8f0;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spm-anim-cube {
  width: 14px;
  height: 10px;
  background: #3b82f6;
  border-radius: 1px;
}

.spm-transition-item:hover .anim-slide-left {
  animation: previewSlideLeft 0.8s infinite ease-in-out;
}
.spm-transition-item:hover .anim-slide-right {
  animation: previewSlideRight 0.8s infinite ease-in-out;
}
.spm-transition-item:hover .anim-slide-up {
  animation: previewSlideUp 0.8s infinite ease-in-out;
}
.spm-transition-item:hover .anim-fade {
  animation: previewFade 0.8s infinite ease-in-out;
}
.spm-transition-item:hover .anim-zoom {
  animation: previewZoom 0.8s infinite ease-in-out;
}

@keyframes previewSlideLeft {
  0% { transform: translateX(12px); opacity: 0; }
  50% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(-12px); opacity: 0; }
}

@keyframes previewSlideRight {
  0% { transform: translateX(-12px); opacity: 0; }
  50% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(12px); opacity: 0; }
}

@keyframes previewSlideUp {
  0% { transform: translateY(8px); opacity: 0; }
  50% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-8px); opacity: 0; }
}

@keyframes previewFade {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}

@keyframes previewZoom {
  0% { transform: scale(0.4); opacity: 0; }
  50% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.3); opacity: 0; }
}
</style>
