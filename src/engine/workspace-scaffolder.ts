import type { ISlidevDocument } from "../types/slidev-protocol"
import { CliDevServerBridge } from "./cli-devserver-bridge"
import { getDefaultProWorkspaceDir, getRuntimeModule, resolvePhysicalPath } from "./runtime-node"

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

export const DEFAULT_STARTER_SNIPPETS: Record<string, string> = {
  "snippets/external.ts": `// Inside ./snippets/external.ts
// #region snippet
export function emptyArray<T>(length: number) {
  return Array.from<T>({ length })
}
// #endregion snippet

export function sayHello() {
  console.log('Hello from snippets/external.ts')
}
`,
}

export const THREE_COLS_HEADER_LAYOUT_VUE = `<template>
  <div class="slidev-layout three-cols-header w-full h-full flex flex-col">
    <div class="header-section mb-4 w-full">
      <slot />
    </div>
    <div class="grid grid-cols-3 gap-6 flex-1 items-start">
      <div class="col-1 min-w-0">
        <slot name="col-1" />
      </div>
      <div class="col-2 min-w-0">
        <slot name="col-2" />
      </div>
      <div class="col-3 min-w-0">
        <slot name="col-3" />
      </div>
    </div>
  </div>
</template>
`

/**
 * 从 Markdown 中提取所有引用的代码切片文件相对路径
 * 匹配格式: <<< @/snippets/external.ts#snippet 或 <<< ./snippets/foo.ts 或 <<< snippets/bar.js
 */
export function extractSnippetPaths(markdown: string): string[] {
  const paths: string[] = []
  const regex = /^[ \t]*<<<[ \t]+(?:@\/|\.\/|)([^\s#]+)(?:#[^\s]+)?/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(markdown)) !== null) {
    const rawPath = match[1]?.trim()
    if (rawPath && !paths.includes(rawPath)) {
      paths.push(rawPath)
    }
  }
  return paths
}

/**
 * 官方 Slidev Pro 模式零配置临时工程自动编排器
 */
export class WorkspaceScaffolder {
  private workspacePath: string
  private slidesFileName: string
  private cliBridge = new CliDevServerBridge()

  constructor(config?: IWorkspaceConfig) {
    const defaultDir = getDefaultProWorkspaceDir()
    // 若未指定或传入了旧版的 /data/ 内部路径，一律迁移到安全的系统独立目录
    if (!config?.workspacePath || config.workspacePath.includes("/data/storage/petal/siyuan-slidev/pro-workspace")) {
      this.workspacePath = defaultDir
    } else {
      this.workspacePath = config.workspacePath
    }
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

    // 编排 snippets 切片文件集合（防止 Slidev 官方 unplugin-vue-markdown 编译切片时报错路径不存在）
    const referencedSnippets = extractSnippetPaths(slidesMd)
    if (!referencedSnippets.includes("snippets/external.ts")) {
      referencedSnippets.push("snippets/external.ts")
    }

    const snippetsMap = new Map<string, string>()
    for (const snippetRel of referencedSnippets) {
      const content = DEFAULT_STARTER_SNIPPETS[snippetRel] || `// Auto-generated snippet placeholder for SiYuan Slidev\n// #region snippet\n// ${snippetRel}\n// #endregion snippet\n`
      snippetsMap.set(snippetRel, content)
    }

    // 若幻灯片包含 three-cols-header 布局，自动注入官方 Slidev 自定义布局文件 layouts/three-cols-header.vue
    const hasThreeColsHeader = doc.slides.some(s => s.frontmatter?.layout === "three-cols-header")
    if (hasThreeColsHeader) {
      snippetsMap.set("layouts/three-cols-header.vue", THREE_COLS_HEADER_LAYOUT_VUE)
    }

    // 物理文件系统落盘增强（确保 Node 子进程立即感知，并彻底避免思源内核文件写锁冲突）
    const fsMod = getRuntimeModule("fs")
    const pathMod = getRuntimeModule("path")
    let physicalWriteSuccess = false

    const targetPhysicalDir = pathMod?.dirname ? pathMod.dirname(physicalSlidesPath) : ""
    const isPhysicalCandidate = /^[a-zA-Z]:[/\\]/.test(physicalSlidesPath) || physicalSlidesPath.includes("siyuan-slidev-pro")

    if (fsMod && pathMod && isPhysicalCandidate) {
      try {
        if (!fsMod.existsSync(targetPhysicalDir)) {
          fsMod.mkdirSync(targetPhysicalDir, { recursive: true })
        }
        fsMod.writeFileSync(physicalPkgPath, pkgJson, "utf-8")
        fsMod.writeFileSync(physicalSlidesPath, slidesMd, "utf-8")

        for (const [snippetRel, content] of snippetsMap.entries()) {
          const physicalSnippetPath = pathMod.join(targetPhysicalDir, snippetRel)
          const snippetDir = pathMod.dirname(physicalSnippetPath)
          if (!fsMod.existsSync(snippetDir)) {
            fsMod.mkdirSync(snippetDir, { recursive: true })
          }
          if (!fsMod.existsSync(physicalSnippetPath)) {
            fsMod.writeFileSync(physicalSnippetPath, content, "utf-8")
          }
        }
        physicalWriteSuccess = true
      } catch {
        // 物理写入失败时将回退到 putFileFn
      }
    }

    // 仅当未进行物理文件写入（例如无真实文件系统访问权限的纯 Web 客户端）且提供了 putFileFn 时，才通过思源内核 API 写入
    if (!physicalWriteSuccess && putFileFn) {
      try {
        const slidesBlob = typeof Blob !== "undefined"
          ? new Blob([slidesMd], { type: "text/markdown;charset=utf-8" })
          : Buffer.from(slidesMd, "utf-8")
        const pkgBlob = typeof Blob !== "undefined"
          ? new Blob([pkgJson], { type: "application/json;charset=utf-8" })
          : Buffer.from(pkgJson, "utf-8")

        await putFileFn(pkgPath, false, pkgBlob)
        await putFileFn(slidesPath, false, slidesBlob)

        for (const [snippetRel, content] of snippetsMap.entries()) {
          const snippetPath = `${this.workspacePath}/${snippetRel}`
          const snippetBlob = typeof Blob !== "undefined"
            ? new Blob([content], { type: "text/plain;charset=utf-8" })
            : Buffer.from(content, "utf-8")
          await putFileFn(snippetPath, false, snippetBlob).catch(() => {})
        }

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
