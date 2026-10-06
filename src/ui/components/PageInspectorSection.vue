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

    <!-- 智能分栏提示 (当默认版式下检测到横向超级块) -->
    <div
      v-if="!isMultiColLayout && detectedSbRatio"
      class="spm-card-control"
      style="border-left: 3px solid var(--b3-theme-primary); background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.06); padding: 8px 12px; margin-top: 6px;"
    >
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="font-size: 11px; display: flex; align-items: center; gap: 6px; flex: 1;">
          <SlidevIcon name="sparkles" />
          <span>检测到本页横向超级块列宽比例：<b>{{ detectedSbRatio }}</b></span>
        </div>
        <button
          class="spm-btn-action"
          style="padding: 2px 8px; height: 26px; font-size: 11px; flex-shrink: 0; background: var(--b3-theme-primary); color: #fff;"
          @click="$emit('applySuperBlockLayout', detectedSbInfo || { recommendedLayout: 'two-cols', ratio: detectedSbRatio })"
        >
          一键设为分栏并应用
        </button>
      </div>
    </div>

    <!-- 分栏比例设置 (仅支持分栏与图文布局) -->
    <div v-if="isMultiColLayout" class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="ratio" />
            <span>分栏比例 (Ratio)</span>
          </div>
          <span class="spm-control-desc">设置各列横向空间占比，默认平均分配</span>
        </div>
        <button
          v-if="detectedSbRatio"
          class="spm-btn-text b3-tooltips b3-tooltips__w"
          :aria-label="`从当前页思源超级块读取实际宽度比例 (${detectedSbRatio})`"
          @click="$emit('update:pageLayoutRatio', detectedSbRatio)"
        >
          <SlidevIcon name="sparkles" />
          <span>从超级块读取 ({{ detectedSbRatio }})</span>
        </button>
        <button
          v-else
          class="spm-btn-text b3-tooltips b3-tooltips__w"
          disabled
          style="opacity: 0.45; cursor: not-allowed;"
          aria-label="当前页未检测到调整过列宽的横向超级块（默认各列平均分配）"
        >
          <SlidevIcon name="sparkles" />
          <span>从超级块读取 (未检测到)</span>
        </button>
      </div>

      <!-- 快捷芯片预设 -->
      <div class="spm-quick-chips">
        <button
          v-for="chip in currentRatioPresets"
          :key="chip.value"
          class="spm-chip"
          :class="{ active: currentActiveRatio === chip.value }"
          @click="$emit('update:pageLayoutRatio', chip.value)"
        >
          {{ chip.label }}
        </button>
      </div>

      <!-- 自定义输入框与重置按钮 -->
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px;">
        <input
          :value="pageLayoutRatio || ''"
          class="spm-input"
          style="flex: 1;"
          placeholder="自定义比例（如 1:2 或 30:70，留空为默认）"
          @input="$emit('update:pageLayoutRatio', ($event.target as HTMLInputElement).value)"
          @change="$emit('update:pageLayoutRatio', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="pageLayoutRatio"
          class="spm-btn-action b3-tooltips b3-tooltips__w"
          aria-label="重置为默认平均分配"
          style="flex-shrink: 0; padding: 0 10px; height: 28px;"
          @click="$emit('update:pageLayoutRatio', '')"
        >
          重置
        </button>
      </div>

      <div v-if="detectedSbRatio" style="margin-top: 6px; font-size: 11px; opacity: 0.85; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <span>📐 检测到思源超级块宽度：</span>
          <code style="background: rgba(125, 125, 125, 0.15); padding: 1px 4px; border-radius: 3px; font-weight: bold;">{{ detectedSbRatio }}</code>
        </div>
        <button
          v-if="pageLayoutRatio !== detectedSbRatio"
          class="spm-btn-text"
          style="font-size: 11px; padding: 0 4px;"
          @click="$emit('update:pageLayoutRatio', detectedSbRatio)"
        >
          点击应用
        </button>
      </div>
      <div v-else style="margin-top: 6px; font-size: 11px; opacity: 0.6;">
        <span>📐 未检测到调宽超级块（默认各列平均分配）</span>
      </div>
    </div>

    <!-- 转场动效选择 -->
    <TransitionSelector
      :model-value="pageTransition"
      @change="$emit('update:pageTransition', $event)"
    />

    <!-- 页面间距风格 (Spacing) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="ratio" />
            <span>页面间距 (Spacing)</span>
          </div>
          <span class="spm-control-desc">覆盖本页内边距与顶部标题间距</span>
        </div>
      </div>
      <div class="spm-segmented-group">
        <button
          class="spm-segmented-item"
          :class="{ active: !pageSpacing || pageSpacing === 'inherit' }"
          @click="$emit('update:pageSpacing', 'inherit')"
        >
          继承全局
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: pageSpacing === 'compact' }"
          @click="$emit('update:pageSpacing', 'compact')"
        >
          紧凑
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: pageSpacing === 'normal' }"
          @click="$emit('update:pageSpacing', 'normal')"
        >
          标准
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: pageSpacing === 'loose' }"
          @click="$emit('update:pageSpacing', 'loose')"
        >
          宽松
        </button>
      </div>
    </div>

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
  pageSpacing?: string
  pageImage?: string
  pageNotes?: string
  pageIndex?: number
  pageLayoutRatio?: string
  detectedSbRatio?: string
  detectedSbInfo?: any
}>()

const emit = defineEmits<{
  (e: 'update:pageLayout', val: string): void
  (e: 'update:pageTransition', val: string): void
  (e: 'update:pageBackground', val: string): void
  (e: 'update:pageSpacing', val: string): void
  (e: 'update:pageImage', val: string): void
  (e: 'update:pageLayoutRatio', val: string): void
  (e: 'applySuperBlockLayout', info: any): void
  (e: 'addNoteBlock'): void
  (e: 'locateNoteBlock'): void
  (e: 'generateNotes'): void
  (e: 'insertDividerAfter'): void
  (e: 'deleteDivider'): void
}>()

const isMultiColLayout = computed(() => {
  return ['two-cols', 'two-cols-header', 'three-cols-header', 'image-left', 'image-right'].includes(props.pageLayout)
})

const isThreeCols = computed(() => props.pageLayout === 'three-cols-header')

const currentRatioPresets = computed(() => {
  if (isThreeCols.value) {
    return [
      { label: '默认 1:1:1', value: '' },
      { label: '1:2:1 (主中)', value: '1:2:1' },
      { label: '2:1:1 (主左)', value: '2:1:1' },
      { label: '1:1:2 (主右)', value: '1:1:2' },
      { label: '1:3:1', value: '1:3:1' },
    ]
  }
  return [
    { label: '默认 1:1', value: '' },
    { label: '1:2', value: '1:2' },
    { label: '2:1', value: '2:1' },
    { label: '3:7', value: '3:7' },
    { label: '7:3', value: '7:3' },
    { label: '4:6', value: '4:6' },
    { label: '6:4', value: '6:4' },
  ]
})

const currentActiveRatio = computed(() => {
  return props.pageLayoutRatio || ''
})

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
