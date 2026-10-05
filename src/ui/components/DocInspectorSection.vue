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
            <SlidevIcon name="palette" />
            <span>幻灯片主题 (Theme)</span>
          </div>
          <span class="spm-control-desc">全局 Slidev 视觉设计范式</span>
        </div>
      </div>
      <div class="spm-segmented-group">
        <button
          class="spm-segmented-item"
          :class="{ active: docTheme === 'default' }"
          @click="$emit('update:docTheme', 'default')"
        >
          默认 default
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: docTheme === 'seriph' }"
          @click="$emit('update:docTheme', 'seriph')"
        >
          优雅 seriph
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: docTheme === 'apple-basic' }"
          @click="$emit('update:docTheme', 'apple-basic')"
        >
          极简 apple
        </button>
      </div>
    </div>

    <!-- 画幅比例 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="ratio" />
            <span>画幅比例 (Aspect Ratio)</span>
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

    <!-- 全局默认转场 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="transition" />
            <span>全局默认转场</span>
          </div>
          <span class="spm-control-desc">页面切换过渡动效</span>
        </div>
      </div>
      <div class="spm-quick-chips">
        <button
          v-for="trans in ['slide-left', 'fade', 'zoom', 'slide-up']"
          :key="trans"
          class="spm-chip"
          :class="{ active: docDefaultTransition === trans }"
          @click="$emit('update:docDefaultTransition', trans)"
        >
          {{ trans }}
        </button>
      </div>
    </div>

    <!-- 本地网络伺服预览 (Web Serve) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="external-link" />
            <span>本地网络伺服预览 (Web Serve)</span>
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

    <!-- 演示全局核心动作组 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <span class="spm-control-title">演示全局操作</span>
        </div>
      </div>
      <div class="spm-action-grid">
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="在当前文档下方开启分屏同步预览 (Alt+P)"
          @click="$emit('openBottomPreview')"
        >
          <SlidevIcon name="split-preview" />
          <span>分屏预览</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="打开双屏演讲者控制台视窗 (Alt+M)"
          @click="$emit('openPresenter')"
        >
          <SlidevIcon name="presenter" />
          <span>演讲者视图</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="智能分析长文本结构并给出大纲分页插入建议"
          @click="$emit('aiAutoSplit')"
        >
          <SlidevIcon name="sparkles" />
          <span>AI 智能分页</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="打包导出离线单文件 HTML 幻灯片"
          @click="$emit('exportHtml')"
        >
          <SlidevIcon name="export-html" />
          <span>导出 HTML</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="打印生成 16:9 高清演示 PDF 讲义"
          @click="$emit('exportPdf')"
        >
          <SlidevIcon name="export-pdf" />
          <span>导出 PDF</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'
import { globalSettingsState, setRuntimeSettings } from '@/settings'

const plugin = inject<any>('plugin')
const globalSettings = globalSettingsState

function onToggleWebServe(enabled: boolean) {
  setRuntimeSettings({ enableWebServeJump: enabled })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    plugin.saveGlobalSettings({ enableWebServeJump: enabled })
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

defineProps<{
  docTheme: string
  docAspectRatio: string
  docDefaultTransition: string
}>()

defineEmits<{
  (e: 'update:docTheme', val: string): void
  (e: 'update:docAspectRatio', val: string): void
  (e: 'update:docDefaultTransition', val: string): void
  (e: 'openBottomPreview'): void
  (e: 'openPresenter'): void
  (e: 'aiAutoSplit'): void
  (e: 'exportHtml'): void
  (e: 'exportPdf'): void
}>()
</script>
