import type { WebSandboxBridge } from "../engine/web-sandbox-bridge"
import type { ISlidesVirtualPage } from "../types/slides-protocol"
import { DebounceController } from "./debounce-controller"

export class CursorTracker {
  private blockToPageMap = new Map<string, number>()
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
   * 重建 Block ID 到 Page Index (1-based) 的映射索引字典
   */
  public updateSlidesIndex(slides: ISlidesVirtualPage[]): void {
    this.blockToPageMap.clear()

    for (const slide of slides) {
      if (slide.startBlockId && slide.startBlockId !== this.currentDocId) {
        this.blockToPageMap.set(slide.startBlockId, slide.pageIndex)
      }
      for (const block of slide.blocks) {
        this.blockToPageMap.set(block.id, slide.pageIndex)
      }
    }
  }

  /**
   * 查找块归属的页码
   */
  public getPageByBlockId(blockId: string): number | null {
    return this.blockToPageMap.get(blockId) ?? null
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

    const targetPage = this.getPageByBlockId(blockId)
    if (!targetPage) {
      this.debounceCtrl.cancel("cursor-navigate")
      return
    }

    this.debounceCtrl.debounce("cursor-navigate", () => {
      this.activePageIndex = targetPage
      if (this.bridge) {
        this.bridge.navigatePage(targetPage)
        this.bridge.highlightElement(blockId)
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
