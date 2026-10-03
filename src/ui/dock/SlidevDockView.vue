<template>
  <div class="spm-slidev-dock">
    <!-- 顶栏工具栏 -->
    <div class="spm-slidev-dock__toolbar">
      <div class="spm-slidev-dock__title">
        <svg class="spm-slidev-dock__icon" aria-hidden="true">
          <use xlink:href="#iconSlidev"></use>
        </svg>
        <span>Slidev 演示</span>
      </div>

      <div class="spm-slidev-dock__actions">
        <button
          class="spm-btn-icon"
          :disabled="currentPage <= 1"
          title="上一页"
          @click="onPrevPage"
        >
          ◀
        </button>
        <span class="spm-page-badge">{{ currentPage }} / {{ totalPages || 1 }}</span>
        <button
          class="spm-btn-icon"
          :disabled="currentPage >= totalPages"
          title="下一页"
          @click="onNextPage"
        >
          ▶
        </button>
        <button
          class="spm-btn-icon"
          title="切换大纲缩略图"
          :class="{ active: showOutline }"
          @click="showOutline = !showOutline"
        >
          📑
        </button>
        <button
          class="spm-btn-icon"
          title="重新编译并刷新"
          @click="onRefresh"
        >
          🔄
        </button>
        <button
          class="spm-btn-icon"
          title="全屏放映"
          @click="onFullscreen"
        >
          ⛶
        </button>
      </div>
    </div>

    <!-- 演示沙箱容器 -->
    <div class="spm-slidev-dock__viewport">
      <iframe
        ref="sandboxIframeRef"
        class="spm-slidev-dock__iframe"
        :src="iframeSrc"
        frameborder="0"
        allow="fullscreen"
      ></iframe>
    </div>

    <!-- 底部大纲检查器 -->
    <SlideInspector
      v-if="showOutline && currentSlides.length > 0"
      :slides="currentSlides"
      :current-active-page="currentPage"
      @navigate="onNavigateOutline"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue'
import type { Plugin } from 'siyuan'
import { WebSandboxBridge } from '@/engine/web-sandbox-bridge'
import SlideInspector from '@/ui/components/SlideInspector.vue'
import { CursorTracker } from '@/sync/cursor-tracker'
import type { ISlidevDocument, ISlidevVirtualPage } from '@/types/slidev-protocol'

const plugin = inject<Plugin>('plugin')
const sandboxBridge = inject<WebSandboxBridge>('sandboxBridge', new WebSandboxBridge())
const cursorTracker = new CursorTracker(sandboxBridge)

const sandboxIframeRef = ref<HTMLIFrameElement | null>(null)
const currentPage = ref(1)
const totalPages = ref(1)
const currentSlides = ref<ISlidevVirtualPage[]>([])
const showOutline = ref(true)

// 动态计算插件静态沙箱路径
const iframeSrc = ref('/plugins/siyuan-slidev/slidev-client/index.html')

let unbindSlideChanged: (() => void) | null = null
let unbindBlockClicked: (() => void) | null = null

onMounted(() => {
  if (sandboxIframeRef.value) {
    sandboxBridge.attach(sandboxIframeRef.value)
  }

  unbindSlideChanged = sandboxBridge.onSlideChanged((page, total, blockId) => {
    currentPage.value = page
    totalPages.value = total
  })

  unbindBlockClicked = sandboxBridge.onBlockClicked((blockId, page) => {
    currentPage.value = page
    // 触发思源反向定位
    if (plugin) {
      plugin.eventBus.emit('slidev:block-clicked' as any, { blockId, page })
    }
  })
})

onUnmounted(() => {
  if (unbindSlideChanged) unbindSlideChanged()
  if (unbindBlockClicked) unbindBlockClicked()
  sandboxBridge.detach()
  cursorTracker.destroy()
})

function onPrevPage() {
  if (currentPage.value > 1) {
    sandboxBridge.navigatePage(currentPage.value - 1)
  }
}

function onNextPage() {
  if (currentPage.value < totalPages.value) {
    sandboxBridge.navigatePage(currentPage.value + 1)
  }
}

function onNavigateOutline(pageIndex: number) {
  currentPage.value = pageIndex
  sandboxBridge.navigatePage(pageIndex)
}

function onRefresh() {
  if (plugin) {
    plugin.eventBus.emit('slidev:request-compile' as any)
  }
}

function onFullscreen() {
  if (sandboxIframeRef.value) {
    if (sandboxIframeRef.value.requestFullscreen) {
      sandboxIframeRef.value.requestFullscreen().catch(() => {})
    }
  }
}

// 供父级调用的文档更新方法
defineExpose({
  updateDocument(doc: ISlidevDocument) {
    currentSlides.value = doc.slides
    totalPages.value = doc.slides.length
    cursorTracker.updateSlidesIndex(doc.slides)
    sandboxBridge.updateSlides(doc.slides, doc.config, doc.fullMarkdown)
  },
  navigateToBlock(blockId: string) {
    cursorTracker.onCursorFocusBlock(blockId)
  }
})
</script>

<style scoped>
.spm-slidev-dock {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--b3-theme-background, #ffffff);
  color: var(--b3-theme-on-background, #2c3e50);
  overflow: hidden;
}

.spm-slidev-dock__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--b3-theme-surface, #f8fafc);
  border-bottom: 1px solid var(--b3-border-color, #e2e8f0);
  font-size: 13px;
  min-height: 38px;
}

.spm-slidev-dock__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.spm-slidev-dock__icon {
  width: 16px;
  height: 16px;
}

.spm-slidev-dock__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spm-btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  color: var(--b3-theme-on-surface, #475569);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.spm-btn-icon:hover:not(:disabled) {
  background: var(--b3-theme-surface-hover, #e2e8f0);
}

.spm-btn-icon.active {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.spm-btn-icon:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.spm-page-badge {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  background: var(--b3-theme-background, #ffffff);
  border: 1px solid var(--b3-border-color, #cbd5e1);
}

.spm-slidev-dock__viewport {
  flex: 1;
  width: 100%;
  position: relative;
  background: #0f1115;
  min-height: 120px;
}

.spm-slidev-dock__iframe {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
