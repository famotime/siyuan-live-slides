import { describe, expect, it, vi, beforeEach } from "vitest"
import { ref, computed } from "vue"
import {
  extractFourComponentSuperBlock,
  findFourComponentSuperBlockInPage,
  scanAndTagListSuperBlocks,
} from "../src/compiler/superblock-scanner"
import { buildSlidevDocument } from "../src/compiler/slidev-ast-builder"
import { renderSlideBlocksToHtml } from "../src/export/slide-layout-renderer"
import { useInspectorActions } from "../src/ui/dock/useInspectorActions"
import * as apiModule from "../src/api"
import * as domSyncModule from "../src/sync/dom-attr-sync"
import * as siyuanModule from "siyuan"
import type { ISiYuanBlockNode, ISlidevVirtualPage } from "../src/types/slidev-protocol"

describe("Clover Layout (四叶草 2x2 田字型布局规范测试)", () => {
  describe("1. 四组件超级块提取与页面检索 (extract & find)", () => {
    it("应正确识别包含 4 个列表项的横向超级块", () => {
      const sb: ISiYuanBlockNode = {
        id: "sb-1",
        type: "s",
        subType: "col",
        children: [
          { id: "i1", type: "i", content: "第一象限" },
          { id: "i2", type: "i", content: "第二象限" },
          { id: "i3", type: "i", content: "第三象限" },
          { id: "i4", type: "i", content: "第四象限" },
        ],
      }
      const items = extractFourComponentSuperBlock(sb)
      expect(items).not.toBeNull()
      expect(items?.length).toBe(4)
      expect(items?.map(it => it.id)).toEqual(["i1", "i2", "i3", "i4"])
    })

    it("应兼容识别直接包含 4 个内容子块（段落/卡片）的横向超级块", () => {
      const sb: ISiYuanBlockNode = {
        id: "sb-para",
        type: "s",
        subType: "col",
        children: [
          { id: "p1", type: "p", content: "段落 1" },
          { id: "p2", type: "p", content: "段落 2" },
          { id: "p3", type: "p", content: "段落 3" },
          { id: "p4", type: "p", content: "段落 4" },
        ],
      }
      const items = extractFourComponentSuperBlock(sb)
      expect(items).not.toBeNull()
      expect(items?.length).toBe(4)
      expect(items?.map(it => it.id)).toEqual(["p1", "p2", "p3", "p4"])
    })

    it("应支持展开 2x2 嵌套结构的超级块为 4 个组件", () => {
      const sbNested: ISiYuanBlockNode = {
        id: "sb-nested",
        type: "s",
        subType: "col",
        children: [
          {
            id: "row-1",
            type: "s",
            subType: "col",
            children: [
              { id: "c1", type: "i", content: "左上" },
              { id: "c2", type: "i", content: "右上" },
            ],
          },
          {
            id: "row-2",
            type: "s",
            subType: "col",
            children: [
              { id: "c3", type: "i", content: "左下" },
              { id: "c4", type: "i", content: "右下" },
            ],
          },
        ],
      }
      const items = extractFourComponentSuperBlock(sbNested)
      expect(items).not.toBeNull()
      expect(items?.length).toBe(4)
      expect(items?.map(it => it.id)).toEqual(["c1", "c2", "c3", "c4"])
    })

    it("非 4 项的超级块（2项、3项或5项）应返回 null", () => {
      const sb2: ISiYuanBlockNode = {
        id: "sb-2",
        type: "s",
        subType: "col",
        children: [
          { id: "i1", type: "i", content: "项 1" },
          { id: "i2", type: "i", content: "项 2" },
        ],
      }
      expect(extractFourComponentSuperBlock(sb2)).toBeNull()

      const sb3: ISiYuanBlockNode = {
        id: "sb-3",
        type: "s",
        subType: "col",
        children: [
          { id: "i1", type: "i", content: "项 1" },
          { id: "i2", type: "i", content: "项 2" },
          { id: "i3", type: "i", content: "项 3" },
        ],
      }
      expect(extractFourComponentSuperBlock(sb3)).toBeNull()
    })

    it("findFourComponentSuperBlockInPage 应能正确检索页面并捕获前置表头", () => {
      const pageBlocks: ISiYuanBlockNode[] = [
        { id: "h1", type: "h", content: "四叶草主标题", markdown: "# 四叶草主标题" },
        { id: "p0", type: "p", content: "导言说明段落" },
        {
          id: "sb-target",
          type: "s",
          subType: "col",
          children: [
            { id: "a1", type: "i", content: "象限 A" },
            { id: "a2", type: "i", content: "象限 B" },
            { id: "a3", type: "i", content: "象限 C" },
            { id: "a4", type: "i", content: "象限 D" },
          ],
        },
      ]

      const match = findFourComponentSuperBlockInPage(pageBlocks)
      expect(match).not.toBeNull()
      expect(match?.superBlockNode.id).toBe("sb-target")
      expect(match?.items.length).toBe(4)
      expect(match?.headerNode?.id).toBe("h1")
    })

    it("多超级块时应优先匹配 preferredBlockId（光标当前焦点所在超级块）", () => {
      const pageBlocks: ISiYuanBlockNode[] = [
        {
          id: "sb-first",
          type: "s",
          subType: "col",
          children: [
            { id: "f1", type: "i", content: "A1" },
            { id: "f2", type: "i", content: "A2" },
            { id: "f3", type: "i", content: "A3" },
            { id: "f4", type: "i", content: "A4" },
          ],
        },
        {
          id: "sb-second",
          type: "s",
          subType: "col",
          children: [
            { id: "s1", type: "i", content: "B1" },
            { id: "s2", type: "i", content: "B2" },
            { id: "s3", type: "i", content: "B3" },
            { id: "s4", type: "i", content: "B4" },
          ],
        },
      ]

      // 指定焦点在第二个超级块的子项 s3 上
      const match = findFourComponentSuperBlockInPage(pageBlocks, "s3")
      expect(match).not.toBeNull()
      expect(match?.superBlockNode.id).toBe("sb-second")
      expect(match?.items.map(it => it.id)).toEqual(["s1", "s2", "s3", "s4"])
    })
  })

  describe("2. 自动扫描保护 (scanAndTagListSuperBlocks)", () => {
    it("若页面已被用户主动设为 clover 版式，自动扫描不得将其回退或覆盖为 cols-header", () => {
      const pageTargetNode: ISiYuanBlockNode = {
        id: "page-div-1",
        type: "tb",
        ial: { "custom-slidev-layout": "clover" },
      }
      const headingNode: ISiYuanBlockNode = {
        id: "h-title",
        type: "h",
        content: "田字格分析",
      }
      const sbNode: ISiYuanBlockNode = {
        id: "sb-clover",
        type: "s",
        subType: "col",
        children: [
          { id: "m1", type: "i", content: "优势 (S)" },
          { id: "m2", type: "i", content: "劣势 (W)" },
          { id: "m3", type: "i", content: "机会 (O)" },
          { id: "m4", type: "i", content: "威胁 (T)" },
        ],
      }

      const blocks: ISiYuanBlockNode[] = [pageTargetNode, headingNode, sbNode]
      const result = scanAndTagListSuperBlocks("doc-1", blocks)

      // 验证未产生将 custom-slidev-layout 改为 cols-header 的变更
      const layoutChanges = result.changes.filter(c => c.attrs["custom-slidev-layout"] !== undefined)
      expect(layoutChanges.length).toBe(0)
      expect(pageTargetNode.ial?.["custom-slidev-layout"]).toBe("clover")

      // 验证追踪列表中正确记录版式为 clover
      const tracked = result.newTracked[0]
      expect(tracked.layout).toBe("clover")
    })
  })

  describe("3. Slidev Markdown AST 编译 (buildSlidevDocument)", () => {
    it("clover 版式下应正确生成包含通栏标题与 ::col-1:: 至 ::col-4:: 的 Slidev Markdown", () => {
      const pageBlocks: ISiYuanBlockNode[] = [
        {
          id: "h1",
          type: "h",
          content: "核心四象限模型",
          markdown: "# 核心四象限模型",
          ial: { "custom-slidev-slot": "header" },
        },
        {
          id: "q1",
          type: "p",
          content: "重要且紧急",
          markdown: "重要且紧急",
          ial: { "custom-slidev-slot": "col-1" },
        },
        {
          id: "q2",
          type: "p",
          content: "重要不紧急",
          markdown: "重要不紧急",
          ial: { "custom-slidev-slot": "col-2" },
        },
        {
          id: "q3",
          type: "p",
          content: "紧急不重要",
          markdown: "紧急不重要",
          ial: { "custom-slidev-slot": "col-3" },
        },
        {
          id: "q4",
          type: "p",
          content: "不重要不紧急",
          markdown: "不重要不紧急",
          ial: { "custom-slidev-slot": "col-4" },
        },
      ]

      const doc = buildSlidevDocument("doc-clover", { "custom-slidev-layout": "clover" }, pageBlocks)

      expect(doc.slides.length).toBe(1)
      const slide = doc.slides[0]
      expect(slide.frontmatter.layout).toBe("clover")
      expect(slide.rawMarkdown).toContain("# 核心四象限模型")
      expect(slide.rawMarkdown).toContain("::col-1::")
      expect(slide.rawMarkdown).toContain("重要且紧急")
      expect(slide.rawMarkdown).toContain("::col-2::")
      expect(slide.rawMarkdown).toContain("重要不紧急")
      expect(slide.rawMarkdown).toContain("::col-3::")
      expect(slide.rawMarkdown).toContain("紧急不重要")
      expect(slide.rawMarkdown).toContain("::col-4::")
      expect(slide.rawMarkdown).toContain("不重要不紧急")
    })
  })

  describe("4. 导出与渲染器 HTML 输出 (renderSlideBlocksToHtml)", () => {
    it("clover 版式应渲染为带有 layout-clover-container 与 2x2 网格样式的 HTML", () => {
      const slide: ISlidevVirtualPage = {
        pageIndex: 1,
        startBlockId: "start-1",
        frontmatter: { layout: "clover" },
        notes: "",
        blocks: [
          {
            id: "h1",
            type: "h",
            content: "商业模式四要素",
            rawMarkdown: "## 商业模式四要素",
            slot: "header",
          },
          { id: "c1", type: "p", content: "客户价值", rawMarkdown: "客户价值", slot: "col-1" },
          { id: "c2", type: "p", content: "产品服务", rawMarkdown: "产品服务", slot: "col-2" },
          { id: "c3", type: "p", content: "盈利模式", rawMarkdown: "盈利模式", slot: "col-3" },
          { id: "c4", type: "p", content: "核心资源", rawMarkdown: "核心资源", slot: "col-4" },
        ],
        rawMarkdown: "",
      }

      const html = renderSlideBlocksToHtml(slide)
      expect(html).toContain("layout-clover-container")
      expect(html).toContain("layout-clover-grid")
      expect(html).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))")
      expect(html).toContain("grid-template-rows: repeat(2, minmax(0, 1fr))")
      expect(html).toContain("col-1")
      expect(html).toContain("col-2")
      expect(html).toContain("col-3")
      expect(html).toContain("col-4")
      expect(html).toContain("客户价值")
      expect(html).toContain("核心资源")
    })
  })

  describe("5. useInspectorActions applyCloverLayout 交互编排", () => {
    let ctx: any
    let actions: any
    let showMessageSpy: any

    beforeEach(() => {
      showMessageSpy = vi.spyOn(siyuanModule, "showMessage").mockImplementation(() => {})
      vi.spyOn(apiModule, "setBlockAttrs").mockResolvedValue({} as any)
      vi.spyOn(domSyncModule, "syncDomBlockAttrs").mockImplementation(() => {})

      ctx = {
        activeBlockId: ref("p-active"),
        activeBlockType: ref("NodeParagraph"),
        activeBlockAttrs: ref<Record<string, string>>({}),
        rawSnippet: ref(""),
        currentDocId: ref("doc-01"),
        currentPageDividerId: ref("div-page-1"),
        currentPageDividerLayout: ref("default"),
        latestDoc: ref<any>(null),
        targetSlide: computed(() => null),
        currentSlideNoteBlockId: computed(() => ""),
        currentSlideLayout: computed(() => "default"),
        isNoteBlock: computed(() => false),
        elemClick: computed(() => ""),
        videoAutoplay: computed(() => false),
        videoLoop: computed(() => false),
        videoMuted: computed(() => false),
        videoControls: computed(() => true),
        pageBackground: ref(""),
        pageImage: ref(""),
        elemShikiLines: ref(""),
        elemMaxHeight: ref(""),
        saveStatus: ref(""),
        plugin: {
          compileCurrentDocument: vi.fn().mockResolvedValue(undefined),
        },
      }

      actions = useInspectorActions(ctx)
    })

    it("当未找到包含 4 个组件的超级块时，应弹出友好提示并阻止切换（返回 false，不修改版式）", async () => {
      // 当前页 AST 为空，DOM 中也无超级块
      const success = await actions.applyCloverLayout()

      expect(success).toBe(false)
      expect(showMessageSpy).toHaveBeenCalledWith(
        "当前页面未找到包含 4 个组件的超级块（需包含 4 个列表项或 4 个子块）",
        4000,
        "info"
      )
      // 版式保持原有值不变
      expect(ctx.currentPageDividerLayout.value).toBe("default")
    })

    it("当在当前页 AST 中成功匹配到 4 组件超级块时，应配置 clover 版式与 col-1~4 插槽并返回 true", async () => {
      const astSlide: ISlidevVirtualPage = {
        pageIndex: 1,
        startBlockId: "start-1",
        frontmatter: { layout: "default" },
        notes: "",
        blocks: [
          {
            id: "head-1",
            type: "h",
            content: "四叶草测试",
            rawMarkdown: "# 四叶草测试",
            rawNode: { id: "head-1", type: "h", content: "四叶草测试" },
          },
          {
            id: "sb-4",
            type: "s",
            content: "",
            rawMarkdown: "",
            rawNode: {
              id: "sb-4",
              type: "s",
              subType: "col",
              children: [
                { id: "item-1", type: "i", content: "第 1 格" },
                { id: "item-2", type: "i", content: "第 2 格" },
                { id: "item-3", type: "i", content: "第 3 格" },
                { id: "item-4", type: "i", content: "第 4 格" },
              ],
            },
          },
        ],
        rawMarkdown: "",
      }

      ctx.targetSlide = computed(() => astSlide)

      const success = await actions.applyCloverLayout()

      expect(success).toBe(true)
      expect(ctx.currentPageDividerLayout.value).toBe("clover")
      expect(astSlide.frontmatter.layout).toBe("clover")
      expect(ctx.plugin.compileCurrentDocument).toHaveBeenCalled()
      expect(showMessageSpy).toHaveBeenCalledWith("已将本页版式设为四叶草（田字型）布局")
    })
  })

  describe("5. Web 沙箱与离线客户端运行时中的 clover 布局支持", () => {
    it("getStandaloneClientRuntimeScript 应包含 clover 布局分支与 4 栏田字格渲染", async () => {
      const { getStandaloneClientRuntimeScript } = await import("../src/export/standalone-client-runtime")
      const script = getStandaloneClientRuntimeScript()
      expect(script).toContain('slide.frontmatter?.layout === "clover"')
      expect(script).toContain('layout-clover-container')
      expect(script).toContain('layout-clover-grid pdf-clover-wrapper')
      expect(script).toContain('repeat(2, minmax(0, 1fr))')
    })

    it("public/slidev-client/index.html 应支持 clover 布局与田字型 2x2 网格样式", async () => {
      const fs = await import("fs")
      const path = await import("path")
      const html = fs.readFileSync(path.resolve(__dirname, "../public/slidev-client/index.html"), "utf-8")
      expect(html).toContain(".layout-clover-grid")
      expect(html).toContain("repeat(2, minmax(0, 1fr))")
      expect(html).toContain("layout === 'clover'")
      expect(html).toContain("currentSlide.frontmatter.layout === 'clover' ? 'layout-clover-grid' : ''")
    })
  })
})
