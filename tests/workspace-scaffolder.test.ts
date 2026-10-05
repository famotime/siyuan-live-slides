import { describe, expect, it, vi } from "vitest"
import { extractSnippetPaths, WorkspaceScaffolder } from "../src/engine/workspace-scaffolder"
import type { ISlidevDocument } from "../src/types/slidev-protocol"

describe("WorkspaceScaffolder (官方 Pro 临时工程自动编排器)", () => {
  const sampleDoc: ISlidevDocument = {
    docId: "doc-test-1",
    config: {
      theme: "seriph",
      aspectRatio: "16/9",
      highlighter: "shiki",
      defaultTransition: "fade",
      colorSchema: "dark",
    },
    fullMarkdown: "",
    slides: [
      {
        pageIndex: 1,
        startBlockId: "p1",
        frontmatter: { layout: "cover" },
        notes: "演讲备忘",
        blocks: [
          { id: "b1", rawMarkdown: "# 架构分享", type: "h" },
        ],
        rawMarkdown: "",
      },
    ],
  }

  it("generatePackageJson 应输出合法的 JSON 并在非 default 主题时包含对应依赖", () => {
    const scaffolder = new WorkspaceScaffolder()
    const pkgStr = scaffolder.generatePackageJson("seriph")
    const pkg = JSON.parse(pkgStr)

    expect(pkg.name).toBe("siyuan-slidev-pro-workspace")
    expect(pkg.dependencies["@slidev/theme-seriph"]).toBe("latest")
  })

  it("buildSlidesMarkdown 应生成标准 Slidev Markdown", () => {
    const scaffolder = new WorkspaceScaffolder()
    const md = scaffolder.buildSlidesMarkdown(sampleDoc)

    expect(md).toContain("theme: seriph")
    expect(md).toContain("# 架构分享")
    expect(md).toContain("<!--\n演讲备忘\n-->")
  })

  it("extractSnippetPaths 应正确识别 Markdown 中的代码切片文件路径", () => {
    const md = `
# Slide 1
<<< @/snippets/external.ts#snippet

# Slide 2
<<< ./snippets/demo.js
<<< snippets/counter.vue#region
    `
    const snippets = extractSnippetPaths(md)
    expect(snippets).toEqual(["snippets/external.ts", "snippets/demo.js", "snippets/counter.vue"])
  })

  it("scaffold 应调用 putFileFn 写入 package.json、slides.md 及切片文件", async () => {
    const scaffolder = new WorkspaceScaffolder({ workspacePath: "/test/pro-workspace" })
    const mockPutFile = vi.fn().mockResolvedValue({ code: 0 })

    const res = await scaffolder.scaffold(sampleDoc, mockPutFile)

    expect(res.success).toBe(true)
    expect(res.slidesPath).toBe("/test/pro-workspace/slides.md")
    expect(res.packageJsonPath).toBe("/test/pro-workspace/package.json")
    expect(mockPutFile).toHaveBeenCalledWith("/test/pro-workspace/package.json", false, expect.anything())
    expect(mockPutFile).toHaveBeenCalledWith("/test/pro-workspace/slides.md", false, expect.anything())
    expect(mockPutFile).toHaveBeenCalledWith("/test/pro-workspace/snippets/external.ts", false, expect.anything())
    expect(mockPutFile).toHaveBeenCalledWith("/test/pro-workspace/setup/root.ts", false, expect.anything())
    expect(mockPutFile).toHaveBeenCalledWith("/test/pro-workspace/styles/index.css", false, expect.anything())
    expect(mockPutFile).toHaveBeenCalledTimes(5)
  })

  it("默认构造函数应将工作目录设置在系统临时目录下，且能自动将旧版 /data/ 路径重定向至安全独立目录", () => {
    const scaffolderDefault = new WorkspaceScaffolder()
    expect(scaffolderDefault.getWorkspacePath()).toContain("siyuan-slidev-pro")

    const scaffolderLegacy = new WorkspaceScaffolder({
      workspacePath: "/data/storage/petal/siyuan-slidev/pro-workspace",
    })
    expect(scaffolderLegacy.getWorkspacePath()).toContain("siyuan-slidev-pro")
    expect(scaffolderLegacy.getWorkspacePath()).not.toContain("/data/storage")
  })

  it("在系统临时目录时，scaffold 应直接物理写入且跳过 putFileFn，杜绝内核锁冲突", async () => {
    const scaffolder = new WorkspaceScaffolder()
    const mockPutFile = vi.fn().mockResolvedValue({ code: 0 })

    const res = await scaffolder.scaffold(sampleDoc, mockPutFile)

    expect(res.success).toBe(true)
    expect(res.slidesPath).toContain("slides.md")
    // 物理落盘成功时不会调用 putFile，从而保护思源内核
    expect(mockPutFile).not.toHaveBeenCalled()
  })
})

