import type { Ref } from 'vue'
import type { WebSandboxBridge } from '@/engine/web-sandbox-bridge'
import type { ISlidesVirtualPage, ISlidesPluginConfig } from '@/types/slides-protocol'

export interface IPresenterSyncOptions {
  currentPage: Ref<number>
  currentStep: Ref<number>
  bridgeTotal: Ref<number>
  bridgeMaxStep: Ref<number>
  slides: Ref<ISlidesVirtualPage[]>
  docConfig: Ref<Partial<ISlidesPluginConfig>>
  currentMaxStep?: Ref<number>
  sandboxBridge: WebSandboxBridge
}

/**
 * 演讲者控制台广播信道与沙箱双向同步
 *
 * P1-D2（状态机审计）：SYNC_SLIDES 协议携带 docId + slidesUpdatedAt，
 * 接收端据此过滤残留旧文档窗口的迟到应答——同文档陈旧快照与跨文档旧数据
 * 均不再覆写本地数据；跨文档切换被接受时同步重置页码与步进（P1-D1）。
 */
export function usePresenterSync(options: IPresenterSyncOptions) {
  const {
    currentPage,
    currentStep,
    bridgeTotal,
    bridgeMaxStep,
    slides,
    docConfig,
    currentMaxStep,
    sandboxBridge,
  } = options

  let broadcastChannel: BroadcastChannel | null = null
  let unbindSlideChanged: (() => void) | null = null

  /** 当前已同步数据所属文档 id 与其写入时刻（用于陈旧应答过滤） */
  let syncedDocId = ''
  let syncedSlidesAt = 0

  function initChannel() {
    if (typeof BroadcastChannel === 'undefined') {
      return
    }
    if (broadcastChannel) {
      return
    }
    try {
      broadcastChannel = new BroadcastChannel('siyuan-slides-sync')
      broadcastChannel.onmessage = (event: MessageEvent) => {
        const data = event.data
        if (!data) return

        if (data.type === 'SYNC_PAGE' && typeof data.page === 'number') {
          currentPage.value = data.page
          currentStep.value = typeof data.step === 'number' ? Math.max(0, data.step) : 0
          if (typeof data.maxStep === 'number') {
            bridgeMaxStep.value = Math.max(0, data.maxStep)
          }
        }

        if (data.type === 'SYNC_SLIDES' && Array.isArray(data.slides)) {
          if (!acceptSlidesSnapshot(data)) {
            return
          }
          slides.value = data.slides
          if (data.config && typeof data.config === 'object') {
            docConfig.value = data.config
          }
        }

        if (data.type === 'REQUEST_SYNC' && slides.value.length > 0) {
          try {
            broadcastChannel?.postMessage({
              type: 'SYNC_SLIDES',
              slides: JSON.parse(JSON.stringify(slides.value)),
              config: JSON.parse(JSON.stringify(docConfig.value || {})),
              // 应答附带数据身份：接收端据此拒绝残留窗口的迟到旧数据
              docId: syncedDocId,
              slidesUpdatedAt: syncedSlidesAt,
            })
            broadcastChannel?.postMessage({
              type: 'SYNC_PAGE',
              page: currentPage.value,
              step: currentStep.value,
              maxStep: currentMaxStep?.value || 0,
            })
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  /**
   * SYNC_SLIDES 快照准入判定
   * 返回 false 表示该快照为残留窗口的陈旧数据，应整体忽略
   */
  function acceptSlidesSnapshot(data: any): boolean {
    const incomingDocId = typeof data.docId === 'string' ? data.docId : ''
    const incomingAt = typeof data.slidesUpdatedAt === 'number' ? data.slidesUpdatedAt : 0

    // 未知身份（legacy 发送方 / 首次接收）：直接接受
    if (!syncedDocId || !syncedSlidesAt) {
      if (incomingDocId) {
        syncedDocId = incomingDocId
      }
      syncedSlidesAt = incomingAt || Date.now()
      return true
    }

    const isSameDoc = !incomingDocId || incomingDocId === syncedDocId
    if (isSameDoc) {
      // 同文档：仅接受更新时间不早于本地快照的刷新
      if (incomingAt && incomingAt < syncedSlidesAt) {
        return false
      }
      syncedSlidesAt = incomingAt || Date.now()
      return true
    }

    // 跨文档切换：迟到旧文档数据拒绝；新数据接受并重置页码步进（P1-D1）
    if (incomingAt && incomingAt < syncedSlidesAt) {
      return false
    }
    syncedDocId = incomingDocId
    syncedSlidesAt = incomingAt || Date.now()
    currentPage.value = 1
    currentStep.value = 0
    return true
  }

  /**
   * 宿主直灌幻灯片快照（onMounted 水合 / defineExpose.updateDocument）时登记数据身份
   */
  function adoptSlides(docId: string) {
    if (!docId) return
    if (syncedDocId && syncedDocId !== docId) {
      // 直灌数据构成文档切换：同步重置页码步进
      currentPage.value = 1
      currentStep.value = 0
    }
    syncedDocId = docId
    syncedSlidesAt = Date.now()
  }

  function initSync() {
    initChannel()

    if (sandboxBridge?.onSlideChanged) {
      unbindSlideChanged = sandboxBridge.onSlideChanged((page, total, _blockId, step, maxStep) => {
        currentPage.value = page
        if (total > 0) bridgeTotal.value = total
        if (typeof step === 'number') currentStep.value = Math.max(0, step)
        if (typeof maxStep === 'number') bridgeMaxStep.value = Math.max(0, maxStep)
      })
    }

    try {
      broadcastChannel?.postMessage({ type: 'REQUEST_SYNC' })
    } catch (e) {}
  }

  function broadcastPageChange(page: number, step: number, maxStep: number) {
    try {
      broadcastChannel?.postMessage({
        type: 'SYNC_PAGE',
        page,
        step,
        maxStep,
        docId: syncedDocId,
      })
    } catch (e) {}
  }

  function closeSync() {
    if (unbindSlideChanged) {
      unbindSlideChanged()
      unbindSlideChanged = null
    }
    try {
      broadcastChannel?.close()
    } catch (e) {}
    broadcastChannel = null
  }

  return {
    initSync,
    broadcastPageChange,
    closeSync,
    adoptSlides,
  }
}
