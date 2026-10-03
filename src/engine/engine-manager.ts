import type { ISlidevDocument } from "../types/slidev-protocol"
import { CliDevServerBridge } from "./cli-devserver-bridge"
import { NativeEnvDetector } from "./env-detector"
import { NativeSlidevBridge } from "./native-slidev-bridge"
import { NativeSlidevProcessManager } from "./process-manager"
import { WebSandboxBridge } from "./web-sandbox-bridge"
import { WorkspaceScaffolder } from "./workspace-scaffolder"

export type TEngineMode = "web-sandbox" | "pro-cli"

export interface IProModeStartResult {
  success: boolean
  url: string
  port?: number
  error?: string
}

/**
 * 双轨演示引擎总调度器 (EngineManager)
 * 统一调度内置高保真沙箱 (Web Sandbox) 与官方原生 Pro 引擎 (Native Pro)
 */
export class EngineManager {
  private mode: TEngineMode = "web-sandbox"
  public readonly webBridge: WebSandboxBridge
  public readonly cliBridge: CliDevServerBridge
  public readonly nativeBridge: NativeSlidevBridge
  public readonly processManager: NativeSlidevProcessManager
  public readonly scaffolder: WorkspaceScaffolder
  public readonly envDetector: NativeEnvDetector

  constructor() {
    this.webBridge = new WebSandboxBridge()
    this.cliBridge = new CliDevServerBridge()
    this.nativeBridge = new NativeSlidevBridge()
    this.processManager = new NativeSlidevProcessManager()
    this.scaffolder = new WorkspaceScaffolder()
    this.envDetector = new NativeEnvDetector()
  }

  public getMode(): TEngineMode {
    return this.mode
  }

  public setMode(mode: TEngineMode): void {
    this.mode = mode
  }

  /**
   * 启动官方 Pro 模式：自动编排临时工程与拉起子进程服务
   */
  public async startProMode(
    doc: ISlidevDocument,
    putFileFn?: (path: string, isDir: boolean, file: any) => Promise<any>,
  ): Promise<IProModeStartResult> {
    // 1. 环境前置检测
    const env = await this.envDetector.detect()
    if (!env.hasNode) {
      return {
        success: false,
        url: "",
        error: "当前系统未检测到 Node.js 环境，无法拉起官方 Slidev CLI，建议继续使用内置高保真引擎",
      }
    }

    // 2. 编排工作空间
    const scaffoldRes = await this.scaffolder.scaffold(doc, putFileFn)
    if (!scaffoldRes.success) {
      return {
        success: false,
        url: "",
        error: `初始化 Slidev 临时工作空间失败: ${scaffoldRes.error}`,
      }
    }

    // 3. 启动进程
    const startRes = await this.processManager.startServer(scaffoldRes.slidesPath)
    if (!startRes.success) {
      return {
        success: false,
        url: "",
        error: startRes.error,
      }
    }

    this.mode = "pro-cli"
    return {
      success: true,
      url: startRes.url,
      port: startRes.port,
    }
  }

  /**
   * 停止官方 Pro 模式，优雅切换回内置沙箱
   */
  public stopProMode(): void {
    this.processManager.stopServer()
    this.mode = "web-sandbox"
  }

  /**
   * 销毁所有桥接器与后台子进程
   */
  public destroy(): void {
    this.webBridge.detach()
    this.nativeBridge.detach()
    this.processManager.stopServer()
  }
}
