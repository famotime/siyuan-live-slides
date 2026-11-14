<template>
  <div class="spm-layout-picker">
    <div class="spm-layout-picker__header">选择页面版式</div>

    <div v-for="group in visibleLayoutGroups" :key="group.id" class="spm-layout-group">
      <div class="spm-layout-group__title">
        <span>{{ group.title }}</span>
      </div>
      <div class="spm-layout-picker__grid">
        <div
          v-for="layout in group.items"
          :key="layout.name"
          class="spm-layout-item"
          :class="{ active: isLayoutActive(layout.name) }"
          :title="`${layout.label}：${layout.desc}`"
          @click="selectLayout(layout.name)"
        >
          <div class="spm-layout-icon">
            <SlidesIcon :name="'layout-' + layout.name" />
          </div>
          <span class="spm-layout-label">{{ layout.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SlidesIcon from './SlidesIcon.vue'
import { isLayoutEnabled } from '@/feature-flags/feature-flags'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

interface ILayoutItem {
  name: string
  label: string
  desc: string
}

interface ILayoutGroup {
  id: string
  title: string
  items: ILayoutItem[]
}

const layoutGroups: ILayoutGroup[] = [
  {
    id: 'columns',
    title: '内容分栏',
    items: [
      { name: 'default', label: '标准', desc: '标题在上，内容自适应流式排版' },
      { name: 'cols-header', label: '多栏', desc: '自适应 2~N 栏排版，支持通栏标题与比例调节' },
      { name: 'clover', label: '四叶草', desc: '2x2 田字型四象限卡片布局' },
      { name: 'timeline', label: '时间线', desc: '步骤流程、里程碑演进或时间轴' },
    ],
  },
  {
    id: 'visuals',
    title: '图文排版',
    items: [
      { name: 'image-right', label: '图右', desc: '左侧文字内容，右侧全屏背景图' },
      { name: 'image-left', label: '图左', desc: '左侧全屏背景图，右侧文字内容' },
    ],
  },
  {
    id: 'focus',
    title: '聚焦与强调',
    items: [
      { name: 'cover', label: '封面', desc: '全屏居中大标题与副标题封面页' },
      { name: 'fact', label: '大字报', desc: '核心数据或指标突出展示 (KPI看板)' },
      { name: 'quote', label: '引言', desc: '名人名言、金句与右对齐出处' },
      { name: 'intro', label: '介绍', desc: '演讲者头像与个人履历名片' },
      { name: 'center', label: '居中', desc: '内容全屏垂直水平居中' },
    ],
  },
]

const visibleLayoutGroups = computed(() => {
  return layoutGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => isLayoutEnabled(item.name)),
    }))
    .filter(group => group.items.length > 0)
})

function isLayoutActive(layoutName: string): boolean {
  if (props.modelValue === layoutName) return true
  if (layoutName === 'cols-header' && (props.modelValue === 'two-cols' || props.modelValue === 'two-cols-header' || props.modelValue === 'three-cols-header')) {
    return true
  }
  if (layoutName === 'timeline' && props.modelValue === 'steps') {
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

.spm-layout-group {
  margin-bottom: 10px;
}

.spm-layout-group:last-child {
  margin-bottom: 0;
}

.spm-layout-group__title {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #64748b);
  opacity: 0.75;
  margin-bottom: 4px;
  padding-left: 2px;
  letter-spacing: 0.02em;
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
