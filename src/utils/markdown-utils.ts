import type { ISiYuanBlockNode } from "../types/slides-protocol"

/**
 * 从块的 Markdown 文本或纯文本中提取第一张图片的 URL
 * 支持标准 Markdown 图片、HTML <img> 标签以及直接图片资源路径
 */
export function extractImageUrl(markdown?: string, content?: string): string | null {
  const text = (markdown || content || "").trim()
  if (!text) return null

  // 1. Markdown 图片语法: ![alt](url) 或 ![alt](url "title") 或 ![alt](url =widthxheight)
  const mdMatch = text.match(/!\[[\s\S]*?\]\(\s*([^\s)]+)(?:\s+(?:=["']?[^"'\s)]*["']?|["'][^"']*["']))*?\s*\)/)
  if (mdMatch) {
    return mdMatch[1].trim()
  }

  // 2. HTML <img> 标签: <img ... src="url" ...>
  const imgTagMatch = text.match(/<img\b[^>]*?\bsrc=["']([^"']+)["']/i)
  if (imgTagMatch) {
    return imgTagMatch[1].trim()
  }

  // 3. 纯资源文件路径 (如 assets/foo.png 或 https://...)
  const pureUrl = text.replace(/\{:[^}]*\}/g, "").trim()
  if (/^(?:assets\/|https?:\/\/|\/|\.\.?\/)[^\s]+\.(?:png|jpe?g|gif|webp|svg|avif)(?:\?[^\s]*)?$/i.test(pureUrl)) {
    return pureUrl
  }

  return null
}

/**
 * 清洗分栏卡片中的首层列表项前缀（剥离开头的 - / * / + / 1. 等，并将首行去标记，后续行去除首层缩进）
 */
export function cleanCardListItemMarkdown(markdown: string): string {
  if (!markdown) return ""
  const lines = markdown.split(/\r?\n/)
  if (lines.length === 0) return ""

  const firstLine = lines[0]
  const firstMatch = firstLine.match(/^(\s*)(?:[-*+]|\d+\.)\s+(.*)$/)
  if (!firstMatch) {
    return markdown
  }

  const baseIndent = firstMatch[1].length
  const firstLineText = firstMatch[2].trim()
  const prefixLength = firstLine.length - firstMatch[2].length

  if (lines.length === 1) {
    return firstLineText
  }

  const resultLines = [firstLineText]
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) {
      resultLines.push("")
      continue
    }

    const spaceMatch = line.match(/^(\s*)/)
    const spaces = spaceMatch ? spaceMatch[1].length : 0

    if (spaces >= prefixLength) {
      resultLines.push(line.slice(prefixLength))
    } else if (spaces > baseIndent) {
      resultLines.push(line.slice(spaces))
    } else {
      resultLines.push(line)
    }
  }

  return resultLines.join("\n")
}

/**
 * 判断节点是否为列表项或包含列表项语法（兼容 ISiYuanBlockNode 或轻量块模型）
 */
export function isListItemNode(node?: ISiYuanBlockNode | { type?: string; markdown?: string; rawMarkdown?: string; content?: string } | null): boolean {
  if (!node) return false
  const t = (node.type || "").toLowerCase()
  if (t === "i" || t === "nodelistitem") return true
  if (t === "l" || t === "nodelist") return true
  const md = (node.markdown || (node as any).rawMarkdown || node.content || "").trim()
  if (/^(?:[-*+]|\d+\.)\s+/.test(md)) return true
  return false
}

/**
 * 将比例字符串（如 "1:2", "3:7", "1:2:1", "40% 60%"）解析转换为标准 CSS Grid grid-template-columns 样式
 */
export function parseRatioToGridCols(ratio?: string, defaultCols = 2): string {
  if (!ratio || typeof ratio !== "string") {
    return `repeat(${defaultCols}, 1fr)`
  }

  const trimmed = ratio.trim()
  if (!trimmed) {
    return `repeat(${defaultCols}, 1fr)`
  }

  // 1. 如果包含冒号分隔，如 "1:2" 或 "1:1:1" 或 "30:70"
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0)
    if (parts.length >= 2) {
      return parts.map(n => `${n}fr`).join(" ")
    }
  }

  // 2. 如果包含空格或百分比分隔，如 "40% 60%" 或 "1fr 2fr"
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length >= 2) {
    return tokens.join(" ")
  }

  return `repeat(${defaultCols}, 1fr)`
}
