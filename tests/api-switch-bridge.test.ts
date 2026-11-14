import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { ApiSwitchBridge } from "../src/plugin/api-switch-bridge"
import { getEffectiveAiConfig, setManagedAiConfig } from "../src/settings"

class MockWindow extends EventTarget {
  siyuanApiSwitch?: any
}

describe("ApiSwitchBridge (siyuan-api-switch 统一服务桥接器)", () => {
  beforeEach(() => {
    setManagedAiConfig(null)
    ;(globalThis as any).window = new MockWindow()
  })

  afterEach(() => {
    delete (globalThis as any).window
  })

  it("当 window.siyuanApiSwitch 已存在时，init 应立即调用 register 注册", () => {
    const registerMock = vi.fn()
    const unregisterMock = vi.fn()
    ;(window as any).siyuanApiSwitch = {
      register: registerMock,
      unregister: unregisterMock,
    }

    const bridge = new ApiSwitchBridge({
      pluginName: "test-plugin",
      displayName: "测试插件",
      getSetting: () => null,
    })

    bridge.init()
    expect(registerMock).toHaveBeenCalled()
    expect(registerMock.mock.calls[0][0]).toBe("test-plugin")
    expect(registerMock.mock.calls[0][1]).toBe("测试插件")

    bridge.destroy()
    expect(unregisterMock).toHaveBeenCalledWith("test-plugin")
  })

  it("当 window.siyuanApiSwitch 不存在时，应监听 siyuan-api-switch:ready 事件并在就绪时注册", () => {
    const registerMock = vi.fn()
    const unregisterMock = vi.fn()

    const bridge = new ApiSwitchBridge({
      pluginName: "test-plugin",
      displayName: "测试插件",
      getSetting: () => null,
    })

    bridge.init()
    expect(registerMock).not.toHaveBeenCalled()

    // 模拟远端插件就绪并分发事件
    ;(window as any).siyuanApiSwitch = {
      register: registerMock,
      unregister: unregisterMock,
    }
    window.dispatchEvent(new CustomEvent("siyuan-api-switch:ready"))

    expect(registerMock).toHaveBeenCalled()
    expect(registerMock.mock.calls[0][0]).toBe("test-plugin")

    bridge.destroy()
    expect(unregisterMock).toHaveBeenCalledWith("test-plugin")
  })

  it("同步回调触发时应更新受管配置并通知设置面板 updater", () => {
    let syncCallback: any
    const registerMock = vi.fn().mockImplementation((_name, _disp, cb) => {
      syncCallback = cb
    })

    const updateManagedConfigMock = vi.fn()
    const bridge = new ApiSwitchBridge({
      pluginName: "test-plugin",
      getSetting: () => ({
        updateManagedConfig: updateManagedConfigMock,
      }),
    })

    ;(window as any).siyuanApiSwitch = {
      register: registerMock,
      unregister: vi.fn(),
    }

    bridge.init()
    expect(typeof syncCallback).toBe("function")

    // 触发接管
    syncCallback({
      profileId: "p1",
      profileName: "DeepSeek",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-test",
      model: "deepseek-chat",
    })

    expect(updateManagedConfigMock).toHaveBeenCalled()
    expect(getEffectiveAiConfig()?.config.model).toBe("deepseek-chat")
  })
})
