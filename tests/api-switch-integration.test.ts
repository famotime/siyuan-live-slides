import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildAiForwardProxyHeaders,
  callOpenAiChatCompletion,
  extractOpenAiTextContent,
  requestAiChat,
  testAiConnection,
} from "../src/ai/ai-service"
import {
  DEFAULT_AI_CONFIG,
  getEffectiveAiConfig,
  isAiConfigComplete,
  normalizeAiConfig,
  setManagedAiConfig,
  setRuntimeSettings,
} from "../src/settings"
import type { SharedConfig } from "../src/types/api-switch"
import { createSlidesSettings } from "../src/ui/settings/slides-settings"

// 轻量 DOM 模拟器，用于在纯 Node 运行环境中测试原生 DOM 构造
class MockDOMElement {
  tagName: string
  className = ""
  style: any = {}
  dataset: Record<string, string> = {}
  value = ""
  disabled = false
  type = ""
  checked = false
  placeholder = ""
  textContent = ""
  private _innerHTML = ""
  get innerHTML() {
    return this._innerHTML
  }
  set innerHTML(val: string) {
    this._innerHTML = val
    if (!val) {
      this.children = []
    }
  }
  children: MockDOMElement[] = []
  listeners: Record<string, Array<(...args: any[]) => void>> = {}
  attributes: Record<string, string> = {}

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase()
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? null
  }

  appendChild(child: MockDOMElement) {
    this.children.push(child)
    return child
  }

  addEventListener(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }

  removeEventListener(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners[event]) return
    this.listeners[event] = this.listeners[event].filter(f => f !== fn)
  }

  dispatchEvent(event: string) {
    const list = this.listeners[event] || []
    for (const fn of list) {
      fn({ target: this, preventDefault: () => {} })
    }
  }

  querySelector(selector: string): MockDOMElement | null {
    if (selector.startsWith(".")) {
      const cls = selector.slice(1)
      if (this.className.split(/\s+/).includes(cls)) return this
    } else if (selector.startsWith("[") && selector.endsWith("]")) {
      const match = selector.match(/\[([a-zA-Z0-9_-]+)="([^"]+)"\]/)
      if (match) {
        const [, key, val] = match
        if (key === "data-setting-key" && this.dataset.settingKey === val) return this
      }
    }

    for (const child of this.children) {
      const found = child.querySelector(selector)
      if (found) return found
    }
    return null
  }
}

class MockDOMDocument extends MockDOMElement {
  visibilityState = "visible"
  constructor() {
    super("#document")
  }
  createElement(tag: string) {
    return new MockDOMElement(tag)
  }
}

class MockWindow extends EventTarget {
  siyuanApiSwitch?: any
  siyuan = { config: { lang: "zh_CN" } }
}

describe("siyuan-api-switch 集成与 AI 服务全链路测试", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setManagedAiConfig(null)
    setRuntimeSettings({
      aiConfig: { ...DEFAULT_AI_CONFIG },
    })

    const mockWin = new MockWindow()
    const mockDoc = new MockDOMDocument()
    ;(globalThis as any).window = mockWin
    ;(globalThis as any).document = mockDoc
  })

  afterEach(() => {
    delete (globalThis as any).window
    delete (globalThis as any).document
  })

  describe("1. AI 配置归一化与有效性校验 (Settings Core)", () => {
    it("normalizeAiConfig 应安全处理非法输入并赋予默认参数", () => {
      const def = normalizeAiConfig(null)
      expect(def).toEqual(DEFAULT_AI_CONFIG)

      const partial = normalizeAiConfig({
        baseUrl: " https://api.deepseek.com/v1/ ",
        apiKey: " sk-test-key ",
        model: " deepseek-chat ",
        temperature: 1.5,
        requestTimeoutSeconds: 45,
        maxTokens: 2048,
      })
      expect(partial.baseUrl).toBe("https://api.deepseek.com/v1/")
      expect(partial.apiKey).toBe("sk-test-key")
      expect(partial.model).toBe("deepseek-chat")
      expect(partial.temperature).toBe(1.5)
      expect(partial.requestTimeoutSeconds).toBe(45)
      expect(partial.maxTokens).toBe(2048)
    })

    it("isAiConfigComplete 应准确判断配置三要素是否齐全", () => {
      expect(isAiConfigComplete(null)).toBe(false)
      expect(isAiConfigComplete({ baseUrl: "", apiKey: "", model: "" })).toBe(false)
      expect(isAiConfigComplete({ baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o" })).toBe(false)
      expect(
        isAiConfigComplete({
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-123",
          model: "gpt-4o",
        })
      ).toBe(true)
    })

    it("getEffectiveAiConfig 应严格遵循 旋钮接管 > 本地自定义 > null 的优先级契约", () => {
      // 场景 1：完全未配置
      expect(getEffectiveAiConfig()).toBeNull()

      // 场景 2：仅配置本地自定义 API
      setRuntimeSettings({
        aiConfig: {
          baseUrl: "https://api.local.com/v1",
          apiKey: "local-key",
          model: "local-model",
          requestTimeoutSeconds: 30,
          temperature: 0.5,
          maxTokens: 1000,
        },
      })
      const effectiveLocal = getEffectiveAiConfig()
      expect(effectiveLocal).not.toBeNull()
      expect(effectiveLocal?.isManaged).toBe(false)
      expect(effectiveLocal?.config.baseUrl).toBe("https://api.local.com/v1")
      expect(effectiveLocal?.config.apiKey).toBe("local-key")

      // 场景 3：API 旋钮接入接管，应优先读取接管配置并合并自定义 headers
      const managedMock: SharedConfig = {
        profileId: "profile-1",
        profileName: "DeepSeek-V3 生产环境",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-managed-key",
        model: "deepseek-chat",
        headers: {
          "X-Custom-Auth": "gateway-token-123",
          "HTTP-Referer": "https://siyuan.io",
        },
      }
      setManagedAiConfig(managedMock)

      const effectiveManaged = getEffectiveAiConfig()
      expect(effectiveManaged).not.toBeNull()
      expect(effectiveManaged?.isManaged).toBe(true)
      expect(effectiveManaged?.profileName).toBe("DeepSeek-V3 生产环境")
      expect(effectiveManaged?.config.baseUrl).toBe("https://api.deepseek.com/v1")
      expect(effectiveManaged?.config.apiKey).toBe("sk-managed-key")
      expect(effectiveManaged?.config.headers?.["X-Custom-Auth"]).toBe("gateway-token-123")

      // 场景 4：API 旋钮解绑 (callback(null))，恢复本地配置
      setManagedAiConfig(null)
      const afterUnbind = getEffectiveAiConfig()
      expect(afterUnbind?.isManaged).toBe(false)
      expect(afterUnbind?.config.baseUrl).toBe("https://api.local.com/v1")
    })
  })

  describe("2. AI 通信层 Headers 合并与 forwardProxy 转发", () => {
    it("buildAiForwardProxyHeaders 应正确构造 Authorization 并合并自定义 Headers", () => {
      const headers = buildAiForwardProxyHeaders({
        apiKey: "sk-test-token",
        headers: {
          "X-Proxy-Gateway": "vip-route",
          "OpenRouter-Title": "SiYuan Live Slides",
        },
      })
      expect(headers).toEqual([
        { "content-type": "application/json" },
        { Authorization: "Bearer sk-test-token" },
        { Accept: "application/json" },
        { "X-Proxy-Gateway": "vip-route" },
        { "OpenRouter-Title": "SiYuan Live Slides" },
      ])
    })

    it("extractOpenAiTextContent 应能从 OpenAI 兼容 JSON 中提取 choices.message.content", () => {
      expect(extractOpenAiTextContent(null)).toBeNull()
      expect(extractOpenAiTextContent({})).toBeNull()
      expect(
        extractOpenAiTextContent({
          choices: [
            {
              message: {
                role: "assistant",
                content: "这是提词卡正文",
              },
            },
          ],
        })
      ).toBe("这是提词卡正文")

      // 兼容 completion 接口 text 字段
      expect(
        extractOpenAiTextContent({
          choices: [
            {
              text: "这是直接返回的文本",
            },
          ],
        })
      ).toBe("这是直接返回的文本")
    })

    it("callOpenAiChatCompletion 应通过 forwardProxy 成功发送请求并返回结果", async () => {
      const apiModule = await import("../src/api")
      const forwardSpy = vi.spyOn(apiModule, "forwardProxy").mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({
          choices: [{ message: { content: "AI 演讲提词：第一步开场..." } }],
        }),
      })

      const reply = await callOpenAiChatCompletion(
        [{ role: "user", content: "请生成提词" }],
        {
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-key",
          model: "gpt-4o",
          requestTimeoutSeconds: 30,
          temperature: 0.7,
          maxTokens: 200,
        }
      )

      expect(reply).toBe("AI 演讲提词：第一步开场...")
      expect(forwardSpy).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        "POST",
        expect.objectContaining({ model: "gpt-4o" }),
        expect.arrayContaining([{ Authorization: "Bearer sk-key" }]),
        30000,
        "application/json"
      )
    })

    it("requestAiChat 未配置时应直接返回 null（触发上层平滑降级至规则模板）", async () => {
      setManagedAiConfig(null)
      setRuntimeSettings({ aiConfig: { ...DEFAULT_AI_CONFIG } })

      const res = await requestAiChat("测试提词")
      expect(res).toBeNull()
    })

    it("testAiConnection 应返回连通成功或友好错误提示", async () => {
      // 场景 1：缺少必填字段
      const r1 = await testAiConnection({ baseUrl: "", apiKey: "" })
      expect(r1.success).toBe(false)
      expect(r1.message).toContain("配置不完整")

      // 场景 2：思源内核原生 /api/ai/testModel 直接测试成功 (梯队 1)
      const siyuanModule = await import("siyuan")
      const kernelTestSpy = vi.spyOn(siyuanModule, "fetchSyncPost").mockResolvedValueOnce({
        code: 0,
        msg: "",
        data: { matched: true, available: ["gpt-4o"] },
      })
      const rKernel = await testAiConnection({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-kernel-key",
        model: "gpt-4o",
      })
      expect(rKernel.success).toBe(true)
      expect(rKernel.message).toContain("已通过思源内核验证模型")
      expect(kernelTestSpy).toHaveBeenCalledWith(
        "/api/ai/testModel",
        expect.objectContaining({ model: "gpt-4o" })
      )

      // 场景 3：降级探针 - 成功连通 (梯队 2)
      const apiModule = await import("../src/api")
      vi.spyOn(apiModule, "forwardProxy").mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({
          choices: [{ message: { content: "OK" } }],
        }),
      })
      const r2 = await testAiConnection({
        baseUrl: "https://api.test.com/v1",
        apiKey: "sk-123",
        model: "test-model",
      })
      expect(r2.success).toBe(true)
      expect(r2.message).toContain("连接成功")

      // 场景 4：降级探针 - HTTP 401 鉴权失败
      vi.spyOn(apiModule, "forwardProxy").mockResolvedValueOnce({
        status: 401,
        body: '{"error":"Unauthorized"}',
      })
      const r3 = await testAiConnection({
        baseUrl: "https://api.test.com/v1",
        apiKey: "sk-bad",
        model: "test-model",
      })
      expect(r3.success).toBe(false)
      expect(r3.message).toContain("401")
      expect(r3.message).toContain("API Key")

      // 场景 5：降级探针 - HTTP 404 端点未找到
      vi.spyOn(apiModule, "forwardProxy").mockResolvedValueOnce({
        status: 404,
        body: "404 page not found",
      })
      const r4 = await testAiConnection({
        baseUrl: "https://api.test.com/v2/wrong",
        apiKey: "sk-key",
        model: "test-model",
      })
      expect(r4.success).toBe(false)
      expect(r4.message).toContain("404")
      expect(r4.message).toContain("Base URL")

      // 场景 6：降级探针 - HTTP 429 限流或欠费
      vi.spyOn(apiModule, "forwardProxy").mockResolvedValueOnce({
        status: 429,
        body: "Rate limit exceeded",
      })
      const r5 = await testAiConnection({
        baseUrl: "https://api.test.com/v1",
        apiKey: "sk-key",
        model: "test-model",
      })
      expect(r5.success).toBe(false)
      expect(r5.message).toContain("429")
      expect(r5.message).toContain("限流")

      // 场景 7：降级探针 - HTTP 400 模型或参数错误
      vi.spyOn(apiModule, "forwardProxy").mockResolvedValueOnce({
        status: 400,
        body: '{"error":{"message":"Model not found"}}',
      })
      const r6 = await testAiConnection({
        baseUrl: "https://api.test.com/v1",
        apiKey: "sk-key",
        model: "not-exist-model",
      })
      expect(r6.success).toBe(false)
      expect(r6.message).toContain("400")
      expect(r6.message).toContain("not-exist-model")

      // 场景 8：网络异常或思源内核代理失败
      vi.spyOn(apiModule, "forwardProxy").mockRejectedValueOnce(new Error("dial tcp: lookup fail"))
      const r7 = await testAiConnection({
        baseUrl: "https://api.unknown-dns.com/v1",
        apiKey: "sk-key",
        model: "test-model",
      })
      expect(r7.success).toBe(false)
      expect(r7.message).toContain("代理请求失败")
      expect(r7.message).toContain("dial tcp")
    })
  })

  describe("3. 演示设置面板 (openSetting) 与零刷新实时联动", () => {
    it("未接管状态下打开设置面板，输入框应为可用状态且展示本地配置", () => {
      setRuntimeSettings({
        aiConfig: {
          baseUrl: "https://api.local-setting.com/v1",
          apiKey: "local-key-999",
          model: "local-chat-model",
          requestTimeoutSeconds: 50,
          temperature: 0.8,
          maxTokens: 3000,
        },
      })

      const mockHost = {
        name: "siyuan-live-slides",
        displayName: "即现",
        saveGlobalSettings: vi.fn().mockResolvedValue({}),
      }

      const setting = createSlidesSettings(mockHost as any)
      const el = setting.element as MockDOMElement

      const baseUrlInput = el.querySelector('[data-setting-key="ai-base-url"]') as MockDOMElement
      const apiKeyInput = el.querySelector('[data-setting-key="ai-api-key"]') as MockDOMElement
      const modelInput = el.querySelector('[data-setting-key="ai-model"]') as MockDOMElement
      const tip = el.querySelector(".api-switch-managed-tip")

      expect(tip).toBeNull()
      expect(baseUrlInput.disabled).toBe(false)
      expect(baseUrlInput.value).toBe("https://api.local-setting.com/v1")
      expect(apiKeyInput.disabled).toBe(false)
      expect(apiKeyInput.value).toBe("local-key-999")
      expect(modelInput.disabled).toBe(false)
      expect(modelInput.value).toBe("local-chat-model")
    })

    it("接管状态下打开设置面板，应展示接管横幅并将输入框全部置灰只读", () => {
      const managed: SharedConfig = {
        profileId: "p-managed",
        profileName: "DeepSeek 官方通道",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-managed-abc",
        model: "deepseek-reasoner",
      }
      setManagedAiConfig(managed)

      const mockHost = {
        name: "siyuan-live-slides",
        displayName: "即现",
        saveGlobalSettings: vi.fn().mockResolvedValue({}),
      }

      const setting = createSlidesSettings(mockHost as any)
      const el = setting.element as MockDOMElement

      const tip = el.querySelector(".api-switch-managed-tip")
      expect(tip).not.toBeNull()
      expect(tip?.innerHTML).toContain("DeepSeek 官方通道")
      expect(tip?.innerHTML).toContain("API 旋钮 (siyuan-api-switch)")
      expect(tip?.innerHTML).toContain("接管")

      const baseUrlInput = el.querySelector('[data-setting-key="ai-base-url"]') as MockDOMElement
      const apiKeyInput = el.querySelector('[data-setting-key="ai-api-key"]') as MockDOMElement
      const modelInput = el.querySelector('[data-setting-key="ai-model"]') as MockDOMElement

      expect(baseUrlInput.disabled).toBe(true)
      expect(baseUrlInput.value).toBe("https://api.deepseek.com/v1")
      expect(apiKeyInput.disabled).toBe(true)
      expect(apiKeyInput.value).toBe("sk-managed-abc")
      expect(modelInput.disabled).toBe(true)
      expect(modelInput.value).toBe("deepseek-reasoner")
    })

    it("updateManagedConfig 应支持在弹窗打开时零刷新动态置灰与解绑恢复", () => {
      const mockHost = {
        name: "siyuan-live-slides",
        displayName: "即现",
        saveGlobalSettings: vi.fn().mockResolvedValue({}),
      }

      const setting = createSlidesSettings(mockHost as any)
      const el = setting.element as MockDOMElement
      const updater = (setting as any).updateManagedConfig

      expect(typeof updater).toBe("function")

      // 1. 外部旋钮广播接管
      updater({
        profileId: "p-2",
        profileName: "Claude 3.5 专线",
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: "sk-ant-123",
        model: "claude-3-5-sonnet",
      })

      let tip = el.querySelector(".api-switch-managed-tip")
      expect(tip).not.toBeNull()
      expect(tip?.innerHTML).toContain("Claude 3.5 专线")
      let baseUrlInput = el.querySelector('[data-setting-key="ai-base-url"]') as MockDOMElement
      expect(baseUrlInput.disabled).toBe(true)
      expect(baseUrlInput.value).toBe("https://api.anthropic.com/v1")

      // 2. 外部旋钮广播解绑
      updater(null)
      tip = el.querySelector(".api-switch-managed-tip")
      expect(tip).toBeNull()
      baseUrlInput = el.querySelector('[data-setting-key="ai-base-url"]') as MockDOMElement
      expect(baseUrlInput.disabled).toBe(false)
      expect(baseUrlInput.value).toBe("") // 回退为本地值
    })

    it("设置面板应采用全宽靠左对齐与思源标准独立项布局", () => {
      const mockHost = {
        name: "siyuan-live-slides",
        displayName: "即现",
        saveGlobalSettings: vi.fn().mockResolvedValue({}),
      }

      const setting = createSlidesSettings(mockHost as any)
      const el = setting.element as MockDOMElement
      const items = (setting as any).items

      // 1. AI 演讲提词服务卡片应采用 direction: 'row' (上下纵向全宽布局)
      const aiItem = items.find((i: any) => i.title === "AI 演讲提词服务")
      expect(aiItem).toBeDefined()
      expect(aiItem.direction).toBe("row")
      expect(aiItem.actionElement.className).toContain("slides-settings__ai-panel")

      // 2. 网络伺服与排版标记应拆解为思源原生的独立项
      const webServeItem = items.find((i: any) => i.title === "启用网络伺服链接外跳")
      const webServeUrlItem = items.find((i: any) => i.title === "伺服主机地址")
      const headingItem = items.find((i: any) => i.title === "固定特定标题大小")
      const ulItem = items.find((i: any) => i.title === "无序列表圆点前缀标记")
      const olItem = items.find((i: any) => i.title === "有序列表数字序号标记")

      expect(webServeItem).toBeDefined()
      expect(webServeUrlItem).toBeDefined()
      expect(headingItem).toBeDefined()
      expect(ulItem).toBeDefined()
      expect(olItem).toBeDefined()

      // 开关应包裹在专用 switch-wrap 中以隔离内核副作用
      expect(webServeItem.actionElement.className).toContain("slides-settings__switch-wrap")
      expect(headingItem.actionElement.className).toContain("slides-settings__switch-wrap")
      expect(ulItem.actionElement.className).toContain("slides-settings__switch-wrap")
      expect(olItem.actionElement.className).toContain("slides-settings__switch-wrap")

      // 3. API Key 应使用眼睛图标按钮进行显隐切换
      const apiKeyWrap = el.querySelector(".slides-settings__api-key-wrap")
      expect(apiKeyWrap).not.toBeNull()
      const eyeToggle = el.querySelector(".slides-settings__api-key-toggle") as MockDOMElement
      expect(eyeToggle).not.toBeNull()
      expect(eyeToggle.innerHTML).toContain("<svg")
      expect(eyeToggle.getAttribute("aria-label")).toBe("显示 API Key")

      // 4. openSetting 调用后 Normalizer 应正常执行无报错
      expect(() => setting.open("siyuan-live-slides")).not.toThrow()
    })
  })

  describe("4. 插件生命周期与 siyuan-api-switch 事件注册交互", () => {
    it("onload 时若 window.siyuanApiSwitch 已存在，应立即调用 register 注册", async () => {
      const registerMock = vi.fn()
      const unregisterMock = vi.fn()
      ;(window as any).siyuanApiSwitch = {
        version: "1.0.0",
        register: registerMock,
        unregister: unregisterMock,
        getBoundConfig: vi.fn(),
        unbind: vi.fn(),
        updateLocalConfig: vi.fn(),
      }

      const SiYuanLiveSlidesPlugin = (await import("../src/index")).default
      const pluginInstance = new SiYuanLiveSlidesPlugin({} as any)

      await pluginInstance.onload()
      expect(registerMock).toHaveBeenCalled()
      expect(registerMock.mock.calls[0][0]).toBe("siyuan-live-slides")
      expect(typeof registerMock.mock.calls[0][2]).toBe("function") // callback sync

      // 验证 onunload 注销
      pluginInstance.onunload()
      expect(unregisterMock).toHaveBeenCalledWith("siyuan-live-slides")
    })

    it("onload 时若 window.siyuanApiSwitch 尚未注入，应监听 siyuan-api-switch:ready 事件", async () => {
      const registerMock = vi.fn()
      const SiYuanLiveSlidesPlugin = (await import("../src/index")).default
      const pluginInstance = new SiYuanLiveSlidesPlugin({} as any)

      await pluginInstance.onload()
      expect(registerMock).not.toHaveBeenCalled()

      // 模拟稍后 siyuan-api-switch 就绪并派发事件
      ;(window as any).siyuanApiSwitch = {
        version: "1.0.0",
        register: registerMock,
        unregister: vi.fn(),
        getBoundConfig: vi.fn(),
        unbind: vi.fn(),
        updateLocalConfig: vi.fn(),
      }
      window.dispatchEvent(new Event("siyuan-api-switch:ready"))

      expect(registerMock).toHaveBeenCalled()
    })

    it("openSetting 应创建 setting 实例并调用 setting.open 显示设置弹窗", async () => {
      const SiYuanLiveSlidesPlugin = (await import("../src/index")).default
      const pluginInstance = new SiYuanLiveSlidesPlugin({} as any)
      pluginInstance.name = "siyuan-live-slides"

      pluginInstance.openSetting()
      expect(pluginInstance.setting).toBeDefined()
      expect((pluginInstance.setting as any).isOpen).toBe(true)
      expect((pluginInstance.setting as any).openedName).toBe("siyuan-live-slides")
    })

    it("连续快速调用 openSetting 应触发防重节流，只创建并打开一次设置弹窗", async () => {
      const SiYuanLiveSlidesPlugin = (await import("../src/index")).default
      const pluginInstance = new SiYuanLiveSlidesPlugin({} as any)
      pluginInstance.name = "siyuan-live-slides"

      pluginInstance.openSetting()
      const firstSetting = pluginInstance.setting
      // 模拟快速二次点击，应被节流拦截，不重复创建新 Setting 实例
      pluginInstance.openSetting()
      expect(pluginInstance.setting).toBe(firstSetting)
    })
  })
})
