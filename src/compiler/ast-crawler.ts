import type { ISiYuanBlockNode } from "../types/slidev-protocol"

/**
 * 展平并规范化思源块节点列表（深度优先遍历树形结构）
 */
export function flattenBlockTree(nodes: ISiYuanBlockNode[]): ISiYuanBlockNode[] {
  const result: ISiYuanBlockNode[] = []

  function walk(list: ISiYuanBlockNode[]) {
    for (const node of list) {
      result.push(node)
      if (node.children && node.children.length > 0) {
        walk(node.children)
      }
    }
  }

  walk(nodes)
  return result
}

/**
 * 获取块的显示纯文本或 Markdown
 */
export function extractBlockMarkdown(node: ISiYuanBlockNode): string {
  if (node.markdown && node.markdown.trim()) {
    return node.markdown.trim()
  }
  if (node.content && node.content.trim()) {
    return node.content.trim()
  }
  return ""
}

/**
 * 解析 Kramdown 字符串中的思源 IAL 属性字典
 * 思源 IAL 格式例如: {: id="20231019" custom-slidev-layout="cover" updated="20231019"}
 */
export function parseKramdownIAL(ialString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (!ialString) {
    return attrs
  }

  // 匹配 {: ... } 内部的 key="value" 或 key='value'
  const clean = ialString.replace(/^\{:\s*/, "").replace(/\s*\}$/, "")
  const regex = /([\w-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(clean)) !== null) {
    const key = match[1]
    const val = match[2] ?? match[3] ?? match[4] ?? ""
    attrs[key] = val
  }

  return attrs
}
