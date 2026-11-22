import { describe, it, expect } from "vitest"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { convertBlockToHtml } from "../src/export/markdown-renderer"
import type { ISiYuanBlockNode } from "../src/types/slides-protocol"

describe("列表项解包与对齐一致性 (解决同列表块末项偏左问题)", () => {
  it("场景 1：图文分栏 (image-right) 下列表包含多子块（段落+标题+图片），所有列表项保持一致的列表标记与对齐缩进", () => {
    const listNode: ISiYuanBlockNode = {
      id: "list-root",
      type: "l",
      markdown: "* 个性化软件的春天已经到来\n* AI 时代，一切才刚刚开始\n* 这是 Builder 的美好时代，也是产品经理的\n  ### Enjoy Building!\n  ![space](assets/space.jpg)",
      children: [
        {
          id: "item-1",
          type: "i",
          markdown: "* 个性化软件的春天已经到来",
          children: [
            { id: "p-1", type: "p", markdown: "个性化软件的春天已经到来", content: "个性化软件的春天已经到来" },
          ],
        },
        {
          id: "item-2",
          type: "i",
          markdown: "* AI 时代，一切才刚刚开始",
          children: [
            { id: "p-2", type: "p", markdown: "AI 时代，一切才刚刚开始", content: "AI 时代，一切才刚刚开始" },
          ],
        },
        {
          id: "item-3",
          type: "i",
          ial: { "custom-slides-slot": "col-2" },
          markdown: "* 这是 Builder 的美好时代，也是产品经理的\n  ### Enjoy Building!\n  ![space](assets/space.jpg)",
          children: [
            { id: "p-3", type: "p", markdown: "这是 Builder 的美好时代，也是产品经理的", content: "这是 Builder 的美好时代，也是产品经理的" },
            { id: "h-enjoy", type: "h", markdown: "### Enjoy Building!", content: "Enjoy Building!" },
            { id: "img-1", type: "p", markdown: "![space](assets/space.jpg)", content: "space", ial: { "custom-slides-role": "image-right" } },
          ],
        },
      ],
    }

    const doc = buildSlidesDocument("doc-1", {}, [
      { id: "heading-1", type: "h", markdown: "# 结语", content: "结语" },
      listNode,
    ])

    const slide = doc.slides[0]
    expect(slide.frontmatter.layout).toBe("image-right")
    expect(slide.frontmatter.image).toBe("/assets/space.jpg")

    // 验证列表被整洁逐项解包，且每个列表项的首行都统一带有列表标记
    const p1Block = slide.blocks.find(b => b.id === "p-1")
    const p2Block = slide.blocks.find(b => b.id === "p-2")
    const p3Block = slide.blocks.find(b => b.id === "p-3")

    expect(p1Block).toBeDefined()
    expect(p2Block).toBeDefined()
    expect(p3Block).toBeDefined()

    expect(p1Block?.rawMarkdown).toMatch(/^[-*+]\s+个性化软件/)
    expect(p2Block?.rawMarkdown).toMatch(/^[-*+]\s+AI 时代/)
    expect(p3Block?.rawMarkdown).toMatch(/^[-*+]\s+这是 Builder/)

    expect(p1Block?.isListItem).toBe(true)
    expect(p2Block?.isListItem).toBe(true)
    expect(p3Block?.isListItem).toBe(true)

    // 验证渲染出的 HTML 均统一为列表容器包裹，具备完全一致的左侧缩进对齐
    const html1 = convertBlockToHtml(p1Block!)
    const html2 = convertBlockToHtml(p2Block!)
    const html3 = convertBlockToHtml(p3Block!)

    expect(html1).toContain("pdf-list-item")
    expect(html2).toContain("pdf-list-item")
    expect(html3).toContain("pdf-list-item")

    expect(html1).toContain("<ul")
    expect(html2).toContain("<ul")
    expect(html3).toContain("<ul")

    expect(html3).not.toMatch(/^<div[^>]*><p>这是 Builder/i)
  })

  it("场景 2：列表项即便带有 slot=\"col-2\"，在图文分栏或单栏下绝不误清洗列表标记", () => {
    const listNode: ISiYuanBlockNode = {
      id: "list-slot",
      type: "l",
      children: [
        {
          id: "item-slot-1",
          type: "i",
          children: [
            { id: "p-slot-1", type: "p", markdown: "第一点：全栈赋能", content: "第一点：全栈赋能" },
          ],
        },
        {
          id: "item-slot-2",
          type: "i",
          ial: { "custom-slides-slot": "col-2" }, // 偶发配置或残留了 slot="col-2"
          children: [
            { id: "p-slot-2", type: "p", markdown: "第二点：极速落地", content: "第二点：极速落地" },
          ],
        },
      ],
    }

    const doc = buildSlidesDocument("doc-slot", {}, [
      listNode,
      { id: "img-1", type: "p", markdown: "![img](test.png)", ial: { "custom-slides-role": "image-right" } },
    ])
    const slide = doc.slides[0]

    const b1 = slide.blocks.find(b => b.id === "p-slot-1")
    const b2 = slide.blocks.find(b => b.id === "p-slot-2")

    expect(b1?.rawMarkdown).toMatch(/^[-*+]\s+第一点/)
    expect(b2?.rawMarkdown).toMatch(/^[-*+]\s+第二点/)
  })

  it("场景 3：在真正的多栏超级块卡片布局 (cols-header) 中，作为卡片标题的列表项首行正常清洗前缀", () => {
    const colListBlock: ISiYuanBlockNode = {
      id: "col-list-real",
      type: "l",
      children: [
        {
          id: "card-item-1",
          type: "i",
          ial: { "custom-slides-slot": "col-1" },
          children: [
            { id: "card-p-1", type: "p", markdown: "* 第一栏卡片标题\n说明文字", content: "* 第一栏卡片标题\n说明文字" },
          ],
        },
      ],
    }

    const doc = buildSlidesDocument("doc-col-real", { "custom-slides-layout": "two-cols-header" }, [colListBlock])
    const slide = doc.slides[0]

    const cardBlock = slide.blocks.find(b => b.id === "card-p-1")
    expect(cardBlock).toBeDefined()
    expect(cardBlock?.rawMarkdown).not.toMatch(/^\*\s+第一栏卡片标题/)
    expect(cardBlock?.rawMarkdown).toContain("第一栏卡片标题")
  })

  it("场景 4：有序列表包含复合多子块解包时，按顺序补齐对应数字序号并保持左侧对齐", () => {
    const orderedListBlock: ISiYuanBlockNode = {
      id: "ordered-list",
      type: "l",
      subType: "o",
      markdown: "1. 第一阶段目标\n2. 第二阶段规划\n   ### 详细路线\n   ![路线图](assets/roadmap.png)",
      children: [
        {
          id: "o-item-1",
          type: "i",
          children: [
            { id: "o-p-1", type: "p", markdown: "第一阶段目标", content: "第一阶段目标" },
          ],
        },
        {
          id: "o-item-2",
          type: "i",
          children: [
            { id: "o-p-2", type: "p", markdown: "第二阶段规划", content: "第二阶段规划" },
            { id: "o-h-1", type: "h", markdown: "### 详细路线", content: "详细路线" },
            { id: "o-img-1", type: "p", markdown: "![路线图](assets/roadmap.png)", content: "路线图", ial: { "custom-slides-role": "image-right" } },
          ],
        },
      ],
    }

    const doc = buildSlidesDocument("doc-ordered", { "custom-slides-layout": "image-right" }, [orderedListBlock])
    const slide = doc.slides[0]

    const b1 = slide.blocks.find(b => b.id === "o-p-1")
    const b2 = slide.blocks.find(b => b.id === "o-p-2")

    expect(b1?.rawMarkdown).toBe("1. 第一阶段目标")
    expect(b2?.rawMarkdown).toBe("2. 第二阶段规划")

    const html1 = convertBlockToHtml(b1!)
    const html2 = convertBlockToHtml(b2!)

    expect(html1).toContain("<ol")
    expect(html2).toContain("<ol")
    expect(html1).toContain("pdf-list-item")
    expect(html2).toContain("pdf-list-item")
  })

  it("场景 5：即使列表项因特殊原因 rawMarkdown 丢失前缀符号，若 isListItem 为 true，渲染器防御兜底生成列表容器保持对齐", () => {
    const rawBlock = {
      id: "p-no-prefix",
      type: "p",
      content: "无前缀的特殊列表项文本",
      rawMarkdown: "无前缀的特殊列表项文本",
      isListItem: true,
      rawNode: { id: "p-no-prefix", type: "p" },
    }

    const html = convertBlockToHtml(rawBlock as any)
    expect(html).toContain("pdf-list-item")
    expect(html).toContain("<ul")
    expect(html).toContain("<li")
    expect(html).toContain("无前缀的特殊列表项文本")
  })

  it("场景 6：配图位于列表下方独立块且文档未配置 layout 时，整页通过预扫描提前识别为 image-right 且列表项均保留列表前缀", () => {
    const doc = buildSlidesDocument("doc-scan", {}, [
      { id: "h1", type: "h", markdown: "# 总结页面" },
      {
        id: "list-1",
        type: "l",
        children: [
          {
            id: "it-1",
            type: "i",
            children: [{ id: "p-it-1", type: "p", markdown: "项一" }],
          },
          {
            id: "it-2",
            type: "i",
            ial: { "custom-slides-slot": "col-2" },
            children: [{ id: "p-it-2", type: "p", markdown: "项二（带插槽）" }],
          },
        ],
      },
      {
        id: "img-space-below",
        type: "p",
        markdown: "![space](assets/space.png)",
        ial: { "custom-slides-role": "image-right" },
      },
    ])

    const slide = doc.slides[0]
    expect(slide.frontmatter.layout).toBe("image-right")
    expect(slide.frontmatter.image).toBe("/assets/space.png")

    const b1 = slide.blocks.find(b => b.id === "p-it-1")
    const b2 = slide.blocks.find(b => b.id === "p-it-2")
    expect(b1?.rawMarkdown).toBe("- 项一")
    expect(b2?.rawMarkdown).toBe("- 项二（带插槽）")
  })

  it("场景 7：列表项解包后，首个子块之后的纯文本延续段不得被标记为列表项，也不渲染 ul/li 圆点", () => {
    const doc = buildSlidesDocument("doc-continuation", { "custom-slides-layout": "image-right" }, [
      {
        id: "list-cont",
        type: "l",
        children: [
          {
            id: "it-cont",
            type: "i",
            children: [
              { id: "p-main", type: "p", markdown: "列表项主文本" },
              { id: "p-plain", type: "p", markdown: "列表项下的纯文本说明" },
            ],
          },
        ],
      },
      { id: "img-c", type: "p", markdown: "![img](test.png)", ial: { "custom-slides-role": "image-right" } },
    ])

    const slide = doc.slides[0]
    const main = slide.blocks.find(b => b.id === "p-main")
    const plain = slide.blocks.find(b => b.id === "p-plain")

    expect(main?.isListItem).toBe(true)
    expect(main?.rawMarkdown).toBe("- 列表项主文本")
    expect(plain?.isListItem).toBe(false)
    expect(plain?.isListContinuation).toBe(true)
    expect(plain?.rawMarkdown).not.toMatch(/^[-*+]\s+/)

    const html = convertBlockToHtml(plain!)
    expect(html).not.toContain("<ul")
    expect(html).not.toContain("<li")
    expect(html).toContain("slide-list-continuation")
    expect(html).toContain("列表项下的纯文本说明")
  })
})
