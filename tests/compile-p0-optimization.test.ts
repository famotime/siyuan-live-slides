import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "fs"
import path from "path"
import {
  CompileConsumerGate,
  isElementVisible,
} from "../src/sync/compile-consumer-gate"
import { CompileScheduler } from "../src/sync/compile-scheduler"

const PROJECT_ROOT = path.resolve(__dirname, "..")

function fakeElement(
  options: { connected?: boolean; rects?: number; width?: number; hostHidden?: boolean } = {},
): HTMLElement {
  const { connected = true, rects = 1, width = 320, hostHidden = false } = options
  return {
    isConnected: connected,
    getClientRects: () => Array.from({ length: rects }, () => ({}) as DOMRect),
    offsetWidth: width,
    offsetHeight: width > 0 ? 200 : 0,
    // 模拟宿主隐藏：思源在面板元素上加 .fn__none
    closest: (selector: string) => (hostHidden && selector === ".fn__none" ? ({} as Element) : null),
  } as unknown as HTMLElement
}

const originalDocument = (globalThis as any).document

afterEach(() => {
  ;(globalThis as any).document = originalDocument
})

describe("P0 优化：编译调度器（单飞合并 + 代际丢弃）", () => {
  it("同一时刻只允许一次编译，期间到达的请求合并为最新文档胜出的 pending", () => {
    const scheduler = new CompileScheduler()
    expect(scheduler.isRunning).toBe(false)

    const gen1 = scheduler.tryBegin("doc-A")
    expect(gen1).not.toBeNull()
    expect(scheduler.isRunning).toBe(true)
    expect(scheduler.runningDocId).toBe("doc-A")

    // 执行期间连续到达的请求：只登记 pending，不并发启动
    expect(scheduler.tryBegin("doc-A")).toBeNull()
    expect(scheduler.tryBegin("doc-B")).toBeNull()
    expect(scheduler.pending).toBe("doc-B")

    // 结束后返回待补跑文档
    expect(scheduler.finish()).toBe("doc-B")
    expect(scheduler.pending).toBeNull()
    expect(scheduler.isRunning).toBe(false)
  })

  it("代际号应使旧编译结果失效，避免切文档后回写过期结果", () => {
    const scheduler = new CompileScheduler()
    const oldGen = scheduler.tryBegin("doc-A")!
    scheduler.finish()

    const newGen = scheduler.tryBegin("doc-B")!
    expect(newGen).toBeGreaterThan(oldGen)
    expect(scheduler.isStale(oldGen)).toBe(true)
    expect(scheduler.isStale(newGen)).toBe(false)
  })

  it("reset 应清空全部状态（插件卸载场景）", () => {
    const scheduler = new CompileScheduler()
    scheduler.tryBegin("doc-A")
    scheduler.tryBegin("doc-B")
    scheduler.reset()
    expect(scheduler.isRunning).toBe(false)
    expect(scheduler.pending).toBeNull()
    // 重置后旧代际号必须失效
    expect(scheduler.isStale(1)).toBe(true)
  })
})

describe("P0 优化：编译消费者门闩（无可见消费者时不编译）", () => {
  it("未注册任何消费者时判定为不可见", () => {
    const gate = new CompileConsumerGate()
    expect(gate.size).toBe(0)
    expect(gate.hasVisibleConsumer()).toBe(false)
  })

  it("无 IntersectionObserver 环境（Node/老内核）降级为布局盒实时测量，注销后不可见", () => {
    const gate = new CompileConsumerGate()
    const dispose = gate.register("preview", fakeElement({ rects: 1 }))
    expect(gate.size).toBe(1)
    expect(gate.hasVisibleConsumer()).toBe(true)

    dispose()
    expect(gate.size).toBe(0)
    expect(gate.hasVisibleConsumer()).toBe(false)
  })

  it("后台页签 / 折叠 Dock（无布局盒）判定为不可见", () => {
    const gate = new CompileConsumerGate()
    gate.register("dock", fakeElement({ rects: 0, width: 0 }))
    expect(gate.hasVisibleConsumer()).toBe(false)
  })

  it("已脱离文档的元素判定为不可见", () => {
    const gate = new CompileConsumerGate()
    gate.register("preview", fakeElement({ connected: false }))
    expect(gate.hasVisibleConsumer()).toBe(false)
  })

  it("宿主窗口整体隐藏时判定为不可见（避免后台空转）", () => {
    const gate = new CompileConsumerGate()
    gate.register("preview", fakeElement())
    ;(globalThis as any).document = { visibilityState: "hidden" }
    expect(gate.hasVisibleConsumer()).toBe(false)
    ;(globalThis as any).document = { visibilityState: "visible" }
    expect(gate.hasVisibleConsumer()).toBe(true)
  })

  it("clear 应清空全部消费者并断开观察器（插件卸载场景）", () => {
    const gate = new CompileConsumerGate()
    gate.register("preview", fakeElement())
    gate.register("dock", fakeElement())
    gate.clear()
    expect(gate.size).toBe(0)
    expect(gate.hasVisibleConsumer()).toBe(false)
  })

  it("getVisibility 三态：未挂载为 none、宿主隐藏为 hidden、其余为 visible", () => {
    const gate = new CompileConsumerGate()
    // 未注册任何消费者：调用侧应完全跳过编译
    expect(gate.getVisibility()).toBe("none")

    // 宿主在面板元素上加了 .fn__none（后台页签/折叠面板）→ hidden（有界低频编译而非停摆）
    const disposeHidden = gate.register("preview", fakeElement({ rects: 0, width: 0, hostHidden: true }))
    expect(gate.getVisibility()).toBe("hidden")
    disposeHidden()

    // 未被宿主隐藏 → visible
    const disposeVisible = gate.register("dock", fakeElement({ hostHidden: false }))
    expect(gate.getVisibility()).toBe("visible")
    disposeVisible()
  })

  it("宿主类名信号零成本：不得因此触发同步布局", () => {
    const gate = new CompileConsumerGate()
    // 用无 IntersectionObserver 的真实测量模式，确认 hasVisibleConsumer 不因类名检查而额外布局
    let rectCalls = 0
    const el = fakeElement({ rects: 0, width: 320 })
    const originalRects = el.getClientRects
    ;(el as any).getClientRects = () => {
      rectCalls++
      return originalRects.call(el)
    }
    gate.register("dock", el)
    const before = rectCalls
    gate.getVisibility()
    // 实时测量模式下每次判定调用一次测量属预期；此处确认调用次数有界（非按块/按事务放大）
    expect(rectCalls - before).toBeLessThanOrEqual(2)
  })

  it("isElementVisible 应对矩形测量异常的 fixed 容器回退到尺寸判定", () => {
    expect(isElementVisible(fakeElement({ rects: 0, width: 0 }))).toBe(false)
    expect(isElementVisible(fakeElement({ rects: 0, width: 320 }))).toBe(true)
    expect(isElementVisible(null)).toBe(false)
  })

  it("挂载点为零尺寸外壳时应检查首层子元素（兼容宿主结构差异）", () => {
    const wrapper = {
      isConnected: true,
      getClientRects: () => [],
      offsetWidth: 0,
      offsetHeight: 0,
      firstElementChild: fakeElement({ rects: 1 }),
    } as unknown as HTMLElement
    expect(isElementVisible(wrapper)).toBe(true)

    const emptyWrapper = {
      isConnected: true,
      getClientRects: () => [],
      offsetWidth: 0,
      offsetHeight: 0,
      firstElementChild: null,
    } as unknown as HTMLElement
    expect(isElementVisible(emptyWrapper)).toBe(false)
  })

  it("观察器持续误报不可见时应由低频兜底校验纠正，恢复自动编译", () => {
    const originalIO = (globalThis as any).IntersectionObserver
    let observerCallback: ((entries: any[]) => void) | null = null
    class SilentIntersectionObserver {
      constructor(cb: (entries: any[]) => void) {
        observerCallback = cb
      }
      observe() {}
      disconnect() {}
    }
    ;(globalThis as any).IntersectionObserver = SilentIntersectionObserver as any

    vi.useFakeTimers()
    try {
      const gate = new CompileConsumerGate()
      let flushCount = 0
      // 矛盾信号：宿主标记了隐藏（.fn__none）但元素实际有布局盒，且观察器静默
      gate.register("preview", fakeElement({ rects: 1, hostHidden: true }), () => {
        flushCount++
      })
      expect(observerCallback).not.toBeNull()
      expect(gate.hasVisibleConsumer()).toBe(false)

      // 兜底校验在 ~2 秒后纠正误报并触发补跑
      vi.advanceTimersByTime(2100)
      expect(gate.hasVisibleConsumer()).toBe(true)
      expect(flushCount).toBe(1)
    } finally {
      vi.useRealTimers()
      ;(globalThis as any).IntersectionObserver = originalIO
    }
  })

  it("元素确实不可见时兜底校验不得产生误判与常态开销", () => {
    const originalIO = (globalThis as any).IntersectionObserver
    class SilentIntersectionObserver {
      observe() {}
      disconnect() {}
    }
    ;(globalThis as any).IntersectionObserver = SilentIntersectionObserver as any

    vi.useFakeTimers()
    try {
      const gate = new CompileConsumerGate()
      let flushCount = 0
      // 后台页签：既被宿主标记隐藏，也无布局盒
      gate.register("preview", fakeElement({ rects: 0, width: 0, hostHidden: true }), () => {
        flushCount++
      })
      expect(gate.hasVisibleConsumer()).toBe(false)
      vi.advanceTimersByTime(5000)
      expect(gate.hasVisibleConsumer()).toBe(false)
      expect(flushCount).toBe(0)
    } finally {
      vi.useRealTimers()
      ;(globalThis as any).IntersectionObserver = originalIO
    }
  })

  it("有 IntersectionObserver 时应异步上报可见性，且不强制同步布局", () => {
    const originalIO = (globalThis as any).IntersectionObserver
    const callbacks: Array<(entries: any[]) => void> = []
    const disconnect = vi.fn()
    let observeCalls = 0
    class FakeIntersectionObserver {
      constructor(cb: (entries: any[]) => void) {
        callbacks.push(cb)
      }
      observe() {
        observeCalls++
      }
      disconnect = disconnect
    }
    ;(globalThis as any).IntersectionObserver = FakeIntersectionObserver as any

    try {
      const gate = new CompileConsumerGate()
      let flushCount = 0
      // 元素矩形测量返回 0（模拟后台页签），确认 IO 路径不读取布局盒
      const element = fakeElement({ rects: 0, width: 0 })
      const rectSpy = vi.spyOn(element, "getClientRects")
      const dispose = gate.register("preview", element, () => {
        flushCount++
      })

      expect(observeCalls).toBe(1)
      expect(rectSpy).not.toHaveBeenCalled()
      // 宿主未标记隐藏（无 .fn__none）→ 观察器即便静默也判定可见（宁可多编译，不可停更）
      expect(gate.getVisibility()).toBe("visible")
      expect(gate.hasVisibleConsumer()).toBe(true)

      // 观察器上报进入视口 → 触发补跑回调
      callbacks[0]([{ isIntersecting: true }])
      expect(gate.hasVisibleConsumer()).toBe(true)
      expect(flushCount).toBe(1)

      // 重复上报可见不应重复触发补跑
      callbacks[0]([{ isIntersecting: true }])
      expect(flushCount).toBe(1)

      // 观察器报不相交但无 .fn__none：仍按可见处理（本用例元素未被宿主隐藏）
      callbacks[0]([{ isIntersecting: false }])
      expect(gate.hasVisibleConsumer()).toBe(true)

      // 读路径全程不触发强制布局
      expect(rectSpy).not.toHaveBeenCalled()

      dispose()
      expect(disconnect).toHaveBeenCalled()
    } finally {
      ;(globalThis as any).IntersectionObserver = originalIO
    }
  })
})

describe("P0 优化：插件接线契约", () => {
  const indexSource = fs.readFileSync(path.join(PROJECT_ROOT, "src/index.ts"), "utf-8")
  const mainSource = fs.readFileSync(path.join(PROJECT_ROOT, "src/main.ts"), "utf-8")
  const coordinatorSource = fs.readFileSync(
    path.join(PROJECT_ROOT, "src/sync/inspector-sync-coordinator.ts"),
    "utf-8",
  )

  it("P0-2：ws-main 只处理 transactions 事务，其余内核推送直接忽略", () => {
    // 内核会把 savedoc / progress / readystate 等高频非内容消息一并转发，此前每条都会触发全量编译
    expect(indexSource).toContain('if (data.cmd !== "transactions") return')
    // 协调器内同样需要守卫，避免每次推送都做一轮 DOM 写入
    expect(coordinatorSource).toContain('if (data?.cmd !== "transactions")')
  })

  it("P0-1：自动编译必须经过消费者门闩，并在消费者可见时补跑脏文档", () => {
    expect(indexSource).toContain("globalCompileConsumerGate.getVisibility()")
    expect(indexSource).toContain('reason === "auto" && globalCompileConsumerGate.getVisibility() === "none"')
    expect(indexSource).toContain("flushDirtyCompile")
    // 消费者被宿主隐藏时必须有界低频编译，避免可见性误判导致同步长时间停摆
    expect(indexSource).toContain('const effectiveDelay = visibility === "visible" ? delay : Math.max(delay, HIDDEN_CONSUMER_COMPILE_DELAY_MS)')
    expect(indexSource).toContain("HIDDEN_CONSUMER_COMPILE_DELAY_MS")
    expect(indexSource).toContain('document.addEventListener("visibilitychange"')
    expect(indexSource).toContain('document.removeEventListener("visibilitychange"')
    expect(indexSource).toContain("globalCompileConsumerGate.clear()")
    // 预览页签与 Dock 面板的挂载点必须注册/注销消费者，并绑定"重新可见时补跑"回调
    expect(mainSource).toContain("globalCompileConsumerGate.register(kind, element, flush)")
    expect(mainSource).toContain("registerConsumer('preview', element, pluginInstance)")
    expect(mainSource).toContain("registerConsumer('dock', element, pluginInstance)")
    expect(mainSource).toContain("disposePreviewConsumer")
    expect(mainSource).toContain("disposeDockConsumer")
  })

  it("可见性判定不得在高频事务路径上强制同步布局", () => {
    // 读取路径必须是纯缓存布尔判断；仅无 IntersectionObserver 的老环境才降级实时测量
    const gateSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "src/sync/compile-consumer-gate.ts"),
      "utf-8",
    )
    expect(gateSource).toContain("measureOnDemand")
    expect(gateSource).toContain("new ObserverCtor(")
    expect(gateSource).toContain("record.observer.observe(element)")
    expect(gateSource).toContain("record.observer?.disconnect()")
  })

  it("P0-3：编译必须走单飞合并与代际校验，并在结束时补跑被合并的请求", () => {
    expect(indexSource).toContain("this.compileScheduler.tryBegin(docId)")
    expect(indexSource).toContain("this.compileScheduler.isStale(generation)")
    expect(indexSource).toContain("this.compileScheduler.finish()")
    expect(indexSource).toContain("this.markCompileDirty(pendingDocId)")
    // 卸载时必须重置调度状态
    expect(indexSource).toContain("this.compileScheduler.reset()")
  })

  it("自动触发路径应统一走脏标记，不再直接调用全量编译", () => {
    // 文档切换、同步覆写、设置变更、首编译探测等自动路径
    expect(indexSource).not.toMatch(/onSwitchProtyle[\s\S]{0,600}this\.compileCurrentDocument\(docId\)/)
    const autoPaths = indexSource.match(/this\.markCompileDirty\(/g) || []
    expect(autoPaths.length).toBeGreaterThanOrEqual(6)
  })
})
