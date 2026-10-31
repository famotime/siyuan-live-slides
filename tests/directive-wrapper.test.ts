import { describe, expect, it } from "vitest"
import {
  distributeThreeColumns,
  extractCleanNoteText,
  getBlockHeadingLevel,
  getMotionDirectives,
  injectShikiSpotlight,
  stringifyFrontmatter,
  wrapElementDirectives,
  wrapVClickDirective,
} from "../src/compiler/directive-wrapper"

describe("DirectiveWrapper (指令包装与语法工具函数)", () => {
  it("stringifyFrontmatter 应序列化 YAML 并针对特殊字符进行转义包裹", () => {
    const yaml = stringifyFrontmatter({
      layout: "cover",
      background: "https://example.com/bg.png",
      title: "Title: Subtitle",
      empty: null,
      count: 3,
    })

    expect(yaml).toContain("---\n")
    expect(yaml).toContain("layout: cover")
    expect(yaml).toContain('title: "Title: Subtitle"')
    expect(yaml).toContain("count: 3")
    expect(yaml).not.toContain("empty")
  })

  it("injectShikiSpotlight 应在首行代码标牌后注入聚光行号标记", () => {
    const md = "```ts\nconst a = 1\n```"
    const injected = injectShikiSpotlight(md, "1-3|5")
    expect(injected).toBe("```ts {1-3|5}\nconst a = 1\n```")

    // 已有花括号标记不重复注入
    const already = "```ts {1}\nconst a = 1\n```"
    expect(injectShikiSpotlight(already, "2")).toBe(already)
  })

  it("wrapVClickDirective 应正确包装不同模式的 v-click", () => {
    expect(wrapVClickDirective("文字", "+1")).toBe("<v-click>\n\n文字\n\n</v-click>")
    expect(wrapVClickDirective("文字", "hide")).toBe("<v-click hide>\n\n文字\n\n</v-click>")
    expect(wrapVClickDirective("文字", "2")).toBe('<v-click at="2">\n\n文字\n\n</v-click>')
  })

  it("getMotionDirectives 应支持预设动效与自定义持续时间", () => {
    const motion = getMotionDirectives({
      preset: "slide-up",
      duration: 500,
      delay: 100,
    })
    expect(motion).not.toBeNull()
    expect(motion?.initial.y).toBe(40)
    expect(motion?.enter.y).toBe(0)
    expect(motion?.enter.transition.duration).toBe(500)
    expect(motion?.enter.transition.delay).toBe(100)
  })

  it("wrapElementDirectives 应支持 v-click、v-motion 与自定义 style 复合包装", () => {
    const res = wrapElementDirectives(
      "正文段落",
      "+1",
      { preset: "fade-in", duration: 300 },
      "color: red;",
    )
    expect(res).toContain("v-click")
    expect(res).toContain("v-motion")
    expect(res).toContain('style="color: red;"')
    expect(res).toContain("slide-styled-block")
  })

  it("extractCleanNoteText 应完整剥离思源提示块与标题头", () => {
    const rawCallout = `> [!NOTE] 💡 演讲备注\n> 第一点提词\n> 第二点提词\n{: custom-slides-note="true"}`
    const cleaned = extractCleanNoteText(rawCallout)
    expect(cleaned).toBe("第一点提词\n第二点提词")
  })

  it("distributeThreeColumns 应正确将 3 个大纲标题内容分入 3 栏", () => {
    const blocks = [
      { id: "1", type: "h", content: "标题 1" },
      { id: "2", type: "p", content: "段落 1" },
      { id: "3", type: "h", content: "标题 2" },
      { id: "4", type: "p", content: "段落 2" },
      { id: "5", type: "h", content: "标题 3" },
      { id: "6", type: "p", content: "段落 3" },
    ]
    const res = distributeThreeColumns(blocks)
    expect(res.col1.map(b => b.id)).toEqual(["1", "2"])
    expect(res.col2.map(b => b.id)).toEqual(["3", "4"])
    expect(res.col3.map(b => b.id)).toEqual(["5", "6"])
  })
})
