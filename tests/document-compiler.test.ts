import { describe, expect, it, vi } from "vitest"
import {
  DocumentCompilerService,
  parseIALString,
} from "../src/compiler/document-compiler"

describe("DocumentCompiler - parseIALString (IAL 解析纯函数)", () => {
  it("应正确解析标准带 {: } 包裹的双引号属性", () => {
    const ial = '{: custom-slidev-layout="cover" custom-slidev-transition="fade" }'
    const result = parseIALString(ial)
    expect(result).toEqual({
      "custom-slidev-layout": "cover",
      "custom-slidev-transition": "fade",
    })
  })

  it("应正确解析单引号属性与无引号属性", () => {
    const ial = "{: id='20261004120000-abcde' type=NodeThematicBreak updated=20261004120500 }"
    const result = parseIALString(ial)
    expect(result).toEqual({
      id: "20261004120000-abcde",
      type: "NodeThematicBreak",
      updated: "20261004120500",
    })
  })

  it("空字符串或畸形输入时应安全返回空字典", () => {
    expect(parseIALString("")).toEqual({})
    expect(parseIALString("{: }")).toEqual({})
    expect(parseIALString("invalid-no-equal")).toEqual({})
  })
})

describe("DocumentCompilerService - compile (编排编译服务)", () => {
  it("应完整编排获取块、映射 IAL、解析块引用并返回 Slidev 虚拟文档", async () => {
    const mockGetBlockAttrs = vi.fn().mockResolvedValue({
      "custom-slidev-theme": "seriph",
      "custom-slidev-aspect-ratio": "16/9",
    })
    const mockGetChildBlocks = vi.fn().mockResolvedValue([
      { id: "b1", type: "NodeHeading", content: "标题", markdown: "# 演示标题" },
      { id: "b2", type: "NodeThematicBreak", content: "", markdown: "---" },
      { id: "b3", type: "NodeParagraph", content: "内容 ((ref-1))", markdown: "内容 ((ref-1))" },
    ])
    const mockSql = vi.fn().mockImplementation((query: string) => {
      if (query.includes("root_id = 'doc-1'")) {
        return Promise.resolve([
          { id: "b1", ial: '{: custom-slidev-motion="bounce" }' },
          { id: "b2", ial: '{: custom-slidev-layout="two-cols" custom-slidev-transition="slide-left" }' },
          { id: "b3", ial: '{: custom-slidev-slot="left" }' },
        ])
      }
      if (query.includes("ref-1")) {
        return Promise.resolve([
          { id: "ref-1", content: "引用的源内容", markdown: "**引用的源内容**" },
        ])
      }
      return Promise.resolve([])
    })

    const compiler = new DocumentCompilerService({
      getBlockAttrs: mockGetBlockAttrs,
      getChildBlocks: mockGetChildBlocks,
      sql: mockSql,
      getBaseUrl: () => "http://localhost:6806",
    })

    const doc = await compiler.compile("doc-1")

    expect(doc).toBeDefined()
    expect(doc.docId).toBe("doc-1")
    expect(doc.config.theme).toBe("seriph")
    expect(doc.config.aspectRatio).toBe("16/9")
    expect(doc.slides.length).toBe(2)
    expect(doc.slides[1].frontmatter.layout).toBe("two-cols")
    expect(doc.slides[1].frontmatter.transition).toBe("slide-left")
    // 验证块引用被正确解析置换
    const secondPageMd = doc.slides[1].rawMarkdown
    expect(secondPageMd).toContain("引用的源内容")

    expect(mockGetBlockAttrs).toHaveBeenCalledWith("doc-1")
    expect(mockGetChildBlocks).toHaveBeenCalledWith("doc-1")
  })

  it("当文档无子块时应返回基础默认单页", async () => {
    const compiler = new DocumentCompilerService({
      getBlockAttrs: vi.fn().mockResolvedValue({}),
      getChildBlocks: vi.fn().mockResolvedValue([]),
      sql: vi.fn().mockResolvedValue([]),
    })

    const doc = await compiler.compile("empty-doc")
    expect(doc.slides.length).toBe(1)
    expect(doc.slides[0].blocks).toEqual([])
  })

  it("当底层 API 抛错时应优雅降级", async () => {
    const compiler = new DocumentCompilerService({
      getBlockAttrs: vi.fn().mockRejectedValue(new Error("Network Error")),
      getChildBlocks: vi.fn().mockRejectedValue(new Error("Kernel Error")),
      sql: vi.fn().mockRejectedValue(new Error("SQL Error")),
    })

    const doc = await compiler.compile("err-doc")
    expect(doc).toBeDefined()
    expect(doc.slides.length).toBe(1)
  })
})
