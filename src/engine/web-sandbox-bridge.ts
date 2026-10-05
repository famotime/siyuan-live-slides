import type {
  IHostToSlidevMessage,
  ISlidevToHostMessage,
  THostToSlidevAction,
  TSlidevToHostAction,
} from "../types/ipc-messages"
import type { ISlidevPluginConfig, ISlidevVirtualPage } from "../types/slidev-protocol"

export type TSlideChangedHandler = (currentPage: number, totalPages: number, currentBlockId: string) => void
export type TBlockClickedHandler = (clickedBlockId: string, currentPage: number) => void
export type TOpenInEditorHandler = (blockId: string, currentPage: number) => void
export type TClientReadyHandler = () => void

export interface IOpenPeekDrawerDetail {
  peekType: "siyuan" | "web"
  target: string
  title?: string
}

export type TOpenPeekDrawerHandler = (detail: IOpenPeekDrawerDetail) => void

export class WebSandboxBridge {
  private iframe: HTMLIFrameElement | null = null
  private isReady = false
  private pendingMessages: IHostToSlidevMessage[] = []

  private slideChangedHandlers: TSlideChangedHandler[] = []
  private blockClickedHandlers: TBlockClickedHandler[] = []
  private openInEditorHandlers: TOpenInEditorHandler[] = []
  private clientReadyHandlers: TClientReadyHandler[] = []
  private openPeekDrawerHandlers: TOpenPeekDrawerHandler[] = []
  private toggleFullscreenHandlers: (() => void)[] = []

  constructor() {
    this.handleWindowMessage = this.handleWindowMessage.bind(this)
  }

  /**
   * 绑定 iframe 元素并开启事件监听
   */
  public attach(iframe: HTMLIFrameElement): void {
    this.detach()
    this.iframe = iframe
    this.isReady = false
    if (typeof window !== "undefined") {
      window.addEventListener("message", this.handleWindowMessage)
    }
  }

  /**
   * 解绑与清理
   */
  public detach(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("message", this.handleWindowMessage)
    }
    this.iframe = null
    this.isReady = false
    this.pendingMessages = []
  }

  /**
   * 宿主向沙箱发送消息
   */
  public postMessage(action: THostToSlidevAction, payload: IHostToSlidevMessage["payload"]): void {
    const message: IHostToSlidevMessage = {
      source: "siyuan-slidev-host",
      action,
      payload,
    }

    if (!this.iframe?.contentWindow || !this.isReady) {
      this.pendingMessages.push(message)
      return
    }

    try {
      this.iframe.contentWindow.postMessage(message, "*")
    } catch (e) {
      console.warn("[WebSandboxBridge] postMessage error:", e)
    }
  }

  /**
   * 推送最新幻灯片集合与全局配置
   */
  public updateSlides(
    slides: ISlidevVirtualPage[],
    config?: ISlidevPluginConfig,
    fullMarkdown?: string,
    customThemeCss?: string,
  ): void {
    this.postMessage("UPDATE_SLIDES", {
      slides,
      config,
      fullMarkdown,
      customThemeCss,
    })
  }

  /**
   * 请求跳转至指定页码
   */
  public navigatePage(pageIndex: number): void {
    this.postMessage("NAVIGATE_PAGE", { pageIndex })
  }

  /**
   * 请求高亮指定思源块
   */
  public highlightElement(targetBlockId: string): void {
    this.postMessage("HIGHLIGHT_ELEMENT", { targetBlockId })
  }

  /**
   * 请求下一步进或下一页 (v-click Step / Slide)
   */
  public nextStep(): void {
    this.postMessage("NEXT_STEP", {})
  }

  /**
   * 请求上一步进或上一页 (v-click Step / Slide)
   */
  public prevStep(): void {
    this.postMessage("PREV_STEP", {})
  }

  /**
   * 冻结或解冻幻灯片沙箱键盘翻页导航
   */
  public freezeKeyboardNav(frozen: boolean): void {
    this.postMessage("FREEZE_KEYBOARD_NAV", { frozen })
  }

  public onSlideChanged(handler: TSlideChangedHandler): () => void {
    this.slideChangedHandlers.push(handler)
    return () => {
      this.slideChangedHandlers = this.slideChangedHandlers.filter(h => h !== handler)
    }
  }

  public onBlockClicked(handler: TBlockClickedHandler): () => void {
    this.blockClickedHandlers.push(handler)
    return () => {
      this.blockClickedHandlers = this.blockClickedHandlers.filter(h => h !== handler)
    }
  }

  public onOpenInEditor(handler: TOpenInEditorHandler): () => void {
    this.openInEditorHandlers.push(handler)
    return () => {
      this.openInEditorHandlers = this.openInEditorHandlers.filter(h => h !== handler)
    }
  }

  public onOpenPeekDrawer(handler: TOpenPeekDrawerHandler): () => void {
    this.openPeekDrawerHandlers.push(handler)
    return () => {
      this.openPeekDrawerHandlers = this.openPeekDrawerHandlers.filter(h => h !== handler)
    }
  }

  public onRequestToggleFullscreen(handler: () => void): () => void {
    this.toggleFullscreenHandlers.push(handler)
    return () => {
      this.toggleFullscreenHandlers = this.toggleFullscreenHandlers.filter(h => h !== handler)
    }
  }

  public onClientReady(handler: TClientReadyHandler): () => void {
    this.clientReadyHandlers.push(handler)
    return () => {
      this.clientReadyHandlers = this.clientReadyHandlers.filter(h => h !== handler)
    }
  }

  /**
   * 监听并处理沙箱返回的 postMessage 消息
   */
  private handleWindowMessage(event: MessageEvent): void {
    const data = event.data as ISlidevToHostMessage
    if (!data || data.source !== "siyuan-slidev-client") {
      return
    }

    switch (data.action) {
      case "CLIENT_READY":
        this.isReady = true
        // 冲刷积压的消息队列
        while (this.pendingMessages.length > 0) {
          const msg = this.pendingMessages.shift()
          if (msg && this.iframe?.contentWindow) {
            this.iframe.contentWindow.postMessage(msg, "*")
          }
        }
        for (const handler of this.clientReadyHandlers) {
          handler()
        }
        break

      case "SLIDE_CHANGED":
        if (data.payload.currentPage !== undefined) {
          for (const handler of this.slideChangedHandlers) {
            handler(
              data.payload.currentPage,
              data.payload.totalPages || 1,
              data.payload.currentBlockId || "",
            )
          }
        }
        break

      case "BLOCK_CLICKED":
        if (data.payload.clickedBlockId) {
          for (const handler of this.blockClickedHandlers) {
            handler(data.payload.clickedBlockId, data.payload.currentPage || 1)
          }
        }
        break

      case "OPEN_IN_EDITOR":
        if (data.payload.blockId || data.payload.clickedBlockId) {
          const targetBlockId = data.payload.blockId || data.payload.clickedBlockId || ""
          for (const handler of this.openInEditorHandlers) {
            handler(targetBlockId, data.payload.currentPage || 1)
          }
        }
        break

      case "OPEN_PEEK_DRAWER":
        if (data.payload.peekType) {
          const target = data.payload.blockId || data.payload.url || ""
          const detail: IOpenPeekDrawerDetail = {
            peekType: data.payload.peekType,
            target,
            title: data.payload.title,
          }
          for (const handler of this.openPeekDrawerHandlers) {
            handler(detail)
          }
        }
        break

      case "REQUEST_TOGGLE_FULLSCREEN":
        for (const handler of this.toggleFullscreenHandlers) {
          handler()
        }
        break
    }
  }
}
