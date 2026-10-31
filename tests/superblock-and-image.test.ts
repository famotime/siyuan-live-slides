import { describe, expect, it, vi } from "vitest"
import {
  extractImageUrl,
  isImageBlock,
  detectSuperBlockImageLayout,
  scanAndTagSuperBlocks,
} from "../src/compiler/superblock-scanner"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { parseSlidesPresentation } from "../src/compiler/slides-importer"
import { DocumentCompilerService } from "../src/compiler/document-compiler"
import type { ISiYuanBlockNode } from "../src/types/slides-protocol"
import {
  ATTR_PAGE_BACKGROUND,
  ATTR_PAGE_IMAGE,
  ATTR_PAGE_LAYOUT,
  ROLE_IMAGE_LEFT,
  ROLE_IMAGE_RIGHT,
} from "../src/types/slides-protocol"

describe("Superblock and Image Scanner & Compiler Pipeline", () => {
  describe("1. 图片 URL 提取与图片块判定", () => {
    it("正确提取标准 Markdown 图片语法", () => {
      expect(extractImageUrl("![封面](assets/cover.png)")).toBe("assets/cover.png")
      expect(extractImageUrl("![示例](https://example.com/demo.jpg '标题')")).toBe("https://example.com/demo.jpg")
      expect(extractImageUrl("![配图](assets/20261004120000-abc.webp)\n{: custom-slides-role=\"background\" }")).toBe("assets/20261004120000-abc.webp")
    })

    it("正确提取 HTML <img> 标签中的资源路径", () => {
      expect(extractImageUrl('<img src="assets/bg-dark.png" alt="背景" />')).toBe("assets/bg-dark.png")
      expect(extractImageUrl('<img width="100%" src="https://images.unsplash.com/photo-1" />')).toBe("https://images.unsplash.com/photo-1")
    })

    it("正确提取直接资源路径", () => {
      expect(extractImageUrl("assets/wallpaper.jpg")).toBe("assets/wallpaper.jpg")
      expect(extractImageUrl("https://cover.sli.dev")).toBe(null) // 无图片后缀且非语法
      expect(extractImageUrl("https://cover.sli.dev/bg.png")).toBe("https://cover.sli.dev/bg.png")
    })

    it("isImageBlock 能精准区分图片块与包含行内小图的长段落", () => {
      const pureImgBlock: ISiYuanBlockNode = {
        id: "img-1",
        type: "p",
        markdown: "![封面图](assets/cover.png)",
        content: "![封面图](assets/cover.png)",
      }
      expect(isImageBlock(pureImgBlock)).toBe(true)

      const mixedLongTextBlock: ISiYuanBlockNode = {
        id: "text-1",
        type: "p",
        markdown: "这是一段非常冗长的正文分析报告，包含了大量文字说明，在中间引用了一个小表情 ![icon](assets/icon.png) 然后继续阐述后面的关键理论与技术架构实施细节，篇幅很长。",
        content: "这是一段非常冗长的正文分析报告...",
      }
      expect(isImageBlock(mixedLongTextBlock)).toBe(false)
    })
  })

  describe("2. 横向超级块图文排版检测 (detectSuperBlockImageLayout)", () => {
    it("检测图左超级块：支持官方缩写 type: 's' 与 subType: 'col'，左侧为图片，右侧为文本", () => {
      const sbNode: ISiYuanBlockNode = {
        id: "sb-1",
        type: "s",
        subType: "col",
        children: [
          { id: "img-left", type: "p", markdown: "![配图](assets/pic-left.png)" },
          { id: "text-right", type: "p", markdown: "# 右侧核心标题\n这是右侧的正文内容" },
        ],
      }

      const res = detectSuperBlockImageLayout(sbNode)
      expect(res).not.toBeNull()
      expect(res?.layout).toBe(ROLE_IMAGE_LEFT)
      expect(res?.imageUrl).toBe("assets/pic-left.png")
      expect(res?.imageNode.id).toBe("img-left")
      expect(res?.contentNodes.length).toBe(1)
      expect(res?.contentNodes[0].id).toBe("text-right")
    })

    it("检测图右超级块：支持 NodeSuperBlock 与 DOM data-sb-layout='col'，左侧为文本，右侧为图片", () => {
      const sbNode: ISiYuanBlockNode = {
        id: "sb-2",
        type: "NodeSuperBlock",
        ial: { "data-sb-layout": "col" },
        children: [
          { id: "text-left", type: "p", markdown: "# 左侧核心标题\n这是左侧的正文说明" },
          { id: "img-right", type: "p", markdown: "![配图](assets/pic-right.png)" },
        ],
      }

      const res = detectSuperBlockImageLayout(sbNode)
      expect(res).not.toBeNull()
      expect(res?.layout).toBe(ROLE_IMAGE_RIGHT)
      expect(res?.imageUrl).toBe("assets/pic-right.png")
      expect(res?.imageNode.id).toBe("img-right")
      expect(res?.contentNodes.length).toBe(1)
      expect(res?.contentNodes[0].id).toBe("text-left")
    })

    it("容错过滤思源 AST 的 NodeSuperBlockOpenMarker 与 LayoutMarker", () => {
      const sbNodeWithMarkers: ISiYuanBlockNode = {
        id: "sb-markers",
        type: "s",
        children: [
          { id: "m-open", type: "NodeSuperBlockOpenMarker", content: "{{{" },
          { id: "m-layout", type: "NodeSuperBlockLayoutMarker", content: "col" },
          { id: "img-1", type: "p", markdown: "![配图](assets/ast-pic.png)" },
          { id: "text-1", type: "p", markdown: "# 内容" },
          { id: "m-close", type: "NodeSuperBlockCloseMarker", content: "}}}" },
        ],
      }

      const res = detectSuperBlockImageLayout(sbNodeWithMarkers)
      expect(res).not.toBeNull()
      expect(res?.layout).toBe(ROLE_IMAGE_LEFT)
      expect(res?.imageUrl).toBe("assets/ast-pic.png")
      expect(res?.contentNodes.length).toBe(1)
      expect(res?.contentNodes[0].id).toBe("text-1")
    })

    it("纵向超级块 (subType: 'row' 或 'v') 或全文本超级块返回 null", () => {
      const verticalSbRow: ISiYuanBlockNode = {
        id: "sb-v-row",
        type: "s",
        subType: "row",
        children: [
          { id: "img-1", type: "p", markdown: "![配图](assets/pic.png)" },
          { id: "text-1", type: "p", markdown: "内容" },
        ],
      }
      expect(detectSuperBlockImageLayout(verticalSbRow)).toBeNull()

      const verticalSbV: ISiYuanBlockNode = {
        id: "sb-v",
        type: "sb",
        subType: "v",
        children: [
          { id: "img-1", type: "p", markdown: "![配图](assets/pic.png)" },
          { id: "text-1", type: "p", markdown: "内容" },
        ],
      }
      expect(detectSuperBlockImageLayout(verticalSbV)).toBeNull()

      const textOnlySb: ISiYuanBlockNode = {
        id: "sb-text",
        type: "s",
        subType: "col",
        children: [
          { id: "text-1", type: "p", markdown: "左列文字" },
          { id: "text-2", type: "p", markdown: "右列文字" },
        ],
      }
      expect(detectSuperBlockImageLayout(textOnlySb)).toBeNull()
    })
  })

  describe("3. 自动扫描打标与拖拽换位自适应 (scanAndTagSuperBlocks)", () => {
    it("为超级块左侧图片自动标记 custom-slides-layout='image-left'", () => {
      const sbNode: ISiYuanBlockNode = {
        id: "sb-tag-1",
        type: "sb",
        subType: "h",
        children: [
          { id: "img-1", type: "p", markdown: "![左图](assets/left.png)", ial: {} },
          { id: "text-1", type: "p", markdown: "正文内容" },
        ],
      }

      const tagCallback = vi.fn()
      const changes = scanAndTagSuperBlocks([sbNode], tagCallback)

      expect(changes.length).toBe(1)
      expect(changes[0].blockId).toBe("img-1")
      expect(changes[0].layout).toBe("image-left")
      expect(sbNode.children![0].ial![ATTR_PAGE_LAYOUT]).toBe("image-left")
      expect(tagCallback).toHaveBeenCalledWith({
        blockId: "img-1",
        layout: "image-left",
        previousLayout: undefined,
      })
    })

    it("拖拽换位自适应：图片从左侧拖到右侧时，自动更新为 image-right", () => {
      // 模拟用户拖拽将 img-1 挪到右侧，此时 img-1 之前已经有 image-left 属性
      const sbNode: ISiYuanBlockNode = {
        id: "sb-tag-2",
        type: "sb",
        subType: "h",
        children: [
          { id: "text-1", type: "p", markdown: "正文内容" },
          {
            id: "img-1",
            type: "p",
            markdown: "![右图](assets/right.png)",
            ial: { [ATTR_PAGE_LAYOUT]: "image-left" },
          },
        ],
      }

      const tagCallback = vi.fn()
      const changes = scanAndTagSuperBlocks([sbNode], tagCallback)

      expect(changes.length).toBe(1)
      expect(changes[0].blockId).toBe("img-1")
      expect(changes[0].layout).toBe("image-right")
      expect(changes[0].previousLayout).toBe("image-left")
      expect(sbNode.children![1].ial![ATTR_PAGE_LAYOUT]).toBe("image-right")
      expect(tagCallback).toHaveBeenCalledWith({
        blockId: "img-1",
        layout: "image-right",
        previousLayout: "image-left",
      })
    })
  })

  describe("4. AST 编译器对正文背景图的抽取与正文去重", () => {
    it("提取带有 custom-slides-role='background' 的图片块为页面背景，并在正文内容中排除", () => {
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "bg-block-1",
          type: "p",
          markdown: "![页面背景图](assets/my-bg.jpg)\n{: custom-slides-role=\"background\" }",
          ial: { "custom-slides-role": "background" },
        },
        {
          id: "heading-1",
          type: "h",
          markdown: "# 演示第一页标题",
        },
        {
          id: "p-1",
          type: "p",
          markdown: "这是本页正文段落",
        },
      ]

      const doc = buildSlidesDocument("doc-bg-1", {}, blocks)
      expect(doc.slides.length).toBe(1)
      const page1 = doc.slides[0]

      // 验证背景图被提取为 frontmatter.background
      expect(page1.frontmatter.background).toBe("/assets/my-bg.jpg")

      // 验证正文 blocks 中已排除背景图块
      expect(page1.blocks.length).toBe(2)
      expect(page1.blocks.some(b => b.id === "bg-block-1")).toBe(false)
      expect(page1.blocks[0].rawMarkdown).toBe("# 演示第一页标题")
      expect(page1.rawMarkdown).not.toContain("![页面背景图]")
      expect(page1.rawMarkdown).toContain("# 演示第一页标题")
    })

    it("正文背景图优先级高于历史分割线属性", () => {
      const dividerAttrs = {
        [ATTR_PAGE_BACKGROUND]: "assets/old-divider-bg.png",
      }

      const blocks: ISiYuanBlockNode[] = [
        {
          id: "divider-1",
          type: "tb",
          markdown: "---",
          ial: dividerAttrs,
        },
        {
          id: "bg-body",
          type: "p",
          markdown: "![新正文背景图](assets/new-body-bg.png)\n{: custom-slides-role=\"background\" }",
          ial: { "custom-slides-role": "background" },
        },
        {
          id: "p-body",
          type: "p",
          markdown: "内容文本",
        },
      ]

      const doc = buildSlidesDocument("doc-bg-override", {}, blocks)
      expect(doc.slides.length).toBe(1)
      // 正文图片覆盖分割线属性
      expect(doc.slides[0].frontmatter.background).toBe("/assets/new-body-bg.png")
    })
  })

  describe("5. AST 编译器对图文超级块的提升与分栏渲染", () => {
    it("超级块图左模式：提升为 layout: image-left，图片提取为 image 属性，另一侧内容作为正文", () => {
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "sb-container",
          type: "sb",
          subType: "h",
          children: [
            {
              id: "img-left",
              type: "p",
              markdown: "![图左封面](assets/side-left.png)",
              ial: { [ATTR_PAGE_LAYOUT]: "image-left" },
            },
            {
              id: "text-right",
              type: "p",
              markdown: "# 右侧主体内容\n这里是右栏的具体讲解文本",
            },
          ],
        },
      ]

      const doc = buildSlidesDocument("doc-sb-left", {}, blocks)
      expect(doc.slides.length).toBe(1)
      const page = doc.slides[0]

      expect(page.frontmatter.layout).toBe("image-left")
      expect(page.frontmatter.image).toBe("/assets/side-left.png")
      // 幻灯片正文中不重复渲染图片块
      expect(page.blocks.length).toBe(1)
      expect(page.blocks[0].id).toBe("text-right")
      expect(page.rawMarkdown).toContain("# 右侧主体内容")
      expect(page.rawMarkdown).not.toContain("![图左封面]")
    })

    it("超级块图右模式：提升为 layout: image-right", () => {
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "sb-container-2",
          type: "sb",
          subType: "h",
          children: [
            {
              id: "text-left",
              type: "p",
              markdown: "# 左侧主要讲解\n文字在左边",
            },
            {
              id: "img-right",
              type: "p",
              markdown: "![图右封面](assets/side-right.png)",
              ial: { [ATTR_PAGE_LAYOUT]: "image-right" },
            },
          ],
        },
      ]

      const doc = buildSlidesDocument("doc-sb-right", {}, blocks)
      expect(doc.slides.length).toBe(1)
      const page = doc.slides[0]

      expect(page.frontmatter.layout).toBe("image-right")
      expect(page.frontmatter.image).toBe("/assets/side-right.png")
      expect(page.blocks.length).toBe(1)
      expect(page.blocks[0].id).toBe("text-left")
      expect(page.rawMarkdown).toContain("# 左侧主要讲解")
      expect(page.rawMarkdown).not.toContain("![图右封面]")
    })
  })

  describe("6. Slidev 导入引擎组织超级块与正文背景图", () => {
    it("导入带有 background 的页面时，在正文顶部生成带 custom-slides-role='background' 的图片块", () => {
      const slidevMd = `---
background: https://images.unsplash.com/photo-nature
---

# 壮丽自然

这是介绍大自然的幻灯片`

      const parsed = parseSlidesPresentation(slidevMd, { wrapSuperBlocks: true })
      expect(parsed.slides.length).toBe(1)
      const slide = parsed.slides[0]

      expect(slide.rawMarkdown).toContain("![背景图](https://images.unsplash.com/photo-nature)")
      expect(slide.rawMarkdown).toContain('{: custom-slides-role="background" }')
      expect(slide.rawMarkdown).toContain("# 壮丽自然")
    })

    it("导入 layout: image-right 时，组织为横向超级块 {{{col ... }}}，正文在左，图片在右，子块空行分隔", () => {
      const slidevMd = `---
layout: image-right
image: https://cover.sli.dev/code-sample.png
---

# 代码示例

使用 Slidev 展示代码高亮与交互`

      const parsed = parseSlidesPresentation(slidevMd, { wrapSuperBlocks: true })
      expect(parsed.slides.length).toBe(1)
      const slide = parsed.slides[0]

      expect(slide.rawMarkdown).toContain("{{{col")
      expect(slide.rawMarkdown).toContain("# 代码示例")
      expect(slide.rawMarkdown).toContain("![配图](https://cover.sli.dev/code-sample.png)")
      expect(slide.rawMarkdown).toContain('{: custom-slides-layout="image-right" }')
      expect(slide.rawMarkdown).toContain("}}}")

      // 验证顺序：正文在前，配图在后
      const textIdx = slide.rawMarkdown.indexOf("# 代码示例")
      const imgIdx = slide.rawMarkdown.indexOf("![配图]")
      expect(textIdx).toBeLessThan(imgIdx)
    })

    it("导入 layout: image-left 时，组织为横向超级块 {{{col ... }}}，图片在左，正文在右", () => {
      const slidevMd = `---
layout: image-left
image: https://cover.sli.dev/left-sample.png
---

# 左图展示

左侧为大幅配图，右侧为说明`

      const parsed = parseSlidesPresentation(slidevMd, { wrapSuperBlocks: true })
      expect(parsed.slides.length).toBe(1)
      const slide = parsed.slides[0]

      expect(slide.rawMarkdown).toContain("{{{col")
      expect(slide.rawMarkdown).toContain("![配图](https://cover.sli.dev/left-sample.png)")
      expect(slide.rawMarkdown).toContain('{: custom-slides-layout="image-left" }')
      expect(slide.rawMarkdown).toContain("}}}")

      // 验证顺序：配图在前，正文在后
      const imgIdx = slide.rawMarkdown.indexOf("![配图]")
      const textIdx = slide.rawMarkdown.indexOf("# 左图展示")
      expect(imgIdx).toBeLessThan(textIdx)
    })
  })

  describe("7. DocumentCompilerService 全链路编排与即时自动打标", () => {
    it("编译文档时自动识别思源官方 type: 's' 超级块，补全子节点，并自动持久化图左属性", async () => {
      const mockSetBlockAttrs = vi.fn().mockResolvedValue({})
      const mockGetBlockAttrs = vi.fn().mockResolvedValue({})
      const mockGetChildBlocks = vi.fn().mockImplementation((id: string) => {
        if (id === "doc-e2e") {
          return Promise.resolve([
            { id: "sb-e2e", type: "s", subType: "col" },
          ])
        }
        if (id === "sb-e2e") {
          return Promise.resolve([
            { id: "img-child", type: "p", markdown: "![配图](assets/side.png)" },
            { id: "text-child", type: "p", markdown: "# 正文内容" },
          ])
        }
        return Promise.resolve([])
      })

      const compiler = new DocumentCompilerService({
        getBlockAttrs: mockGetBlockAttrs,
        getChildBlocks: mockGetChildBlocks,
        setBlockAttrs: mockSetBlockAttrs,
        sql: vi.fn().mockResolvedValue([]),
      })

      const doc = await compiler.compile("doc-e2e")

      // 验证自动触发了 setBlockAttrs 落库
      expect(mockSetBlockAttrs).toHaveBeenCalledWith("img-child", {
        [ATTR_PAGE_LAYOUT]: "image-left",
      })

      // 验证编译生成的幻灯片被正确提升为 image-left 版式
      expect(doc.slides.length).toBe(1)
      expect(doc.slides[0].frontmatter.layout).toBe("image-left")
      expect(doc.slides[0].frontmatter.image).toBe("/assets/side.png")
      expect(doc.slides[0].rawMarkdown).toContain("# 正文内容")
    })

    it("当 getChildBlocks 返回空时，通过 SQL 降级查询 parent_id 成功恢复超级块子节点", async () => {
      const mockSetBlockAttrs = vi.fn().mockResolvedValue({})
      const mockGetBlockAttrs = vi.fn().mockResolvedValue({})
      const mockGetChildBlocks = vi.fn().mockImplementation((id: string) => {
        if (id === "doc-sql-fallback") {
          return Promise.resolve([
            { id: "sb-sql", type: "s", subType: "col" },
          ])
        }
        return Promise.resolve([]) // getChildBlocks 模拟无法取得子块
      })
      const mockSql = vi.fn().mockImplementation((query: string) => {
        if (query.includes("parent_id = 'sb-sql'")) {
          return Promise.resolve([
            { id: "img-from-sql", parent_id: "sb-sql", type: "p", markdown: "![SQL配图](assets/sql.png)" },
            { id: "p-from-sql", parent_id: "sb-sql", type: "p", markdown: "SQL恢复的正文" },
          ])
        }
        return Promise.resolve([])
      })

      const compiler = new DocumentCompilerService({
        getBlockAttrs: mockGetBlockAttrs,
        getChildBlocks: mockGetChildBlocks,
        setBlockAttrs: mockSetBlockAttrs,
        sql: mockSql,
      })

      const doc = await compiler.compile("doc-sql-fallback")
      expect(mockSetBlockAttrs).toHaveBeenCalledWith("img-from-sql", {
        [ATTR_PAGE_LAYOUT]: "image-left",
      })
      expect(doc.slides[0].frontmatter.layout).toBe("image-left")
      expect(doc.slides[0].frontmatter.image).toBe("/assets/sql.png")
    })
  })
})
