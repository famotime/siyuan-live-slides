<template>
  <div class="spm-section spm-section--page">
    <div class="spm-section-header">
      <span>幻灯片页面设置</span>
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
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="palette" />
            <span>页面背景 (Background)</span>
          </div>
          <span class="spm-control-desc">设置当前页特定底色或壁纸</span>
        </div>
      </div>
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
        placeholder="自定义颜色代码或资源路径"
        @input="$emit('update:pageBackground', ($event.target as HTMLInputElement).value)"
        @change="$emit('update:pageBackground', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 演讲备忘提词 (Notes) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="presenter" />
            <span>演讲者提词 (Notes)</span>
          </div>
          <span class="spm-control-desc">仅在双屏演讲者视图可见</span>
        </div>
        <button
          class="spm-btn-text b3-tooltips b3-tooltips__w"
          aria-label="调用思源 AI 根据本页内容自动提炼口播讲稿"
          @click="$emit('generateNotes')"
        >
          <SlidevIcon name="sparkles" />
          <span>AI 提词</span>
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

    <!-- 分页符快捷操作 (紧凑 2 列网格) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <span class="spm-control-title">分页快捷操作</span>
        </div>
      </div>
      <div class="spm-action-grid">
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="在此分页符之后插入新的空白分页"
          @click="$emit('insertDividerAfter')"
        >
          <SlidevIcon name="insert-below" />
          <span>插入新页</span>
        </button>
        <button
          class="spm-btn-action spm-btn-danger b3-tooltips b3-tooltips__s"
          aria-label="彻底删除当前分页符（合并前后页面）"
          @click="$emit('deleteDivider')"
        >
          <SlidevIcon name="trash" />
          <span>删除此页</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutPicker from '@/ui/components/LayoutPicker.vue'
import TransitionSelector from '@/ui/components/TransitionSelector.vue'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'

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
