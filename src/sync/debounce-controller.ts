/**
 * 弹性防抖控制器
 * 支持不同管道独立防抖，并支持即时冲刷 (flush) 与取消 (cancel)
 */
export class DebounceController {
  private timers = new Map<string, any>()

  /**
   * 调度防抖任务
   * @param key 标识管道名称
   * @param fn 执行回调
   * @param delay 防抖延迟毫秒数 (默认 150ms)
   */
  public debounce(key: string, fn: () => void, delay = 150): void {
    this.cancel(key)
    const timer = setTimeout(() => {
      this.timers.delete(key)
      fn()
    }, delay)
    this.timers.set(key, timer)
  }

  /**
   * 取消指定任务
   */
  public cancel(key: string): void {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
      this.timers.delete(key)
    }
  }

  /**
   * 取消所有任务
   */
  public cancelAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }

  /**
   * 是否存在挂起的任务
   */
  public hasPending(key: string): boolean {
    return this.timers.has(key)
  }
}
