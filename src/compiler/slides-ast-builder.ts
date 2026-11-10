import type {
  ISiYuanBlockNode,
  ISlidesBlockItem,
  ISlidesDocument,
  ISlidesMotionConfig,
  ISlidesVirtualPage,
} from "../types/slides-protocol"
import {
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_SLOT,
  ATTR_PAGE_LAYOUT_RATIO,
  isColsHeaderLayout,
} from "../types/slides-protocol"
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
import {
  cleanCardListItemMarkdown,
  detectSuperBlockImageLayout,
  extractImageUrl,
  isListItemNode,
  isSuperBlock,
} from "./superblock-scanner"
import { cleanAndTransformInlineKramdown } from "./html-cleaner"

import {
  stringifyFrontmatter,
  injectShikiSpotlight,
  wrapVClickDirective,
  getMotionDirectives,
  wrapElementDirectives,
  extractCleanNoteText,
  getBlockHeadingLevel,
  distributeThreeColumns,
  distributeNColumns,
} from "./directive-wrapper"

export {
  stringifyFrontmatter,
  injectShikiSpotlight,
  wrapVClickDirective,
  getMotionDirectives,
  wrapElementDirectives,
  extractCleanNoteText,
  getBlockHeadingLevel,
  distributeThreeColumns,
  distributeNColumns,
}
export type { IThreeColsDistribution } from "./directive-wrapper"

interface IHeadingScope {
  level: number
  slot?: string
  clicks?: string
  motion?: ISlidesMotionConfig
  customAttrs?: Record<string, string>
}

export interface IBuildSlidesDocOptions extends IAssetRewriteOptions {
  refContentMap?: Record<string, string>
}


/**
 * 构建完整的 Slidev 虚拟文档与 Markdown 载荷
 */
export function buildSlidesDocument(
  docId: string,
  docAttrs: Record<string, string> | null | undefined,
  blocks: ISiYuanBlockNode[],
  options?: IBuildSlidesDocOptions,
): ISlidesDocument {
  const config = parseDocumentConfig(docAttrs)
  const slides: ISlidesVirtualPage[] = []

  // 1. 初始化第一页（封面页或默认页）
  const initialPageAttrs = parsePageAttrs(docAttrs)
  let currentPage: ISlidesVirtualPage = {
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
    const processBlockNode = (
      itemNode: ISiYuanBlockNode,
      inheritedContext?: {
        parentClicks?: string
        parentContainerId?: string
        defaultSlot?: string
        isParentListUnpacked?: boolean
        listContext?: {
          isOrdered?: boolean
          itemIndex?: number
        }
      },
    ) => {
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

      // 清洗并保真转换思源笔记行内 Kramdown Span IAL（如 </span>{: style="..."} 或 **加粗**{: style="..."}）
      if (itemNode.type !== "c" && !rawMd.startsWith("```")) {
        rawMd = cleanAndTransformInlineKramdown(rawMd)
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

      // 若当前容器节点自身未设置视频属性，仅递归检索子节点中的视频块属性并向上合并 (避免污染 clicks/motion)
      if (itemNode.children && itemNode.children.length > 0) {
        const videoAttrKeys = [
          "custom-slides-autoplay",
          "custom-slides-loop",
          "custom-slides-muted",
          "custom-slides-controls",
        ]
        const collectAttrsFromTree = (nodes: ISiYuanBlockNode[]) => {
          for (const n of nodes) {
            if (n.ial) {
              for (const [k, v] of Object.entries(n.ial)) {
                if (videoAttrKeys.includes(k) && !combinedIal[k]) {
                  combinedIal[k] = v
                }
              }
            }
            if (n.children && n.children.length > 0) {
              collectAttrsFromTree(n.children)
            }
          }
        }
        collectAttrsFromTree(itemNode.children)
      }

      const isVideoBlock = itemNode.type === "video" || itemNode.type === "NodeVideo" || /<video\b/i.test(rawMd)

      // 视频块属性同步与增强 (autoplay, loop, muted, controls)
      if (isVideoBlock) {
        const isAutoplay = combinedIal["custom-slides-autoplay"] === "true"
        const isLoop = combinedIal["custom-slides-loop"] === "true"
        const isMuted = combinedIal["custom-slides-muted"] === "true" || isAutoplay
        const hideControls = combinedIal["custom-slides-controls"] === "false"

        rawMd = rawMd.replace(/<video\b([^>]*)>/gi, (_, existingAttrs) => {
          let attrs = existingAttrs
          if (hideControls) {
            attrs = attrs.replace(/\bcontrols(?:="[^"]*")?/gi, "").trim()
          } else if (!/controls/i.test(attrs)) {
            attrs += " controls"
          }
          if (isAutoplay && !/autoplay/i.test(attrs)) {
            attrs += " autoplay playsinline"
          } else if (!isAutoplay && combinedIal["custom-slides-autoplay"] === "false") {
            attrs = attrs.replace(/\bautoplay\b/gi, "").replace(/\bplaysinline\b/gi, "").trim()
          }
          if (isLoop && !/loop/i.test(attrs)) {
            attrs += " loop"
          } else if (!isLoop && combinedIal["custom-slides-loop"] === "false") {
            attrs = attrs.replace(/\bloop\b/gi, "").trim()
          }
          if (isMuted && !/muted/i.test(attrs)) {
            attrs += " muted"
          } else if (!isMuted && combinedIal["custom-slides-muted"] === "false") {
            attrs = attrs.replace(/\bmuted\b/gi, "").trim()
          }
          return `<video ${attrs.trim()}>`
        })
      }

      // 页面背景图块处理 (custom-slides-role="background" 或 custom-slides-background="true")
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
        if (!currentPage.frontmatter.layoutRatio && sbLayout.ratio) {
          currentPage.frontmatter.layoutRatio = sbLayout.ratio
        }

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
          if (!currentPage.frontmatter.layoutRatio && itemNode.ial?.[ATTR_PAGE_LAYOUT_RATIO]) {
            currentPage.frontmatter.layoutRatio = itemNode.ial[ATTR_PAGE_LAYOUT_RATIO]
          }
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

      const isColContext = Boolean(
        elemAttrs.slot ||
        inheritedContext?.defaultSlot ||
        currentPage.frontmatter.layout === "clover" ||
        isColsHeaderLayout(currentPage.frontmatter.layout) ||
        currentPage.frontmatter.layout === "two-cols"
      )

      // 展开带有分栏插槽或显式拆分的列表容器子项 (NodeList 'l')
      if (
        (itemNode.type === "l" || itemNode.type === "NodeList" || itemNode.type === "list") &&
        itemNode.children &&
        itemNode.children.length > 0 &&
        (
          itemNode.children.some(c => c.ial?.[ATTR_ELEM_SLOT] || c.ial?.[ATTR_ELEM_CLICK]) ||
          elemAttrs.slot ||
          elemAttrs.clicks ||
          isColContext
        )
      ) {
        const isOrderedList = /^\s*\d+\.\s+/m.test(itemNode.markdown || "") || itemNode.subType === "o" || (itemNode as any).subtype === "o"
        for (let idx = 0; idx < itemNode.children.length; idx++) {
          const childNode = itemNode.children[idx]
          if (elemAttrs.slot && (!childNode.ial || !childNode.ial[ATTR_ELEM_SLOT])) {
            if (!childNode.ial) childNode.ial = {}
            childNode.ial[ATTR_ELEM_SLOT] = elemAttrs.slot
          }
          processBlockNode(childNode, {
            ...inheritedContext,
            parentClicks: elemAttrs.clicks || inheritedContext?.parentClicks,
            defaultSlot: elemAttrs.slot || inheritedContext?.defaultSlot,
            isParentListUnpacked: true,
            listContext: {
              isOrdered: isOrderedList,
              itemIndex: idx + 1,
            },
          })
        }
        return
      }

      const isParentListUnpacked = Boolean(inheritedContext?.isParentListUnpacked)
      const shouldUnpackListItem =
        Boolean(itemNode.children && itemNode.children.length >= 2) ||
        Boolean(elemAttrs.clicks) ||
        Boolean(itemNode.children?.some(c => c.ial?.[ATTR_ELEM_CLICK])) ||
        isParentListUnpacked ||
        (!itemNode.markdown && Boolean(itemNode.children && itemNode.children.length > 0))

      if (
        isListItemNode(itemNode) &&
        itemNode.children &&
        itemNode.children.length > 0 &&
        (isColContext || isParentListUnpacked || Boolean(elemAttrs.clicks) || Boolean(itemNode.children.some(c => c.ial?.[ATTR_ELEM_CLICK]))) &&
        shouldUnpackListItem
      ) {
        // 查找首个有内容的有效子块（代表主容器自身的主文本）
        const hasMultipleChildren = Boolean(itemNode.children && itemNode.children.length >= 2)
        const firstValidChild = itemNode.children.find(c => Boolean((c.markdown || c.content || "").trim())) || itemNode.children[0]
        const firstChildClicks = firstValidChild?.ial?.[ATTR_ELEM_CLICK] || firstValidChild?.ial?.["custom-slides-click"]

        // 确定容器 clicks：
        // 1. 若列表项自身配置了 clicks，以自身为准；
        // 2. 若列表项自身未配置，但包含多个子块（首行文本+子组件）且首行文本配置了 clicks，提升为容器 clicks；
        // 3. 否则继承外部 parentClicks
        const shouldLiftFirstChild = Boolean(!elemAttrs.clicks && hasMultipleChildren && firstChildClicks)
        const containerClicks = elemAttrs.clicks || (shouldLiftFirstChild ? firstChildClicks : undefined) || inheritedContext?.parentClicks
        const containerId = itemNode.id || inheritedContext?.parentContainerId
        const targetSlot = elemAttrs.slot || inheritedContext?.defaultSlot

        let isFirstValidChild = true
        for (const childNode of itemNode.children) {
          if (targetSlot && (!childNode.ial || !childNode.ial[ATTR_ELEM_SLOT])) {
            if (!childNode.ial) childNode.ial = {}
            childNode.ial[ATTR_ELEM_SLOT] = targetSlot
          }

          const hasContent = Boolean((childNode.markdown || childNode.content || "").trim())
          const isThisFirstValid = isFirstValidChild && hasContent

          if (isThisFirstValid) {
            if (isColContext) {
              // 仅在分栏卡片布局下，列表项作为卡片，首行标题才清洗列表前缀
              if (childNode.markdown) {
                childNode.markdown = cleanCardListItemMarkdown(childNode.markdown)
              }
              if (childNode.content) {
                childNode.content = cleanCardListItemMarkdown(childNode.content)
              }
            } else {
              // 在常规正文列表（单栏）逐步呈现动效下，列表项必须完整保留或补齐标准的列表前缀符号！
              const isOrdered = Boolean(inheritedContext?.listContext?.isOrdered)
              const itemIdx = inheritedContext?.listContext?.itemIndex || 1
              const prefix = isOrdered ? `${itemIdx}. ` : "- "

              const ensureListPrefix = (text?: string): string => {
                if (!text) return prefix.trim()
                const trimmed = text.trim()
                if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
                  return text
                }
                return `${prefix}${text}`
              }

              if (childNode.markdown) {
                childNode.markdown = ensureListPrefix(childNode.markdown)
              }
              if (childNode.content) {
                childNode.content = ensureListPrefix(childNode.content)
              }
            }
            isFirstValidChild = false
          }

          // 首行有效子块代表主容器自身的主文本，归入基础层：
          // 当容器存在 clicks（无论是自身配置还是多子块下由首行提升）且存在多个子块时，
          // 首行子块清除自身独立 clicks，仅作为基础层继承 parentClicks: containerClicks，
          // 绝不保留自身独立的 clicks，避免首行文本被调度引擎顺延至第二步，
          // 从而保证首行文本与同容器内未显式配置 clicks 的子组件（如图片）严格在同一个 step 同时呈现！
          let childToProcess = childNode
          if (isThisFirstValid && containerClicks && hasMultipleChildren) {
            childToProcess = {
              ...childNode,
              ial: { ...(childNode.ial || {}) },
            }
            delete childToProcess.ial[ATTR_ELEM_CLICK]
            delete childToProcess.ial["custom-slides-click"]
          } else if (!hasMultipleChildren && containerClicks) {
            childToProcess = {
              ...childNode,
              ial: { ...(childNode.ial || {}), [ATTR_ELEM_CLICK]: containerClicks },
            }
          }

          processBlockNode(childToProcess, {
            parentClicks: containerClicks,
            parentContainerId: containerId,
            defaultSlot: targetSlot,
          })
        }
        return
      }

      // 讲稿备注块处理 (custom-slides-note / slidev-note)
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
      let effectiveMotion: ISlidesMotionConfig | undefined = elemAttrs.motion
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
        if (!effectiveClicks && parentScope?.clicks && !inheritedContext?.parentContainerId) {
          effectiveClicks = parentScope.clicks
        }
        if (!effectiveMotion && parentScope?.motion) {
          effectiveMotion = parentScope.motion
        }

        // 合并自定义扩展属性 (custom-slides-*)
        const headingCustomAttrs: Record<string, string> = {
          ...(parentScope?.customAttrs || {}),
        }
        if (itemNode.ial) {
          for (const [k, v] of Object.entries(itemNode.ial)) {
            if (k.startsWith("custom-slides-") && !k.startsWith("custom-slides-slide")) {
              headingCustomAttrs[k] = v
            }
          }
        }

        // 仅全局大纲标题压入作用域栈；分栏容器内部子标题不污染全局大纲栈
        if (!inheritedContext?.parentContainerId) {
          headingStack.push({
            level: headingLevel,
            slot: effectiveSlot,
            clicks: effectiveClicks,
            motion: effectiveMotion,
            customAttrs: headingCustomAttrs,
          })
        }
      } else {
        // 普通非标题内容块：若自身未显式指定，自动继承最近标题行的属性
        const currentScope = headingStack.length > 0 ? headingStack[headingStack.length - 1] : undefined
        if (currentScope) {
          if (!effectiveSlot && currentScope.slot && currentScope.slot !== "header") {
            effectiveSlot = currentScope.slot
          }
          if (!effectiveClicks && currentScope.clicks && !inheritedContext?.parentContainerId) {
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

      if (!effectiveSlot && inheritedContext?.defaultSlot) {
        effectiveSlot = inheritedContext.defaultSlot
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

      if (isVideoBlock || combinedIal["custom-slides-autoplay"] || combinedIal["custom-slides-muted"]) {
        if (combinedIal["custom-slides-autoplay"]) {
          effectiveAttrs["custom-slides-autoplay"] = combinedIal["custom-slides-autoplay"]
          if (combinedIal["custom-slides-autoplay"] === "true" && !combinedIal["custom-slides-muted"]) {
            effectiveAttrs["custom-slides-muted"] = "true"
          }
        }
        if (combinedIal["custom-slides-loop"]) effectiveAttrs["custom-slides-loop"] = combinedIal["custom-slides-loop"]
        if (combinedIal["custom-slides-muted"]) effectiveAttrs["custom-slides-muted"] = combinedIal["custom-slides-muted"]
        if (combinedIal["custom-slides-controls"]) effectiveAttrs["custom-slides-controls"] = combinedIal["custom-slides-controls"]
      }

      const normMaxHeight = elemAttrs.maxHeight
        ? (/^\d+$/.test(elemAttrs.maxHeight.trim()) ? `${elemAttrs.maxHeight.trim()}px` : elemAttrs.maxHeight.trim())
        : undefined

      const blockItem: ISlidesBlockItem = {
        id: itemNode.id,
        type: itemNode.type,
        content: itemNode.content || "",
        rawMarkdown: rawMd,
        clicks: effectiveClicks,
        parentClicks: inheritedContext?.parentClicks,
        parentContainerId: inheritedContext?.parentContainerId,
        motion: effectiveMotion,
        shikiLines: elemAttrs.shikiLines,
        maxHeight: normMaxHeight,
        slot: effectiveSlot,
        attributes: effectiveAttrs,
        attrs: effectiveAttrs,
        rawNode: itemNode,
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

    // 组织多栏插槽或常规内容（排除纯分界占位块与纯空白段落）
    const contentBlocks = page.blocks.filter(b => b.slot !== "slot-divider-right")
    const renderBlocks = (list: ISlidesBlockItem[]) =>
      list
        .filter(b => Boolean((b.rawMarkdown || b.content || "").trim()))
        .map(b => wrapElementDirectives(b.rawMarkdown, b.clicks, b.motion, b.attributes?.style, b.maxHeight))
        .join("\n\n")

    const cleanFirstListBlock = (list: ISlidesBlockItem[]) => {
      const valid = list.filter(b => Boolean((b.rawMarkdown || b.content || "").trim()))
      if (valid.length === 0) return
      const first = valid[0]
      const md = (first.rawMarkdown || first.content || "").trim()
      const isList = isListItemNode(first) || /^(?:[-*+]|\d+\.)\s+/.test(md)
      if (isList) {
        first.rawMarkdown = cleanCardListItemMarkdown(first.rawMarkdown || first.content || "")
        first.content = first.rawMarkdown
      }
    }

    const renderColList = (colList: ISlidesBlockItem[]) => {
      if (colList.length === 0) return ""
      cleanFirstListBlock(colList)

      const parentClicks = colList.find(b => b.parentClicks)?.parentClicks

      if (!parentClicks) {
        return colList
          .filter(b => Boolean((b.rawMarkdown || b.content || "").trim()))
          .map(b => wrapElementDirectives(b.rawMarkdown, b.clicks, b.motion, b.attributes?.style, b.maxHeight))
          .join("\n\n")
      }

      const resultParts: string[] = []
      let baseGroup: ISlidesBlockItem[] = []

      const flushBaseGroup = () => {
        if (baseGroup.length === 0) return
        const combinedMd = baseGroup
          .map(b => (b.rawMarkdown || b.content || "").trim())
          .filter(Boolean)
          .join("\n\n")
        if (combinedMd) {
          resultParts.push(wrapVClickDirective(combinedMd, parentClicks))
        }
        baseGroup = []
      }

      for (const b of colList) {
        const md = (b.rawMarkdown || b.content || "").trim()
        if (!md) continue

        const hasSelfClicks = Boolean(b.clicks && b.clicks.trim() !== "")
        if (!hasSelfClicks) {
          baseGroup.push(b)
        } else {
          flushBaseGroup()
          resultParts.push(wrapElementDirectives(b.rawMarkdown, b.clicks, b.motion, b.attributes?.style, b.maxHeight))
        }
      }

      flushBaseGroup()
      return resultParts.join("\n\n")
    }

    const layout = page.frontmatter.layout || "default"

    if (layout === "clover" || isColsHeaderLayout(layout)) {
      let headerList: ISlidesBlockItem[] = []
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

      // 确定栏数 targetCols (自适应 2~N 栏，四叶草固定为 4 象限)
      let targetCols = 2
      if (layout === "clover") {
        targetCols = 4
      } else if (layout === "three-cols-header") {
        targetCols = 3
      } else if (layout === "two-cols-header") {
        targetCols = 2
      } else {
        let maxColSlot = 0
        for (const b of rem) {
          const m = (b.slot || "").match(/^col-(\d+)$/i)
          if (m) {
            maxColSlot = Math.max(maxColSlot, parseInt(m[1], 10))
          }
        }
        if (maxColSlot >= 2) {
          targetCols = maxColSlot
        } else if (page.frontmatter.layoutRatio) {
          const r = page.frontmatter.layoutRatio.trim()
          if (r.includes(":")) {
            const parts = r.split(":").map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0)
            if (parts.length >= 2) targetCols = parts.length
          } else {
            const tokens = r.split(/\s+/).filter(Boolean)
            if (tokens.length >= 2) targetCols = tokens.length
          }
        } else if (rem.length === 1 && rem[0].children && rem[0].children.length >= 2) {
          targetCols = Math.min(6, rem[0].children.length)
        }
      }

      const cols = distributeNColumns(rem, targetCols)

      // 为虚拟 AST 模型上的块补全 slot，确保 Web 沙箱接收到 slides 时 slot 与渲染对齐
      cols.forEach((colList, colIdx) => {
        const slotName = `col-${colIdx + 1}`
        for (const b of colList) {
          if (!b.slot || b.slot === "default") {
            b.slot = slotName
          }
        }
        cleanFirstListBlock(colList)
      })

      // 若 rem 原本只有 1 个单块且被成功解构为多块，更新 page.blocks
      const decompressedBlocks = cols.flat()
      if (rem.length === 1 && decompressedBlocks.length > 1) {
        const origIdx = page.blocks.findIndex(b => b.id === rem[0].id)
        if (origIdx !== -1) {
          page.blocks.splice(origIdx, 1, ...decompressedBlocks)
        }
      }

      const headerContent = renderBlocks(headerList)
      if (headerContent) parts.push(headerContent)

      // 如果是旧版的 two-cols-header 且只有 2 栏，输出 ::left:: 与 ::right:: 保证 Slidev CLI 官方 theme 原生兼容；
      // 否则输出通用的 ::col-1::, ::col-2::, ..., ::col-N::
      if (layout === "two-cols-header" && targetCols === 2) {
        const leftContent = renderColList(cols[0] || [])
        const rightContent = renderColList(cols[1] || [])
        if (leftContent) parts.push(`::left::\n\n${leftContent}`)
        if (rightContent) parts.push(`::right::\n\n${rightContent}`)
      } else {
        cols.forEach((colList, colIdx) => {
          const colContent = renderColList(colList)
          if (colContent) {
            parts.push(`::col-${colIdx + 1}::\n\n${colContent}`)
          }
        })
      }
    } else if (layout === "two-cols") {
      const leftBlocks = contentBlocks.filter(b => b.slot === "left")
      const rightBlocks = contentBlocks.filter(b => b.slot === "right")
      cleanFirstListBlock(leftBlocks)
      cleanFirstListBlock(rightBlocks)
      const leftContent = renderBlocks(leftBlocks.length > 0 ? leftBlocks : contentBlocks.filter(b => b.slot !== "right"))
      const rightContent = renderBlocks(rightBlocks)

      parts.push(leftContent)
      if (rightContent) {
        parts.push(`::right::\n\n${rightContent}`)
      }
    } else {
      // 常规单栏布局
      for (const block of contentBlocks) {
        parts.push(wrapElementDirectives(block.rawMarkdown, block.clicks || block.parentClicks, block.motion, block.attributes?.style, block.maxHeight))
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
