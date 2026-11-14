import { reactive, ref } from 'vue'
import type { SharedConfig } from './types/api-switch'

export interface IAiServiceConfig {
  baseUrl: string
  apiKey: string
  model: string
  requestTimeoutSeconds: number
  temperature: number
  maxTokens: number
}

export const DEFAULT_AI_CONFIG: IAiServiceConfig = {
  baseUrl: '',
  apiKey: '',
  model: '',
  requestTimeoutSeconds: 60,
  temperature: 0.7,
  maxTokens: 4096,
}

export interface ISlidesGlobalSettings {
  enableWebServeJump: boolean
  webServeUrl: string
  normalizeHeadingSizes: boolean
  showUnorderedListMarkers: boolean
  showOrderedListMarkers: boolean
  aiConfig: IAiServiceConfig
}

export const SETTINGS_STORAGE_NAME = 'slides-config.json'

export const DEFAULT_GLOBAL_SETTINGS: ISlidesGlobalSettings = {
  enableWebServeJump: false,
  webServeUrl: 'http://127.0.0.1:6806',
  normalizeHeadingSizes: false,
  showUnorderedListMarkers: true,
  showOrderedListMarkers: true,
  aiConfig: { ...DEFAULT_AI_CONFIG },
}

export const globalSettingsState = reactive<ISlidesGlobalSettings>({
  ...DEFAULT_GLOBAL_SETTINGS,
})

/** 由 API 旋钮 (siyuan-api-switch) 接管的共享配置（为 null 时表示未被接管） */
export const managedAiConfigState = ref<SharedConfig | null>(null)

export function setManagedAiConfig(config: SharedConfig | null): void {
  managedAiConfigState.value = config
}

export function getManagedAiConfig(): SharedConfig | null {
  return managedAiConfigState.value
}

export function normalizeAiConfig(val: unknown): IAiServiceConfig {
  if (!val || typeof val !== 'object') {
    return { ...DEFAULT_AI_CONFIG }
  }
  const c = val as Partial<IAiServiceConfig>
  return {
    baseUrl: typeof c.baseUrl === 'string' ? c.baseUrl.trim() : DEFAULT_AI_CONFIG.baseUrl,
    apiKey: typeof c.apiKey === 'string' ? c.apiKey.trim() : DEFAULT_AI_CONFIG.apiKey,
    model: typeof c.model === 'string' ? c.model.trim() : DEFAULT_AI_CONFIG.model,
    requestTimeoutSeconds:
      typeof c.requestTimeoutSeconds === 'number' && c.requestTimeoutSeconds > 0
        ? Math.floor(c.requestTimeoutSeconds)
        : DEFAULT_AI_CONFIG.requestTimeoutSeconds,
    temperature:
      typeof c.temperature === 'number' && c.temperature >= 0 && c.temperature <= 2
        ? Number(c.temperature.toFixed(2))
        : DEFAULT_AI_CONFIG.temperature,
    maxTokens:
      typeof c.maxTokens === 'number' && c.maxTokens > 0
        ? Math.floor(c.maxTokens)
        : DEFAULT_AI_CONFIG.maxTokens,
  }
}

export function isAiConfigComplete(config?: Partial<IAiServiceConfig> | null): boolean {
  if (!config) return false
  return Boolean(
    typeof config.baseUrl === 'string' && config.baseUrl.trim() &&
    typeof config.apiKey === 'string' && config.apiKey.trim() &&
    typeof config.model === 'string' && config.model.trim()
  )
}

/**
 * 获取当前生效的 AI 配置（优先级：接管配置 > 本地自定义配置 > null）
 */
export function getEffectiveAiConfig(): {
  isManaged: boolean
  profileName?: string
  config: IAiServiceConfig & { headers?: Record<string, string> }
} | null {
  const managed = managedAiConfigState.value
  if (managed && isAiConfigComplete(managed)) {
    return {
      isManaged: true,
      profileName: managed.profileName,
      config: {
        baseUrl: managed.baseUrl,
        apiKey: managed.apiKey,
        model: managed.model,
        requestTimeoutSeconds: managed.requestTimeoutSeconds ?? DEFAULT_AI_CONFIG.requestTimeoutSeconds,
        temperature: managed.temperature ?? DEFAULT_AI_CONFIG.temperature,
        maxTokens: managed.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens,
        headers: managed.headers,
      },
    }
  }

  const local = globalSettingsState.aiConfig
  if (isAiConfigComplete(local)) {
    return {
      isManaged: false,
      config: { ...local },
    }
  }

  return null
}

export function normalizeGlobalSettings(val: unknown): ISlidesGlobalSettings {
  if (!val || typeof val !== 'object') {
    return { ...DEFAULT_GLOBAL_SETTINGS, aiConfig: { ...DEFAULT_AI_CONFIG } }
  }
  const s = val as Partial<ISlidesGlobalSettings>
  return {
    enableWebServeJump: Boolean(s.enableWebServeJump),
    webServeUrl:
      typeof s.webServeUrl === 'string' && s.webServeUrl.trim()
        ? s.webServeUrl.trim()
        : DEFAULT_GLOBAL_SETTINGS.webServeUrl,
    normalizeHeadingSizes: Boolean(s.normalizeHeadingSizes),
    showUnorderedListMarkers:
      s.showUnorderedListMarkers !== undefined
        ? Boolean(s.showUnorderedListMarkers)
        : DEFAULT_GLOBAL_SETTINGS.showUnorderedListMarkers,
    showOrderedListMarkers:
      s.showOrderedListMarkers !== undefined
        ? Boolean(s.showOrderedListMarkers)
        : DEFAULT_GLOBAL_SETTINGS.showOrderedListMarkers,
    aiConfig: normalizeAiConfig(s.aiConfig),
  }
}

export function setRuntimeSettings(val: Partial<ISlidesGlobalSettings> | unknown): ISlidesGlobalSettings {
  if (!val || typeof val !== 'object') {
    return { ...globalSettingsState }
  }
  const s = val as Partial<ISlidesGlobalSettings>
  if (s.enableWebServeJump !== undefined) {
    globalSettingsState.enableWebServeJump = Boolean(s.enableWebServeJump)
  }
  if (s.webServeUrl !== undefined) {
    globalSettingsState.webServeUrl = String(s.webServeUrl)
  }
  if (s.normalizeHeadingSizes !== undefined) {
    globalSettingsState.normalizeHeadingSizes = Boolean(s.normalizeHeadingSizes)
  }
  if (s.showUnorderedListMarkers !== undefined) {
    globalSettingsState.showUnorderedListMarkers = Boolean(s.showUnorderedListMarkers)
  }
  if (s.showOrderedListMarkers !== undefined) {
    globalSettingsState.showOrderedListMarkers = Boolean(s.showOrderedListMarkers)
  }
  if (s.aiConfig !== undefined) {
    globalSettingsState.aiConfig = normalizeAiConfig(s.aiConfig)
  }
  return { ...globalSettingsState }
}

export function getRuntimeSettings(): ISlidesGlobalSettings {
  return { ...globalSettingsState }
}

/**
 * 依据思源笔记官方内核与桌面端 Web 端路由规范拼接访问链接
 * 标准格式: ${serveUrl}/stage/build/desktop/?id=${blockId}&r=${random7Chars}
 * 若处于块聚焦模式，追加 &focus=1: ${serveUrl}/stage/build/desktop/?id=${blockId}&focus=1&r=${random7Chars}
 */
export function buildSiYuanWebUrl(
  baseServeUrl: string,
  blockId: string,
  options?: { focus?: boolean; r?: string }
): string {
  const rawBase = (baseServeUrl || DEFAULT_GLOBAL_SETTINGS.webServeUrl).trim()
  const cleanBase = rawBase.startsWith('http://') || rawBase.startsWith('https://')
    ? rawBase
    : `http://${rawBase}`

  const randomR = options?.r || Math.random().toString(36).slice(2, 9).padEnd(7, '0')

  try {
    const url = new URL(cleanBase)
    let pathname = url.pathname.replace(/\/+$/, '')
    if (!pathname.endsWith('/stage/build/desktop')) {
      pathname = pathname ? `${pathname}/stage/build/desktop` : '/stage/build/desktop'
    }
    url.pathname = `${pathname}/`

    url.searchParams.set('id', blockId)
    if (options?.focus) {
      url.searchParams.set('focus', '1')
    }
    url.searchParams.set('r', randomR)

    return url.toString()
  } catch {
    const focusParam = options?.focus ? '&focus=1' : ''
    return `${cleanBase.replace(/\/+$/, '')}/stage/build/desktop/?id=${blockId}${focusParam}&r=${randomR}`
  }
}
