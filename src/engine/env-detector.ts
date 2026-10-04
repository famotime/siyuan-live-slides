export interface INativeEnvStatus {
  hasNode: boolean
  nodeVersion?: string
  hasSlidevCli: boolean
  slidevVersion?: string
  platform: string
  isDesktop: boolean
  error?: string
}

export type TCommandRunner = (command: string, args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>

/**
 * 跨平台环境探测器：检测宿主系统是否具备拉起官方 Slidev CLI 的前置条件
 */
export class NativeEnvDetector {
  private runner: TCommandRunner

  constructor(customRunner?: TCommandRunner) {
    this.runner = customRunner || NativeEnvDetector.defaultRunner
  }

  /**
   * 默认通过 Node.js child_process 执行（在 Electron 环境或 Node 单元测试环境有效）
   */
  private static async defaultRunner(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    try {
      // 动态导入 node:child_process，避免在纯浏览器移动端静态解析失败
      const { execFile } = await import("node:child_process")
      const isWin = typeof process !== "undefined" && process.platform === "win32"
      return await new Promise((resolve) => {
        execFile(command, args, { timeout: 5000, shell: isWin }, (error, stdout, stderr) => {
          resolve({
            code: error ? (error as any).code || 1 : 0,
            stdout: stdout ? stdout.trim() : "",
            stderr: stderr ? stderr.trim() : "",
          })
        })
      })
    } catch (e: any) {
      return { code: -1, stdout: "", stderr: String(e) }
    }
  }

  /**
   * 检测宿主系统环境是否支持官方 Slidev Pro 模式
   */
  public async detect(): Promise<INativeEnvStatus> {
    const isDesktop = typeof process !== "undefined" && Boolean(process.versions?.node)
    const platform = typeof process !== "undefined" ? process.platform : "web"

    if (!isDesktop) {
      return {
        hasNode: false,
        hasSlidevCli: false,
        platform: "browser",
        isDesktop: false,
        error: "当前处于纯前端浏览器或移动端环境，无 Node.js 运行时支撑",
      }
    }

    let hasNode = false
    let nodeVersion: string | undefined
    let hasSlidevCli = false
    let slidevVersion: string | undefined

    // 1. 探测 Node.js
    try {
      const nodeRes = await this.runner("node", ["-v"])
      if (nodeRes.code === 0 && nodeRes.stdout.startsWith("v")) {
        hasNode = true
        nodeVersion = nodeRes.stdout
      }
    } catch {}

    // 2. 探测 Slidev CLI
    if (hasNode) {
      // 优先探测全局安装的 slidev 命令（速度极快且稳定）
      try {
        const directCmd = platform === "win32" ? "slidev.cmd" : "slidev"
        const slidevDirectRes = await this.runner(directCmd, ["--version"])
        if (slidevDirectRes.code === 0 && slidevDirectRes.stdout) {
          hasSlidevCli = true
          slidevVersion = slidevDirectRes.stdout
        }
      } catch {}

      // 若未检测到全局 slidev，降级探测 npx @slidev/cli
      if (!hasSlidevCli) {
        try {
          const npxCmd = platform === "win32" ? "npx.cmd" : "npx"
          const slidevRes = await this.runner(npxCmd, ["@slidev/cli", "--version"])
          if (slidevRes.code === 0 && slidevRes.stdout) {
            hasSlidevCli = true
            slidevVersion = slidevRes.stdout
          }
        } catch {}
      }
    }

    return {
      hasNode,
      nodeVersion,
      hasSlidevCli,
      slidevVersion,
      platform,
      isDesktop,
    }
  }
}
