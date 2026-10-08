import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "fs"
import path from "path"
import {
  CompileConsumerGate,
  isElementVisible,
} from "../src/sync/compile-consumer-gate"
import { CompileScheduler } from "../src/sync/compile-scheduler"

const PROJECT_ROOT = path.resolve(__dirname, "..")

function fakeElement(options: { connected?: boolean; rects?: number; width?: number } = {}): HTMLElement {
  const { connected = true, rects = 1, width = 320 } = options
  return {
    isConnected: connected,
    getClientRects: () => Array.from({ length: rects }, () => ({}) as DOMRect),
    offsetWidth: width,
    offsetHeight: width > 0 ? 200 : 0,
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

  it("isElementVisible 应对矩形测量异常的 fixed 容器回退到尺寸判定", () => {
    expect(isElementVisible(fakeElement({ rects: 0, width: 0 }))).toBe(false)
    expect(isElementVisible(fakeElement({ rects: 0, width: 320 }))).toBe(true)
    expect(isElementVisible(null)).toBe(false)
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
      // 初始为不可见，等待观察器上报
      expect(gate.hasVisibleConsumer()).toBe(false)

      // 观察器上报进入视口 → 可见，并触发补跑回调
      callbacks[0]([{ isIntersecting: true }])
      expect(gate.hasVisibleConsumer()).toBe(true)
      expect(flushCount).toBe(1)

      // 重复上报可见不应重复触发补跑
      callbacks[0]([{ isIntersecting: true }])
      expect(flushCount).toBe(1)

      // 切到后台页签（不再相交）→ 不可见
      callbacks[0]([{ isIntersecting: false }])
      expect(gate.hasVisibleConsumer()).toBe(false)

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
    expect(indexSource).toContain("globalCompileConsumerGate.hasVisibleConsumer()")
    expect(indexSource).toContain('reason === "auto" && !globalCompileConsumerGate.hasVisibleConsumer()')
    expect(indexSource).toContain("flushDirtyCompile")
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
