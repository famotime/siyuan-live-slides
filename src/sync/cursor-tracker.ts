import type { WebSandboxBridge } from "../engine/web-sandbox-bridge"
import type { ISlidesVirtualPage } from "../types/slides-protocol"
import { isSlideHidden } from "../types/slides-protocol"
import { DebounceController } from "./debounce-controller"

interface IBlockPageMeta {
  visiblePageIndex: number | null
  rawPageIndex: number
  isHidden: boolean
  startBlockId?: string
}

export class CursorTracker {
  private blockToPageMap = new Map<string, IBlockPageMeta>()
  private debounceCtrl = new DebounceController()
  private activeBlockId = ""
  private activePageIndex = 1
  private currentDocId = ""
  private bridge: WebSandboxBridge | null = null

  constructor(bridge?: WebSandboxBridge) {
    if (bridge) {
      this.bridge = bridge
    }
  }

  public setBridge(bridge: WebSandboxBridge): void {
    this.bridge = bridge
  }

  public setDocId(docId: string): void {
    this.currentDocId = docId
    if (docId) {
      this.blockToPageMap.delete(docId)
    }
  }

  /**
   * 重建 Block ID 到页码与可见性的映射索引字典
   * 包含分页起始分割线、正文直接块以及 allBlockIds 中包含的所有深层嵌套子块（列表、超级块、分栏等）
   */
  public updateSlidesIndex(slides: ISlidesVirtualPage[]): void {
    this.blockToPageMap.clear()

    let visibleCounter = 0
    for (const slide of slides) {
      const hidden = isSlideHidden(slide)
      const visiblePageIndex = hidden ? null : ++visibleCounter
      const meta: IBlockPageMeta = {
        visiblePageIndex,
        rawPageIndex: slide.pageIndex,
        isHidden: hidden,
        startBlockId: slide.startBlockId,
      }

      if (slide.startBlockId && slide.startBlockId !== this.currentDocId) {
        this.blockToPageMap.set(slide.startBlockId, meta)
      }
      if (Array.isArray(slide.allBlockIds)) {
        for (const id of slide.allBlockIds) {
          if (id && id !== this.currentDocId) {
            this.blockToPageMap.set(id, meta)
          }
        }
      }
      for (const block of slide.blocks) {
        if (block?.id) {
          this.blockToPageMap.set(block.id, meta)
        }
      }
    }
  }

  /**
   * 查找块归属的可见页码（隐藏页返回 null）
   */
  public getPageByBlockId(blockId: string): number | null {
    return this.blockToPageMap.get(blockId)?.visiblePageIndex ?? null
  }

  /**
   * 响应编辑器光标移至某思源块
   * 采用 100ms 防抖，毫秒级平滑定位
   */
  public onCursorFocusBlock(blockId: string): void {
    if (!blockId || blockId === this.activeBlockId) {
      return
    }

    this.activeBlockId = blockId

    // 当光标移至文档根/标题时，不自动跳转页面（避免打断用户当前预览页码），仅供侧栏切换全局配置界面
    if (blockId === this.currentDocId) {
      this.debounceCtrl.cancel("cursor-navigate")
      return
    }

    const meta = this.blockToPageMap.get(blockId)
    if (!meta) {
      this.debounceCtrl.cancel("cursor-navigate")
      return
    }

    this.debounceCtrl.debounce("cursor-navigate", () => {
      if (meta.isHidden) {
        if (this.bridge) {
          this.bridge.showHiddenPlaceholder?.({
            pageIndex: meta.rawPageIndex,
            startBlockId: meta.startBlockId,
          })
        }
        return
      }
      if (meta.visiblePageIndex) {
        this.activePageIndex = meta.visiblePageIndex
        if (this.bridge) {
          this.bridge.showHiddenPlaceholder?.(null)
          this.bridge.navigatePage(meta.visiblePageIndex)
          this.bridge.highlightElement(blockId)
        }
      }
    }, 100)
  }

  public getActiveBlockId(): string {
    return this.activeBlockId
  }

  /**
   * 外部同步当前激活块 ID（如反向定位时），避免触发多余的重复光标跟随
   */
  public setActiveBlockId(blockId: string): void {
    this.activeBlockId = blockId
    if (!blockId) {
      this.debounceCtrl.cancel("cursor-navigate")
    }
    const page = this.getPageByBlockId(blockId)
    if (page) {
      this.activePageIndex = page
    }
  }

  public getActivePageIndex(): number {
    return this.activePageIndex
  }

  public destroy(): void {
    this.debounceCtrl.cancelAll()
    this.blockToPageMap.clear()
    this.bridge = null
  }
}
