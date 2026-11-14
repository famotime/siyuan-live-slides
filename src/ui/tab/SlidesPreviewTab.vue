<template>
  <div class="spm-slides-preview-tab" @keydown="onTabKeydown">
    <!-- 顶栏工具条：左右分栏，去除冗余标题文本 -->
    <div class="spm-slides-tab__toolbar">
      <!-- 左侧：翻页导航与状态控制 -->
      <div class="spm-slides-tab__nav">
        <!-- 翻页控制 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :disabled="currentPage <= 1"
          aria-label="上一页"
          @click="onPrevPage"
        >
          <SlidesIcon name="chevron-left" />
        </button>
        <span class="spm-page-badge">{{ currentPage }} / {{ totalPages || 1 }}</span>
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :disabled="currentPage >= totalPages"
          aria-label="下一页"
          @click="onNextPage"
        >
          <SlidesIcon name="chevron-right" />
        </button>

        <!-- 📌 Pin 图钉锁定文档 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :class="{ 'is-primary': isPinned }"
          :aria-label="isPinned ? '已锁定当前文档（点击解除）：' + pinnedDocId : '点击锁定当前文档（不随主编辑区切换）'"
          @click="togglePin"
        >
          <SlidesIcon name="pin" />
          <span>{{ isPinned ? '已锁定' : '跟随' }}</span>
        </button>
      </div>

      <!-- 右侧：全局演示工具操作 -->
      <div class="spm-slides-tab__tools">
        <!-- 缩略图总览 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="缩略图总览 (O)"
          @click="onToggleOverview"
        >
          <SlidesIcon name="layout-grid" />
        </button>

        <!-- 双屏演讲者视图（presenterMode 开关关闭时隐藏入口） -->
        <button
          v-if="isFeatureEnabled('presenterMode')"
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="双屏演讲者视图 (Presenter Mode ⌥M)"
          @click="onOpenPresenter"
        >
          <SlidesIcon name="presenter" />
        </button>

        <!-- 导出离线单文件 HTML（exportHtml 开关关闭时隐藏入口） -->
        <button
          v-if="isFeatureEnabled('exportHtml')"
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="导出单文件 HTML 演示包"
          @click="onExportHtml"
        >
          <SlidesIcon name="export-html" />
        </button>

        <!-- 导出 PDF（exportPdf 开关关闭时隐藏入口） -->
        <button
          v-if="isFeatureEnabled('exportPdf')"
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="导出 16:9 PDF 演示讲义"
          @click="onExportPdf"
        >
          <SlidesIcon name="export-pdf" />
        </button>

        <!-- 导出图片（exportImage 开关关闭时隐藏入口） -->
        <div
          v-if="isFeatureEnabled('exportImage')"
          class="spm-export-image-dropdown"
          style="position: relative; display: inline-flex; align-items: center;"
        >
          <button
            class="spm-icon-btn b3-tooltips b3-tooltips__s"
            aria-label="导出幻灯片为图片包 (ZIP)"
            @click="onExportAllImages"
          >
            <SlidesIcon name="export-image" />
          </button>
          <button
            class="spm-icon-btn b3-tooltips b3-tooltips__s"
            style="padding: 2px 2px; margin-left: -4px;"
            aria-label="更多图片导出选项"
            @click.stop="showImageExportMenu = !showImageExportMenu"
          >
            <SlidesIcon name="chevron-down" />
          </button>
          <div
            v-if="showImageExportMenu"
            class="b3-menu b3-menu--context"
            style="position: absolute; top: calc(100% + 4px); right: 0; z-index: 100; min-width: 190px; box-shadow: var(--b3-point-shadow); border-radius: 4px; background: var(--b3-theme-surface);"
          >
            <button class="b3-menu__item" @click="onExportAllImages(); showImageExportMenu = false">
              <span class="b3-menu__label">📦 导出全篇为图片包 (ZIP)</span>
            </button>
            <button class="b3-menu__item" @click="onExportCurrentSlide(); showImageExportMenu = false">
              <span class="b3-menu__label">🖼️ 导出当前页为图片 (PNG)</span>
            </button>
            <button class="b3-menu__item" @click="onCopyCurrentSlide(); showImageExportMenu = false">
              <span class="b3-menu__label">📋 复制当前页至剪贴板</span>
            </button>
          </div>
        </div>

        <!-- 重新编译 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="重新编译并刷新"
          @click="onRefresh"
        >
          <SlidesIcon name="refresh" />
        </button>

        <!-- 全屏放映（强调突出主操作） -->
        <button
          class="spm-icon-btn is-primary spm-btn-fullscreen b3-tooltips b3-tooltips__s"
          aria-label="全屏放映"
          @click="onFullscreen"
        >
          <SlidesIcon name="fullscreen" />
          <span class="spm-btn-fullscreen__label">全屏放映</span>
        </button>
      </div>
    </div>

    <!-- 演示沙箱容器与主视口（一体化全屏容器，沙箱与抽屉浮层同级挂载） -->
    <div
      ref="fullscreenContainerRef"
      class="spm-slides-tab__viewport spm-slides-fullscreen-container"
      @wheel="onViewportWheel"
    >
      <iframe
        ref="sandboxIframeRef"
        class="spm-slides-tab__iframe"
        :src="iframeSrc"
        frameborder="0"
        allow="fullscreen; autoplay"
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

      <!-- 「数字+回车」跳页输入角标：页签聚焦（iframe 未聚焦）时敲数字实时显示，回车跳转 -->
      <div
        v-show="jumpDisplay"
        class="spm-jump-badge"
        :class="{ 'is-invalid': jumpInvalid }"
      >{{ jumpDisplay }}</div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue'
import type { Plugin } from 'siyuan'
import { showMessage } from 'siyuan'
import { sql } from '@/api'
import { WebSandboxBridge } from '@/engine/web-sandbox-bridge'
import type { IOpenPeekDrawerDetail } from '@/engine/web-sandbox-bridge'
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import ImmersionDrawerContainer from '@/ui/components/peek/ImmersionDrawerContainer.vue'
import ProtylePeekDrawer from '@/ui/components/peek/ProtylePeekDrawer.vue'
import WebviewPeekDrawer from '@/ui/components/peek/WebviewPeekDrawer.vue'
import { CursorTracker } from '@/sync/cursor-tracker'
import { mirrorBlockSelection, clearBlockSelectionHighlight } from '@/sync/selection-mirror'
import { getRuntimeModule } from '@/engine/runtime-node'
import { resolvePeekUrl, fileUrlToPath } from '@/utils/peek-url'
import { exportStandaloneHtml, downloadHtmlFile } from '@/export/single-html-exporter'
import { triggerPdfExport } from '@/export/pdf-exporter'
import {
  exportAllSlidesZip,
  exportCurrentSlideImage,
  downloadDataUrl,
  copyDataUrlToClipboard,
  resolveDocumentTitle,
} from '@/export/image-exporter'
import { getRuntimeSettings, buildSiYuanWebUrl } from '@/settings'
import { isFeatureEnabled } from '@/feature-flags/feature-flags'
import { createPageJumpInput, isEditableTarget } from './page-jump-input'
import type { ISlidesDocument } from '@/types/slides-protocol'
import { detectSiYuanThemeMode, observeSiYuanThemeMode } from '@/utils/color-utils'

const plugin = inject<Plugin>('plugin')
const sandboxBridge = inject<WebSandboxBridge>('sandboxBridge', new WebSandboxBridge())
const cursorTracker = new CursorTracker(sandboxBridge)

const fullscreenContainerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const sandboxIframeRef = ref<HTMLIFrameElement | null>(null)
const currentPage = ref(1)
const totalPages = ref(1)
const showImageExportMenu = ref(false)

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

// 「数字+回车」跳页输入状态（角标展示）
const jumpDisplay = ref('')
const jumpInvalid = ref(false)
const pageJumpInput = createPageJumpInput({
  getTotalPages: () => totalPages.value,
  // 速览抽屉打开（键盘冻结）期间不拦截任何按键
  isEnabled: () => !isDrawerOpen.value,
  onJump: (page) => jumpToPage(page),
  onStateChange: (state) => {
    jumpDisplay.value = state.display
    jumpInvalid.value = state.invalid
  },
})

// 页签聚焦（iframe 未聚焦）时的按键补位入口：消费成功才 preventDefault
function onTabKeydown(e: KeyboardEvent) {
  // o 键呼出缩略图总览：转发给沙箱并把焦点移交 iframe，后续键盘全由总览层接管
  if (e.key === 'o' || e.key === 'O') {
    if (isDrawerOpen.value || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || isEditableTarget(e.target)) return
    e.preventDefault()
    onToggleOverview()
    return
  }
  if (pageJumpInput.handleKeydown(e)) {
    e.preventDefault()
  }
}

// 缩略图总览入口：转发 TOGGLE_OVERVIEW 至沙箱
function onToggleOverview() {
  sandboxBridge.toggleOverview()
  sandboxIframeRef.value?.focus()
}

// 「数字+回车」跳页：派发跳页指令至沙箱，并把焦点交还 iframe
function jumpToPage(page: number) {
  currentPage.value = page
  sandboxBridge.navigatePage(page)
  sandboxIframeRef.value?.focus()
}

const iframeSrc = ref('/plugins/siyuan-live-slides/slides-client/index.html')

let unbindSlideChanged: (() => void) | null = null
let unbindBlockClicked: (() => void) | null = null
let unbindOpenInEditor: (() => void) | null = null
let unbindOpenPeekDrawer: (() => void) | null = null
let unbindToggleFullscreen: (() => void) | null = null
let unbindOpenPresenter: (() => void) | null = null
let unobserveTheme: (() => void) | null = null
let latestDoc: ISlidesDocument | null = null

onMounted(() => {
  if (sandboxIframeRef.value) {
    sandboxBridge.attach(sandboxIframeRef.value)
  }

  unbindSlideChanged = sandboxBridge.onSlideChanged((page, total) => {
    currentPage.value = page
    totalPages.value = total
  })

  unbindBlockClicked = sandboxBridge.onBlockClicked((blockId, page) => {
    currentPage.value = page
    cursorTracker.setActiveBlockId(blockId)
    if (!blockId) {
      clearBlockSelectionHighlight()
    }
    if (plugin && typeof (plugin as any).handleBlockClickedFromSlide === 'function') {
      ;(plugin as any).handleBlockClickedFromSlide(blockId, page)
    } else {
      if (blockId) {
        mirrorBlockSelection(blockId, (plugin as any)?.app)
      }
    }
  })

  unbindOpenInEditor = sandboxBridge.onOpenInEditor((blockId, page) => {
    currentPage.value = page
    cursorTracker.setActiveBlockId(blockId)
    mirrorBlockSelection(blockId, (plugin as any)?.app)
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
          console.warn('[SlidesPreviewTab] detect block type failed:', err)
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
        // 本地 HTML 链接归一化：工作区内的文件交由内核 HTTP 伺服，工作区外的文件则外跳系统浏览器
        const resolution = resolvePeekUrl(detail.target)
        if (resolution.external) {
          openLocalFileExternally(detail.target)
          return
        }
        hasOpenedWeb.value = true
        peekUrl.value = resolution.url
        drawerTitle.value = detail.title || resolution.url
      }
      isDrawerOpen.value = true
      sandboxBridge.freezeKeyboardNav(true)
    }
  })

  unbindToggleFullscreen = sandboxBridge.onRequestToggleFullscreen(() => {
    onFullscreen()
  })

  // 沙盒内按 P / 工具栏按钮请求打开演讲者控制台：由宿主以思源页签承载
  unbindOpenPresenter = sandboxBridge.onOpenPresenter(() => {
    onOpenPresenter()
  })

  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', onFullscreenChange)
  }

  unobserveTheme = observeSiYuanThemeMode((mode) => {
    if (latestDoc) {
      sandboxBridge.updateSlides(
        latestDoc.slides,
        { ...latestDoc.config, hostThemeMode: mode },
        latestDoc.customThemeCss,
      )
    }
  })
})

onUnmounted(() => {
  if (unobserveTheme) {
    unobserveTheme()
    unobserveTheme = null
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
  }
  if (unbindOpenPeekDrawer) unbindOpenPeekDrawer()
  if (unbindToggleFullscreen) unbindToggleFullscreen()
  if (unbindOpenPresenter) unbindOpenPresenter()
  if (unbindSlideChanged) unbindSlideChanged()
  if (unbindBlockClicked) unbindBlockClicked()
  if (unbindOpenInEditor) unbindOpenInEditor()
  sandboxBridge.detach()
  pageJumpInput.clear()
  cursorTracker.destroy()
})

function togglePin() {
  isPinned.value = !isPinned.value
  if (isPinned.value) {
    pinnedDocId.value = latestDoc?.docId || ''
    if (plugin && typeof (plugin as any).updatePreviewTabHeader === 'function') {
      ;(plugin as any).updatePreviewTabHeader('', pinnedDocId.value)
    }
  } else {
    pinnedDocId.value = ''
    onRefresh()
    if (plugin && typeof (plugin as any).updatePreviewTabHeader === 'function') {
      ;(plugin as any).updatePreviewTabHeader()
    }
  }
}

let lastHostWheelTime = 0
function onViewportWheel(e: WheelEvent) {
  if (isDrawerOpen.value) return
  if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
  if (Math.abs(e.deltaY) < 15) return
  const now = Date.now()
  if (now - lastHostWheelTime < 280) return
  lastHostWheelTime = now
  if (e.deltaY > 0) {
    onNextPage()
  } else {
    onPrevPage()
  }
}

function onPrevPage() {
  if (currentPage.value > 1) {
    const target = currentPage.value - 1
    currentPage.value = target
    sandboxBridge.navigatePage(target)
  }
}

function onNextPage() {
  if (currentPage.value < totalPages.value) {
    const target = currentPage.value + 1
    currentPage.value = target
    sandboxBridge.navigatePage(target)
  }
}

function onRefresh() {
  if (plugin && typeof (plugin as any).compileCurrentDocument === 'function') {
    ;(plugin as any).compileCurrentDocument()
  } else if (plugin?.eventBus && typeof (plugin.eventBus as any).emit === 'function') {
    ;(plugin.eventBus as any).emit('slides:request-compile' as any)
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

/**
 * 工作区之外的本地文件无法由思源内核 HTTP 伺服，交由系统默认浏览器打开
 */
function openLocalFileExternally(rawUrl: string) {
  const isFileUrl = /^file:/i.test(rawUrl)
  const isFilePath = isFileUrl || /^[a-zA-Z]:[\\/]/.test(rawUrl)
  const electron = getRuntimeModule('electron')

  if (isFilePath && typeof electron?.shell?.openPath === 'function') {
    electron.shell.openPath(isFileUrl ? fileUrlToPath(rawUrl) : rawUrl)
    showMessage('本地文件不在思源工作区内，已交由系统默认浏览器打开')
    return
  }

  if (typeof electron?.shell?.openExternal === 'function') {
    electron.shell.openExternal(rawUrl).catch(() => {
      if (typeof window !== 'undefined') {
        window.open(rawUrl, '_blank')
      }
    })
  } else if (typeof window !== 'undefined') {
    window.open(rawUrl, '_blank')
  }
  showMessage('该地址无法在速览抽屉内加载，已交由系统默认浏览器打开')
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
  // 以思源页签承载演讲者控制台：桌面端 window.open 会被宿主甩给系统浏览器，
  // 广播信道跨进程失效；页签内 iframe 与本沙箱同源同会话，BroadcastChannel 可直达
  if (plugin && typeof (plugin as any).openPresenterTab === 'function') {
    void (plugin as any).openPresenterTab()
  }
}

async function onExportHtml() {
  if (!latestDoc) {
    showMessage('请先在主编辑区打开幻灯片文档')
    return
  }
  const title = await resolveDocumentTitle(latestDoc, (plugin as any)?.currentDocId, plugin)
  showMessage('正在导出单文件离线 HTML（内联媒体资源中...）', 2000)
  const html = await exportStandaloneHtml(latestDoc, { title })
  const ok = downloadHtmlFile(`${title}.html`, html)
  if (ok) {
    showMessage(`已开始下载单文件离线 HTML 演示包 (${title}.html)`)
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

const isExportingAllImages = ref(false)

async function onExportAllImages() {
  if (isExportingAllImages.value) {
    showMessage('正在逐页导出幻灯片图片中，请稍候...', 2000)
    return
  }
  if (!latestDoc) {
    showMessage('请先在主编辑区打开幻灯片文档')
    return
  }
  isExportingAllImages.value = true
  try {
    showMessage('正在逐页导出幻灯片图片...', 2000)
    const title = await resolveDocumentTitle(latestDoc, (plugin as any)?.currentDocId, plugin)
    const res = await exportAllSlidesZip(sandboxBridge, {
      title,
      onProgress: (current, total) => {
        showMessage(`正在导出幻灯片图片 (${current} / ${total})...`, 1500)
      },
    })
    if (res.success) {
      showMessage(`🎉 成功导出 ${res.total || 0} 张高清图片并保存为 ${title}.zip！`, 4000)
    } else {
      showMessage(`导出图片失败：${res.error || '未知异常'}`)
    }
  } finally {
    isExportingAllImages.value = false
  }
}

async function onExportCurrentSlide() {
  if (!latestDoc) {
    showMessage('请先在主编辑区打开幻灯片文档')
    return
  }
  showMessage('正在导出当前幻灯片图片...', 1500)
  const res = await exportCurrentSlideImage(sandboxBridge)
  if (res.success && res.dataUrl) {
    const title = await resolveDocumentTitle(latestDoc, (plugin as any)?.currentDocId, plugin)
    const page = currentPage.value || 1
    const total = totalPages.value || 1
    const filename = total > 1 ? `${title}-${page}.png` : `${title}.png`
    downloadDataUrl(filename, res.dataUrl)
    showMessage(`已下载当前页高清图片 (${filename})`)
  } else {
    showMessage(`导出当前页图片失败：${res.error || '未知异常'}`)
  }
}

async function onCopyCurrentSlide() {
  if (!latestDoc) {
    showMessage('请先在主编辑区打开幻灯片文档')
    return
  }
  showMessage('正在复制当前幻灯片截图到剪贴板...', 1500)
  const res = await exportCurrentSlideImage(sandboxBridge)
  if (res.success && res.dataUrl) {
    const ok = await copyDataUrlToClipboard(res.dataUrl)
    if (ok) {
      showMessage(`已成功将第 ${currentPage.value || 1} 页幻灯片复制到剪贴板！`)
    } else {
      const title = await resolveDocumentTitle(latestDoc, (plugin as any)?.currentDocId, plugin)
      const page = currentPage.value || 1
      const total = totalPages.value || 1
      const filename = total > 1 ? `${title}-${page}.png` : `${title}.png`
      downloadDataUrl(filename, res.dataUrl)
      showMessage(`剪贴板权限不可用，已自动下载为 ${filename}`)
    }
  } else {
    showMessage(`复制失败：${res.error || '未知异常'}`)
  }
}

defineExpose({
  updateDocument(doc: ISlidesDocument, targetDocId?: string) {
    // 若已锁定且目标文档不匹配，则忽略
    if (isPinned.value && pinnedDocId.value && targetDocId && targetDocId !== pinnedDocId.value) {
      return
    }

    latestDoc = doc
    if (isPinned.value && !pinnedDocId.value) {
      pinnedDocId.value = doc.docId
    }

    totalPages.value = doc.slides.length
    cursorTracker.setDocId(doc.docId)
    cursorTracker.updateSlidesIndex(doc.slides)
    sandboxBridge.updateSlides(
      doc.slides,
      { ...doc.config, hostThemeMode: detectSiYuanThemeMode() },
      doc.customThemeCss,
    )

    if (plugin && typeof (plugin as any).updatePreviewTabHeader === 'function') {
      ;(plugin as any).updatePreviewTabHeader('', doc.docId)
    }
  },
  navigateToBlock(blockId: string) {
    cursorTracker.onCursorFocusBlock(blockId)
  },
  isPinned,
  pinnedDocId,
})
</script>

<style lang="scss" scoped>
.spm-slides-preview-tab {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--b3-theme-background, #ffffff);
  color: var(--b3-theme-on-background, #2c3e50);
  overflow: hidden;
  box-sizing: border-box;
}

.spm-slides-tab__toolbar {
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

.spm-slides-tab__nav,
.spm-slides-tab__tools {
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
  background: var(--b3-theme-primary-lightest, var(--b3-list-hover, rgba(59, 130, 246, 0.08)));
  border-color: var(--b3-theme-primary, #3b82f6);
  color: var(--b3-theme-primary, #3b82f6);
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

.spm-toolbar-divider {
  width: 1px;
  height: 16px;
  background: var(--b3-border-color, #e2e8f0);
  margin: 0 4px;
}

.spm-btn-fullscreen {
  font-weight: 500;
  padding: 0 8px;
  gap: 5px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);

  .spm-btn-fullscreen__label {
    font-size: 11px;
    letter-spacing: 0.2px;
  }

  &:hover:not(:disabled) {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
}

@media (max-width: 520px) {
  .spm-btn-fullscreen__label {
    display: none;
  }
}

.spm-slides-tab__viewport {
  flex: 1;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0f172a;
}

.spm-slides-tab__iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

/* 「数字+回车」跳页输入角标：样式对齐沙箱底部控制条质感 */
.spm-jump-badge {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 900;
  min-width: 40px;
  padding: 4px 12px;
  border-radius: 18px;
  background: rgba(24, 24, 27, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f4f4f5;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);

  &.is-invalid {
    background: rgba(153, 27, 27, 0.85);
    border-color: rgba(248, 113, 113, 0.5);
    color: #fecaca;
    animation: spm-jump-shake 0.4s ease;
  }
}

@keyframes spm-jump-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  50% {
    transform: translateX(4px);
  }
  75% {
    transform: translateX(-2px);
  }
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
