import { describe, expect, it } from "vitest"
import {
  isLocalAssetUrl,
  normalizeAssetPath,
  rewriteAssetPaths,
  rewriteSingleAssetUrl,
} from "../src/compiler/assets-rewriter"
import {
  extractBlockMarkdown,
  flattenBlockTree,
  parseKramdownIAL,
} from "../src/compiler/ast-crawler"
import {
  isPageBreak,
  parseDocumentConfig,
  parseElementAttrs,
  parsePageAttrs,
} from "../src/compiler/scope-mapper"
import {
  buildSlidesDocument,
  extractCleanNoteText,
  getMotionDirectives,
  injectShikiSpotlight,
  stringifyFrontmatter,
  wrapElementDirectives,
  wrapVClickDirective,
} from "../src/compiler/slides-ast-builder"

describe("Scope Mapper (三层作用域解析)", () => {
  it("应该正确解析文档全局属性 (Document Scope)", () => {
    const docAttrs = {
      "custom-slides-theme": "seriph",
      "custom-slides-aspect-ratio": "4/3",
      "custom-slides-highlighter": "shiki",
      "custom-slides-default-transition": "fade",
      "custom-slides-color-schema": "dark",
      "custom-slides-spacing": "compact",
    }
    const config = parseDocumentConfig(docAttrs)
    expect(config.theme).toBe("seriph")
    expect(config.aspectRatio).toBe("4/3")
    expect(config.defaultTransition).toBe("fade")
    expect(config.colorSchema).toBe("dark")
    expect(config.spacing).toBe("compact")
  })

  it("当无文档属性时应提供稳定默认值", () => {
    const config = parseDocumentConfig(null)
    expect(config.theme).toBe("apple-basic")
    expect(config.aspectRatio).toBe("16/9")
    expect(config.defaultTransition).toBe("slide-left")
    expect(config.spacing).toBe("normal")
  })

  it("应该准确识别水平分割线与分页标记", () => {
    expect(isPageBreak({ id: "1", type: "thematic-break" })).toBe(true)
    expect(isPageBreak({ id: "2", type: "b", markdown: "---" })).toBe(true)
    expect(isPageBreak({ id: "3", type: "p", ial: { "custom-slides-slide": "true" } })).toBe(true)
    expect(isPageBreak({ id: "4", type: "p", markdown: "普通段落" })).toBe(false)
    expect(isPageBreak({ id: "5", type: "tb", markdown: "---" })).toBe(true)
    expect(isPageBreak({ id: "6", type: "NodeThematicBreak" })).toBe(true)
    expect(isPageBreak({ id: "7", type: "tb" })).toBe(true)
  })

  it("应该正确解析页面级属性 (Page Scope)", () => {
    const pageAttrs = {
      "custom-slides-layout": "two-cols",
      "custom-slides-transition": "slide-up",
      "custom-slides-background": "assets/bg.jpg",
      "custom-slides-notes": "这是演讲备忘录",
      "custom-slides-spacing": "loose",
    }
    const { frontmatter, notes } = parsePageAttrs(pageAttrs)
    expect(frontmatter.layout).toBe("two-cols")
    expect(frontmatter.transition).toBe("slide-up")
    expect(frontmatter.background).toBe("assets/bg.jpg")
    expect(frontmatter.spacing).toBe("loose")
    expect(notes).toBe("这是演讲备忘录")
  })

  it("应该正确解析元素动效级属性 (Element Scope)", () => {
    const elemAttrs = {
      "custom-slides-click": "+1",
      "custom-slides-motion": JSON.stringify({ preset: "fade-in", duration: 300 }),
      "custom-slides-shiki-lines": "1-3|5",
      "custom-slides-slot": "right",
    }
    const parsed = parseElementAttrs(elemAttrs)
    expect(parsed.clicks).toBe("+1")
    expect(parsed.motion).toEqual({ preset: "fade-in", duration: 300 })
    expect(parsed.shikiLines).toBe("1-3|5")
    expect(parsed.slot).toBe("right")
  })
})

describe("Assets Rewriter (本地资产代理重写器)", () => {
  it("应该准确识别 assets 相对路径并规范化", () => {
    expect(isLocalAssetUrl("assets/pic.png")).toBe(true)
    expect(isLocalAssetUrl("./assets/pic.png")).toBe(true)
    expect(isLocalAssetUrl("/assets/pic.png")).toBe(true)
    expect(isLocalAssetUrl("https://example.com/pic.png")).toBe(false)

    expect(normalizeAssetPath("./assets/pic.png")).toBe("assets/pic.png")
    expect(normalizeAssetPath("/assets/pic.png")).toBe("assets/pic.png")
  })

  it("应该将 assets 路径拼接为带 baseUrl 的绝对代理地址", () => {
    const options = { baseUrl: "http://127.0.0.1:6806" }
    expect(rewriteSingleAssetUrl("assets/pic.png", options)).toBe("http://127.0.0.1:6806/assets/pic.png")
  })

  it("应该在 Markdown 图片与 HTML 中批量替换 assets 地址", () => {
    const options = { baseUrl: "http://127.0.0.1:6806" }
    const input = "一段文字 ![演示图](assets/demo.png) 还有 <img src=\"./assets/logo.svg\" />"
    const output = rewriteAssetPaths(input, options)
    expect(output).toContain("![演示图](http://127.0.0.1:6806/assets/demo.png)")
    expect(output).toContain("<img src=\"http://127.0.0.1:6806/assets/logo.svg\" />")
  })
})

describe("AST Crawler & Kramdown Parser", () => {
  it("应该正确解析 Kramdown IAL 属性", () => {
    const ial = '{: id="20261003-abc" custom-slides-layout="cover" updated="20261003"}'
    const attrs = parseKramdownIAL(ial)
    expect(attrs.id).toBe("20261003-abc")
    expect(attrs["custom-slides-layout"]).toBe("cover")
    expect(attrs.updated).toBe("20261003")
  })

  it("应该正确展平树形块结构", () => {
    const tree = [
      {
        id: "1",
        type: "p",
        children: [
          { id: "1-1", type: "p" },
          { id: "1-2", type: "p" },
        ],
      },
      { id: "2", type: "p" },
    ]
    const flat = flattenBlockTree(tree)
    expect(flat.length).toBe(4)
    expect(flat.map(n => n.id)).toEqual(["1", "1-1", "1-2", "2"])
  })
})

describe("Slidev AST Builder (核心虚拟文档构建器)", () => {
  it("应该正确包装 v-click 指令与注入 Shiki spotlight", () => {
    expect(wrapVClickDirective("# 标题", "+1")).toBe("<v-click>\n\n# 标题\n\n</v-click>")
    expect(wrapVClickDirective("# 标题", "2")).toBe("<v-click at=\"2\">\n\n# 标题\n\n</v-click>")

    const code = "```ts\nconst a = 1\n```"
    expect(injectShikiSpotlight(code, "1-2|4")).toBe("```ts {1-2|4}\nconst a = 1\n```")
  })

  it("应该正确映射预设微动效并生成 Slidev v-motion 配置", () => {
    // 基础 slide-up 预设
    const m1 = getMotionDirectives({ preset: "slide-up" })
    expect(m1).not.toBeNull()
    expect(m1?.initial).toEqual({ y: 40, opacity: 0 })
    expect(m1?.enter).toEqual({ y: 0, opacity: 1 })

    // 带 duration 与 delay 的自定义预设
    const m2 = getMotionDirectives({ preset: "fade-in", duration: 500, delay: 200 })
    expect(m2).not.toBeNull()
    expect(m2?.initial).toEqual({ opacity: 0 })
    expect(m2?.enter.transition).toEqual({ duration: 500, delay: 200 })

    // bounce 弹性预设
    const m3 = getMotionDirectives({ preset: "bounce" })
    expect(m3?.enter.transition.type).toBe("spring")
  })

  it("应该通过 wrapElementDirectives 复合生成 v-click 与 v-motion 容器", () => {
    // 纯 motion
    const onlyMotion = wrapElementDirectives("段落内容", undefined, { preset: "slide-up" })
    expect(onlyMotion).toContain("v-motion")
    expect(onlyMotion).toContain(":initial=\"{'y':40,'opacity':0}\"")
    expect(onlyMotion).toContain(":enter=\"{'y':0,'opacity':1}\"")
    expect(onlyMotion).not.toContain("v-click")

    // 纯 v-click
    const onlyClick = wrapElementDirectives("段落内容", "+1", undefined)
    expect(onlyClick).toBe("<v-click>\n\n段落内容\n\n</v-click>")

    // 复合 v-click + motion
    const composite = wrapElementDirectives("重点结论", "+1", { preset: "fade-in" })
    expect(composite).toContain("<div v-click v-motion")
    expect(composite).toContain("重点结论")

    // 指定步长复合
    const compositeStep = wrapElementDirectives("第二步弹出", "2", { preset: "zoom-in" })
    expect(compositeStep).toContain("<div v-click=\"2\" v-motion")
    expect(compositeStep).toContain("第二步弹出")
  })

  it("应该将两段文字经由 --- 分割线准确拆分为两页幻灯片", () => {
    const blocks = [
      {
        id: "block-1",
        type: "h",
        markdown: "# 第一页标题",
      },
      {
        id: "divider-1",
        type: "thematic-break",
        markdown: "---",
        ial: {
          "custom-slides-layout": "two-cols",
        },
      },
      {
        id: "block-2",
        type: "p",
        markdown: "第二页正文内容",
        ial: {
          "custom-slides-click": "+1",
        },
      },
      {
        id: "note-block-2",
        type: "b",
        markdown: "> 💡 **演讲备注**\n> 第二页讲师提示",
        ial: {
          "custom-slides-note": "true",
        },
      },
    ]

    const doc = buildSlidesDocument("doc-1", { "custom-slides-theme": "apple-basic" }, blocks)

    expect(doc.slides.length).toBe(2)
    // 第一页为封面
    expect(doc.slides[0].pageIndex).toBe(1)
    expect(doc.slides[0].frontmatter.layout).toBe("cover")
    expect(doc.slides[0].blocks[0].rawMarkdown).toBe("# 第一页标题")

    // 第二页由分割线定义
    expect(doc.slides[1].pageIndex).toBe(2)
    expect(doc.slides[1].frontmatter.layout).toBe("two-cols")
    expect(doc.slides[1].notes).toBe("第二页讲师提示")
    expect(doc.slides[1].blocks.length).toBe(1) // 讲稿备注块被排除在幻灯片正文块之外
    expect(doc.slides[1].blocks[0].clicks).toBe("+1")

    // 验证 Markdown 生成完整性
    expect(doc.fullMarkdown).toContain("theme: apple-basic")
    expect(doc.fullMarkdown).toContain("layout: two-cols")
    expect(doc.fullMarkdown).toContain("<v-click>")
    expect(doc.fullMarkdown).toContain("<!--\n第二页讲师提示\n-->")
  })

  it("应该正确处理以 --- 开头的多段落分割，并保持 4 页独立且顺序一致", () => {
    const blocks = [
      { id: "div-0", type: "tb", markdown: "---" },
      { id: "h-1", type: "h", content: "第一段", markdown: "## 第一段" },
      { id: "div-1", type: "tb", markdown: "---" },
      { id: "h-2", type: "h", content: "第二段", markdown: "## 第二段" },
      { id: "div-2", type: "tb", markdown: "---" },
      { id: "h-3", type: "h", content: "第三段", markdown: "## 第三段" },
      { id: "div-3", type: "tb", markdown: "---" },
      { id: "p-4", type: "p", content: "测试", markdown: "测试" },
    ]

    const doc = buildSlidesDocument("doc-test", null, blocks)

    expect(doc.slides.length).toBe(4)
    expect(doc.slides[0].pageIndex).toBe(1)
    expect(doc.slides[0].blocks[0].content).toBe("第一段")

    expect(doc.slides[1].pageIndex).toBe(2)
    expect(doc.slides[1].blocks[0].content).toBe("第二段")

    expect(doc.slides[2].pageIndex).toBe(3)
    expect(doc.slides[2].blocks[0].content).toBe("第三段")

    expect(doc.slides[3].pageIndex).toBe(4)
    expect(doc.slides[3].blocks[0].content).toBe("测试")

    // 确保没有分割线残留在内容块中
    for (const slide of doc.slides) {
      for (const b of slide.blocks) {
        expect(b.rawMarkdown).not.toBe("---")
      }
    }
  })

  it("buildSlidesDocument 应在提供 refContentMap 时成功展开块引用 ((block-id))", () => {
    const blocks = [
      {
        id: "b-ref-test",
        type: "p",
        markdown: "前文结论为：((target-block-1 \"旧标题\"))，更多请见 ((target-block-2))",
      },
    ]

    const doc = buildSlidesDocument("doc-ref", {}, blocks, {
      refContentMap: {
        "target-block-1": "这是引用的真实实时内容",
      },
    })

    const slideContent = doc.slides[0].rawMarkdown
    // 已提供的 target-block-1 展开为卡片
    expect(slideContent).toContain('class="slides-block-ref"')
    expect(slideContent).toContain("这是引用的真实实时内容")
    expect(slideContent).toContain('data-ref-id="target-block-1"')

    // 未提供的 target-block-2 降级为 tag 标签
    expect(slideContent).toContain('class="slides-ref-tag"')
    expect(slideContent).toContain('data-ref-id="target-block-2"')
  })

  it("extractCleanNoteText 应准确剥离提示块、引述块、列表项的前缀修饰与 IAL 属性", () => {
    // 提示块剥离
    const calloutMd = "> 💡 **演讲备注**\n> 请引导大家回顾上一页的要点。\n{: custom-slides-note=\"true\"}"
    expect(extractCleanNoteText(calloutMd)).toBe("请引导大家回顾上一页的要点。")

    // 带冒号的提示块前缀
    const calloutColonMd = "> 💡 演讲备注：注意观察听众反应"
    expect(extractCleanNoteText(calloutColonMd)).toBe("注意观察听众反应")

    // 常规引述块
    const quoteMd = "> 此处需做 30 秒停留"
    expect(extractCleanNoteText(quoteMd)).toBe("此处需做 30 秒停留")

    // 列表项剥离
    const listMd = "* 重点强调开源社区的贡献"
    expect(extractCleanNoteText(listMd)).toBe("重点强调开源社区的贡献")

    // 有序列表项剥离
    const orderedListMd = "1. 第一点核心结论"
    expect(extractCleanNoteText(orderedListMd)).toBe("第一点核心结论")
  })

  it("buildSlidesDocument 应支持在同页内包含提示块、引用块及列表项多个备注块，并自动合并为讲稿且排除渲染", () => {
    const blocks = [
      { id: "h1", type: "h", content: "页标题", markdown: "# 页标题" },
      { id: "p1", type: "p", content: "常规段落内容", markdown: "常规段落内容" },
      {
        id: "note-1",
        type: "b",
        markdown: "> 💡 **演讲备注**\n> 这是第一条提词要点\n{: custom-slides-note=\"true\"}",
        ial: { "custom-slides-note": "true" },
      },
      {
        id: "note-2",
        type: "i",
        markdown: "* 这是第二条列表形式的提词要点",
        ial: { "slides-note": "true" }, // 兼容 slidev-note
      },
      { id: "p2", type: "p", content: "末尾常规段落", markdown: "末尾常规段落" },
    ]

    const doc = buildSlidesDocument("doc-multi-notes", null, blocks)

    expect(doc.slides.length).toBe(1)
    const slide = doc.slides[0]

    // 只有 3 个正文块（h1, p1, p2），note-1 和 note-2 被成功排除
    expect(slide.blocks.length).toBe(3)
    expect(slide.blocks.map(b => b.id)).toEqual(["h1", "p1", "p2"])

    // noteBlocks 应记录这两个备注块
    expect(slide.noteBlocks?.length).toBe(2)
    expect(slide.noteBlocks?.[0].id).toBe("note-1")
    expect(slide.noteBlocks?.[1].id).toBe("note-2")

    // notes 应自动换行合并
    expect(slide.notes).toBe("这是第一条提词要点\n\n这是第二条列表形式的提词要点")

    // 最终生成的 Slidev Markdown 应注入讲稿注释，且正文中不含备注块内容
    expect(slide.rawMarkdown).toContain("<!--\n这是第一条提词要点\n\n这是第二条列表形式的提词要点\n-->")
    expect(slide.rawMarkdown).not.toContain("💡 **演讲备注**")
    expect(slide.rawMarkdown).toContain("# 页标题")
    expect(slide.rawMarkdown).toContain("末尾常规段落")
  })

  it("extractCleanNoteText 应准确剥离思源原生 Callout 提示块 ([!NOTE] / [!TIP]) 及各种前缀", () => {
    // 1. 标准 Callout 提示块带标题
    const callout1 = `> [!NOTE] 💡 演讲备注\n> 这里是纯净的提词内容第一行\n> 这里是第二行\n{: custom-slides-note="true"}`
    expect(extractCleanNoteText(callout1)).toBe("这里是纯净的提词内容第一行\n这里是第二行")

    // 2. 带 Tip 提示块及 Obsidian 风格
    const callout2 = `> [!TIP]\n> 💡 **演讲备注**：\n> 重点讲解核心设计原则`
    expect(extractCleanNoteText(callout2)).toBe("重点讲解核心设计原则")

    // 3. 普通引述块与容器语法
    const callout3 = `::: tip\n> 讲稿备注：引导观众关注右侧图表\n:::`
    expect(extractCleanNoteText(callout3)).toBe("引导观众关注右侧图表")

    // 4. 英文 Notes: 格式
    const callout4 = `> Notes: Remember to switch the camera`
    expect(extractCleanNoteText(callout4)).toBe("Remember to switch the camera")
  })
})
