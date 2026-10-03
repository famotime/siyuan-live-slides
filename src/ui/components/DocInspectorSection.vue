<template>
  <div class="spm-section spm-section--doc">
    <div class="spm-section-header">
      <span>全局演示配置</span>
      <span class="spm-section-sub">当前文档级 Slidev 参数</span>
    </div>

    <!-- 主题切换 -->
    <div class="spm-card-control">
      <div class="spm-control-title">
        <span>🎨 幻灯片主题 (Theme)</span>
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
      <div class="spm-control-title">
        <span>📐 画幅比例 (Aspect Ratio)</span>
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
      <div class="spm-control-title">
        <span>↔ 全局默认转场</span>
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

    <!-- 全局快捷操作 -->
    <div class="spm-action-group">
      <div class="spm-action-group-title">演示全局操作</div>
      <div class="spm-action-buttons">
        <button class="spm-btn-action spm-btn-primary" @click="$emit('openBottomPreview')">
          🖥️ 在下方分屏打开预览 (Alt+P)
        </button>
        <button class="spm-btn-action" @click="$emit('openPresenter')">
          🎤 打开双屏演讲者控制台 (Alt+M)
        </button>
        <button class="spm-btn-action" @click="$emit('aiAutoSplit')">
          🤖 AI 智能大纲断页建议
        </button>
        <button class="spm-btn-action" @click="$emit('exportHtml')">
          📥 导出单文件 HTML
        </button>
        <button class="spm-btn-action" @click="$emit('exportPdf')">
          🖨️ 导出 PDF 讲义
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
