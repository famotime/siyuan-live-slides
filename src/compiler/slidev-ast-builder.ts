import type {
  ISiYuanBlockNode,
  ISlidevBlockItem,
  ISlidevDocument,
  ISlidevMotionConfig,
  ISlidevVirtualPage,
} from "../types/slidev-protocol"
import {
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_SLOT,
} from "../types/slidev-protocol"
import type { IAssetRewriteOptions } from "./assets-rewriter"
import { extractBlockMarkdown, parseKramdownIAL } from "./ast-crawler"
import { rewriteAssetPaths, rewriteSingleAssetUrl } from "./assets-rewriter"
import { resolveBlockRefsSync } from "./block-ref-resolver"
import {
  isPageBreak,
  parseDocumentConfig,
  parseElementAttrs,
  parsePageAttrs,
} from "./scope-mapper"
import { detectSuperBlockImageLayout, extractImageUrl, isSuperBlock } from "./superblock-scanner"

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
export function getMotionDirectives(motion?: ISlidevMotionConfig): {
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
 * 包装带有 v-click 与 custom-slidev-motion 的块
 */
export function wrapElementDirectives(
  markdown: string,
  clicks?: string,
  motion?: ISlidevMotionConfig,
): string {
  const hasClicks = clicks !== undefined && clicks !== null && clicks.trim() !== ""
  const motionConfig = getMotionDirectives(motion)

  if (!hasClicks && !motionConfig) {
    return markdown
  }

  if (hasClicks && !motionConfig) {
    return wrapVClickDirective(markdown, clicks)
  }

  // 序列化 motion 对象的 initial 与 enter
  const initialStr = JSON.stringify(motionConfig!.initial).replace(/"/g, "'")
  const enterStr = JSON.stringify(motionConfig!.enter).replace(/"/g, "'")
  const motionAttrs = `v-motion :initial="${initialStr}" :enter="${enterStr}"`

  if (!hasClicks) {
    return `<div ${motionAttrs}>\n\n${markdown}\n\n</div>`
  }

  // 同时具备 clicks 与 motion：生成复合容器
  const trimmedClicks = clicks!.trim()
  let clickAttr = "v-click"
  if (trimmedClicks === "hide") {
    clickAttr = "v-click.hide"
  } else if (trimmedClicks !== "" && trimmedClicks !== "+1") {
    clickAttr = `v-click="${trimmedClicks}"`
  }

  return `<div ${clickAttr} ${motionAttrs}>\n\n${markdown}\n\n</div>`
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

interface IHeadingScope {
  level: number
  slot?: string
  clicks?: string
  motion?: ISlidevMotionConfig
  customAttrs?: Record<string, string>
}

export interface IBuildSlidevDocOptions extends IAssetRewriteOptions {
  refContentMap?: Record<string, string>
}

/**
 * 构建完整的 Slidev 虚拟文档与 Markdown 载荷
 */
export function buildSlidevDocument(
  docId: string,
  docAttrs: Record<string, string> | null | undefined,
  blocks: ISiYuanBlockNode[],
  options?: IBuildSlidevDocOptions,
): ISlidevDocument {
  const config = parseDocumentConfig(docAttrs)
  const slides: ISlidevVirtualPage[] = []

  // 1. 初始化第一页（封面页或默认页）
  const initialPageAttrs = parsePageAttrs(docAttrs)
  let currentPage: ISlidevVirtualPage = {
    pageIndex: 1,
    startBlockId: docId,
    frontmatter: {
      layout: initialPageAttrs.frontmatter.layout || "cover",
      ...initialPageAttrs.frontmatter,
    },
    notes: "",
    noteBlocks: [],
    blocks: [],
    rawMarkdown: "",
    allBlockIds: [docId],
  }
  if (currentPage.frontmatter.background) {
    currentPage.frontmatter.background = rewriteSingleAssetUrl(
      currentPage.frontmatter.background,
      options,
    )
  }
  if (currentPage.frontmatter.image) {
    currentPage.frontmatter.image = rewriteSingleAssetUrl(
      currentPage.frontmatter.image,
      options,
    )
  }
  slides.push(currentPage)

  // 2. 遍历所有块节点进行三层作用域归类
  let headingStack: IHeadingScope[] = []

  for (const node of blocks) {
    if (isPageBreak(node)) {
      // 开启新页时重置标题层级栈
      headingStack = []
      const pageMeta = parsePageAttrs(node.ial)

      // 如果当前是第一页且尚未添加任何正文内容块，说明用户在文档开头放置了分割线来显式定义第一页配置
      if (slides.length === 1 && currentPage.blocks.length === 0) {
        currentPage.startBlockId = node.id
        if (!currentPage.allBlockIds) currentPage.allBlockIds = []
        if (!currentPage.allBlockIds.includes(node.id)) currentPage.allBlockIds.push(node.id)
        if (pageMeta.frontmatter.layout) {
          currentPage.frontmatter.layout = pageMeta.frontmatter.layout
        }
        Object.assign(currentPage.frontmatter, pageMeta.frontmatter)
        // 防御：若分割线未单独声明 image/background，继承文档级头部配置
        if (!pageMeta.frontmatter.image && initialPageAttrs.frontmatter.image) {
          currentPage.frontmatter.image = initialPageAttrs.frontmatter.image
        }
        if (!pageMeta.frontmatter.background && initialPageAttrs.frontmatter.background) {
          currentPage.frontmatter.background = initialPageAttrs.frontmatter.background
        }
        if (currentPage.frontmatter.background) {
          currentPage.frontmatter.background = rewriteSingleAssetUrl(
            currentPage.frontmatter.background,
            options,
          )
        }
        if (currentPage.frontmatter.image) {
          currentPage.frontmatter.image = rewriteSingleAssetUrl(
            currentPage.frontmatter.image,
            options,
          )
        }
        continue
      }

      // 遇到后续水平分割线或显式切页标记，开启新幻灯片
      currentPage = {
        pageIndex: slides.length + 1,
        startBlockId: node.id,
        frontmatter: {
          layout: pageMeta.frontmatter.layout || "default",
          ...pageMeta.frontmatter,
        },
        notes: "",
        noteBlocks: [],
        blocks: [],
        rawMarkdown: "",
        allBlockIds: [node.id],
      }

      // 如果背景路径是本地 assets，予以重写
      if (currentPage.frontmatter.background) {
        currentPage.frontmatter.background = rewriteSingleAssetUrl(
          currentPage.frontmatter.background,
          options,
        )
      }
      if (currentPage.frontmatter.image) {
        currentPage.frontmatter.image = rewriteSingleAssetUrl(
          currentPage.frontmatter.image,
          options,
        )
      }

      slides.push(currentPage)
      continue
    }

    // 普通内容块处理逻辑（支持递归处理超级块子内容）
    const processBlockNode = (itemNode: ISiYuanBlockNode) => {
      if (!currentPage.allBlockIds) {
        currentPage.allBlockIds = []
      }
      if (itemNode.id && !currentPage.allBlockIds.includes(itemNode.id)) {
        currentPage.allBlockIds.push(itemNode.id)
      }
      if (itemNode.children && itemNode.children.length > 0) {
        const collectIds = (children: ISiYuanBlockNode[]) => {
          for (const c of children) {
            if (c.id && !currentPage.allBlockIds!.includes(c.id)) {
              currentPage.allBlockIds!.push(c.id)
            }
            if (c.children && c.children.length > 0) {
              collectIds(c.children)
            }
          }
        }
        collectIds(itemNode.children)
      }

      let rawMd = extractBlockMarkdown(itemNode)

      // 解析并剥离 Kramdown 尾部 IAL 属性标记 {: ... }
      let combinedIal = itemNode.ial ? { ...itemNode.ial } : {}
      const inlineIalMatch = rawMd.match(/\{:\s*([^}]+)\s*\}\s*$/)
      if (inlineIalMatch) {
        const parsedInline = parseKramdownIAL(inlineIalMatch[0])
        combinedIal = { ...parsedInline, ...combinedIal }
        rawMd = rawMd.slice(0, inlineIalMatch.index).trim()
      }

      // 容错剥离单独成块的思源超级块标记行 ({{{row, {{{col 或 }}})
      let cleanRaw = rawMd.trim()
      if (/^\{\{\{(?:row|col)?\s*$/i.test(cleanRaw) || cleanRaw === "}}}") {
        return
      }
      if (/^\{\{\{(?:row|col)?\s*\r?\n/i.test(cleanRaw) && /\r?\n\}\}\}$/.test(cleanRaw)) {
        rawMd = cleanRaw.replace(/^\{\{\{(?:row|col)?\s*\r?\n/i, "").replace(/\r?\n\}\}\}$/, "").trim()
        cleanRaw = rawMd.trim()
      }

      const elemAttrs = parseElementAttrs(combinedIal)

      // 重写本地资源路径
      rawMd = rewriteAssetPaths(rawMd, options)

      // 动态展开思源块引用 ((block-id))
      rawMd = resolveBlockRefsSync(rawMd, options?.refContentMap)

      // 页面背景图块处理 (custom-slidev-role="background" 或 custom-slidev-background="true")
      if (elemAttrs.isBackground) {
        const imgUrl = extractImageUrl(rawMd, itemNode.content)
        if (imgUrl) {
          currentPage.frontmatter.background = rewriteSingleAssetUrl(imgUrl, options)
          // 背景图不在正文内容流中渲染
          return
        }
      }

      // 检查超级块图文分栏 (layout: image-left / image-right)
      const sbLayout = detectSuperBlockImageLayout(itemNode)
      if (sbLayout) {
        currentPage.frontmatter.layout = sbLayout.layout
        currentPage.frontmatter.image = rewriteSingleAssetUrl(sbLayout.imageUrl, options)

        // 将超级块内的非图片内容子块平铺为幻灯片普通内容块
        for (const childNode of sbLayout.contentNodes) {
          processBlockNode(childNode)
        }
        return
      }

      // 独立标记了图左/图右的图片块处理
      if (elemAttrs.imageLayout === "image-left" || elemAttrs.imageLayout === "image-right") {
        const imgUrl = extractImageUrl(rawMd, itemNode.content)
        if (imgUrl) {
          currentPage.frontmatter.layout = elemAttrs.imageLayout
          currentPage.frontmatter.image = rewriteSingleAssetUrl(imgUrl, options)
          // 幻灯片内容流中排除该配图
          return
        }
      }

      // 常规未匹配图文版式的超级块：展开其子内容 (兼容思源官方缩写 's'、'sb' 与 'NodeSuperBlock')
      if (
        isSuperBlock(itemNode) &&
        itemNode.children &&
        itemNode.children.length > 0
      ) {
        for (const childNode of itemNode.children) {
          processBlockNode(childNode)
        }
        return
      }

      // 讲稿备注块处理 (custom-slidev-note / slidev-note)
      if (elemAttrs.isNote) {
        const cleanNote = extractCleanNoteText(rawMd)
        if (cleanNote) {
          if (currentPage.notes) {
            currentPage.notes += "\n\n" + cleanNote
          } else {
            currentPage.notes = cleanNote
          }
        }
        if (!currentPage.noteBlocks) {
          currentPage.noteBlocks = []
        }
        currentPage.noteBlocks.push({
          id: itemNode.id,
          type: itemNode.type,
          content: cleanNote || itemNode.content || "",
          rawMarkdown: rawMd,
          isNote: true,
          attributes: itemNode.ial,
        })
        // 讲稿备注块不在幻灯片内容中渲染
        return
      }

      // 注入 Shiki 代码高亮行号
      if (elemAttrs.shikiLines) {
        rawMd = injectShikiSpotlight(rawMd, elemAttrs.shikiLines)
      }

      // 检查是否为双栏插槽分界标记块: ::right::
      cleanRaw = rawMd.trim()
      const cleanContent = (itemNode.content || "").trim()
      const isSlotDivider =
        cleanRaw === "::right::" ||
        cleanContent === "::right::" ||
        /^<p>\s*::right::\s*<\/p>$/i.test(cleanRaw) ||
        cleanRaw.startsWith("::right::")
      if (isSlotDivider) {
        currentPage.blocks.push({
          id: itemNode.id,
          type: itemNode.type,
          content: "::right::",
          rawMarkdown: "::right::",
          slot: "slot-divider-right",
          attributes: itemNode.ial,
        })
        return
      }

      // 判断是否为标题块以维护大纲属性继承作用域栈
      const headingLevel = getBlockHeadingLevel(itemNode)

      let effectiveSlot: string | undefined = elemAttrs.slot
      let effectiveClicks: string | undefined = elemAttrs.clicks
      let effectiveMotion: ISlidevMotionConfig | undefined = elemAttrs.motion
      let effectiveAttrs: Record<string, string> = { ...(itemNode.ial || {}) }

      if (headingLevel !== null) {
        // 遇到同级或更高级标题行时，栈中同级或低级标题退出作用域 (直到遇到另一个同级或高一级标题行)
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= headingLevel) {
          headingStack.pop()
        }

        // 获取当前标题的父级标题作用域 (若有)
        const parentScope = headingStack.length > 0 ? headingStack[headingStack.length - 1] : undefined

        // 未显式指定的属性向父级继承
        if (!effectiveSlot && parentScope?.slot) {
          effectiveSlot = parentScope.slot
        }
        if (!effectiveClicks && parentScope?.clicks) {
          effectiveClicks = parentScope.clicks
        }
        if (!effectiveMotion && parentScope?.motion) {
          effectiveMotion = parentScope.motion
        }

        // 合并自定义扩展属性 (custom-slidev-*)
        const headingCustomAttrs: Record<string, string> = {
          ...(parentScope?.customAttrs || {}),
        }
        if (itemNode.ial) {
          for (const [k, v] of Object.entries(itemNode.ial)) {
            if (k.startsWith("custom-slidev-") && !k.startsWith("custom-slidev-slide")) {
              headingCustomAttrs[k] = v
            }
          }
        }

        // 压入当前标题作用域
        headingStack.push({
          level: headingLevel,
          slot: effectiveSlot,
          clicks: effectiveClicks,
          motion: effectiveMotion,
          customAttrs: headingCustomAttrs,
        })
      } else {
        // 普通非标题内容块：若自身未显式指定，自动继承最近标题行的属性
        const currentScope = headingStack.length > 0 ? headingStack[headingStack.length - 1] : undefined
        if (currentScope) {
          if (!effectiveSlot && currentScope.slot) {
            effectiveSlot = currentScope.slot
          }
          if (!effectiveClicks && currentScope.clicks) {
            effectiveClicks = currentScope.clicks
          }
          if (!effectiveMotion && currentScope.motion) {
            effectiveMotion = currentScope.motion
          }
          // 合并来自标题的扩展属性
          if (currentScope.customAttrs) {
            effectiveAttrs = {
              ...currentScope.customAttrs,
              ...effectiveAttrs,
            }
          }
        }
      }

      // 若当前页前面存在 ::right:: 分界标记且当前块未显式声明 slot，自动归属右栏
      if (!effectiveSlot && currentPage.blocks.some(b => b.slot === "slot-divider-right")) {
        effectiveSlot = "right"
      }

      if (effectiveSlot) {
        effectiveAttrs[ATTR_ELEM_SLOT] = effectiveSlot
      }
      if (effectiveClicks && !effectiveAttrs[ATTR_ELEM_CLICK]) {
        effectiveAttrs[ATTR_ELEM_CLICK] = effectiveClicks
      }
      if (effectiveMotion && !effectiveAttrs[ATTR_ELEM_MOTION]) {
        effectiveAttrs[ATTR_ELEM_MOTION] = JSON.stringify(effectiveMotion)
      }

      const blockItem: ISlidevBlockItem = {
        id: itemNode.id,
        type: itemNode.type,
        content: itemNode.content || "",
        rawMarkdown: rawMd,
        clicks: effectiveClicks,
        motion: effectiveMotion,
        shikiLines: elemAttrs.shikiLines,
        slot: effectiveSlot,
        attributes: effectiveAttrs,
      }

      currentPage.blocks.push(blockItem)
    }

    processBlockNode(node)
  }

  // 3. 为每一页组装 Slidev 规范 Markdown 片段
  for (let i = 0; i < slides.length; i++) {
    const page = slides[i]
    const parts: string[] = []

    // 注入 Frontmatter（第一页额外注入全局 config 配置）
    const fmData = { ...page.frontmatter }
    if (i === 0) {
      fmData.theme = config.theme
      fmData.aspectRatio = config.aspectRatio
      fmData.highlighter = config.highlighter
      fmData.transition = page.frontmatter.transition || config.defaultTransition
    }

    const fmYaml = stringifyFrontmatter(fmData)
    if (fmYaml) {
      parts.push(fmYaml)
    }

    // 组织多栏插槽或常规内容（排除纯分界占位块）
    const contentBlocks = page.blocks.filter(b => b.slot !== "slot-divider-right")
    const renderBlocks = (list: ISlidevBlockItem[]) =>
      list.map(b => wrapElementDirectives(b.rawMarkdown, b.clicks, b.motion)).join("\n\n")

    const layout = page.frontmatter.layout || "default"

    if (layout === "two-cols-header") {
      let headerList: ISlidevBlockItem[] = []
      const explicitHeader = contentBlocks.filter(b => b.slot === "header")
      if (explicitHeader.length > 0) {
        headerList = explicitHeader
      } else if (contentBlocks.length > 0) {
        const candidateH = contentBlocks.find(b => b.type === "h" && (!b.slot || b.slot === "default"))
        if (candidateH) {
          headerList = [candidateH]
        }
      }

      const rem = contentBlocks.filter(b => !headerList.includes(b))
      const rightList = rem.filter(b => b.slot === "right" || b.slot === "col-2")
      const leftList = rem.filter(b => !rightList.includes(b))

      const headerContent = renderBlocks(headerList)
      const leftContent = renderBlocks(leftList)
      const rightContent = renderBlocks(rightList)

      if (headerContent) parts.push(headerContent)
      if (leftContent) parts.push(`::left::\n\n${leftContent}`)
      if (rightContent) parts.push(`::right::\n\n${rightContent}`)
    } else if (layout === "three-cols-header") {
      let headerList: ISlidevBlockItem[] = []
      const explicitHeader = contentBlocks.filter(b => b.slot === "header")
      if (explicitHeader.length > 0) {
        headerList = explicitHeader
      } else if (contentBlocks.length > 0) {
        const candidateH = contentBlocks.find(b => b.type === "h" && (!b.slot || b.slot === "default"))
        if (candidateH) {
          headerList = [candidateH]
        }
      }

      const rem = contentBlocks.filter(b => !headerList.includes(b))
      let col1List: ISlidevBlockItem[] = []
      let col2List: ISlidevBlockItem[] = []
      let col3List: ISlidevBlockItem[] = []

      const hasExplicitCols = rem.some(b => b.slot === "col-1" || b.slot === "col-2" || b.slot === "col-3" || b.slot === "center" || b.slot === "left" || b.slot === "right")
      if (hasExplicitCols) {
        col2List = rem.filter(b => b.slot === "col-2" || b.slot === "center")
        col3List = rem.filter(b => b.slot === "col-3" || b.slot === "right")
        col1List = rem.filter(b => !col2List.includes(b) && !col3List.includes(b))
      } else if (rem.length >= 3) {
        const c1 = Math.ceil(rem.length / 3)
        const c2 = Math.ceil((rem.length - c1) / 2)
        col1List = rem.slice(0, c1)
        col2List = rem.slice(c1, c1 + c2)
        col3List = rem.slice(c1 + c2)
      } else if (rem.length === 2) {
        col1List = [rem[0]]
        col2List = [rem[1]]
        col3List = []
      } else if (rem.length === 1) {
        const lines = (rem[0].rawMarkdown || rem[0].content || "").trim().split(/\r?\n/)
        const itemLines = lines.filter(l => /^[ \t]*[-*+]\s+|^[ \t]*\d+\.\s+/.test(l))
        if (itemLines.length >= 3) {
          const c1 = Math.ceil(itemLines.length / 3)
          const c2 = Math.ceil((itemLines.length - c1) / 2)
          const items1 = itemLines.slice(0, c1).join("\n")
          const items2 = itemLines.slice(c1, c1 + c2).join("\n")
          const items3 = itemLines.slice(c1 + c2).join("\n")
          col1List = [{ ...rem[0], rawMarkdown: items1, content: items1 }]
          col2List = [{ ...rem[0], id: `${rem[0].id}-col2`, rawMarkdown: items2, content: items2 }]
          col3List = [{ ...rem[0], id: `${rem[0].id}-col3`, rawMarkdown: items3, content: items3 }]
        } else {
          col1List = rem
        }
      } else {
        col1List = rem
      }

      const headerContent = renderBlocks(headerList)
      const col1Content = renderBlocks(col1List)
      const col2Content = renderBlocks(col2List)
      const col3Content = renderBlocks(col3List)

      if (headerContent) parts.push(headerContent)
      if (col1Content) parts.push(`::col-1::\n\n${col1Content}`)
      if (col2Content) parts.push(`::col-2::\n\n${col2Content}`)
      if (col3Content) parts.push(`::col-3::\n\n${col3Content}`)
    } else if (layout === "two-cols") {
      const leftBlocks = contentBlocks.filter(b => b.slot === "left")
      const rightBlocks = contentBlocks.filter(b => b.slot === "right")
      const leftContent = renderBlocks(leftBlocks.length > 0 ? leftBlocks : contentBlocks.filter(b => b.slot !== "right"))
      const rightContent = renderBlocks(rightBlocks)

      parts.push(leftContent)
      if (rightContent) {
        parts.push(`::right::\n\n${rightContent}`)
      }
    } else {
      // 常规单栏布局
      for (const block of contentBlocks) {
        parts.push(wrapElementDirectives(block.rawMarkdown, block.clicks, block.motion))
      }
    }

    // 注入演讲者备注 Notes
    if (page.notes) {
      parts.push(`<!--\n${page.notes}\n-->`)
    }

    page.rawMarkdown = parts.join("\n\n").trim()
  }

  // 4. 组装整篇幻灯片的 fullMarkdown
  const fullMarkdown = slides
    .map(s => s.rawMarkdown)
    .filter(Boolean)
    .join("\n\n---\n\n")

  return {
    docId,
    config,
    slides,
    fullMarkdown,
  }
}
