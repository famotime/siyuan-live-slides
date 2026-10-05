import { describe, expect, it } from "vitest"
import { extractBlockRefs, resolveBlockRefsSync } from "../src/compiler/block-ref-resolver"
import { formatInlineMarkdown } from "../src/export/markdown-renderer"
import { convertHtmlToCleanMarkdown } from "../src/compiler/html-cleaner"
import { buildSlidevDocument } from "../src/compiler/slidev-ast-builder"
import type { ISiYuanBlockNode } from "../src/types/slidev-protocol"

describe("BlockRef & SiYuan Links (思源笔记文档与块链接全屏展示与跳转解析)", () => {
  it("应准确抽取思源单引号与双引号块引用标记 (含书名号与中文特殊标点)", () => {
    const text = [
      "Hover on the bottom-left corner to see the navigation's controls panel, learn more",
      "((20260625214150-d151ljw '《福格行为模型》'))",
      "((20260801083216-m7enl4c '60 不言：不书。'))",
      "((20231019123456-abcdef \"双引号锚文本\"))",
      "((20231020123456-112233))",
    ].join("\n")

    const refs = extractBlockRefs(text)
    expect(refs.length).toBe(4)

    expect(refs[0].blockId).toBe("20260625214150-d151ljw")
    expect(refs[0].anchorText).toBe("《福格行为模型》")

    expect(refs[1].blockId).toBe("20260801083216-m7enl4c")
    expect(refs[1].anchorText).toBe("60 不言：不书。")

    expect(refs[2].blockId).toBe("20231019123456-abcdef")
    expect(refs[2].anchorText).toBe("双引号锚文本")

    expect(refs[3].blockId).toBe("20231020123456-112233")
    expect(refs[3].anchorText).toBeUndefined()
  })

  it("resolveBlockRefsSync 应将单引号与双引号块引用替换为带 siyuan 协议与 data-ref-id 的超链接", () => {
    const text = "阅读推荐：((20260625214150-d151ljw '《福格行为模型》')) 以及 ((20260801083216-m7enl4c '60 不言：不书。'))"
    const resolved = resolveBlockRefsSync(text)

    expect(resolved).toContain('href="siyuan://blocks/20260625214150-d151ljw"')
    expect(resolved).toContain('data-ref-id="20260625214150-d151ljw"')
    expect(resolved).toContain('class="slidev-ref-tag"')
    expect(resolved).toContain("🔗 《福格行为模型》")

    expect(resolved).toContain('href="siyuan://blocks/20260801083216-m7enl4c"')
    expect(resolved).toContain('data-ref-id="20260801083216-m7enl4c"')
    expect(resolved).toContain("🔗 60 不言：不书。")
  })

  it("formatInlineMarkdown 应支持单引号块引用且不破坏 HTML 标签 (放行 a 标签)", () => {
    const text = "((20260625214150-d151ljw '《福格行为模型》'))"
    const html = formatInlineMarkdown(text)

    expect(html).toContain('<a href="siyuan://blocks/20260625214150-d151ljw"')
    expect(html).toContain('data-ref-id="20260625214150-d151ljw"')
    expect(html).toContain('class="slidev-ref-tag"')
    expect(html).toContain("🔗 《福格行为模型》")
    // 确保绝对没有被误转义成字面量文本
    expect(html).not.toContain("&lt;a")
  })

  it("formatInlineMarkdown 应支持标准思源超链接 [标题](siyuan://blocks/id) 与裸协议链接", () => {
    const mdLink = "请查阅 [福格模型全解](siyuan://blocks/20260625214150-d151ljw)"
    const html1 = formatInlineMarkdown(mdLink)
    expect(html1).toContain('<a href="siyuan://blocks/20260625214150-d151ljw"')
    expect(html1).toContain('data-ref-id="20260625214150-d151ljw"')
    expect(html1).toContain('class="slidev-ref-tag"')
    expect(html1).toContain("🔗 福格模型全解")

    const rawUri = "直接访问 siyuan://blocks/20260801083216-m7enl4c 进行深钻"
    const html2 = formatInlineMarkdown(rawUri)
    expect(html2).toContain('<a href="siyuan://blocks/20260801083216-m7enl4c"')
    expect(html2).toContain('data-ref-id="20260801083216-m7enl4c"')
    expect(html2).toContain('class="slidev-ref-tag"')
  })

  it("convertHtmlToCleanMarkdown 应正确将思源 Protyle 富文本 block-ref 与 a 标签转换为 Markdown 块引用与链接", () => {
    const protyleHtml = '<p><span data-type="block-ref" data-id="20260625214150-d151ljw" data-subtype="s">《福格行为模型》</span></p><p><span data-type="a" data-href="siyuan://blocks/20260801083216-m7enl4c">不言：不书。</span></p>'
    const cleaned = convertHtmlToCleanMarkdown(protyleHtml)

    expect(cleaned).toContain("((20260625214150-d151ljw '《福格行为模型》'))")
    expect(cleaned).toContain("[不言：不书。](siyuan://blocks/20260801083216-m7enl4c)")
  })

  it("buildSlidevDocument 应成功将思源单引号块引用编译为带交互属性的虚拟幻灯片块", () => {
    const blocks: ISiYuanBlockNode[] = [
      {
        id: "b-nav",
        type: "p",
        content: "Hover on the bottom-left corner to see the navigation's controls panel, learn more",
        markdown: "Hover on the bottom-left corner to see the navigation's controls panel, learn more",
      },
      {
        id: "b-ref1",
        type: "p",
        content: "((20260625214150-d151ljw '《福格行为模型》'))",
        markdown: "((20260625214150-d151ljw '《福格行为模型》'))",
      },
      {
        id: "b-ref2",
        type: "p",
        content: "((20260801083216-m7enl4c '60 不言：不书。'))",
        markdown: "((20260801083216-m7enl4c '60 不言：不书。'))",
      },
    ]

    const doc = buildSlidevDocument("doc-nav", {}, blocks, {})
    expect(doc.slides.length).toBe(1)
    const slide = doc.slides[0]

    expect(slide.blocks[1].rawMarkdown).toContain('href="siyuan://blocks/20260625214150-d151ljw"')
    expect(slide.blocks[1].rawMarkdown).toContain('data-ref-id="20260625214150-d151ljw"')
    expect(slide.blocks[1].rawMarkdown).toContain("《福格行为模型》")

    expect(slide.blocks[2].rawMarkdown).toContain('href="siyuan://blocks/20260801083216-m7enl4c"')
    expect(slide.blocks[2].rawMarkdown).toContain('data-ref-id="20260801083216-m7enl4c"')
    expect(slide.blocks[2].rawMarkdown).toContain("60 不言：不书。")
  })
})
