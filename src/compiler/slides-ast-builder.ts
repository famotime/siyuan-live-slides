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
  ATTR_ELEM_ANIM,
  ATTR_ELEM_SLOT,
  ATTR_ELEM_ROLE,
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
  isColsHeaderLayout,
  isHeadingBlock,
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
  detectListSuperBlock,
  detectSuperBlockImageLayout,
  extractImageUrl,
  isListItemNode,
  isSuperBlock,
} from "./superblock-scanner"
import { cleanAndTransformInlineKramdown } from "./html-cleaner"

import {
  normalizeMaxHeight,
  extractCleanNoteText,
  getBlockHeadingLevel,
  distributeThreeColumns,
  distributeNColumns,
  chunkSequentialFlowRows,
} from "./directive-wrapper"

export {
  extractCleanNoteText,
  getBlockHeadingLevel,
  distributeThreeColumns,
  distributeNColumns,
  chunkSequentialFlowRows,
}
export type { IThreeColsDistribution, FlowRowItem } from "./directive-wrapper"

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
  const globalBackground = config.background
    ? rewriteSingleAssetUrl(config.background, options)
    : undefined
  // P1-C1：当前页背景是否已由背景图块写入——区分"继承预设背景（全局/分页符属性）"
  // 与"页内背景图块"，预设背景可被首个背景图块覆盖，多个背景图块之间首个胜出
  let currentPageBackgroundFromImageBlock = false
  let currentPage: ISlidesVirtualPage = {
    pageIndex: 1,
    startBlockId: docId,
    frontmatter: {
      layout: initialPageAttrs.frontmatter.layout || "cover",
      ...initialPageAttrs.frontmatter,
      ...(globalBackground ? { background: globalBackground } : {}),
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

  // 页面级顶层图文分栏（image-left / image-right）预扫描
  // 确保配图位于幻灯片正文或复合列表项底部时，该页的 layout 与 image 提前就绪，避免正文列表项误判为多栏卡片
  const getPageNodes = (startIndex: number): ISiYuanBlockNode[] => {
    const res: ISiYuanBlockNode[] = []
    for (let i = startIndex; i < blocks.length; i++) {
      if (i > startIndex && isPageBreak(blocks[i])) break
      res.push(blocks[i])
    }
    return res
  }

  const detectPageTopLevelLayout = (pageNodes: ISiYuanBlockNode[]) => {
    let foundLayout: string | undefined
    let foundImage: string | undefined
    let foundRatio: string | undefined
    let foundImageBlockId: string | undefined

    const scanNode = (node: ISiYuanBlockNode) => {
      if (foundLayout) return

      const sb = detectSuperBlockImageLayout(node)
      if (sb) {
        foundLayout = sb.layout
        foundImage = sb.imageUrl
        foundRatio = sb.ratio
        foundImageBlockId = sb.imageNode?.id
        return
      }

      const rawMd = extractBlockMarkdown(node)
      const combinedIal = node.ial ? { ...node.ial } : {}
      const elemAttrs = parseElementAttrs(combinedIal)
      if (elemAttrs.imageLayout === "image-left" || elemAttrs.imageLayout === "image-right") {
        const imgUrl = extractImageUrl(rawMd, node.content)
        if (imgUrl) {
          foundLayout = elemAttrs.imageLayout
          foundImage = imgUrl
          foundRatio = node.ial?.[ATTR_PAGE_LAYOUT_RATIO]
          foundImageBlockId = node.id
          return
        }
      }

      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          scanNode(child)
          if (foundLayout) return
        }
      }
    }

    for (const n of pageNodes) {
      scanNode(n)
      if (foundLayout) break
    }

    return { foundLayout, foundImage, foundRatio, foundImageBlockId }
  }

  const applyPreScannedLayout = (page: ISlidesVirtualPage, pageNodes: ISiYuanBlockNode[]) => {
    const { foundLayout, foundImage, foundRatio, foundImageBlockId } = detectPageTopLevelLayout(pageNodes)
    if (foundLayout) {
      page.frontmatter.layout = foundLayout
      // 记录配图来源块：该块已在侧边栏渲染，正文内容流中必须排除，避免左右两侧重复出现
      if (foundImageBlockId) {
        page.imageBlockId = foundImageBlockId
      }
      if (foundImage) {
        page.frontmatter.image = rewriteSingleAssetUrl(foundImage, options)
      }
      if (foundRatio && !page.frontmatter.layoutRatio) {
        page.frontmatter.layoutRatio = foundRatio
      }
    }
  }

  applyPreScannedLayout(currentPage, getPageNodes(0))
  slides.push(currentPage)

  // 2. 遍历所有块节点进行三层作用域归类
  let headingStack: IHeadingScope[] = []

  for (let nodeIdx = 0; nodeIdx < blocks.length; nodeIdx++) {
    const node = blocks[nodeIdx]
    if (isPageBreak(node)) {
      // 开启新页时重置标题层级栈
      headingStack = []
      currentPageBackgroundFromImageBlock = false
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
        // 严格统一：背景由全局演示背景主导，忽略分割线自带的背景
        delete currentPage.frontmatter.background
        // 防御：若分割线未单独声明 image，继承文档级头部配置
        if (!pageMeta.frontmatter.image && initialPageAttrs.frontmatter.image) {
          currentPage.frontmatter.image = initialPageAttrs.frontmatter.image
        }
        if (globalBackground) {
          currentPage.frontmatter.background = globalBackground
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
        applyPreScannedLayout(currentPage, getPageNodes(nodeIdx + 1))
        continue
      }

      // 遇到后续水平分割线或显式切页标记，开启新幻灯片
      currentPage = {
        pageIndex: slides.length + 1,
        startBlockId: node.id,
        frontmatter: {
          layout: pageMeta.frontmatter.layout || "default",
          ...pageMeta.frontmatter,
          ...(globalBackground ? { background: globalBackground } : {}),
        },
        notes: "",
        noteBlocks: [],
        blocks: [],
        rawMarkdown: "",
        allBlockIds: [node.id],
      }
      if (!globalBackground) {
        delete currentPage.frontmatter.background
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

      applyPreScannedLayout(currentPage, getPageNodes(nodeIdx + 1))
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
        isListItem?: boolean
        /** 列表项解包后首个有效子块之后的“正文延续块”（无列表前缀），只缩进对齐，不显示圆点/序号 */
        isListContinuation?: boolean
        listLevel?: number
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

      // P1-C1：页面是否已确定图文版式（预扫描 detectPageTopLevelLayout 或更早块写入）——
      // 首个图文来源胜出，后续图文块不再覆写页面 frontmatter
      const isImageLayoutPage = currentPage.frontmatter.layout === "image-left"
        || currentPage.frontmatter.layout === "image-right"

      // 页面背景图块处理 (custom-slides-role="background" 或 custom-slides-background="true")
      if (elemAttrs.isBackground) {
        const imgUrl = extractImageUrl(rawMd, itemNode.content)
        if (imgUrl) {
          if (!currentPageBackgroundFromImageBlock) {
            currentPage.frontmatter.background = rewriteSingleAssetUrl(imgUrl, options)
            currentPageBackgroundFromImageBlock = true
            // 背景图不在正文内容流中渲染
            return
          }
          // P1-C1：同页已有背景图块时，后续背景图块退回正文内容流渲染，不再覆写页面背景
        }
      }

      // 检查超级块图文分栏 (layout: image-left / image-right)
      const sbLayout = detectSuperBlockImageLayout(itemNode)
      if (sbLayout) {
        if (!isImageLayoutPage) {
          currentPage.frontmatter.layout = sbLayout.layout
          currentPage.frontmatter.image = rewriteSingleAssetUrl(sbLayout.imageUrl, options)
          if (!currentPage.frontmatter.layoutRatio && sbLayout.ratio) {
            currentPage.frontmatter.layoutRatio = sbLayout.ratio
          }
        }

        // 将超级块内的非图片内容子块平铺为幻灯片普通内容块；
        // P1-C2：传入容器上下文，超级块内部子标题不污染全局大纲栈
        for (const childNode of sbLayout.contentNodes) {
          processBlockNode(childNode, {
            ...inheritedContext,
            parentContainerId: itemNode.id || inheritedContext?.parentContainerId,
          })
        }
        return
      }

      // 独立标记了图左/图右的图片块处理
      if (elemAttrs.imageLayout === "image-left" || elemAttrs.imageLayout === "image-right") {
        const imgUrl = extractImageUrl(rawMd, itemNode.content)
        if (imgUrl) {
          // 预扫描已确认该块为本页配图来源：仅在侧边栏渲染，不进入正文内容流
          if (itemNode.id && itemNode.id === currentPage.imageBlockId) {
            return
          }
          if (!isImageLayoutPage) {
            currentPage.frontmatter.layout = elemAttrs.imageLayout
            currentPage.frontmatter.image = rewriteSingleAssetUrl(imgUrl, options)
            if (!currentPage.frontmatter.layoutRatio && itemNode.ial?.[ATTR_PAGE_LAYOUT_RATIO]) {
              currentPage.frontmatter.layoutRatio = itemNode.ial[ATTR_PAGE_LAYOUT_RATIO]
            }
            // 幻灯片内容流中排除该配图
            return
          }
          // 页面版式已被更早的图文块确定：当前配图退回正文内容流渲染
        }
      }

      // 常规未匹配图文版式的超级块：展开其子内容 (兼容思源官方缩写 's'、'sb' 与 'NodeSuperBlock')
      if (
        isSuperBlock(itemNode) &&
        itemNode.children &&
        itemNode.children.length > 0
      ) {
        const isMultiColPage =
          isColsHeaderLayout(currentPage.frontmatter.layout) ||
          currentPage.frontmatter.layout === "clover"
        const detectedListCols =
          isMultiColPage && !inheritedContext?.defaultSlot
            ? detectListSuperBlock(itemNode)
            : null

        if (detectedListCols?.columns && detectedListCols.columns.length >= 2) {
          for (let colIdx = 0; colIdx < detectedListCols.columns.length; colIdx++) {
            const col = detectedListCols.columns[colIdx]
            processBlockNode(col.containerNode, {
              ...inheritedContext,
              defaultSlot: `col-${colIdx + 1}`,
              parentContainerId: itemNode.id || inheritedContext?.parentContainerId,
            })
          }
          return
        }

        // P1-C2 修复：超级块展开与列表容器展开语义对齐——内部子标题属于容器局部标题，
        // 传入 parentContainerId 阻止其压入全局大纲栈，杜绝后续无关块继承容器内标题的 slot/clicks/motion
        for (const childNode of itemNode.children) {
          processBlockNode(childNode, {
            ...inheritedContext,
            parentContainerId: itemNode.id || inheritedContext?.parentContainerId,
          })
        }
        return
      }

      const isColContext = Boolean(
        elemAttrs.slot ||
        inheritedContext?.defaultSlot ||
        currentPage.frontmatter.layout === "clover" ||
        currentPage.frontmatter.layout === "timeline" ||
        currentPage.frontmatter.layout === "steps" ||
        isColsHeaderLayout(currentPage.frontmatter.layout) ||
        currentPage.frontmatter.layout === "two-cols"
      )

      // 展开带有分栏插槽、显式拆分、多子块复合项或多媒体的列表容器子项 (NodeList 'l')
      const hasNodeUnpackAttr = (n: ISiYuanBlockNode): boolean => {
        if (
          n.ial?.[ATTR_ELEM_SLOT] ||
          n.ial?.[ATTR_ELEM_CLICK] ||
          n.ial?.[ATTR_ELEM_ROLE] ||
          n.ial?.[ATTR_PAGE_LAYOUT] ||
          n.ial?.["custom-slides-role"] ||
          n.ial?.["custom-slides-layout"]
        ) {
          return true
        }
        if (n.children && n.children.length > 0) {
          if (n.children.length >= 2) return true
          return n.children.some(hasNodeUnpackAttr)
        }
        return false
      }
      const hasUnpackChild = Boolean(
        itemNode.children &&
        itemNode.children.some(hasNodeUnpackAttr)
      )

      if (
        (itemNode.type === "l" || itemNode.type === "NodeList" || itemNode.type === "list") &&
        itemNode.children &&
        itemNode.children.length > 0 &&
        (
          hasUnpackChild ||
          elemAttrs.slot ||
          elemAttrs.clicks ||
          isColContext
        )
      ) {
        const isOrderedList = /^\s*\d+\.\s+/m.test(itemNode.markdown || "") || itemNode.subType === "o" || (itemNode as any).subtype === "o"
        const nextListLevel = (inheritedContext?.listLevel ?? -1) + 1
        // 若列表容器自身显式配置了 clicks，为其分配独立容器标识；否则透传外层容器上下文（如父列表项）
        const listParentClicks = elemAttrs.clicks || inheritedContext?.parentClicks
        const listParentContainerId = elemAttrs.clicks
          ? (itemNode.id || inheritedContext?.parentContainerId)
          : inheritedContext?.parentContainerId
        for (let idx = 0; idx < itemNode.children.length; idx++) {
          const childNode = itemNode.children[idx]
          if (elemAttrs.slot && (!childNode.ial || !childNode.ial[ATTR_ELEM_SLOT])) {
            if (!childNode.ial) childNode.ial = {}
            childNode.ial[ATTR_ELEM_SLOT] = elemAttrs.slot
          }
          processBlockNode(childNode, {
            ...inheritedContext,
            parentClicks: listParentClicks,
            parentContainerId: listParentContainerId,
            defaultSlot: elemAttrs.slot || inheritedContext?.defaultSlot,
            isParentListUnpacked: true,
            isListItem: true,
            listLevel: nextListLevel,
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
        const firstChildIsContainer = Boolean(
          firstValidChild && (
            isListItemNode(firstValidChild) ||
            firstValidChild.type === "l" ||
            firstValidChild.type === "NodeList" ||
            firstValidChild.type === "list"
          )
        )
        const firstChildClicks = firstChildIsContainer
          ? undefined
          : (firstValidChild?.ial?.[ATTR_ELEM_CLICK] || firstValidChild?.ial?.["custom-slides-click"])
        const hasExplicitEmptyClick = Boolean(
          itemNode.ial &&
          ATTR_ELEM_CLICK in itemNode.ial &&
          !String(itemNode.ial[ATTR_ELEM_CLICK] || "").trim()
        )

        // 确定容器 clicks：
        // 1. 若列表项自身配置了 clicks，以自身为准；
        // 2. 若列表项自身未配置（且未显式关闭），但包含多个子块（首行文本+子组件）且首行文本配置了 clicks，提升为容器 clicks；
        // 3. 否则说明当前列表项未开启自身 clicks，若有父容器 clicks 则沿用父容器归属，保持与父级同拍出现
        const shouldLiftFirstChild = Boolean(!elemAttrs.clicks && !hasExplicitEmptyClick && hasMultipleChildren && firstChildClicks)
        const selfClicks = elemAttrs.clicks || (shouldLiftFirstChild ? firstChildClicks : undefined)
        const hasOwnContainerClicks = Boolean(selfClicks)
        const containerClicks = selfClicks || inheritedContext?.parentClicks
        const hasInheritedParentGroup = Boolean(!hasOwnContainerClicks && inheritedContext?.parentContainerId && inheritedContext?.parentClicks)
        const containerId = hasInheritedParentGroup
          ? inheritedContext!.parentContainerId
          : (itemNode.id || inheritedContext?.parentContainerId)
        const targetSlot = elemAttrs.slot || inheritedContext?.defaultSlot
        const isNestedListItem = (inheritedContext?.listLevel ?? 0) > 0

        let isFirstValidChild = true
        for (const childNode of itemNode.children) {
          if (targetSlot && (!childNode.ial || !childNode.ial[ATTR_ELEM_SLOT])) {
            if (!childNode.ial) childNode.ial = {}
            childNode.ial[ATTR_ELEM_SLOT] = targetSlot
          }

          const hasContent = Boolean((childNode.markdown || childNode.content || "").trim())
          const isThisFirstValid = isFirstValidChild && hasContent

          if (isThisFirstValid) {
            // 判定当前是否真正属于多栏卡片容器：
            // 仅在四叶草 clover、表头多栏 cols-header 或双栏 two-cols 卡片，且非图文分栏 (image-right/image-left) 下，
            // 顶层列表项作为多栏的独立卡片时，才清洗首行标题的列表标记；
            // 在常规正文或嵌套子列表下，列表项必须完整保留或补齐标准的列表前缀符号！
            const isImageLayout = currentPage.frontmatter.layout === "image-right" || currentPage.frontmatter.layout === "image-left"
            const isMultiColsPage = !isImageLayout && Boolean(
              currentPage.frontmatter.layout === "clover" ||
              currentPage.frontmatter.layout === "timeline" ||
              currentPage.frontmatter.layout === "steps" ||
              isColsHeaderLayout(currentPage.frontmatter.layout) ||
              currentPage.frontmatter.layout === "two-cols"
            )
            const isCardCol = !isNestedListItem && isMultiColsPage && Boolean(
              inheritedContext?.defaultSlot ||
              elemAttrs.slot ||
              itemNode.ial?.[ATTR_ELEM_SLOT]
            )

            if (isCardCol) {
              // 仅在真正的分栏卡片布局下，列表项作为卡片，首行标题才清洗列表前缀
              if (childNode.markdown) {
                childNode.markdown = cleanCardListItemMarkdown(childNode.markdown)
              }
              if (childNode.content) {
                childNode.content = cleanCardListItemMarkdown(childNode.content)
              }
            } else {
              // 在常规正文列表（单栏、图文混排等）下，列表项必须完整保留或补齐标准的列表前缀符号！
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
          // 1. 当自身容器开启 clicks 且存在多个子块时，首行子块清除独立 clicks，仅依赖 parentClicks/parentContainerId 与子组件同拍；
          // 2. 当自身容器开启 clicks 且仅含单个子块时，将 clicks 落于唯一子块，parentClicks/parentContainerId 沿用外层上下文，避免同一块既算容器又算自身导致步数翻倍；
          // 3. 当自身容器未开启 clicks 时（如子列表项关闭逐步呈现），绝不向子块注入父级 clicks，仅透传父容器归属以便跟随父级同拍出现。
          let childToProcess = childNode
          let childParentClicks = containerClicks
          let childParentContainerId = containerId
          if (hasOwnContainerClicks && hasMultipleChildren && isThisFirstValid) {
            childToProcess = {
              ...childNode,
              ial: { ...(childNode.ial || {}) },
            }
            delete childToProcess.ial[ATTR_ELEM_CLICK]
            delete childToProcess.ial["custom-slides-click"]
          } else if (hasOwnContainerClicks && !hasMultipleChildren) {
            childToProcess = {
              ...childNode,
              ial: { ...(childNode.ial || {}), [ATTR_ELEM_CLICK]: selfClicks! },
            }
            childParentClicks = inheritedContext?.parentClicks
            childParentContainerId = inheritedContext?.parentContainerId || itemNode.id
          }

          processBlockNode(childToProcess, {
            ...inheritedContext,
            parentClicks: childParentClicks,
            parentContainerId: childParentContainerId,
            defaultSlot: targetSlot,
            // 仅首个有效子块（带列表前缀的主文本）才是列表项；其后的纯文本子块属于该列表项的延续正文，
            // 不得继承 isListItem，否则渲染器兜底会为其补上圆点/序号
            isListItem: !hasContent || isThisFirstValid,
            isListContinuation: hasContent && !isThisFirstValid,
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
      let effectiveClicks: string | undefined = elemAttrs.clicks || undefined
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
      if (elemAttrs.anim && !effectiveAttrs[ATTR_ELEM_ANIM]) {
        effectiveAttrs[ATTR_ELEM_ANIM] = elemAttrs.anim.type
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
        ? normalizeMaxHeight(elemAttrs.maxHeight)
        : undefined

      const isListItem = Boolean(inheritedContext?.isListItem || isListItemNode(itemNode))
      const isListContinuation = Boolean(inheritedContext?.isListContinuation && !isListItem)
      const blockItem: ISlidesBlockItem = {
        id: itemNode.id,
        type: itemNode.type,
        content: itemNode.content || "",
        rawMarkdown: rawMd,
        clicks: effectiveClicks,
        parentClicks: inheritedContext?.parentClicks,
        parentContainerId: inheritedContext?.parentContainerId,
        motion: effectiveMotion,
        anim: elemAttrs.anim,
        shikiLines: elemAttrs.shikiLines,
        maxHeight: normMaxHeight,
        slot: effectiveSlot,
        attributes: effectiveAttrs,
        attrs: effectiveAttrs,
        rawNode: itemNode,
        isListItem,
        ...(isListContinuation ? { isListContinuation: true } : {}),
      }

      currentPage.blocks.push(blockItem)
    }

    processBlockNode(node)
  }

  // 3. 为每一页整理多栏插槽结构与卡片首行清洗，并同步 page.rawMarkdown
  for (let i = 0; i < slides.length; i++) {
    const page = slides[i]

    // 组织多栏插槽或常规内容（排除纯分界占位块）
    const contentBlocks = page.blocks.filter(b => b.slot !== "slot-divider-right")

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

    const layout = page.frontmatter.layout || "default"

    if (layout === "clover" || layout === "timeline" || layout === "steps" || isColsHeaderLayout(layout)) {
      let headerList: ISlidesBlockItem[] = []
      // 1. 显式指定的 slot === "header" 具有最高优先级，无条件作为跨通栏大标题
      const explicitHeader = contentBlocks.filter(b => b.slot === "header")
      if (explicitHeader.length > 0) {
        headerList = explicitHeader
      } else if (page.frontmatter.header !== false) {
        // 2. 通栏标题开启时自动嗅探首个标题或未分配插槽的头部文本块
        if (contentBlocks.length > 0) {
          const candidateH = contentBlocks.find(b => isHeadingBlock(b) && (!b.slot || b.slot === "default"))
          if (candidateH) {
            headerList = [candidateH]
          } else if (contentBlocks.length >= 2) {
            // 启发式：首块若未分配插槽且后方有多个内容块时，自动提取为表头大标题
            const firstBlock = contentBlocks[0]
            if (!firstBlock.slot || firstBlock.slot === "default") {
              headerList = [firstBlock]
            }
          }
        }
      }

      for (const b of headerList) {
        if (!b.slot || b.slot === "default") {
          b.slot = "header"
        }
      }

      const rem = contentBlocks.filter(b => !headerList.includes(b))

      // 确定栏数 targetCols (自适应 2~N 栏，四叶草固定为 4 象限，时间线/步骤 2~6 节点)
      let targetCols = 2
      if (layout === "clover") {
        targetCols = 4
      } else if (layout === "timeline" || layout === "steps") {
        if (rem.length === 1 && rem[0].children && rem[0].children.length >= 2) {
          targetCols = Math.min(6, Math.max(2, rem[0].children.length))
        } else if (rem.length >= 2) {
          targetCols = Math.min(6, rem.length)
        } else {
          targetCols = 3
        }
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
        } else {
          const listItems = rem.filter(b => b.isListItem || b.type === "i" || /^(?:[-*+]|\d+\.)\s+/.test((b.rawMarkdown || b.content || "").trim()))
          if (listItems.length >= 2) {
            targetCols = Math.min(6, listItems.length)
          }
        }
      }

      const flowRows = (isColsHeaderLayout(layout) && layout !== "clover")
        ? chunkSequentialFlowRows(contentBlocks, { defaultCols: targetCols, layoutRatio: page.frontmatter.layoutRatio })
        : []

      if (flowRows.length > 0) {
        // 严格顺序流式切分模式 (Sequential Flow):
        // 显式 default 或未分配插槽的通栏段落保留，不强制打上 col-1
        let pageFirstHAssigned = false

        for (const row of flowRows) {
          if (row.type === "fullwidth") {
            for (const b of row.blocks) {
              if (isHeadingBlock(b) && !pageFirstHAssigned) {
                if (!b.slot || b.slot === "default") {
                  b.slot = "header"
                }
                pageFirstHAssigned = true
              }
              // 通栏正文段落保持 default 或原样，不回填 col-X
            }
          } else if (row.type === "grid") {
            row.cols.forEach((colList, colIdx) => {
              const slotName = `col-${colIdx + 1}`
              for (const b of colList) {
                if (!b.slot || b.slot === "default") {
                  b.slot = slotName
                }
              }
              cleanFirstListBlock(colList)
            })
          }
        }
      } else {
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
      }
    }

    page.rawMarkdown = page.blocks
      .filter(b => b.slot !== "slot-divider-right")
      .map(b => b.rawMarkdown || b.content || "")
      .filter(Boolean)
      .join("\n\n")
      .trim()
  }

  return {
    docId,
    config,
    slides,
  }
}
