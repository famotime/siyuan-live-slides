export class CliDevServerBridge {
  private devServerUrl = "http://localhost:3030"
  private isConnected = false

  constructor(defaultUrl?: string) {
    if (defaultUrl) {
      this.devServerUrl = defaultUrl
    }
  }

  public getUrl(): string {
    return this.devServerUrl
  }

  public setUrl(url: string): void {
    this.devServerUrl = url.replace(/\/+$/, "")
  }

  public isServerConnected(): boolean {
    return this.isConnected
  }

  /**
   * 探测本地 Slidev CLI DevServer 是否处于运行状态
   */
  public async probeServer(timeoutMs = 1500): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const res = await fetch(this.devServerUrl, {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal,
      }).catch(() => null)

      clearTimeout(timer)
      this.isConnected = Boolean(res)
      return this.isConnected
    } catch {
      this.isConnected = false
      return false
    }
  }
}
