import { describe, expect, it } from "vitest"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import type { ISiYuanBlockNode } from "../src/types/slides-protocol"

/**
 * 状态机审计 FIX-8 (P1-C1/P1-C2)：
 * - 同页多个图文来源时首个胜出，不再被后续图文块覆写 frontmatter
 * - 超级块内部子标题不污染全局大纲栈
 */
describe("slides-ast-builder 首个图文版式胜出与容器标题隔离", () => {
  it("同页两个图文超级块时，页面 frontmatter 采用首个超级块的版式与配图 (P1-C1)", () => {
    const blocks: ISiYuanBlockNode[] = [
      {
        id: "sb-img1",
        type: "s",
        subType: "col",
        children: [
          { id: "img-1", type: "p", markdown: "![封面图](assets/first.png)" },
          { id: "c-1", type: "p", content: "第一段内容" },
        ],
      },
      {
        id: "sb-img2",
        type: "s",
        subType: "col",
        children: [
          { id: "c-2", type: "p", content: "第二段内容" },
          { id: "img-2", type: "p", markdown: "![次要配图](assets/second.png)" },
        ],
      },
    ]

    const doc = buildSlidesDocument("doc-first-win", {}, blocks)
    expect(doc.slides.length).toBe(1)
    // 首个超级块为图左（首子块为图片），后续超级块不得覆写
    expect(doc.slides[0].frontmatter.layout).toBe("image-left")
    expect(doc.slides[0].frontmatter.image).toBe("/assets/first.png")
    // 第二个图文超级块的内容子块仍平铺进页面
    expect(doc.slides[0].blocks.some(b => b.id === "c-2")).toBe(true)
  })

  it("背景图块覆盖预设背景，但同页多个背景图块之间首个胜出 (P1-C1)", () => {
    const blocks: ISiYuanBlockNode[] = [
      {
        id: "bg-1",
        type: "p",
        markdown: "![背景一](assets/bg-first.png)",
        ial: { "custom-slides-role": "background" },
      },
      {
        id: "bg-2",
        type: "p",
        markdown: "![背景二](assets/bg-second.png)",
        ial: { "custom-slides-role": "background" },
      },
    ]

    const doc = buildSlidesDocument("doc-bg-first-win", {}, blocks)
    expect(doc.slides.length).toBe(1)
    expect(doc.slides[0].frontmatter.background).toBe("/assets/bg-first.png")
  })

  it("超级块内部子标题不向后续无关块传播 slot 属性 (P1-C2)", () => {
    const blocks: ISiYuanBlockNode[] = [
      {
        id: "sb-container",
        type: "s",
        subType: "col",
        children: [
          {
            id: "inner-head",
            type: "h",
            markdown: "## 容器内标题",
            ial: { "custom-slides-slot": "right" },
          },
          { id: "inner-p", type: "p", content: "容器内正文" },
        ],
      },
      { id: "after-p", type: "p", content: "超级块之后的普通段落" },
    ]

    const doc = buildSlidesDocument("doc-head-isolation", {}, blocks)
    expect(doc.slides.length).toBe(1)
    const afterBlock = doc.slides[0].blocks.find(b => b.id === "after-p")
    // 容器内标题的 slot 不得污染超级块之后的普通块
    expect(afterBlock?.slot).toBeFalsy()
  })
})
