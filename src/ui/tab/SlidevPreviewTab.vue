<template>
  <div class="spm-slidev-preview-tab">
    <!-- 顶栏工具条 -->
    <div class="spm-slidev-tab__toolbar">
      <div class="spm-slidev-tab__title">
        <svg class="spm-slidev-tab__icon" aria-hidden="true">
          <use xlink:href="#iconSlidev"></use>
        </svg>
        <span>Slidev 演示预览</span>
      </div>

      <div class="spm-slidev-tab__actions">
        <!-- 翻页控制 -->
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

        <!-- 📌 Pin 图钉锁定文档 -->
        <button
          class="spm-btn-icon spm-pin-btn"
          :class="{ active: isPinned }"
          :title="isPinned ? '已锁定当前文档（切换笔记不跟随）：' + pinnedDocId : '未锁定：切换笔记自动跟随主编辑区'"
          @click="togglePin"
        >
          <span v-if="isPinned">📌 已锁定</span>
          <span v-else>📍 跟随</span>
        </button>

        <!-- 🚀 双轨引擎切换徽章 -->
        <button
          class="spm-btn-icon spm-engine-badge"
          :class="{ 'is-pro': engineMode === 'pro-cli' }"
          :title="engineMode === 'pro-cli' ? '当前：官方原生 Pro 模式 (localhost:' + activeProPort + ')，点击切回内置高保真沙箱' : '当前：内置高保真沙箱 (0依赖)，点击切换至官方原生 Pro 模式'"
          @click="toggleEngineMode"
        >
          <span v-if="engineMode === 'pro-cli'">🚀 Pro ({{ activeProPort }})</span>
          <span v-else>🟢 高保真沙箱</span>
        </button>

        <span class="spm-toolbar-divider"></span>

        <!-- 大纲缩略图 -->
        <button
          class="spm-btn-icon"
          title="切换幻灯片大纲抽屉"
          :class="{ active: showOutline }"
          @click="showOutline = !showOutline"
        >
          📑
        </button>

        <!-- 双屏演讲者视图 -->
        <button
          class="spm-btn-icon"
          title="双屏演讲者视图 (Presenter Mode ⌥M)"
          @click="onOpenPresenter"
        >
          🎤
        </button>

        <!-- 导出离线单文件 HTML -->
        <button
          class="spm-btn-icon"
          title="导出单文件 HTML"
          @click="onExportHtml"
        >
          📥
        </button>

        <!-- 导出 PDF -->
        <button
          class="spm-btn-icon"
          title="导出 PDF 讲义"
          @click="onExportPdf"
        >
          🖨️
        </button>

        <!-- 重新编译 -->
        <button
          class="spm-btn-icon"
          title="重新编译并刷新"
          @click="onRefresh"
        >
          🔄
        </button>

        <!-- 全屏放映 -->
        <button
          class="spm-btn-icon"
          title="全屏放映"
          @click="onFullscreen"
        >
          ⛶
        </button>
      </div>
    </div>

    <!-- 演示沙箱容器与主视口 -->
    <div class="spm-slidev-tab__viewport">
      <iframe
        ref="sandboxIframeRef"
        class="spm-slidev-tab__iframe"
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
      @refresh="onRefresh"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue'
import type { Plugin } from 'siyuan'
import { showMessage } from 'siyuan'
import { putFile } from '@/api'
import { EngineManager } from '@/engine/engine-manager'
import { WebSandboxBridge } from '@/engine/web-sandbox-bridge'
import SlideInspector from '@/ui/components/SlideInspector.vue'
import { CursorTracker } from '@/sync/cursor-tracker'
import { buildStandaloneHtml, downloadHtmlFile } from '@/export/single-html-exporter'
import { triggerPdfExport } from '@/export/pdf-exporter'
import type { ISlidevDocument, ISlidevVirtualPage } from '@/types/slidev-protocol'

const plugin = inject<Plugin>('plugin')
const sandboxBridge = inject<WebSandboxBridge>('sandboxBridge', new WebSandboxBridge())
const cursorTracker = new CursorTracker(sandboxBridge)
const engineManager = new EngineManager()

const engineMode = ref<'web-sandbox' | 'pro-cli'>('web-sandbox')
const activeProPort = ref(3030)

const sandboxIframeRef = ref<HTMLIFrameElement | null>(null)
const currentPage = ref(1)
const totalPages = ref(1)
const currentSlides = ref<ISlidevVirtualPage[]>([])
const showOutline = ref(false)

// Pin 图钉锁定状态
const isPinned = ref(false)
const pinnedDocId = ref('')

const iframeSrc = ref('/plugins/siyuan-slidev/slidev-client/index.html')

let unbindSlideChanged: (() => void) | null = null
let unbindBlockClicked: (() => void) | null = null
let unbindNativePageChanged: (() => void) | null = null
let latestDoc: ISlidevDocument | null = null

onMounted(() => {
  if (sandboxIframeRef.value) {
    sandboxBridge.attach(sandboxIframeRef.value)
    engineManager.nativeBridge.attach(sandboxIframeRef.value)
  }

  unbindSlideChanged = sandboxBridge.onSlideChanged((page, total) => {
    currentPage.value = page
    totalPages.value = total
  })

  unbindBlockClicked = sandboxBridge.onBlockClicked((blockId, page) => {
    currentPage.value = page
    if (plugin) {
      plugin.eventBus.emit('slidev:block-clicked' as any, { blockId, page })
    }
  })

  unbindNativePageChanged = engineManager.nativeBridge.onPageChanged((page, total) => {
    currentPage.value = page
    totalPages.value = total
  })
})

onUnmounted(() => {
  if (unbindSlideChanged) unbindSlideChanged()
  if (unbindBlockClicked) unbindBlockClicked()
  if (unbindNativePageChanged) unbindNativePageChanged()
  sandboxBridge.detach()
  cursorTracker.destroy()
  engineManager.destroy()
})

async function toggleEngineMode() {
  if (engineMode.value === 'web-sandbox') {
    if (!latestDoc) {
      showMessage('请先在主编辑区打开演示文档')
      return
    }
    showMessage('正在探测本地 Node 环境并编排 Slidev Pro 进程...')
    const res = await engineManager.startProMode(latestDoc, putFile)
    if (!res.success) {
      showMessage(`无法启动官方 Pro 模式：${res.error}`)
      return
    }
    engineMode.value = 'pro-cli'
    activeProPort.value = res.port || 3030
    iframeSrc.value = res.url
    if (sandboxIframeRef.value) {
      engineManager.nativeBridge.attach(sandboxIframeRef.value)
    }
    showMessage(`🟢 已成功接入官方原生 Slidev 服务 (端口: ${activeProPort.value})`)
  } else {
    engineManager.stopProMode()
    engineMode.value = 'web-sandbox'
    iframeSrc.value = '/plugins/siyuan-slidev/slidev-client/index.html'
    if (sandboxIframeRef.value) {
      sandboxBridge.attach(sandboxIframeRef.value)
    }
    showMessage('已切回内置高保真沙箱')
  }
}

function togglePin() {
  isPinned.value = !isPinned.value
  if (isPinned.value) {
    pinnedDocId.value = latestDoc?.docId || ''
  } else {
    pinnedDocId.value = ''
    if (plugin) {
      plugin.eventBus.emit('slidev:request-compile' as any)
    }
  }
}

function onPrevPage() {
  if (currentPage.value > 1) {
    if (engineMode.value === 'pro-cli') {
      engineManager.nativeBridge.navigateToPage(currentPage.value - 1)
    } else {
      sandboxBridge.navigatePage(currentPage.value - 1)
    }
  }
}

function onNextPage() {
  if (currentPage.value < totalPages.value) {
    if (engineMode.value === 'pro-cli') {
      engineManager.nativeBridge.navigateToPage(currentPage.value + 1)
    } else {
      sandboxBridge.navigatePage(currentPage.value + 1)
    }
  }
}

function onNavigateOutline(pageIndex: number) {
  currentPage.value = pageIndex
  if (engineMode.value === 'pro-cli') {
    engineManager.nativeBridge.navigateToPage(pageIndex)
  } else {
    sandboxBridge.navigatePage(pageIndex)
  }
}

function onRefresh() {
  if (plugin) {
    plugin.eventBus.emit('slidev:request-compile' as any)
  }
}

function onFullscreen() {
  if (sandboxIframeRef.value && sandboxIframeRef.value.requestFullscreen) {
    sandboxIframeRef.value.requestFullscreen().catch(() => {})
  }
}

function onOpenPresenter() {
  window.open('/plugins/siyuan-slidev/slidev-client/presenter.html', 'SlidevPresenter', 'width=1200,height=800')
}

function onExportHtml() {
  if (!latestDoc) {
    showMessage('请先在主编辑区打开幻灯片文档')
    return
  }
  const html = buildStandaloneHtml(latestDoc)
  const ok = downloadHtmlFile('presentation.html', html)
  if (ok) {
    showMessage('已开始下载单文件离线 HTML 演示包')
  }
}

function onExportPdf() {
  if (!latestDoc) {
    showMessage('请先在主编辑区打开幻灯片文档')
    return
  }
  const ok = triggerPdfExport(latestDoc)
  if (ok) {
    showMessage('已唤起打印视窗，请在打印选项中选择「另存为 PDF」')
  }
}

defineExpose({
  updateDocument(doc: ISlidevDocument, targetDocId?: string) {
    // 若已锁定且目标文档不匹配，则忽略
    if (isPinned.value && pinnedDocId.value && targetDocId && targetDocId !== pinnedDocId.value) {
      return
    }

    latestDoc = doc
    if (isPinned.value && !pinnedDocId.value) {
      pinnedDocId.value = doc.docId
    }

    currentSlides.value = doc.slides
    totalPages.value = doc.slides.length
    cursorTracker.updateSlidesIndex(doc.slides)
    if (engineMode.value === 'pro-cli') {
      engineManager.scaffolder.scaffold(doc, putFile).catch(() => {})
    } else {
      sandboxBridge.updateSlides(doc.slides, doc.config, doc.fullMarkdown)
    }
  },
  navigateToBlock(blockId: string) {
    cursorTracker.onCursorFocusBlock(blockId)
  },
  isPinned,
  pinnedDocId,
  engineMode,
  toggleEngineMode,
})
</script>

<style scoped>
.spm-slidev-preview-tab {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--b3-theme-background, #ffffff);
  color: var(--b3-theme-on-background, #2c3e50);
  overflow: hidden;
  box-sizing: border-box;
}

.spm-slidev-tab__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  background: var(--b3-theme-surface, #f8fafc);
  border-bottom: 1px solid var(--b3-border-color, #e2e8f0);
  font-size: 13px;
  min-height: 36px;
  flex-shrink: 0;
}

.spm-slidev-tab__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #334155);
}

.spm-slidev-tab__icon {
  width: 16px;
  height: 16px;
}

.spm-slidev-tab__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spm-page-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--b3-theme-background, #ffffff);
  border: 1px solid var(--b3-border-color, #e2e8f0);
  border-radius: 12px;
  color: var(--b3-theme-on-surface, #64748b);
  min-width: 44px;
  text-align: center;
}

.spm-btn-icon {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 3px 6px;
  cursor: pointer;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface, #475569);
  transition: all 0.15s ease;
}

.spm-btn-icon:hover:not(:disabled) {
  background: var(--b3-theme-surface-hover, #e2e8f0);
  border-color: var(--b3-border-color, #cbd5e1);
}

.spm-btn-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.spm-btn-icon.active {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  border-color: #3b82f6;
}

.spm-pin-btn {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid var(--b3-border-color, #e2e8f0);
  background: var(--b3-theme-background, #ffffff);
}

.spm-pin-btn.active {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border-color: #ef4444;
}

.spm-engine-badge {
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid rgba(16, 185, 129, 0.25);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.spm-engine-badge.is-pro {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.35);
}

.spm-toolbar-divider {
  width: 1px;
  height: 16px;
  background: var(--b3-border-color, #e2e8f0);
  margin: 0 4px;
}

.spm-slidev-tab__viewport {
  flex: 1;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0f172a;
}

.spm-slidev-tab__iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
</style>
