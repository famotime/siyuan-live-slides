import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import {
  parseSlidesPresentation,
  parseYamlFrontmatter,
  splitSlidesMarkdownChunks,
  stripInlineComment,
} from "../src/compiler/slides-importer"

describe("Slidev Importer Core Tests", () => {
  it("should strip inline comments while preserving quoted hashes", () => {
    expect(stripInlineComment("value # comment")).toBe("value")
    expect(stripInlineComment("'value # not comment' # real comment")).toBe("'value # not comment'")
    expect(stripInlineComment('"value # not comment"')).toBe('"value # not comment"')
    expect(stripInlineComment("42")).toBe("42")
  })

  it("should parse YAML frontmatter correctly with multiline and quotes", () => {
    const yaml = `
theme: seriph
title: 'My Project: Cool' # inline comment
info: |
  First line
  Second line
aspectRatio: 16/9
`
    const parsed = parseYamlFrontmatter(yaml)
    expect(parsed.theme).toBe("seriph")
    expect(parsed.title).toBe("My Project: Cool")
    expect(parsed.info).toBe("First line\nSecond line")
    expect(parsed.aspectRatio).toBe("16/9")
  })

  it("should split slides correctly while ignoring --- inside code blocks", () => {
    const md = `---
theme: default
---

# Slide 1

\`\`\`yaml
---
key: val
---
\`\`\`

---
layout: center
---

# Slide 2
`
    const chunks = splitSlidesMarkdownChunks(md)
    expect(chunks.length).toBe(2)
  })

  it("should parse complete presentation with directives, notes and style tags", () => {
    const md = `---
theme: default
title: Test Presentation
aspectRatio: 16/9
colorSchema: dark
glowSeed: 100
---

# Page One

<v-click>
- Point A
</v-click>

\`\`\`ts {1-3|5}
const a = 1
const b = 2
\`\`\`

<!--
Notes for page 1
-->

---
layout: two-cols
background: /assets/bg.png
---

# Left
::right::
# Right

<style>
.custom { color: red; }
</style>
`
    const res = parseSlidesPresentation(md)

    expect(res.docTitle).toBe("Test Presentation")
    expect(res.docRootAttrs["custom-slides-theme"]).toBe("default")
    expect(res.docRootAttrs["custom-slides-aspect-ratio"]).toBe("16/9")
    expect(res.docRootAttrs["custom-slides-color-schema"]).toBe("dark")
    expect(res.docRootAttrs["custom-slides-glowSeed"]).toBe("100")
    expect(res.docRootAttrs["custom-slides-custom-css"]).toContain(".custom { color: red; }")

    expect(res.slides.length).toBe(2)

    // Slide 1
    const s1 = res.slides[0]
    expect(s1.notes).toBe("Notes for page 1")
    expect(s1.rawMarkdown).not.toContain("<!--")
    expect(s1.rawMarkdown).not.toContain("<v-click>")
    expect(s1.rawMarkdown).toContain("- Point A")
    expect(s1.rawMarkdown).toContain("```ts\nconst a = 1")

    // Slide 2
    const s2 = res.slides[1]
    expect(s2.pageAttrs["custom-slides-layout"]).toBe("two-cols")
    expect(s2.pageAttrs["custom-slides-background"]).toBe("/assets/bg.png")
    expect(s2.rawMarkdown).not.toContain("::right::")
    expect(s2.rawMarkdown).not.toContain("<style>")

    expect(res.stats.totalNotes).toBe(1)
    expect(res.stats.totalVClicks).toBe(1)
    expect(res.stats.totalShikiHighlights).toBe(1)
    expect(res.stats.totalSlots).toBe(1)
  })

  it("should flatten external sub-pages when src: ./pages/*.md is provided", () => {
    const mainMd = `---
theme: default
title: Main
---

# Page 1

---
src: ./pages/sub.md
`
    const subMd = `---
layout: center
---

# Sub Page Content
`
    const res = parseSlidesPresentation(mainMd, {
      virtualFiles: {
        "./pages/sub.md": subMd,
      },
    })

    expect(res.slides.length).toBe(2)
    expect(res.slides[1].rawMarkdown).toContain("# Sub Page Content")
    expect(res.slides[1].pageAttrs["custom-slides-layout"]).toBe("center")
  })

  it("FSM-4 词法扫描优化: 页面无 frontmatter 且紧随 Markdown 标题时绝不吞噬正文", () => {
    const md = `---
layout: cover
---
# 封面页
封面简介

---
# 第二页标题 (无 frontmatter)
这里是第二页的核心论述正文
- 列表项 A
- 列表项 B

---
# 第三页标题
这里是第三页正文
`
    const chunks = splitSlidesMarkdownChunks(md)
    expect(chunks.length).toBe(3)
    expect(chunks[0]).toContain("# 封面页")
    expect(chunks[1]).toContain("# 第二页标题 (无 frontmatter)")
    expect(chunks[1]).toContain("这里是第二页的核心论述正文")
    expect(chunks[2]).toContain("# 第三页标题")
    expect(chunks[2]).toContain("这里是第三页正文")

    const res = parseSlidesPresentation(md)
    expect(res.totalSlides).toBe(3)
    expect(res.slides[1].rawMarkdown).toContain("# 第二页标题 (无 frontmatter)")
    expect(res.slides[1].rawMarkdown).toContain("这里是第二页的核心论述正文")
  })

  it("FSM-5 正则占位符替换优化: 代码块与演讲备注包含 $1, $PATH, $$ 等特殊符号时绝不被误判篡改", () => {
    const md = `---
title: Token Safety Test
---

# Code with Regex Tokens

\`\`\`bash
echo "$1 is first arg and $PATH is path"
export COST="\\$100"
\`\`\`

<!--
讲稿备注中包含 LaTeX 公式: $$E=mc^2$$ 以及 $VAR 符号
-->
`
    const res = parseSlidesPresentation(md)
    const firstSlide = res.slides[0]
    expect(firstSlide.rawMarkdown).toContain('$1 is first arg and $PATH is path')
    expect(firstSlide.rawMarkdown).toContain('export COST="\\$100"')
    expect(firstSlide.notes).toContain('$$E=mc^2$$')
    expect(firstSlide.notes).toContain('$VAR')
  })

  it("导入兼容归一化：应将 two-cols-header / three-cols-header 归一化为 cols-header", () => {
    const md = `---
theme: default
---

# 封面

---
layout: two-cols-header
---

# 双栏对比

::left::
左列

::right::
右列

---
layout: three-cols-header
---

# 三栏对比

::col-1::
一

::col-2::
二

::col-3::
三
`
    const res = parseSlidesPresentation(md)
    expect(res.slides).toHaveLength(3)
    expect(res.slides[1].pageAttrs["custom-slides-layout"]).toBe("cols-header")
    expect(res.slides[2].pageAttrs["custom-slides-layout"]).toBe("cols-header")
    expect(res.slides[2].pageAttrs["custom-slides-layout-ratio"]).toBe("1:1:1")
  })

  // 针对真实 slidev-templates 仓库的回归测试
  describe("Real slidev-templates regression tests", () => {
    const templatesDir = "D:\\MyCodingProjects\\slidev-templates"

    it("should successfully parse editorial-grid starter template", () => {
      const target = path.join(templatesDir, "templates", "editorial-grid", "starter", "slides.md")
      if (!fs.existsSync(target)) return

      const content = fs.readFileSync(target, "utf-8")
      const res = parseSlidesPresentation(content)

      expect(res.docTitle).toBe("Editorial Grid — Make the Decision Visible")
      expect(res.docRootAttrs["custom-slides-theme"]).toBe("default")
      expect(res.docRootAttrs["custom-slides-class"]).toBe("editorial-deck")
      expect(res.totalSlides).toBe(8)
      expect(res.customCss).toBeDefined()
      expect(res.customCss).toContain(".cover-grid")
    })

    it("should successfully parse neko-style starter template with 16+ notes", () => {
      const target = path.join(templatesDir, "neko-style", "starter", "slides.md")
      if (!fs.existsSync(target)) return

      const content = fs.readFileSync(target, "utf-8")
      const res = parseSlidesPresentation(content)

      expect(res.docTitle).toContain("Project Aurora: Rethinking Developer Workflows")
      expect(res.docRootAttrs["custom-slides-theme"]).toBe("neko-style")
      expect(res.docRootAttrs["custom-slides-color-schema"]).toBe("dark")
      expect(res.totalSlides).toBe(16)
      expect(res.stats.totalNotes).toBeGreaterThanOrEqual(16)
      expect(res.stats.discoveredAssets).toContain("./qr-repo.png")
    })
  })
})
