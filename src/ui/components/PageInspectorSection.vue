<template>
  <div class="spm-section spm-section--page">
    <div class="spm-section-header">
      <span>幻灯片页面设置{{ pageIndex ? ` (第 ${pageIndex} 页)` : '' }}</span>
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

    <!-- 页面图片/分栏配图 (Image) -->
    <div
      v-if="pageLayout === 'image-right' || pageLayout === 'image-left' || pageImage"
      class="spm-card-control"
    >
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="image" />
            <span>页面图片 (Image)</span>
          </div>
          <span class="spm-control-desc">图文分栏或页面专属配图 URL / 资源路径</span>
        </div>
      </div>
      <div class="spm-quick-chips">
        <button
          v-for="img in presetImages"
          :key="img.value"
          class="spm-chip"
          :class="{ active: pageImage === img.value }"
          @click="$emit('update:pageImage', img.value)"
        >
          {{ img.label }}
        </button>
      </div>
      <input
        :value="pageImage"
        class="spm-input"
        placeholder="网络图片 URL (如 https://cover.sli.dev) 或 assets/..."
        @input="$emit('update:pageImage', ($event.target as HTMLInputElement).value)"
        @change="$emit('update:pageImage', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 演讲备忘提词 (Notes，正文备注块驱动) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="presenter" />
            <span>演讲者提词 (Notes)</span>
          </div>
          <span class="spm-control-desc">正文备注块驱动 · 仅演讲者视图可见</span>
        </div>
        <button
          class="spm-btn-text b3-tooltips b3-tooltips__w"
          aria-label="AI 自动生成本页讲稿提示块"
          @click="$emit('generateNotes')"
        >
          <SlidevIcon name="sparkles" />
          <span>AI 讲稿</span>
        </button>
      </div>

      <!-- 提词状态与预览卡片 -->
      <div v-if="pageNotes" class="spm-note-status-box">
        <div class="spm-note-status-badge">
          <span class="spm-badge-dot"></span>
          <span>已配置正文讲稿</span>
        </div>
        <div class="spm-note-preview-text" :title="pageNotes">
          {{ notePreviewSnippet }}
        </div>
        <div class="spm-action-grid" style="margin-top: 6px;">
          <button
            class="spm-btn-action b3-tooltips b3-tooltips__s"
            aria-label="在正文编辑区定位并高亮此讲稿备注块"
            @click="$emit('locateNoteBlock')"
          >
            <SlidevIcon name="search" />
            <span>定位讲稿块</span>
          </button>
          <button
            class="spm-btn-action b3-tooltips b3-tooltips__s"
            aria-label="在本页末尾追加新的讲稿提示块"
            @click="$emit('addNoteBlock')"
          >
            <SlidevIcon name="insert-below" />
            <span>追加讲稿块</span>
          </button>
        </div>
      </div>

      <div v-else class="spm-note-empty-box">
        <div class="spm-note-empty-hint">本页暂无讲稿备注块</div>
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          style="width: 100%; margin-top: 6px;"
          aria-label="在当前页末尾插入默认演讲备注提示块"
          @click="$emit('addNoteBlock')"
        >
          <SlidevIcon name="insert-below" />
          <span>添加讲稿备注块</span>
        </button>
      </div>
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
import { computed } from 'vue'
import LayoutPicker from '@/ui/components/LayoutPicker.vue'
import TransitionSelector from '@/ui/components/TransitionSelector.vue'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'

const props = defineProps<{
  pageLayout: string
  pageTransition: string
  pageBackground: string
  pageImage?: string
  pageNotes?: string
  pageIndex?: number
}>()

const emit = defineEmits<{
  (e: 'update:pageLayout', val: string): void
  (e: 'update:pageTransition', val: string): void
  (e: 'update:pageBackground', val: string): void
  (e: 'update:pageImage', val: string): void
  (e: 'addNoteBlock'): void
  (e: 'locateNoteBlock'): void
  (e: 'generateNotes'): void
  (e: 'insertDividerAfter'): void
  (e: 'deleteDivider'): void
}>()

const notePreviewSnippet = computed(() => {
  if (!props.pageNotes) return ''
  const clean = props.pageNotes.replace(/[\r\n]+/g, ' ').trim()
  return clean.length > 50 ? clean.slice(0, 50) + '...' : clean
})

const presetBackgrounds = [
  { label: '默认', value: '' },
  { label: '暗黑 #1e1e24', value: '#1e1e24' },
  { label: '极夜 #0f172a', value: '#0f172a' },
  { label: '极简白 #ffffff', value: '#ffffff' },
]

const presetImages = [
  { label: '默认封面', value: 'https://cover.sli.dev' },
  { label: '清空配图', value: '' },
]
</script>

<style scoped lang="scss">
.spm-note-status-box,
.spm-note-empty-box {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  background: var(--b3-theme-surface-light, rgba(0, 0, 0, 0.03));
  border-radius: 6px;
  border: 1px solid var(--b3-border-color, rgba(0, 0, 0, 0.08));
  font-size: 12px;
}

.spm-note-status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: var(--b3-theme-primary);
  margin-bottom: 4px;
}

.spm-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
}

.spm-note-preview-text {
  color: var(--b3-theme-on-surface);
  opacity: 0.85;
  line-height: 1.4;
  word-break: break-word;
}

.spm-note-empty-hint {
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  text-align: center;
  padding: 4px 0;
}
</style>
