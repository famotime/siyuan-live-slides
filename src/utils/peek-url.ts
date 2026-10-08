import { isLocalAssetUrl, normalizeAssetPath } from "../compiler/assets-rewriter"

/**
 * 沉浸式速览抽屉（微型浏览器）URL 归一化
 *
 * 抽屉内的 webview / iframe 只能承载 HTTP(S) 地址，而演示文稿里的「本地 HTML 链接」
 * 可能是思源资产相对路径、工作区文件绝对路径或 file:// 协议地址，因此需要统一收敛为
 * 思源内核自身伺服的可加载地址：
 *   - <workspace>/data/assets/xxx.html  ->  /assets/xxx.html
 *   - <workspace>/data/plugins/<n>/...  ->  /plugins/<n>/...
 */

export interface IPeekUrlResolution {
  /** 归一化后的加载地址；external 为 true 时为原始地址，仅供外跳使用 */
  url: string
  /** true 表示抽屉内无法加载（如工作区之外的本地文件），应交由系统默认浏览器打开 */
  external: boolean
}

/** 已知网络/应用协议：命中则不再按本地相对路径处理，避免误伤 localhost:8080 这类裸主机输入 */
const KNOWN_SCHEME_RE = /^(https?|file|data|blob|mailto|tel|ftp|ftps|siyuan|about|chrome|ws|wss):/i

/** 常见文件扩展名：用于区分 demo.html（文件）与 example.com（裸域名） */
const FILE_EXT_RE = /\.(html?|xhtml|pdf|png|jpe?g|gif|svg|webp|avif|ico|mp4|webm|mov|mp3|wav|m4a|ogg|json|md|markdown|txt|csv|zip|tar|gz|7z|rar|js|mjs|css|xml|yaml|yml|toml|ipynb|docx?|xlsx?|pptx?)$/i

/**
 * 判断是否为「演示文稿内的本地 HTML 链接」
 * 仅放行无协议（或 file: 协议）且以 .html/.htm 结尾的链接，其余（锚点、mailto、远端地址）保持原生行为
 */
export function isLocalHtmlHref(href: string): boolean {
  const clean = (href || "").trim()
  if (!clean || clean.startsWith("#")) {
    return false
  }
  if (!/\.html?($|[?#])/i.test(clean)) {
    return false
  }
  if (/^https?:\/\//i.test(clean) || clean.startsWith("//")) {
    return false
  }
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(clean)
  if (!scheme) {
    return true
  }
  const schemeName = scheme[1].toLowerCase()
  if (schemeName === "file") {
    return true
  }
  // Windows 盘符路径（D:\docs\demo.html）并非协议前缀
  return schemeName.length === 1 && /^[a-zA-Z]:[\\/]/.test(clean)
}

/**
 * 将本地文件系统绝对路径映射为思源内核可伺服的 HTTP 路径
 * 映射失败（工作区之外的文件）返回 null
 */
export function mapFilePathToKernelUrl(filePath: string): string | null {
  let normalized = filePath || ""
  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // 非法百分号编码时按原文处理
  }
  normalized = normalized.replace(/\\/g, "/")

  const assetMatch = /(?:^|\/)data\/assets\/(.+)$/i.exec(normalized)
  if (assetMatch) {
    return `/assets/${assetMatch[1]}`
  }

  const pluginMatch = /(?:^|\/)data\/plugins\/(.+)$/i.exec(normalized)
  if (pluginMatch) {
    return `/plugins/${pluginMatch[1]}`
  }

  return null
}

/**
 * file:// 地址转文件系统绝对路径（供 shell.openPath 使用）
 */
export function fileUrlToPath(fileUrl: string): string {
  const withoutScheme = (fileUrl || "").replace(/^file:\/\//i, "")
  let path = withoutScheme
  try {
    path = decodeURIComponent(withoutScheme)
  } catch {
    // 非法百分号编码时按原文处理
  }
  if (path.startsWith("/")) {
    // Windows: file:///D:/a.html -> /D:/a.html -> D:/a.html
    const windowsDrive = /^\/([a-zA-Z]:[\\/])/.exec(path)
    return windowsDrive ? path.slice(1) : path
  }
  // file://host/share/a.html -> /share/a.html（UNC 主机名部分交由系统解析）
  const slashIndex = path.indexOf("/")
  return slashIndex >= 0 ? path.slice(slashIndex) : path
}

/**
 * 判断输入是否形如裸主机（example.com、localhost:8080、192.168.1.10:6806/foo），需补全 https://
 */
function looksLikeBareHost(clean: string): boolean {
  const hostPart = clean.split(/[/?#]/)[0]
  if (!hostPart || FILE_EXT_RE.test(hostPart)) {
    return false
  }
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?$/i.test(hostPart)) {
    return true
  }
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i.test(hostPart)
}

/**
 * 为思源本地 HTML 资源补全 ?iframe=true 参数
 *
 * 内核在 serve.go 的 secureAssetContentHeaders 中规定：仅当资源地址被判定为 HTML IFrame 渲染地址
 * （见 model.IsHTMLAssetIFrameSrc，要求查询参数 iframe=true 且路径为 assets/*.html）时，才以
 * text/html + CSP(sandbox allow-scripts; frame-ancestors 'self') 内联输出；否则 HTML 属于
 * assetInlineMediaType 未列出的类型，会被强制加上 Content-Disposition: attachment 触发下载。
 * 该约定与思源前端 app/src/asset/html.ts 的 getHTMLAssetIFrameSrc 完全一致。
 */
export function withHTMLAssetIFrameParam(url: string): string {
  const hashIndex = url.indexOf("#")
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : ""
  const pathAndQuery = hashIndex >= 0 ? url.slice(0, hashIndex) : url
  const queryIndex = pathAndQuery.indexOf("?")
  const pathPart = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery
  const rawQuery = queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : ""

  if (!/^\/?assets\/.+\.html?$/i.test(pathPart)) {
    return url
  }

  const params = new URLSearchParams(rawQuery)
  // 显式要求下载的链接保持作者的原始意图
  if (params.get("iframe") === "true" || params.get("download") === "true") {
    return url
  }

  params.set("iframe", "true")
  return `${pathPart}?${params.toString()}${hash}`
}

/**
 * 归一化速览目标地址
 * 输入可以是链接 href，也可以是地址栏手动输入的地址
 */
export function resolvePeekUrl(rawHref: string): IPeekUrlResolution {
  const resolution = resolvePeekUrlRaw(rawHref)
  if (resolution.external || !resolution.url) {
    return resolution
  }
  return { url: withHTMLAssetIFrameParam(resolution.url), external: false }
}

function resolvePeekUrlRaw(rawHref: string): IPeekUrlResolution {
  const clean = (rawHref || "").trim()
  if (!clean) {
    return { url: "", external: false }
  }

  // 1. 远端地址：抽屉可直接承载
  if (/^https?:\/\//i.test(clean)) {
    return { url: clean, external: false }
  }
  if (clean.startsWith("//")) {
    return { url: `https:${clean}`, external: false }
  }
  if (/^(siyuan|data|blob|about):/i.test(clean)) {
    return { url: clean, external: false }
  }

  // 2. 思源资产相对路径：assets/xxx.html 统一指向内核 /assets/ 静态服务
  if (isLocalAssetUrl(clean)) {
    return { url: `/${normalizeAssetPath(clean)}`, external: false }
  }

  // 3. file:// 协议地址：可映射进工作区则原位速览，否则外跳
  if (/^file:/i.test(clean)) {
    const mapped = mapFilePathToKernelUrl(fileUrlToPath(clean))
    return mapped ? { url: mapped, external: false } : { url: clean, external: true }
  }

  // 4. Windows 盘符与 UNC 绝对路径
  if (/^[a-zA-Z]:[\\/]/.test(clean) || clean.startsWith("\\\\")) {
    const mapped = mapFilePathToKernelUrl(clean)
    return mapped ? { url: mapped, external: false } : { url: clean, external: true }
  }

  // 5. 其它应用协议（mailto:/tel: 等）抽屉无法承载
  if (KNOWN_SCHEME_RE.test(clean)) {
    return { url: clean, external: true }
  }

  // 6. 裸主机输入（地址栏场景）补全 https://
  if (looksLikeBareHost(clean)) {
    return { url: `https://${clean}`, external: false }
  }

  // 7. 相对路径：以思源内核为根拼接（/plugins/... 等内核路由由此命中）
  const relative = clean.replace(/^(?:\.{1,2}\/)+/, "").replace(/^\/+/, "")
  return { url: `/${relative}`, external: false }
}
