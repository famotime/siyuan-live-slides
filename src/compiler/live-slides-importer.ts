/**
 * 即现 (SiYuan Live Slides) 原生演示文档解析与导入器
 *
 * 核心职责：
 * 1. 精准识别并剥离正文中紧随各块的 IAL 属性标记 ({: custom-slides-* ...})，生成 100% 纯净整洁的 Markdown；
 * 2. 剥离正文中的演讲备注 Callout 块 (> [!NOTE] 💡 演讲备注)，提取为页面级提词备注存入分割线属性，杜绝备注污染正文；
 * 3. 严格规范分页分割线：确保文档开头有且仅有一条前导分割线，且各页之间绝无重复分割线，分割线数量与幻灯片页数 1:1 精准对应；
 * 4. 搜集并读取本地相对路径素材，支持上传至思源 assets/ 资产库并重写路径；
 * 5. 建档后通过思源 API 批量回填页面属性与元素级动效/插槽属性。
 */

import { parseKramdownIAL } from "./ast-crawler"
import type { IExtractedAssetItem } from "./asset-importer"
import type { IParsedSlideItem, IParsedSlidesPresentation } from "./slides-importer"
import {
  ATTR_DOC_ASPECT_RATIO,
  ATTR_DOC_COLOR_SCHEMA,
  ATTR_DOC_DEFAULT_TRANSITION,
  ATTR_DOC_THEME,
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_IMAGE,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
  ATTR_PAGE_MASK,
  ATTR_PAGE_MASK_INITIAL,
  ATTR_PAGE_MASK_RATIO,
  ATTR_PAGE_MASK_STYLE,
  ATTR_PAGE_TRANSITION,
  ATTR_PAGE_NOTES,
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_NOTE,
  ATTR_ELEM_ROLE,
  ATTR_ELEM_SHIKI_LINES,
  ATTR_ELEM_SLOT,
} from "../types/slides-protocol"

/** 块属性绑定条目 */
export interface ILiveSlideBlockBinding {
  /** 所在幻灯片页码 (从 1 开始) */
  pageIndex: number
  /** 关联块的类型特征 ('h' 标题, 'tb' 分割线, 'i' 列表项, 'p' 段落, 'c' 代码块, 'b' 引用块, 'img' 图片等) */
  blockType: string
  /** 块文本的前缀指纹 (纯文本前 40 字符，用于回填时对齐思源生成的真实块) */
  contentPreview: string
  /** 提取到的块属性字典 */
  attrs: Record<string, string>
  /** 是否为页面级属性 (承载在水平分割线或第 1 页首块) */
  isPageLevel?: boolean
}

/** 即现演示文档解析产物 */
export interface IParsedLiveSlidesPresentation extends IParsedSlidesPresentation {
  formatType: "live"
  blockAttrBindings: ILiveSlideBlockBinding[]
}

export interface ILiveImportOptions {
  /** 是否将演讲备注 Callout 剥离出正文并转换为页面级 notes (默认 true) */
  stripCalloutNotes?: boolean
}

/**
 * 智能嗅探文档格式是【即现原生文档】还是【Slidev 演示工程】
 */
export function detectPresentationFormat(
  contentOrFileName: string,
  content = "",
): "live" | "slidev" {
  const combined = `${contentOrFileName}\n${content}`
  if (/custom-slides-[\w-]+/i.test(combined) || /\{:\s*custom-slides-/i.test(combined)) {
    return "live"
  }
  if (/^---\s*[\r\n]+(?:\s*#.*[\r\n]+)*(?:layout|theme|highlighter|transition|background):/im.test(combined)) {
    return "slidev"
  }
  return "live"
}

/**
 * 提取文本中引用的媒体资源路径 (排除 http/https/data:)
 */
export function extractLocalAssetPaths(text: string): string[] {
  const assets: string[] = []
  function addPath(raw: string) {
    const clean = raw.trim().replace(/^['"]|['"]$/g, "")
    if (!clean) return
    if (/^(?:https?:|\/\/|data:)/i.test(clean)) return
    if (!assets.includes(clean)) {
      assets.push(clean)
    }
  }

  // 1. Markdown 图片: ![alt](url)
  const mdImgRegex = /!\[.*?\]\((.+?)\)/g
  let m: RegExpExecArray | null
  while ((m = mdImgRegex.exec(text)) !== null) {
    const u = m[1].trim().split(/\s+/)[0]
    addPath(u)
  }

  // 2. HTML img 标签: <img src="url">
  const htmlImgRegex = /<img\s+[^>]*src=["']([^"']+)["']/gi
  while ((m = htmlImgRegex.exec(text)) !== null) {
    if (m[1]) addPath(m[1])
  }

  // 3. custom-slides-image 或 custom-slides-background 属性
  const attrImgRegex = /custom-slides-(?:image|background)=["']([^"']+)["']/g
  while ((m = attrImgRegex.exec(text)) !== null) {
    if (m[1]) addPath(m[1])
  }

  return assets
}

/**
 * 获取 Node/Electron 本地模块 (fs / path)
 */
export function getLocalNodeModule(name: string): any {
  try {
    if (typeof window !== "undefined" && typeof (window as any).require === "function") {
      return (window as any).require(name)
    }
    if (typeof require === "function") {
      return require(name)
    }
    if (typeof process !== "undefined" && (process as any).mainModule?.require) {
      return (process as any).mainModule.require(name)
    }
  } catch {}
  return null
}

/**
 * 安全尝试从本地文件系统读取二进制资产 (适用于 Node / Electron 桌面宿主环境)
 */
export function tryReadLocalBinary(absOrRelPath: string, candidateBaseDirs: string[] = []): Uint8Array | null {
  try {
    const fs = getLocalNodeModule("fs")
    const path = getLocalNodeModule("path")
    if (!fs) return null

    // 1. 尝试直接路径
    if (fs.existsSync(absOrRelPath)) {
      const buf = fs.readFileSync(absOrRelPath)
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    }

    // 2. 尝试各候选目录拼接
    if (path) {
      for (const base of candidateBaseDirs) {
        if (!base) continue
        const candidate = path.resolve(base, absOrRelPath)
        if (fs.existsSync(candidate)) {
          const buf = fs.readFileSync(candidate)
          return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
        }
      }
    }
  } catch {}
  return null
}

/**
 * 搜集 Markdown 中引用的所有本地文件资产
 */
export function collectLocalAssetsForMarkdown(
  markdownText: string,
  baseDir = "",
): IExtractedAssetItem[] {
  const assetPaths = extractLocalAssetPaths(markdownText)
  const items: IExtractedAssetItem[] = []
  const path = getLocalNodeModule("path")

  const candidateDirs: string[] = []
  if (baseDir) candidateDirs.push(baseDir)
  if (typeof process !== "undefined" && process.cwd) {
    candidateDirs.push(process.cwd())
    if (path) {
      try {
        candidateDirs.push(path.resolve(process.cwd(), "docs"))
        candidateDirs.push(path.resolve(process.cwd(), "docs/reference"))
        if (baseDir) {
          candidateDirs.push(path.resolve(baseDir, ".."))
          candidateDirs.push(path.resolve(baseDir, "reference"))
        }
      } catch {}
    }
  }

  for (const relPath of assetPaths) {
    const bytes = tryReadLocalBinary(relPath, candidateDirs)
    if (bytes) {
      const fileName = relPath.split(/[\\/]/).pop() || relPath
      items.push({
        zipPath: relPath,
        fileName,
        data: bytes,
        blob: typeof Blob !== "undefined" ? new Blob([bytes as any]) : undefined,
      })
    }
  }

  return items
}

/**
 * 解析即现原生 Markdown 演示文档
 */
export function parseLiveSlidesMarkdown(
  rawMarkdown: string,
  options: ILiveImportOptions = {},
): IParsedLiveSlidesPresentation {
  const stripCalloutNotes = options.stripCalloutNotes !== false
  const lines = rawMarkdown.split(/\r?\n/)

  const slides: IParsedSlideItem[] = []
  const blockBindings: ILiveSlideBlockBinding[] = []
  const docRootAttrs: Record<string, string> = {}
  let docTitle = ""

  let currentPageIndex = 1
  let currentSlidePageAttrs: Record<string, string> = {}
  let currentSlideNotes: string[] = []
  let currentSlideCleanLines: string[] = []
  let currentSlideAssets: string[] = []

  let inCodeFence = false
  let codeFenceMarker = ""

  // 记录上一个块的信息
  interface ILastBlockInfo {
    blockType: string
    contentPreview: string
    isFirstHeadingInDoc?: boolean
    isDivider?: boolean
    isCalloutNote?: boolean
    calloutStartLineIdx?: number
  }
  let lastBlock: ILastBlockInfo | null = null

  function flushCurrentSlide() {
    const notesStr = currentSlideNotes.join("\n").trim()
    const pageAttrs = { ...currentSlidePageAttrs }
    if (notesStr) {
      pageAttrs[ATTR_PAGE_NOTES] = notesStr
    }

    // 剔除首尾空行，且确保 cleanLines 内部绝对没有包含分页符
    const rawSlideMd = currentSlideCleanLines.join("\n").trim()

    slides.push({
      pageIndex: currentPageIndex,
      pageAttrs,
      notes: notesStr,
      rawMarkdown: rawSlideMd,
      hasVueComponent: false,
      hasStyleTag: false,
      assetReferences: [...currentSlideAssets],
    })

    currentPageIndex++
    currentSlidePageAttrs = {}
    currentSlideNotes = []
    currentSlideCleanLines = []
    currentSlideAssets = []
    lastBlock = null
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    // 1. 代码块围栏 (``` 或 ~~~)
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/)
    if (fenceMatch) {
      if (!inCodeFence) {
        inCodeFence = true
        codeFenceMarker = fenceMatch[1]
      } else if (trimmed.startsWith(codeFenceMarker)) {
        inCodeFence = false
        codeFenceMarker = ""
        lastBlock = {
          blockType: "c",
          contentPreview: currentSlideCleanLines.slice(-3).join("\n").slice(0, 40),
        }
      }
      currentSlideCleanLines.push(rawLine)
      continue
    }

    if (inCodeFence) {
      currentSlideCleanLines.push(rawLine)
      continue
    }

    // 2. 水平分割线 / 分页符检测 (--- 或 ***)
    const isDividerLine = /^(?:---|\*\*\*)\s*$/.test(trimmed)
    if (isDividerLine) {
      // 若当前是第 1 页且前面尚未有实质内容，说明是定义第 1 页配置的前导分割线
      if (currentPageIndex === 1 && currentSlideCleanLines.length === 0) {
        lastBlock = {
          blockType: "tb",
          contentPreview: "---",
          isDivider: true,
        }
        // 注意：每一页内部的 cleanLines 绝对不要 push 分割线行，后续由组装时统一在每页前插入
        continue
      }

      // 否则为切页分割线：完成上一页的归档
      flushCurrentSlide()
      lastBlock = {
        blockType: "tb",
        contentPreview: "---",
        isDivider: true,
      }
      continue
    }

    // 3. Kramdown IAL 属性行检测: {: attr="val" ... }
    const ialMatch = trimmed.match(/^\{:\s*([\s\S]+?)\s*\}$/)
    if (ialMatch) {
      const attrs = parseKramdownIAL(ialMatch[0])
      const slideAttrs: Record<string, string> = {}
      for (const [k, v] of Object.entries(attrs)) {
        if (k.startsWith("custom-slides-") || k === "id" || k === "class") {
          slideAttrs[k] = v
        }
      }

      if (Object.keys(slideAttrs).length > 0) {
        const isDivider = lastBlock?.isDivider
        const isFirstDocHeading = lastBlock?.isFirstHeadingInDoc

        // A. 页面级属性 (承载在分割线后，或文档首个标题后)
        if (isDivider || (currentPageIndex === 1 && isFirstDocHeading)) {
          Object.assign(currentSlidePageAttrs, slideAttrs)

          blockBindings.push({
            pageIndex: currentPageIndex,
            blockType: isDivider ? "tb" : "h",
            contentPreview: isDivider ? "---" : (lastBlock?.contentPreview || ""),
            attrs: slideAttrs,
            isPageLevel: true,
          })

          if (currentPageIndex === 1) {
            if (slideAttrs[ATTR_DOC_THEME]) docRootAttrs[ATTR_DOC_THEME] = slideAttrs[ATTR_DOC_THEME]
            if (slideAttrs[ATTR_DOC_ASPECT_RATIO]) docRootAttrs[ATTR_DOC_ASPECT_RATIO] = slideAttrs[ATTR_DOC_ASPECT_RATIO]
            if (slideAttrs[ATTR_DOC_DEFAULT_TRANSITION]) docRootAttrs[ATTR_DOC_DEFAULT_TRANSITION] = slideAttrs[ATTR_DOC_DEFAULT_TRANSITION]
            if (slideAttrs[ATTR_DOC_COLOR_SCHEMA]) docRootAttrs[ATTR_DOC_COLOR_SCHEMA] = slideAttrs[ATTR_DOC_COLOR_SCHEMA]
          }
        } else {
          // B. 元素级块属性
          // 如果当前块是演讲备注 Callout 且配置了 stripCalloutNotes
          if (slideAttrs[ATTR_ELEM_NOTE] === "true" && stripCalloutNotes && lastBlock?.isCalloutNote) {
            // 已在识别 Callout 时处理，不写入正文
          } else {
            blockBindings.push({
              pageIndex: currentPageIndex,
              blockType: lastBlock?.blockType || "p",
              contentPreview: lastBlock?.contentPreview || "",
              attrs: slideAttrs,
              isPageLevel: false,
            })
          }
        }
      }

      // 搜集属性中引用的素材
      for (const val of Object.values(slideAttrs)) {
        if (/\.(?:png|jpe?g|gif|webp|svg|bmp|mp4|webm)(?:[?#]|$)/i.test(val)) {
          currentSlideAssets.push(val)
        }
      }

      // 核心：彻底剥离 IAL 标记行，绝不写入 cleanLines
      continue
    }

    // 4. 演讲备注 Callout 块检测 (> [!NOTE] 💡 演讲备注 或 > 💡 演讲备注)
    const isCalloutNoteStart = /^>\s*(?:\[!NOTE\]\s*)?💡?\s*演讲备注/i.test(trimmed)
    if (isCalloutNoteStart) {
      // 提取提词内容
      const noteLines: string[] = []
      // 循环读取紧跟的引用行
      while (i < lines.length) {
        const curTrim = lines[i].trim()
        if (curTrim.startsWith(">")) {
          const bodyLine = curTrim
            .replace(/^>\s*(?:\[!NOTE\]\s*)?💡?\s*演讲备注/i, "")
            .replace(/^>\s*/, "")
            .trim()
          if (bodyLine) {
            noteLines.push(bodyLine)
          }
          i++
        } else if (/^\{:\s*custom-slides-note="true"\s*\}$/i.test(curTrim)) {
          // 紧随的备注 IAL 行，跳过
          i++
          break
        } else {
          // 非引用行，回退一行退出 Callout 读取
          i--
          break
        }
      }

      if (noteLines.length > 0) {
        currentSlideNotes.push(...noteLines)
      }

      lastBlock = {
        blockType: "b",
        contentPreview: "💡 演讲备注",
        isCalloutNote: true,
      }

      // 核心：若设置了剥离备注，绝不将备注块行加入 currentSlideCleanLines！
      if (stripCalloutNotes) {
        continue
      }
    }

    // 5. 普通正文行处理
    currentSlideCleanLines.push(rawLine)

    // 搜集正文图片素材
    const foundAssets = extractLocalAssetPaths(rawLine)
    if (foundAssets.length > 0) {
      currentSlideAssets.push(...foundAssets)
    }

    if (!trimmed) {
      continue
    }

    // 逻辑块分类识别
    let bType = "p"
    let isFirstDocH = false

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      bType = "h"
      if (!docTitle && headingMatch[1].length <= 2) {
        docTitle = headingMatch[2].trim()
      }
      if (currentPageIndex === 1 && !lastBlock) {
        isFirstDocH = true
      }
    } else if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      bType = "i"
    } else if (trimmed.startsWith(">")) {
      bType = "b"
    } else if (/^!\[.*?\]\(.+?\)/.test(trimmed)) {
      bType = "img"
    }

    lastBlock = {
      blockType: bType,
      contentPreview: trimmed.replace(/^#{1,6}\s+/, "").replace(/^[-*+]\s+/, "").slice(0, 40),
      isFirstHeadingInDoc: isFirstDocH,
      isDivider: false,
    }
  }

  // 收尾最后一页
  if (currentSlideCleanLines.length > 0 || Object.keys(currentSlidePageAttrs).length > 0 || currentSlideNotes.length > 0) {
    flushCurrentSlide()
  }

  // 统计汇总
  const layoutDistribution: Record<string, number> = {}
  let totalNotes = 0
  let totalVClicks = 0
  let totalShikiHighlights = 0
  let totalSlots = 0
  const allDiscoveredAssets: string[] = []

  for (const s of slides) {
    const layout = s.pageAttrs[ATTR_PAGE_LAYOUT] || "default"
    layoutDistribution[layout] = (layoutDistribution[layout] || 0) + 1
    if (s.notes) totalNotes++
    for (const a of s.assetReferences) {
      if (!allDiscoveredAssets.includes(a)) allDiscoveredAssets.push(a)
    }
  }

  for (const b of blockBindings) {
    if (b.attrs[ATTR_ELEM_CLICK]) totalVClicks++
    if (b.attrs[ATTR_ELEM_SHIKI_LINES]) totalShikiHighlights++
    if (b.attrs[ATTR_ELEM_SLOT]) totalSlots++
  }

  // 核心：整篇文档必须有且仅以一条水平分割线 --- 开头，且各页之间有且仅有一条分割线
  // 结构：---\n\n[页1]\n\n---\n\n[页2]\n\n---\n\n[页3]...
  // 这样共有 N 页就会有恰好 N 条分割线，1:1 严格对齐！
  const flattenedMarkdown = slides
    .map(s => `---\n\n${s.rawMarkdown}`)
    .join("\n\n")
    .trim()

  return {
    formatType: "live",
    docTitle: docTitle || "即现演示文稿",
    docRootAttrs,
    slides,
    totalSlides: slides.length,
    stats: {
      totalNotes,
      totalVClicks,
      totalShikiHighlights,
      totalSlots,
      discoveredAssets: allDiscoveredAssets,
      layoutDistribution,
    },
    flattenedMarkdown,
    blockAttrBindings: blockBindings,
  }
}

/**
 * 递归扁平化遍历思源块树
 */
export async function fetchDocumentBlockTree(
  rootId: string,
  getChildBlocksFn: (id: string) => Promise<any[]>,
): Promise<any[]> {
  const result: any[] = []

  async function walk(blockId: string) {
    const children = await getChildBlocksFn(blockId).catch(() => [])
    if (!Array.isArray(children) || children.length === 0) return

    for (const child of children) {
      result.push(child)
      const t = String(child.type || "").toLowerCase()
      if (t === "l" || t === "i" || t === "b" || t === "s") {
        await walk(child.id)
      }
    }
  }

  await walk(rootId)
  return result
}

/**
 * 回填即现原生演示块属性 (1:1 严格对齐各页分割线属性与元素级动效/插槽属性)
 */
export async function backfillLiveSlidesAttributes(
  rootDocId: string,
  presentation: IParsedLiveSlidesPresentation,
  api: {
    setAttrsFn?: (id: string, attrs: Record<string, string>) => Promise<any>
    getChildBlocksFn?: (id: string) => Promise<any[]>
  } = {},
): Promise<{ updatedCount: number; matchedBindings: number }> {
  const setAttrsFn = api.setAttrsFn || (async () => {})
  const getChildBlocksFn = api.getChildBlocksFn || (async () => [])

  let updatedCount = 0
  let matchedBindings = 0

  // 1. 设置根文档属性 (包含全局演示配置)
  const firstSlideAttrs = presentation.slides[0]?.pageAttrs || {}
  const rootCombinedAttrs = { ...firstSlideAttrs, ...presentation.docRootAttrs }
  if (Object.keys(rootCombinedAttrs).length > 0) {
    await setAttrsFn(rootDocId, rootCombinedAttrs).catch(() => {})
    updatedCount++
  }

  // 2. 获取文档全量块结构
  const allBlocks = await fetchDocumentBlockTree(rootDocId, getChildBlocksFn)
  if (!allBlocks || allBlocks.length === 0) {
    return { updatedCount, matchedBindings }
  }

  // 3. 提取所有水平分割线 (tb 块)
  const dividerBlocks = allBlocks.filter(b => {
    const t = String(b.type || "").toLowerCase()
    const md = String(b.markdown || "").trim()
    const c = String(b.content || "").trim()
    return (
      t === "tb" ||
      t === "thematic-break" ||
      t === "nodethematicbreak" ||
      md === "---" ||
      md === "***" ||
      c === "---" ||
      c === "***"
    )
  })

  // 3. 回填水平分割线页面属性与提词备注 (自适应开头有/无前导分割线)
  if (dividerBlocks.length >= presentation.slides.length) {
    // 1:1 严格对齐：开头有分割线，第 i 条分割线对应第 i 页 (从第 1 页开始)
    for (let i = 0; i < presentation.slides.length; i++) {
      const slide = presentation.slides[i]
      const tbBlock = dividerBlocks[i]
      if (tbBlock && tbBlock.id) {
        const pageAttrs = { ...slide.pageAttrs }
        if (slide.notes) {
          pageAttrs[ATTR_PAGE_NOTES] = slide.notes
        }
        if (Object.keys(pageAttrs).length > 0) {
          await setAttrsFn(tbBlock.id, pageAttrs).catch(() => {})
          updatedCount++
        }
      }
    }
  } else {
    // 降级容错：开头无分割线，第 1 页属性保存在根节点，第 1 条分割线对应第 2 页
    for (let i = 1; i < presentation.slides.length; i++) {
      const slide = presentation.slides[i]
      const tbBlock = dividerBlocks[i - 1]
      if (tbBlock && tbBlock.id) {
        const pageAttrs = { ...slide.pageAttrs }
        if (slide.notes) {
          pageAttrs[ATTR_PAGE_NOTES] = slide.notes
        }
        if (Object.keys(pageAttrs).length > 0) {
          await setAttrsFn(tbBlock.id, pageAttrs).catch(() => {})
          updatedCount++
        }
      }
    }
  }

  // 4. 回填元素级属性 (v-click, motion, shiki-lines, slot, author 等)
  const elementBindings = presentation.blockAttrBindings.filter(b => !b.isPageLevel)
  if (elementBindings.length > 0) {
    const usedBlockIds = new Set<string>()

    for (const binding of elementBindings) {
      const targetBlock = allBlocks.find(b => {
        if (usedBlockIds.has(b.id)) return false
        const bType = String(b.type || "").toLowerCase()
        const bContent = String(b.content || b.markdown || "").trim()

        let typeMatch = false
        if (binding.blockType === "i" && (bType === "i" || bType === "p" || bType === "l")) typeMatch = true
        else if (binding.blockType === "c" && (bType === "c" || bType === "code-block")) typeMatch = true
        else if (binding.blockType === "h" && (bType === "h" || bType === "heading")) typeMatch = true
        else if (binding.blockType === "b" && (bType === "b" || bType === "blockquote")) typeMatch = true
        else if (binding.blockType === bType || bType === "p") typeMatch = true

        if (!typeMatch) return false

        if (binding.contentPreview) {
          const cleanSnippet = binding.contentPreview.slice(0, 15)
          if (bContent.includes(cleanSnippet)) return true
        }

        return false
      })

      if (targetBlock && targetBlock.id) {
        usedBlockIds.add(targetBlock.id)
        await setAttrsFn(targetBlock.id, binding.attrs).catch(() => {})
        updatedCount++
        matchedBindings++
      }
    }
  }

  return { updatedCount, matchedBindings }
}
