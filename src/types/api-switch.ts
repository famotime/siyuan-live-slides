/**
 * API 旋钮 (siyuan-api-switch) 第三方插件集成类型契约
 * 参考: siyuan-api-switch/docs/API_SWITCH_INTEGRATION_GUIDE.md
 */

export type AiProtocol = "openai" | "openai-responses" | "anthropic-messages" | "systemone"

export interface SharedConfig {
  /** 绑定的 Profile 唯一标识 */
  profileId: string
  /** Profile 显示名称，如 "DeepSeek-V3 默认" */
  profileName: string
  /** 服务商标识，如 "deepseek", "openai", "siliconflow", "custom" 等 */
  provider: string
  /** API 基础 URL，如 "https://api.deepseek.com/v1" */
  baseUrl: string
  /** API Key / 鉴权密钥 */
  apiKey: string
  /** 当前选中的主模型名称，如 "deepseek-chat" */
  model: string
  /** 候选模型列表（可选） */
  models?: string[]
  /** 通信协议（可选） */
  protocol?: AiProtocol
  /** 当前模型上下文窗口容量 tokens（可选） */
  contextWindow?: number
  /** 请求超时时间（秒，可选） */
  requestTimeoutSeconds?: number
  /** 采样温度 (0.0 - 2.0，可选) */
  temperature?: number
  /** 最大输出 Token 数（可选） */
  maxTokens?: number
  /** 自定义 HTTP Headers 字典（可选，如中转网关特定鉴权头） */
  headers?: Record<string, string>
  /** 高级参数（可选） */
  maxHistoryMessages?: number
  maxToolCallRounds?: number
  sessionTimeout?: number
  streamIdleTimeout?: number
  confirmTimeout?: number
  maxRetries?: number
  isDecisionModel?: boolean
  memo?: string
  providerUrl?: string
}

export interface PluginSlotDefinition {
  id: string
  name: string
  description?: string
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">
}

export interface RegisterPluginOptions {
  pluginId: string
  displayName: string
  callback: (config: SharedConfig | null, slotId?: string) => void
  slots?: PluginSlotDefinition[]
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">
}

export interface SiyuanApiSwitch {
  version: string
  register(
    pluginIdOrOptions: string | RegisterPluginOptions,
    displayName?: string,
    callback?: (config: SharedConfig | null, slotId?: string) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">,
    options?: { slots?: PluginSlotDefinition[] }
  ): void
  unregister(pluginId: string): void
  getBoundConfig(pluginId: string, slotId?: string): SharedConfig | null
  unbind(pluginId: string, slotId?: string): Promise<void>
  updateLocalConfig(
    pluginId: string,
    localConfig: Omit<SharedConfig, "profileId" | "profileName">,
    slotId?: string
  ): void
}

declare global {
  interface Window {
    siyuanApiSwitch?: SiyuanApiSwitch
  }
}
