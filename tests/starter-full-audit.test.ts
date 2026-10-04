import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { parseSlidevPresentation, splitSlidevMarkdownChunks } from "../src/compiler/slidev-importer"
import { buildSlidevDocument } from "../src/compiler/slidev-ast-builder"

describe("Full Audit: Starter Demo Import & Round-trip", () => {
  const starterPath = "D:/MyCodingProjects/slidev/demo/starter/slides.md"
  const subPath = "D:/MyCodingProjects/slidev/demo/starter/pages/imported-slides.md"
  const snippetPath = "D:/MyCodingProjects/slidev/demo/starter/snippets/external.ts"

  it("audits all 16 slides in detail", () => {
    const content = fs.readFileSync(starterPath, "utf-8")
    const subContent = fs.readFileSync(subPath, "utf-8")

    const snippetContent = fs.existsSync(snippetPath) ? fs.readFileSync(snippetPath, "utf-8") : ""
    const res = parseSlidevPresentation(content, {
      virtualFiles: {
        "./pages/imported-slides.md": subContent,
        "@/snippets/external.ts": snippetContent,
      },
    })
    const resWithoutVirtual = parseSlidevPresentation(content)
    console.log("Without virtual files total slides:", resWithoutVirtual.totalSlides)
    const s14Without = resWithoutVirtual.slides[13]
    console.log("Slide 14 without virtual files:", JSON.stringify(s14Without))

    // 验证 Slide 5 中的代码切片语法 <<< 是否成功展开为真正的代码块
    const s5 = res.slides[4]
    expect(s5.rawMarkdown).toContain("```ts\n// Inside ./snippets/external.ts")
    expect(s5.rawMarkdown).toContain("export function emptyArray<T>(length: number)")
    expect(s5.rawMarkdown).not.toContain("<<< @/snippets/external.ts")

    // 验证 Slide 4 在指定 cleanSlots: false 时可保留插槽，默认时保留 Toc 完整
    const s4 = res.slides[3]
    expect(s4.rawMarkdown).toContain('<Toc minDepth="1" maxDepth="1" />')
    expect(s4.pageAttrs["custom-slidev-layout"]).toBe("two-cols")

    const resKeepSlots = parseSlidevPresentation(content, {
      cleanSlots: false,
      virtualFiles: {
        "./pages/imported-slides.md": subContent,
        "@/snippets/external.ts": snippetContent,
      },
    })
    expect(resKeepSlots.slides[3].rawMarkdown).toContain("::right::")

    // 验证 Slide 5 的 shiki 行号与 twoslash 被平滑清洗，保留代码语言与文件名
    expect(s5.rawMarkdown).toContain("```ts [filename-example.ts]")
    expect(s5.rawMarkdown).not.toContain("{all|4|6|6-7|9|all}")

    // 验证 Slide 6 的 4 反引号行内代码在 html-cleaner 下未损坏
    const s6 = res.slides[5]
    expect(s6.rawMarkdown).toContain("````` ````md magic-move `````")

    // 验证 Slide 1 中的 YAML 布尔值
    expect(res.docRootAttrs["custom-slidev-drawings"]).toBe(JSON.stringify({ persist: false }))

    const resBaseDir = parseSlidevPresentation(content, {
      baseDir: "D:/MyCodingProjects/slidev/demo/starter",
    })
    expect(resBaseDir.totalSlides).toBe(16)
    const s14BaseDir = resBaseDir.slides[13]
    expect(s14BaseDir.rawMarkdown).toContain("# Imported Slides")
    expect(s14BaseDir.rawMarkdown).toContain("#### `slides.md`")
  })

  it("should accurately round-trip compile into SiYuan blocks and build valid SlidevDocument", () => {
    const content = fs.readFileSync(starterPath, "utf-8")
    const res = parseSlidevPresentation(content, {
      baseDir: "D:/MyCodingProjects/slidev/demo/starter",
      cleanSlots: false,
    })

    // 模拟思源内核依据 flattenedMarkdown 与属性生成的 Block 树
    const mockBlocks: any[] = []

    res.slides.forEach((slide, idx) => {
      if (idx > 0) {
        // 各页之间的水平分割线
        mockBlocks.push({
          id: `divider-${idx}`,
          type: "tb",
          markdown: "---",
          ial: slide.pageAttrs,
        })
      }

      // 规范模拟思源内核块：多行代码块整体作为一个 block，其余按段落拆分
      const lines = slide.rawMarkdown.split(/\r?\n/)
      let inCode = false
      let codeBuf: string[] = []
      let pBuf: string[] = []

      function flushP() {
        const text = pBuf.join("\n").trim()
        if (text) {
          mockBlocks.push({
            id: `block-${idx}-${mockBlocks.length}`,
            type: text.startsWith("#") ? "h" : "p",
            content: text,
            markdown: text,
          })
        }
        pBuf = []
      }

      function flushCode() {
        const text = codeBuf.join("\n").trim()
        if (text) {
          mockBlocks.push({
            id: `block-${idx}-${mockBlocks.length}`,
            type: "c",
            content: text,
            markdown: text,
          })
        }
        codeBuf = []
      }

      for (let l of lines) {
        if (!inCode && l.trimStart().startsWith("```")) {
          flushP()
          inCode = true
          codeBuf.push(l)
        } else if (inCode) {
          codeBuf.push(l)
          if (l.trimStart().startsWith("```")) {
            inCode = false
            flushCode()
          }
        } else {
          if (!l.trim()) {
            flushP()
          } else {
            pBuf.push(l)
          }
        }
      }
      flushP()
      flushCode()
    })

    const doc = buildSlidevDocument("doc-starter", res.docRootAttrs, mockBlocks)
    doc.slides.forEach((s, i) => {
      console.log(`Page ${i + 1}: layout=${s.frontmatter.layout}, first block:`, s.blocks[0]?.rawMarkdown?.slice(0, 40))
    })
    expect(doc.slides.length).toBe(16)
    expect(doc.config.theme).toBe("seriph")
    expect(doc.config.defaultTransition).toBe("slide-left")

    // 验证 Slide 4 双栏布局：::right:: 成功将 Toc 分隔至右栏
    const s4 = doc.slides[3]
    expect(s4.frontmatter.layout).toBe("two-cols")
    expect(s4.blocks.some(b => b.slot === "right" && b.rawMarkdown.includes("Toc"))).toBe(true)

    // 验证 Slide 5 代码片段成功编译
    const s5 = doc.slides[4]
    expect(s5.rawMarkdown).toContain("export function emptyArray")

    // 验证最后一页
    const s16 = doc.slides[15]
    expect(s16.frontmatter.layout).toBe("center")
    expect(s16.frontmatter.class).toBe("text-center")
    expect(s16.rawMarkdown).toContain("PoweredBySlidev")
  })

  it("should automatically prefix with --- when content or flattenedMarkdown does not start with ---", () => {
    const rawNoFrontmatter = `# Page 1 Without Frontmatter

Content of slide 1

---

# Page 2

Content of slide 2`

    // 验证不以 --- 开头的输入会自动在第一段补充 ---
    const parsed = parseSlidevPresentation(rawNoFrontmatter)
    expect(parsed.totalSlides).toBe(2)
    expect(parsed.slides[0].rawMarkdown).toContain("# Page 1 Without Frontmatter")
    expect(parsed.slides[1].rawMarkdown).toContain("# Page 2")

    // 验证 flattenedMarkdown 必定以 --- 段落开头
    expect(parsed.flattenedMarkdown.startsWith("---\n\n")).toBe(true)

    // 验证本身以 --- 开头的文件，输出的 flattenedMarkdown 同样规范以 --- 开头
    const starterContent = fs.readFileSync(starterPath, "utf-8")
    const parsedStarter = parseSlidevPresentation(starterContent)
    expect(parsedStarter.flattenedMarkdown.startsWith("---\n\n")).toBe(true)
  })
})
