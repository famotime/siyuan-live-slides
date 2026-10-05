<template>
  <div
    v-show="visible"
    class="spm-immersion-container"
    :class="{ 'is-maximized': isMaximized }"
    @keydown.stop="onKeyDown"
  >
    <!-- 暗色背景遮罩 -->
    <div
      class="spm-immersion-mask"
      @click="handleMaskClick"
    />

    <!-- 右侧滑出抽屉本体 -->
    <div
      class="spm-immersion-drawer"
      :class="{ 'is-maximized': isMaximized }"
    >
      <!-- 抽屉顶部通用控制条 -->
      <div class="spm-immersion-header">
        <div class="spm-immersion-header__left">
          <slot name="header-left">
            <span class="spm-immersion-title">{{ title }}</span>
          </slot>
        </div>

        <div class="spm-immersion-header__center">
          <slot name="header-center" />
        </div>

        <div class="spm-immersion-header__actions">
          <slot name="header-actions" />

          <!-- 最大化 / 还原切换 -->
          <button
            class="spm-icon-btn b3-tooltips b3-tooltips__s"
            :aria-label="isMaximized ? '还原抽屉宽度 (70%)' : '最大化填满视口 (100%)'"
            @click="toggleMaximize"
          >
            <SlidevIcon :name="isMaximized ? 'minimize' : 'maximize'" />
          </button>

          <!-- 关闭抽屉 -->
          <button
            class="spm-icon-btn b3-tooltips b3-tooltips__s"
            aria-label="关闭速览 (ESC)"
            @click="handleClose"
          >
            <SlidevIcon name="close" />
          </button>
        </div>
      </div>

      <!-- 抽屉内容插槽 -->
      <div class="spm-immersion-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SlidevIcon from '@/ui/components/SlidevIcon.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    isMaximized?: boolean
    title?: string
    closeOnClickMask?: boolean
  }>(),
  {
    visible: false,
    isMaximized: false,
    title: '速览',
    closeOnClickMask: true,
  }
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:isMaximized', value: boolean): void
  (e: 'close'): void
  (e: 'toggle-maximize'): void
}>()

function handleClose() {
  emit('update:visible', false)
  emit('close')
}

function handleMaskClick() {
  if (props.closeOnClickMask) {
    handleClose()
  }
}

function toggleMaximize() {
  emit('update:isMaximized', !props.isMaximized)
  emit('toggle-maximize')
}

function onKeyDown(e: KeyboardEvent) {
  // 阻止常见快捷键冒泡触发幻灯片翻页
  if (
    e.key === ' ' ||
    e.key === 'ArrowLeft' ||
    e.key === 'ArrowRight' ||
    e.key === 'PageUp' ||
    e.key === 'PageDown'
  ) {
    e.stopPropagation()
  }
  // 按 ESC 优先关闭抽屉并阻止继续冒泡（防止退出全屏）
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    handleClose()
  }
}
</script>

<style lang="scss" scoped>
.spm-immersion-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  overflow: hidden;
  display: flex;
  pointer-events: auto;
}

.spm-immersion-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  z-index: 1;
  transition: opacity 0.25s ease;
}

.spm-immersion-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 70%;
  max-width: 100%;
  background: var(--b3-theme-background, #ffffff);
  color: var(--b3-theme-on-background, #2c3e50);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.35);
  z-index: 2;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid var(--b3-border-color, #e2e8f0);
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s ease;

  &.is-maximized {
    width: 100%;
    border-left: none;
  }
}

.spm-immersion-header {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--b3-theme-surface, #f8fafc);
  border-bottom: 1px solid var(--b3-border-color, #e2e8f0);
  flex-shrink: 0;
  gap: 8px;

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  &__center {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
}

.spm-immersion-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spm-immersion-body {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
