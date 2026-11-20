/**
 * 沉浸式速览抽屉状态机领域逻辑（自 SlidesPreviewTab 抽离）
 *
 * 职责：统一管理速览抽屉双通道（思源块 Protyle / 内嵌网页 Webview）的
 * 打开状态迁移、思源工作区跳转设置分支、文档块/页内块判定与标题派生，
 * 以及关闭抽屉时的键盘冻结解除。
 * 外部探测与外跳能力以注入形式传入，便于脱离宿主环境单测。
 */

import { ref } from 'vue'
import type { WebSandboxBridge, IOpenPeekDrawerDetail } from '@/engine/web-sandbox-bridge'
import type { ISlidesDocument } from '@/types/slides-protocol'

/** 速览抽屉状态机的宿主上下文与底层服务（注入以便单测） */
export interface IPeekDrawerOptions {
  sandboxBridge: Pick<WebSandboxBridge, 'freezeKeyboardNav'>
  getLatestDoc: () => ISlidesDocument | null
  getSettings: () => { enableWebServeJump: boolean; webServeUrl: string }
  buildWebUrl: (base: string, target: string, opts: { focus: boolean }) => string
  resolveUrl: (target: string) => { url: string; external: boolean }
  /** 目标 id 是否为思源文档块（SQL 探测，由宿主注入） */
  detectDocBlock: (targetId: string) => Promise<boolean>
  /** 工作区外地址外跳系统浏览器（electron shell 交由宿主实现） */
  openExternalUrl: (rawUrl: string) => void
}

export function usePeekDrawerState(options: IPeekDrawerOptions) {
  const { sandboxBridge, getLatestDoc, getSettings, buildWebUrl, resolveUrl, detectDocBlock, openExternalUrl } = options

  // 沉浸式速览抽屉状态
  const isDrawerOpen = ref(false)
  const isDrawerMaximized = ref(false)
  const peekType = ref<'siyuan' | 'web'>('siyuan')
  const peekBlockId = ref('')
  const peekUrl = ref('')
  const drawerTitle = ref('')
  const hasOpenedWeb = ref(false)

  function openDrawer() {
    isDrawerOpen.value = true
    sandboxBridge.freezeKeyboardNav(true)
  }

  function closeDrawer() {
    isDrawerOpen.value = false
    sandboxBridge.freezeKeyboardNav(false)
  }

  async function handleOpenPeekDrawer(detail: IOpenPeekDrawerDetail) {
    const settings = getSettings()
    if (detail.peekType === 'siyuan' && settings.enableWebServeJump) {
      // 检测目标是否为文档块（非文档块需要追加 &focus=1 参数）
      let isDoc = false
      const latestDoc = getLatestDoc()
      if (latestDoc && latestDoc.docId === detail.target) {
        isDoc = true
      } else if (latestDoc && latestDoc.slides && latestDoc.slides.some(s => s.blocks?.some(b => b.id === detail.target))) {
        isDoc = false
      } else {
        try {
          isDoc = await detectDocBlock(detail.target)
        } catch (err) {
          console.warn('[usePeekDrawerState] detect block type failed:', err)
        }
      }

      peekType.value = 'web'
      hasOpenedWeb.value = true
      peekUrl.value = buildWebUrl(settings.webServeUrl, detail.target, {
        focus: !isDoc,
      })
      drawerTitle.value = detail.title || `${isDoc ? '思源文档' : '思源块'}: ${detail.target.slice(0, 8)}`
      openDrawer()
    } else {
      peekType.value = detail.peekType
      if (detail.peekType === 'siyuan') {
        peekBlockId.value = detail.target
        drawerTitle.value = detail.title || `块速览: ${detail.target.slice(0, 8)}`
      } else {
        // 本地 HTML 链接归一化：工作区内的文件交由内核 HTTP 伺服，工作区外的文件则外跳系统浏览器
        const resolution = resolveUrl(detail.target)
        if (resolution.external) {
          openExternalUrl(detail.target)
          return
        }
        hasOpenedWeb.value = true
        peekUrl.value = resolution.url
        drawerTitle.value = detail.title || resolution.url
      }
      openDrawer()
    }
  }

  return {
    isDrawerOpen,
    isDrawerMaximized,
    peekType,
    peekBlockId,
    peekUrl,
    drawerTitle,
    hasOpenedWeb,
    handleOpenPeekDrawer,
    closeDrawer,
  }
}
