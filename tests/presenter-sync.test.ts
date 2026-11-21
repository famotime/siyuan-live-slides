import { describe, expect, it, vi, beforeEach } from "vitest"
import { ref } from "vue"
import { usePresenterSync } from "../src/ui/tab/usePresenterSync"
import type { ISlidesVirtualPage, ISlidesPluginConfig } from "../src/types/slides-protocol"

describe("usePresenterSync (演讲者视图广播与沙箱同步协调)", () => {
  let mockPostMessage: any
  let mockClose: any
  let lastChannelInstance: any

  beforeEach(() => {
    mockPostMessage = vi.fn()
    mockClose = vi.fn()
    
    // Mock BroadcastChannel
    class MockBroadcastChannel {
      public name: string
      public onmessage: ((ev: any) => void) | null = null
      constructor(name: string) {
        this.name = name
        // eslint-disable-next-line ts/no-this-alias -- Mock 构造器需登记最后创建的实例供断言使用
        lastChannelInstance = this
      }
      postMessage(data: any) {
        mockPostMessage(data)
      }
      close() {
        mockClose()
      }
    }
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel)
  })

  it("initSync 能够向广播信道发送 REQUEST_SYNC 请求同步", () => {
    const currentPage = ref(1)
    const currentStep = ref(0)
    const bridgeTotal = ref(0)
    const bridgeMaxStep = ref(0)
    const slides = ref<ISlidesVirtualPage[]>([])
    const docConfig = ref<Partial<ISlidesPluginConfig>>({})

    const mockBridge = {
      onSlideChanged: vi.fn().mockReturnValue(vi.fn()),
      sendNavStep: vi.fn(),
    } as any

    const sync = usePresenterSync({
      currentPage,
      currentStep,
      bridgeTotal,
      bridgeMaxStep,
      slides,
      docConfig,
      sandboxBridge: mockBridge,
    })

    sync.initSync()
    expect(mockPostMessage).toHaveBeenCalledWith({ type: "REQUEST_SYNC" })
    expect(mockBridge.onSlideChanged).toHaveBeenCalled()
    sync.closeSync()
  })

  it("收到 SYNC_PAGE 广播消息时能够响应式更新当前页码与步进", () => {
    const currentPage = ref(1)
    const currentStep = ref(0)
    const bridgeTotal = ref(0)
    const bridgeMaxStep = ref(0)
    const slides = ref<ISlidesVirtualPage[]>([])
    const docConfig = ref<Partial<ISlidesPluginConfig>>({})

    const mockBridge = {
      onSlideChanged: vi.fn().mockReturnValue(vi.fn()),
      sendNavStep: vi.fn(),
    } as any

    const sync = usePresenterSync({
      currentPage,
      currentStep,
      bridgeTotal,
      bridgeMaxStep,
      slides,
      docConfig,
      sandboxBridge: mockBridge,
    })

    sync.initSync()
    
    // 模拟远端广播 SYNC_PAGE
    lastChannelInstance.onmessage({
      data: {
        type: "SYNC_PAGE",
        page: 3,
        step: 2,
        maxStep: 5,
      },
    })

    expect(currentPage.value).toBe(3)
    expect(currentStep.value).toBe(2)
    expect(bridgeMaxStep.value).toBe(5)

    sync.closeSync()
    expect(mockClose).toHaveBeenCalled()
  })
})
