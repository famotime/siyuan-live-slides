<template>
  <div class="spm-divider-popover">
    <div class="spm-divider-popover__title">
      <span>幻灯片页面设置</span>
      <button class="spm-close-btn" @click="emit('close')">✕</button>
    </div>

    <!-- 版式选择 -->
    <LayoutPicker
      v-model="layout"
      @change="onLayoutChange"
    />

    <!-- 转场动效 -->
    <TransitionSelector
      v-model="transition"
      @change="onTransitionChange"
    />

    <!-- 背景设置 -->
    <div class="spm-form-item">
      <label class="spm-form-label">页面背景</label>
      <input
        v-model="background"
        class="spm-input"
        placeholder="assets/bg.jpg 或颜色值 (#1e1e24)"
        @blur="saveBackground"
      />
    </div>

    <div class="spm-popover-footer">
      <span class="spm-save-hint">{{ saveHint }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, defineProps, defineEmits } from 'vue'
import { setBlockAttrs } from '@/api'
import LayoutPicker from './LayoutPicker.vue'
import TransitionSelector from './TransitionSelector.vue'
import {
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_TRANSITION,
  ATTR_PAGE_BACKGROUND,
} from '@/types/slidev-protocol'

const props = defineProps<{
  blockId: string
  initialAttrs?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', attrs: Record<string, string>): void
}>()

const layout = ref(props.initialAttrs?.[ATTR_PAGE_LAYOUT] || 'default')
const transition = ref(props.initialAttrs?.[ATTR_PAGE_TRANSITION] || 'slide-left')
const background = ref(props.initialAttrs?.[ATTR_PAGE_BACKGROUND] || '')
const saveHint = ref('')

watch(() => props.initialAttrs, (newAttrs) => {
  layout.value = newAttrs?.[ATTR_PAGE_LAYOUT] || 'default'
  transition.value = newAttrs?.[ATTR_PAGE_TRANSITION] || 'slide-left'
  background.value = newAttrs?.[ATTR_PAGE_BACKGROUND] || ''
}, { deep: true })

async function updateAttr(key: string, value: string) {
  if (!props.blockId) return
  saveHint.value = '正在同步...'
  try {
    await setBlockAttrs(props.blockId, { [key]: value })
    saveHint.value = '已同步至块属性'
    emit('updated', { [key]: value })
    setTimeout(() => {
      saveHint.value = ''
    }, 1500)
  } catch (e) {
    saveHint.value = '同步失败'
  }
}

function onLayoutChange(val: string) {
  updateAttr(ATTR_PAGE_LAYOUT, val)
}

function onTransitionChange(val: string) {
  updateAttr(ATTR_PAGE_TRANSITION, val)
}

function saveBackground() {
  updateAttr(ATTR_PAGE_BACKGROUND, background.value.trim())
}
</script>

<style scoped>
.spm-divider-popover {
  width: 280px;
  background: var(--b3-theme-surface, #ffffff);
  border: 1px solid var(--b3-border-color, #e2e8f0);
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  padding: 12px;
  font-size: 13px;
  color: var(--b3-theme-on-surface, #1e293b);
}

.spm-divider-popover__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--b3-border-color, #e2e8f0);
}

.spm-close-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #64748b;
  font-size: 12px;
}

.spm-form-item {
  margin-top: 10px;
}

.spm-form-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--b3-theme-on-surface, #475569);
}

.spm-input, .spm-textarea {
  width: 100%;
  border: 1px solid var(--b3-border-color, #cbd5e1);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  background: var(--b3-theme-background, #ffffff);
  color: inherit;
  box-sizing: border-box;
}

.spm-textarea {
  resize: vertical;
}

.spm-popover-footer {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
  min-height: 16px;
}

.spm-save-hint {
  font-size: 11px;
  color: #10b981;
}
</style>
