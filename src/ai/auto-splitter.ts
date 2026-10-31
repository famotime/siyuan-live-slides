import type { ISiYuanBlockNode } from "../types/slides-protocol"
import { isPageBreak } from "../compiler/scope-mapper"

export interface ISplitSuggestion {
  blockId: string
  recommendedLayout: string
  reason: string
}

/**
 * 分析笔记块列表并提出智能分页建议
 */
export function analyzeSlideSplits(
  blocks: ISiYuanBlockNode[],
  options?: {
    splitOnH1?: boolean
    splitOnH2?: boolean
    maxBlocksPerPage?: number
  },
): ISplitSuggestion[] {
  const suggestions: ISplitSuggestion[] = []
  const splitH1 = options?.splitOnH1 ?? true
  const splitH2 = options?.splitOnH2 ?? true
  const maxBlocks = options?.maxBlocksPerPage ?? 6

  let blocksInCurrentSlide = 0

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    // 如果已经是显式分页，重置计数器
    if (isPageBreak(block)) {
      blocksInCurrentSlide = 0
      continue
    }

    const md = block.markdown || block.content || ""
    const isFirstBlock = i === 0

    // 1. 标题识别断页
    if (!isFirstBlock) {
      if (splitH1 && (block.type === "h" && (block.subType === "h1" || md.startsWith("# ")))) {
        suggestions.push({
          blockId: block.id,
          recommendedLayout: "cover",
          reason: "检测到一级核心章节标题，建议作为新幻灯片封面/大章",
        })
        blocksInCurrentSlide = 0
        continue
      }

      if (splitH2 && (block.type === "h" && (block.subType === "h2" || md.startsWith("## ")))) {
        suggestions.push({
          blockId: block.id,
          recommendedLayout: "default",
          reason: "检测到二级分论点标题，建议开启新页",
        })
        blocksInCurrentSlide = 0
        continue
      }
    }

    // 2. 块数量超阈值防止页面过度拥挤
    blocksInCurrentSlide++
    if (blocksInCurrentSlide >= maxBlocks && i < blocks.length - 1) {
      const nextBlock = blocks[i + 1]
      if (!isPageBreak(nextBlock)) {
        suggestions.push({
          blockId: nextBlock.id,
          recommendedLayout: "default",
          reason: "当前页已达容量上限 (避免信息超载)，建议在此分页",
        })
        blocksInCurrentSlide = 0
      }
    }
  }

  return suggestions
}
