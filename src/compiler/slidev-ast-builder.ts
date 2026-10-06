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
}
export type { IThreeColsDistribution } from "./directive-wrapper"

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

      // 若当前容器节点自身未设置视频属性，递归检索子节点中的视频块属性并向上合并
      if (itemNode.children && itemNode.children.length > 0) {
        const collectAttrsFromTree = (nodes: ISiYuanBlockNode[]) => {
          for (const n of nodes) {
            if (n.ial) {
              for (const [k, v] of Object.entries(n.ial)) {
                if (k.startsWith("custom-slidev-") && !combinedIal[k]) {
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
        const isAutoplay = combinedIal["custom-slidev-autoplay"] === "true"
        const isLoop = combinedIal["custom-slidev-loop"] === "true"
        const isMuted = combinedIal["custom-slidev-muted"] === "true" || isAutoplay
        const hideControls = combinedIal["custom-slidev-controls"] === "false"

        rawMd = rawMd.replace(/<video\b([^>]*)>/gi, (_, existingAttrs) => {
          let attrs = existingAttrs
          if (hideControls) {
            attrs = attrs.replace(/\bcontrols(?:="[^"]*")?/gi, "").trim()
          } else if (!/controls/i.test(attrs)) {
            attrs += " controls"
          }
          if (isAutoplay && !/autoplay/i.test(attrs)) {
            attrs += " autoplay playsinline"
          } else if (!isAutoplay && combinedIal["custom-slidev-autoplay"] === "false") {
            attrs = attrs.replace(/\bautoplay\b/gi, "").replace(/\bplaysinline\b/gi, "").trim()
          }
          if (isLoop && !/loop/i.test(attrs)) {
            attrs += " loop"
          } else if (!isLoop && combinedIal["custom-slidev-loop"] === "false") {
            attrs = attrs.replace(/\bloop\b/gi, "").trim()
          }
          if (isMuted && !/muted/i.test(attrs)) {
            attrs += " muted"
          } else if (!isMuted && combinedIal["custom-slidev-muted"] === "false") {
            attrs = attrs.replace(/\bmuted\b/gi, "").trim()
          }
          return `<video ${attrs.trim()}>`
        })
      }

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

      // 展开带有分栏插槽或显式拆分的列表容器子项 (NodeList 'l')
      if (
        (itemNode.type === "l" || itemNode.type === "NodeList" || itemNode.type === "list") &&
        itemNode.children &&
        itemNode.children.length > 0 &&
        (itemNode.children.some(c => c.ial?.[ATTR_ELEM_SLOT]) || elemAttrs.slot)
      ) {
        for (const childNode of itemNode.children) {
          if (elemAttrs.slot && (!childNode.ial || !childNode.ial[ATTR_ELEM_SLOT])) {
            if (!childNode.ial) childNode.ial = {}
            childNode.ial[ATTR_ELEM_SLOT] = elemAttrs.slot
          }
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
          if (!effectiveSlot && currentScope.slot && currentScope.slot !== "header") {
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

      if (isVideoBlock || combinedIal["custom-slidev-autoplay"] || combinedIal["custom-slidev-muted"]) {
        if (combinedIal["custom-slidev-autoplay"]) {
          effectiveAttrs["custom-slidev-autoplay"] = combinedIal["custom-slidev-autoplay"]
          if (combinedIal["custom-slidev-autoplay"] === "true" && !combinedIal["custom-slidev-muted"]) {
            effectiveAttrs["custom-slidev-muted"] = "true"
          }
        }
        if (combinedIal["custom-slidev-loop"]) effectiveAttrs["custom-slidev-loop"] = combinedIal["custom-slidev-loop"]
        if (combinedIal["custom-slidev-muted"]) effectiveAttrs["custom-slidev-muted"] = combinedIal["custom-slidev-muted"]
        if (combinedIal["custom-slidev-controls"]) effectiveAttrs["custom-slidev-controls"] = combinedIal["custom-slidev-controls"]
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

    // 组织多栏插槽或常规内容（排除纯分界占位块与纯空白段落）
    const contentBlocks = page.blocks.filter(b => b.slot !== "slot-divider-right")
    const renderBlocks = (list: ISlidevBlockItem[]) =>
      list
        .filter(b => Boolean((b.rawMarkdown || b.content || "").trim()))
        .map(b => wrapElementDirectives(b.rawMarkdown, b.clicks, b.motion, b.attributes?.style))
        .join("\n\n")

    const cleanFirstListBlock = (list: ISlidevBlockItem[]) => {
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

    const renderColList = (list: ISlidevBlockItem[]) => {
      if (list.length === 0) return ""
      cleanFirstListBlock(list)
      return renderBlocks(list)
    }

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

      // 对左右分栏首个列表项执行卡片式圆点清洗（保留下级嵌套子项圆点与缩进）
      cleanFirstListBlock(leftList)
      cleanFirstListBlock(rightList)

      const headerContent = renderBlocks(headerList)
      const leftContent = renderColList(leftList)
      const rightContent = renderColList(rightList)

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
      const distribution = distributeThreeColumns(rem)
      const col1List = distribution.col1
      const col2List = distribution.col2
      const col3List = distribution.col3

      // 为虚拟 AST 模型上的块补全 slot，确保 Web 沙箱接收到 slides 时 slot 与渲染对齐
      for (const b of col1List) {
        if (!b.slot) b.slot = "col-1"
      }
      for (const b of col2List) {
        if (!b.slot) b.slot = "col-2"
      }
      for (const b of col3List) {
        if (!b.slot) b.slot = "col-3"
      }

      // 对三栏各列首个列表项执行卡片式圆点清洗（保留下级嵌套子项圆点与缩进）
      cleanFirstListBlock(col1List)
      cleanFirstListBlock(col2List)
      cleanFirstListBlock(col3List)

      // 若 rem 原本只有 1 个单块且被成功解构为 3 个虚拟块，更新 page.blocks
      if (rem.length === 1 && (col2List.length > 0 || col3List.length > 0)) {
        const origIdx = page.blocks.findIndex(b => b.id === rem[0].id)
        if (origIdx !== -1) {
          page.blocks.splice(origIdx, 1, ...col1List, ...col2List, ...col3List)
        }
      }

      const headerContent = renderBlocks(headerList)
      const col1Content = renderColList(col1List)
      const col2Content = renderColList(col2List)
      const col3Content = renderColList(col3List)

      if (headerContent) parts.push(headerContent)
      if (col1Content) parts.push(`::col-1::\n\n${col1Content}`)
      if (col2Content) parts.push(`::col-2::\n\n${col2Content}`)
      if (col3Content) parts.push(`::col-3::\n\n${col3Content}`)
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
        parts.push(wrapElementDirectives(block.rawMarkdown, block.clicks, block.motion, block.attributes?.style))
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
