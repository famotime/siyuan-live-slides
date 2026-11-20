import { describe, expect, it, vi } from "vitest"
import { InspectorSyncCoordinator } from "../src/sync/inspector-sync-coordinator"
import { globalDocumentCompiler } from "../src/compiler/document-compiler"
import * as domAttrSyncModule from "../src/sync/dom-attr-sync"
import { ApiSwitchBridge } from "../src/plugin/api-switch-bridge"
import { DEFAULT_AI_CONFIG, DEFAULT_GLOBAL_SETTINGS, getEffectiveAiConfig, setManagedAiConfig, setRuntimeSettings } from "../src/settings"

/**
 * 状态机审计 FIX-11 (P1-F)：
 * - 影子覆盖层的生命周期治理：custom-* 域过滤 + 删除事务同步清除
 * - ApiSwitchBridge.destroy 清空受管 AI 配置模块全局
 */
describe("覆盖层生命周期治理 (P1-F1)", () => {
  it("patchThematicBreakTransactions 仅同步 custom-* 键，宿主属性不再灌入覆盖层", () => {
    const syncDomSpy = vi.spyOn(domAttrSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})
    const coordinator = new InspectorSyncCoordinator()

    coordinator.patchThematicBreakTransactions({
      cmd: "transactions",
      data: [
        {
          doOperations: [
            {
              action: "updateAttrs",
              id: "block-mixed",
              data: {
                old: { bookmark: "旧书签", "custom-slides-layout": "cover" },
                new: { bookmark: "新书签", name: "新命名", "custom-slides-layout": "two-cols" },
              },
            },
          ],
        },
      ],
    })

    expect(syncDomSpy).toHaveBeenCalledTimes(1)
    const diff = syncDomSpy.mock.calls[0][1]
    expect(diff).toEqual({ "custom-slides-layout": "two-cols" })
    syncDomSpy.mockRestore()
  })

  it("属性键被移除时（old 有 new 无）下发清空 diff 并收缩覆盖层", () => {
    const syncDomSpy = vi.spyOn(domAttrSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})
    const coordinator = new InspectorSyncCoordinator()
    globalDocumentCompiler.setBlockAttrOverride("block-removal", { "custom-slides-slot": "right" })

    coordinator.patchThematicBreakTransactions({
      cmd: "transactions",
      data: [
        {
          doOperations: [
            {
              action: "updateAttrs",
              id: "block-removal",
              data: {
                old: { "custom-slides-slot": "right" },
                new: {},
              },
            },
          ],
        },
      ],
    })

    expect(syncDomSpy).toHaveBeenCalledWith("block-removal", { "custom-slides-slot": "" })
    expect(globalDocumentCompiler.getBlockAttrOverride("block-removal")).toBeUndefined()
    syncDomSpy.mockRestore()
  })

  it("块删除事务同步清除覆盖层条目", () => {
    const coordinator = new InspectorSyncCoordinator()
    globalDocumentCompiler.setBlockAttrOverride("deleted-block", {
      "custom-slides-layout": "two-cols",
      "custom-slides-slot": "header",
    })
    expect(globalDocumentCompiler.getBlockAttrOverride("deleted-block")).toBeDefined()

    coordinator.patchThematicBreakTransactions({
      cmd: "transactions",
      data: [
        { doOperations: [{ action: "delete", id: "deleted-block" }] },
      ],
    })

    expect(globalDocumentCompiler.getBlockAttrOverride("deleted-block")).toBeUndefined()
  })

  it("非 custom 键的 updateAttrs 不再触发任何 DOM 同步与覆盖层写入", () => {
    const syncDomSpy = vi.spyOn(domAttrSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})
    const setOverrideSpy = vi.spyOn(globalDocumentCompiler, "setBlockAttrOverride")
    const coordinator = new InspectorSyncCoordinator()

    coordinator.patchThematicBreakTransactions({
      cmd: "transactions",
      data: [
        { doOperations: [{ action: "updateAttrs", id: "host-attr-block", data: { old: { memo: "a" }, new: { memo: "b" } } }] },
      ],
    })

    expect(syncDomSpy).not.toHaveBeenCalled()
    expect(setOverrideSpy).not.toHaveBeenCalled()
    syncDomSpy.mockRestore()
    setOverrideSpy.mockRestore()
  })
})

describe("ApiSwitchBridge 生命周期状态重置 (P1-F2)", () => {
  it("destroy 后受管 AI 配置被清空，优先级回落到本地配置", () => {
    setRuntimeSettings({
      ...DEFAULT_GLOBAL_SETTINGS,
      aiConfig: { ...DEFAULT_AI_CONFIG, baseUrl: "http://local-fallback", apiKey: "local-key", model: "local-model" },
    })
    setManagedAiConfig({
      provider: "custom",
      baseUrl: "http://managed-host",
      apiKey: "managed-key",
      model: "managed-model",
    })

    expect(getEffectiveAiConfig()?.config.baseUrl).toBe("http://managed-host")

    ;(globalThis as any).window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      siyuanApiSwitch: {
        register: vi.fn(),
        unregister: vi.fn(),
      },
    }
    const bridge = new ApiSwitchBridge({ pluginName: "siyuan-live-slides", getSetting: () => null })
    bridge.init()
    bridge.destroy()

    expect((globalThis as any).window.siyuanApiSwitch.unregister).toHaveBeenCalledWith("siyuan-live-slides")
    expect(getEffectiveAiConfig()?.config.baseUrl).toBe("http://local-fallback")
    delete (globalThis as any).window
    setManagedAiConfig(null)
  })
})
