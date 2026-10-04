<template>
  <div class="spm-layout-picker">
    <div class="spm-layout-picker__header">选择页面版式</div>
    <div class="spm-layout-picker__grid">
      <div
        v-for="layout in layouts"
        :key="layout.name"
        class="spm-layout-item"
        :class="{ active: modelValue === layout.name }"
        :title="layout.desc"
        @click="selectLayout(layout.name)"
      >
        <span class="spm-layout-icon">{{ layout.icon }}</span>
        <span class="spm-layout-label">{{ layout.label }}</span>
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

const layouts = [
  { name: 'cover', label: '封面', icon: '🎯', desc: '大标题与副标题封面页' },
  { name: 'default', label: '标准', icon: '📄', desc: '标题在上方，内容在下方' },
  { name: 'image-right', label: '图右', icon: '🖼️', desc: '左侧为内容，右侧全屏背景图' },
  { name: 'image-left', label: '图左', icon: '🎨', desc: '左侧全屏背景图，右侧为内容' },
  { name: 'two-cols', label: '双栏', icon: '▥', desc: '左右左右双栏对比展示' },
  { name: 'center', label: '居中', icon: '🀄', desc: '内容全屏垂直水平居中' },
  { name: 'fact', label: '大字报', icon: '🔢', desc: '核心数据或指标突出展示' },
  { name: 'intro', label: '介绍', icon: '👤', desc: '演讲者自我介绍或章节导览' },
  { name: 'quote', label: '引言', icon: '💬', desc: '名人名言与强调段落' },
]

function selectLayout(name: string) {
  emit('update:modelValue', name)
  emit('change', name)
}
</script>

<style scoped>
.spm-layout-picker {
  padding: 8px;
}

.spm-layout-picker__header {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--b3-theme-on-surface, #475569);
}

.spm-layout-picker__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.spm-layout-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  border-radius: 6px;
  border: 1px solid var(--b3-border-color, #e2e8f0);
  background: var(--b3-theme-background, #ffffff);
  cursor: pointer;
  transition: all 0.15s ease;
}

.spm-layout-item:hover {
  background: var(--b3-theme-surface-hover, #f1f5f9);
  border-color: #3b82f6;
}

.spm-layout-item.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  font-weight: 600;
}

.spm-layout-icon {
  font-size: 16px;
  margin-bottom: 4px;
}

.spm-layout-label {
  font-size: 11px;
}
</style>
