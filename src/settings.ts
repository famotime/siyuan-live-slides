import { reactive } from 'vue'

export interface ISlidesGlobalSettings {
  enableWebServeJump: boolean
  webServeUrl: string
  normalizeHeadingSizes: boolean
  showUnorderedListMarkers: boolean
  showOrderedListMarkers: boolean
}

export const SETTINGS_STORAGE_NAME = 'slides-config.json'

export const DEFAULT_GLOBAL_SETTINGS: ISlidesGlobalSettings = {
  enableWebServeJump: false,
  webServeUrl: 'http://127.0.0.1:6806',
  normalizeHeadingSizes: false,
  showUnorderedListMarkers: true,
  showOrderedListMarkers: true,
}

export const globalSettingsState = reactive<ISlidesGlobalSettings>({
  ...DEFAULT_GLOBAL_SETTINGS,
})

export function normalizeGlobalSettings(val: unknown): ISlidesGlobalSettings {
  if (!val || typeof val !== 'object') {
    return { ...DEFAULT_GLOBAL_SETTINGS }
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
