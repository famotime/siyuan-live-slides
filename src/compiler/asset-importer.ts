import JSZip from "jszip"
import type { IParsedSlidesPresentation } from "./slides-importer"

const MEDIA_EXTENSIONS = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff?|mp4|webm|mp3|wav|ogg)$/i
const CODE_EXTENSIONS = /\.(?:ts|js|mjs|cjs|jsx|tsx|vue|json|css|scss|less|html|py|rs|go|java|c|cpp|h|sh|bash|yaml|yml|toml)$/i

export interface IExtractedAssetItem {
  zipPath: string
  fileName: string
  data: Uint8Array
  blob?: Blob
}

export interface IZipExtractionResult {
  entryMarkdown: string
  entryMarkdownPath: string
  virtualFiles: Record<string, string>
  assets: IExtractedAssetItem[]
}

/**
 * 解包 Slidev 项目 Zip 压缩包，自动探索入口 slides.md、关联子页面与静态素材
 */
export async function extractSlidesZip(
  zipInput: ArrayBuffer | Blob | Uint8Array,
): Promise<IZipExtractionResult> {
  const zip = await JSZip.loadAsync(zipInput)

  const virtualFiles: Record<string, string> = {}
  const assets: IExtractedAssetItem[] = []

  let entryMarkdown = ""
  let entryMarkdownPath = ""

  // 1. 遍历 Zip 内所有文件
  const fileEntries: Array<{ path: string; file: JSZip.JSZipObject }> = []
  zip.forEach((relPath, file) => {
    if (!file.dir && !relPath.startsWith("__MACOSX") && !relPath.includes("node_modules/")) {
      fileEntries.push({ path: relPath, file })
    }
  })

  // 2. 查找入口 slides.md (优先根目录 slides.md，其次 starter/slides.md，最后任意首个 slides.md)
  let foundEntry = fileEntries.find(e => e.path.toLowerCase() === "slides.md")
  if (!foundEntry) {
    foundEntry = fileEntries.find(e => e.path.toLowerCase().endsWith("/slides.md"))
  }
  if (!foundEntry) {
    // 降级：找第一个 .md 文件
    foundEntry = fileEntries.find(e => e.path.toLowerCase().endsWith(".md"))
  }

  if (foundEntry) {
    entryMarkdown = await foundEntry.file.async("string")
    entryMarkdownPath = foundEntry.path
  }

  // 3. 读取子页面与其他 Markdown 文本以及媒体资产
  for (const entry of fileEntries) {
    const p = entry.path
    if (p.toLowerCase().endsWith(".md") || CODE_EXTENSIONS.test(p) || p.includes("snippets/")) {
      const text = await entry.file.async("string")
      virtualFiles[p] = text
      // 同时记录去除根目录前缀的相对路径 (如 starter/pages/01.md -> pages/01.md)
      const segments = p.split("/")
      if (segments.length > 1) {
        virtualFiles[segments.slice(1).join("/")] = text
      }
    } else if (MEDIA_EXTENSIONS.test(p)) {
      const bytes = await entry.file.async("uint8array")
      const fileName = p.split("/").pop() || p
      const blob = typeof Blob !== "undefined" ? new Blob([bytes as any]) : undefined
      assets.push({
        zipPath: p,
        fileName,
        data: bytes,
        blob,
      })
    }
  }

  return {
    entryMarkdown,
    entryMarkdownPath,
    virtualFiles,
    assets,
  }
}

/**
 * 重写演示包中的媒体路径为思源资产路径 (assets/...)
 * 覆盖：Markdown 正文图片、HTML <img> 标签、页面 custom-slides-background 属性
 */
export function rewritePresentationAssetPaths(
  presentation: IParsedSlidesPresentation,
  assetPathMap: Record<string, string>,
): IParsedSlidesPresentation {
  if (Object.keys(assetPathMap).length === 0) {
    return presentation
  }

  // 归一化路径查找器
  function resolveSiyuanPath(rawUrl: string): string | null {
    const clean = rawUrl.trim().replace(/^['"]|['"]$/g, "")
    const fileName = clean.split(/[\\/]/).pop() || clean

    // 1. 完整匹配
    if (assetPathMap[clean]) return assetPathMap[clean]
    // 2. 去除前导 ./ 或 /
    const noLeading = clean.replace(/^\.?\//, "")
    if (assetPathMap[noLeading]) return assetPathMap[noLeading]
    // 3. 文件名直接匹配
    if (assetPathMap[fileName]) return assetPathMap[fileName]

    return null
  }

  function rewriteContentString(content: string): string {
    let replaced = content

    // 替换 Markdown 图片语法: ![alt](url)
    replaced = replaced.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
      const target = resolveSiyuanPath(url)
      return target ? `![${alt}](${target})` : match
    })

    // 替换 HTML 标签: src="url"
    replaced = replaced.replace(/\bsrc=["'](.*?)["']/gi, (match, url) => {
      const target = resolveSiyuanPath(url)
      return target ? `src="${target}"` : match
    })

    return replaced
  }

  // 逐页重写正文与页面属性 (background, image, mask 等)
  for (const slide of presentation.slides) {
    slide.rawMarkdown = rewriteContentString(slide.rawMarkdown)

    for (const key of ["custom-slides-background", "custom-slides-image", "custom-slides-mask"]) {
      if (slide.pageAttrs[key]) {
        const target = resolveSiyuanPath(slide.pageAttrs[key])
        if (target) {
          slide.pageAttrs[key] = target
        }
      }
    }
  }

  // 重写整篇平铺 Markdown
  presentation.flattenedMarkdown = rewriteContentString(presentation.flattenedMarkdown)

  // 重写文档根属性中的背景与图片
  for (const key of ["custom-slides-background", "custom-slides-image"]) {
    if (presentation.docRootAttrs[key]) {
      const target = resolveSiyuanPath(presentation.docRootAttrs[key])
      if (target) {
        presentation.docRootAttrs[key] = target
      }
    }
  }

  // 重写块属性绑定中的静态资源引用 (即现演示文档)
  const blockBindings = (presentation as any).blockAttrBindings
  if (Array.isArray(blockBindings)) {
    for (const binding of blockBindings) {
      if (binding.attrs) {
        for (const [k, v] of Object.entries(binding.attrs)) {
          if (typeof v === "string") {
            const target = resolveSiyuanPath(v)
            if (target) {
              binding.attrs[k] = target
            }
          }
        }
      }
    }
  }

  return presentation
}
