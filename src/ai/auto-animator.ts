import type { ISiYuanBlockNode } from "../types/slides-protocol"

export interface IAnimationInjection {
  blockId: string
  step: string
}

/**
 * 智能为列表项或并列论点注入渐进出现 (v-click) 步骤
 */
export function generateAutoAnimations(
  blocks: ISiYuanBlockNode[],
): IAnimationInjection[] {
  const injections: IAnimationInjection[] = []
  let step = 1

  for (const block of blocks) {
    // 列表项、或简短段落自动步进
    const isListItem = block.type === "i" || block.type === "l"
    const isShortParagraph = block.type === "p" && (block.content?.length || 0) < 80

    if (isListItem || isShortParagraph) {
      injections.push({
        blockId: block.id,
        step: String(step),
      })
      step++
    }
  }

  return injections
}
