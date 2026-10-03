export interface ISlidevNavState {
  no: number
  clicks: number
  hasNext?: boolean
  hasPrev?: boolean
  total?: number
}

export type TSlidevPageChangedHandler = (pageNo: number, total: number, navState: ISlidevNavState) => void
export type TSlidevReadyHandler = () => void

/**
 * 官方 Slidev 原生标准通信协议适配桥接器 (基于 ?embedded=true postMessage 规范)
 */
export class NativeSlidevBridge {
  private iframe: HTMLIFrameElement | null = null
  private isReady = false
  private pageChangedHandlers: TSlidevPageChangedHandler[] = []
  private readyHandlers: TSlidevReadyHandler[] = []
  private currentState: ISlidevNavState = { no: 1, clicks: 0, total: 1 }

  constructor() {
    this.handleWindowMessage = this.handleWindowMessage.bind(this)
  }

  public getCurrentState(): ISlidevNavState {
    return { ...this.currentState }
  }

  public attach(iframe: HTMLIFrameElement): void {
    this.detach()
    this.iframe = iframe
    this.isReady = false
    if (typeof window !== "undefined") {
      window.addEventListener("message", this.handleWindowMessage)
    }
  }

  public detach(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("message", this.handleWindowMessage)
    }
    this.iframe = null
    this.isReady = false
  }

  /**
   * 向 Slidev 官方 iframe 发送指令
   */
  public postMessage(type: string, payload?: Record<string, any>): void {
    if (!this.iframe?.contentWindow) return
    const msg = {
      target: "slidev",
      sender: "siyuan",
      type,
      ...payload,
    }
    try {
      this.iframe.contentWindow.postMessage(msg, "*")
    } catch (e) {
      console.warn("[NativeSlidevBridge] postMessage error:", e)
    }
  }

  /**
   * 跳转到指定页码
   */
  public navigateToPage(pageNo: number): void {
    this.postMessage("navigate", { no: pageNo })
  }

  /**
   * 下一动效或下一页
   */
  public next(): void {
    this.postMessage("next")
  }

  /**
   * 上一动效或上一页
   */
  public prev(): void {
    this.postMessage("prev")
  }

  /**
   * 下一步进
   */
  public nextClick(): void {
    this.postMessage("next-click")
  }

  /**
   * 上一步进
   */
  public prevClick(): void {
    this.postMessage("prev-click")
  }

  public onPageChanged(handler: TSlidevPageChangedHandler): () => void {
    this.pageChangedHandlers.push(handler)
    return () => {
      this.pageChangedHandlers = this.pageChangedHandlers.filter(h => h !== handler)
    }
  }

  public onReady(handler: TSlidevReadyHandler): () => void {
    this.readyHandlers.push(handler)
    return () => {
      this.readyHandlers = this.readyHandlers.filter(h => h !== handler)
    }
  }

  /**
   * 监听来自 Slidev 官方客户端回传的 postMessage
   */
  private handleWindowMessage(event: MessageEvent): void {
    const data = event.data
    if (!data || data.target !== "slidev") {
      return
    }

    if (!this.isReady) {
      this.isReady = true
      for (const handler of this.readyHandlers) {
        handler()
      }
    }

    if (data.type === "update-state" && data.navState) {
      const nav = data.navState as ISlidevNavState
      this.currentState = {
        no: nav.no ?? this.currentState.no,
        clicks: nav.clicks ?? this.currentState.clicks,
        total: nav.total ?? this.currentState.total,
        hasNext: nav.hasNext,
        hasPrev: nav.hasPrev,
      }
      for (const handler of this.pageChangedHandlers) {
        handler(this.currentState.no, this.currentState.total || 1, this.currentState)
      }
    } else if (data.type === "navigate" && typeof data.no === "number") {
      this.currentState.no = data.no
      for (const handler of this.pageChangedHandlers) {
        handler(data.no, this.currentState.total || 1, this.currentState)
      }
    }
  }
}
