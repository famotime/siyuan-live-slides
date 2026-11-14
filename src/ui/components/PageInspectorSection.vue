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
      v-if="!isMultiColLayout && pageLayout !== 'clover' && detectedSbRatio"
      class="spm-card-control"
      style="border-left: 3px solid var(--b3-theme-primary); background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.06); padding: 8px 12px; margin-top: 6px;"
    >
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="font-size: 11px; display: flex; align-items: center; gap: 6px; flex: 1;">
          <SlidesIcon name="sparkles" />
          <span>检测到本页横向超级块列宽比例：<b>{{ detectedSbRatio }}</b></span>
        </div>
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="一键应用超级块列宽并设为分栏"
          style="padding: 2px 8px; height: 26px; font-size: 11px; flex-shrink: 0; background: var(--b3-theme-primary); color: #fff; display: inline-flex; align-items: center; gap: 4px;"
          @click="$emit('applySuperBlockLayout', detectedSbInfo || { recommendedLayout: 'two-cols', ratio: detectedSbRatio })"
        >
          <SlidesIcon name="columns" />
          <span>设为分栏</span>
        </button>
      </div>
    </div>

    <!-- 分栏比例设置 (仅支持分栏与图文布局) -->
    <div v-if="isMultiColLayout" class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="ratio" />
            <span>分栏比例</span>
          </div>
          <span class="spm-control-desc">设置各列横向空间占比，默认平均分配</span>
        </div>
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

      <!-- 自定义输入框与操作按钮（读取即应用、重置渲染与超级块） -->
      <div style="display: flex; gap: 6px; align-items: center; margin-top: 6px;">
        <input
          :value="pageLayoutRatio || ''"
          class="spm-input"
          style="flex: 1; min-width: 0;"
          placeholder="自定义比例（如 1:2 或 30:70，留空为默认）"
          @input="$emit('update:pageLayoutRatio', ($event.target as HTMLInputElement).value)"
          @change="$emit('update:pageLayoutRatio', ($event.target as HTMLInputElement).value)"
        />
        <!-- 读取按钮：读取即应用，移动到输入框右侧 -->
        <button
          v-if="detectedSbRatio"
          class="spm-icon-btn b3-tooltips b3-tooltips__sw"
          :aria-label="`读取超级块列宽比例 (${detectedSbRatio}) 并应用`"
          style="padding: 0 8px; height: 26px; font-size: 11px; white-space: nowrap; flex-shrink: 0;"
          @click="$emit('update:pageLayoutRatio', detectedSbRatio)"
        >
          <SlidesIcon name="sparkles" />
          <span>读取</span>
        </button>
        <button
          v-else
          class="spm-icon-btn b3-tooltips b3-tooltips__sw"
          disabled
          style="opacity: 0.45; cursor: not-allowed; padding: 0 8px; height: 26px; font-size: 11px; white-space: nowrap; flex-shrink: 0;"
          aria-label="当前页未检测到调整过列宽的横向超级块"
        >
          <SlidesIcon name="sparkles" />
          <span>读取</span>
        </button>

        <!-- 重置按钮：同行紧跟在读取按钮之后，重置渲染比例并清空文档超级块自定义列宽 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__sw"
          aria-label="重置为等宽平均分布"
          style="padding: 0 8px; height: 26px; font-size: 11px; white-space: nowrap; flex-shrink: 0;"
          @click="onResetRatioToEqual"
        >
          <SlidesIcon name="reset" />
          <span>重置</span>
        </button>
      </div>

      <!-- 超级块宽度检测提示信息（取消独立的应用此比例按钮） -->
      <div v-if="detectedSbRatio" style="margin-top: 6px; font-size: 11px; opacity: 0.85; display: flex; align-items: center; gap: 4px;">
        <SlidesIcon name="ratio" />
        <span>检测到思源超级块宽度：</span>
        <code style="background: rgba(125, 125, 125, 0.15); padding: 1px 4px; border-radius: 3px; font-weight: bold;">{{ detectedSbRatio }}</code>
      </div>
      <div v-else style="margin-top: 6px; font-size: 11px; opacity: 0.6; display: flex; align-items: center; gap: 4px;">
        <SlidesIcon name="ratio" />
        <span>未检测到调宽超级块（默认各列平均分配）</span>
      </div>
    </div>

    <!-- 转场动效选择 -->
    <TransitionSelector
      :model-value="pageTransition"
      @change="$emit('update:pageTransition', $event)"
    />

    <!-- 页面动态蒙版 (Dynamic Mask) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="sparkles" />
            <span>页面动态蒙版</span>
          </div>
          <span class="spm-control-desc">随着点击操作分段展露正文内容</span>
        </div>
      </div>

      <!-- 方向分段切换 -->
      <div class="spm-segmented-group">
        <button
          class="spm-segmented-item"
          :class="{ active: !pageMask }"
          @click="$emit('update:pageMask', '')"
        >
          关闭
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: pageMask === 'down' }"
          @click="selectLinearMask('down')"
        >
          从上至下
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: pageMask === 'right' }"
          @click="selectLinearMask('right')"
        >
          从左至右
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: pageMask === 'clockwise' || pageMask === 'cw' }"
          @click="selectClockMask('clockwise')"
        >
          顺时针 ↻
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: pageMask === 'counter-clockwise' || pageMask === 'ccw' }"
          @click="selectClockMask('counter-clockwise')"
        >
          逆时针 ↺
        </button>
      </div>

      <!-- 启用蒙版时的扩展配置 -->
      <div v-if="pageMask" style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
        <!-- 比例预设与输入 -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="font-size: 11px; opacity: 0.85; font-weight: 500;">展露比例 / 断点</div>
          <span
            class="b3-tooltips b3-tooltips__sw"
            :aria-label="maskHelpTooltip"
            style="cursor: help; opacity: 0.75; display: inline-flex; align-items: center; gap: 3px; font-size: 11px;"
          >
            <SlidesIcon name="help" />
            <span>输入规则</span>
          </span>
        </div>
        <div class="spm-quick-chips">
          <button
            v-for="preset in maskRatioPresets"
            :key="preset.value"
            class="spm-chip"
            :class="{ active: effectiveMaskRatio === preset.value }"
            @click="$emit('update:pageMaskRatio', preset.value)"
          >
            {{ preset.label }}
          </button>
        </div>
        <input
          :value="effectiveMaskRatio"
          class="spm-input"
          style="width: 100%;"
          placeholder="自定义比例或断点（如 1:2:1 或 25:75:100）"
          @input="$emit('update:pageMaskRatio', ($event.target as HTMLInputElement).value)"
          @change="$emit('update:pageMaskRatio', ($event.target as HTMLInputElement).value)"
        />
        <div style="font-size: 10.5px; opacity: 0.6; line-height: 1.35; margin-top: -2px;">
          {{ (pageMask === 'clockwise' || pageMask === 'counter-clockwise' || pageMask === 'cw' || pageMask === 'ccw') ? '时钟走时蒙版：默认 4 步旋转展露（1:1:1:1，每步 25% 扇形面积）' : '提示：支持权重比（如 1:2:1）或绝对断点（如 25:75:100），冒号项数决定点击步数' }}
        </div>

        <!-- 遮盖样式与初始状态行 -->
        <div style="display: flex; gap: 8px; margin-top: 2px;">
          <!-- 遮盖样式 -->
          <div style="flex: 1;">
            <div style="font-size: 11px; opacity: 0.85; margin-bottom: 4px;">遮盖质感</div>
            <div class="spm-segmented-group">
              <button
                class="spm-segmented-item"
                :class="{ active: !pageMaskStyle || pageMaskStyle === 'solid' }"
                @click="$emit('update:pageMaskStyle', 'solid')"
              >
                背景同色
              </button>
              <button
                class="spm-segmented-item"
                :class="{ active: pageMaskStyle === 'blur' }"
                @click="$emit('update:pageMaskStyle', 'blur')"
              >
                磨砂毛玻璃
              </button>
            </div>
          </div>

          <!-- 初始状态 -->
          <div style="flex: 1;">
            <div style="font-size: 11px; opacity: 0.85; margin-bottom: 4px;">初始展露</div>
            <div class="spm-segmented-group">
              <button
                class="spm-segmented-item"
                :class="{ active: !pageMaskInitial || pageMaskInitial === 'hidden' }"
                @click="$emit('update:pageMaskInitial', 'hidden')"
              >
                完全遮盖
              </button>
              <button
                class="spm-segmented-item"
                :class="{ active: pageMaskInitial === 'revealed' }"
                @click="$emit('update:pageMaskInitial', 'revealed')"
              >
                首段可见
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 页面间距风格 (Spacing) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="ratio" />
            <span>页面间距</span>
          </div>
          <span class="spm-control-desc">覆盖本页内衬、内容间隙与正文行距</span>
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
          class="spm-segmented-item b3-tooltips b3-tooltips__s"
          :class="{ active: pageSpacing === 'compact' }"
          aria-label="紧凑排版：外衬 16/28px，块距 8px，行高 1.45"
          @click="$emit('update:pageSpacing', 'compact')"
        >
          紧凑
        </button>
        <button
          class="spm-segmented-item b3-tooltips b3-tooltips__s"
          :class="{ active: pageSpacing === 'normal' }"
          aria-label="标准排版：外衬 32/48px，块距 14px，行高 1.60"
          @click="$emit('update:pageSpacing', 'normal')"
        >
          标准
        </button>
        <button
          class="spm-segmented-item b3-tooltips b3-tooltips__sw"
          :class="{ active: pageSpacing === 'loose' }"
          aria-label="宽松排版：外衬 52/72px，块距 22px，行高 1.75"
          @click="$emit('update:pageSpacing', 'loose')"
        >
          宽松
        </button>
      </div>
    </div>

    <!-- 页面图片/分栏配图 (Image) -->
    <div
      v-if="pageLayout === 'image-right' || pageLayout === 'image-left' || pageImage"
      class="spm-card-control"
    >
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="image" />
            <span>页面图片</span>
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
        placeholder="网络图片 URL 或思源本地资源路径 (如 assets/...)"
        @input="$emit('update:pageImage', ($event.target as HTMLInputElement).value)"
        @change="$emit('update:pageImage', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 演讲备忘提词 (Notes，正文备注块驱动) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="presenter" />
            <span>演讲者提词</span>
          </div>
          <span class="spm-control-desc">正文备注块驱动 · 仅演讲者视图可见</span>
        </div>
        <button
          v-if="isFeatureEnabled('aiScript')"
          class="spm-btn-text b3-tooltips b3-tooltips__sw"
          aria-label="AI 自动生成本页讲稿提示块"
          @click="$emit('generateNotes')"
        >
          <SlidesIcon name="sparkles" />
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
            class="spm-btn-action b3-tooltips b3-tooltips__se"
            aria-label="在正文编辑区定位并高亮此讲稿备注块"
            @click="$emit('locateNoteBlock')"
          >
            <SlidesIcon name="search" />
            <span>定位讲稿块</span>
          </button>
          <button
            class="spm-btn-action b3-tooltips b3-tooltips__sw"
            aria-label="在本页末尾追加新的讲稿提示块"
            @click="$emit('addNoteBlock')"
          >
            <SlidesIcon name="insert-below" />
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
          <SlidesIcon name="insert-below" />
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
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          aria-label="在此分页符之后插入新的空白分页"
          @click="$emit('insertDividerAfter')"
        >
          <SlidesIcon name="insert-below" />
          <span>插入新页</span>
        </button>
        <button
          class="spm-btn-action spm-btn-danger b3-tooltips b3-tooltips__sw"
          aria-label="彻底删除当前分页符（合并前后页面）"
          @click="$emit('deleteDivider')"
        >
          <SlidesIcon name="trash" />
          <span>删除此页</span>
        </button>
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          style="grid-column: 1 / -1;"
          :class="{ 'is-disabled': !canConvertToSuperBlock }"
          :disabled="!canConvertToSuperBlock"
          :aria-label="canConvertToSuperBlock ? '将当前选中的多个块或列表项合并为横向超级块' : '请在编辑区选中多个块，或选中一个列表/列表项'"
          @click="$emit('convertToSuperBlock')"
        >
          <SlidesIcon name="columns" />
          <span>转为超级块</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LayoutPicker from '@/ui/components/LayoutPicker.vue'
import TransitionSelector from '@/ui/components/TransitionSelector.vue'
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import { isFeatureEnabled } from '@/feature-flags/feature-flags'

const props = defineProps<{
  pageLayout: string
  pageTransition: string
  pageSpacing?: string
  pageImage?: string
  pageNotes?: string
  pageIndex?: number
  pageLayoutRatio?: string
  pageMask?: string
  pageMaskRatio?: string
  pageMaskStyle?: string
  pageMaskInitial?: string
  detectedSbRatio?: string
  detectedSbInfo?: any
  canConvertToSuperBlock?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:pageLayout', val: string): void
  (e: 'update:pageTransition', val: string): void
  (e: 'update:pageSpacing', val: string): void
  (e: 'update:pageImage', val: string): void
  (e: 'update:pageLayoutRatio', val: string): void
  (e: 'update:pageMask', val: string): void
  (e: 'update:pageMaskRatio', val: string): void
  (e: 'update:pageMaskStyle', val: string): void
  (e: 'update:pageMaskInitial', val: string): void
  (e: 'applySuperBlockLayout', info: any): void
  (e: 'resetSuperblockRatio'): void
  (e: 'addNoteBlock'): void
  (e: 'locateNoteBlock'): void
  (e: 'generateNotes'): void
  (e: 'insertDividerAfter'): void
  (e: 'deleteDivider'): void
  (e: 'convertToSuperBlock'): void
}>()

const maskRatioPresets = [
  { label: '1:1 (2步)', value: '1:1' },
  { label: '1:1:1 (3步)', value: '1:1:1' },
  { label: '1:2:1 (非等宽)', value: '1:2:1' },
  { label: '1:1:1:1 (4步)', value: '1:1:1:1' },
]

const isClockMask = computed(() => {
  const m = props.pageMask
  return m === 'clockwise' || m === 'counter-clockwise' || m === 'cw' || m === 'ccw'
})

const defaultMaskRatio = computed(() => {
  return isClockMask.value ? '1:1:1:1' : '1:1'
})

const effectiveMaskRatio = computed(() => {
  return props.pageMaskRatio || defaultMaskRatio.value
})

function selectClockMask(dir: 'clockwise' | 'counter-clockwise') {
  emit('update:pageMask', dir)
  if (!props.pageMaskRatio || props.pageMaskRatio === '1:1') {
    emit('update:pageMaskRatio', '1:1:1:1')
  }
}

function selectLinearMask(dir: 'down' | 'right') {
  emit('update:pageMask', dir)
  if (!props.pageMaskRatio || props.pageMaskRatio === '1:1:1:1') {
    emit('update:pageMaskRatio', '1:1')
  }
}

const maskHelpTooltip = computed(() => {
  if (props.pageMask === 'clockwise' || props.pageMask === 'counter-clockwise' || props.pageMask === 'cw' || props.pageMask === 'ccw') {
    return '时钟走时规则：\n• 顺时针：左上 → 右上 → 右下 → 左下\n• 逆时针：左上 → 左下 → 右下 → 右上\n• 每次点击时针旋转 90° 并扇形扫开 1/4 象限，全部揭开后翻页'
  }
  return '输入规则：\n• 权重比例（项数决定步数）：如 1:1 (2步等分)、1:1:1 (3步等分)、1:2:1 (按权重累计分段)\n• 绝对百分比：如 25:75:100 或 30:80 (指定每步展开的累计百分比)\n• 每次点击或按空格/向右键展露下一段，全部揭开后翻页'
})

const isMultiColLayout = computed(() => {
  return ['two-cols', 'cols-header', 'two-cols-header', 'three-cols-header', 'image-left', 'image-right'].includes(props.pageLayout)
})

const detectedColumnsCount = computed(() => {
  if (props.pageLayout === 'two-cols-header' || props.pageLayout === 'two-cols' || props.pageLayout === 'image-left' || props.pageLayout === 'image-right') {
    return 2
  }
  if (props.pageLayout === 'three-cols-header') {
    return 3
  }
  // cols-header: 依据 pageLayoutRatio, detectedSbRatio 或 detectedSbInfo 动态推断
  const ratio = (props.pageLayoutRatio || '').trim()
  if (ratio.includes(':')) {
    const count = ratio.split(':').filter(Boolean).length
    if (count >= 2 && count <= 6) return count
  }
  const sbRatio = (props.detectedSbRatio || '').trim()
  if (sbRatio.includes(':')) {
    const count = sbRatio.split(':').filter(Boolean).length
    if (count >= 2 && count <= 6) return count
  }
  if (props.detectedSbInfo?.colCount && props.detectedSbInfo.colCount >= 2) {
    return Math.min(props.detectedSbInfo.colCount, 6)
  }
  if (props.detectedSbInfo?.slots && Array.isArray(props.detectedSbInfo.slots)) {
    const count = props.detectedSbInfo.slots.length
    if (count >= 2 && count <= 6) return count
  }
  return 2
})

const currentRatioPresets = computed(() => {
  const cols = detectedColumnsCount.value
  if (cols === 3) {
    return [
      { label: '默认 1:1:1', value: '' },
      { label: '1:2:1 (主中)', value: '1:2:1' },
      { label: '2:1:1 (主左)', value: '2:1:1' },
      { label: '1:1:2 (主右)', value: '1:1:2' },
      { label: '1:3:1', value: '1:3:1' },
    ]
  }
  if (cols === 4) {
    return [
      { label: '默认 1:1:1:1', value: '' },
      { label: '1:2:2:1', value: '1:2:2:1' },
      { label: '2:1:1:2', value: '2:1:1:2' },
    ]
  }
  if (cols === 5) {
    return [
      { label: '默认 1:1:1:1:1', value: '' },
    ]
  }
  if (cols === 6) {
    return [
      { label: '默认 1:1:1:1:1:1', value: '' },
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

function onResetRatioToEqual() {
  const cols = detectedColumnsCount.value || 2
  const equalRatio = Array(cols).fill('1').join(':')
  emit('update:pageLayoutRatio', equalRatio)
  emit('resetSuperblockRatio')
}

const notePreviewSnippet = computed(() => {
  if (!props.pageNotes) return ''
  const clean = props.pageNotes.replace(/[\r\n]+/g, ' ').trim()
  return clean.length > 50 ? clean.slice(0, 50) + '...' : clean
})

const presetImages = [
  { label: '默认封面', value: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80' },
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
