/**
 * 编译调度器有限状态机枚举
 */
export type TCompileSchedulerState = "IDLE" | "COMPILING"

/**
 * 文档编译调度器 (显式有限状态机 + 脏文档批处理队列)
 *
 * 解决两个既有问题（大文档切换时内核 CPU 飙升的直接成因）：
 * 1. 并发叠加：此前 ws-main 事务流每 150ms 防抖后即发起编译，但**不校验上一次编译是否已结束**，
 *    持续编辑时多个全量编译重叠排队，内核请求量成倍增长。
 * 2. 过期结果回写：切换文档后，先前文档的编译结果返回时仍会覆盖 latestCompiledDoc 与配置面板。
 * 3. 脏标记覆盖遗失 (FSM-1 缺陷修复)：单键 pendingDocId 在高频切文档时会被覆盖导致旧脏文档永久不补跑，
 *    现升级为显式有限状态机 (IDLE <-> COMPILING) 与 Set 去重批处理队列。
 *
 * 本调度器保证同一时刻只有一次编译在跑，期间到达的全部请求安全进入待补跑集合，
 * 并用代际号丢弃过期结果。
 */
export class CompileScheduler {
  private state: TCompileSchedulerState = "IDLE"
  private inFlightDocId: string | null = null
  private pendingDocs = new Set<string>()
  private lastPendingDocId: string | null = null
  private generation = 0

  /** 当前状态 */
  public get currentState(): TCompileSchedulerState {
    return this.state
  }

  /** 当前是否有编译在执行 */
  public get isRunning(): boolean {
    return this.state === "COMPILING"
  }

  /** 正在执行的文档 id */
  public get runningDocId(): string | null {
    return this.inFlightDocId
  }

  /** 最近一次被合并等待补跑的文档 id（保持向下兼容） */
  public get pending(): string | null {
    return this.lastPendingDocId
  }

  /** 当前全部等待补跑的文档 id 列表 */
  public get pendingList(): string[] {
    return Array.from(this.pendingDocs)
  }

  /**
   * 尝试启动一次编译
   * 返回代际号表示可以启动；返回 null 表示已有编译在执行，本次请求已安全合并入待排程集合
   */
  public tryBegin(docId: string): number | null {
    if (this.state === "COMPILING" || this.inFlightDocId !== null) {
      this.pendingDocs.add(docId)
      this.lastPendingDocId = docId
      return null
    }
    this.state = "COMPILING"
    this.inFlightDocId = docId
    return ++this.generation
  }

  /** 结果是否已过期（期间有更新的编译请求被接受） */
  public isStale(generation: number): boolean {
    return generation !== this.generation
  }

  /**
   * 结束当前编译，返回全部需要补跑的文档 id 批次
   */
  public finishBatch(): string[] {
    this.state = "IDLE"
    this.inFlightDocId = null
    this.lastPendingDocId = null
    const batch = Array.from(this.pendingDocs)
    this.pendingDocs.clear()
    return batch
  }

  /**
   * 结束当前编译，返回需要补跑的文档 id（最新或单个，无则 null，保持单值 API 兼容）
   */
  public finish(): string | null {
    const batch = this.finishBatch()
    return batch.length > 0 ? batch[batch.length - 1] : null
  }

  public reset(): void {
    this.state = "IDLE"
    this.inFlightDocId = null
    this.pendingDocs.clear()
    this.lastPendingDocId = null
    this.generation = 0
  }
}
