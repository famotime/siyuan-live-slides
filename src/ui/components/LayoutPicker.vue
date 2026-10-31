<template>
  <div class="spm-layout-picker">
    <div class="spm-layout-picker__header">选择页面版式</div>
    <div class="spm-layout-picker__grid">
      <div
        v-for="layout in layouts"
        :key="layout.name"
        class="spm-layout-item"
        :class="{ active: isLayoutActive(layout.name) }"
        :title="layout.desc"
        @click="selectLayout(layout.name)"
      >
        <div class="spm-layout-icon">
          <SlidesIcon :name="'layout-' + layout.name" />
        </div>
        <span class="spm-layout-label">{{ layout.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SlidesIcon from './SlidesIcon.vue'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const layouts = [
  { name: 'cover', label: '封面', desc: '大标题与副标题封面页' },
  { name: 'default', label: '标准', desc: '标题在上方，内容在下方' },
  { name: 'two-cols', label: '双栏', desc: '左右双栏对比展示' },
  { name: 'cols-header', label: '表头多栏', desc: '顶部通栏标题，下方自适应 2~N 栏' },
  { name: 'clover', label: '四叶草', desc: '4 项超级块 2x2 田字型四象限卡片布局' },
  { name: 'image-right', label: '图右', desc: '左侧为内容，右侧全屏背景图' },
  { name: 'image-left', label: '图左', desc: '左侧全屏背景图，右侧为内容' },
  { name: 'center', label: '居中', desc: '内容全屏垂直水平居中' },
  { name: 'fact', label: '大字报', desc: '核心数据或指标突出展示' },
  { name: 'intro', label: '介绍', desc: '演讲者自我介绍或章节导览' },
  { name: 'quote', label: '引言', desc: '名人名言与强调段落' },
]

function isLayoutActive(layoutName: string): boolean {
  if (props.modelValue === layoutName) return true
  if (layoutName === 'cols-header' && (props.modelValue === 'two-cols-header' || props.modelValue === 'three-cols-header')) {
    return true
  }
  return false
}

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
  padding: 8px 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--b3-border-color, #e2e8f0);
  background: var(--b3-theme-background, #ffffff);
  color: var(--b3-theme-on-surface, #475569);
  cursor: pointer;
  transition: all 0.15s ease;
}

.spm-layout-item:hover {
  background: var(--b3-theme-primary-lightest, var(--b3-list-hover, rgba(59, 130, 246, 0.08)));
  border-color: var(--b3-theme-primary, #3b82f6);
  color: var(--b3-theme-primary, #3b82f6);
}

.spm-layout-item:hover .spm-layout-label {
  color: var(--b3-theme-primary, #3b82f6);
}

.spm-layout-item.active {
  border-color: var(--b3-theme-primary, #3b82f6);
  background: var(--b3-theme-primary, #3b82f6);
  color: #ffffff !important;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.3);
}

.spm-layout-item.active:hover {
  background: var(--b3-theme-primary, #3b82f6);
  color: #ffffff !important;
}

.spm-layout-item.active .spm-layout-icon,
.spm-layout-item.active:hover .spm-layout-icon {
  color: #ffffff !important;
  opacity: 1;
  transform: none;
}

.spm-layout-item.active .spm-layout-label,
.spm-layout-item.active:hover .spm-layout-label {
  color: #ffffff !important;
}

.spm-layout-icon {
  width: 28px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 5px;
  color: var(--b3-theme-on-surface, #64748b);
  opacity: 0.85;
  transition: all 0.15s ease;
}

.spm-layout-icon :deep(svg),
.spm-layout-icon svg {
  width: 100%;
  height: 100%;
}

.spm-layout-item:hover .spm-layout-icon {
  color: var(--b3-theme-primary, #3b82f6);
  opacity: 1;
  transform: translateY(-1px);
}

.spm-layout-label {
  font-size: 11px;
  line-height: 1.2;
  color: inherit;
  transition: color 0.15s ease;
}
</style>
