import type { ISlidevDocument } from "../types/slidev-protocol"
import { CliDevServerBridge } from "./cli-devserver-bridge"
import { getRuntimeModule, resolvePhysicalPath } from "./runtime-node"

export interface IWorkspaceConfig {
  workspacePath: string
  slidesFileName?: string
}

export interface IScaffoldResult {
  success: boolean
  slidesPath: string
  physicalSlidesPath?: string
  packageJsonPath: string
  error?: string
}

/**
 * 官方 Slidev Pro 模式零配置临时工程自动编排器
 */
export class WorkspaceScaffolder {
  private workspacePath: string
  private slidesFileName: string
  private cliBridge = new CliDevServerBridge()

  constructor(config?: IWorkspaceConfig) {
    this.workspacePath = config?.workspacePath || "/data/storage/petal/siyuan-slidev/pro-workspace"
    this.slidesFileName = config?.slidesFileName || "slides.md"
  }

  public getWorkspacePath(): string {
    return this.workspacePath
  }

  public getSlidesPath(): string {
    return `${this.workspacePath}/${this.slidesFileName}`
  }

  /**
   * 生成最小化标准的 Slidev package.json 配置
   */
  public generatePackageJson(theme = "default"): string {
    const pkg = {
      name: "siyuan-slidev-pro-workspace",
      type: "module",
      private: true,
      scripts: {
        dev: "slidev --port 3030",
        build: "slidev build",
      },
      dependencies: {
        "@slidev/cli": "^53.0.0",
        "@slidev/theme-default": "latest",
      },
    }
    if (theme && theme !== "default") {
      (pkg.dependencies as any)[`@slidev/theme-${theme}`] = "latest"
    }
    return JSON.stringify(pkg, null, 2)
  }

  /**
   * 将当前思源演示文档编译为官方规范的 slides.md 文本
   */
  public buildSlidesMarkdown(doc: ISlidevDocument): string {
    return this.cliBridge.buildStandardSlidevMarkdown(doc)
  }

  /**
   * 编排并写入工作空间文件
   */
  public async scaffold(
    doc: ISlidevDocument,
    putFileFn?: (path: string, isDir: boolean, file: any) => Promise<any>,
  ): Promise<IScaffoldResult> {
    const slidesMd = this.buildSlidesMarkdown(doc)
    const pkgJson = this.generatePackageJson(doc.config.theme)
    const slidesPath = this.getSlidesPath()
    const pkgPath = `${this.workspacePath}/package.json`

    const physicalSlidesPath = resolvePhysicalPath(slidesPath)
    const physicalPkgPath = resolvePhysicalPath(pkgPath)

    // 物理文件系统落盘增强（确保 Node 子进程立即感知）
    const fsMod = getRuntimeModule("fs")
    const pathMod = getRuntimeModule("path")
    if (fsMod && pathMod && physicalSlidesPath !== slidesPath) {
      try {
        const dir = pathMod.dirname(physicalSlidesPath)
        if (!fsMod.existsSync(dir)) {
          fsMod.mkdirSync(dir, { recursive: true })
        }
        fsMod.writeFileSync(physicalPkgPath, pkgJson, "utf-8")
        fsMod.writeFileSync(physicalSlidesPath, slidesMd, "utf-8")
      } catch {}
    }

    if (putFileFn) {
      try {
        const slidesBlob = typeof Blob !== "undefined"
          ? new Blob([slidesMd], { type: "text/markdown;charset=utf-8" })
          : Buffer.from(slidesMd, "utf-8")
        const pkgBlob = typeof Blob !== "undefined"
          ? new Blob([pkgJson], { type: "application/json;charset=utf-8" })
          : Buffer.from(pkgJson, "utf-8")

        await putFileFn(pkgPath, false, pkgBlob)
        await putFileFn(slidesPath, false, slidesBlob)

        return {
          success: true,
          slidesPath,
          physicalSlidesPath,
          packageJsonPath: pkgPath,
        }
      } catch (err: any) {
        return {
          success: false,
          slidesPath,
          physicalSlidesPath,
          packageJsonPath: pkgPath,
          error: String(err),
        }
      }
    }

    return {
      success: true,
      slidesPath,
      physicalSlidesPath,
      packageJsonPath: pkgPath,
    }
  }
}
