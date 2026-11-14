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
  }
}
