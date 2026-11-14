import { describe, expect, it, vi } from "vitest"
import { generateAutoAnimations } from "../src/ai/auto-animator"
import { analyzeSlideSplits } from "../src/ai/auto-splitter"
import { generateSpeakerNotes } from "../src/ai/notes-generator"
import { extractBlockRefs, resolveBlockRefsSync } from "../src/compiler/block-ref-resolver"
import type { ISiYuanBlockNode, ISlidesVirtualPage } from "../src/types/slides-protocol"

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
    expect(resolved).toContain("slides-block-ref")
    expect(resolved).toContain("这是引用的真实最新内容")
    expect(resolved).toContain("data-ref-id=\"ref-1\"")
  })
})

describe("AI Modules (智能断页、动效注入与提词卡)", () => {
  it("AutoSplitter 应在文档首段前插入分页线作为第一页起点，并基于 H1/H2/H3 推荐断页", () => {
    const blocks: ISiYuanBlockNode[] = [
      { id: "b1", type: "h", subType: "h1", markdown: "# 第一章 引言" },
      { id: "b2", type: "p", content: "引言段落 1" },
      { id: "b3", type: "h", subType: "h1", markdown: "# 第二章 核心架构" },
      { id: "b4", type: "p", content: "架构说明 1" },
      { id: "b5", type: "h", subType: "h2", markdown: "## 2.1 存储层设计" },
      { id: "b6", type: "p", content: "存储说明 1" },
      { id: "b7", type: "h", subType: "h3", markdown: "### 2.1.1 缓存失效机制" },
      { id: "b8", type: "p", content: "缓存说明 1" },
    ]

    const suggestions = analyzeSlideSplits(blocks)
    expect(suggestions.length).toBe(4)
    // 文档首段 b1 作为第一页起点，推荐 cover 版式
    expect(suggestions.some(s => s.blockId === "b1" && s.recommendedLayout === "cover")).toBe(true)
    expect(suggestions.find(s => s.blockId === "b1")?.reason).toContain("作为第一页起点插入分页线")
    // 后续章节标题 b3 (H1)、b5 (H2) 和 b7 (H3) 处正常断页
    expect(suggestions.some(s => s.blockId === "b3" && s.recommendedLayout === "cover")).toBe(true)
    expect(suggestions.some(s => s.blockId === "b5" && s.recommendedLayout === "default")).toBe(true)
    expect(suggestions.some(s => s.blockId === "b7" && s.recommendedLayout === "default")).toBe(true)
  })

  it("AutoSplitter 应严格防止重复分页（已有分隔符或紧邻分页线绝不重复推荐）", () => {
    // 模拟已经在首段前及后续标题前均已插入了 --- 分页线的完整文档
    const blocksWithDividers: ISiYuanBlockNode[] = [
      { id: "d0", type: "tb", markdown: "---" },
      { id: "b1", type: "h", subType: "h1", markdown: "# 第一章 引言" },
      { id: "b2", type: "p", content: "引言段落 1" },
      { id: "d1", type: "tb", markdown: "---" },
      { id: "b3", type: "h", subType: "h2", markdown: "## 1.1 背景" },
      { id: "b4", type: "p", content: "背景说明" },
      { id: "d2", type: "b", markdown: "---" },
      { id: "empty", type: "p", content: "   " }, // 空白段落
      { id: "b5", type: "h", subType: "h3", markdown: "### 1.1.1 挑战" },
      { id: "b6", type: "p", content: "挑战正文" },
    ]

    const suggestions = analyzeSlideSplits(blocksWithDividers)
    // 因为首段 d0 以及 b3、b5 前方已经存在 --- 分页线，绝不重复插入，因此建议应为 0
    expect(suggestions.length).toBe(0)
  })

  it("AutoSplitter 应在首段插入第一页起点并在普通块超容量阈值时自动断页", () => {
    const blocks: ISiYuanBlockNode[] = [
      { id: "b1", type: "h", subType: "h1", markdown: "# 首章（第一页起点）" },
      { id: "p1", type: "p", content: "段落 1" },
      { id: "p2", type: "p", content: "段落 2" },
      { id: "p3", type: "p", content: "段落 3" },
      { id: "p4", type: "p", content: "段落 4" },
      { id: "p5", type: "p", content: "段落 5" },
      { id: "p6", type: "p", content: "段落 6" },
      { id: "p7", type: "p", content: "段落 7" },
    ]

    const suggestions = analyzeSlideSplits(blocks, { maxBlocksPerPage: 6 })
    // 包含首段起点断页 b1 与超容量断页 p6
    expect(suggestions.length).toBe(2)
    expect(suggestions[0].blockId).toBe("b1")
    expect(suggestions[0].reason).toContain("作为第一页起点插入分页线")
    expect(suggestions[1].blockId).toBe("p6")
    expect(suggestions[1].reason).toContain("当前页已达容量上限")
  })

  it("AutoSplitter 应支持孤立标题保护（无正文连续标题不切割，避免空白单行页）", () => {
    const blocks: ISiYuanBlockNode[] = [
      { id: "h1", type: "h", subType: "h1", markdown: "# 第一章 战略规划" },
      // H1 -> H2 允许大章封面过渡断页
      { id: "h2", type: "h", subType: "h2", markdown: "## 1.1 市场洞察" },
      // H2 下直接紧接 H3，中间零正文：应触发孤立标题保护，不把 H3 拆成新页
      { id: "h3", type: "h", subType: "h3", markdown: "### 1.1.1 竞品分析" },
      { id: "p1", type: "p", content: "竞品调研正文内容..." },
      // H3 具备正文后，下一同级或新论点 H2 应正常断页
      { id: "h2_next", type: "h", subType: "h2", markdown: "## 1.2 财务指标" },
      { id: "p2", type: "p", content: "收入预期指标..." },
    ]

    const suggestions = analyzeSlideSplits(blocks, { protectOrphanHeadings: true })
    // 应在 h2 (H1大章后) 与 h2_next (有正文后) 断页，但 h3 不断页（保护 h2 孤立标题）
    expect(suggestions.some(s => s.blockId === "h2")).toBe(true)
    expect(suggestions.some(s => s.blockId === "h3")).toBe(false)
    expect(suggestions.some(s => s.blockId === "h2_next")).toBe(true)
  })

  it("AutoSplitter 应基于后续内容智能推断版式（图文、双栏列表与引言）", () => {
    const blocks: ISiYuanBlockNode[] = [
      { id: "h1", type: "h", subType: "h1", markdown: "# 核心章节封面" },
      { id: "p0", type: "p", content: "导引正文" },
      // 图右页：二级标题先有文字，后跟配图
      { id: "h2_img", type: "h", subType: "h2", markdown: "## 产品视觉设计" },
      { id: "p_desc", type: "p", content: "这是产品界面的核心模块介绍说明" },
      { id: "p_img", type: "p", content: "产品主图展现如下：", markdown: "![主视觉](assets/hero.png)" },
      // 双栏列表页：二级标题后跟多个列表项
      { id: "h2_list", type: "h", subType: "h2", markdown: "## 三大核心优势" },
      { id: "i1", type: "i", content: "优势 1：开箱即用" },
      { id: "i2", type: "i", content: "优势 2：零污染 IAL" },
      { id: "i3", type: "i", content: "优势 3：纯前端极速" },
    ]

    const suggestions = analyzeSlideSplits(blocks, { inferLayouts: true })
    const imgSug = suggestions.find(s => s.blockId === "h2_img")
    const listSug = suggestions.find(s => s.blockId === "h2_list")

    expect(imgSug).toBeDefined()
    expect(imgSug?.recommendedLayout).toBe("image-right")
    expect(imgSug?.reason).toContain("推荐图文版式")

    expect(listSug).toBeDefined()
    expect(listSug?.recommendedLayout).toBe("two-cols")
    expect(listSug?.reason).toContain("推荐双栏版式")
  })

  it("AutoSplitter 应基于代码块与表格等大块空间权重提前换页（不可分割保护）", () => {
    const blocks: ISiYuanBlockNode[] = [
      { id: "h2", type: "h", subType: "h2", markdown: "## 算法源码实现" },
      { id: "p1", type: "p", content: "算法背景说明" },
      { id: "p2", type: "p", content: "时间复杂度分析" },
      // 当前页已有 3 个块（累计权重 3），此时遇到高度占用大的大代码块 (权重 3)
      // 累计权重 3 + 3 = 6 > maxWeight (5)，算法应提前在 code1 前断页，将大块移至新页完整呈现
      { id: "code1", type: "c", content: "function heavyAlgo() { /* 大段代码 */ }" },
      { id: "p3", type: "p", content: "代码执行结果分析" },
    ]

    const suggestions = analyzeSlideSplits(blocks, { maxWeightPerPage: 5 })
    // 应在 code1 处提前触发容量断页，避免上一页信息过载与代码块溢出
    expect(suggestions.some(s => s.blockId === "code1")).toBe(true)
    expect(suggestions.find(s => s.blockId === "code1")?.reason).toContain("当前页已达容量上限")
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
    const slide: ISlidesVirtualPage = {
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

  it("generateSpeakerNotesWithAI 应优先使用 AI 返回结果并在异常时抛出错误", async () => {
    const { generateSpeakerNotesWithAI } = await import("../src/ai/notes-generator")
    const slide: ISlidesVirtualPage = {
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

    // 2. AI 异常时抛出错误，不再静默降级为规则模板
    const mockAiFail = vi.fn().mockRejectedValue(new Error("AI 服务超时"))
    await expect(generateSpeakerNotesWithAI(slide, mockAiFail)).rejects.toThrow("AI 服务超时")
  })

  it("generateSpeakerNotesWithAIDetailed 应明确区分 AI 成功与失败错误信息", async () => {
    const { generateSpeakerNotesWithAIDetailed } = await import("../src/ai/notes-generator")
    const slide: ISlidesVirtualPage = {
      pageIndex: 1,
      startBlockId: "start-1",
      frontmatter: { layout: "default" },
      notes: "",
      blocks: [
        { id: "divider", type: "d", content: "---", rawMarkdown: "---" },
        { id: "h1", type: "h", content: "AI 时代的前端演进", rawMarkdown: "# AI 时代的前端演进" },
      ],
      rawMarkdown: "",
    }

    // 1. AI 成功返回
    const mockAi = vi.fn().mockResolvedValue("这是 AI 分析提炼的提词卡")
    const r1 = await generateSpeakerNotesWithAIDetailed(slide, mockAi)
    expect(r1.isAiGenerated).toBe(true)
    expect(r1.notes).toBe("这是 AI 分析提炼的提词卡")
    // prompt 中应包含标题，且不应包含单纯的分页符 ---
    expect(mockAi.mock.calls[0][0]).toContain("AI 时代的前端演进")

    // 2. AI 返回空或失败时给出明确错误，取消规则模板回退
    const mockEmpty = vi.fn().mockResolvedValue(null)
    const r2 = await generateSpeakerNotesWithAIDetailed(slide, mockEmpty)
    expect(r2.isAiGenerated).toBe(false)
    expect(r2.notes).toBe("")
    expect(r2.error).toContain("AI 服务未配置")
  })

  it("chatAI 应向思源内核 /api/ai/chatGPT 传递 msg 参数并正确返回结果", async () => {
    const siyuanMock = await import("siyuan")
    const spy = vi.spyOn(siyuanMock, "fetchSyncPost").mockResolvedValueOnce({
      code: 0,
      msg: "",
      data: "思源内核 AI 模型的回答",
    })

    const { chatAI } = await import("../src/api")
    const answer = await chatAI("帮我生成演讲提词")
    expect(spy).toHaveBeenCalledWith("/api/ai/chatGPT", { msg: "帮我生成演讲提词" })
    expect(answer).toBe("思源内核 AI 模型的回答")

    // 内核未配置 AI 返回空字符串时应处理为 null
    spy.mockResolvedValueOnce({
      code: 0,
      msg: "",
      data: "",
    })
    const emptyAnswer = await chatAI("测试未配置")
    expect(emptyAnswer).toBeNull()

    spy.mockRestore()
  })
})
