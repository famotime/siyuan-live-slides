/**
 * 自动编译消费者门闩
 *
 * 编辑器事件（ws-main 事务流、文档切换）驱动的自动编译，只有在至少存在一个**真实可见**的
 * 消费者（下方分屏预览页签 / 右侧演示配置 Dock）时才有意义。
 * 消费者全部关闭或不可见（页签切到后台、Dock 折叠、宿主窗口最小化）时，自动编译只登记脏文档 id，
 * 不再向内核发起任何请求——这是内核 CPU 占用飙升的主要来源。
 *
 * 可见性判定刻意采用 IntersectionObserver 异步上报（回调内更新布尔缓存），
 * 避免在每次内核事务上调用 getClientRects() 强制同步布局——编辑器敲字时 DOM 处于脏状态，
 * 同步布局在大文档下开销极高，反而会放大卡顿。
 */

export type TCompileConsumerKind = "preview" | "dock"

/** 消费者宿主（插件实例）在消费者重新可见时补跑积压编译 */
export interface ICompileConsumerHost {
  flushDirtyCompile?: () => void
}

interface IConsumerRecord {
  kind: TCompileConsumerKind
  element: HTMLElement
  /** 缓存的可见性（由 IntersectionObserver 异步更新，读取时不触发布局） */
  visible: boolean
  /** 无 IntersectionObserver 时的降级模式：读取时按布局盒实时测量 */
  measureOnDemand: boolean
  observer: IntersectionObserver | null
  onVisible?: () => void
}

/**
 * 元素是否真实可见：已挂载 + 拥有布局盒
 * display:none（后台页签 / 折叠 Dock 使用思源的 .fn__none）、脱离文档的节点均判为不可见
 */
export function isElementVisible(el: HTMLElement | null | undefined): boolean {
  if (!el) return false
  if (typeof el.isConnected === "boolean" && !el.isConnected) return false
  if (typeof el.getClientRects === "function" && el.getClientRects().length > 0) return true
  // 兜底：部分容器（如 fixed 定位的 Dock）矩形测量异常时用尺寸判定
  return typeof el.offsetWidth === "number" && el.offsetWidth > 0 && el.offsetHeight > 0
}

function getIntersectionObserver(): typeof IntersectionObserver | undefined {
  const ctor = typeof globalThis !== "undefined" ? (globalThis as any).IntersectionObserver : undefined
  return typeof ctor === "function" ? ctor : undefined
}

export class CompileConsumerGate {
  private consumers = new Map<number, IConsumerRecord>()
  private seq = 0

  /**
   * 注册一个消费者，返回注销函数
   *
   * @param onVisible 消费者由不可见转为可见时回调（用于补跑积压的脏文档编译）
   */
  public register(
    kind: TCompileConsumerKind,
    element: HTMLElement,
    onVisible?: () => void,
  ): () => void {
    if (!element) {
      return () => {}
    }
    const id = ++this.seq
    const ObserverCtor = getIntersectionObserver()
    const record: IConsumerRecord = {
      kind,
      element,
      visible: false,
      measureOnDemand: !ObserverCtor,
      observer: null,
      onVisible,
    }

    if (ObserverCtor) {
      // 异步上报：初次回调会同步首帧真实状态，无需在此处强制布局
      record.observer = new ObserverCtor((entries) => {
        const entry = entries[entries.length - 1]
        if (!entry) return
        const becameVisible = entry.isIntersecting && !record.visible
        record.visible = entry.isIntersecting
        if (becameVisible) {
          record.onVisible?.()
        }
      })
      record.observer.observe(element)
    } else {
      record.visible = isElementVisible(element)
    }

    this.consumers.set(id, record)
    return () => {
      record.observer?.disconnect()
      this.consumers.delete(id)
    }
  }

  public clear(): void {
    for (const record of this.consumers.values()) {
      record.observer?.disconnect()
    }
    this.consumers.clear()
  }

  public get size(): number {
    return this.consumers.size
  }

  /**
   * 是否存在可见消费者（纯缓存读取，不触发强制布局）
   * 宿主窗口整体不可见时同样视为无消费者，避免后台空转
   */
  public hasVisibleConsumer(): boolean {
    if (this.consumers.size === 0) {
      return false
    }
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return false
    }
    for (const record of this.consumers.values()) {
      if (record.measureOnDemand ? isElementVisible(record.element) : record.visible) {
        return true
      }
    }
    return false
  }
}

export const globalCompileConsumerGate = new CompileConsumerGate()
