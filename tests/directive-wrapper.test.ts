import { describe, expect, it } from "vitest"
import {
  distributeThreeColumns,
  extractCleanNoteText,
} from "../src/compiler/directive-wrapper"

describe("DirectiveWrapper (指令包装与语法工具函数)", () => {
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
