import type { ISiYuanBlockNode } from "../types/slides-protocol"
import { isPageBreak } from "../compiler/scope-mapper"

export interface ISplitSuggestion {
  blockId: string
  recommendedLayout: string
  reason: string
}

export interface ISplitOptions {
  splitOnH1?: boolean
  splitOnH2?: boolean
  splitOnH3?: boolean
  maxBlocksPerPage?: number
  maxWeightPerPage?: number
  protectOrphanHeadings?: boolean
  inferLayouts?: boolean
  insertLeadingBreak?: boolean
}

/**
 * 提取一、二、三级标题层级（若非一二三级标题则返回 null）
 */
export function getHeadingLevel(block: ISiYuanBlockNode): 1 | 2 | 3 | null {
  if (block.type === "h") {
    if (block.subType === "h1") return 1
    if (block.subType === "h2") return 2
    if (block.subType === "h3") return 3
  }
  const md = (block.markdown || block.content || "").trimStart()
  if (md.startsWith("# ")) return 1
  if (md.startsWith("## ")) return 2
  if (md.startsWith("### ")) return 3
  return null
}

/**
 * 向上查找距离当前块最近的一个实质块（包含物理分页符，跳过纯空白块）
 */
export function findPreviousSignificantBlock(
  blocks: ISiYuanBlockNode[],
  currentIndex: number,
): ISiYuanBlockNode | null {
  for (let j = currentIndex - 1; j >= 0; j--) {
    const b = blocks[j]
    if (isPageBreak(b)) return b
    const text = (b.content || b.markdown || "").trim()
    if (text) return b
  }
  return null
}

/**
 * 计算单个块的视觉空间占用权重：
 * 代码块、表格、超级块占用垂直空间大（权重 3）；
 * 包含图片、长文本、列表、引用的块（权重 2）；
 * 常规短段落（权重 1）；空块（权重 0）。
 */
export function getBlockWeight(block: ISiYuanBlockNode): number {
  const type = block.type
  if (type === "c" || type === "code" || type === "t" || type === "table" || type === "s" || type === "super") {
    return 3
  }
  if (type === "l" || type === "list" || type === "b" || type === "blockquote") {
    return 2
  }
  const text = (block.markdown || block.content || "").trim()
  if (!text) return 0
  if (text.includes("![") || text.includes("<img")) {
    return 2
  }
  if (text.length > 100) {
    return 2
  }
  return 1
}

/**
 * 依据标题及紧随其后的页面内容，前瞻推断最匹配的 Slidev 版式
 */
export function inferSlideLayout(
  headingLevel: 1 | 2 | 3 | null,
  followingBlocks: ISiYuanBlockNode[],
): string {
  // 一级核心章节标题默认使用封面/大章版式
  if (headingLevel === 1) {
    return "cover"
  }

  // 检查是否包含配图
  let hasImage = false
  let imageIndex = -1
  for (let i = 0; i < followingBlocks.length; i++) {
    const b = followingBlocks[i]
    const text = (b.markdown || b.content || "").trim()
    if (text.includes("![") || text.includes("<img") || b.type === "img") {
      hasImage = true
      imageIndex = i
      break
    }
  }

  if (hasImage) {
    // 若图片在开头，推荐图左版式；若在后文，推荐图右版式
    return imageIndex === 0 ? "image-left" : "image-right"
  }

  // 检查是否包含多项列表或分栏超级块
  let listItemCount = 0
  let hasSuperBlock = false
  let hasBlockquote = false
  for (const b of followingBlocks) {
    if (b.type === "i" || b.type === "l" || (b.markdown || "").trim().startsWith("- ")) {
      listItemCount++
    }
    if (b.type === "s") {
      hasSuperBlock = true
    }
    if (b.type === "b") {
      hasBlockquote = true
    }
  }

  if (hasSuperBlock || listItemCount >= 3) {
    return "two-cols"
  }

  if (hasBlockquote && followingBlocks.length <= 2) {
    return "quote"
  }

  return "default"
}

/**
 * 分析笔记块列表并提出智能分页建议
 *
 * 核心优化特性：
 * 1. 标题识别：支持一、二、三级标题（H1/H2/H3）智能断页；
 * 2. 孤立标题保护：大标题紧接子标题且中间无正文时避免过度切割产生空白单行页；
 * 3. 版式推断：依据当前页所含图文、列表、引用智能匹配 cover / image-right / two-cols 等专业版式；
 * 4. 空间权重控制：按块权重防止页面信息超载，对代码/表格/超级块进行不可分割保护；
 * 5. 全面防重与幂等：识别前驱物理分页线，对已有分页符文档再次执行建议为 0。
 */
export function analyzeSlideSplits(
  blocks: ISiYuanBlockNode[],
  options?: ISplitOptions,
): ISplitSuggestion[] {
  const suggestions: ISplitSuggestion[] = []
  const suggestedBlockIds = new Set<string>()

  const splitH1 = options?.splitOnH1 ?? true
  const splitH2 = options?.splitOnH2 ?? true
  const splitH3 = options?.splitOnH3 ?? true
  const maxBlocks = options?.maxBlocksPerPage ?? 6
  const maxWeight = options?.maxWeightPerPage ?? 6
  const protectOrphanHeadings = options?.protectOrphanHeadings ?? true
  const inferLayouts = options?.inferLayouts ?? true
  const insertLeadingBreak = options?.insertLeadingBreak ?? true

  let blocksInCurrentSlide = 0
  let weightInCurrentSlide = 0
  let currentSlideHeadings = 0
  let currentSlideContentBlocks = 0
  let lastHeadingLevel: 1 | 2 | 3 | null = null

  // 辅助函数：从 startIndex 之后收集当前页的后续块（直到下一个标题或显式分页）用于版式推断
  function collectFollowingBlocks(startIndex: number): ISiYuanBlockNode[] {
    const collected: ISiYuanBlockNode[] = []
    for (let j = startIndex + 1; j < blocks.length; j++) {
      const b = blocks[j]
      if (isPageBreak(b)) break
      const lvl = getHeadingLevel(b)
      if (lvl !== null && ((splitH1 && lvl === 1) || (splitH2 && lvl === 2) || (splitH3 && lvl === 3))) {
        break
      }
      collected.push(b)
    }
    return collected
  }

  // 1. 文档首段起点断页：检查文档开头是否已有分页线，若无则建议在首个实质块前插入分页线作为第一页起点
  if (insertLeadingBreak && blocks.length > 0) {
    let hasLeadingBreak = false
    let firstSignificantIndex = -1

    for (let k = 0; k < blocks.length; k++) {
      const b = blocks[k]
      if (isPageBreak(b)) {
        hasLeadingBreak = true
        break
      }
      const text = (b.content || b.markdown || "").trim()
      if (text) {
        firstSignificantIndex = k
        break
      }
    }

    if (!hasLeadingBreak && firstSignificantIndex >= 0) {
      const targetBlock = blocks[firstSignificantIndex]
      const headingLevel = getHeadingLevel(targetBlock)
      let initialLayout = headingLevel === 1 ? "cover" : "default"

      if (inferLayouts && headingLevel !== 1) {
        const following = collectFollowingBlocks(firstSignificantIndex)
        initialLayout = inferSlideLayout(headingLevel, following)
      }

      const reason =
        headingLevel === 1
          ? "作为第一页起点插入分页线 (封面大章)"
          : "作为第一页起点插入分页线"

      suggestions.push({
        blockId: targetBlock.id,
        recommendedLayout: initialLayout,
        reason,
      })
      suggestedBlockIds.add(targetBlock.id)
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    // 1. 显式物理分页线：重置当前页状态
    if (isPageBreak(block)) {
      blocksInCurrentSlide = 0
      weightInCurrentSlide = 0
      currentSlideHeadings = 0
      currentSlideContentBlocks = 0
      lastHeadingLevel = null
      continue
    }

    // 2. 检查前驱实质块：若前驱是物理分页符，或无前驱（首块），则判定当前块前方已有分页线或为文档开头
    const prevBlock = findPreviousSignificantBlock(blocks, i)
    const prevIsPageBreak = !prevBlock || isPageBreak(prevBlock)

    // 3. 标题识别断页（支持一、二、三级标题）
    const headingLevel = getHeadingLevel(block)
    const isTargetHeading =
      (splitH1 && headingLevel === 1) ||
      (splitH2 && headingLevel === 2) ||
      (splitH3 && headingLevel === 3)

    if (isTargetHeading) {
      // 孤立标题防切割判定：
      // 若当前页仅有 1 个标题且完全没有正文内容：
      // - 若上一标题为 H1（封面大章），当前为 H2：允许断页（大章封面过渡）；
      // - 若上一标题为 H2 且当前为 H3，或同级标题连续出现：保护孤立标题，不断页合并到同一页。
      const isOrphanHeading =
        protectOrphanHeadings &&
        currentSlideHeadings === 1 &&
        currentSlideContentBlocks === 0 &&
        lastHeadingLevel !== null &&
        !(lastHeadingLevel === 1 && headingLevel === 2)

      if (!isOrphanHeading && !prevIsPageBreak && blocksInCurrentSlide > 0 && !suggestedBlockIds.has(block.id)) {
        let layout = headingLevel === 1 ? "cover" : "default"
        if (inferLayouts) {
          const following = collectFollowingBlocks(i)
          layout = inferSlideLayout(headingLevel, following)
        }

        let reason =
          headingLevel === 1
            ? "检测到一级核心章节标题，建议作为新幻灯片封面/大章"
            : headingLevel === 2
              ? "检测到二级分论点标题，建议开启新页"
              : "检测到三级要点标题，建议开启新页"

        if (layout === "image-right" || layout === "image-left") {
          reason += " (推荐图文版式)"
        } else if (layout === "two-cols") {
          reason += " (推荐双栏版式)"
        } else if (layout === "quote") {
          reason += " (推荐引言版式)"
        }

        suggestions.push({
          blockId: block.id,
          recommendedLayout: layout,
          reason,
        })
        suggestedBlockIds.add(block.id)

        // 重置为新页
        blocksInCurrentSlide = 1
        weightInCurrentSlide = getBlockWeight(block)
        currentSlideHeadings = 1
        currentSlideContentBlocks = 0
        lastHeadingLevel = headingLevel
        continue
      }

      // 未断页（或孤立标题保护）：保留在当前页并累加标题
      blocksInCurrentSlide++
      weightInCurrentSlide += getBlockWeight(block)
      currentSlideHeadings++
      lastHeadingLevel = headingLevel
      continue
    }

    // 4. 非标题普通内容块：检查信息空间权重与容量上限
    const blockWeight = getBlockWeight(block)

    // 容量上限或空间权重超载判断
    const isCapacityOver =
      blocksInCurrentSlide >= maxBlocks ||
      (weightInCurrentSlide + blockWeight > maxWeight && blocksInCurrentSlide > 0)

    if (isCapacityOver) {
      if (!prevIsPageBreak && blocksInCurrentSlide > 0 && !suggestedBlockIds.has(block.id)) {
        suggestions.push({
          blockId: block.id,
          recommendedLayout: "default",
          reason: "当前页已达容量上限 (避免信息超载)，建议在此分页",
        })
        suggestedBlockIds.add(block.id)

        // 当前块作为新页的第 1 个块
        blocksInCurrentSlide = 1
        weightInCurrentSlide = blockWeight
        currentSlideHeadings = 0
        currentSlideContentBlocks = 1
        lastHeadingLevel = null
        continue
      }
    }

    // 累加当前页
    blocksInCurrentSlide++
    weightInCurrentSlide += blockWeight
    currentSlideContentBlocks++
  }

  return suggestions
}
