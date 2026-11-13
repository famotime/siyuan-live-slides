import type {
  ISiYuanBlockNode,
} from "../types/slides-protocol"

/**
 * 规范化元素或代码块的最大限高属性
 * 支持纯数字自动补齐 px、支持百分比 % 与历史 vh 转换为幻灯片容器高度单位 cqh
 */
export function normalizeMaxHeight(maxHeight?: string): string {
  if (!maxHeight) return ""
  const trimmed = maxHeight.trim()
  if (!trimmed) return ""
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed}px`
  }
  if (/^(\d+(?:\.\d+)?)%$/.test(trimmed)) {
    return `${trimmed.slice(0, -1)}cqh`
  }
  if (/^(\d+(?:\.\d+)?)vh$/.test(trimmed)) {
    return `${trimmed.slice(0, -2)}cqh`
  }
  return trimmed
}

/**
 * 提取并清洗正文讲稿备注块的文本内容
 * 自动剥离思源 IAL 属性、容器包装 (::: tip)、行首引述符 (>)、
 * 以及常见备注标题前缀 (如 💡 **演讲备注**、Notes: 等) 和列表项符号
 */
export function extractCleanNoteText(rawMd: string): string {
  if (!rawMd) return ""
  let text = rawMd.trim()

  // 1. 移除思源 Kramdown IAL 属性标记 {: ... }
  text = text.replace(/\{:[^}]*\}/g, "").trim()

  // 2. 移除容器语法标记 ::: tip / ::: info 等
  text = text.replace(/^:::\s*[a-zA-Z0-9_-]*\s*\r?\n?/g, "")
  text = text.replace(/\r?\n?:::\s*$/g, "")

  // 3. 逐行剥离行首引述前缀 >
  const lines = text.split(/\r?\n/)
  const strippedLines = lines.map(line => {
    return line.trim().replace(/^>\s*/, "")
  })

  let cleaned = strippedLines.join("\n").trim()

  // 4. 剥离思源/Obsidian/GFM 提示块标记，如 "[!NOTE] 💡 演讲备注"、"[!TIP]" 等
  cleaned = cleaned.replace(/^\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION|[A-Za-z_-]+)\][^\r\n]*(?:\r?\n)?/i, "").trim()

  // 5. 剥离提示块标题前缀，如 "💡 **演讲备注**"、"💡 演讲备注："、"**讲稿备注**："、"Notes:" 等
  cleaned = cleaned.replace(/^(?:💡|✏️|❗|⚠️|🚨|\s*)*(?:\*\*|__)?(?:演讲备注|演讲者提词|讲稿备注|演讲提词|备注|Notes?)(?:\*\*|__)?[:：]?\s*(?:\r?\n)?/i, "").trim()

  // 6. 若是列表项（- / * / + / 1.），剥离列表符号
  cleaned = cleaned.replace(/^[-*+]\s+/, "")
  cleaned = cleaned.replace(/^\d+\.\s+/, "")

  return cleaned.trim()
}

/**
 * 获取思源块节点的标题层级 (1 - 6)，若非标题则返回 null
 */
export function getBlockHeadingLevel(node: ISiYuanBlockNode): number | null {
  // 1. 根据 subType 判断 (如 "h1", "h2", "h3", "h4", "h5", "h6")
  if (node.subType && /^h([1-6])$/i.test(node.subType)) {
    return parseInt(node.subType.slice(1), 10)
  }

  // 2. 根据 markdown 或 content 前缀判定 (如 "### Builder")
  const text = (node.markdown || node.content || "").trim()
  const headingMatch = text.match(/^(#{1,6})\s+/)
  if (headingMatch) {
    return headingMatch[1].length
  }

  // 3. 原生思源标题块 (type === "h")
  if (node.type === "h") {
    if (node.ial?.subType && /^h([1-6])$/i.test(node.ial.subType)) {
      return parseInt(node.ial.subType.slice(1), 10)
    }
    return 1
  }

  return null
}

/**
 * 三栏内容分配结果接口
 */
export interface IThreeColsDistribution<T = any> {
  col1: T[]
  col2: T[]
  col3: T[]
}

/**
 * 通用多模式 N 栏内容分配器 (支持 2 ~ N 栏)
 */
export function distributeNColumns<
  T extends {
    slot?: string
    type?: string
    subType?: string
    content?: string
    rawMarkdown?: string
    id?: string
    children?: any[]
  }
>(rem: T[], targetCols = 2): T[][] {
  const n = Math.max(2, targetCols)
  if (!rem || rem.length === 0) {
    return Array.from({ length: n }, () => [])
  }

  // 1. 检查是否存在超级块且具有子块 (在单块包裹场景下自动解包)
  if (rem.length === 1 && rem[0].children && rem[0].children.length >= 2) {
    const ch = rem[0].children as T[]
    const cols: T[][] = Array.from({ length: n }, () => [])
    const actualN = Math.min(n, ch.length)
    const baseSize = Math.floor(ch.length / actualN)
    const extra = ch.length % actualN
    let cur = 0
    for (let i = 0; i < actualN; i++) {
      const take = baseSize + (i < extra ? 1 : 0)
      cols[i] = ch.slice(cur, cur + take)
      cur += take
    }
    return cols
  }

  // 1.5 若 rem 仅有 1 个单块，优先尝试细粒度拆分（Markdown 列表/HTML 列表/多段落）。
  if (rem.length === 1) {
    const single = rem[0]
    const s = (single.slot || "").trim()
    const colMatch = s.match(/^col-(\d+)$/i)
    const explicitColIdx = colMatch ? parseInt(colMatch[1], 10) : null

    const text = (single.rawMarkdown || single.content || "").trim()

    // 1.5.1 Markdown 列表项
    const lines = text.split(/\r?\n/)
    const itemStartIndices: number[] = []
    for (let i = 0; i < lines.length; i++) {
      if (/^[ \t]*[-*+]\s+|^[ \t]*\d+\.\s+/.test(lines[i])) itemStartIndices.push(i)
    }
    if (itemStartIndices.length >= n) {
      const cols: T[][] = Array.from({ length: n }, () => [])
      let cur = 0
      for (let i = 0; i < n; i++) {
        const remainingCols = n - i
        const remainingItems = itemStartIndices.length - cur
        const take = Math.ceil(remainingItems / remainingCols)
        const start = itemStartIndices[cur]
        const end = cur + take < itemStartIndices.length ? itemStartIndices[cur + take] : lines.length
        const itemsText = lines.slice(start, end).join("\n")
        cols[i] = [{
          ...single,
          id: i === 0 ? single.id : `${single.id}-col${i + 1}`,
          rawMarkdown: itemsText,
          content: itemsText,
        }]
        cur += take
      }
      return cols
    }

    // 1.5.2 HTML 列表项
    const liMatches = text.match(/<li[\s\S]*?<\/li>/gi)
    if (liMatches && liMatches.length >= n) {
      const cols: T[][] = Array.from({ length: n }, () => [])
      let cur = 0
      for (let i = 0; i < n; i++) {
        const remainingCols = n - i
        const remainingItems = liMatches.length - cur
        const take = Math.ceil(remainingItems / remainingCols)
        const ul = `<ul>\n${liMatches.slice(cur, cur + take).join("\n")}\n</ul>`
        cols[i] = [{
          ...single,
          id: i === 0 ? single.id : `${single.id}-col${i + 1}`,
          rawMarkdown: ul,
          content: ul,
        }]
        cur += take
      }
      return cols
    }

    // 1.5.3 纯文本多段落
    const paras = text.split(/\r?\n\s*\r?\n/).filter(p => p.trim() !== "")
    if (paras.length >= n) {
      const cols: T[][] = Array.from({ length: n }, () => [])
      let cur = 0
      for (let i = 0; i < n; i++) {
        const remainingCols = n - i
        const remainingItems = paras.length - cur
        const take = Math.ceil(remainingItems / remainingCols)
        const pText = paras.slice(cur, cur + take).join("\n\n")
        cols[i] = [{
          ...single,
          id: i === 0 ? single.id : `${single.id}-col${i + 1}`,
          rawMarkdown: pText,
          content: pText,
        }]
        cur += take
      }
      return cols
    }

    // 若显式指定了 col-X（如 col-3），尊重显式插槽；若仅为历史残余 slot="right" 或无 slot，安全归入第 1 栏
    if (explicitColIdx && explicitColIdx >= 1 && explicitColIdx <= n) {
      const cols: T[][] = Array.from({ length: n }, () => [])
      cols[explicitColIdx - 1] = [single]
      return cols
    }

    return [[single], ...Array.from({ length: n - 1 }, () => [])]
  }

  const getColIndex = (b: T): number | null => {
    const s = (b.slot || "").trim()
    if (!s) return null
    if (s === "left") return 1
    if (s === "center") return 2
    if (s === "right") return n === 2 ? 2 : n
    const match = s.match(/^col-(\d+)$/i)
    if (match) {
      const idx = parseInt(match[1], 10)
      if (idx >= 1 && idx <= n) return idx
    }
    return null
  }

  const explicitCols = rem.map(getColIndex)
  const hasExplicitCols = explicitCols.some(c => c !== null)

  // 2. 显式插槽分配
  if (hasExplicitCols) {
    const hasCol2OrMore = explicitCols.some(c => c !== null && c >= 2)
    if (hasCol2OrMore) {
      const cols: T[][] = Array.from({ length: n }, () => [])
      let currentIdx = 1
      for (const b of rem) {
        const directCol = getColIndex(b)
        if (directCol !== null) {
          currentIdx = directCol
        }
        cols[currentIdx - 1].push(b)
      }

      // 防御孤立残余插槽：若未显式指定 col-N（如仅残留 slot="right"）且第 1 栏为空，
      // 避免前栏大面积留白导致内容偏置在右侧或右下角
      const hasExplicitColN = rem.some(b => /^col-\d+$/i.test((b.slot || "").trim()))
      if (!hasExplicitColN && cols[0].length === 0) {
        const nonEmptyCols = cols.filter(c => c.length > 0)
        if (nonEmptyCols.length === 1) {
          return [nonEmptyCols[0], ...Array.from({ length: n - 1 }, () => [])]
        }
      }

      return cols
    }

    // 若仅指定了第 1 栏，剩余未标注块自动均分至后续各栏
    const col1 = rem.filter(b => getColIndex(b) === 1)
    const untagged = rem.filter(b => getColIndex(b) === null)
    const remainingCols = n - 1
    if (untagged.length >= remainingCols) {
      const base = Math.floor(untagged.length / remainingCols)
      const extra = untagged.length % remainingCols
      const cols: T[][] = [col1]
      let cur = 0
      for (let i = 0; i < remainingCols; i++) {
        const take = base + (i < extra ? 1 : 0)
        cols.push(untagged.slice(cur, cur + take))
        cur += take
      }
      return cols
    } else if (untagged.length > 0) {
      const cols: T[][] = [col1]
      for (let i = 0; i < remainingCols; i++) {
        cols.push(i < untagged.length ? [untagged[i]] : [])
      }
      return cols
    } else {
      return [col1, ...Array.from({ length: remainingCols }, () => [])]
    }
  }

  // 3. 检查大纲标题自动分组 (若存在 >= n 个标题行，按标题分组)
  const isHeading = (b: T) => {
    if (b.type === "h") return true
    if (b.subType && /^h[1-6]$/i.test(b.subType)) return true
    const md = (b.rawMarkdown || b.content || "").trim()
    return /^#{1,6}\s+/.test(md)
  }
  const headingIndices = rem.map((b, idx) => (isHeading(b) ? idx : -1)).filter(idx => idx !== -1)
  if (headingIndices.length >= n) {
    const cols: T[][] = Array.from({ length: n }, () => [])
    for (let i = 0; i < n; i++) {
      const start = headingIndices[i]
      const end = i + 1 < n ? headingIndices[i + 1] : rem.length
      cols[i] = rem.slice(start, end)
    }
    return cols
  }

  // 4. 多块列表/段落均分 (rem.length >= n)
  if (rem.length >= n) {
    const cols: T[][] = Array.from({ length: n }, () => [])
    let cur = 0
    for (let i = 0; i < n; i++) {
      const remainingCols = n - i
      const remainingItems = rem.length - cur
      const take = Math.ceil(remainingItems / remainingCols)
      cols[i] = rem.slice(cur, cur + take)
      cur += take
    }
    return cols
  }

  // 5. 内容块数小于 n 时 (例如 2 个块分给 3 栏)
  if (rem.length > 1 && rem.length < n) {
    const cols: T[][] = Array.from({ length: n }, () => [])
    for (let i = 0; i < rem.length; i++) {
      cols[i] = [rem[i]]
    }
    return cols
  }

  const cols: T[][] = Array.from({ length: n }, () => [])
  cols[0] = rem
  return cols
}

/**
 * 健壮的多模式三栏内容分配器（基于通用 distributeNColumns 的兼容门面）
 */
export function distributeThreeColumns<
  T extends {
    slot?: string
    type?: string
    subType?: string
    content?: string
    rawMarkdown?: string
    id?: string
    children?: any[]
  }
>(rem: T[]): IThreeColsDistribution<T> {
  const cols = distributeNColumns(rem, 3)
  return {
    col1: cols[0] || [],
    col2: cols[1] || [],
    col3: cols[2] || [],
  }
}
