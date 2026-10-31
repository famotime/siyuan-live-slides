import type {
  ISiYuanBlockNode,
  ISlidesBlockItem,
  ISlidesMotionConfig,
} from "../types/slides-protocol"

/**
 * 序列化 Frontmatter 对象为 YAML 字符串
 */
export function stringifyFrontmatter(data: Record<string, any>): string {
  const entries = Object.entries(data).filter(([_, val]) => val !== undefined && val !== null && val !== "")
  if (entries.length === 0) {
    return ""
  }

  const lines = entries.map(([key, val]) => {
    if (typeof val === "string") {
      // 若字符串包含特殊字符换行或冒号，用引号包裹
      if (val.includes(":") || val.includes("\n") || val.includes("#")) {
        return `${key}: "${val.replace(/"/g, '\\"')}"`
      }
      return `${key}: ${val}`
    }
    return `${key}: ${JSON.stringify(val)}`
  })

  return `---\n${lines.join("\n")}\n---`
}

/**
 * 处理代码块中的 Shiki 聚光高亮行标
 * 示例: ```ts 加上 {1-3|5} -> ```ts {1-3|5}
 */
export function injectShikiSpotlight(markdown: string, shikiLines?: string): string {
  if (!shikiLines || !markdown.startsWith("```")) {
    return markdown
  }

  const firstLineEnd = markdown.indexOf("\n")
  if (firstLineEnd === -1) {
    return markdown
  }

  const firstLine = markdown.slice(0, firstLineEnd).trim()
  const rest = markdown.slice(firstLineEnd)

  // 如果已经带有花括号标记，不重复注入
  if (firstLine.includes("{")) {
    return markdown
  }

  return `${firstLine} {${shikiLines}}${rest}`
}

/**
 * 包装带有 v-click 渐进出现的块
 */
export function wrapVClickDirective(markdown: string, clicks?: string): string {
  if (clicks === undefined || clicks === null) {
    return markdown
  }

  const trimmed = clicks.trim()
  if (trimmed === "" || trimmed === "+1") {
    return `<v-click>\n\n${markdown}\n\n</v-click>`
  }

  if (trimmed === "hide") {
    return `<v-click hide>\n\n${markdown}\n\n</v-click>`
  }

  return `<v-click at="${trimmed}">\n\n${markdown}\n\n</v-click>`
}

/**
 * 转换预设动效名称与参数为 Slidev / VueUse Motion 的 initial 与 enter 配置
 */
export function getMotionDirectives(motion?: ISlidesMotionConfig): {
  initial: Record<string, any>
  enter: Record<string, any>
} | null {
  if (!motion || !motion.preset) {
    return null
  }

  const preset = motion.preset.toLowerCase().trim()
  if (!preset || preset === "none") {
    return null
  }

  let initial: Record<string, any> = { opacity: 0 }
  let enter: Record<string, any> = { opacity: 1 }

  switch (preset) {
    case "slide-up":
      initial = { y: 40, opacity: 0 }
      enter = { y: 0, opacity: 1 }
      break
    case "slide-down":
      initial = { y: -40, opacity: 0 }
      enter = { y: 0, opacity: 1 }
      break
    case "slide-left":
      initial = { x: 40, opacity: 0 }
      enter = { x: 0, opacity: 1 }
      break
    case "slide-right":
      initial = { x: -40, opacity: 0 }
      enter = { x: 0, opacity: 1 }
      break
    case "zoom-in":
    case "pop":
      initial = { scale: 0.8, opacity: 0 }
      enter = { scale: 1, opacity: 1 }
      break
    case "bounce":
      initial = { y: 40, opacity: 0 }
      enter = { y: 0, opacity: 1, transition: { type: "spring", damping: 10, stiffness: 100 } }
      break
    case "fade-in":
    default:
      initial = { opacity: 0 }
      enter = { opacity: 1 }
      break
  }

  // 允许 motion 中自定义覆盖 initial / enter
  if (motion.initial && typeof motion.initial === "object") {
    initial = { ...initial, ...motion.initial }
  }
  if (motion.enter && typeof motion.enter === "object") {
    enter = { ...enter, ...motion.enter }
  }

  // 注入 duration 与 delay
  const transition: Record<string, any> = { ...(enter.transition || {}) }
  if (typeof motion.duration === "number" && motion.duration > 0) {
    transition.duration = motion.duration
  }
  if (typeof motion.delay === "number" && motion.delay > 0) {
    transition.delay = motion.delay
  }

  if (Object.keys(transition).length > 0) {
    enter.transition = transition
  }

  return { initial, enter }
}

/**
 * 包装带有 v-click、custom-slides-motion 以及块级 style 样式的块
 */
export function wrapElementDirectives(
  markdown: string,
  clicks?: string,
  motion?: ISlidesMotionConfig,
  style?: string,
): string {
  const hasClicks = clicks !== undefined && clicks !== null && clicks.trim() !== ""
  const motionConfig = getMotionDirectives(motion)
  const cleanStyle = style?.trim()
  const hasStyle = cleanStyle !== undefined && cleanStyle !== ""

  const styleAttr = hasStyle ? ` style="${cleanStyle.replace(/"/g, "&quot;")}" class="slide-styled-block"` : ""

  if (!hasClicks && !motionConfig) {
    if (hasStyle) {
      return `<div${styleAttr}>\n\n${markdown}\n\n</div>`
    }
    return markdown
  }

  if (hasClicks && !motionConfig) {
    if (hasStyle) {
      const trimmedClicks = clicks!.trim()
      let clickAttr = "v-click"
      if (trimmedClicks === "hide") {
        clickAttr = "v-click.hide"
      } else if (trimmedClicks !== "" && trimmedClicks !== "+1") {
        clickAttr = `v-click="${trimmedClicks}"`
      }
      return `<div ${clickAttr}${styleAttr}>\n\n${markdown}\n\n</div>`
    }
    return wrapVClickDirective(markdown, clicks)
  }

  // 序列化 motion 对象的 initial 与 enter
  const initialStr = JSON.stringify(motionConfig!.initial).replace(/"/g, "'")
  const enterStr = JSON.stringify(motionConfig!.enter).replace(/"/g, "'")
  const motionAttrs = `v-motion :initial="${initialStr}" :enter="${enterStr}"`

  if (!hasClicks) {
    return `<div ${motionAttrs}${styleAttr}>\n\n${markdown}\n\n</div>`
  }

  // 同时具备 clicks 与 motion：生成复合容器
  const trimmedClicks = clicks!.trim()
  let clickAttr = "v-click"
  if (trimmedClicks === "hide") {
    clickAttr = "v-click.hide"
  } else if (trimmedClicks !== "" && trimmedClicks !== "+1") {
    clickAttr = `v-click="${trimmedClicks}"`
  }

  return `<div ${clickAttr} ${motionAttrs}${styleAttr}>\n\n${markdown}\n\n</div>`
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

  // 6. 仅 1 个内容块时的细粒度拆分
  if (rem.length === 1) {
    const single = rem[0]
    const text = (single.rawMarkdown || single.content || "").trim()

    // 6.1 Markdown 列表项
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

    // 6.2 HTML 列表项
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

    // 6.3 纯文本多段落
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
