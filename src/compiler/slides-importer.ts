import {
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_COLOR_SCHEMA,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_THEME,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_CLASS,
  ATTR_PAGE_IMAGE,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
  ATTR_PAGE_MASK,
  ATTR_PAGE_MASK_RATIO,
  ATTR_PAGE_MASK_STYLE,
  ATTR_PAGE_MASK_INITIAL,
  ATTR_PAGE_TRANSITION,
} from "../types/slides-protocol"
import {
  extractSlideMatter,
  parseYamlFrontmatter,
  resolveCodeSnippet,
  stripInlineComment,
  tryReadFsFile,
} from "./frontmatter-parser"
import type { IRawSlideData } from "./frontmatter-parser"

export {
  extractSlideMatter,
  parseYamlFrontmatter,
  resolveCodeSnippet,
  stripInlineComment,
  tryReadFsFile,
}
export type { IRawSlideData }

export interface IParsedSlideItem {
  pageIndex: number
  pageAttrs: Record<string, string>
  notes: string
  rawMarkdown: string
  hasVueComponent: boolean
  hasStyleTag: boolean
  assetReferences: string[]
}

export interface IParsedSlidesPresentation {
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
  wrapSuperBlocks?: boolean
  virtualFiles?: Record<string, string>
  baseDir?: string
}

/**
 * 依循 Slidev 官方词法状态机切分幻灯片
 */
export function splitSlidesMarkdownChunks(markdown: string): string[] {
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
      // 严格判定是否为 Frontmatter 起始符：
      // 1. 当前行必须是纯破折号分割线（---...）且下一行非空
      // 2. 后面必须存在匹配的闭合 ---（且两者之间绝不能跨越正文代码块 fence）
      // 3. 两者之间必须包含顶级 YAML 键值对（支持行首带有 # 注释的合法 YAML 块），杜绝误吞纯 Markdown 标题或正文
      let isFrontmatterStart = false
      let closingIndex = -1

      const trimmedNext = next ? next.trim() : ""
      if (line.replace(/^-+/, "").trim() === "" && trimmedNext.length > 0) {
        for (let j = i + 1; j < lines.length; j++) {
          const curTrim = lines[j].trimEnd()
          if (curTrim.startsWith("```")) {
            // 遇到代码块，说明已处于幻灯片正文区域，绝非 Frontmatter
            break
          }
          if (curTrim === "---") {
            closingIndex = j
            break
          }
        }
        if (closingIndex !== -1 && closingIndex - i <= 60) {
          const innerLines = lines.slice(i + 1, closingIndex)
          const hasYamlKey = innerLines.some(l => {
            const trimmed = l.trim()
            return trimmed.length > 0 && !trimmed.startsWith("#") && /^[a-zA-Z0-9_$-]+\s*:\s*.*/.test(trimmed)
          })
          if (hasYamlKey) {
            isFrontmatterStart = true
          }
        }
      }

      if (isFrontmatterStart && closingIndex !== -1) {
        start = i
        i = closingIndex
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

import { convertHtmlToCleanMarkdown } from "./html-cleaner"
export { convertHtmlToCleanMarkdown }

/**
 * 核心解析入口：将 Slidev Markdown 完整解析为结构化思源演示包
 */
export function parseSlidesPresentation(
  content: string,
  options: IImportOptions = {},
): IParsedSlidesPresentation {
  const {
    stripNotesFromMarkdown = true,
    cleanVClicks = true,
    cleanShikiLines = true,
    cleanSlots = true,
    isolateStyleTags = true,
    cleanHtmlToMarkdown = true,
    wrapSuperBlocks = true,
    virtualFiles = {},
  } = options

  // 导入时如果不以 --- 开头，自动在第一段添加 --- 段落
  let normalizedContent = content
  if (normalizedContent && !normalizedContent.trimStart().startsWith("---")) {
    normalizedContent = `---\n\n${normalizedContent.trimStart()}`
  }

  const rawSlides = splitSlidesMarkdownChunks(normalizedContent)

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

  function normalizeImportedLayout(rawLayout: unknown, targetAttrs: Record<string, string>, frontmatterObj: Record<string, any>) {
    const layoutStr = String(rawLayout)
    if (layoutStr === "two-cols-header") {
      targetAttrs[ATTR_PAGE_LAYOUT] = "cols-header"
    } else if (layoutStr === "three-cols-header") {
      targetAttrs[ATTR_PAGE_LAYOUT] = "cols-header"
      if (!frontmatterObj.layoutRatio && !frontmatterObj["layout-ratio"]) {
        targetAttrs[ATTR_PAGE_LAYOUT_RATIO] = "1:1:1"
      }
    } else {
      targetAttrs[ATTR_PAGE_LAYOUT] = layoutStr
    }
  }

  function applyHeadmatter(parsedHead: Record<string, any>) {
    docTitle = parsedHead.title || ""
    if (parsedHead.theme) docRootAttrs[ATTR_DOC_THEME] = String(parsedHead.theme)
    if (parsedHead.aspectRatio) docRootAttrs[ATTR_DOC_ASPECT_RATIO] = String(parsedHead.aspectRatio)
    if (parsedHead.transition) docRootAttrs[ATTR_DOC_DEFAULT_TRANSITION] = String(parsedHead.transition)
    if (parsedHead.colorSchema) docRootAttrs[ATTR_DOC_COLOR_SCHEMA] = String(parsedHead.colorSchema)

    if (parsedHead.layout) normalizeImportedLayout(parsedHead.layout, docRootAttrs, parsedHead)
    if (parsedHead.background) docRootAttrs[ATTR_PAGE_BACKGROUND] = String(parsedHead.background)
    if (parsedHead.image) docRootAttrs[ATTR_PAGE_IMAGE] = String(parsedHead.image)
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
          "image",
          "class",
        ].includes(k)
      ) {
        docRootAttrs[`custom-slides-${k}`] = typeof v === "object" ? JSON.stringify(v) : String(v)
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

    const { frontmatter, content: slideBody } = extractSlideMatter(rawSlide)

    // 处理 src: ./pages/*.md 外部子页面展开
    const srcRawMatch = rawSlide.match(/^\s*(?:---\s*)?src:\s*([^\n\r]+)/m)
    const srcVal = frontmatter.src || (srcRawMatch ? srcRawMatch[1] : undefined)

    if (srcVal) {
      const subPath = String(srcVal).trim().replace(/^['"]|['"]$/g, "")
      let subContent = virtualFiles[subPath]
        || virtualFiles[subPath.replace(/^\.\//, "")]
        || virtualFiles[`pages/${subPath.replace(/^.*pages\//, "")}`]

      if (!subContent) {
        const cleanSub = subPath.replace(/^\.\//, "")
        const candidatePaths: string[] = []
        if (options.baseDir) {
          try {
            const path = require("path")
            candidatePaths.push(path.resolve(options.baseDir, cleanSub))
            candidatePaths.push(path.resolve(options.baseDir, subPath))
          } catch {}
        }
        try {
          const path = require("path")
          candidatePaths.push(path.resolve(process.cwd(), cleanSub))
          candidatePaths.push(path.resolve(process.cwd(), subPath))
        } catch {}

        for (const cp of candidatePaths) {
          const diskText = tryReadFsFile(cp)
          if (diskText !== null) {
            subContent = diskText
            break
          }
        }
      }

      // 构建除 src 外继承给子页面的 frontmatter 控制属性 (如 hide: false 等)
      const inheritedAttrs: Record<string, string> = {}
      if (frontmatter.layout) normalizeImportedLayout(frontmatter.layout, inheritedAttrs, frontmatter)
      if (frontmatter.transition) inheritedAttrs[ATTR_PAGE_TRANSITION] = String(frontmatter.transition)
      if (frontmatter.background) inheritedAttrs[ATTR_PAGE_BACKGROUND] = String(frontmatter.background)
      if (frontmatter.image) inheritedAttrs[ATTR_PAGE_IMAGE] = String(frontmatter.image)
      if (frontmatter.class) inheritedAttrs[ATTR_PAGE_CLASS] = String(frontmatter.class)
      for (const [k, v] of Object.entries(frontmatter)) {
        if (!["src", "layout", "transition", "background", "image", "class"].includes(k)) {
          inheritedAttrs[`custom-slides-${k}`] = typeof v === "object" ? JSON.stringify(v) : String(v)
        }
      }

      if (subContent) {
        const subParsed = parseSlidesPresentation(subContent, { ...options, virtualFiles })
        for (const subSlide of subParsed.slides) {
          subSlide.pageIndex = pageIndex++
          subSlide.pageAttrs = { ...inheritedAttrs, ...subSlide.pageAttrs }
          slides.push(subSlide)
          const l = subSlide.pageAttrs[ATTR_PAGE_LAYOUT] || "default"
          layoutDistribution[l] = (layoutDistribution[l] || 0) + 1
        }
        continue
      } else {
        // 未提供子页面实体时，生成规范提示占位，防止出现空白黑洞页
        slides.push({
          pageIndex: pageIndex++,
          pageAttrs: { ...inheritedAttrs, "custom-slides-src": subPath },
          notes: "",
          rawMarkdown: `> 📄 **引入外部幻灯片页面**: \`${subPath}\`\n>\n> *提示：如需展示该页面完整内容，请将关联子页面一同打包为 .zip 或通过本地工程导入。*`,
          hasVueComponent: false,
          hasStyleTag: false,
          assetReferences: [],
        })
        const l = inheritedAttrs[ATTR_PAGE_LAYOUT] || "default"
        layoutDistribution[l] = (layoutDistribution[l] || 0) + 1
        continue
      }
    }

    const pageAttrs: Record<string, string> = {}
    if (frontmatter.layout) normalizeImportedLayout(frontmatter.layout, pageAttrs, frontmatter)
    if (frontmatter.transition) pageAttrs[ATTR_PAGE_TRANSITION] = String(frontmatter.transition)
    if (frontmatter.background) pageAttrs[ATTR_PAGE_BACKGROUND] = String(frontmatter.background)
    if (frontmatter.image) pageAttrs[ATTR_PAGE_IMAGE] = String(frontmatter.image)
    if (frontmatter.class) pageAttrs[ATTR_PAGE_CLASS] = String(frontmatter.class)
    if (frontmatter.mask) pageAttrs[ATTR_PAGE_MASK] = String(frontmatter.mask)
    if (frontmatter.maskRatio || frontmatter["mask-ratio"]) pageAttrs[ATTR_PAGE_MASK_RATIO] = String(frontmatter.maskRatio || frontmatter["mask-ratio"])
    if (frontmatter.maskStyle || frontmatter["mask-style"]) pageAttrs[ATTR_PAGE_MASK_STYLE] = String(frontmatter.maskStyle || frontmatter["mask-style"])
    if (frontmatter.maskInitial || frontmatter["mask-initial"]) pageAttrs[ATTR_PAGE_MASK_INITIAL] = String(frontmatter.maskInitial || frontmatter["mask-initial"])

    for (const [k, v] of Object.entries(frontmatter)) {
      if (![
        "layout", "transition", "background", "image", "class",
        "mask", "maskRatio", "mask-ratio", "maskStyle", "mask-style", "maskInitial", "mask-initial"
      ].includes(k)) {
        pageAttrs[`custom-slides-${k}`] = typeof v === "object" ? JSON.stringify(v) : String(v)
      }
    }

    let body = slideBody

    // 保护正文中的所有代码块（包含多行围栏代码块与单行行内代码），防止代码块内部的注释被误识别为 slide notes
    const codeTokens: string[] = []
    let protectedBody = body.replace(/(?:^[ \t]*(`{3,}|~{3,})[^\n\r]*\r?\n[\s\S]*?\r?\n[ \t]*\1(?=[ \t]*(?:\r?\n|$)))/gm, (match) => {
      const token = `__CODE_TOKEN_NOTE_${codeTokens.length}__`
      codeTokens.push(match)
      return token
    })
    protectedBody = protectedBody.replace(/(`+)(?:[^\n\r`]|(?!\1)`)+?\1/g, (match) => {
      const token = `__CODE_TOKEN_NOTE_${codeTokens.length}__`
      codeTokens.push(match)
      return token
    })

    // 提取演讲者提词备注 <!-- notes --> (排除 TODO)
    // 依循 Slidev 官方定义：只有位于幻灯片正文末尾的最后一个 HTML 注释块才是 slide notes
    let pageNotes = ""
    const commentMatches = Array.from(protectedBody.matchAll(/<!--([\s\S]*?)-->/g))
    if (commentMatches.length > 0) {
      const last = commentMatches[commentMatches.length - 1]
      const trailingContent = protectedBody.slice(last.index! + last[0].length).trim()
      const isTrailing = !trailingContent || !trailingContent.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").trim()

      if (isTrailing) {
        const noteContent = last[1].trim()
        if (!noteContent.startsWith("TODO:")) {
          pageNotes = noteContent
          totalNotes++
        }
        if (stripNotesFromMarkdown) {
          protectedBody = protectedBody.slice(0, last.index).trimEnd() + protectedBody.slice(last.index! + last[0].length)
        }
      }
    }

    if (stripNotesFromMarkdown) {
      // 移除其余普通 HTML 注释（非 notes 注释），保持笔记正文清爽（保留以 TODO 开头的待办标记）
      protectedBody = protectedBody.replace(/<!--(?![\s\S]*?TODO:)[\s\S]*?-->/g, "").trim()
    }

    // 恢复受保护的代码块（使用函数式替换，杜绝代码中 $1, $PATH, $$ 导致正则捕获组意外替换）
    for (let i = 0; i < codeTokens.length; i++) {
      protectedBody = protectedBody.replace(`__CODE_TOKEN_NOTE_${i}__`, () => codeTokens[i])
    }
    body = protectedBody

    if (pageNotes) {
      for (let i = 0; i < codeTokens.length; i++) {
        pageNotes = pageNotes.replace(`__CODE_TOKEN_NOTE_${i}__`, () => codeTokens[i])
      }
      // 转换为正文讲稿备注提示块 (NodeCallout)，并绑定 custom-slides-note="true"
      const noteLines = pageNotes.split(/\r?\n/).map(l => `> ${l}`).join("\n")
      const noteBlockMd = `> [!NOTE] 💡 演讲备注\n${noteLines}\n{: custom-slides-note="true"}`
      body = body ? `${body}\n\n${noteBlockMd}` : noteBlockMd
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

    // 展开外部代码切片语法: <<< @/snippets/external.ts#snippet
    body = body.replace(/^[ \t]*<<<[ \t]+([^\n\r]+)/gm, (match) => {
      const resolved = resolveCodeSnippet(match, { ...options, virtualFiles })
      return resolved || match
    })

    if (cleanVClicks) {
      body = body.replace(/<v-click(?:\s+at="[^"]*")?(?:\s+hide)?>\s*([\s\S]*?)\s*<\/v-click>/gi, "$1")
    }

    if (cleanShikiLines) {
      body = body.replace(/(^```\w+(?:[ \t]+\[[^\]]*\])?)[ \t]+\{[^}]+\}(?:[ \t]+\w+)?/gm, "$1")
      // 清理数学公式块中的 Slidev 渐进展示修饰符: $$ {1|3|all} -> $$
      body = body.replace(/^\$\$\s+\{[^}]+\}/gm, () => "$$")
    }

    if (cleanSlots) {
      body = body.replace(/^::\w+::\s*$/gm, "")
    }

    if (cleanHtmlToMarkdown) {
      body = convertHtmlToCleanMarkdown(body)
    }

    // 组织图文分栏超级块与正文背景图
    if (wrapSuperBlocks) {
      let contentBody = body.trim()
      let noteSuffix = ""
      const noteCalloutIndex = contentBody.lastIndexOf("> [!NOTE] 💡 演讲备注")
      if (noteCalloutIndex !== -1) {
        noteSuffix = contentBody.slice(noteCalloutIndex)
        contentBody = contentBody.slice(0, noteCalloutIndex).trim()
      }

      if (
        (frontmatter.layout === "image-left" || frontmatter.layout === "image-right") &&
        frontmatter.image
      ) {
        const imgUrl = String(frontmatter.image).trim()
        const layoutAttr = frontmatter.layout === "image-left" ? "image-left" : "image-right"
        const imgBlockMd = `![配图](${imgUrl})\n{: custom-slides-layout="${layoutAttr}" }`
        if (frontmatter.layout === "image-left") {
          contentBody = `{{{col\n\n${imgBlockMd}\n\n${contentBody}\n\n}}}`
        } else {
          contentBody = `{{{col\n\n${contentBody}\n\n${imgBlockMd}\n\n}}}`
        }
      }

      if (frontmatter.background) {
        const bgImg = String(frontmatter.background).trim()
        const bgBlockMd = `![背景图](${bgImg})\n{: custom-slides-role="background" }`
        contentBody = contentBody ? `${bgBlockMd}\n\n${contentBody}` : bgBlockMd
      }

      body = noteSuffix ? `${contentBody}\n\n${noteSuffix}` : contentBody
    }

    const assetRefs = extractAssetReferences(body)
    if (pageAttrs[ATTR_PAGE_BACKGROUND]) {
      assetRefs.push(pageAttrs[ATTR_PAGE_BACKGROUND])
    }
    if (pageAttrs[ATTR_PAGE_IMAGE]) {
      assetRefs.push(pageAttrs[ATTR_PAGE_IMAGE])
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
    docRootAttrs["custom-slides-custom-css"] = customCssCollected
  }

  let flattenedMarkdown = slides.map((s) => {
    return `---\n\n${s.rawMarkdown}`
  }).join("\n\n")

  if (!flattenedMarkdown.trimStart().startsWith("---")) {
    flattenedMarkdown = `---\n\n${flattenedMarkdown.trimStart()}`
  }

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

  const htmlRegex = /<(?:img|video|source|audio)\b[^>]*src=["'](.*?)["']/gi
  while ((match = htmlRegex.exec(markdown)) !== null) {
    const url = match[1].trim()
    if (url) assets.push(url)
  }

  return assets
}
