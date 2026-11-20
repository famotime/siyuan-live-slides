import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import { usePresenterSync } from "../src/ui/tab/usePresenterSync"

/**
 * 状态机审计 FIX-9 (P1-D1/P1-D2)：
 * SYNC_SLIDES 快照准入判定与文档切换页码重置
 */
class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  closed = false
  posted: any[] = []
  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.instances.push(this)
  }
  postMessage(data: any) {
    this.posted.push(data)
  }
  close() {
    this.closed = true
  }
  deliver(data: any) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

function makeHarness() {
  const currentPage = ref(1)
  const currentStep = ref(0)
  const bridgeTotal = ref(0)
  const bridgeMaxStep = ref(0)
  const slides = ref<any[]>([])
  const docConfig = ref<any>({})
  const sync = usePresenterSync({
    currentPage,
    currentStep,
    bridgeTotal,
    bridgeMaxStep,
    slides,
    docConfig,
    sandboxBridge: {} as any,
  })
  return {
    sync,
    currentPage,
    currentStep,
    slides,
    docConfig,
    channel: () => FakeBroadcastChannel.instances[FakeBroadcastChannel.instances.length - 1],
  }
}

describe("presenter-sync 快照准入与文档切换重置 (P1-D1/P1-D2)", () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances = []
    ;(globalThis as any).BroadcastChannel = FakeBroadcastChannel as any
  })

  afterEach(() => {
    delete (globalThis as any).BroadcastChannel
  })

  it("同文档陈旧快照（slidesUpdatedAt 更旧）被拒绝", () => {
    const h = makeHarness()
    h.sync.initSync()

    const now = Date.now()
    h.channel().deliver({ type: "SYNC_SLIDES", slides: [{ pageIndex: 1 }], docId: "doc-a", slidesUpdatedAt: now })
    expect(h.slides.value.length).toBe(1)

    // 残留窗口迟到应答：同 docId 但时间戳更旧
    h.channel().deliver({ type: "SYNC_SLIDES", slides: [{ pageIndex: 9 }], docId: "doc-a", slidesUpdatedAt: now - 5000 })
    expect(h.slides.value.length).toBe(1)
    expect(h.slides.value[0].pageIndex).toBe(1)
  })

  it("跨文档切换：新数据被接受并重置页码步进；迟到旧文档数据被拒绝", () => {
    const h = makeHarness()
    h.sync.initSync()

    const now = Date.now()
    // 旧文档（用户此前所在的 doc-a）先应答：首次接入保留当前浏览位置
    h.channel().deliver({ type: "SYNC_SLIDES", slides: [{ pageIndex: 1 }], docId: "doc-a", slidesUpdatedAt: now - 60000 })
    expect(h.slides.value[0]).toEqual({ pageIndex: 1 })
    expect(h.currentPage.value).toBe(1)

    h.currentPage.value = 7
    h.currentStep.value = 3

    // 新文档 doc-b 时间戳更新：接受并重置页码
    h.channel().deliver({ type: "SYNC_SLIDES", slides: [{ pageIndex: 1 }, { pageIndex: 2 }], docId: "doc-b", slidesUpdatedAt: now })
    expect(h.slides.value.length).toBe(2)
    expect(h.currentPage.value).toBe(1)
    expect(h.currentStep.value).toBe(0)

    // doc-a 的迟到应答（时间戳更旧）：拒绝
    h.channel().deliver({ type: "SYNC_SLIDES", slides: [{ pageIndex: 42 }], docId: "doc-a", slidesUpdatedAt: now - 60000 })
    expect(h.slides.value.length).toBe(2)
  })

  it("legacy 无身份快照被接受，不触发页码重置 (向下兼容)", () => {
    const h = makeHarness()
    h.sync.initSync()
    h.currentPage.value = 4

    h.channel().deliver({ type: "SYNC_SLIDES", slides: [{ pageIndex: 1 }] })
    expect(h.slides.value.length).toBe(1)
    expect(h.currentPage.value).toBe(4)
  })

  it("adoptSlides 登记直灌数据身份：跨文档时重置页码，REQUEST_SYNC 应答携带 docId", () => {
    const h = makeHarness()
    h.sync.initSync()
    h.sync.adoptSlides("doc-w")

    h.currentPage.value = 6
    h.sync.adoptSlides("doc-x")
    expect(h.currentPage.value).toBe(1)

    h.slides.value = [{ pageIndex: 1 }] as any
    h.channel().deliver({ type: "REQUEST_SYNC" })
    const response = h.channel().posted.find(m => m.type === "SYNC_SLIDES")
    expect(response.docId).toBe("doc-x")
    expect(typeof response.slidesUpdatedAt).toBe("number")
  })

  it("直灌同文档快照不重复重置页码", () => {
    const h = makeHarness()
    h.sync.initSync()
    h.sync.adoptSlides("doc-x")
    h.currentPage.value = 3
    h.sync.adoptSlides("doc-x")
    expect(h.currentPage.value).toBe(3)
  })
})
