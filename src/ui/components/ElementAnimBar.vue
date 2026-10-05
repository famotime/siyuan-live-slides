<template>
  <div class="spm-anim-bar">
    <!-- 逐步出现 v-click -->
    <button
      class="spm-bar-btn"
      :class="{ active: Boolean(currentClick) }"
      title="切换当前块按翻页键逐步出现 (v-click)"
      @click="toggleClick"
    >
      <span>✨ 逐步出现</span>
      <span v-if="currentClick" class="spm-badge">{{ currentClick }}</span>
    </button>

    <!-- 入场微动效 v-motion -->
    <button
      class="spm-bar-btn"
      :class="{ active: Boolean(currentMotion) }"
      title="切换当前块入场微动效 (v-motion)"
      @click="cycleMotion"
    >
      <span>🌊 动效: {{ motionLabel }}</span>
    </button>

    <!-- 分栏插槽 -->
    <button
      class="spm-bar-btn"
      :class="{ active: Boolean(currentSlot) }"
      title="设置在双栏布局中的归属 (left / right)"
      @click="cycleSlot"
    >
      <span>▥ 分栏: {{ slotLabel }}</span>
    </button>

    <!-- 代码聚光高亮 (仅代码块) -->
    <button
      v-if="isCodeBlock"
      class="spm-bar-btn"
      :class="{ active: Boolean(currentShiki) }"
      title="设置代码逐行聚光高亮 (如 1-3|5|all)"
      @click="promptShikiLines"
    >
      <span>🔍 代码聚光</span>
      <span v-if="currentShiki" class="spm-badge">{{ currentShiki }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineProps, defineEmits } from 'vue'
import { setBlockAttrs } from '@/api'
import { syncDomBlockAttrs } from '@/sync/dom-attr-sync'
import {
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_SHIKI_LINES,
  ATTR_ELEM_SLOT,
} from '@/types/slidev-protocol'

const props = defineProps<{
  blockId: string
  isCodeBlock?: boolean
  initialAttrs?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'updated', attrs: Record<string, string>): void
}>()

const currentClick = ref(props.initialAttrs?.[ATTR_ELEM_CLICK] || '')
const currentMotion = ref(props.initialAttrs?.[ATTR_ELEM_MOTION] || '')
const currentSlot = ref(props.initialAttrs?.[ATTR_ELEM_SLOT] || '')
const currentShiki = ref(props.initialAttrs?.[ATTR_ELEM_SHIKI_LINES] || '')

const motionLabel = computed(() => {
  if (!currentMotion.value) return '无'
  try {
    const obj = JSON.parse(currentMotion.value)
    return obj.preset || obj.type || '开启'
  } catch {
    return currentMotion.value
  }
})

const slotLabel = computed(() => {
  if (currentSlot.value === 'left') return '左栏'
  if (currentSlot.value === 'right') return '右栏'
  return '默认'
})

async function saveAttr(key: string, val: string) {
  if (!props.blockId) return
  syncDomBlockAttrs(props.blockId, { [key]: val })
  await setBlockAttrs(props.blockId, { [key]: val })
  emit('updated', { [key]: val })
}

function toggleClick() {
  if (!currentClick.value) {
    currentClick.value = '+1'
  } else {
    currentClick.value = ''
  }
  saveAttr(ATTR_ELEM_CLICK, currentClick.value)
}

function cycleMotion() {
  const presets = ['', 'slide-up', 'fade-in', 'zoom-in', 'bounce']
  let currentKey = ''
  try {
    const obj = JSON.parse(currentMotion.value)
    currentKey = obj.preset || ''
  } catch {
    currentKey = currentMotion.value
  }
  const idx = presets.indexOf(currentKey)
  const next = presets[(idx + 1) % presets.length]
  currentMotion.value = next
  saveAttr(ATTR_ELEM_MOTION, next)
}

function cycleSlot() {
  if (!currentSlot.value) {
    currentSlot.value = 'left'
  } else if (currentSlot.value === 'left') {
    currentSlot.value = 'right'
  } else {
    currentSlot.value = ''
  }
  saveAttr(ATTR_ELEM_SLOT, currentSlot.value)
}

function promptShikiLines() {
  const val = prompt('请输入逐行聚光区间（如 1-2|3-4|all）：', currentShiki.value || '1-3')
  if (val !== null) {
    currentShiki.value = val.trim()
    saveAttr(ATTR_ELEM_SHIKI_LINES, currentShiki.value)
  }
}
</script>

<style scoped>
.spm-anim-bar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(30, 41, 59, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 4px 6px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
}

.spm-bar-btn {
  background: transparent;
  border: none;
  color: #f1f5f9;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}

.spm-bar-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.spm-bar-btn.active {
  background: #3b82f6;
  color: #ffffff;
  font-weight: 600;
}

.spm-badge {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.25);
  padding: 1px 4px;
  border-radius: 3px;
}
</style>
