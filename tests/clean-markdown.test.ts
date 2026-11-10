import fs from "fs"
import { describe, expect, it } from "vitest"
import {
  convertHtmlToCleanMarkdown,
  protectVueDivContainers,
  replaceDivContainer,
} from "../src/compiler/html-cleaner"
import {
  parseSlidesPresentation,
} from "../src/compiler/slides-importer"

describe("Clean Markdown Converter Tests (Terminal Ink & HTML Optimization)", () => {
  it("should convert terminal-ink slides to clean native markdown with cleanHtmlToMarkdown = true", () => {
    const filePath = "D:/MyCodingProjects/slidev-templates/templates/terminal-ink/starter/slides.md"
    if (!fs.existsSync(filePath)) return
    const content = fs.readFileSync(filePath, "utf-8")
    const parsed = parseSlidesPresentation(content, { cleanHtmlToMarkdown: true })

    expect(parsed.slides.length).toBe(7)

    for (const slide of parsed.slides) {
      // 验证各页正文中不包含未剥离的原始 HTML 块标签
      expect(slide.rawMarkdown).not.toContain("<div")
      expect(slide.rawMarkdown).not.toContain("</div>")
      expect(slide.rawMarkdown).not.toContain("<p>")
      expect(slide.rawMarkdown).not.toContain("</p>")
      expect(slide.rawMarkdown).not.toContain("<pre>")
      expect(slide.rawMarkdown).not.toContain("</pre>")
      expect(slide.rawMarkdown).not.toContain("<h1>")
      expect(slide.rawMarkdown).not.toContain("</h1>")
      expect(slide.rawMarkdown).not.toContain("<ul>")
      expect(slide.rawMarkdown).not.toContain("</ul>")
    }

    // 重点验证 Slide 1 (标题与命令提示符转换)
    const s1 = parsed.slides[0].rawMarkdown
    expect(s1).toContain("# What failed at 02:14?")
    expect(s1).toContain("```bash\n$ status --service gateway\n```")
    expect(s1).toContain("*[RUNBOOK / 01]*")

    // 重点验证 Slide 2 (时间线列表转换)
    const s2 = parsed.slides[1].rawMarkdown
    expect(s2).toContain("```bash\n$ timeline --from 02:10 --to 02:28\n```")
    expect(s2).toContain("# One fault, four observable transitions")
    expect(s2).toContain("- **02:10** **Traffic rises** — Normal autoscaling signal")
    expect(s2).toContain("- ⚠️ **02:14** **Queue saturates** — Retries amplify load")
    expect(s2).toContain("> `service=gateway` | `region=ap-east` | `severity=SEV-2`")

    // 重点验证 Slide 3 (日志代码块与观察引用转换)
    const s3 = parsed.slides[2].rawMarkdown
    expect(s3).toContain("```log")
    expect(s3).toContain("02:13:57.103 INFO  queue_depth=184 retry_rate=1.2")
    expect(s3).toContain("> **Observed**: Retry rate and queue depth rise together.")

    // 重点验证 Slide 4 (Before / After 对比网格转换)
    const s4 = parsed.slides[3].rawMarkdown
    expect(s4).toContain("**BEFORE:**")
    expect(s4).toContain("max_attempts: 8")
    expect(s4).toContain("**AFTER:**")
    expect(s4).toContain("max_attempts: 3")

    // 重点验证 Slide 5 (管线流程与根本原因转换)
    const s5 = parsed.slides[4].rawMarkdown
    expect(s5).toContain("1. **Client burst** (*expected*)")
    expect(s5).toContain("3. ⚠️ **Aggressive retries** (*amplifier*)")
    expect(s5).toContain("> **Root cause statement**:")

    // 重点验证 Slide 6 (检查项清单转换)
    const s6 = parsed.slides[5].rawMarkdown
    expect(s6).toContain("- ✅ **Load test**: 2.4× peak traffic without queue exhaustion")
    expect(s6).toContain("- ⚠️ **Open risk**: Cross-region retry policy still differs")

    // 重点验证 Slide 7 (任务列表转换)
    const s7 = parsed.slides[6].rawMarkdown
    expect(s7).toContain("- [x] deploy bounded retries")
    expect(s7).toContain("- [x] alert on retry amplification")
    expect(s7).toContain("- [ ] unify cross-region configuration")
    expect(s7).toContain("*[EXIT 0 / 07]*")
  })

  it("should preserve HTML-like content inside code blocks while cleaning outside HTML", () => {
    const raw = `
<div class="card">
  <h1>Sample</h1>
  <p>Text</p>
</div>

\`\`\`html
<div class="card">
  <p>Do not clean me</p>
</div>
\`\`\`
`
    const cleaned = convertHtmlToCleanMarkdown(raw)
    // 外层 HTML 被清理为 Markdown
    expect(cleaned).toContain("# Sample")
    expect(cleaned).toContain("Text")
    // 代码块内部的 HTML 完整保留
    expect(cleaned).toContain("```html\n<div class=\"card\">\n  <p>Do not clean me</p>\n</div>\n```")
  })

  it("replaceDivContainer 应正确处理嵌套 div 闭合与类名匹配", () => {
    const html = `<div class="target-card"><span>Header</span><div>Inner Div</div><p>Footer</p></div>`
    const replaced = replaceDivContainer(html, "target-card", (inner) => {
      return `[REPLACED: ${inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}]`
    })
    expect(replaced).toBe("[REPLACED: Header Inner Div Footer]")
  })

  it("protectVueDivContainers 应保护带有 v-click 或 @click 等指令的 div 元素", () => {
    const html = `Before <div class="box" v-click><span>Click Me</span></div> After`
    const { text, tokens } = protectVueDivContainers(html)
    expect(tokens.length).toBe(1)
    expect(tokens[0]).toContain("v-click")
    expect(text).toContain("__VUE_DIV_TOKEN_0__")
  })
})

