import { describe, expect, it, vi } from "vitest"
import { WorkspaceScaffolder } from "../src/engine/workspace-scaffolder"
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

  it("scaffold 应调用 putFileFn 写入 package.json 与 slides.md", async () => {
    const scaffolder = new WorkspaceScaffolder({ workspacePath: "/test/pro-workspace" })
    const mockPutFile = vi.fn().mockResolvedValue({ code: 0 })

    const res = await scaffolder.scaffold(sampleDoc, mockPutFile)

    expect(res.success).toBe(true)
    expect(res.slidesPath).toBe("/test/pro-workspace/slides.md")
    expect(res.packageJsonPath).toBe("/test/pro-workspace/package.json")
    expect(mockPutFile).toHaveBeenCalledTimes(2)
  })
})
