import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parseSlidesPresentation, splitSlidesMarkdownChunks } from "../src/compiler/slides-importer"
import { parseLiveSlidesMarkdown } from "../src/compiler/live-slides-importer"

/**
 * 状态机审计 FIX-3 / FIX-4：
 * - src: 子演示递归防环与深度上限
 * - 分片扫描器的 EOF 卡死态（未闭合 HTML 注释 / 未闭合代码围栏）
 */
describe("slides-importer EOF 卡死态与 src: 递归防环", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it("src: 自引用与互引用应产出循环占位页而非栈溢出 (P0-6)", () => {
    // 自引用
    const selfLoop = parseSlidesPresentation("src: ./self.md", {
      virtualFiles: { "self.md": "src: ./self.md" },
    })
    expect(selfLoop.slides.length).toBe(1)
    expect(selfLoop.slides[0].rawMarkdown).toContain("循环引用")

    // 互引用 a -> b -> a
    const mutualLoop = parseSlidesPresentation("src: ./a.md", {
      virtualFiles: {
        "a.md": "src: ./b.md",
        "b.md": "src: ./a.md",
      },
    })
    expect(mutualLoop.slides.length).toBe(1)
    expect(mutualLoop.slides[0].rawMarkdown).toContain("循环引用")
    expect(mutualLoop.slides[0].pageAttrs["custom-slides-src"]).toBe("./a.md")
  })

  it("src: 嵌套超过深度上限时应停止递归并产出提示占位页 (P0-6)", () => {
    const virtualFiles: Record<string, string> = {}
    for (let n = 1; n <= 12; n++) {
      virtualFiles[`c${n}.md`] = `src: ./c${n + 1}.md`
    }
    virtualFiles["c12.md"] = "# 尾页"

    const parsed = parseSlidesPresentation("src: ./c1.md", { virtualFiles })
    expect(parsed.slides.length).toBeLessThan(12)
    const deepest = parsed.slides[parsed.slides.length - 1]
    expect(deepest.rawMarkdown).toContain("嵌套层级超过上限")
    // 链条并未真正解析到 c12 尾页
    expect(parsed.slides.some(s => (s.rawMarkdown || "").includes("尾页"))).toBe(false)
  })

  it("正常 src: 子页面展开不受防环守卫影响 (回归守护)", () => {
    const parsed = parseSlidesPresentation("src: ./intro.md", {
      virtualFiles: { "intro.md": "# 欢迎页\n\n正文" },
    })
    expect(parsed.slides.length).toBe(1)
    expect(parsed.slides[0].rawMarkdown).toContain("欢迎页")
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it("未闭合 HTML 注释不再吞掉文档尾部，其后 --- 恢复分片能力 (P0-7)", () => {
    const md = [
      "# Page 1",
      "<!-- unterminated note",
      "---",
      "## Page 2",
      "content",
      "---",
      "## Page 3",
    ].join("\n")

    const chunks = splitSlidesMarkdownChunks(md)
    expect(chunks.length).toBe(3)
    expect(chunks[1]).toContain("Page 2")
    expect(chunks[2]).toContain("Page 3")
    expect(warnSpy.mock.calls.some(([msg]) => String(msg).includes("未闭合的 HTML 注释"))).toBe(true)
  })

  it("正常闭合的多行 HTML 注释行为保持不变 (回归守护)", () => {
    const md = ["# Page 1", "<!--", "note line", "-->", "---", "# Page 2"].join("\n")
    const chunks = splitSlidesMarkdownChunks(md)
    expect(chunks.length).toBe(2)
    expect(chunks[0]).toContain("note line")
    expect(chunks[1]).toContain("Page 2")
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it("未闭合代码围栏推进游标到 EOF，围栏内 --- 不再被误判为分页符 (P0-7)", () => {
    const md = ["# Page 1", "---", "```js", "const a = 1;", "---", "still code"].join("\n")

    const chunks = splitSlidesMarkdownChunks(md)
    expect(chunks.length).toBe(2)
    expect(chunks[1]).toContain("still code")
    expect(chunks[1]).toContain("---")
    expect(chunks[1]).toContain("const a = 1;")
    expect(warnSpy.mock.calls.some(([msg]) => String(msg).includes("未闭合的代码围栏"))).toBe(true)
  })

  it("正常闭合围栏内的 --- 依旧被保护 (回归守护)", () => {
    const md = ["# Page 1", "---", "```js", "const a = 1;", "---", "still code", "```", "尾行"].join("\n")
    const chunks = splitSlidesMarkdownChunks(md)
    expect(chunks.length).toBe(2)
    expect(chunks[1]).toContain("still code")
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it("live 导入器：未闭合围栏在 EOF 显式告警，内容保留在末页 (P0-7)", () => {
    const md = ["# 标题页", "", "```js", "const a = 1;", "---", "more content"].join("\n")

    const parsed = parseLiveSlidesMarkdown(md)
    expect(parsed.slides.length).toBe(1)
    expect(parsed.slides[0].rawMarkdown).toContain("more content")
    expect(parsed.slides[0].rawMarkdown).toContain("---")
    expect(warnSpy.mock.calls.some(([msg]) => String(msg).includes("未闭合的代码围栏"))).toBe(true)
  })

  it("live 导入器：闭合围栏分页行为保持不变 (回归守护)", () => {
    const md = ["# 标题页", "", "```js", "const a = 1;", "```", "", "---", "", "# 第二页"].join("\n")
    const parsed = parseLiveSlidesMarkdown(md)
    expect(parsed.slides.length).toBe(2)
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
