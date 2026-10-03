import type { WebSandboxBridge } from "../engine/web-sandbox-bridge"
import type { ISlidevVirtualPage } from "../types/slidev-protocol"
import { DebounceController } from "./debounce-controller"

export class CursorTracker {
  private blockToPageMap = new Map<string, number>()
  private debounceCtrl = new DebounceController()
  private activeBlockId = ""
  private activePageIndex = 1
  private bridge: WebSandboxBridge | null = null

  constructor(bridge?: WebSandboxBridge) {
    if (bridge) {
      this.bridge = bridge
    }
  }

  public setBridge(bridge: WebSandboxBridge): void {
    this.bridge = bridge
  }

  /**
   * 重建 Block ID 到 Page Index (1-based) 的映射索引字典
   */
  public updateSlidesIndex(slides: ISlidevVirtualPage[]): void {
    this.blockToPageMap.clear()

    for (const slide of slides) {
      if (slide.startBlockId) {
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
    const targetPage = this.getPageByBlockId(blockId)
    if (!targetPage) {
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

  public getActivePageIndex(): number {
    return this.activePageIndex
  }

  public destroy(): void {
    this.debounceCtrl.cancelAll()
    this.blockToPageMap.clear()
    this.bridge = null
  }
}
