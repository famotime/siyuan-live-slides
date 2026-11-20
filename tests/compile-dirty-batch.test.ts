import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"

// ------------------------------------------------------------------
// 模块级 Mock：隔离内核 API 与主 UI 挂载编排，聚焦编译调度状态机行为
// ------------------------------------------------------------------
vi.mock("@/main", () => ({
  globalSandboxBridge: { detach: () => {}, postMessage: () => {} },
  mountPreviewTab: () => {},
  unmountPreviewTab: () => {},
  mountPresenterTab: () => {},
  unmountPresenterTab: () => {},
  mountInspectorDock: () => {},
  unmountInspectorDock: () => {},
  navigateDockToBlock: () => {},
  updateDockDocument: vi.fn(),
  updateInspectorCurrentBlock: () => {},
  isPreviewTabMounted: () => true,
}))

vi.mock("@/plugin/preview-tab-title", () => ({
  buildPreviewTabTitle: () => "即现预览",
  fetchDocumentTitle: async () => "",
  updatePreviewTabHeader: async () => {},
}))

vi.mock("siyuan", async (importOriginal) => {
  const mod = await importOriginal<any>()
  return { ...mod, showMessage: vi.fn() }
})

import { showMessage as mockShowMessage } from "siyuan"
import SiYuanLiveSlidesPlugin from "../src/index"
import { globalCompileConsumerGate } from "../src/sync/compile-consumer-gate"
import { globalDocumentCompiler } from "../src/compiler/document-compiler"

const PROJECT_ROOT = path.resolve(__dirname, "..")

function makeDoc(docId: string, blockIds: string[]) {
  return {
    docId,
    slides: [
      {
        startBlockId: blockIds[0] || "",
        blocks: blockIds.map(id => ({ id })),
        noteBlocks: [],
        allBlockIds: [],
      },
    ],
    config: {},
  }
}

describe("编译调度：脏文档集合与失败保留 lastGoodDoc（状态机审计 FIX-1/FIX-2）", () => {
  let plugin: SiYuanLiveSlidesPlugin
  let compileSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.useFakeTimers()
    // 调度路径依赖 window.clearTimeout/window.setTimeout；委托给（被 fake 的）全局定时器
    ;(globalThis as any).window = {
      setTimeout: (fn: any, ms?: number) => setTimeout(fn, ms),
      clearTimeout: (t: any) => clearTimeout(t),
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }
    // 最小 document 桩：让 onload 的启动探测定时器真实排程，供卸载回收用例验证
    ;(globalThis as any).document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
    }
    compileSpy = vi.spyOn(globalDocumentCompiler, "compile").mockResolvedValue(makeDoc("doc-x", []))
    vi.spyOn(globalCompileConsumerGate, "getVisibility").mockReturnValue("visible")
    plugin = new SiYuanLiveSlidesPlugin({} as any)
    await plugin.onload()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    delete (globalThis as any).window
    delete (globalThis as any).document
  })

  it("多文档脏批次经防抖后逐个补跑，不因单槽覆盖而丢更新 (P0-1)", async () => {
    plugin.markCompileDirty("doc-a")
    plugin.markCompileDirty("doc-b")
    plugin.markCompileDirty("doc-c")

    // 足够多的防抖周期让批次与其补跑批次全部排空
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(200)
    }

    const compiledIds = compileSpy.mock.calls.map(call => call[0]).sort()
    expect(compiledIds).toEqual(["doc-a", "doc-b", "doc-c"])
    expect(compileSpy).toHaveBeenCalledTimes(3)
  })

  it("高频交替编辑多文档时，后编辑的文档不会覆盖先前未编译的脏文档 (P0-1)", async () => {
    // 三个文档在多个防抖窗口内交替登记
    plugin.markCompileDirty("doc-a")
    await vi.advanceTimersByTimeAsync(50)
    plugin.markCompileDirty("doc-b")
    await vi.advanceTimersByTimeAsync(50)
    plugin.markCompileDirty("doc-c")
    await vi.advanceTimersByTimeAsync(50)
    plugin.markCompileDirty("doc-a")
    plugin.markCompileDirty("doc-b")

    for (let i = 0; i < 12; i++) {
      await vi.advanceTimersByTimeAsync(200)
    }

    const compiledIds = compileSpy.mock.calls.map(call => call[0]).sort()
    expect(new Set(compiledIds)).toEqual(new Set(["doc-a", "doc-b", "doc-c"]))
  })

  it("ws 事务块归属反查：命中编译模型索引时返回真实文档 id，未命中回退空串 (P0-2)", async () => {
    plugin.currentDocId = "doc-b"
    compileSpy.mockResolvedValue(makeDoc("doc-b", ["b-div-1", "b-p-1", "b-p-2"]))
    await plugin.compileCurrentDocument("doc-b", { reason: "explicit" })

    const buildTx = (ids: string[]) => ({
      cmd: "transactions",
      data: [{ doOperations: ids.map(id => ({ action: "updateAttrs", id, data: {} })) }],
    })

    expect((plugin as any).resolveAffectedDocId(buildTx(["b-p-1"]))).toBe("doc-b")
    expect((plugin as any).resolveAffectedDocId(buildTx(["unknown-block"]))).toBe("")
    expect((plugin as any).resolveAffectedDocId({ cmd: "transactions", data: [] })).toBe("")
  })

  it("编译失败保留 lastGoodDoc 并限频提示，不再用空文档清空预览 (P0-3)", async () => {
    plugin.currentDocId = "doc-b"
    const goodDoc = makeDoc("doc-b", ["b-div-1"])
    compileSpy.mockResolvedValue(goodDoc)
    await plugin.compileCurrentDocument("doc-b", { reason: "explicit" })
    expect(plugin.latestCompiledDoc).toBe(goodDoc as any)

    // 后续编译持续失败：latestCompiledDoc 必须原样保留
    compileSpy.mockRejectedValue(new Error("kernel down"))
    plugin.markCompileDirty("doc-b")
    await vi.advanceTimersByTimeAsync(200)
    await vi.advanceTimersByTimeAsync(200)

    expect(plugin.latestCompiledDoc).toBe(goodDoc as any)
    expect(mockShowMessage).toHaveBeenCalledTimes(1)
    expect((mockShowMessage as any).mock.calls[0][0]).toContain("编译失败")

    // 限频：10 秒内的再次失败不重复弹消息
    plugin.markCompileDirty("doc-b")
    await vi.advanceTimersByTimeAsync(200)
    await vi.advanceTimersByTimeAsync(200)
    expect(mockShowMessage).toHaveBeenCalledTimes(1)
  })

  it("onunload 清空脏文档集合与启动探测定时器，防止穿越卸载重排编译 (P0-5)", async () => {
    vi.spyOn(globalCompileConsumerGate, "getVisibility").mockReturnValue("none")
    plugin.markCompileDirty("doc-pending")
    expect((plugin as any).dirtyDocs.size).toBe(1)

    const timersBefore = vi.getTimerCount()
    plugin.onunload()
    expect((plugin as any).dirtyDocs.size).toBe(0)
    expect((plugin as any).startupTimers.length).toBe(0)
    // 卸载回收了启动探测定时器
    expect(vi.getTimerCount()).toBeLessThan(timersBefore)
  })

  it("eventBus 监听器注册与注销必须逐一对称（P0-4 源码级守护）", () => {
    const source = fs.readFileSync(path.join(PROJECT_ROOT, "src/index.ts"), "utf-8")
    const onEvents = [...source.matchAll(/this\.eventBus\.on\("([^"]+)"/g)].map(m => m[1])
    const offEvents = [...source.matchAll(/this\.eventBus\.off\("([^"]+)"/g)].map(m => m[1])
    expect(onEvents.length).toBeGreaterThan(0)
    expect(offEvents.sort()).toEqual([...onEvents].sort())
    // 匿名闭包禁止回归：on 的第二个参数必须是具名 bound 成员
    expect(source).not.toContain('this.eventBus.on("slides:request-compile" as any, () =>')
    expect(source).toContain('this.eventBus.on("slides:request-compile" as any, this.onRequestCompileBound)')
  })

  it("编译器失败必须上抛而非返回空文档兜底（P0-3 源码级守护）", () => {
    const source = fs.readFileSync(path.join(PROJECT_ROOT, "src/compiler/document-compiler.ts"), "utf-8")
    expect(source).not.toContain("fallbackDoc")
    expect(source).toContain("throw err")
  })
})
