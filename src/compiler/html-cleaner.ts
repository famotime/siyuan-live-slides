/**
 * 递归/深度优先匹配并替换指定 class 的 <div> 容器，正确处理嵌套 <div> 标签闭合
 */
export function replaceDivContainer(
  html: string,
  classQuery: string | RegExp,
  replacer: (inner: string) => string,
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
 * 保护包含 Vue 交互事件 (@), Vue 指令 (v-), 属性绑定 (:), UnoCSS 布局类等特殊属性的 <div> 容器
 */
export function protectVueDivContainers(html: string): { text: string; tokens: string[] } {
  const tokens: string[] = []
  let result = ""
  let cursor = 0
  const openTagRegex = /<div\b([^>]*)>/gi

  while (cursor < html.length) {
    openTagRegex.lastIndex = cursor
    let match: RegExpExecArray | null
    let found = false
    let targetOpenIndex = -1
    let openTagLength = 0

    while ((match = openTagRegex.exec(html)) !== null) {
      const attrs = match[1]
      // 严谨检测 Vue 指令与 UnoCSS 特殊属性 (包括网格布局与定位容器)
      if (
        /(?:\s@[a-zA-Z0-9_-]+=\s*["']|\s:[a-zA-Z0-9_-]+=\s*["']|\sv-[a-zA-Z0-9_.-]+|\shover:[a-zA-Z0-9_.-]+=\s*["']|\sgrid=["']~|\bclass=["'][^"']*\b(?:abs-br|slidev-icon-btn|grid\s+|grid$|grid-cols-|relative\b)\b[^"']*["']|\bstyle=["'][^"']*\bgrid-[^"']*["'])/i.test(attrs)
      ) {
        found = true
        targetOpenIndex = match.index
        openTagLength = match[0].length
        break
      }
    }

    if (!found) {
      result += html.slice(cursor)
      break
    }

    result += html.slice(cursor, targetOpenIndex)

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
      const fullMatchedDiv = html.slice(targetOpenIndex, closeTagEnd)
      const placeholder = `__VUE_DIV_TOKEN_${tokens.length}__`
      tokens.push(fullMatchedDiv)
      result += placeholder
      cursor = closeTagEnd
    } else {
      result += html.slice(targetOpenIndex, bodyStart)
      cursor = bodyStart
    }
  }

  return { text: result, tokens }
}

/**
 * 将幻灯片中的展示性 HTML 容器与标签智能剥离并转换为纯净原生的 Markdown 内容
 */
export function convertHtmlToCleanMarkdown(html: string): string {
  // 1. 保护现有 Markdown 多行围栏代码块 (必须以行首开门并独占一行闭合) 与单行行内代码
  const codeBlocks: string[] = []
  let text = html.replace(/(?:^[ \t]*(`{3,}|~{3,})[^\n\r]*\r?\n[\s\S]*?\r?\n[ \t]*\1(?=[ \t]*(?:\r?\n|$)))/gm, (match) => {
    const placeholder = `__CODE_TOKEN_${codeBlocks.length}__`
    codeBlocks.push(match)
    return placeholder
  })
  text = text.replace(/(`+)(?:[^\n\r`]|(?!\1)`)+?\1/g, (match) => {
    const placeholder = `__CODE_TOKEN_${codeBlocks.length}__`
    codeBlocks.push(match)
    return placeholder
  })

  // 1.1 保护 Vue <script setup> 脚本块
  const scriptBlocks: string[] = []
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    const placeholder = `__SCRIPT_TOKEN_${scriptBlocks.length}__`
    scriptBlocks.push(match)
    return placeholder
  })

  // 1.2 保护带有 Vue 指令与交互的 div 容器
  const { text: textAfterVueDivs, tokens: vueDivTokens } = protectVueDivContainers(text)
  text = textAfterVueDivs

  // 1.3 保护特定组件与带 Vue 指令的自闭合或严格成对元素
  const vueCompTokens: string[] = []
  // (a) 自闭合组件标签 (以 /> 结尾，绝不跨越内容)
  text = text.replace(/<(?:[A-Z][a-zA-Z0-9_-]*|[a-z0-9_-]+:[a-z0-9_-]+|v-[a-z0-9_-]+|arrow\b|div\s+h-\d+)\b[^>]*\/>/gi, (match) => {
    const placeholder = `__VUE_COMP_TOKEN_${vueCompTokens.length}__`
    vueCompTokens.push(match)
    return placeholder
  })

  // (b) 严格同名成对组件与交互标签: <v-drag>...</v-drag>, <button @click=...>...</button>
  text = text.replace(/<(v-[a-z0-9_-]+|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (match) => {
    const placeholder = `__VUE_COMP_TOKEN_${vueCompTokens.length}__`
    vueCompTokens.push(match)
    return placeholder
  })

  // (c) 带有 Vue 指令(v-)的单行 p, span, img
  text = text.replace(/<img\b[^>]*?\bv-[a-z0-9_.-]+[^>]*\/?>/gi, (match) => {
    const placeholder = `__VUE_COMP_TOKEN_${vueCompTokens.length}__`
    vueCompTokens.push(match)
    return placeholder
  })
  text = text.replace(/<(p|span)\b([^>]*?\bv-[a-z0-9_.-]+[^>]*)>([\s\S]*?)<\/\1>/gi, (match) => {
    const placeholder = `__VUE_COMP_TOKEN_${vueCompTokens.length}__`
    vueCompTokens.push(match)
    return placeholder
  })

  // 2. 剥离独立样式块
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")

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
        "\n\n" +
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
        "\n\n"
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
        "\n\n" +
        items
          .map((m: any, idx: number) => {
            const isHot = (m[1] || "").includes("hot")
            const icon = isHot ? "⚠️ " : ""
            return `${idx + 1}. ${icon}**${m[3].trim()}** (*${m[4].trim()}*)`
          })
          .join("\n") +
        "\n\n"
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
        "\n\n" +
        items
          .map((m: any) => {
            const isWarn = (m[1] || "").includes("warn")
            const icon = isWarn ? "⚠️" : "✅"
            return `- ${icon} **${m[2].trim()}**: ${m[3].trim()}`
          })
          .join("\n") +
        "\n\n"
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
        "\n\n" +
        items
          .map((m: any) => `## ${m[1].trim()} ${m[2].trim()}\n\n${m[3].trim()}`)
          .join("\n\n") +
        "\n\n"
      )
    }
    return inner
  })

  // 14. 便签与机制引用: <div class="split-note"> / <div class="mechanism">
  text = replaceDivContainer(text, "split-note", (inner) => {
    const items = Array.from(inner.matchAll(/<div>\s*<b>([\s\S]*?)<\/b>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/gi))
    if (items.length > 0) {
      return "\n\n" + items.map((m: any) => `> **${m[1].trim()}**: ${m[2].trim()}`).join("\n>\n") + "\n\n"
    }
    return inner
  })

  text = text.replace(/<div class="mechanism">\s*<b>([\s\S]*?)<\/b>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/gi, (_, title, desc) => {
    return `\n\n> **${title.trim()}**: ${desc.trim()}\n\n`
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
  text = text.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    if (/@|v-|:|class=/i.test(attrs)) {
      return match
    }
    return `\n${inner.trim()}\n\n`
  })

  // 18. 换行与分割符
  text = text.replace(/<br\s*\/?>/gi, "\n")
  text = text.replace(/<hr\s*\/?>/gi, "\n---\n")

  // 19. 行内样式标签
  text = text.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
  text = text.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
  text = text.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
  text = text.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, inner) => {
    if (inner.startsWith("`") && inner.endsWith("`")) return inner
    if (inner.includes("`")) {
      const maxTicks = (inner.match(/`+/g) || []).reduce((max: number, m: string) => Math.max(max, m.length), 0)
      const fence = "`".repeat(maxTicks + 1)
      return `${fence} ${inner} ${fence}`
    }
    return `\`${inner}\``
  })
  text = text.replace(/<small\b[^>]*>([\s\S]*?)<\/small>/gi, "*$1*")

  // 防御性处理: 修复直接相连的粗体标记闭合 (****)，补充空格避免 Markdown 粗体解析损坏
  text = text.replace(/\*{4}/g, "** **")

  // 20. 列表标签
  text = text.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
  text = text.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, "\n$1\n")
  text = text.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, "\n$1\n")

  // 21. 链接与引用
  text = text.replace(/<a\b([^>]*)href=["'](.*?)["']([^>]*)>([\s\S]*?)<\/a>/gi, (match, _prefix, href, _suffix, inner) => {
    const trimmed = inner.trim()
    if (trimmed.includes("<") || trimmed.includes("\n")) {
      return match
    }
    return `[${trimmed}](${href})`
  })
  text = text.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, q) => {
    return "\n" + q.trim().split("\n").map((line: string) => `> ${line.trim()}`).join("\n") + "\n"
  })

  // 21.5 思源笔记 Protyle 原生富文本块引用与链接转换
  text = text.replace(/<span\b[^>]*data-type=["']block-ref["'][^>]*data-id=["']([0-9a-zA-Z-]+)["'][^>]*>([\s\S]*?)<\/span>/gi, (_, id, anchor) => {
    const cleanAnchor = anchor.replace(/<[^>]+>/g, "").trim()
    return cleanAnchor ? `((${id} '${cleanAnchor}'))` : `((${id}))`
  })
  text = text.replace(/<span\b[^>]*data-type=["']a["'][^>]*data-href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/span>/gi, (_, href, anchor) => {
    const cleanAnchor = anchor.replace(/<[^>]+>/g, "").trim()
    return `[${cleanAnchor}](${href})`
  })

  // 22. 解包剩余纯布局标签，块级闭合标签转为换行，行内标签解包，确保块间自然断行
  text = text.replace(/<\/(?:div|section|header|footer|main|article|nav|aside)\b[^>]*>/gi, "\n")
  text = text.replace(/<(?:div|section|header|footer|main|article|nav|aside)\b[^>]*>/gi, "")
  text = text.replace(/<\/?span\b[^>]*>/gi, "")

  // 23. 恢复受保护的 Vue 元素、Script 块与代码块（使用函数式替换，杜绝 $1, $PATH 等被误判为正则捕获组）
  for (let i = 0; i < vueCompTokens.length; i++) {
    text = text.replace(`__VUE_COMP_TOKEN_${i}__`, () => vueCompTokens[i])
  }
  for (let i = 0; i < vueDivTokens.length; i++) {
    text = text.replace(`__VUE_DIV_TOKEN_${i}__`, () => vueDivTokens[i])
  }
  for (let i = 0; i < scriptBlocks.length; i++) {
    text = text.replace(`__SCRIPT_TOKEN_${i}__`, () => scriptBlocks[i])
  }
  for (let i = 0; i < codeBlocks.length; i++) {
    text = text.replace(`__CODE_TOKEN_${i}__`, () => codeBlocks[i])
  }

  // 24. 规范化连续换行与行首尾空格
  text = text.replace(/\n{3,}/g, "\n\n").trim()

  return text
}

/**
 * 从 Kramdown IAL 属性字符串中提取 style="..." 的值（不限制 style 在属性列表中的位置）
 */
function extractStyleFromKramdownAttrs(attrBody: string): string | null {
  const m = attrBody.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
  if (!m) return null
  return (m[1] ?? m[2] ?? "").trim()
}

/**
 * 清洗并转换思源笔记独有的 Kramdown 行内 IAL 属性标记
 * 1. 剔除紧跟在 HTML 行内标签 (如 </span>) 后的冗余 Kramdown Span IAL ({: style="..."})
 * 2. 将紧随行内 Markdown 语法 (**加粗**、*斜体*、~~删除线~~、[链接](url)、==高亮==、__加粗__) 后的 {: ... style="..."} 转换为 <span style="..."> 包裹
 * 3. 将紧随文本词组/含标点片段后的 {: ... style="..."} 转换为 <span style="..."> 包裹
 * 4. 彻底剥离任何残留的思源行内元数据 IAL ({: custom-xxx="..."} 等)，防止在演示中泄漏代码
 */
export function cleanAndTransformInlineKramdown(text: string): string {
  if (!text || typeof text !== "string") return ""

  // 1. 保护行内代码 `...`，避免误伤代码内的文字
  const codeTokens: string[] = []
  let safeText = text.replace(/`([^`]+)`/g, (match) => {
    codeTokens.push(match)
    return `%%INLINE_CODE_${codeTokens.length - 1}%%`
  })

  // 2. 移除紧跟在 HTML 闭合标签后的冗余 Kramdown Span IAL（如 </span>{: style="..."}）
  safeText = safeText.replace(/(<\/[a-zA-Z0-9_-]+>)\s*\{:[^}]*\}/g, "$1")

  // 3. 处理 Markdown 行内语法后的 {: ... style="..." ...}（不限制 style 出现位置）
  const wrapSyntaxWithStyle = (pattern: RegExp) => {
    safeText = safeText.replace(pattern, (full, content: string, attrBody: string) => {
      const styleVal = extractStyleFromKramdownAttrs(attrBody)
      return styleVal ? `<span style="${styleVal}">${content}</span>` : full
    })
  }
  wrapSyntaxWithStyle(/(\[[^\]]+\]\([^)]+\))\s*\{:\s*([^}]*)\}/g)
  wrapSyntaxWithStyle(/(\*\*[^*]+\*\*)\s*\{:\s*([^}]*)\}/g)
  wrapSyntaxWithStyle(/(__[^_]+__)\s*\{:\s*([^}]*)\}/g)
  wrapSyntaxWithStyle(/(==[^=]+==)\s*\{:\s*([^}]*)\}/g)
  wrapSyntaxWithStyle(/(\*[^*]+\*)\s*\{:\s*([^}]*)\}/g)
  wrapSyntaxWithStyle(/(~~[^~]+~~)\s*\{:\s*([^}]*)\}/g)

  // 4. 处理纯词组/中文字符/含标点片段后的 {: ... style="..." ...} (例如: 领域{: style="color: red;"} 或 **文字{: style="color: red;"}**)
  safeText = safeText.replace(/([^\s<>]+)\s*\{:\s*([^}]*)\}/gu, (full, content: string, attrBody: string) => {
    const styleVal = extractStyleFromKramdownAttrs(attrBody)
    if (!styleVal) return full
    const leadingDelim = content.match(/^(\*\*|__|==|~~|\*)(.+)$/)
    if (leadingDelim) {
      return `${leadingDelim[1]}<span style="${styleVal}">${leadingDelim[2]}</span>`
    }
    return `<span style="${styleVal}">${content}</span>`
  })

  // 5. 移除任何剩余的行内 Kramdown 属性标记 {: ... }（如 {: custom-id="..."}、{: id="..."} 等思源元数据）
  safeText = safeText.replace(/\{:[^}]*\}/g, "")

  // 6. 还原行内代码
  safeText = safeText.replace(/%%INLINE_CODE_(\d+)%%/g, (_, idx) => codeTokens[parseInt(idx, 10)] || "")

  return safeText
}
