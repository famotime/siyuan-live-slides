import { describe, expect, it } from "vitest"
import {
  extractSlideMatter,
  parseYamlFrontmatter,
  resolveCodeSnippet,
  stripInlineComment,
} from "../src/compiler/frontmatter-parser"

describe("FrontmatterParser (YAML 与 Frontmatter 解析器)", () => {
  it("stripInlineComment 应正确过滤引号外的 # 注释，保留引号内字符串", () => {
    expect(stripInlineComment("value # comment")).toBe("value")
    expect(stripInlineComment('"value # not comment" # comment')).toBe('"value # not comment"')
    expect(stripInlineComment("'single # inside'")).toBe("'single # inside'")
  })

  it("parseYamlFrontmatter 应支持标量、布尔值、数值与引号字符串", () => {
    const yaml = `
layout: cover
highlighter: shiki
transition: fade
pageNumber: 1
draft: false
enabled: true
quoted: "hello world"
singleQuoted: 'single string'
`
    const res = parseYamlFrontmatter(yaml)
    expect(res.layout).toBe("cover")
    expect(res.highlighter).toBe("shiki")
    expect(res.transition).toBe("fade")
    expect(res.pageNumber).toBe(1)
    expect(res.draft).toBe(false)
    expect(res.enabled).toBe(true)
    expect(res.quoted).toBe("hello world")
    expect(res.singleQuoted).toBe("single string")
  })

  it("parseYamlFrontmatter 应正确解析多行块标量 (| 与 >)", () => {
    const yaml = `
notes: |
  第一行备注
  第二行备注
summary: >
  折叠为
  单行
`
    const res = parseYamlFrontmatter(yaml)
    expect(res.notes).toBe("第一行备注\n第二行备注")
    expect(res.summary).toBe("折叠为 单行")
  })

  it("parseYamlFrontmatter 应正确解析嵌套对象", () => {
    const yaml = `
themeConfig:
  primary: "#3b82f6"
  logo: "/logo.png"
`
    const res = parseYamlFrontmatter(yaml)
    expect(res.themeConfig).toEqual({
      primary: "#3b82f6",
      logo: "/logo.png",
    })
  })

  it("extractSlideMatter 应提取 Frontmatter 并返回剥离后的正文内容", () => {
    const raw = `---
layout: center
---

# 幻灯片正文
这是幻灯片内容
`
    const matter = extractSlideMatter(raw)
    expect(matter.frontmatter.layout).toBe("center")
    expect(matter.content).toContain("# 幻灯片正文")
    expect(matter.content).not.toContain("layout: center")
  })

  it("resolveCodeSnippet 应正确解析虚拟文件与 snippet region", () => {
    const virtualFiles = {
      "snippets/demo.ts": `// header
// #region my-region
export const foo = 'bar'
// #endregion my-region
// footer`,
    }
    const snippet = resolveCodeSnippet("<<< snippets/demo.ts#my-region", { virtualFiles })
    expect(snippet).toContain("export const foo = 'bar'")
    expect(snippet).not.toContain("// footer")
  })
})
