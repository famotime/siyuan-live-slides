/**
 * 思源本地资产相对路径代理与重写器
 * 将 assets/... 转换为思源静态服务代理 URL 或内联 Base64
 */

export interface IAssetRewriteOptions {
  /** 思源内核基础服务 URL，例如 "http://127.0.0.1:6806" 或 "" */
  baseUrl?: string
  /** 资源路径到 Base64 的映射字典（用于离线单文件导出） */
  base64Map?: Record<string, string>
}

/**
 * 判断 URL 是否为思源本地 assets 相对路径
 */
export function isLocalAssetUrl(url: string): boolean {
  if (!url) {
    return false
  }
  const clean = url.trim()
  return (
    clean.startsWith("assets/")
    || clean.startsWith("./assets/")
    || clean.startsWith("/assets/")
  )
}

/**
 * 规范化 assets 相对路径（统一去除前导 ./ 或 /）
 */
export function normalizeAssetPath(url: string): string {
  const clean = url.trim()
  if (clean.startsWith("./assets/")) {
    return clean.slice(2)
  }
  if (clean.startsWith("/assets/")) {
    return clean.slice(1)
  }
  return clean
}

/**
 * 重写单个资源 URL
 */
export function rewriteSingleAssetUrl(
  url: string,
  options?: IAssetRewriteOptions,
): string {
  if (!isLocalAssetUrl(url)) {
    return url
  }

  const normalized = normalizeAssetPath(url)

  // 1. 如果提供了 Base64 映射表，则直接替换为 Base64
  if (options?.base64Map && options.base64Map[normalized]) {
    return options.base64Map[normalized]
  }

  // 2. 如果提供了 baseUrl，拼接思源静态服务代理前缀
  if (options?.baseUrl) {
    const base = options.baseUrl.replace(/\/+$/, "")
    return `${base}/${normalized}`
  }

  return `/${normalized}`
}

/**
 * 在 Markdown / HTML 内容文本中批量重写所有 assets 路径
 */
export function rewriteAssetPaths(
  content: string,
  options?: IAssetRewriteOptions,
): string {
  if (!content) {
    return ""
  }

  let result = content

  // 1. 替换 Markdown 图片语法: ![alt](assets/xxx.png) 或 ![alt](./assets/xxx.png)（兼容文件名含成对括号及可选 title 后缀）
  result = result.replace(
    /!\[((?:\\.|[^\]\n])*)\]\(\s*((?:\.\/|\/)?assets\/[^()\s]+(?:\([^()\s]*\)[^()\s]*)*)([^()\n]*)\)/g,
    (_, alt, path, suffix) => {
      const target = rewriteSingleAssetUrl(path, options)
      return `![${alt}](${target}${suffix || ""})`
    },
  )

  // 2. 替换 HTML 标签属性: src="assets/xxx" 或 src='./assets/xxx'
  result = result.replace(
    /(<(?:img|video|audio|source)\b[^>]*?\bsrc=["'])((?:\.\/|\/)?assets\/[^"']+)(["'][^>]*>)/gi,
    (_, prefix, path, suffix) => {
      const target = rewriteSingleAssetUrl(path, options)
      return `${prefix}${target}${suffix}`
    },
  )

  // 3. 替换 CSS url('assets/xxx') 或 url("assets/xxx")
  result = result.replace(
    /(url\(\s*["']?)((?:\.\/|\/)?assets\/[^"')]+)(["']?\s*\))/gi,
    (_, prefix, path, suffix) => {
      const target = rewriteSingleAssetUrl(path, options)
      return `${prefix}${target}${suffix}`
    },
  )

  return result
}
