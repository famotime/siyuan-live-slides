import type { ISlidesDocument } from "../types/slides-protocol"

export class CliDevServerBridge {
  private devServerUrl = "http://localhost:3030"
  private isConnected = false
  private lastSyncTime: number | null = null

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

  public getLastSyncTime(): number | null {
    return this.lastSyncTime
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

  /**
   * 将当前演示文档构建为 Slidev 官方标准的 Markdown 格式 (含全局与分页 Frontmatter)
   */
  public buildStandardSlidevMarkdown(doc: ISlidesDocument): string {
    const config = doc.config
    const frontmatterLines: string[] = [
      "---",
      `theme: ${config.theme || "default"}`,
      `aspectRatio: "${config.aspectRatio || "16/9"}"`,
      `highlighter: ${config.highlighter || "shiki"}`,
      `transition: ${config.defaultTransition || "slide-left"}`,
    ]

    if (config.colorSchema && config.colorSchema !== "auto") {
      frontmatterLines.push(`colorSchema: ${config.colorSchema}`)
    }
    frontmatterLines.push("drawings:", "  persist: false", "---", "")

    const globalHeader = frontmatterLines.join("\n")

    const slidesMarkdown = doc.slides.map((slide, idx) => {
      const pageFm = slide.frontmatter || {}
      const pageFmLines: string[] = []

      // 第一页紧接全局 frontmatter，后续页面使用 --- 分页
      const isFirst = idx === 0

      if (pageFm.layout && pageFm.layout !== "default") {
        pageFmLines.push(`layout: ${pageFm.layout}`)
      }
      if (pageFm.transition) {
        pageFmLines.push(`transition: ${pageFm.transition}`)
      }
      if (pageFm.background) {
        pageFmLines.push(`background: ${pageFm.background}`)
      }
      if (pageFm.class) {
        pageFmLines.push(`class: "${pageFm.class}"`)
      }

      let header = ""
      if (pageFmLines.length > 0) {
        header = isFirst
          ? "" // 第一页由全局 frontmatter 承载或内联
          : `---\n${pageFmLines.join("\n")}\n---\n\n`
      } else if (!isFirst) {
        header = "---\n\n"
      }

      // 处理双栏插槽与块内容
      let contentBody = ""
      if (pageFm.layout === "two-cols") {
        const leftBlocks = slide.blocks.filter(b => b.slot !== "right")
        const rightBlocks = slide.blocks.filter(b => b.slot === "right")

        const leftMd = leftBlocks.map(b => b.rawMarkdown || b.content || "").join("\n\n")
        const rightMd = rightBlocks.map(b => b.rawMarkdown || b.content || "").join("\n\n")

        contentBody = `${leftMd}\n\n::right::\n\n${rightMd}`
      } else {
        contentBody = slide.blocks.map(b => b.rawMarkdown || b.content || "").join("\n\n")
      }

      // 处理演讲者提词备注
      let notesFooter = ""
      if (slide.notes && slide.notes.trim()) {
        notesFooter = `\n\n<!--\n${slide.notes.trim()}\n-->`
      }

      return `${header}${contentBody}${notesFooter}`
    }).join("\n\n")

    let styleFooter = ""
    if (doc.config.normalizeHeadingSizes) {
      styleFooter = `\n\n<style>\n/* Specific Heading Normalization */\n.slidev-layout:not(.cover) > :is(h1, h2, h3, h4, h5, h6):first-child {\n  font-size: 1.7rem !important;\n}\n.two-cols-header-top :is(h1, h2, h3, h4, h5, h6),\n.cols-header-top :is(h1, h2, h3, h4, h5, h6),\n.layout-header-section :is(h1, h2, h3, h4, h5, h6) {\n  font-size: 1.7rem !important;\n}\n:is(.two-cols-left, .two-cols-right, .col, .col-1, .col-2, .col-3, .three-cols-col) > :is(h1, h2, h3, h4, h5, h6):first-child {\n  font-size: 1.3rem !important;\n}\n</style>`
    }

    return `${globalHeader}${slidesMarkdown}${styleFooter}\n`
  }

  /**
   * 将构建的标准 Slidev Markdown 写入思源工作空间存储中，供本地 CLI 读取
   */
  public async syncToWorkspaceFile(
    doc: ISlidesDocument,
    targetPath = "/data/storage/petal/siyuan-live-slides/slides.md",
    putFileFn?: (path: string, isDir: boolean, file: any) => Promise<any>,
  ): Promise<{ success: boolean; path: string; error?: string }> {
    const md = this.buildStandardSlidevMarkdown(doc)
    this.lastSyncTime = Date.now()

    if (putFileFn) {
      try {
        const blob = typeof Blob !== "undefined"
          ? new Blob([md], { type: "text/markdown;charset=utf-8" })
          : Buffer.from(md, "utf-8")
        await putFileFn(targetPath, false, blob)
        return { success: true, path: targetPath }
      } catch (err: any) {
        return { success: false, path: targetPath, error: String(err) }
      }
    }

    return { success: true, path: targetPath }
  }

  /**
   * 触发浏览器下载生成的 slides.md 文件
   */
  public downloadSlidesMd(doc: ISlidesDocument, filename = "slides.md"): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return false
    }

    const md = this.buildStandardSlidevMarkdown(doc)
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  }
}

