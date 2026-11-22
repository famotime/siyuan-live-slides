import type { ISlidesDocument, ISlidesBlockItem } from "../types/slides-protocol"
import { escapeHtml } from "./markdown-renderer"
import { generateStandaloneExportStyles } from "./standalone-template-styles"
import { getStandaloneClientRuntimeScript } from "./standalone-client-runtime"
import { resolveEffectiveColorSchema } from "../utils/color-utils"
import { extractCleanImageUrl } from "../utils/markdown-utils"

export interface ICollectAssetsOptions {
  /** 自定义资源拉取函数（用于测试或宿主环境桥接） */
  fetcher?: (url: string) => Promise<Blob | ArrayBuffer | string | null>
  /** 是否拉取外部网络图片 (http/https)，默认 false（优先内联思源本地 assets 资源） */
  includeRemote?: boolean
}

export interface IStandaloneHtmlOptions extends ICollectAssetsOptions {
  title?: string
  inlineVueBundle?: string
  inlineAssetBase64Map?: Record<string, string>
  customInlineStyles?: any
}

/**
 * 递归扫描演示文档中包含的所有媒体资源 URL
 */
export function extractDocAssetUrls(doc: ISlidesDocument, includeRemote = false): string[] {
  const urls = new Set<string>()

  const checkAndAdd = (str?: string) => {
    if (!str || typeof str !== "string") return
    const trimmed = str.trim()
    if (!trimmed || trimmed.startsWith("data:")) return
    // 匹配包含 /assets/ 或以 assets/、./assets/ 开头的思源资源
    if (
      trimmed.includes("/assets/") ||
      trimmed.startsWith("assets/") ||
      trimmed.startsWith("./assets/") ||
      trimmed.startsWith("/assets/")
    ) {
      urls.add(trimmed)
    } else if (includeRemote && /^https?:\/\//i.test(trimmed)) {
      urls.add(trimmed)
    }
  }

  const scanText = (text?: string) => {
    if (!text || typeof text !== "string") return
    // 1. Markdown 图片语法 ![alt](url)（支持 URL 内成对括号与可选 title 后缀）
    const mdRegex = /!\[(?:\\.|[^\]\n])*\]\(([^()\n]*(?:\([^()\n]*\)[^()\n]*)*)\)/g
    let match: RegExpExecArray | null
    while ((match = mdRegex.exec(text)) !== null) {
      if (match[1]) checkAndAdd(extractCleanImageUrl(match[1]))
    }
    // 2. HTML 标签中的 src 属性
    const htmlRegex = /<(?:img|video|audio|source)\b[^>]*?\bsrc=["'](.*?)["']/gi
    while ((match = htmlRegex.exec(text)) !== null) {
      if (match[1]) checkAndAdd(match[1])
    }
    // 3. CSS 中的 url(...)
    const cssRegex = /url\(\s*["']?(.*?)["']?\s*\)/gi
    while ((match = cssRegex.exec(text)) !== null) {
      if (match[1]) checkAndAdd(match[1])
    }
  }

  const scanBlock = (b: ISlidesBlockItem) => {
    if (!b) return
    if (b.rawMarkdown) scanText(b.rawMarkdown)
    if (b.content) scanText(b.content)
    if (Array.isArray(b.children)) {
      for (const child of b.children) {
        scanBlock(child)
      }
    }
  }

  // 1. 全局配置背景
  if (doc.config?.background) {
    checkAndAdd(doc.config.background)
  }

  // 2. 遍历 slides
  for (const slide of doc.slides || []) {
    if (slide.frontmatter) {
      for (const val of Object.values(slide.frontmatter)) {
        if (typeof val === "string") {
          checkAndAdd(val)
        }
      }
    }
    if (slide.rawMarkdown) {
      scanText(slide.rawMarkdown)
    }
    if (Array.isArray(slide.blocks)) {
      for (const b of slide.blocks) {
        scanBlock(b)
      }
    }
    if (Array.isArray(slide.noteBlocks)) {
      for (const b of slide.noteBlocks) {
        scanBlock(b)
      }
    }
    if (slide.notes) {
      scanText(slide.notes)
    }
  }

  // 3. 全局 JSON 正则扫描二次兜底，确保非常规位置的 assets 资源无遗漏
  try {
    const jsonStr = JSON.stringify(doc)
    const assetRegex = /(?:https?:\/\/[^\s"'<>\)\\]+)?(?:\.\/|\/)?assets\/[^\s"'<>\)\\]+/g
    const matches = jsonStr.match(assetRegex)
    if (matches) {
      for (const m of matches) {
        checkAndAdd(m)
      }
    }
    if (includeRemote) {
      const remoteRegex = /https?:\/\/[^\s"'<>\)\\]+\.(?:png|jpe?g|gif|webp|svg|avif|ico|bmp)(?:\?[^\s"'<>\)\\]*)?/gi
      const remoteMatches = jsonStr.match(remoteRegex)
      if (remoteMatches) {
        for (const rm of remoteMatches) {
          checkAndAdd(rm)
        }
      }
    }
  } catch {}

  return Array.from(urls)
}

/**
 * 将 Blob 转换为 Base64 DataURL
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result)
        } else {
          reject(new Error("Failed to convert blob to data URL"))
        }
      }
      reader.onerror = () => reject(reader.error || new Error("FileReader error"))
      reader.readAsDataURL(blob)
    })
  }
  // Node.js fallback (用于测试与脚本环境)
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const mimeType = blob.type || "image/png"
  return `data:${mimeType};base64,${buffer.toString("base64")}`
}

/**
 * 格式化外部拉取结果为合法 Base64 DataURL
 */
async function formatFetchResultToDataUrl(
  result: Blob | ArrayBuffer | string,
): Promise<string> {
  if (typeof result === "string") {
    if (result.startsWith("data:")) return result
    return `data:image/png;base64,${result}`
  }
  if (result instanceof ArrayBuffer) {
    const blob = new Blob([result])
    return blobToDataUrl(blob)
  }
  if (result instanceof Blob) {
    return blobToDataUrl(result)
  }
  return ""
}

/**
 * 递归搜集演示文档中引用的所有本地静态资源并转换为 Base64 映射字典
 */
export async function collectDocAssetsAsBase64Map(
  doc: ISlidesDocument,
  options?: ICollectAssetsOptions,
): Promise<Record<string, string>> {
  const assetUrls = extractDocAssetUrls(doc, options?.includeRemote)
  if (assetUrls.length === 0) {
    return {}
  }

  const base64Map: Record<string, string> = {}
  const token = typeof window !== "undefined" ? (window as any).siyuan?.config?.apiToken || "" : ""
  const authHeaders: Record<string, string> = token ? { Authorization: `Token ${token}` } : {}

  for (const rawUrl of assetUrls) {
    let corePath = ""
    let isLocal = false
    const assetIdx = rawUrl.indexOf("/assets/")
    if (assetIdx !== -1) {
      corePath = rawUrl.slice(assetIdx + 1)
      isLocal = true
    } else if (rawUrl.startsWith("assets/")) {
      corePath = rawUrl
      isLocal = true
    } else if (rawUrl.startsWith("./assets/")) {
      corePath = rawUrl.slice(2)
      isLocal = true
    } else if (rawUrl.startsWith("/assets/")) {
      corePath = rawUrl.slice(1)
      isLocal = true
    }

    try {
      let dataUrl: string | null = null

      if (options?.fetcher) {
        const result = await options.fetcher(rawUrl).catch(() => null)
        if (result) {
          dataUrl = await formatFetchResultToDataUrl(result)
        } else if (corePath && corePath !== rawUrl) {
          const fallbackRes = await options.fetcher(`/${corePath}`).catch(() => null)
          if (fallbackRes) {
            dataUrl = await formatFetchResultToDataUrl(fallbackRes)
          }
        }
      } else if (typeof fetch !== "undefined") {
        const urlsToTry: Array<{ url: string; headers?: Record<string, string> }> = []
        if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
          urlsToTry.push({ url: rawUrl, headers: isLocal ? authHeaders : undefined })
        }
        if (isLocal && corePath) {
          urlsToTry.push({ url: `/${corePath}`, headers: authHeaders })
          urlsToTry.push({ url: `./${corePath}`, headers: authHeaders })
          urlsToTry.push({ url: corePath, headers: authHeaders })
        }
        if (!isLocal) {
          urlsToTry.push({ url: rawUrl })
        }

        for (const item of urlsToTry) {
          try {
            const resp = await fetch(item.url, {
              credentials: "include",
              headers: item.headers,
            })
            if (resp.ok) {
              const blob = await resp.blob()
              dataUrl = await blobToDataUrl(blob)
              if (dataUrl) break
            }
          } catch {
            // 继续尝试备用地址
          }
        }
      }

      if (dataUrl) {
        // 注册所有可能的引用形式，确保长路径与相对路径均能精准完整替换
        const variants = [rawUrl]
        if (corePath) {
          variants.push(`/${corePath}`, `./${corePath}`, corePath)
        }
        for (const v of variants) {
          base64Map[v] = dataUrl
          try {
            base64Map[decodeURI(v)] = dataUrl
            base64Map[encodeURI(v)] = dataUrl
          } catch {}
        }
      }
    } catch (err) {
      console.warn(`[single-html-exporter] Failed to inline asset "${rawUrl}":`, err)
    }
  }

  return base64Map
}

/**
 * 构建无外部依赖的离线单文件独立 HTML 演示包（支持 Base64 资产内联）
 */
export function buildStandaloneHtml(
  doc: ISlidesDocument,
  options?: IStandaloneHtmlOptions,
): string {
  const title = options?.title || "即现文稿"
  let processedSlides = doc.slides
  const processedConfig = { ...doc.config }
  let processedCustomThemeCss = doc.customThemeCss

  // 若提供 Base64 字典，将各块、frontmatter 及配置中匹配到的本地资产 URL 替换为 Base64
  if (options?.inlineAssetBase64Map && Object.keys(options.inlineAssetBase64Map).length > 0) {
    const map = options.inlineAssetBase64Map
    // 关键优化：按键名长度降序排序，长 URL 优先匹配替换，规避前缀截断残留 (例如 https://127.0.0.1:9031/assets/... 优先于 assets/...)
    const sortedEntries = Object.entries(map).sort((a, b) => b[0].length - a[0].length)

    const replaceText = (text: string): string => {
      if (!text || typeof text !== "string") return text
      let res = text
      for (const [key, b64] of sortedEntries) {
        if (res.includes(key)) {
          res = res.split(key).join(b64)
        }
      }
      return res
    }

    const replaceInBlock = (b: ISlidesBlockItem): ISlidesBlockItem => {
      const rawMarkdown = replaceText(b.rawMarkdown || "")
      const content = replaceText(b.content || "")
      const children = Array.isArray(b.children)
        ? b.children.map(child => replaceInBlock(child))
        : b.children
      return {
        ...b,
        rawMarkdown,
        content,
        children,
      }
    }

    if (processedConfig.background && typeof processedConfig.background === "string") {
      processedConfig.background = replaceText(processedConfig.background)
    }

    if (processedCustomThemeCss) {
      processedCustomThemeCss = replaceText(processedCustomThemeCss)
    }

    processedSlides = (doc.slides || []).map(slide => {
      const slideMd = replaceText(slide.rawMarkdown || "")
      const newBlocks = (slide.blocks || []).map(replaceInBlock)
      const newNoteBlocks = Array.isArray(slide.noteBlocks)
        ? slide.noteBlocks.map(replaceInBlock)
        : slide.noteBlocks
      const notes = replaceText(slide.notes || "")

      const frontmatter = slide.frontmatter ? { ...slide.frontmatter } : slide.frontmatter
      if (frontmatter) {
        for (const [key, val] of Object.entries(frontmatter)) {
          if (typeof val === "string") {
            frontmatter[key] = replaceText(val)
          }
        }
      }

      return {
        ...slide,
        rawMarkdown: slideMd,
        blocks: newBlocks,
        noteBlocks: newNoteBlocks,
        notes,
        frontmatter,
      }
    })
  }

  const effectiveTheme = resolveEffectiveColorSchema(processedConfig.colorSchema)
  const slidesJson = JSON.stringify(processedSlides)
  const configJson = JSON.stringify({
    ...processedConfig,
    hostThemeMode: processedConfig.hostThemeMode || effectiveTheme,
  })

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${generateStandaloneExportStyles(options?.customInlineStyles)}
  </style>
  <script>
    // 注入演示数据载荷
    window.__SLIDES_DATA__ = {
      docId: ${JSON.stringify(doc.docId)},
      slides: ${slidesJson},
      config: ${configJson}
    };
  </script>
</head>
<body>
  <div id="app" data-theme="${effectiveTheme}" data-normalize-headings="${processedConfig.normalizeHeadingSizes ? 'true' : 'false'}" data-hide-unordered-markers="${processedConfig.showUnorderedListMarkers === false ? 'true' : 'false'}" data-hide-ordered-markers="${processedConfig.showOrderedListMarkers === false ? 'true' : 'false'}">
    <div class="slide-viewport slides-theme-${processedConfig.theme || 'apple-basic'}" id="viewport" data-theme="${effectiveTheme}" data-slides-theme="${processedConfig.theme || 'apple-basic'}">
      <div class="slide-content" id="slide-container"></div>
    </div>
    <div class="controls">
      <button id="btn-prev">◀ 上一页</button>
      <span id="page-num">1 / 1</span>
      <button id="btn-next">下一页 ▶</button>
      <button id="btn-fullscreen">全屏</button>
    </div>
    <!-- 全屏媒体灯箱 (Lightbox) 模态窗口 -->
    <div id="slides-lightbox" class="slides-lightbox">
      <button class="slides-lightbox-close" id="lightbox-close" aria-label="关闭 (Esc)">✕</button>
      <div class="slides-lightbox-content" id="lightbox-content"></div>
    </div>
  </div>

  <script>
${getStandaloneClientRuntimeScript()}
  </script>
</body>
</html>`
}

/**
 * 完整导出离线单文件独立 HTML 演示包（自动搜集并内联 Base64 资产）
 */
export async function exportStandaloneHtml(
  doc: ISlidesDocument,
  options?: IStandaloneHtmlOptions,
): Promise<string> {
  let assetMap = options?.inlineAssetBase64Map
  if (!assetMap || Object.keys(assetMap).length === 0) {
    assetMap = await collectDocAssetsAsBase64Map(doc, options)
  }
  return buildStandaloneHtml(doc, {
    ...options,
    inlineAssetBase64Map: assetMap,
  })
}

/**
 * 触发浏览器本地下载单文件 HTML
 */
export function downloadHtmlFile(filename: string, content: string): boolean {
  if (typeof document === "undefined") {
    return false
  }

  const blob = new Blob([content], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
