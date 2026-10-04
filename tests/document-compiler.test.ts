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

  it("应通过 setBlockAttrOverride 覆盖 SQLite 查询的旧 IAL，确保讲稿备注即时生效", async () => {
    const mockGetBlockAttrs = vi.fn().mockResolvedValue({})
    const mockGetChildBlocks = vi.fn().mockResolvedValue([
      { id: "b1", type: "NodeHeading", content: "标题", markdown: "# 第一页" },
      { id: "b2", type: "NodeThematicBreak", content: "", markdown: "---" },
      { id: "b3", type: "NodeParagraph", content: "原本为正文", markdown: "> [!NOTE] 💡 演讲备注\n> 这是刚设为讲稿的提词内容" },
    ])
    // 模拟 SQLite 存在延迟，尚未同步 b3 的 custom-slidev-note 属性
    const mockSql = vi.fn().mockImplementation((query: string) => {
      if (query.includes("root_id = 'doc-delay'")) {
        return Promise.resolve([
          { id: "b1", ial: "{: }" },
          { id: "b2", ial: "{: custom-slidev-layout=\"default\" }" },
          { id: "b3", ial: "{: }" }, // 数据库中依然是空的！
        ])
      }
      return Promise.resolve([])
    })

    const compiler = new DocumentCompilerService({
      getBlockAttrs: mockGetBlockAttrs,
      getChildBlocks: mockGetChildBlocks,
      sql: mockSql,
    })

    // 1. 在未设置 override 时，b3 被当成普通内容块
    const docBefore = await compiler.compile("doc-delay")
    expect(docBefore.slides.length).toBe(2)
    expect(docBefore.slides[1].notes).toBe("")
    expect(docBefore.slides[1].blocks.some(b => b.id === "b3")).toBe(true)

    // 2. 注入即时覆盖缓存 (模拟用户在 Dock 中点击设为讲稿备注)
    compiler.setBlockAttrOverride("b3", { "custom-slidev-note": "true" })

    // 3. 再次编译，即便 SQLite 依然返回空 IAL，b3 也应立即被识别为讲稿备注块
    const docAfter = await compiler.compile("doc-delay")
    expect(docAfter.slides.length).toBe(2)
    expect(docAfter.slides[1].notes).toBe("这是刚设为讲稿的提词内容")
    expect(docAfter.slides[1].noteBlocks?.length).toBe(1)
    expect(docAfter.slides[1].noteBlocks?.[0].id).toBe("b3")
    expect(docAfter.slides[1].blocks.some(b => b.id === "b3")).toBe(false) // 幻灯片正文中排除

    // 4. 清除覆盖
    compiler.clearBlockAttrOverride("b3")
    const docReset = await compiler.compile("doc-delay")
    expect(docReset.slides[1].notes).toBe("")
  })
})
