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
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :disabled="currentPage <= 1"
          aria-label="上一页"
          @click="onPrevPage"
        >
          <SlidevIcon name="chevron-left" />
        </button>
        <span class="spm-page-badge">{{ currentPage }} / {{ totalPages || 1 }}</span>
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :disabled="currentPage >= totalPages"
          aria-label="下一页"
          @click="onNextPage"
        >
          <SlidevIcon name="chevron-right" />
        </button>

        <!-- 📌 Pin 图钉锁定文档 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :class="{ 'is-primary': isPinned }"
          :aria-label="isPinned ? '已锁定当前文档（点击解除）：' + pinnedDocId : '点击锁定当前文档（不随主编辑区切换）'"
          @click="togglePin"
        >
          <SlidevIcon name="pin" />
          <span>{{ isPinned ? '已锁定' : '跟随' }}</span>
        </button>

        <!-- 🚀 双轨引擎切换徽章 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :class="{ 'is-primary': engineMode === 'pro-cli' }"
          :aria-label="engineMode === 'pro-cli' ? '当前：官方原生 Pro 模式 (localhost:' + activeProPort + ')，点击切回沙箱' : '当前：内置高保真沙箱，点击切换官方原生 Pro 模式'"
          @click="toggleEngineMode"
        >
          <SlidevIcon name="step" />
          <span>{{ engineMode === 'pro-cli' ? 'Pro (' + activeProPort + ')' : '沙箱' }}</span>
        </button>

        <span class="spm-toolbar-divider"></span>

        <!-- 大纲缩略图 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="切换幻灯片大纲抽屉"
          :class="{ 'is-primary': showOutline }"
          @click="showOutline = !showOutline"
        >
          <SlidevIcon name="outline" />
        </button>

        <!-- 双屏演讲者视图 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="双屏演讲者视图 (Presenter Mode ⌥M)"
          @click="onOpenPresenter"
        >
          <SlidevIcon name="presenter" />
        </button>

        <!-- 导出离线单文件 HTML -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="导出单文件 HTML 演示包"
          @click="onExportHtml"
        >
          <SlidevIcon name="export-html" />
        </button>

        <!-- 导出 PDF -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="导出 16:9 PDF 演示讲义"
          @click="onExportPdf"
        >
          <SlidevIcon name="export-pdf" />
        </button>

        <!-- 重新编译 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="重新编译并刷新"
          @click="onRefresh"
        >
          <SlidevIcon name="refresh" />
        </button>

        <!-- 全屏放映 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="全屏放映"
          @click="onFullscreen"
        >
          <SlidevIcon name="fullscreen" />
        </button>
      </div>
    </div>

    <!-- 演示沙箱容器与主视口（一体化全屏容器，沙箱与抽屉浮层同级挂载） -->
    <div
      ref="fullscreenContainerRef"
      class="spm-slidev-tab__viewport spm-slidev-fullscreen-container"
    >
      <iframe
        ref="sandboxIframeRef"
        class="spm-slidev-tab__iframe"
        :src="iframeSrc"
        frameborder="0"
        allow="fullscreen"
      ></iframe>

      <!-- 沉浸式浮层抽屉 -->
      <ImmersionDrawerContainer
        v-model:visible="isDrawerOpen"
        v-model:is-maximized="isDrawerMaximized"
        :title="drawerTitle"
        @close="onDrawerClose"
      >
        <!-- 思源 Protyle 速览轨 -->
        <ProtylePeekDrawer
          v-if="peekType === 'siyuan' && peekBlockId"
          :block-id="peekBlockId"
          :title="drawerTitle"
          :plugin="plugin!"
          @external-jump="onExternalJump"
        />

        <!-- Web 外部链接速览轨 (受控微型浏览器，常驻 DOM 懒加载，杜绝卸载时 Electron guestInstanceId 异常) -->
        <WebviewPeekDrawer
          v-if="hasOpenedWeb"
          v-show="peekType === 'web'"
          :visible="isDrawerOpen && peekType === 'web'"
          :url="peekUrl"
          :title="drawerTitle"
          @external-jump="onExternalJump"
        />
      </ImmersionDrawerContainer>
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
import { putFile, sql } from '@/api'
import { EngineManager } from '@/engine/engine-manager'
import { WebSandboxBridge } from '@/engine/web-sandbox-bridge'
import type { IOpenPeekDrawerDetail } from '@/engine/web-sandbox-bridge'
import SlideInspector from '@/ui/components/SlideInspector.vue'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'
import ImmersionDrawerContainer from '@/ui/components/peek/ImmersionDrawerContainer.vue'
import ProtylePeekDrawer from '@/ui/components/peek/ProtylePeekDrawer.vue'
import WebviewPeekDrawer from '@/ui/components/peek/WebviewPeekDrawer.vue'
import { CursorTracker } from '@/sync/cursor-tracker'
import { mirrorBlockSelection } from '@/sync/selection-mirror'
import { buildStandaloneHtml, downloadHtmlFile } from '@/export/single-html-exporter'
import { triggerPdfExport } from '@/export/pdf-exporter'
import { getRuntimeSettings, buildSiYuanWebUrl } from '@/settings'
import type { ISlidevDocument, ISlidevVirtualPage } from '@/types/slidev-protocol'

const plugin = inject<Plugin>('plugin')
const sandboxBridge = inject<WebSandboxBridge>('sandboxBridge', new WebSandboxBridge())
const cursorTracker = new CursorTracker(sandboxBridge)
const engineManager = new EngineManager()

const engineMode = ref<'web-sandbox' | 'pro-cli'>('web-sandbox')
const activeProPort = ref(3030)

const fullscreenContainerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const sandboxIframeRef = ref<HTMLIFrameElement | null>(null)
const currentPage = ref(1)
const totalPages = ref(1)
const currentSlides = ref<ISlidevVirtualPage[]>([])
const showOutline = ref(false)

// 沉浸式速览抽屉状态
const isDrawerOpen = ref(false)
const isDrawerMaximized = ref(false)
const peekType = ref<'siyuan' | 'web'>('siyuan')
const peekBlockId = ref('')
const peekUrl = ref('')
const drawerTitle = ref('')
const hasOpenedWeb = ref(false)

// Pin 图钉锁定状态
const isPinned = ref(false)
const pinnedDocId = ref('')

const iframeSrc = ref('/plugins/siyuan-slidev/slidev-client/index.html')

let unbindSlideChanged: (() => void) | null = null
let unbindBlockClicked: (() => void) | null = null
let unbindOpenInEditor: (() => void) | null = null
let unbindNativePageChanged: (() => void) | null = null
let unbindOpenPeekDrawer: (() => void) | null = null
let unbindToggleFullscreen: (() => void) | null = null
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
    cursorTracker.setActiveBlockId(blockId)
    if (plugin && typeof (plugin as any).handleBlockClickedFromSlide === 'function') {
      ;(plugin as any).handleBlockClickedFromSlide(blockId, page)
    } else {
      mirrorBlockSelection(blockId, (plugin as any)?.app)
    }
  })

  unbindOpenInEditor = sandboxBridge.onOpenInEditor((blockId, page) => {
    currentPage.value = page
    cursorTracker.setActiveBlockId(blockId)
    mirrorBlockSelection(blockId, (plugin as any)?.app)
  })

  unbindNativePageChanged = engineManager.nativeBridge.onPageChanged((page, total) => {
    currentPage.value = page
    totalPages.value = total
  })

  unbindOpenPeekDrawer = sandboxBridge.onOpenPeekDrawer(async (detail: IOpenPeekDrawerDetail) => {
    const settings = getRuntimeSettings()
    if (detail.peekType === 'siyuan' && settings.enableWebServeJump) {
      // 检测目标是否为文档块（非文档块需要追加 &focus=1 参数）
      let isDoc = false
      if (latestDoc && latestDoc.docId === detail.target) {
        isDoc = true
      } else if (latestDoc && latestDoc.slides && latestDoc.slides.some(s => s.blocks?.some(b => b.id === detail.target))) {
        isDoc = false
      } else {
        try {
          const rows = await sql(`SELECT id, root_id, type FROM blocks WHERE id = '${detail.target}' LIMIT 1`)
          if (rows && rows.length > 0) {
            isDoc = rows[0].type === 'd' || rows[0].id === rows[0].root_id
          }
        } catch (err) {
          console.warn('[SlidevPreviewTab] detect block type failed:', err)
        }
      }

      peekType.value = 'web'
      hasOpenedWeb.value = true
      peekUrl.value = buildSiYuanWebUrl(settings.webServeUrl, detail.target, {
        focus: !isDoc,
      })
      drawerTitle.value = detail.title || `${isDoc ? '思源文档' : '思源块'}: ${detail.target.slice(0, 8)}`
      isDrawerOpen.value = true
      sandboxBridge.freezeKeyboardNav(true)
    } else {
      peekType.value = detail.peekType
      if (detail.peekType === 'siyuan') {
        peekBlockId.value = detail.target
        drawerTitle.value = detail.title || `块速览: ${detail.target.slice(0, 8)}`
      } else {
        hasOpenedWeb.value = true
        peekUrl.value = detail.target
        drawerTitle.value = detail.title || detail.target
      }
      isDrawerOpen.value = true
      sandboxBridge.freezeKeyboardNav(true)
    }
  })

  unbindToggleFullscreen = sandboxBridge.onRequestToggleFullscreen(() => {
    onFullscreen()
  })

  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', onFullscreenChange)
  }
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
  }
  if (unbindOpenPeekDrawer) unbindOpenPeekDrawer()
  if (unbindToggleFullscreen) unbindToggleFullscreen()
  if (unbindSlideChanged) unbindSlideChanged()
  if (unbindBlockClicked) unbindBlockClicked()
  if (unbindOpenInEditor) unbindOpenInEditor()
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
    onRefresh()
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
  if (plugin && typeof (plugin as any).compileCurrentDocument === 'function') {
    ;(plugin as any).compileCurrentDocument()
  } else if (plugin?.eventBus && typeof (plugin.eventBus as any).emit === 'function') {
    ;(plugin.eventBus as any).emit('slidev:request-compile' as any)
  }
}

function onDrawerClose() {
  isDrawerOpen.value = false
  sandboxBridge.freezeKeyboardNav(false)
}

function onExternalJump() {
  // 外跳至系统默认浏览器后，自动收起当前速览抽屉，同时保持全屏放映
  onDrawerClose()
}

function onFullscreenChange() {
  if (typeof document !== 'undefined') {
    isFullscreen.value = !!document.fullscreenElement
    sandboxBridge.postMessage('FULLSCREEN_CHANGED', { isFullscreen: isFullscreen.value })
  }
}

function onFullscreen() {
  const target = fullscreenContainerRef.value || sandboxIframeRef.value
  if (target) {
    if (!document.fullscreenElement) {
      target.requestFullscreen().then(() => {
        sandboxBridge.postMessage('FULLSCREEN_CHANGED', { isFullscreen: true })
      }).catch(() => {})
    } else {
      document.exitFullscreen().then(() => {
        sandboxBridge.postMessage('FULLSCREEN_CHANGED', { isFullscreen: false })
      }).catch(() => {})
    }
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
    cursorTracker.setDocId(doc.docId)
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

<style lang="scss" scoped>
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

.spm-web-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: var(--b3-theme-background, #ffffff);

  &__box {
    text-align: center;
    max-width: 480px;
    padding: 24px;
    border-radius: 8px;
    border: 1px dashed var(--b3-border-color, #e2e8f0);
    background: var(--b3-theme-surface, #f8fafc);

    p {
      font-size: 13px;
      color: var(--b3-theme-on-surface, #64748b);
      margin-bottom: 8px;
    }

    a {
      color: var(--b3-theme-primary, #3b82f6);
      word-break: break-all;
      text-decoration: underline;
    }
  }
}
</style>
