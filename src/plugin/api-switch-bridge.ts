import { getRuntimeSettings, setManagedAiConfig } from '@/settings'
import type { SharedConfig } from '@/types/api-switch'

export interface IApiSwitchBridgeOptions {
  pluginName: string
  displayName?: string
  getSetting: () => any
}

/**
 * siyuan-api-switch 统一服务桥接器
 * 负责探测外部 API 旋钮插件，完成自动注册、受管状态双向同步与优雅解绑
 */
export class ApiSwitchBridge {
  private pluginName: string
  private displayName: string
  private getSetting: () => any
  private readyHandler: (() => void) | null = null

  constructor(options: IApiSwitchBridgeOptions) {
    this.pluginName = options.pluginName
    this.displayName = options.displayName || "即现 (SiYuan Live Slides)"
    this.getSetting = options.getSetting
  }

  public init(): void {
    if (typeof window === 'undefined') return

    if (window.siyuanApiSwitch) {
      this.register()
    } else {
      this.readyHandler = () => {
        this.register()
      }
      window.addEventListener("siyuan-api-switch:ready", this.readyHandler, { once: true })
    }
  }

  private register(): void {
    if (typeof window === 'undefined' || !window.siyuanApiSwitch) return

    const sync = (shared: SharedConfig | null) => {
      setManagedAiConfig(shared)
      const setting = this.getSetting()
      if (setting) {
        const updater = setting.updateManagedConfig
        if (typeof updater === "function") {
          updater(shared)
        }
      }
    }

    const local = getRuntimeSettings().aiConfig
    const localConfig = {
      provider: "custom",
      baseUrl: local.baseUrl,
      apiKey: local.apiKey,
      model: local.model,
      requestTimeoutSeconds: local.requestTimeoutSeconds,
      temperature: local.temperature,
      maxTokens: local.maxTokens,
    }

    window.siyuanApiSwitch.register(
      this.pluginName,
      this.displayName,
      sync,
      localConfig
    )
  }

  public destroy(): void {
    if (typeof window === 'undefined') return

    if (this.readyHandler) {
      window.removeEventListener("siyuan-api-switch:ready", this.readyHandler)
      this.readyHandler = null
    }

    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.unregister(this.pluginName)
    }
  }
}
