import { describe, expect, it, vi } from "vitest"
import { buildSlidevDocument } from "../src/compiler/slidev-ast-builder"
import { renderSlideBlocksToHtml } from "../src/export/markdown-renderer"
import { WorkspaceScaffolder, THREE_COLS_HEADER_LAYOUT_VUE } from "../src/engine/workspace-scaffolder"
import type { ISiYuanBlockNode } from "../src/compiler/scope-mapper"
import type { ISlidevVirtualPage } from "../src/types/slidev-protocol"

describe("two-cols-header & three-cols-header 多栏表头版式集成测试", () => {
  describe("1. buildSlidevDocument Markdown 生成与回退推断", () => {
    it("two-cols-header: 正确提取表头与左右分栏 Markdown", () => {
      const docId = "doc-two-cols-hdr"
      const docAttrs = {
        "custom-slidev-layout": "two-cols-header",
      }
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "b-hdr",
          type: "h",
          markdown: "# 核心架构全景",
          ial: { id: "b-hdr" },
        },
        {
          id: "b-left",
          type: "p",
          content: "左栏：数据层与存储",
          ial: { id: "b-left" }, // 默认未指定 slot，fallback 归入 left
        },
        {
          id: "b-right",
          type: "p",
          content: "右栏：UI 展示与渲染",
          ial: { id: "b-right", "custom-slidev-slot": "right" },
        },
      ]

      const doc = buildSlidevDocument(docId, docAttrs, blocks)
      const page = doc.slides[0]

      expect(page.frontmatter.layout).toBe("two-cols-header")
      expect(page.rawMarkdown).toContain("# 核心架构全景")
      expect(page.rawMarkdown).toContain("::left::\n\n左栏：数据层与存储")
      expect(page.rawMarkdown).toContain("::right::\n\n右栏：UI 展示与渲染")
    })

    it("three-cols-header: 自动将未指定 slot 的块默认归入 col-1，支持显式 col-2 / col-3", () => {
      const docId = "doc-three-cols-hdr"
      const docAttrs = {
        "custom-slidev-layout": "three-cols-header",
      }
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "b-h",
          type: "h",
          markdown: "# 微服务三横向体系",
          ial: { id: "b-h" }, // 首个标题自动推断为 header
        },
        {
          id: "b-col1-1",
          type: "p",
          content: "第一栏要点 A",
          ial: { id: "b-col1-1" }, // 未指定 slot，严格回退默认到 col-1
        },
        {
          id: "b-col1-2",
          type: "p",
          content: "第一栏要点 B",
          ial: { id: "b-col1-2", "custom-slidev-slot": "col-1" },
        },
        {
          id: "b-col2",
          type: "p",
          content: "第二栏服务治理",
          ial: { id: "b-col2", "custom-slidev-slot": "col-2" },
        },
        {
          id: "b-col3",
          type: "p",
          content: "第三栏运维可观测性",
          ial: { id: "b-col3", "custom-slidev-slot": "col-3" },
        },
      ]

      const doc = buildSlidevDocument(docId, docAttrs, blocks)
      const page = doc.slides[0]

      expect(page.frontmatter.layout).toBe("three-cols-header")
      expect(page.rawMarkdown).toContain("# 微服务三横向体系")
      expect(page.rawMarkdown).toContain("::col-1::\n\n第一栏要点 A\n\n第一栏要点 B")
      expect(page.rawMarkdown).toContain("::col-2::\n\n第二栏服务治理")
      expect(page.rawMarkdown).toContain("::col-3::\n\n第三栏运维可观测性")
    })

    it("three-cols-header: 显式 slot='header' 优先级高于位置或标题", () => {
      const docId = "doc-explicit-hdr"
      const docAttrs = {
        "custom-slidev-layout": "three-cols-header",
      }
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "b-col1",
          type: "p",
          content: "这是正文前置段落",
          ial: { id: "b-col1" },
        },
        {
          id: "b-hdr",
          type: "h",
          markdown: "# 显式声明的特有表头",
          ial: { id: "b-hdr", "custom-slidev-slot": "header" },
        },
        {
          id: "b-col2",
          type: "p",
          content: "中间栏内容",
          ial: { id: "b-col2", "custom-slidev-slot": "col-2" },
        },
        {
          id: "b-col3",
          type: "p",
          content: "右侧栏内容",
          ial: { id: "b-col3", "custom-slidev-slot": "col-3" },
        },
      ]

      const doc = buildSlidevDocument(docId, docAttrs, blocks)
      const page = doc.slides[0]

      expect(page.rawMarkdown).toContain("# 显式声明的特有表头")
      expect(page.rawMarkdown).toContain("::col-1::\n\n这是正文前置段落")
      expect(page.rawMarkdown).toContain("::col-2::\n\n中间栏内容")
      expect(page.rawMarkdown).toContain("::col-3::\n\n右侧栏内容")
    })

    it("标题行属性级联继承：首个标题行赋予第三栏属性，下方列表项自动继承归入第三栏 (用户真实场景)", () => {
      const docId = "doc-user-scenario"
      const docAttrs = {
        "custom-slidev-layout": "three-cols-header",
      }
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "b-h-builder",
          type: "h",
          subType: "h3",
          markdown: "### Builder",
          content: "Builder",
          ial: {
            id: "b-h-builder",
            "custom-slidev-slot": "col-3",
            "custom-slidev-clicks": "+1",
          },
        },
        {
          id: "b-item-1",
          type: "i",
          markdown: "- 24年开始接触AI，从AI生图开始",
          content: "24年开始接触AI，从AI生图开始",
          ial: { id: "b-item-1" }, // 未指定 slot 与 clicks，应继承 col-3 与 +1
        },
        {
          id: "b-item-2",
          type: "i",
          markdown: "- “诗词学堂”：25年第一届创新大赛三等奖",
          content: "“诗词学堂”：25年第一届创新大赛三等奖",
          ial: { id: "b-item-2" }, // 未指定 slot，继承 col-3
        },
        {
          id: "b-item-3",
          type: "i",
          markdown: "- 今年1-9个月、20+开源项目、3000次提交",
          content: "今年1-9个月、20+开源项目、3000次提交",
          ial: { id: "b-item-3" }, // 未指定 slot，继承 col-3
        },
      ]

      const doc = buildSlidevDocument(docId, docAttrs, blocks)
      const page = doc.slides[0]

      // 验证 page.blocks 中的 slot 与 clicks 全部正确继承
      const builderH = page.blocks.find(b => b.id === "b-h-builder")
      const item1 = page.blocks.find(b => b.id === "b-item-1")
      const item2 = page.blocks.find(b => b.id === "b-item-2")
      const item3 = page.blocks.find(b => b.id === "b-item-3")

      expect(builderH?.slot).toBe("col-3")
      expect(item1?.slot).toBe("col-3")
      expect(item1?.clicks).toBe("+1")
      expect(item2?.slot).toBe("col-3")
      expect(item3?.slot).toBe("col-3")

      // 生成的 Markdown 应归入 ::col-3::
      expect(page.rawMarkdown).toContain("::col-3::")
      expect(page.rawMarkdown).toContain("### Builder")
      expect(page.rawMarkdown).toContain("- 24年开始接触AI，从AI生图开始")
      expect(page.rawMarkdown).toContain("- “诗词学堂”：25年第一届创新大赛三等奖")
      expect(page.rawMarkdown).toContain("- 今年1-9个月、20+开源项目、3000次提交")
    })

    it("标题行继承范围：直到遇到另一个同级或高一级标题行时终止继承，且支持子项特意指定覆盖", () => {
      const docId = "doc-scope-boundary"
      const docAttrs = {
        "custom-slidev-layout": "three-cols-header",
      }
      const blocks: ISiYuanBlockNode[] = [
        // 栏目 1：H3 设为 col-1
        {
          id: "h-col1",
          type: "h",
          subType: "h3",
          markdown: "### 模块 A",
          ial: { id: "h-col1", "custom-slidev-slot": "col-1" },
        },
        {
          id: "p-col1-inherit",
          type: "p",
          markdown: "继承模块 A 的第 1 栏",
          ial: { id: "p-col1-inherit" },
        },
        {
          id: "p-col1-override",
          type: "p",
          markdown: "特意指定跳到第 2 栏",
          ial: { id: "p-col1-override", "custom-slidev-slot": "col-2" }, // 特意指定覆盖
        },
        // 遇到同级 H3 (模块 B)：继承终止，当前显式设为 col-2
        {
          id: "h-col2",
          type: "h",
          subType: "h3",
          markdown: "### 模块 B",
          ial: { id: "h-col2", "custom-slidev-slot": "col-2" },
        },
        {
          id: "p-col2-inherit",
          type: "p",
          markdown: "继承模块 B 的第 2 栏",
          ial: { id: "p-col2-inherit" },
        },
        // 遇到更高一级 H2 (大章节)：H3 作用域完全退出
        {
          id: "h-col3",
          type: "h",
          subType: "h2",
          markdown: "## 高级大章节",
          ial: { id: "h-col3", "custom-slidev-slot": "col-3" },
        },
        {
          id: "p-col3-inherit",
          type: "p",
          markdown: "继承高级大章节的第 3 栏",
          ial: { id: "p-col3-inherit" },
        },
      ]

      const doc = buildSlidevDocument(docId, docAttrs, blocks)
      const page = doc.slides[0]

      expect(page.blocks.find(b => b.id === "p-col1-inherit")?.slot).toBe("col-1")
      expect(page.blocks.find(b => b.id === "p-col1-override")?.slot).toBe("col-2")
      expect(page.blocks.find(b => b.id === "p-col2-inherit")?.slot).toBe("col-2")
      expect(page.blocks.find(b => b.id === "p-col3-inherit")?.slot).toBe("col-3")
    })
  })

  describe("2. renderSlideBlocksToHtml 导出渲染", () => {
    it("two-cols-header: 生成完整的 header 与左右双栏容器结构", () => {
      const slide: ISlidevVirtualPage = {
        pageIndex: 1,
        startBlockId: "p1",
        frontmatter: { layout: "two-cols-header" },
        notes: "",
        blocks: [
          { id: "h1", type: "h", rawMarkdown: "# 页面标题", slot: "header" },
          { id: "c1", type: "p", rawMarkdown: "左栏说明", slot: "left" },
          { id: "c2", type: "p", rawMarkdown: "右栏说明", slot: "right" },
        ],
        rawMarkdown: "",
      }

      const html = renderSlideBlocksToHtml(slide)
      expect(html).toContain("layout-two-cols-header-container")
      expect(html).toContain("layout-header-section")
      expect(html).toContain("pdf-col pdf-col--left")
      expect(html).toContain("pdf-col pdf-col--right")
      expect(html).toContain("左栏说明")
      expect(html).toContain("右栏说明")
    })

    it("three-cols-header: 生成完整的 header 与三栏网格容器结构", () => {
      const slide: ISlidevVirtualPage = {
        pageIndex: 1,
        startBlockId: "p1",
        frontmatter: { layout: "three-cols-header" },
        notes: "",
        blocks: [
          { id: "h1", type: "h", rawMarkdown: "# 总体规划", slot: "header" },
          { id: "c1", type: "p", rawMarkdown: "栏一：规划", slot: "col-1" },
          { id: "c2", type: "p", rawMarkdown: "栏二：开发", slot: "col-2" },
          { id: "c3", type: "p", rawMarkdown: "栏三：上线", slot: "col-3" },
        ],
        rawMarkdown: "",
      }

      const html = renderSlideBlocksToHtml(slide)
      expect(html).toContain("layout-three-cols-header-container")
      expect(html).toContain("layout-header-section")
      expect(html).toContain("pdf-three-cols-wrapper layout-three-cols-grid")
      expect(html).toContain("pdf-col pdf-col--1")
      expect(html).toContain("pdf-col pdf-col--2")
      expect(html).toContain("pdf-col pdf-col--3")
      expect(html).toContain("栏一：规划")
      expect(html).toContain("栏二：开发")
      expect(html).toContain("栏三：上线")
    })

    it("three-cols-header: 无显式插槽标注时，多个段落块应自动均分至三栏", () => {
      const slide: ISlidevVirtualPage = {
        pageIndex: 1,
        startBlockId: "p1",
        frontmatter: { layout: "three-cols-header" },
        notes: "",
        blocks: [
          { id: "h1", type: "h", rawMarkdown: "# 总体规划" },
          { id: "p1", type: "p", rawMarkdown: "步骤一内容" },
          { id: "p2", type: "p", rawMarkdown: "步骤二内容" },
          { id: "p3", type: "p", rawMarkdown: "步骤三内容" },
        ],
        rawMarkdown: "",
      }

      const html = renderSlideBlocksToHtml(slide)
      expect(html).toContain("layout-three-cols-header-container")
      expect(html).toContain("pdf-col pdf-col--1")
      expect(html).toContain("pdf-col pdf-col--2")
      expect(html).toContain("pdf-col pdf-col--3")
      // 验证各栏内容分布
      expect(html).toMatch(/pdf-col--1[\s\S]*步骤一内容[\s\S]*pdf-col--2/)
      expect(html).toMatch(/pdf-col--2[\s\S]*步骤二内容[\s\S]*pdf-col--3/)
      expect(html).toMatch(/pdf-col--3[\s\S]*步骤三内容/)
    })

    it("three-cols-header: 仅单个三项列表块时，应智能拆分为三栏", () => {
      const slide: ISlidevVirtualPage = {
        pageIndex: 1,
        startBlockId: "p1",
        frontmatter: { layout: "three-cols-header" },
        notes: "",
        blocks: [
          { id: "h1", type: "h", rawMarkdown: "# 核心架构" },
          { id: "l1", type: "l", rawMarkdown: "- 模块 A\n- 模块 B\n- 模块 C" },
        ],
        rawMarkdown: "",
      }

      const html = renderSlideBlocksToHtml(slide)
      expect(html).toContain("pdf-col pdf-col--1")
      expect(html).toContain("pdf-col pdf-col--2")
      expect(html).toContain("pdf-col pdf-col--3")
      expect(html).toMatch(/pdf-col--1[\s\S]*模块 A[\s\S]*pdf-col--2/)
      expect(html).toMatch(/pdf-col--2[\s\S]*模块 B[\s\S]*pdf-col--3/)
      expect(html).toMatch(/pdf-col--3[\s\S]*模块 C/)
    })
  })

  describe("3. WorkspaceScaffolder 官方 Slidev Pro 模式自定义布局自动注入", () => {
    it("当页面包含 three-cols-header 时，应自动写入 layouts/three-cols-header.vue", async () => {
      const docWithThreeCols = {
        docId: "doc-tc-scaffold",
        config: { theme: "default" },
        fullMarkdown: "",
        slides: [
          {
            pageIndex: 1,
            startBlockId: "p1",
            frontmatter: { layout: "three-cols-header" },
            notes: "",
            blocks: [],
            rawMarkdown: "",
          },
        ],
      }

      const scaffolder = new WorkspaceScaffolder({ workspacePath: "/test/pro-workspace" })
      const mockPutFile = vi.fn().mockResolvedValue({ code: 0 })

      const res = await scaffolder.scaffold(docWithThreeCols as any, mockPutFile)
      expect(res.success).toBe(true)
      // 应写入 package.json, slides.md, snippets/external.ts, 以及 layouts/three-cols-header.vue
      expect(mockPutFile).toHaveBeenCalledWith(
        "/test/pro-workspace/layouts/three-cols-header.vue",
        false,
        expect.anything(),
      )
    })
  })

  describe("4. 页面设置表头三栏与右侧块配置联动测试", () => {
    it("当分页符设置为 three-cols-header 后，选择所属页面的正文或嵌套子块时，应正确识别为 three-cols-header 版式", () => {
      const docId = "doc-test"
      const blocks: ISiYuanBlockNode[] = [
        { id: "b1", type: "h", markdown: "# 封面", ial: { id: "b1" } },
        { id: "div1", type: "tb", markdown: "---", ial: { id: "div1", "custom-slidev-layout": "three-cols-header" } },
        { id: "b2", type: "h", markdown: "# 表头", ial: { id: "b2" } },
        { id: "b3", type: "l", markdown: "- 项目 A\n- 项目 B", ial: { id: "b3" } },
      ]
      const doc = buildSlidevDocument(docId, {}, blocks)
      expect(doc.slides.length).toBe(2)
      expect(doc.slides[1].frontmatter.layout).toBe("three-cols-header")
      expect(doc.slides[1].startBlockId).toBe("div1")

      // 模拟子块（如列表项或段落）通过 topBlockId 或 pageDividerId 寻址所属 slide
      const topBlockId = "b3"
      const pageDividerId = "div1"

      // 1. 通过 pageDividerId 准确定位
      let targetSlide = doc.slides.find(s => s.startBlockId === pageDividerId)
      expect(targetSlide?.frontmatter.layout).toBe("three-cols-header")

      // 2. 通过 topBlockId 准确定位
      targetSlide = doc.slides.find(s => s.blocks.some(b => b.id === topBlockId))
      expect(targetSlide?.frontmatter.layout).toBe("three-cols-header")
    })

    it("three-cols-header 布局下的可用插槽列表应提供表头与三栏选项，而非左右两栏", () => {
      function getAvailableSlots(layout: string) {
        if (layout === "three-cols-header") {
          return [
            { value: "header", label: "表头" },
            { value: "col-1", label: "第 1 栏" },
            { value: "col-2", label: "第 2 栏" },
            { value: "col-3", label: "第 3 栏" },
          ]
        }
        if (layout === "two-cols-header") {
          return [
            { value: "header", label: "表头" },
            { value: "left", label: "左栏" },
            { value: "right", label: "右栏" },
          ]
        }
        return [
          { value: "", label: "默认" },
          { value: "header", label: "表头" },
          { value: "left", label: "左栏" },
          { value: "right", label: "右栏" },
        ]
      }

      const slots = getAvailableSlots("three-cols-header")
      expect(slots.map(s => s.value)).toEqual(["header", "col-1", "col-2", "col-3"])
      expect(slots.map(s => s.label)).toEqual(["表头", "第 1 栏", "第 2 栏", "第 3 栏"])
      expect(slots.some(s => s.value === "left")).toBe(false)
      expect(slots.some(s => s.value === "right")).toBe(false)
    })
  })
})
