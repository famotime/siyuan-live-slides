import type { ISiYuanBlockNode } from "../types/slidev-protocol"
import {
  ATTR_PAGE_LAYOUT,
  ROLE_IMAGE_LEFT,
  ROLE_IMAGE_RIGHT,
} from "../types/slidev-protocol"

/**
 * 从块的 Markdown 文本或纯文本中提取第一张图片的 URL
 */
export function extractImageUrl(markdown?: string, content?: string): string | null {
  const text = (markdown || content || "").trim()
  if (!text) return null

  // 1. Markdown 图片语法: ![alt](url "title") 或 ![alt](url)
  const mdMatch = text.match(/!\[.*?\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/)
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
 * 判断一个块是否主要为图片块
 */
export function isImageBlock(node: ISiYuanBlockNode): boolean {
  if (!node) return false

  const imgUrl = extractImageUrl(node.markdown, node.content)
  if (!imgUrl) return false

  // 排除长文章段落中偶然夹带的内联小表情/小图
  const textWithoutImg = (node.markdown || node.content || "")
    .replace(/!\[.*?\]\([^)]+\)/g, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/\{:[^}]*\}/g, "")
    .trim()

  return textWithoutImg.length < 80
}

export interface ISuperBlockImageLayout {
  imageNode: ISiYuanBlockNode
  imageUrl: string
  layout: "image-left" | "image-right"
  contentNodes: ISiYuanBlockNode[]
}

/**
 * 检测超级块是否为图文分栏组合（左图右文或左文右图）
 */
export function detectSuperBlockImageLayout(node: ISiYuanBlockNode): ISuperBlockImageLayout | null {
  if (!node) return null

  const isSb = node.type === "sb" || node.type === "NodeSuperBlock"
  if (!isSb) return null

  // 思源中 subType === "h" 或未明确为竖向（"v" / "col"）即为横向排列
  if (node.subType === "v" || node.subType === "col") {
    return null
  }

  const children = node.children || []
  if (children.length < 2) {
    return null
  }

  const firstIsImg = isImageBlock(children[0])
  const lastIsImg = isImageBlock(children[children.length - 1])

  // 1. 图左模式：首个子块为图片，后续子块包含非图片内容
  if (firstIsImg && !lastIsImg) {
    const imgUrl = extractImageUrl(children[0].markdown, children[0].content)
    if (imgUrl) {
      return {
        imageNode: children[0],
        imageUrl: imgUrl,
        layout: ROLE_IMAGE_LEFT,
        contentNodes: children.slice(1),
      }
    }
  }

  // 2. 图右模式：首个子块为非图片，末尾子块为图片
  if (!firstIsImg && lastIsImg) {
    const imgUrl = extractImageUrl(children[children.length - 1].markdown, children[children.length - 1].content)
    if (imgUrl) {
      return {
        imageNode: children[children.length - 1],
        imageUrl: imgUrl,
        layout: ROLE_IMAGE_RIGHT,
        contentNodes: children.slice(0, children.length - 1),
      }
    }
  }

  return null
}

export interface ITagChangeRecord {
  blockId: string
  layout: "image-left" | "image-right"
  previousLayout?: string
}

/**
 * 遍历扫描块树，为图文超级块中的图片自动标记或自适应更新 custom-slidev-layout="image-left" / "image-right"
 */
export function scanAndTagSuperBlocks(
  blocks: ISiYuanBlockNode[],
  onTagChange?: (record: ITagChangeRecord) => void,
): ITagChangeRecord[] {
  const changes: ITagChangeRecord[] = []

  function walk(nodes: ISiYuanBlockNode[]) {
    for (const node of nodes) {
      const detected = detectSuperBlockImageLayout(node)
      if (detected) {
        const { imageNode, layout } = detected
        if (!imageNode.ial) {
          imageNode.ial = {}
        }

        const currentLayout = imageNode.ial[ATTR_PAGE_LAYOUT]
        if (currentLayout !== layout) {
          const record: ITagChangeRecord = {
            blockId: imageNode.id,
            layout,
            previousLayout: currentLayout,
          }
          imageNode.ial[ATTR_PAGE_LAYOUT] = layout
          changes.push(record)
          if (onTagChange) {
            onTagChange(record)
          }
        }
      }

      if (node.children && node.children.length > 0) {
        walk(node.children)
      }
    }
  }

  walk(blocks)
  return changes
}
