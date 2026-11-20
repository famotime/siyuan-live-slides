/**
 * Peek 微型浏览器纯函数工具（自 WebviewPeekDrawer 抽离）
 *
 * 职责：桌面/移动视图模式持久化（localStorage 记忆 + 内存缓存兜底）、
 * Chromium 网络错误描述到中文排查提示的映射。
 * 全部为纯函数与常量，可在纯 Node 环境直接单测。
 */

export type TViewMode = 'desktop' | 'mobile'

// 现代主流移动端 UA (iOS 17 Safari 兼容度高，能完美唤起移动端页面)
export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1'

export const STORAGE_KEY_VIEW_MODE = 'siyuan-slides-peek-view-mode'

let cachedViewMode: TViewMode = 'desktop'

export function getInitialViewMode(): TViewMode {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_VIEW_MODE)
      if (saved === 'mobile' || saved === 'desktop') {
        return saved
      }
    } catch {}
  }
  return cachedViewMode
}

export function saveViewMode(mode: TViewMode) {
  cachedViewMode = mode
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode)
    } catch {}
  }
}

export interface IPeekLoadError {
  errorCode: number
  description: string
  validatedURL: string
  hint: string
}

/**
 * 将 Chromium 网络错误描述翻译为可操作的中文排查提示
 *
 * 错误描述由 Electron did-fail-load / did-fail-provisional-load 事件给出（如 ERR_PROXY_CONNECTION_FAILED），
 * 未覆盖的错误码回退到内网环境最常见的「网络代理未配置」提示，不做臆测。
 */
export function describePeekNetError(errorDescription: string): string {
  switch ((errorDescription || '').toUpperCase()) {
    case 'ERR_PROXY_CONNECTION_FAILED':
      return '无法连接到代理服务器：请在思源「设置 → 网络代理」中填写公司代理地址，或切换为「使用系统代理」。'
    case 'ERR_TUNNEL_CONNECTION_FAILED':
      return 'HTTPS 代理隧道建立失败：请将思源「网络代理」的类型设为 HTTPS 并确认地址正确。'
    case 'ERR_MANDATORY_PROXY_CONFIGURATION_FAILED':
      return '强制代理配置获取失败：公司 PAC 脚本不可用，请在思源「网络代理」中改为手动填写代理地址。'
    case 'ERR_NAME_NOT_RESOLVED':
    case 'ERR_NAME_RESOLUTION_FAILED':
      return '域名解析失败：内网环境访问外网通常需要配置代理或 DNS。'
    case 'ERR_INTERNET_DISCONNECTED':
      return '当前网络不可用：请检查网络连接。'
    case 'ERR_CONNECTION_TIMED_OUT':
    case 'ERR_TIMED_OUT':
      return '连接超时：该地址可能需要通过代理才能访问。'
    case 'ERR_CONNECTION_REFUSED':
      return '连接被拒绝：目标服务未在监听，或思源本地内核尚未启动。'
    case 'ERR_CERT_AUTHORITY_INVALID':
    case 'ERR_CERT_COMMON_NAME_INVALID':
    case 'ERR_CERT_DATE_INVALID':
      return '证书校验失败：若公司网络使用 TLS 拦截，需将根证书导入思源所用系统的证书库。'
    default:
      return '若处于公司内网，请优先检查思源「设置 → 网络代理」是否已配置为可用代理（支持「使用系统代理」）。'
  }
}
