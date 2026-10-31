import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { parseSlidesPresentation } from "../src/compiler/slides-importer"

describe("Verify Starter Demo Import: D:/MyCodingProjects/slidev/demo/starter/slides.md", () => {
  const starterPath = "D:/MyCodingProjects/slidev/demo/starter/slides.md"
  const subPath = "D:/MyCodingProjects/slidev/demo/starter/pages/imported-slides.md"

  it("should accurately parse document attributes, pages, notes, and markdown contents", () => {
    expect(fs.existsSync(starterPath)).toBe(true)
    const content = fs.readFileSync(starterPath, "utf-8")
    const subContent = fs.existsSync(subPath) ? fs.readFileSync(subPath, "utf-8") : ""

    const res = parseSlidesPresentation(content, {
      virtualFiles: {
        "./pages/imported-slides.md": subContent,
      },
    })

    // 1. 文档根属性与统计验证
    expect(res.docTitle).toBe("Welcome to Slidev")
    expect(res.totalSlides).toBe(16)
    expect(res.docRootAttrs["custom-slides-theme"]).toBe("seriph")
    expect(res.docRootAttrs["custom-slides-background"]).toBe("https://cover.sli.dev")
    expect(res.docRootAttrs["custom-slides-class"]).toBe("text-center")
    expect(res.docRootAttrs["custom-slides-default-transition"]).toBe("slide-left")
    expect(res.docRootAttrs["custom-slides-comark"]).toBe("true")
    expect(res.docRootAttrs["custom-slides-duration"]).toBe("35min")
    // 验证多行 YAML 块标量跨空行完整保留
    expect(res.docRootAttrs["custom-slides-info"]).toContain("## Slidev Starter Template")
    expect(res.docRootAttrs["custom-slides-info"]).toContain("Learn more at [Sli.dev](https://sli.dev)")
    // 验证嵌套 YAML 字典解析为结构化 JSON，而非被拍平覆盖，布尔值准确保留
    expect(res.docRootAttrs["custom-slides-drawings"]).toBe(JSON.stringify({ persist: false }))
    expect(res.docRootAttrs["custom-slides-persist"]).toBeUndefined()
    expect(res.docRootAttrs["custom-slides-Learn more at [Sli.dev](https"]).toBeUndefined()

    // 2. 页面逐页精细验证
    // Slide 1 (Cover)
    const s1 = res.slides[0]
    expect(s1.pageAttrs["custom-slides-transition"]).toBe("slide-left")
    expect(s1.notes).toContain("The last comment block of each slide will be treated as slide notes")
    expect(s1.rawMarkdown).toContain('<div @click="$slidev.nav.next"')
    expect(s1.rawMarkdown).toContain("<carbon:arrow-right />")
    expect(s1.rawMarkdown).toContain('<button @click="$slidev.nav.openInEditor()"')
    expect(s1.rawMarkdown).toContain('<a href="https://github.com/slidevjs/slidev"')

    // Slide 2 (What is Slidev?)
    const s2 = res.slides[1]
    expect(s2.pageAttrs["custom-slides-transition"]).toBe("fade-out")
    expect(s2.notes).toBe("Here is another comment.")
    expect(s2.notes).not.toContain("Learn more: https://sli.dev/features/slide-scope-style")
    expect(res.customCss).toContain("background-color: #2B90B6;")
    expect(s2.rawMarkdown).toContain("# What is Slidev?")

    // Slide 3 (Navigation & Shortcuts)
    const s3 = res.slides[2]
    expect(s3.pageAttrs["custom-slides-transition"]).toBe("slide-up")
    expect(s3.pageAttrs["custom-slides-level"]).toBe("2")
    expect(s3.notes).toBe("")
    expect(s3.rawMarkdown).toContain("<kbd>right</kbd>")
    expect(s3.rawMarkdown).toContain("<img\n  v-click\n  class=\"absolute -bottom-9 -left-7 w-80 opacity-50\"")
    expect(s3.rawMarkdown).toContain('<p v-after class="absolute bottom-23 left-45 opacity-30 transform -rotate-10">Here!</p>')

    // Slide 4 (Table of contents)
    const s4 = res.slides[3]
    expect(s4.pageAttrs["custom-slides-layout"]).toBe("two-cols")
    expect(s4.pageAttrs["custom-slides-layoutClass"]).toBe("gap-16")
    expect(s4.rawMarkdown).toContain('<Toc minDepth="1" maxDepth="1" />')

    // Slide 5 (Code & Click Sync Notes)
    const s5 = res.slides[4]
    expect(s5.pageAttrs["custom-slides-layout"]).toBe("image-right")
    expect(s5.pageAttrs["custom-slides-image"]).toBe("https://cover.sli.dev")
    expect(s5.notes).toContain("[click] Highlighted with `count = ref(0)`")
    expect(s5.notes).not.toContain("__CODE_TOKEN_NOTE_")
    expect(s5.notes).not.toContain("This allow you to embed external code blocks")
    expect(s5.rawMarkdown).toContain("```ts [filename-example.ts]")
    expect(s5.rawMarkdown).toContain('<arrow v-click="[4, 5]"')

    // Slide 6 (Shiki Magic Move)
    const s6 = res.slides[5]
    expect(s6.pageAttrs["custom-slides-level"]).toBe("2")
    expect(s6.notes).toBe("") // 代码块内的 <!-- step 4 --> 绝不被识别为 notes
    expect(s6.rawMarkdown).toContain("````md magic-move {lines: true}")

    // Slide 7 (Components)
    const s7 = res.slides[6]
    expect(s7.notes).toContain("Presenter note with **bold**, *italic*, and ~~striked~~ text.")
    expect(s7.notes).not.toContain("<!-- ./components/Counter.vue -->")
    expect(s7.rawMarkdown).toContain('<div grid="~ cols-2 gap-4">')
    expect(s7.rawMarkdown).toContain('<Counter :count="10" />')
    expect(s7.rawMarkdown).toContain('<Tweet id="1390115482657726468"')

    // Slide 8 (Themes)
    const s8 = res.slides[7]
    expect(s8.pageAttrs["custom-slides-class"]).toBe("px-20")
    expect(s8.rawMarkdown).toContain('<div grid="~ cols-2 gap-2" m="t-2">')

    // Slide 9 (Clicks Animations)
    const s9 = res.slides[8]
    expect(s9.rawMarkdown).toContain('<div v-click>')
    expect(s9.rawMarkdown).toContain('<p v-click>')
    expect(s9.rawMarkdown).toContain('<div class="grid gap-3 mt-4 text-sm"')
    expect(s9.rawMarkdown).toContain("v-after.up")
    expect(s9.rawMarkdown).toContain('<span v-mark.red="7">')

    // Slide 10 (Motions)
    const s10 = res.slides[9]
    expect(s10.notes).toBe("") // 内部注释不被误判为 notes
    expect(s10.rawMarkdown).toContain('<div class="w-60 relative">')
    expect(s10.rawMarkdown).toContain('<div class="relative w-40 h-40">')
    expect(s10.rawMarkdown).toContain('<script setup lang="ts">')
    expect(s10.rawMarkdown).toContain("const final = {")

    // Slide 11 (LaTeX)
    const s11 = res.slides[10]
    expect(s11.rawMarkdown).toContain("<div h-3 />")
    expect(s11.rawMarkdown).toContain("Inline $\\sqrt{3x-1}+(1+x)^2$")
    // 验证数学公式块中的 Slidev 渐进展示修饰符被清洗为标准双美元符号
    expect(s11.rawMarkdown).toContain("Block\n$$\n\\begin{aligned}")

    // Slide 12 (Diagrams)
    const s12 = res.slides[11]
    expect(s12.rawMarkdown).toContain('<div class="grid grid-cols-4 gap-5 pt-4 -mb-6">')
    expect(s12.rawMarkdown).toContain("```mermaid\nsequenceDiagram")
    expect(s12.rawMarkdown).toContain("```plantuml\n@startuml")

    // Slide 13 (Draggable Elements)
    const s13 = res.slides[12]
    expect(s13.pageAttrs["custom-slides-foo"]).toBe("bar")
    expect(s13.pageAttrs["custom-slides-dragPos"]).toBe(JSON.stringify({ square: "548,306,167,_,252" }))
    expect(s13.rawMarkdown).toContain('<v-drag pos="663,206,261,_,-15">')
    expect(s13.rawMarkdown).toContain("<v-drag-arrow pos=")

    // Slide 14 (Imported Slides)
    const s14 = res.slides[13]
    expect(s14.pageAttrs["custom-slides-hide"]).toBe("false") // 成功继承父文件属性
    expect(s14.rawMarkdown).toContain("# Imported Slides")
    expect(s14.rawMarkdown).toContain("#### `slides.md`")

    // Slide 15 (Monaco Editor)
    const s15 = res.slides[14]
    expect(s15.rawMarkdown).toContain("```ts\nimport { ref } from 'vue'")

    // Slide 16 (Learn More)
    const s16 = res.slides[15]
    expect(s16.pageAttrs["custom-slides-layout"]).toBe("center")
    expect(s16.pageAttrs["custom-slides-class"]).toBe("text-center")
    expect(s16.rawMarkdown).toContain("<PoweredBySlidev mt-10 />")
  })
})
