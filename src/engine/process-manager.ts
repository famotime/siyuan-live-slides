import {
  getMergedSystemEnv,
  getPlatform,
  getRuntimeModule,
  resolvePhysicalPath,
} from "./runtime-node"

export interface IProcessManagerOptions {
  defaultPort?: number
  maxPortRetries?: number
  probeTimeoutMs?: number
  customSpawner?: (cmd: string, args: string[], options: any) => IChildProcessMock
  customPortChecker?: (port: number) => Promise<boolean>
}

export interface IChildProcessMock {
  pid?: number
  kill: (signal?: any) => boolean | void
  on?: (event: string, listener: (...args: any[]) => void) => any
  stdout?: any
  stderr?: any
}

export class NativeSlidevProcessManager {
  private childProcess: IChildProcessMock | null = null
  private activePort: number | null = null
  private isRunning = false
  private defaultPort: number
  private maxPortRetries: number
  private probeTimeoutMs: number
  private customSpawner?: (cmd: string, args: string[], options: any) => IChildProcessMock
  private customPortChecker?: (port: number) => Promise<boolean>

  constructor(options?: IProcessManagerOptions) {
    this.defaultPort = options?.defaultPort || 3030
    this.maxPortRetries = options?.maxPortRetries || 20
    this.probeTimeoutMs = options?.probeTimeoutMs || 10000
    this.customSpawner = options?.customSpawner
    this.customPortChecker = options?.customPortChecker
  }

  public getActivePort(): number | null {
    return this.activePort
  }

  public getIsRunning(): boolean {
    return this.isRunning
  }

  /**
   * 检查指定端口是否处于可用状态（未被占用）
   */
  public async isPortAvailable(port: number): Promise<boolean> {
    if (this.customPortChecker) {
      return this.customPortChecker(port)
    }

    try {
      let netMod: any = getRuntimeModule("net")
      if (!netMod) {
        netMod = await import("node:net").catch(() => ({}))
      }
      if (!netMod?.createServer) {
        return true
      }
      return await new Promise((resolve) => {
        const server = netMod.createServer()
        server.once("error", () => resolve(false))
        server.once("listening", () => {
          server.close(() => resolve(true))
        })
        server.listen(port, "127.0.0.1")
      })
    } catch {
      return true
    }
  }

  /**
   * 在预定端口区间中动态寻找可用端口
   */
  public async allocPort(startPort?: number): Promise<number> {
    const base = startPort || this.defaultPort
    for (let i = 0; i < this.maxPortRetries; i++) {
      const port = base + i
      const available = await this.isPortAvailable(port)
      if (available) {
        return port
      }
    }
    return base
  }

  /**
   * 轮询检测指定地址的 Slidev DevServer 是否就绪
   */
  public async pollServerReady(url: string, timeoutMs = 8000, intervalMs = 300): Promise<boolean> {
    const startTime = Date.now()
    while (Date.now() - startTime < timeoutMs) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), intervalMs)
        const res = await fetch(url, {
          method: "HEAD",
          mode: "no-cors",
          signal: controller.signal,
        }).catch(() => null)
        clearTimeout(timer)
        if (res) {
          return true
        }
      } catch {}
      await new Promise(r => setTimeout(r, intervalMs))
    }
    return false
  }

  /**
   * 启动官方 Slidev 进程
   */
  public async startServer(
    slidesFilePath: string,
    targetPort?: number,
  ): Promise<{ success: boolean; port: number; url: string; error?: string }> {
    if (this.isRunning && this.activePort) {
      return {
        success: true,
        port: this.activePort,
        url: `http://localhost:${this.activePort}?embedded=true`,
      }
    }

    const port = await this.allocPort(targetPort)
    this.activePort = port

    const isWin = getPlatform() === "win32"
    const cmd = isWin ? "npx.cmd" : "npx"
    const resolvedPath = resolvePhysicalPath(slidesFilePath)
    const args = ["@slidev/cli", resolvedPath, "--port", String(port), "--no-open"]

    try {
      if (this.customSpawner) {
        this.childProcess = this.customSpawner(cmd, args, { detached: false })
      } else {
        let spawnFn: any = getRuntimeModule("child_process")?.spawn
        if (!spawnFn) {
          const cp = await import("node:child_process").catch(() => ({})) as any
          spawnFn = cp?.spawn
        }
        if (!spawnFn) {
          throw new Error("child_process spawn not available in current runtime")
        }

        const cwd = resolvedPath.includes("/") || resolvedPath.includes("\\")
          ? resolvedPath.replace(/[/\\][^/\\]+$/, "")
          : undefined

        const env = getMergedSystemEnv()
        this.childProcess = spawnFn(cmd, args, {
          cwd,
          detached: false,
          shell: true,
          env: { ...env, FORCE_COLOR: "1" },
        })
      }

      this.isRunning = true

      // 绑定异常退出
      if (this.childProcess?.on) {
        this.childProcess.on("exit", () => {
          this.isRunning = false
          this.activePort = null
          this.childProcess = null
        })
      }

      const serverUrl = `http://localhost:${port}`
      // 探活（如果为测试注入的 spawner，立即返回成功）
      if (!this.customSpawner) {
        const ready = await this.pollServerReady(serverUrl, this.probeTimeoutMs)
        if (!ready) {
          this.stopServer()
          return {
            success: false,
            port,
            url: "",
            error: `Slidev DevServer 启动超时 (未在 ${this.probeTimeoutMs}ms 内响应端口 ${port})`,
          }
        }
      }

      return {
        success: true,
        port,
        url: `${serverUrl}?embedded=true`,
      }
    } catch (e: any) {
      this.stopServer()
      return {
        success: false,
        port,
        url: "",
        error: `唤起 Slidev 进程失败: ${String(e)}`,
      }
    }
  }

  /**
   * 优雅安全终止 Slidev 进程
   */
  public stopServer(): void {
    if (this.childProcess) {
      try {
        this.childProcess.kill("SIGTERM")
        const isWin = getPlatform() === "win32"
        if (isWin && this.childProcess.pid && !this.customSpawner) {
          const execFn = getRuntimeModule("child_process")?.exec
          if (execFn) {
            execFn(`taskkill /pid ${this.childProcess.pid} /T /F`, () => {})
          } else {
            import("node:child_process").then(({ exec }) => {
              exec(`taskkill /pid ${this.childProcess?.pid} /T /F`, () => {})
            }).catch(() => {})
          }
        }
      } catch {}
      this.childProcess = null
    }
    this.isRunning = false
    this.activePort = null
  }
}
