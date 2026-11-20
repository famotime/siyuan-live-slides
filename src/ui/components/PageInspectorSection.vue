<template>
  <div class="spm-section spm-section--page">
    <div class="spm-section-header">
      <span>幻灯片页面设置{{ pageIndex ? ` (第 ${pageIndex} 页)` : '' }}</span>
    </div>

    <!-- 页面版式选择卡片 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="选择当前幻灯片页面的排版版式"
          >
            <SlidesIcon name="layout" />
            <span>页面版式</span>
          </div>
        </div>
      </div>
      <LayoutPicker
        :model-value="pageLayout"
        hide-header
        @change="$emit('update:pageLayout', $event)"
      />
    </div>

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
      <div class="spm-control-header" style="margin-bottom: 8px;">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="设置各列横向空间占比，默认平均分配"
          >
            <SlidesIcon name="ratio" />
            <span>分栏比例</span>
          </div>
        </div>

        <!-- 通栏标题开关 (仅在多栏布局下显示) -->
        <div
          v-if="isColsHeaderLayout"
          class="spm-header-toggle-row"
          style="display: flex; align-items: center; gap: 6px;"
        >
          <span
            class="b3-tooltips b3-tooltips__sw"
            aria-label="开启时自动提取页面首个标题作为跨栏顶部大标题；关闭时首个标题随同正文进入栏内排版（原双栏/多栏对齐效果）"
            style="font-size: 11px; opacity: 0.85; cursor: help; display: inline-flex; align-items: center; gap: 3px;"
          >
            <span>通栏标题</span>
            <SlidesIcon name="help" style="font-size: 10px; opacity: 0.6;" />
          </span>
          <label
            class="spm-switch b3-tooltips b3-tooltips__w"
            :aria-label="effectivePageHeader ? '关闭通栏标题' : '开启通栏标题'"
          >
            <input
              type="checkbox"
              :checked="effectivePageHeader"
              @change="$emit('update:pageHeader', ($event.target as HTMLInputElement).checked)"
            />
            <span class="spm-switch-slider"></span>
          </label>
        </div>
      </div>

      <!-- 多栏栏数手工指定控件 (2~6 栏) -->
      <div
        v-if="isColsHeaderLayout"
        style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding: 2px 0;"
      >
        <span style="font-size: 11px; opacity: 0.85; font-weight: 500;">栏数控制</span>
        <div class="spm-segmented-group" style="margin: 0; width: auto;">
          <button
            v-for="col in [2, 3, 4, 5, 6]"
            :key="col"
            class="spm-segmented-item"
            :class="{ active: detectedColumnsCount === col }"
            style="padding: 2px 10px; font-size: 11px;"
            @click="setColumnCount(col)"
          >
            {{ col }} 栏
          </button>
        </div>
      </div>

      <!-- 快捷芯片预设 -->
      <div class="spm-quick-chips">
        <button
          v-for="chip in currentRatioPresets"
          :key="chip.value"
          class="spm-chip"
          :class="{ active: isRatioActive(chip.value) }"
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

    <!-- 页面间距风格 (Spacing) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="覆盖本页内衬、内容间隙与正文行距"
          >
            <SlidesIcon name="ratio" />
            <span>页面间距</span>
          </div>
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

    <!-- 页面图片/分栏配图/头像 (Image) -->
    <div
      v-if="pageLayout === 'image-right' || pageLayout === 'image-left' || pageLayout === 'intro' || pageImage"
      class="spm-card-control"
    >
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            :aria-label="pageLayout === 'intro' ? '演讲者个人头像或形象照 URL / 资源路径' : '图文分栏或页面专属配图 URL / 资源路径'"
          >
            <SlidesIcon name="image" />
            <span>{{ pageLayout === 'intro' ? '头像与配图' : '页面图片' }}</span>
          </div>
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
        :placeholder="pageLayout === 'intro' ? '头像图片 URL 或思源本地图片路径 (如 assets/...)' : '网络图片 URL 或思源本地资源路径 (如 assets/...)'"
        @input="$emit('update:pageImage', ($event.target as HTMLInputElement).value)"
        @change="$emit('update:pageImage', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 分区：页面动效 -->
    <div class="spm-section-header" style="margin-top: 6px;">
      <span>页面动效</span>
    </div>

    <!-- 转场动效选择卡片 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="页面切换时的过渡转场动画效果"
          >
            <SlidesIcon name="transition" />
            <span>转场动效</span>
          </div>
        </div>
      </div>
      <TransitionSelector
        :model-value="pageTransition"
        hide-header
        @change="$emit('update:pageTransition', $event)"
      />
    </div>

    <!-- 页面动态蒙版 (Dynamic Mask) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="随着点击操作分段展露正文内容"
          >
            <SlidesIcon name="sparkles" />
            <span>页面动态蒙版</span>
          </div>
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

    <!-- 分区：其他配置 -->
    <div class="spm-section-header" style="margin-top: 6px;">
      <span>其他配置</span>
    </div>

    <!-- 演讲备忘提词 (Notes，正文备注块驱动) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="正文备注块驱动 · 仅演讲者视图可见"
          >
            <SlidesIcon name="presenter" />
            <span>演讲者提词</span>
          </div>
        </div>
        <div v-if="isFeatureEnabled('aiScript')" class="spm-notes-header-actions">
          <button
            type="button"
            class="spm-btn-primary b3-tooltips b3-tooltips__s"
            :class="{ 'is-loading': isGeneratingNotes }"
            :disabled="isGeneratingNotes"
            aria-label="AI 自动生成本页讲稿提示块"
            @click="$emit('generateNotes')"
          >
            <span v-if="isGeneratingNotes" class="spm-btn-spinner"></span>
            <SlidesIcon v-else name="sparkles" />
            <span>{{ isGeneratingNotes ? '提炼中...' : 'AI 讲稿' }}</span>
          </button>
          <button
            type="button"
            class="spm-btn-icon b3-tooltips b3-tooltips__w"
            aria-label="打开 AI 讲稿服务配置"
            @click="$emit('openSetting')"
          >
            <SlidesIcon name="settings" />
          </button>
        </div>
      </div>

      <!-- 提词状态与预览卡片 -->
      <div v-if="isGeneratingNotes" class="spm-note-loading-box">
        <div class="spm-loading-spinner"></div>
        <div class="spm-loading-text">
          <span class="spm-loading-title">AI 正在提炼本页演讲提词...</span>
          <span class="spm-loading-desc">根据幻灯片上下文智能编写口播要点，请稍候</span>
        </div>
      </div>

      <div v-else-if="pageNotes" class="spm-note-status-box">
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

    <!-- 快捷操作 (紧凑 2 列网格) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <span class="spm-control-title">快捷操作</span>
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
import { usePageMaskControls } from '@/ui/components/usePageMaskControls'
import { usePageColumnRatio } from '@/ui/components/usePageColumnRatio'

const props = defineProps<{
  pageLayout: string
  pageHeader?: boolean | string
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
  isGeneratingNotes?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:pageLayout', val: string): void
  (e: 'update:pageHeader', val: boolean): void
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
  (e: 'openSetting'): void
  (e: 'insertDividerAfter'): void
  (e: 'deleteDivider'): void
  (e: 'convertToSuperBlock'): void
}>()

// 蒙版领域逻辑抽离：时钟/线性形态判定与比例升降级联动由 usePageMaskControls 提供
const {
  maskRatioPresets,
  effectiveMaskRatio,
  selectClockMask,
  selectLinearMask,
  maskHelpTooltip,
} = usePageMaskControls(
  {
    pageMask: () => props.pageMask,
    pageMaskRatio: () => props.pageMaskRatio,
  },
  emit,
)

// 分栏比例领域逻辑抽离：栏数探测、手工指定与预设矩阵由 usePageColumnRatio 提供
const {
  isMultiColLayout,
  isColsHeaderLayout,
  effectivePageHeader,
  detectedColumnsCount,
  setColumnCount,
  isRatioActive,
  currentRatioPresets,
  onResetRatioToEqual,
} = usePageColumnRatio(
  {
    pageLayout: () => props.pageLayout,
    pageHeader: () => props.pageHeader,
    pageLayoutRatio: () => props.pageLayoutRatio,
    detectedSbRatio: () => props.detectedSbRatio,
    detectedSbInfo: () => props.detectedSbInfo,
  },
  emit,
)

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
.spm-notes-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.spm-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  border: 1px solid var(--b3-theme-primary);
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #ffffff);
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.4;

  .slides-icon,
  svg {
    width: 12px;
    height: 12px;
    color: currentColor;
  }

  &:hover:not(:disabled) {
    opacity: 0.92;
    box-shadow: 0 1px 4px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.35);
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:disabled,
  &.is-loading {
    opacity: 0.75;
    cursor: not-allowed;
  }
}

.spm-btn-spinner {
  width: 11px;
  height: 11px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spm-spin 0.8s linear infinite;
  display: inline-block;
  flex-shrink: 0;
}

.spm-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--b3-theme-on-surface);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--b3-theme-surface-lighter, rgba(0, 0, 0, 0.06));
    border-color: var(--b3-border-color);
    color: var(--b3-theme-primary);
  }

  .slides-icon,
  svg {
    width: 14px;
    height: 14px;
    color: currentColor;
  }
}

.spm-note-loading-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--b3-theme-surface-light, rgba(0, 0, 0, 0.03));
  border-radius: 6px;
  border: 1px dashed var(--b3-theme-primary);
  font-size: 12px;
}

.spm-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.2);
  border-top-color: var(--b3-theme-primary);
  border-radius: 50%;
  animation: spm-spin 0.8s cubic-bezier(0.5, 0.1, 0.4, 0.9) infinite;
  flex-shrink: 0;
}

.spm-loading-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.spm-loading-title {
  font-weight: 500;
  color: var(--b3-theme-primary);
  font-size: 12px;
}

.spm-loading-desc {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  line-height: 1.3;
}

@keyframes spm-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

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
