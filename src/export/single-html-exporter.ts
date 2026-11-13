import type { ISlidesDocument } from "../types/slides-protocol"
import { escapeHtml } from "./markdown-renderer"
import { generateStandaloneExportStyles } from "./standalone-template-styles"
import { getStandaloneClientRuntimeScript } from "./standalone-client-runtime"
import { resolveEffectiveColorSchema } from "../utils/color-utils"

export interface IStandaloneHtmlOptions {
  title?: string
  inlineVueBundle?: string
  inlineAssetBase64Map?: Record<string, string>
  customInlineStyles?: any
}

/**
 * 构建无外部依赖的离线单文件独立 HTML 演示包（支持 Base64 资产内联）
 */
export function buildStandaloneHtml(
  doc: ISlidesDocument,
  options?: IStandaloneHtmlOptions,
): string {
  const title = options?.title || "即现演示文稿"
  let processedSlides = doc.slides

  // 若提供 Base64 字典，将各块及 frontmatter 中匹配到的本地资产 URL 替换为 Base64
  if (options?.inlineAssetBase64Map && Object.keys(options.inlineAssetBase64Map).length > 0) {
    const map = options.inlineAssetBase64Map
    processedSlides = doc.slides.map(slide => {
      let slideMd = slide.rawMarkdown
      for (const [assetPath, b64] of Object.entries(map)) {
        if (slideMd.includes(assetPath)) {
          slideMd = slideMd.split(assetPath).join(b64)
        }
      }
      const newBlocks = slide.blocks.map(b => {
        let md = b.rawMarkdown
        for (const [assetPath, b64] of Object.entries(map)) {
          if (md.includes(assetPath)) {
            md = md.split(assetPath).join(b64)
          }
        }
        return { ...b, rawMarkdown: md }
      })

      let frontmatter = slide.frontmatter ? { ...slide.frontmatter } : slide.frontmatter
      if (frontmatter) {
        if (typeof frontmatter.background === "string") {
          for (const [assetPath, b64] of Object.entries(map)) {
            if (frontmatter.background.includes(assetPath)) {
              frontmatter.background = frontmatter.background.split(assetPath).join(b64)
            }
          }
        }
        if (typeof frontmatter.image === "string") {
          for (const [assetPath, b64] of Object.entries(map)) {
            if (frontmatter.image.includes(assetPath)) {
              frontmatter.image = frontmatter.image.split(assetPath).join(b64)
            }
          }
        }
      }

      return { ...slide, rawMarkdown: slideMd, blocks: newBlocks, frontmatter }
    })
  }

  const effectiveTheme = resolveEffectiveColorSchema(doc.config.colorSchema)
  const slidesJson = JSON.stringify(processedSlides)
  const configJson = JSON.stringify({
    ...doc.config,
    hostThemeMode: doc.config.hostThemeMode || effectiveTheme,
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
  <div id="app" data-theme="${effectiveTheme}" data-normalize-headings="${doc.config.normalizeHeadingSizes ? 'true' : 'false'}" data-hide-unordered-markers="${doc.config.showUnorderedListMarkers === false ? 'true' : 'false'}" data-hide-ordered-markers="${doc.config.showOrderedListMarkers === false ? 'true' : 'false'}">
    <div class="slide-viewport slides-theme-${doc.config.theme || 'apple-basic'}" id="viewport" data-theme="${effectiveTheme}" data-slides-theme="${doc.config.theme || 'apple-basic'}">
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
