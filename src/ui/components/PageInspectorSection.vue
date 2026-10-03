<template>
  <div class="spm-section spm-section--page">
    <div class="spm-section-header">
      <span>幻灯片页面设置</span>
      <span class="spm-section-sub">当前页 Frontmatter</span>
    </div>

    <!-- 版式选择 -->
    <LayoutPicker
      :model-value="pageLayout"
      @change="$emit('update:pageLayout', $event)"
    />

    <!-- 转场动效选择 -->
    <TransitionSelector
      :model-value="pageTransition"
      @change="$emit('update:pageTransition', $event)"
    />

    <!-- 页面背景 -->
    <div class="spm-field-group">
      <label class="spm-field-label">页面背景 (Background)</label>
      <div class="spm-quick-chips">
        <button
          v-for="bg in presetBackgrounds"
          :key="bg.value"
          class="spm-chip"
          :class="{ active: pageBackground === bg.value }"
          @click="$emit('update:pageBackground', bg.value)"
        >
          {{ bg.label }}
        </button>
      </div>
      <input
        :value="pageBackground"
        class="spm-input"
        placeholder="自定义颜色 (#1e1e24) 或资源路径"
        @input="$emit('update:pageBackground', ($event.target as HTMLInputElement).value)"
        @change="$emit('update:pageBackground', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 演讲备忘提词 (Notes) -->
    <div class="spm-field-group">
      <div class="spm-field-label-row">
        <label class="spm-field-label">演讲者提词 (Notes)</label>
        <button
          class="spm-btn-text"
          title="使用思源 AI 自动提炼提词"
          @click="$emit('generateNotes')"
        >
          🤖 AI 提词
        </button>
      </div>
      <textarea
        :value="pageNotes"
        class="spm-textarea"
        rows="3"
        placeholder="口播备忘录，仅演讲者视图可见..."
        @input="$emit('update:pageNotes', ($event.target as HTMLTextAreaElement).value)"
        @change="$emit('update:pageNotes', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
    </div>

    <!-- 分页符快捷操作 -->
    <div class="spm-action-group">
      <div class="spm-action-group-title">分页快捷操作</div>
      <div class="spm-action-buttons">
        <button class="spm-btn-action" @click="$emit('insertDividerAfter')">
          ➕ 在此后插入新页
        </button>
        <button class="spm-btn-action spm-btn-danger" @click="$emit('deleteDivider')">
          🗑️ 删除此分页符
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutPicker from '@/ui/components/LayoutPicker.vue'
import TransitionSelector from '@/ui/components/TransitionSelector.vue'

defineProps<{
  pageLayout: string
  pageTransition: string
  pageBackground: string
  pageNotes: string
}>()

defineEmits<{
  (e: 'update:pageLayout', val: string): void
  (e: 'update:pageTransition', val: string): void
  (e: 'update:pageBackground', val: string): void
  (e: 'update:pageNotes', val: string): void
  (e: 'generateNotes'): void
  (e: 'insertDividerAfter'): void
  (e: 'deleteDivider'): void
}>()

const presetBackgrounds = [
  { label: '默认', value: '' },
  { label: '暗黑 #1e1e24', value: '#1e1e24' },
  { label: '极夜 #0f172a', value: '#0f172a' },
  { label: '极简白 #ffffff', value: '#ffffff' },
]
</script>
