import { describe, expect, it } from "vitest"
import {
  convertBlockToHtml,
  formatInlineMarkdown,
  renderMarkdownList,
} from "../src/export/markdown-renderer"
import { buildSlidevDocument } from "../src/compiler/slidev-ast-builder"
import type { ISiYuanBlockNode, ISlidevBlockItem } from "../src/types/slidev-protocol"

describe("Media and List GIF Support (MP4 视频与列表项内 GIF 支持)", () => {
  describe("formatInlineMarkdown (行内 Markdown 与媒体标签放行)", () => {
    it("应正确渲染行内图片语法 ![alt](src) 而非被错误解析为超链接", () => {
      const raw = "这是普通文字，附带一张动图 ![演示GIF](assets/demo.gif) 与一个 [正常链接](https://siyuan.io)"
      const formatted = formatInlineMarkdown(raw)

      expect(formatted).toContain('<img alt="演示GIF" src="assets/demo.gif"')
      expect(formatted).toContain('class="slide-inline-img list-item-gif"')
      expect(formatted).not.toContain('!<a href="assets/demo.gif"')
      expect(formatted).toContain('<a href="https://siyuan.io"')
    })

    it("应安全放行 HTML 原生 img 标签与属性", () => {
      const raw = '步骤一：<img src="assets/step1.gif" alt="第一步" class="my-custom-gif" /> 完成'
      const formatted = formatInlineMarkdown(raw)

      expect(formatted).toContain('<img src="assets/step1.gif" alt="第一步" class="my-custom-gif"')
      expect(formatted).not.toContain("&lt;img")
    })

    it("应安全放行 HTML 原生 video 与 source 标签", () => {
      const raw = '<video controls src="assets/clip.mp4"><source src="assets/clip.mp4" type="video/mp4" /></video>'
      const formatted = formatInlineMarkdown(raw)

      expect(formatted).toContain('<video controls src="assets/clip.mp4">')
      expect(formatted).toContain('<source src="assets/clip.mp4" type="video/mp4"')
      expect(formatted).not.toContain("&lt;video")
      expect(formatted).not.toContain("&lt;source")
    })
  })

  describe("renderMarkdownList (列表项内 GIF 容器化渲染)", () => {
    it("列表项下的 GIF 图片必须渲染在当前 li 容器内部，而非列表项之后", () => {
      const md = `* 步骤一：点击主界面左上角的演示按钮
  ![点击演示](assets/click-present.gif)
* 步骤二：进入全屏播放`

      const html = renderMarkdownList(md)
      expect(html).not.toBeNull()

      // 验证总共有 2 个 li
      const liMatches = html!.match(/<li[\s\S]*?<\/li>/gi)
      expect(liMatches).toHaveLength(2)

      const firstLi = liMatches![0]
      // 验证 GIF 存在于第一个 li 内部
      expect(firstLi).toContain("步骤一：点击主界面左上角的演示按钮")
      expect(firstLi).toContain('<div class="slide-list-media">')
      expect(firstLi).toContain('<img alt="点击演示" src="assets/click-present.gif"')
      expect(firstLi).toContain('class="list-item-gif"')

      // 第二个 li 不应包含该 GIF
      const secondLi = liMatches![1]
      expect(secondLi).toContain("步骤二：进入全屏播放")
      expect(secondLi).not.toContain("click-present.gif")
    })

    it("支持列表项下包含 HTML 格式的 img 标签并在 li 容器内生成媒体容器", () => {
      const md = `- 功能特性展示
  <img src="assets/feature.gif" alt="特性演示" />
- 另一个说明项`

      const html = renderMarkdownList(md)
      expect(html).not.toBeNull()

      const liMatches = html!.match(/<li[\s\S]*?<\/li>/gi)
      expect(liMatches).toHaveLength(2)

      const firstLi = liMatches![0]
      expect(firstLi).toContain("功能特性展示")
      expect(firstLi).toContain('<div class="slide-list-media">')
      expect(firstLi).toContain('<img src="assets/feature.gif" alt="特性演示"')
    })

    it("多个列表项各自拥有 GIF 时，应各自在其独立的 li 容器内呈现", () => {
      const md = `1. 第一阶段
   ![阶段1](assets/p1.gif)
2. 第二阶段
   ![阶段2](assets/p2.gif)`

      const html = renderMarkdownList(md)
      expect(html).not.toBeNull()

      const liMatches = html!.match(/<li[\s\S]*?<\/li>/gi)
      expect(liMatches).toHaveLength(2)

      expect(liMatches![0]).toContain("第一阶段")
      expect(liMatches![0]).toContain("assets/p1.gif")
      expect(liMatches![0]).not.toContain("assets/p2.gif")

      expect(liMatches![1]).toContain("第二阶段")
      expect(liMatches![1]).toContain("assets/p2.gif")
      expect(liMatches![1]).not.toContain("assets/p1.gif")
    })
  })

  describe("convertBlockToHtml (MP4 视频块级渲染)", () => {
    it("应将原生思源视频块或 video 标签渲染为带播放器的视频容器", () => {
      const videoBlock: ISlidevBlockItem = {
        id: "vid-1",
        rawMarkdown: '<video controls="controls" src="assets/intro.mp4" data-src="assets/intro.mp4"></video>',
        attributes: {},
      }

      const html = convertBlockToHtml(videoBlock)
      expect(html).toContain('slide-video-container')
      expect(html).toContain("<video")
      expect(html).toContain('src="assets/intro.mp4"')
      expect(html).toContain("controls")
      expect(html).toContain('class="slide-video-player"')
      expect(html).not.toContain("&lt;video")
    })

    it("应支持从 custom-slidev 属性注入 autoplay, loop, muted 配置", () => {
      const videoBlock: ISlidevBlockItem = {
        id: "vid-2",
        rawMarkdown: '<video controls="controls" src="assets/bg-loop.mp4"></video>',
        attributes: {
          "custom-slidev-autoplay": "true",
          "custom-slidev-loop": "true",
          "custom-slidev-muted": "true",
        },
      }

      const html = convertBlockToHtml(videoBlock)
      expect(html).toContain("autoplay")
      expect(html).toContain("loop")
      expect(html).toContain("muted")
      expect(html).toContain("playsinline")
    })

    it("当配置 custom-slidev-controls=\"false\" 时应隐藏控制条", () => {
      const videoBlock: ISlidevBlockItem = {
        id: "vid-3",
        rawMarkdown: '<video controls="controls" src="assets/clean.mp4"></video>',
        attributes: {
          "custom-slidev-controls": "false",
        },
      }

      const html = convertBlockToHtml(videoBlock)
      expect(html).not.toContain('controls=""')
      expect(html).not.toContain(" controls ")
    })
  })

  describe("buildSlidevDocument (AST 编译期对视频块的处理)", () => {
    it("思源 NodeVideo 节点应被正确编译并保留视频标记与属性", () => {
      const docId = "doc-video-test"
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "h-1",
          type: "h",
          markdown: "# 视频演示页面",
          ial: {},
        },
        {
          id: "v-1",
          type: "video",
          markdown: '<video controls="controls" src="assets/demo.mp4"></video>',
          ial: {
            "custom-slidev-autoplay": "true",
            "custom-slidev-loop": "true",
          },
        },
      ]

      const doc = buildSlidevDocument(docId, {}, blocks, {})
      expect(doc.slides).toHaveLength(1)
      const slide = doc.slides[0]

      const vBlock = slide.blocks.find(b => b.id === "v-1")
      expect(vBlock).toBeDefined()
      expect(vBlock!.rawMarkdown).toContain("<video")
      expect(vBlock!.attributes?.["custom-slidev-autoplay"]).toBe("true")
      expect(vBlock!.attributes?.["custom-slidev-loop"]).toBe("true")

      // 在生成的 fullMarkdown 中也应包含该视频定义
      expect(doc.fullMarkdown).toContain("<video")
      expect(doc.fullMarkdown).toContain("assets/demo.mp4")
    })
  })

  describe("媒体可视区域最大化自适应与防溢出", () => {
    it("图片块应包含 slide-media-block 与 slide-media-container 类，便于 Flex 弹性最大化排版", () => {
      const imgBlock: ISlidevBlockItem = {
        id: "img-1",
        rawMarkdown: "![系统架构](assets/arch.png)",
        attributes: {},
      }

      const html = convertBlockToHtml(imgBlock)
      expect(html).toContain("slide-media-block")
      expect(html).toContain("slide-media-container")
      expect(html).toContain("slide-media-img")
      expect(html).toContain('src="assets/arch.png"')
    })

    it("视频块应包含 slide-media-block 与 slide-media-container 类", () => {
      const videoBlock: ISlidevBlockItem = {
        id: "vid-adaptive",
        rawMarkdown: '<video src="assets/tour.mp4"></video>',
        attributes: {},
      }

      const html = convertBlockToHtml(videoBlock)
      expect(html).toContain("slide-media-block")
      expect(html).toContain("slide-media-container")
      expect(html).toContain("slide-video-player")
    })

    it("单文件 HTML 导出器应注入多媒体最大化自适应及防溢出核心规则", async () => {
      const { buildStandaloneHtml } = await import("../src/export/single-html-exporter")
      const testDoc = {
        docId: "doc-media-export",
        title: "Media Presentation",
        config: { theme: "default", aspectRatio: "16/9", highlighter: "shiki" as const, defaultTransition: "slide-left", colorSchema: "dark" as const },
        slides: [
          {
            pageIndex: 1,
            startBlockId: "p1",
            frontmatter: { layout: "default" },
            notes: "",
            blocks: [
              { id: "b1", type: "h", content: "# 演示", rawMarkdown: "# 演示" },
              { id: "b2", type: "p", content: "![动图](assets/demo.gif)", rawMarkdown: "![动图](assets/demo.gif)" },
            ],
            rawMarkdown: "# 演示\n![动图](assets/demo.gif)",
          },
        ],
        fullMarkdown: "",
        assetMap: {},
      }

      const html = await buildStandaloneHtml(testDoc)
      expect(html).toContain(".slide-media-block")
      expect(html).toContain(".slide-media-container")
      expect(html).toContain("object-fit: contain")
      expect(html).toContain("flex: 1 1 0%")
      expect(html).toContain("max-height: 100%")
      expect(html).toContain("max-height: min(340px, 42vh)")
    })
  })

  describe("超级块与列表嵌套视频属性继承与三栏布局自适应", () => {
    it("父列表项或超级块应继承子节点中视频块的 custom-slidev-autoplay 等播放属性", () => {
      const docId = "doc-video-inheritance"
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "h-title",
          type: "h",
          markdown: "## 三栏视频演示",
          ial: {},
        },
        {
          id: "sb-cols",
          type: "sb",
          markdown: "",
          ial: {
            "custom-slidev-layout": "three-cols-header",
          },
          children: [
            {
              id: "col-1",
              type: "p",
              markdown: "第一栏说明文本",
              ial: { "custom-slidev-slot": "col-1" },
            },
            {
              id: "col-2",
              type: "p",
              markdown: "第二栏说明文本",
              ial: { "custom-slidev-slot": "col-2" },
            },
            {
              id: "col-3",
              type: "p",
              markdown: '<video src="assets/sample.mp4"></video>',
              ial: { "custom-slidev-slot": "col-3" },
              children: [
                {
                  id: "vid-nested",
                  type: "video",
                  markdown: '<video src="assets/sample.mp4"></video>',
                  ial: {
                    "custom-slidev-autoplay": "true",
                    "custom-slidev-muted": "true",
                  },
                },
              ],
            },
          ],
        },
      ]

      const doc = buildSlidevDocument(docId, {}, blocks, {})
      expect(doc.slides).toHaveLength(1)
      const slide = doc.slides[0]

      const col3Block = slide.blocks.find(b => b.id === "col-3")
      expect(col3Block).toBeDefined()
      expect(col3Block!.attributes?.["custom-slidev-autoplay"]).toBe("true")
      expect(col3Block!.attributes?.["custom-slidev-muted"]).toBe("true")
      expect(col3Block!.rawMarkdown).toContain("autoplay")
      expect(col3Block!.rawMarkdown).toContain("muted")
    })

    it("单文件 HTML 导出中应包含针对分栏视频的 max-height: min(100%, 340px, 44vh) 约束与 stretch 对齐", async () => {
      const { buildStandaloneHtml } = await import("../src/export/single-html-exporter")
      const testDoc = {
        docId: "doc-three-cols-export",
        title: "Three Cols Presentation",
        config: { theme: "default", aspectRatio: "16/9", highlighter: "shiki" as const, defaultTransition: "slide-left", colorSchema: "dark" as const },
        slides: [
          {
            pageIndex: 1,
            startBlockId: "p1",
            frontmatter: { layout: "three-cols-header" },
            notes: "",
            blocks: [
              { id: "h1", type: "h", content: "## 三栏头部", rawMarkdown: "## 三栏头部", slot: "header" },
              { id: "c1", type: "p", content: "第一栏", rawMarkdown: "第一栏", slot: "col-1" },
              { id: "c2", type: "p", content: "第二栏", rawMarkdown: "第二栏", slot: "col-2" },
              {
                id: "c3",
                type: "p",
                content: '<video src="assets/vertical.mp4"></video>',
                rawMarkdown: '<video src="assets/vertical.mp4"></video>',
                slot: "col-3",
                attributes: { "custom-slidev-autoplay": "true" },
              },
            ],
            rawMarkdown: "## 三栏头部\n::col-1::\n第一栏\n::col-2::\n第二栏\n::col-3::\n<video src=\"assets/vertical.mp4\"></video>",
          },
        ],
        fullMarkdown: "",
        assetMap: {},
      }

      const html = await buildStandaloneHtml(testDoc)
      expect(html).toContain("layout-three-cols-grid video")
      expect(html).toContain("max-height: min(100%, 340px, 44vh)")
      expect(html).toContain(".pdf-col video")
      expect(html).toContain("align-items: stretch")
      expect(html).toContain("syncAutoplayVideos")
    })
  })
})
