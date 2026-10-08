/**
 * 文档编译调度器
 *
 * 解决两个既有问题（大文档切换时内核 CPU 飙升的直接成因）：
 * 1. 并发叠加：此前 ws-main 事务流每 150ms 防抖后即发起编译，但**不校验上一次编译是否已结束**，
 *    持续编辑时多个全量编译重叠排队，内核请求量成倍增长。
 * 2. 过期结果回写：切换文档后，先前文档的编译结果返回时仍会覆盖 latestCompiledDoc 与配置面板。
 *
 * 本调度器保证同一时刻只有一次编译在跑，期间到达的请求合并为"最新文档胜出"的 pending，
 * 并用代际号丢弃过期结果。
 */
export class CompileScheduler {
  private inFlightDocId: string | null = null
  private pendingDocId: string | null = null
  private generation = 0

  /** 当前是否有编译在执行 */
  public get isRunning(): boolean {
    return this.inFlightDocId !== null
  }

  /** 正在执行的文档 id */
  public get runningDocId(): string | null {
    return this.inFlightDocId
  }

  /** 被合并等待补跑的文档 id */
  public get pending(): string | null {
    return this.pendingDocId
  }

  /**
   * 尝试启动一次编译
   * 返回代际号表示可以启动；返回 null 表示已有编译在执行，本次请求已合并为 pending
   */
  public tryBegin(docId: string): number | null {
    if (this.inFlightDocId !== null) {
      this.pendingDocId = docId
      return null
    }
    this.inFlightDocId = docId
    return ++this.generation
  }

  /** 结果是否已过期（期间有更新的编译请求被接受） */
  public isStale(generation: number): boolean {
    return generation !== this.generation
  }

  /**
   * 结束当前编译，返回需要补跑的文档 id（无则 null）
   */
  public finish(): string | null {
    this.inFlightDocId = null
    const next = this.pendingDocId
    this.pendingDocId = null
    return next
  }

  public reset(): void {
    this.inFlightDocId = null
    this.pendingDocId = null
    this.generation = 0
  }
}
