import type { ISlidevVirtualPage } from "../types/slidev-protocol"
import { ATTR_ELEM_SLOT } from "../types/slidev-protocol"

export interface IInspectorSlideContext {
  activeBlockId: string
  activeBlockType: string
  currentTopBlockId?: string
  currentPageDividerId?: string
  activeBlockAttrs?: Record<string, string>
}

/**
 * 判断指定块类型是否为水平分割线 / 分页符
 */
export function isDividerBlockType(blockType?: string): boolean {
  if (!blockType) return false
  return blockType === "NodeThematicBreak" || blockType === "tb" || blockType === "thematic-break"
}

/**
 * 推导演示配置面板（Inspector）当前应当绑定的目标幻灯片模型
 * 
 * 核心规则：
 * 1. 当激活块为水平分割线/分页符 (NodeThematicBreak / tb) 时，用户期望配置的是该分割线所开启的
 *    幻灯片页面（即分割线下一页的内容与演讲者提词），优先精准匹配 startBlockId 等于当前分页符 ID 的 Slide；
 * 2. 当激活块为普通内容块时，根据前置分页符 ID (currentPageDividerId) 或块深度归属 (allBlockIds / blocks) 匹配；
 * 3. 兜底降级为首页。
 */
export function resolveTargetSlide(
  slides: ISlidevVirtualPage[] | undefined | null,
  context: IInspectorSlideContext,
): ISlidevVirtualPage | null {
  if (!slides || slides.length === 0) return null

  const aid = context.activeBlockId || ""
  const topId = context.currentTopBlockId || aid
  const divId = context.currentPageDividerId || ""
  const bType = context.activeBlockType || ""
  const isDivider = isDividerBlockType(bType)

  // 0. 若当前激活块本身就是分隔行 (isDivider)，优先精准匹配由该分隔行开启的幻灯片页面（即分隔行下一页内容）
  if (isDivider && aid) {
    let s = slides.find(slide => slide.startBlockId === aid)
    if (s) return s
    s = slides.find(slide => slide.blocks?.[0]?.id === aid)
    if (s) return s
    s = slides.find(slide => slide.allBlockIds?.includes(aid))
    if (s) return s
  }

  // 1. 若解析到了所属的前置分页符 ID，优先精准匹配对应幻灯片
  if (divId) {
    let s = slides.find(slide => slide.startBlockId === divId)
    if (s) return s
    s = slides.find(slide => slide.blocks?.[0]?.id === divId)
    if (s) return s
  }

  // 2. 当前激活块本身就是分页符或幻灯片起始块
  if (aid) {
    let s = slides.find(slide => slide.startBlockId === aid)
    if (s) return s

    // 3. 匹配 aid 是否在正文内容块列表中 (或 allBlockIds 深度树形包含)
    s = slides.find(slide =>
      slide.blocks?.some(b => b.id === aid) ||
      slide.allBlockIds?.includes(aid)
    )
    if (s) return s

    // 4. 匹配 topBlockId 是否在正文内容块列表中 (解决列表项、表格、引述块、超级块等深层嵌套子块的识别)
    if (topId && topId !== aid) {
      s = slides.find(slide =>
        slide.blocks?.some(b => b.id === topId) ||
        slide.allBlockIds?.includes(topId)
      )
      if (s) return s
    }

    // 5. 匹配备注块
    s = slides.find(slide => slide.noteBlocks?.some(b => b.id === aid || b.id === topId))
    if (s) return s

    // 5.5 启发式推断：若当前激活块具有三栏插槽属性 (col-1 / col-2 / col-3)，精准锁定三栏版式幻灯片
    const currentSlot = context.activeBlockAttrs?.[ATTR_ELEM_SLOT]
    if (currentSlot && ["col-1", "col-2", "col-3"].includes(currentSlot)) {
      s = slides.find(slide =>
        slide.frontmatter?.layout === "three-cols-header" ||
        slide.blocks?.some(b => b.slot === "col-1" || b.slot === "col-2" || b.slot === "col-3")
      )
      if (s) return s
    }
  }

  // 6. 首选降级：若在第一个分页符前或单页演示，归属第一页
  return slides[0] || null
}
