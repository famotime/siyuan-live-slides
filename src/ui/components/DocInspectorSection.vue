<template>
  <div class="spm-section spm-section--doc">
    <div class="spm-section-header">
      <span>全局演示配置</span>
    </div>

    <!-- 主题切换 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="palette" />
            <span>幻灯片主题</span>
          </div>
          <span class="spm-control-desc">全局幻灯片视觉设计范式</span>
        </div>
      </div>
      <div class="spm-segmented-group">
        <button
          v-for="item in themeOptions"
          :key="item.value"
          class="spm-segmented-item b3-tooltips b3-tooltips__s"
          :class="{ active: docTheme === item.value }"
          :aria-label="item.desc"
          @click="$emit('update:docTheme', item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <!-- 演示背景 (Presentation Background) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="palette" />
            <span>演示背景</span>
          </div>
          <span class="spm-control-desc">全篇幻灯片统一底色、微渐变或壁纸</span>
        </div>
      </div>
      <div class="spm-quick-chips">
        <button
          v-for="bg in presetBackgrounds"
          :key="bg.value"
          class="spm-chip"
          :class="{ active: (docBackground || '') === bg.value }"
          @click="$emit('update:docBackground', bg.value)"
        >
          {{ bg.label }}
        </button>
      </div>
      <input
        :value="docBackground || ''"
        class="spm-input"
        placeholder="自定义颜色 (#1e1e24)、渐变或资源路径 (assets/...)"
        @input="$emit('update:docBackground', ($event.target as HTMLInputElement).value)"
        @change="$emit('update:docBackground', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 画幅比例 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="ratio" />
            <span>画幅比例</span>
          </div>
          <span class="spm-control-desc">演讲屏幕投影宽高比</span>
        </div>
      </div>
      <div class="spm-segmented-group">
        <button
          class="spm-segmented-item"
          :class="{ active: docAspectRatio === '16/9' }"
          @click="$emit('update:docAspectRatio', '16/9')"
        >
          16 : 9 (宽屏)
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: docAspectRatio === '4/3' }"
          @click="$emit('update:docAspectRatio', '4/3')"
        >
          4 : 3 (标屏)
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: docAspectRatio === '16/10' }"
          @click="$emit('update:docAspectRatio', '16/10')"
        >
          16 : 10
        </button>
      </div>
    </div>

    <!-- 间距风格 (Spacing) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="ratio" />
            <span>间距风格</span>
          </div>
          <span class="spm-control-desc">内边距与顶部标题下边距预设</span>
        </div>
      </div>
      <div class="spm-segmented-group">
        <button
          class="spm-segmented-item b3-tooltips b3-tooltips__se"
          :class="{ active: (docSpacing || 'normal') === 'compact' }"
          aria-label="紧凑排版：上下 20px / 左右 36px"
          @click="$emit('update:docSpacing', 'compact')"
        >
          紧凑
        </button>
        <button
          class="spm-segmented-item b3-tooltips b3-tooltips__s"
          :class="{ active: (docSpacing || 'normal') === 'normal' }"
          aria-label="标准排版：上下 32px / 左右 48px（推荐默认）"
          @click="$emit('update:docSpacing', 'normal')"
        >
          标准
        </button>
        <button
          class="spm-segmented-item b3-tooltips b3-tooltips__sw"
          :class="{ active: (docSpacing || 'normal') === 'loose' }"
          aria-label="宽松排版：上下 48px / 左右 56px"
          @click="$emit('update:docSpacing', 'loose')"
        >
          宽松
        </button>
      </div>
    </div>

    <!-- 全局默认转场 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="transition" />
            <span>全局默认转场</span>
          </div>
          <span class="spm-control-desc">页面切换过渡动效（未单设转场的页面将继承此动效）</span>
        </div>
      </div>
      <TransitionSelector
        :model-value="docDefaultTransition"
        :hide-header="true"
        @change="$emit('update:docDefaultTransition', $event)"
      />
    </div>

    <!-- 本地网络伺服预览 (Web Serve) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="external-link" />
            <span>本地网络伺服预览</span>
          </div>
          <span class="spm-control-desc">点击文档/块链接以 Webview 抽屉呈现，支持外跳</span>
        </div>
        <label
          class="spm-switch b3-tooltips b3-tooltips__w"
          :aria-label="globalSettings.enableWebServeJump ? '关闭本地网络伺服预览' : '开启本地网络伺服预览'"
        >
          <input
            type="checkbox"
            :checked="globalSettings.enableWebServeJump"
            @change="onToggleWebServe(($event.target as HTMLInputElement).checked)"
          />
          <span class="spm-switch-slider"></span>
        </label>
      </div>
      <div v-if="globalSettings.enableWebServeJump" class="spm-control-body" style="margin-top: 8px;">
        <input
          :value="globalSettings.webServeUrl"
          class="spm-input"
          placeholder="http://127.0.0.1:6806"
          spellcheck="false"
          @keydown.stop
          @keyup.stop
          @input="onWebServeUrlInput(($event.target as HTMLInputElement).value)"
          @change="onWebServeUrlChange(($event.target as HTMLInputElement).value)"
        />
        <span class="spm-control-desc" style="display: block; margin-top: 4px; font-size: 11px; opacity: 0.8;">
          默认伺服地址为 http://127.0.0.1:6806。开启后点击块链接将在 Webview 抽屉中打开，点击抽屉顶部『外跳』可在外部浏览器打开
        </span>
      </div>
    </div>

    <!-- 规范化特定标题大小 (Normalize Heading Sizes) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="type" />
            <span>固定特定标题大小</span>
          </div>
          <span class="spm-control-desc">除封面外页首标题按 H2、多栏内首标题按 H3 大小展示</span>
        </div>
        <label
          class="spm-switch b3-tooltips b3-tooltips__w"
          :aria-label="globalSettings.normalizeHeadingSizes ? '关闭固定特定标题大小' : '开启固定特定标题大小'"
        >
          <input
            type="checkbox"
            :checked="globalSettings.normalizeHeadingSizes"
            @change="onToggleNormalizeHeadings(($event.target as HTMLInputElement).checked)"
          />
          <span class="spm-switch-slider"></span>
        </label>
      </div>
    </div>

    <!-- 列表前缀标记 (List Markers) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidesIcon name="list" />
            <span>列表前缀标记</span>
          </div>
          <span class="spm-control-desc">分别控制正文中无序列表圆点与有序列表数字序号的呈现</span>
        </div>
      </div>
      <div class="spm-list-markers-toggles" style="display: flex; gap: 8px; margin-top: 8px;">
        <div
          class="spm-marker-toggle-item"
          style="flex: 1; display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--b3-theme-surface); border: 1px solid var(--b3-border-color); border-radius: 4px;"
        >
          <span style="font-size: 12px; color: var(--b3-theme-on-surface);">无序圆点</span>
          <label
            class="spm-switch b3-tooltips b3-tooltips__w"
            :aria-label="globalSettings.showUnorderedListMarkers ? '关闭无序列表圆点显示' : '开启无序列表圆点显示'"
          >
            <input
              type="checkbox"
              :checked="globalSettings.showUnorderedListMarkers"
              @change="onToggleUnorderedMarkers(($event.target as HTMLInputElement).checked)"
            />
            <span class="spm-switch-slider"></span>
          </label>
        </div>
        <div
          class="spm-marker-toggle-item"
          style="flex: 1; display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--b3-theme-surface); border: 1px solid var(--b3-border-color); border-radius: 4px;"
        >
          <span style="font-size: 12px; color: var(--b3-theme-on-surface);">有序序号</span>
          <label
            class="spm-switch b3-tooltips b3-tooltips__w"
            :aria-label="globalSettings.showOrderedListMarkers ? '关闭有序列表序号显示' : '开启有序列表序号显示'"
          >
            <input
              type="checkbox"
              :checked="globalSettings.showOrderedListMarkers"
              @change="onToggleOrderedMarkers(($event.target as HTMLInputElement).checked)"
            />
            <span class="spm-switch-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- 演示全局核心动作组 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <span class="spm-control-title">演示全局操作</span>
        </div>
      </div>
      <div class="spm-action-grid">
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="在当前文档下方开启分屏同步预览 (Alt+P)"
          @click="$emit('openBottomPreview')"
        >
          <SlidesIcon name="split-preview" />
          <span>分屏预览</span>
        </button>

        <!-- 演讲者视图（presenterMode 开关关闭时隐藏入口） -->
        <button
          v-if="isFeatureEnabled('presenterMode')"
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="打开双屏演讲者控制台视窗 (Alt+M)"
          @click="$emit('openPresenter')"
        >
          <SlidesIcon name="presenter" />
          <span>演讲者视图</span>
        </button>

        <!-- 识别讲稿块 -->
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="识别各页分隔线前未设属性的提示块/引用块为标准讲稿备注"
          :disabled="isBatchProcessing"
          @click="$emit('identifyNotes')"
        >
          <SlidesIcon name="notes" />
          <span>识别讲稿块</span>
        </button>

        <!-- 智能设置动效 -->
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="自动为正文各页标题及首块之外的后续内容块配置顺延 (+1) 逐步呈现动效"
          :disabled="isBatchProcessing"
          @click="$emit('autoAnimate')"
        >
          <SlidesIcon name="step" />
          <span>智能动效</span>
        </button>

        <button
          v-if="isFeatureEnabled('aiScript')"
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          aria-label="智能分析长文本大纲与篇幅，自动插入分页线"
          @click="$emit('aiAutoSplit')"
        >
          <SlidesIcon name="sparkles" />
          <span>智能分页</span>
        </button>

        <button
          v-if="isFeatureEnabled('aiScript')"
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="一键清除当前文档中的所有幻灯片分页线"
          @click="$emit('clearDividers')"
        >
          <SlidesIcon name="trash" />
          <span>清除分页</span>
        </button>

        <button
          v-if="isFeatureEnabled('exportHtml')"
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="打包导出离线单文件 HTML 幻灯片"
          @click="$emit('exportHtml')"
        >
          <SlidesIcon name="export-html" />
          <span>导出 HTML</span>
        </button>

        <button
          v-if="isFeatureEnabled('exportPdf')"
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          aria-label="打印生成 16:9 高清演示 PDF 讲义"
          @click="$emit('exportPdf')"
        >
          <SlidesIcon name="export-pdf" />
          <span>导出 PDF</span>
        </button>

        <button
          v-if="isFeatureEnabled('exportImage')"
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          :class="{ 'is-loading': isExportingImages }"
          :disabled="isExportingImages"
          :aria-label="isExportingImages ? '正在逐页导出高清图片包，请稍候...' : '逐页导出高清图片包 (ZIP)'"
          @click="$emit('exportImages')"
        >
          <SlidesIcon name="export-image" />
          <span>{{ isExportingImages ? '正在导出...' : '导出图片' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import TransitionSelector from '@/ui/components/TransitionSelector.vue'
import { globalSettingsState, setRuntimeSettings } from '@/settings'
import { isFeatureEnabled } from '@/feature-flags/feature-flags'

const plugin = inject<any>('plugin')
const globalSettings = globalSettingsState

const themeOptions = [
  {
    value: 'default',
    label: '默认 default',
    desc: '官方默认科技风：现代无衬线排版与清新代码语法高亮，通用汇报与技术分享首选',
  },
  {
    value: 'seriph',
    label: '优雅 seriph',
    desc: '典雅学术衬线风：书卷学术质感、衬线字体典雅庄重，适合学术论文、人文讲座与深度阅读',
  },
  {
    value: 'apple-basic',
    label: '极简 apple',
    desc: '苹果发布会极简风：大字号、高对比度与极致留白，适合产品发布、方案演讲与纯粹视觉呈现',
  },
]

function onToggleWebServe(enabled: boolean) {
  setRuntimeSettings({ enableWebServeJump: enabled })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    plugin.saveGlobalSettings({ enableWebServeJump: enabled })
  }
}

async function onToggleNormalizeHeadings(enabled: boolean) {
  setRuntimeSettings({ normalizeHeadingSizes: enabled })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    await plugin.saveGlobalSettings({ normalizeHeadingSizes: enabled })
  }
  if (plugin && typeof plugin.compileCurrentDocument === 'function') {
    plugin.compileCurrentDocument(plugin.currentDocId || plugin.getActiveDocumentId?.())
  }
}

async function onToggleUnorderedMarkers(enabled: boolean) {
  setRuntimeSettings({ showUnorderedListMarkers: enabled })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    await plugin.saveGlobalSettings({ showUnorderedListMarkers: enabled })
  }
  if (plugin && typeof plugin.compileCurrentDocument === 'function') {
    plugin.compileCurrentDocument(plugin.currentDocId || plugin.getActiveDocumentId?.())
  }
}

async function onToggleOrderedMarkers(enabled: boolean) {
  setRuntimeSettings({ showOrderedListMarkers: enabled })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    await plugin.saveGlobalSettings({ showOrderedListMarkers: enabled })
  }
  if (plugin && typeof plugin.compileCurrentDocument === 'function') {
    plugin.compileCurrentDocument(plugin.currentDocId || plugin.getActiveDocumentId?.())
  }
}

function onWebServeUrlInput(val: string) {
  setRuntimeSettings({ webServeUrl: val })
}

function onWebServeUrlChange(val: string) {
  setRuntimeSettings({ webServeUrl: val })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    plugin.saveGlobalSettings({ webServeUrl: val })
  }
}

const presetBackgrounds = [
  { label: '默认', value: '' },
  { label: '极简白', value: '#ffffff' },
  { label: '柔和灰', value: '#f8fafc' },
  { label: '暗黑 #1e1e24', value: '#1e1e24' },
  { label: '极夜 #0f172a', value: '#0f172a' },
  { label: '雅蓝渐变', value: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
  { label: '极光渐变', value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' },
  { label: '晨雾渐变', value: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' },
]

defineProps<{
  docTheme: string
  docBackground?: string
  docAspectRatio: string
  docDefaultTransition: string
  docSpacing?: string
  isExportingImages?: boolean
  isBatchProcessing?: boolean
}>()

defineEmits<{
  (e: 'update:docTheme', val: string): void
  (e: 'update:docBackground', val: string): void
  (e: 'update:docAspectRatio', val: string): void
  (e: 'update:docDefaultTransition', val: string): void
  (e: 'update:docSpacing', val: string): void
  (e: 'openBottomPreview'): void
  (e: 'openPresenter'): void
  (e: 'identifyNotes'): void
  (e: 'autoAnimate'): void
  (e: 'aiAutoSplit'): void
  (e: 'clearDividers'): void
  (e: 'exportHtml'): void
  (e: 'exportPdf'): void
  (e: 'exportImages'): void
}>()
</script>
