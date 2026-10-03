import { describe, expect, it, vi } from "vitest"
import { generateAutoAnimations } from "../src/ai/auto-animator"
import { analyzeSlideSplits } from "../src/ai/auto-splitter"
import { generateSpeakerNotes } from "../src/ai/notes-generator"
import { extractBlockRefs, resolveBlockRefsSync } from "../src/compiler/block-ref-resolver"
import type { ISiYuanBlockNode, ISlidevVirtualPage } from "../src/types/slidev-protocol"

describe("BlockRefResolver (块引用与块嵌入动态展开)", () => {
  it("应准确抽取思源块引用标记", () => {
    const text = "前文提到 ((20231019-123456 \"核心论点\"))，另外还有 ((20231020-654321))"
    const refs = extractBlockRefs(text)
    expect(refs.length).toBe(2)
    expect(refs[0].blockId).toBe("20231019-123456")
    expect(refs[0].anchorText).toBe("核心论点")
    expect(refs[1].blockId).toBe("20231020-654321")
    expect(refs[1].anchorText).toBeUndefined()
  })

  it("当提供源块映射字典时应动态展开块引用", () => {
    const text = "参考结论：((ref-1 \"旧标题\"))"
    const resolved = resolveBlockRefsSync(text, {
      "ref-1": "这是引用的真实最新内容",
    })
    expect(resolved).toContain("slidev-block-ref")
    expect(resolved).toContain("这是引用的真实最新内容")
    expect(resolved).toContain("data-ref-id=\"ref-1\"")
  })
})

describe("AI Modules (智能断页、动效注入与提词卡)", () => {
  it("AutoSplitter 应基于 H1/H2 与容量启发式推荐断页位置", () => {
    const blocks: ISiYuanBlockNode[] = [
      { id: "b1", type: "h", subType: "h1", markdown: "# 第一章 引言" },
      { id: "b2", type: "p", content: "引言段落 1" },
      { id: "b3", type: "h", subType: "h1", markdown: "# 第二章 核心架构" },
      { id: "b4", type: "p", content: "架构说明 1" },
      { id: "b5", type: "h", subType: "h2", markdown: "## 2.1 存储层设计" },
      { id: "b6", type: "p", content: "存储说明 1" },
    ]

    const suggestions = analyzeSlideSplits(blocks)
    expect(suggestions.length).toBeGreaterThanOrEqual(2)
    // 应该推荐在 b3 (H1) 和 b5 (H2) 处分页
    expect(suggestions.some(s => s.blockId === "b3")).toBe(true)
    expect(suggestions.some(s => s.blockId === "b5")).toBe(true)
  })

  it("AutoAnimator 应对列表项注入递增步进", () => {
    const blocks: ISiYuanBlockNode[] = [
      { id: "i1", type: "i", content: "第一条核心优势" },
      { id: "i2", type: "i", content: "第二条核心优势" },
      { id: "i3", type: "i", content: "第三条核心优势" },
    ]

    const animations = generateAutoAnimations(blocks)
    expect(animations.length).toBe(3)
    expect(animations.map(a => a.step)).toEqual(["1", "2", "3"])
  })

  it("NotesGenerator 应从幻灯片块提取大纲并生成口播提词", () => {
    const slide: ISlidevVirtualPage = {
      pageIndex: 1,
      startBlockId: "start-1",
      frontmatter: { layout: "default" },
      notes: "",
      blocks: [
        { id: "h1", type: "h", content: "Slidev 渲染架构", rawMarkdown: "# Slidev 渲染架构" },
        { id: "p1", type: "p", content: "介绍双模引擎机制，零依赖秒级加载", rawMarkdown: "介绍双模引擎机制，零依赖秒级加载" },
      ],
      rawMarkdown: "",
    }

    const notes = generateSpeakerNotes(slide)
    expect(notes).toContain("【核心重点】：Slidev 渲染架构")
    expect(notes).toContain("【口播要点】：")
    expect(notes).toContain("【过渡提示】：")
  })

  it("generateSpeakerNotesWithAI 应优先使用 AI 返回结果并在异常时降级", async () => {
    const { generateSpeakerNotesWithAI } = await import("../src/ai/notes-generator")
    const slide: ISlidevVirtualPage = {
      pageIndex: 1,
      startBlockId: "start-1",
      frontmatter: { layout: "default" },
      notes: "",
      blocks: [
        { id: "h1", type: "h", content: "微服务架构演进", rawMarkdown: "# 微服务架构演进" },
      ],
      rawMarkdown: "",
    }

    // 1. AI 正常响应
    const mockAiSuccess = vi.fn().mockResolvedValue("AI 生成的高水准口播提词卡")
    const res1 = await generateSpeakerNotesWithAI(slide, mockAiSuccess)
    expect(res1).toBe("AI 生成的高水准口播提词卡")
    expect(mockAiSuccess).toHaveBeenCalled()

    // 2. AI 异常降级
    const mockAiFail = vi.fn().mockRejectedValue(new Error("AI 服务超时"))
    const res2 = await generateSpeakerNotesWithAI(slide, mockAiFail)
    expect(res2).toContain("【核心重点】：微服务架构演进")
  })
})
