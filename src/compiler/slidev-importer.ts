import {
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_COLOR_SCHEMA,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_HIGHLIGHTER,
  ATTR_DOC_THEME,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_CLASS,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_NOTES,
  ATTR_PAGE_TRANSITION,
} from "../types/slidev-protocol"

export interface IParsedSlideItem {
  pageIndex: number
  pageAttrs: Record<string, string>
  notes: string
  rawMarkdown: string
  hasVueComponent: boolean
  hasStyleTag: boolean
  assetReferences: string[]
}

export interface IParsedSlidevPresentation {
  docTitle: string
  docRootAttrs: Record<string, string>
  slides: IParsedSlideItem[]
  totalSlides: number
  stats: {
    totalNotes: number
    totalVClicks: number
    totalShikiHighlights: number
    totalSlots: number
    discoveredAssets: string[]
    layoutDistribution: Record<string, number>
  }
  flattenedMarkdown: string
  customCss?: string
}

export interface IImportOptions {
  stripNotesFromMarkdown?: boolean
  cleanVClicks?: boolean
  cleanShikiLines?: boolean
  cleanSlots?: boolean
  isolateStyleTags?: boolean
  cleanHtmlToMarkdown?: boolean
  virtualFiles?: Record<string, string>
}

/**
 * 剥离引号外的行内注释 #
 */
export function stripInlineComment(val: string): string {
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < val.length; i++) {
    const char = val[i]
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
    } else if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      return val.slice(0, i).trim()
    }
  }
  return val.trim()
}

/**
 * 健壮轻量 YAML Frontmatter 解析器
 */
export function parseYamlFrontmatter(yamlStr: string): Record<string, any> {
  const result: Record<string, any> = {}
  const lines = yamlStr.split(/\r?\n/)
  let currentKey = ""
  let inMultiLine = false
  let multiLineBuffer: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (inMultiLine) {
      if (rawLine.startsWith("  ") || rawLine.startsWith("\t")) {
        multiLineBuffer.push(trimmed)
        continue
      } else {
        result[currentKey] = multiLineBuffer.join("\n")
        inMultiLine = false
        multiLineBuffer = []
      }
    }

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const colonIdx = rawLine.indexOf(":")
    if (colonIdx > 0) {
      const key = rawLine.slice(0, colonIdx).trim()
      let val = rawLine.slice(colonIdx + 1).trim()

      if (val === "|" || val === ">") {
        currentKey = key
        inMultiLine = true
        multiLineBuffer = []
        continue
      }

      val = stripInlineComment(val)

      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }

      result[key] = val
    }
  }

  if (inMultiLine && currentKey) {
    result[currentKey] = multiLineBuffer.join("\n")
  }

  return result
}

interface IRawSlideData {
  frontmatter: Record<string, any>
  content: string
}

const RE_FRONTMATTER = /^---[^\n\r]*\r?\n([\s\S]*?)\r?\n---/
const RE_YAML_BLOCK = /^\s*```ya?ml([\s\S]*?)```/

function extractSlideMatter(raw: string): IRawSlideData {
  let frontmatter: Record<string, any> = {}
  let content = raw.trim()

  const fmMatch = content.match(RE_FRONTMATTER)
  if (fmMatch) {
    frontmatter = parseYamlFrontmatter(fmMatch[1])
    content = content.slice(fmMatch[0].length).trim()
  } else {
    const ymlMatch = content.match(RE_YAML_BLOCK)
    if (ymlMatch) {
      frontmatter = parseYamlFrontmatter(ymlMatch[1])
      content = content.slice(ymlMatch[0].length).trim()
    } else {
      // 容错: 无闭合 --- 的单行/多行 key: val
      const lines = content.split(/\r?\n/)
      const yamlLines: string[] = []
      let bodyStart = 0
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx].trim()
        if (!line) {
          if (yamlLines.length > 0) {
            bodyStart = idx + 1
            break
          }
          continue
        }
        if (/^[a-zA-Z0-9_-]+\s*:\s*.*/.test(line) && !line.startsWith("<") && !line.startsWith("#")) {
          yamlLines.push(line)
        } else {
          bodyStart = idx
          break
        }
      }
      if (yamlLines.length > 0) {
        frontmatter = parseYamlFrontmatter(yamlLines.join("\n"))
        content = lines.slice(bodyStart).join("\n").trim()
      }
    }
  }

  return { frontmatter, content }
}

/**
 * 依循 Slidev 官方词法状态机切分幻灯片
 */
export function splitSlidevMarkdownChunks(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/)
  const rawSlides: string[] = []

  let start = 0
  let inHtmlComment = false

  function slice(end: number) {
    if (start >= end) return
    const raw = lines.slice(start, end).join("\n").trim()
    if (raw) {
      rawSlides.push(raw)
    }
    start = end + 1
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trimEnd()

    if (inHtmlComment) {
      if (line.includes("-->")) {
        inHtmlComment = false
      }
      continue
    }

    if (line.startsWith("<!--")) {
      if (!line.includes("-->")) {
        inHtmlComment = true
      }
      continue
    }

    if (line.startsWith("---")) {
      slice(i)

      const next = lines[i + 1]
      // 若下行非空，说明当前 --- 是 Frontmatter 起始符，向前跳过闭合 ---
      if (next && next.trim() && line.replace(/^-+/, "").trim() === "") {
        start = i
        for (i += 1; i < lines.length; i++) {
          if (lines[i].trimEnd() === "---") {
            break
          }
        }
      }
    } else if (line.trimStart().startsWith("```")) {
      // 跳过代码块内部的 ---
      const match = line.match(/^\s*`+/)
      const fence = match ? match[0].trim() : "```"
      let j = i + 1
      for (; j < lines.length; j++) {
        if (lines[j].trimStart().startsWith(fence)) {
          break
        }
      }
      if (j < lines.length) {
        i = j
      }
    }
  }

  if (start < lines.length) {
    slice(lines.length)
  }

  return rawSlides
}

/**
 * 递归/深度优先匹配并替换指定 class 的 <div> 容器，正确处理嵌套 <div> 标签闭合
 */
function replaceDivContainer(
  html: string,
  classQuery: string | RegExp,
  replacer: (inner: string) => string
): string {
  let result = ""
  let cursor = 0
  const openTagRegex = /<div\b([^>]*)>/gi

  while (cursor < html.length) {
    openTagRegex.lastIndex = cursor
    let match: RegExpExecArray | null
    let foundOpenTag = false
    let targetOpenIndex = -1
    let openTagLength = 0

    while ((match = openTagRegex.exec(html)) !== null) {
      const attrs = match[1]
      const classMatch = attrs.match(/\bclass=["']([^"']*)["']/i)
      if (classMatch) {
        const classNames = classMatch[1]
        const isMatch =
          typeof classQuery === "string"
            ? classNames.split(/\s+/).includes(classQuery)
            : classQuery.test(classNames)
        if (isMatch) {
          foundOpenTag = true
          targetOpenIndex = match.index
          openTagLength = match[0].length
          break
        }
      }
    }

    if (!foundOpenTag) {
      result += html.slice(cursor)
      break
    }

    // 将匹配点之前的内容加入 result
    result += html.slice(cursor, targetOpenIndex)

    // 从 openTag 之后开始计算 depth
    const bodyStart = targetOpenIndex + openTagLength
    let depth = 1
    let bodyEnd = -1
    let closeTagEnd = -1

    const tokenRegex = /<\/?div\b[^>]*>/gi
    tokenRegex.lastIndex = bodyStart

    let tokenMatch: RegExpExecArray | null
    while ((tokenMatch = tokenRegex.exec(html)) !== null) {
      if (tokenMatch[0].startsWith("</")) {
        depth--
        if (depth === 0) {
          bodyEnd = tokenMatch.index
          closeTagEnd = tokenMatch.index + tokenMatch[0].length
          break
        }
      } else {
        depth++
      }
    }

    if (bodyEnd !== -1 && closeTagEnd !== -1) {
      const inner = html.slice(bodyStart, bodyEnd)
      result += replacer(inner)
      cursor = closeTagEnd
    } else {
      // 容错: 未找到配对闭合标签
      result += html.slice(targetOpenIndex, bodyStart)
      cursor = bodyStart
    }
  }

  return result
}

/**
 * 将幻灯片中的展示性 HTML 容器与标签智能剥离并转换为纯净原生的 Markdown 内容
 */
export function convertHtmlToCleanMarkdown(html: string): string {
  // 1. 保护现有 Markdown 代码块与行内代码 (避免误伤代码块内的示例 HTML)
  const codeBlocks: string[] = []
  let text = html.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
    const placeholder = `__CODE_TOKEN_${codeBlocks.length}__`
    codeBlocks.push(match)
    return placeholder
  })

  // 2. 剥离样式块与脚本块
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")

  // 3. 移除纯装饰型组件与元素
  text = text.replace(/<div class="terminal-bar">[\s\S]*?<\/div>/gi, "")
  text = text.replace(/<div class="cursor-line">[\s\S]*?<\/div>/gi, "")
  text = text.replace(/<span class="cursor">[\s\S]*?<\/span>/gi, "")
  text = text.replace(/<div class="stamp">\s*([\s\S]*?)\s*<\/div>/gi, "\n\n*[$1]*\n\n")
  text = text.replace(/<div class="arrow">\s*([→\->]+)\s*<\/div>/gi, "\n\n$1\n\n")
  text = text.replace(/<i>\s*[→\->]+\s*<\/i>/gi, "")

  // 4. 命令行提示符
  text = text.replace(/<div class="prompt">\s*([\s\S]*?)\s*<\/div>/gi, (_, cmd) => {
    return `\n\`\`\`bash\n${cmd.trim()}\n\`\`\`\n`
  })
  text = text.replace(/<p>\s*<i>\$<\/i>\s*([\s\S]*?)<\/p>/gi, (_, cmd) => {
    return `\n\`\`\`bash\n$ ${cmd.trim()}\n\`\`\`\n`
  })

  // 5. 状态栏 / 元信息条: <div class="statusline"><span>service=gateway</span>...</div>
  text = text.replace(/<div class="statusline">\s*([\s\S]*?)\s*<\/div>/gi, (_, inner) => {
    const tags = Array.from(inner.matchAll(/<span>([\s\S]*?)<\/span>/gi)).map((m: any) => `\`${m[1].trim()}\``)
    return `\n> ${tags.join(" | ")}\n`
  })

  // 6. 日志面板与代码块: <div class="log-panel">\s*<pre>...</pre>\s*</div>
  text = text.replace(/<div class="log-panel">\s*<pre>([\s\S]*?)<\/pre>\s*<\/div>/gi, (_, code) => {
    const cleanCode = code.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, "$1").trim()
    return `\n\`\`\`log\n${cleanCode}\n\`\`\`\n`
  })

  // 7. 对比网格 <div class="diff-grid">
  text = replaceDivContainer(text, "diff-grid", (inner) => {
    const items = Array.from(
      inner.matchAll(/<div class="diff\s+([^"]*)">\s*<span>(.*?)<\/span>\s*<pre>([\s\S]*?)<\/pre>\s*<\/div>/gi)
    )
    if (items.length > 0) {
      return (
        "\n" +
        items
          .map((m: any) => {
            const title = m[2].trim().toUpperCase()
            const code = m[3].trim()
            return `**${title}:**\n\`\`\`yaml\n${code}\n\`\`\``
          })
          .join("\n\n") +
        "\n"
      )
    }
    return inner
  })

  // 8. Before / After 对比卡片: <div class="before-after">
  text = replaceDivContainer(text, "before-after", (inner) => {
    const beforeMatch = inner.match(
      /<div class="before">[\s\S]*?<small>(.*?)<\/small>[\s\S]*?<h2>(.*?)<\/h2>[\s\S]*?<p>(.*?)<\/p>\s*<\/div>/i
    )
    const afterMatch = inner.match(
      /<div class="after">[\s\S]*?<small>(.*?)<\/small>[\s\S]*?<h2>(.*?)<\/h2>[\s\S]*?<p>(.*?)<\/p>\s*<\/div>/i
    )
    let res = "\n"
    if (beforeMatch) {
      res += `### ${beforeMatch[1]}\n## ${beforeMatch[2]}\n${beforeMatch[3]}\n\n`
    }
    if (afterMatch) {
      res += `### ${afterMatch[1]}\n## ${afterMatch[2]}\n${afterMatch[3]}\n`
    }
    return res.trim() ? res : inner
  })

  // 9. 任务列表: <ul class="terminal-list"><li><em>[x]</em> ...</li></ul>
  text = text.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, list) => {
    const items = Array.from(list.matchAll(/<li>\s*(?:<em>)?(\[[x ]\])(?:<\/em>)?\s*([\s\S]*?)<\/li>/gi))
    if (items.length > 0) {
      return "\n" + items.map((m: any) => `- ${m[1]} ${m[2].trim()}`).join("\n") + "\n"
    }
    return list
  })

  // 10. 时间线列表: <div class="timeline">
  text = replaceDivContainer(text, "timeline", (inner) => {
    const items = Array.from(
      inner.matchAll(
        /<div(?:\s+class="([^"]*)")?>\s*<time>([\s\S]*?)<\/time>\s*<b>([\s\S]*?)<\/b>\s*<span>([\s\S]*?)<\/span>\s*<\/div>/gi
      )
    )
    if (items.length > 0) {
      return (
        "\n" +
        items
          .map((m: any) => {
            const cls = m[1] || ""
            let prefix = "-"
            if (cls.includes("warn")) prefix = "- ⚠️"
            else if (cls.includes("bad")) prefix = "- ❌"
            else if (cls.includes("ok")) prefix = "- ✅"
            return `${prefix} **${m[2].trim()}** **${m[3].trim()}** — ${m[4].trim()}`
          })
          .join("\n") +
        "\n"
      )
    }
    return inner
  })

  // 11. 流程管线: <div class="pipeline">
  text = replaceDivContainer(text, "pipeline", (inner) => {
    const items = Array.from(
      inner.matchAll(
        /<div(?:\s+class="([^"]*)")?>\s*<small>([\s\S]*?)<\/small>\s*<b>([\s\S]*?)<\/b>\s*<span>([\s\S]*?)<\/span>\s*<\/div>/gi
      )
    )
    if (items.length > 0) {
      return (
        "\n" +
        items
          .map((m: any, idx: number) => {
            const isHot = (m[1] || "").includes("hot")
            const icon = isHot ? "⚠️ " : ""
            return `${idx + 1}. ${icon}**${m[3].trim()}** (*${m[4].trim()}*)`
          })
          .join("\n") +
        "\n"
      )
    }
    return inner
  })

  // 12. 检查项卡片网格: <div class="check-grid">
  text = replaceDivContainer(text, "check-grid", (inner) => {
    const items = Array.from(
      inner.matchAll(/<div>\s*<span class="([^"]*)"><\/span>\s*<b>([\s\S]*?)<\/b>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/gi)
    )
    if (items.length > 0) {
      return (
        "\n" +
        items
          .map((m: any) => {
            const isWarn = (m[1] || "").includes("warn")
            const icon = isWarn ? "⚠️" : "✅"
            return `- ${icon} **${m[2].trim()}**: ${m[3].trim()}`
          })
          .join("\n") +
        "\n"
      )
    }
    return inner
  })

  // 13. 宣言/特征网格: <div class="manifesto">
  text = replaceDivContainer(text, "manifesto", (inner) => {
    const items = Array.from(
      inner.matchAll(/<div>\s*<span>([\s\S]*?)<\/span>\s*<h2>([\s\S]*?)<\/h2>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/gi)
    )
    if (items.length > 0) {
      return (
        "\n" +
        items
          .map((m: any) => `## ${m[1].trim()} ${m[2].trim()}\n\n${m[3].trim()}`)
          .join("\n\n") +
        "\n"
      )
    }
    return inner
  })

  // 14. 便签与机制引用: <div class="split-note"> / <div class="mechanism">
  text = replaceDivContainer(text, "split-note", (inner) => {
    const items = Array.from(inner.matchAll(/<div>\s*<b>([\s\S]*?)<\/b>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/gi))
    if (items.length > 0) {
      return "\n" + items.map((m: any) => `> **${m[1].trim()}**: ${m[2].trim()}`).join("\n>\n") + "\n"
    }
    return inner
  })

  text = text.replace(/<div class="mechanism">\s*<b>([\s\S]*?)<\/b>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/gi, (_, title, desc) => {
    return `\n> **${title.trim()}**: ${desc.trim()}\n`
  })

  // 15. 独立 pre 代码块 (剥离内嵌 span 样式)
  text = text.replace(/<pre>([\s\S]*?)<\/pre>/gi, (_, code) => {
    const cleanCode = code.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, "$1").trim()
    return `\n\`\`\`text\n${cleanCode}\n\`\`\`\n`
  })

  // 16. 页面头部标签: <div class="page-head"><span>THE PREMISE</span><b>02</b></div>
  text = text.replace(/<div class="page-head">\s*<span>([\s\S]*?)<\/span>\s*<b>([\s\S]*?)<\/b>\s*<\/div>/gi, "\n### $1 ($2)\n")

  // 17. 标题与段落
  text = text.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
  text = text.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
  text = text.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
  text = text.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")

  text = text.replace(/<p\s+class="ok">\s*●\s*([\s\S]*?)<\/p>/gi, "\n✅ **$1**\n")
  text = text.replace(/<p\s+class="caption">\s*([\s\S]*?)<\/p>/gi, "\n> *$1*\n")
  text = text.replace(/<p\s+class="lead">\s*([\s\S]*?)<\/p>/gi, "\n*$1*\n")
  text = text.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n\n")

  // 18. 换行与分割符
  text = text.replace(/<br\s*\/?>/gi, "\n")
  text = text.replace(/<hr\s*\/?>/gi, "\n---\n")

  // 19. 行内样式标签
  text = text.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
  text = text.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
  text = text.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
  text = text.replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
  text = text.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
  text = text.replace(/<time\b[^>]*>([\s\S]*?)<\/time>/gi, "**$1** ")
  text = text.replace(/<small\b[^>]*>([\s\S]*?)<\/small>/gi, "*$1*")

  // 防御性处理: 修复直接相连的粗体标记闭合 (****)，补充空格避免 Markdown 粗体解析损坏
  text = text.replace(/\*{4}/g, "** **")

  // 20. 列表标签
  text = text.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
  text = text.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, "\n$1\n")
  text = text.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, "\n$1\n")

  // 21. 链接与引用
  text = text.replace(/<a\b[^>]*href=["'](.*?)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
  text = text.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, q) => {
    return "\n" + q.trim().split("\n").map((line: string) => `> ${line.trim()}`).join("\n") + "\n"
  })

  // 22. 解包剩余纯布局标签 (div, span, section, header, footer, etc.)
  text = text.replace(/<\/?(?:div|span|section|header|footer|main|article|nav|aside)\b[^>]*>/gi, "")

  // 23. 恢复受保护的代码块
  for (let i = 0; i < codeBlocks.length; i++) {
    text = text.replace(`__CODE_TOKEN_${i}__`, codeBlocks[i])
  }

  // 24. 规范化连续换行与行首尾空格
  text = text.replace(/\n{3,}/g, "\n\n").trim()

  return text
}

/**
 * 核心解析入口：将 Slidev Markdown 完整解析为结构化思源演示包
 */
export function parseSlidevPresentation(
  content: string,
  options: IImportOptions = {},
): IParsedSlidevPresentation {
  const {
    stripNotesFromMarkdown = true,
    cleanVClicks = true,
    cleanShikiLines = true,
    cleanSlots = true,
    isolateStyleTags = true,
    cleanHtmlToMarkdown = true,
    virtualFiles = {},
  } = options

  const rawSlides = splitSlidevMarkdownChunks(content)

  const docRootAttrs: Record<string, string> = {}
  let docTitle = ""
  let customCssCollected = ""

  let slideStartIndex = 0

  // 1. 检查首个块是否为纯 Headmatter
  if (rawSlides.length > 0) {
    const firstRaw = rawSlides[0]
    // 若首块仅包含 Frontmatter 且无实际正文（或被切分为独立 Headmatter）
    const matterRes = extractSlideMatter(firstRaw)
    const hasFrontmatter = Object.keys(matterRes.frontmatter).length > 0
    const hasContent = matterRes.content.length > 0

    if (hasFrontmatter && !hasContent && rawSlides.length > 1) {
      // 纯 Headmatter 块
      slideStartIndex = 1
      applyHeadmatter(matterRes.frontmatter)
    } else if (hasFrontmatter) {
      // Headmatter 与第一页内容合并在一块中
      applyHeadmatter(matterRes.frontmatter)
    }
  }

  function applyHeadmatter(parsedHead: Record<string, any>) {
    docTitle = parsedHead.title || ""
    if (parsedHead.theme) docRootAttrs[ATTR_DOC_THEME] = String(parsedHead.theme)
    if (parsedHead.aspectRatio) docRootAttrs[ATTR_DOC_ASPECT_RATIO] = String(parsedHead.aspectRatio)
    if (parsedHead.highlighter) docRootAttrs[ATTR_DOC_HIGHLIGHTER] = String(parsedHead.highlighter)
    if (parsedHead.transition) docRootAttrs[ATTR_DOC_DEFAULT_TRANSITION] = String(parsedHead.transition)
    if (parsedHead.colorSchema) docRootAttrs[ATTR_DOC_COLOR_SCHEMA] = String(parsedHead.colorSchema)

    if (parsedHead.layout) docRootAttrs[ATTR_PAGE_LAYOUT] = String(parsedHead.layout)
    if (parsedHead.background) docRootAttrs[ATTR_PAGE_BACKGROUND] = String(parsedHead.background)
    if (parsedHead.class) docRootAttrs[ATTR_PAGE_CLASS] = String(parsedHead.class)

    for (const [k, v] of Object.entries(parsedHead)) {
      if (
        ![
          "theme",
          "aspectRatio",
          "highlighter",
          "transition",
          "colorSchema",
          "title",
          "layout",
          "background",
          "class",
        ].includes(k)
      ) {
        docRootAttrs[`custom-slidev-${k}`] = typeof v === "object" ? JSON.stringify(v) : String(v)
      }
    }
  }

  // 2. 逐页解析幻灯片
  const slides: IParsedSlideItem[] = []
  let totalNotes = 0
  let totalVClicks = 0
  let totalShikiHighlights = 0
  let totalSlots = 0
  const discoveredAssetsSet = new Set<string>()
  const layoutDistribution: Record<string, number> = {}

  let pageIndex = 1

  for (let idx = slideStartIndex; idx < rawSlides.length; idx++) {
    const rawSlide = rawSlides[idx]

    // 处理 src: ./pages/*.md 外部子页面展开
    const srcMatch = rawSlide.match(/^src:\s*([^\n\r]+)/m)
    if (srcMatch) {
      const subPath = srcMatch[1].trim().replace(/^['"]|['"]$/g, "")
      const subContent = virtualFiles[subPath]
        || virtualFiles[subPath.replace(/^\.\//, "")]
        || virtualFiles[`pages/${subPath.replace(/^.*pages\//, "")}`]

      if (subContent) {
        const subParsed = parseSlidevPresentation(subContent, { ...options, virtualFiles })
        for (const subSlide of subParsed.slides) {
          subSlide.pageIndex = pageIndex++
          slides.push(subSlide)
          const l = subSlide.pageAttrs[ATTR_PAGE_LAYOUT] || "default"
          layoutDistribution[l] = (layoutDistribution[l] || 0) + 1
        }
        continue
      }
    }

    const { frontmatter, content: slideBody } = extractSlideMatter(rawSlide)

    const pageAttrs: Record<string, string> = {}
    if (frontmatter.layout) pageAttrs[ATTR_PAGE_LAYOUT] = String(frontmatter.layout)
    if (frontmatter.transition) pageAttrs[ATTR_PAGE_TRANSITION] = String(frontmatter.transition)
    if (frontmatter.background) pageAttrs[ATTR_PAGE_BACKGROUND] = String(frontmatter.background)
    if (frontmatter.class) pageAttrs[ATTR_PAGE_CLASS] = String(frontmatter.class)

    for (const [k, v] of Object.entries(frontmatter)) {
      if (!["layout", "transition", "background", "class"].includes(k)) {
        pageAttrs[`custom-slidev-${k}`] = typeof v === "object" ? JSON.stringify(v) : String(v)
      }
    }

    let body = slideBody

    // 提取演讲者提词备注 <!-- notes --> (排除 TODO)
    let pageNotes = ""
    const notesRegex = /<!--([\s\S]*?)-->/g
    let nMatch: RegExpExecArray | null
    while ((nMatch = notesRegex.exec(body)) !== null) {
      const noteContent = nMatch[1].trim()
      if (!noteContent.startsWith("TODO:")) {
        pageNotes = pageNotes ? `${pageNotes}\n\n${noteContent}` : noteContent
        totalNotes++
      }
    }

    if (pageNotes) {
      pageAttrs[ATTR_PAGE_NOTES] = pageNotes
      if (pageIndex === 1) {
        docRootAttrs[ATTR_PAGE_NOTES] = pageNotes
      }
    }

    if (stripNotesFromMarkdown) {
      body = body.replace(/<!--(?![\s\S]*?TODO:)[\s\S]*?-->/g, "").trim()
    }

    // 隔离处理 <style> 标签 (Gap 2)
    let hasStyleTag = false
    if (/<style\b/i.test(body)) {
      hasStyleTag = true
      const styleMatches = body.match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)
      if (styleMatches) {
        for (const sm of styleMatches) {
          const innerCss = sm.replace(/<style\b[^>]*>|<\/style>/gi, "").trim()
          customCssCollected = customCssCollected ? `${customCssCollected}\n\n${innerCss}` : innerCss
        }
        if (isolateStyleTags) {
          body = body.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").trim()
        }
      }
    }

    // 统计与清洗指令
    const vClickMatches = body.match(/<v-click[^>]*>|<v-clicks[^>]*>|v-click=/g)
    if (vClickMatches) {
      totalVClicks += vClickMatches.length
    }

    const shikiMatches = body.match(/```\w+\s+\{[^}]+\}/g)
    if (shikiMatches) {
      totalShikiHighlights += shikiMatches.length
    }

    const slotMatches = body.match(/::\w+::|<template\s+#[^>]+>/g)
    if (slotMatches) {
      totalSlots += slotMatches.length
    }

    if (cleanVClicks) {
      body = body.replace(/<v-click(?:\s+at="[^"]*")?(?:\s+hide)?>\s*([\s\S]*?)\s*<\/v-click>/gi, "$1")
    }

    if (cleanShikiLines) {
      body = body.replace(/(```\w+)\s+\{[^}]+\}/g, "$1")
    }

    if (cleanSlots) {
      body = body.replace(/^::\w+::\s*$/gm, "")
    }

    if (cleanHtmlToMarkdown) {
      body = convertHtmlToCleanMarkdown(body)
    }

    const assetRefs = extractAssetReferences(body)
    if (pageAttrs[ATTR_PAGE_BACKGROUND]) {
      assetRefs.push(pageAttrs[ATTR_PAGE_BACKGROUND])
    }
    for (const ar of assetRefs) {
      discoveredAssetsSet.add(ar)
    }

    const hasVueComponent = /<[A-Z][a-zA-Z0-9]+/.test(body)

    const layout = pageAttrs[ATTR_PAGE_LAYOUT] || (pageIndex === 1 ? (docRootAttrs[ATTR_PAGE_LAYOUT] || "cover") : "default")
    layoutDistribution[layout] = (layoutDistribution[layout] || 0) + 1

    slides.push({
      pageIndex: pageIndex++,
      pageAttrs,
      notes: pageNotes,
      rawMarkdown: body,
      hasVueComponent,
      hasStyleTag,
      assetReferences: assetRefs,
    })
  }

  if (!docTitle && slides.length > 0) {
    const firstH1Match = slides[0].rawMarkdown.match(/^#\s+(.+)$/m)
    if (firstH1Match) {
      docTitle = firstH1Match[1].trim()
    }
  }

  if (customCssCollected) {
    docRootAttrs["custom-slidev-custom-css"] = customCssCollected
  }

  const flattenedMarkdown = slides.map((s, idx) => {
    if (idx === 0) {
      return s.rawMarkdown
    }
    return `---\n\n${s.rawMarkdown}`
  }).join("\n\n")

  return {
    docTitle: docTitle || "Slidev 演示文稿",
    docRootAttrs,
    slides,
    totalSlides: slides.length,
    stats: {
      totalNotes,
      totalVClicks,
      totalShikiHighlights,
      totalSlots,
      discoveredAssets: Array.from(discoveredAssetsSet),
      layoutDistribution,
    },
    flattenedMarkdown,
    customCss: customCssCollected,
  }
}

/**
 * 提取 Markdown 与 HTML 标签中的本地与网络媒体资源路径
 */
export function extractAssetReferences(markdown: string): string[] {
  const assets: string[] = []

  const mdRegex = /!\[.*?\]\((.*?)\)/g
  let match: RegExpExecArray | null
  while ((match = mdRegex.exec(markdown)) !== null) {
    const url = match[1].split(/\s+/)[0].trim()
    if (url) assets.push(url)
  }

  const htmlRegex = /<img\b[^>]*src=["'](.*?)["']/gi
  while ((match = htmlRegex.exec(markdown)) !== null) {
    const url = match[1].trim()
    if (url) assets.push(url)
  }

  return assets
}
