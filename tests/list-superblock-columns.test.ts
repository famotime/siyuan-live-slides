import { describe, expect, it, vi } from "vitest"
import {
  cleanCardListItemMarkdown,
  detectListSuperBlock,
  detectSuperBlockImageLayout,
  isImageBlock,
  isInvalidListSuperBlock,
  isListItemNode,
  scanAndTagListSuperBlocks,
  scanAndTagSuperBlocks,
} from "../src/compiler/superblock-scanner"
import { DocumentCompilerService } from "../src/compiler/document-compiler"
import { buildSlidevDocument } from "../src/compiler/slidev-ast-builder"
import {
  renderMarkdownList,
  renderSlideBlocksToHtml,
} from "../src/export/markdown-renderer"
import type { ISiYuanBlockNode } from "../src/types/slidev-protocol"
import { ATTR_PAGE_LAYOUT, ATTR_ELEM_SLOT } from "../src/types/slidev-protocol"

describe("List Superblock Columns Auto-Matching & Dynamic Drag Sync", () => {
  describe("1. cleanCardListItemMarkdown 首层列表圆点清洗算法", () => {
    it("正确剥离单个无序列表项的连字符前缀", () => {
      expect(cleanCardListItemMarkdown("- 极简标题")).toBe("极简标题")
      expect(cleanCardListItemMarkdown("* 星号标题")).toBe("星号标题")
      expect(cleanCardListItemMarkdown("+ 加号标题")).toBe("加号标题")
    })

    it("正确剥离有序列表项的序号前缀", () => {
      expect(cleanCardListItemMarkdown("1. 第一阶段")).toBe("第一阶段")
      expect(cleanCardListItemMarkdown("12. 第十二要点")).toBe("第十二要点")
    })

    it("多行列表项：首行去前缀，正文与嵌套子列表正确定位与去缩进", () => {
      const input = [
        "- 模块一：核心网关架构",
        "  网关服务负责流量入口接入与鉴权治理。",
        "  - 路由转发与负载均衡",
        "  - JWT 令牌双向核验",
      ].join("\n")

      const output = cleanCardListItemMarkdown(input)
      expect(output).toBe([
        "模块一：核心网关架构",
        "网关服务负责流量入口接入与鉴权治理。",
        "- 路由转发与负载均衡",
        "- JWT 令牌双向核验",
      ].join("\n"))
    })

    it("非列表项 Markdown 文本保持原样输出", () => {
      expect(cleanCardListItemMarkdown("### 常规三级标题")).toBe("### 常规三级标题")
      expect(cleanCardListItemMarkdown("这是一段普通说明段落。")).toBe("这是一段普通说明段落。")
      expect(cleanCardListItemMarkdown("")).toBe("")
    })
  })

  describe("2. detectListSuperBlock 列表超级块检测判定", () => {
    it("命中 2 项列表超级块：判定为 two-cols-header，分配 left 与 right 插槽", () => {
      const sbNode: ISiYuanBlockNode = {
        id: "sb-2cols",
        type: "s",
        subType: "col",
        children: [
          { id: "item-1", type: "i", markdown: "- 左栏卡片：前端技术栈\n  Vue 3 + Vite" },
          { id: "item-2", type: "i", markdown: "- 右栏卡片：后端技术栈\n  Go + SQLite" },
        ],
      }

      const res = detectListSuperBlock(sbNode)
      expect(res).not.toBeNull()
      expect(res?.count).toBe(2)
      expect(res?.layout).toBe("two-cols-header")
      expect(res?.slots).toEqual(["left", "right"])
      expect(res?.items.map(it => it.id)).toEqual(["item-1", "item-2"])
    })

    it("命中 3 项列表超级块：判定为 three-cols-header，分配 col-1, col-2, col-3 插槽", () => {
      const sbNode: ISiYuanBlockNode = {
        id: "sb-3cols",
        type: "NodeSuperBlock",
        ial: { "data-sb-layout": "col" },
        children: [
          { id: "item-1", type: "i", markdown: "- 架构层\n  核心引擎" },
          { id: "item-2", type: "i", markdown: "- 业务层\n  应用集成" },
          { id: "item-3", type: "i", markdown: "- 运维层\n  监控部署" },
        ],
      }

      const res = detectListSuperBlock(sbNode)
      expect(res).not.toBeNull()
      expect(res?.count).toBe(3)
      expect(res?.layout).toBe("three-cols-header")
      expect(res?.slots).toEqual(["col-1", "col-2", "col-3"])
      expect(res?.items.map(it => it.id)).toEqual(["item-1", "item-2", "item-3"])
    })

    it("容错过滤超级块开闭标记节点", () => {
      const sbNode: ISiYuanBlockNode = {
        id: "sb-markers",
        type: "s",
        subType: "col",
        children: [
          { id: "m-open", type: "NodeSuperBlockOpenMarker", markdown: "{{{col" },
          { id: "item-1", type: "i", markdown: "- 要点 A" },
          { id: "item-2", type: "i", markdown: "- 要点 B" },
          { id: "m-close", type: "NodeSuperBlockCloseMarker", markdown: "}}}" },
        ],
      }

      const res = detectListSuperBlock(sbNode)
      expect(res).not.toBeNull()
      expect(res?.count).toBe(2)
      expect(res?.items.length).toBe(2)
    })

    it("纵向超级块（row/v）不匹配双栏/三栏分栏", () => {
      const sbNode: ISiYuanBlockNode = {
        id: "sb-row",
        type: "s",
        subType: "row",
        children: [
          { id: "item-1", type: "i", markdown: "- 要点 A" },
          { id: "item-2", type: "i", markdown: "- 要点 B" },
        ],
      }
      expect(detectListSuperBlock(sbNode)).toBeNull()
    })

    it("数量为 1 项或 4+ 项时，detectListSuperBlock 返回 null，isInvalidListSuperBlock 识别出边界超限", () => {
      const sb1: ISiYuanBlockNode = {
        id: "sb-1item",
        type: "s",
        subType: "col",
        children: [{ id: "item-1", type: "i", markdown: "- 单项" }],
      }
      expect(detectListSuperBlock(sb1)).toBeNull()
      expect(isInvalidListSuperBlock(sb1)?.items.length).toBe(1)

      const sb4: ISiYuanBlockNode = {
        id: "sb-4items",
        type: "s",
        subType: "col",
        children: [
          { id: "it-1", type: "i", markdown: "- 1" },
          { id: "it-2", type: "i", markdown: "- 2" },
          { id: "it-3", type: "i", markdown: "- 3" },
          { id: "it-4", type: "i", markdown: "- 4" },
        ],
      }
      expect(detectListSuperBlock(sb4)).toBeNull()
      expect(isInvalidListSuperBlock(sb4)?.items.length).toBe(4)
    })
  })

  describe("3. scanAndTagListSuperBlocks 属性自动化配置与拖拽重排", () => {
    it("初次识别：自动设置页面版式、表头插槽与各列表项插槽", () => {
      const docId = "doc-test-1"
      const blocks: ISiYuanBlockNode[] = [
        { id: "h-title", type: "h", markdown: "# 微服务技术演进", ial: {} },
        {
          id: "sb-1",
          type: "s",
          subType: "col",
          children: [
            { id: "it-1", type: "i", markdown: "- 单体架构阶段", ial: {} },
            { id: "it-2", type: "i", markdown: "- 微服务解耦阶段", ial: {} },
          ],
        },
      ]

      const res = scanAndTagListSuperBlocks(docId, blocks)
      expect(res.changes.length).toBe(4)

      // 验证页面根块配置
      const docChange = res.changes.find(c => c.blockId === docId)
      expect(docChange?.attrs[ATTR_PAGE_LAYOUT]).toBe("two-cols-header")

      // 验证表头插槽
      const hChange = res.changes.find(c => c.blockId === "h-title")
      expect(hChange?.attrs[ATTR_ELEM_SLOT]).toBe("header")

      // 验证左右栏插槽
      const it1Change = res.changes.find(c => c.blockId === "it-1")
      const it2Change = res.changes.find(c => c.blockId === "it-2")
      expect(it1Change?.attrs[ATTR_ELEM_SLOT]).toBe("left")
      expect(it2Change?.attrs[ATTR_ELEM_SLOT]).toBe("right")

      // 验证追踪状态
      expect(res.newTracked.length).toBe(1)
      expect(res.newTracked[0].layout).toBe("two-cols-header")
      expect(res.newTracked[0].itemIds).toEqual(["it-1", "it-2"])
    })

    it("用户拖动调换列表项顺序：根据最新排列自适应更新 slot", () => {
      const docId = "doc-test-reorder"
      // 模拟调换后的顺序：it-2 拖到了 it-1 前面
      const blocks: ISiYuanBlockNode[] = [
        { id: "h-title", type: "h", markdown: "# 系统架构", ial: { [ATTR_ELEM_SLOT]: "header" } },
        {
          id: "sb-1",
          type: "s",
          subType: "col",
          children: [
            { id: "it-2", type: "i", markdown: "- 模块二", ial: { [ATTR_ELEM_SLOT]: "right" } },
            { id: "it-1", type: "i", markdown: "- 模块一", ial: { [ATTR_ELEM_SLOT]: "left" } },
          ],
        },
      ]

      const tracked = [{
        superBlockId: "sb-1",
        pageTargetId: docId,
        headerId: "h-title",
        itemIds: ["it-1", "it-2"],
        layout: "two-cols-header" as const,
      }]

      const res = scanAndTagListSuperBlocks(docId, blocks, { tracked })
      // it-2 变成了第 1 项，应被更新为 left；it-1 变成了第 2 项，应被更新为 right
      const it2Change = res.changes.find(c => c.blockId === "it-2")
      const it1Change = res.changes.find(c => c.blockId === "it-1")
      expect(it2Change?.attrs[ATTR_ELEM_SLOT]).toBe("left")
      expect(it1Change?.attrs[ATTR_ELEM_SLOT]).toBe("right")
    })

    it("用户拖入第 3 个列表项（2 变 3）：自动升级为 three-cols-header 并重新分配三栏插槽", () => {
      const docId = "doc-test-2to3"
      const blocks: ISiYuanBlockNode[] = [
        { id: "h-title", type: "h", markdown: "# 研发团队三向能力", ial: { [ATTR_ELEM_SLOT]: "header" } },
        {
          id: "sb-1",
          type: "s",
          subType: "col",
          children: [
            { id: "it-1", type: "i", markdown: "- 技术深度", ial: { [ATTR_ELEM_SLOT]: "left" } },
            { id: "it-2", type: "i", markdown: "- 业务理解", ial: { [ATTR_ELEM_SLOT]: "right" } },
            { id: "it-3", type: "i", markdown: "- 组织协同", ial: {} },
          ],
        },
      ]

      const tracked = [{
        superBlockId: "sb-1",
        pageTargetId: docId,
        headerId: "h-title",
        itemIds: ["it-1", "it-2"],
        layout: "two-cols-header" as const,
      }]

      const res = scanAndTagListSuperBlocks(docId, blocks, { tracked })
      const docChange = res.changes.find(c => c.blockId === docId)
      expect(docChange?.attrs[ATTR_PAGE_LAYOUT]).toBe("three-cols-header")

      expect(res.changes.find(c => c.blockId === "it-1")?.attrs[ATTR_ELEM_SLOT]).toBe("col-1")
      expect(res.changes.find(c => c.blockId === "it-2")?.attrs[ATTR_ELEM_SLOT]).toBe("col-2")
      expect(res.changes.find(c => c.blockId === "it-3")?.attrs[ATTR_ELEM_SLOT]).toBe("col-3")
    })

    it("用户拖出列表项（3 变 2）：自动降级为 two-cols-header，分配 left/right 并清空移出项的 slot", () => {
      const docId = "doc-test-3to2"
      // it-3 被移出超级块
      const blocks: ISiYuanBlockNode[] = [
        { id: "h-title", type: "h", markdown: "# 核心指标", ial: { [ATTR_ELEM_SLOT]: "header" } },
        {
          id: "sb-1",
          type: "s",
          subType: "col",
          children: [
            { id: "it-1", type: "i", markdown: "- 指标 A", ial: { [ATTR_ELEM_SLOT]: "col-1" } },
            { id: "it-2", type: "i", markdown: "- 指标 B", ial: { [ATTR_ELEM_SLOT]: "col-2" } },
          ],
        },
        { id: "it-3", type: "i", markdown: "- 独立要点", ial: { [ATTR_ELEM_SLOT]: "col-3" } },
      ]

      const tracked = [{
        superBlockId: "sb-1",
        pageTargetId: docId,
        headerId: "h-title",
        itemIds: ["it-1", "it-2", "it-3"],
        layout: "three-cols-header" as const,
      }]

      const res = scanAndTagListSuperBlocks(docId, blocks, { tracked })
      expect(res.changes.find(c => c.blockId === docId)?.attrs[ATTR_PAGE_LAYOUT]).toBe("two-cols-header")
      expect(res.changes.find(c => c.blockId === "it-1")?.attrs[ATTR_ELEM_SLOT]).toBe("left")
      expect(res.changes.find(c => c.blockId === "it-2")?.attrs[ATTR_ELEM_SLOT]).toBe("right")

      // 验证 it-3 的 slot 被清空
      const it3Change = res.changes.find(c => c.blockId === "it-3")
      expect(it3Change?.attrs[ATTR_ELEM_SLOT]).toBe("")
    })

    it("边界自愈：列表项减少至 1 项时，自动恢复默认版式并清理相关 slot", () => {
      const docId = "doc-test-revert"
      const blocks: ISiYuanBlockNode[] = [
        { id: "h-title", type: "h", markdown: "# 标题", ial: { [ATTR_ELEM_SLOT]: "header" } },
        {
          id: "sb-1",
          type: "s",
          subType: "col",
          children: [
            { id: "it-1", type: "i", markdown: "- 仅剩一项", ial: { [ATTR_ELEM_SLOT]: "left" } },
          ],
        },
      ]

      const tracked = [{
        superBlockId: "sb-1",
        pageTargetId: docId,
        headerId: "h-title",
        itemIds: ["it-1", "it-2"],
        layout: "two-cols-header" as const,
      }]

      const res = scanAndTagListSuperBlocks(docId, blocks, { tracked })
      // 页面版式被重置清空
      expect(res.changes.find(c => c.blockId === docId)?.attrs[ATTR_PAGE_LAYOUT]).toBe("")
      // 表头 slot 被清空
      expect(res.changes.find(c => c.blockId === "h-title")?.attrs[ATTR_ELEM_SLOT]).toBe("")
      // it-1 与 it-2 的 slot 被清空
      expect(res.changes.find(c => c.blockId === "it-1")?.attrs[ATTR_ELEM_SLOT]).toBe("")
      expect(res.changes.find(c => c.blockId === "it-2")?.attrs[ATTR_ELEM_SLOT]).toBe("")
      // 追踪状态被清空
      expect(res.newTracked.length).toBe(0)
    })
  })

  describe("4. DocumentCompilerService 全链路编译与持久化集成", () => {
    it("compile() 自动识别 2 项列表超级块并生成带表头双栏的 Slidev 演示文档", async () => {
      const docId = "doc-compile-2cols"
      const mockSetAttrs = vi.fn().mockResolvedValue({})
      const mockSql = vi.fn().mockResolvedValue([])

      const mockBlocks: ISiYuanBlockNode[] = [
        { id: "h-main", type: "h", markdown: "# 核心双引擎", content: "核心双引擎" },
        {
          id: "sb-root",
          type: "s",
          subType: "col",
          children: [
            {
              id: "item-left",
              type: "i",
              markdown: "- 本地引擎\n  零网络依赖极速离线放映",
              content: "本地引擎",
            },
            {
              id: "item-right",
              type: "i",
              markdown: "- 远程协同引擎\n  支持多设备实时同步放映",
              content: "远程协同引擎",
            },
          ],
        },
      ]

      const compiler = new DocumentCompilerService({
        getBlockAttrs: vi.fn().mockResolvedValue({}),
        getChildBlocks: vi.fn().mockResolvedValue(mockBlocks),
        setBlockAttrs: mockSetAttrs,
        sql: mockSql,
      })

      const doc = await compiler.compile(docId)
      expect(doc.slides.length).toBe(1)
      const page = doc.slides[0]

      expect(page.frontmatter.layout).toBe("two-cols-header")
      expect(page.rawMarkdown).toContain("# 核心双引擎")
      expect(page.rawMarkdown).toContain("::left::")
      expect(page.rawMarkdown).toContain("本地引擎\n零网络依赖极速离线放映")
      expect(page.rawMarkdown).toContain("::right::")
      expect(page.rawMarkdown).toContain("远程协同引擎\n支持多设备实时同步放映")

      // 验证持久化 setBlockAttrs 被调用
      expect(mockSetAttrs).toHaveBeenCalledWith(docId, { [ATTR_PAGE_LAYOUT]: "two-cols-header" })
      expect(mockSetAttrs).toHaveBeenCalledWith("h-main", { [ATTR_ELEM_SLOT]: "header" })
      expect(mockSetAttrs).toHaveBeenCalledWith("item-left", { [ATTR_ELEM_SLOT]: "left" })
      expect(mockSetAttrs).toHaveBeenCalledWith("item-right", { [ATTR_ELEM_SLOT]: "right" })
    })

    it("compile() 自动识别 3 项列表超级块并生成带表头三栏的 Slidev 演示文档", async () => {
      const docId = "doc-compile-3cols"
      const mockSetAttrs = vi.fn().mockResolvedValue({})
      const mockSql = vi.fn().mockResolvedValue([])

      const mockBlocks: ISiYuanBlockNode[] = [
        { id: "h-main", type: "h", markdown: "# 三阶段战略", content: "三阶段战略" },
        {
          id: "sb-root",
          type: "s",
          subType: "col",
          children: [
            { id: "item-1", type: "i", markdown: "- 第一阶段\n  打桩稳固基础" },
            { id: "item-2", type: "i", markdown: "- 第二阶段\n  全面拓展应用" },
            { id: "item-3", type: "i", markdown: "- 第三阶段\n  生态商业繁荣" },
          ],
        },
      ]

      const compiler = new DocumentCompilerService({
        getBlockAttrs: vi.fn().mockResolvedValue({}),
        getChildBlocks: vi.fn().mockResolvedValue(mockBlocks),
        setBlockAttrs: mockSetAttrs,
        sql: mockSql,
      })

      const doc = await compiler.compile(docId)
      const page = doc.slides[0]

      expect(page.frontmatter.layout).toBe("three-cols-header")
      expect(page.rawMarkdown).toContain("# 三阶段战略")
      expect(page.rawMarkdown).toContain("::col-1::\n\n第一阶段\n打桩稳固基础")
      expect(page.rawMarkdown).toContain("::col-2::\n\n第二阶段\n全面拓展应用")
      expect(page.rawMarkdown).toContain("::col-3::\n\n第三阶段\n生态商业繁荣")
    })
  })

  describe("5. renderSlideBlocksToHtml 多栏卡片 HTML 渲染", () => {
    it("two-cols-header: 正确剥离列表圆点并输出干净的卡片 HTML 结构", () => {
      const slide = {
        pageIndex: 1,
        startBlockId: "doc-1",
        frontmatter: { layout: "two-cols-header" },
        notes: "",
        blocks: [
          { id: "h1", type: "h", content: "核心对比", rawMarkdown: "# 核心对比", slot: "header" },
          { id: "b-l", type: "i", content: "方案 A", rawMarkdown: "- 方案 A\n  成本低部署快", slot: "left" },
          { id: "b-r", type: "i", content: "方案 B", rawMarkdown: "- 方案 B\n  高可靠扩展强", slot: "right" },
        ],
        rawMarkdown: "",
      }

      const html = renderSlideBlocksToHtml(slide)
      expect(html).toContain("layout-two-cols-header-container")
      expect(html).toContain("pdf-col--left")
      expect(html).toContain("pdf-col--right")
      expect(html).toContain("方案 A")
      expect(html).toContain("方案 B")
      // 确认未生成带有 bullet 圆点的 ul / li 结构
      expect(html).not.toContain("<ul")
      expect(html).not.toContain("<li")
    })
  })

  describe("6. 嵌套超级块透明解包识别与动态同步 (col1-2 + col3 / col1 + col2-3)", () => {
    it("形态 A (col1-2 + col3)：外层 [内层横向超级块, 列表项3] 正确识别为 three-cols-header", () => {
      const sbOuter: ISiYuanBlockNode = {
        id: "sb-outer-a",
        type: "s",
        subType: "col",
        children: [
          {
            id: "sb-inner-a",
            type: "s",
            subType: "col",
            children: [
              { id: "item-1", type: "i", markdown: "- 前端层：Vue 3 + Vite" },
              { id: "item-2", type: "i", markdown: "- 后端层：Go + gRPC" },
            ],
          },
          { id: "item-3", type: "i", markdown: "- 数据层：PostgreSQL" },
        ],
      }

      const res = detectListSuperBlock(sbOuter)
      expect(res).not.toBeNull()
      expect(res?.count).toBe(3)
      expect(res?.layout).toBe("three-cols-header")
      expect(res?.slots).toEqual(["col-1", "col-2", "col-3"])
      expect(res?.items.map(it => it.id)).toEqual(["item-1", "item-2", "item-3"])
      expect(res?.nestedSuperBlocks?.map(n => n.id)).toEqual(["sb-inner-a"])
    })

    it("形态 B (col1 + col2-3)：外层 [列表项1, 内层横向超级块] 正确识别为 three-cols-header", () => {
      const sbOuter: ISiYuanBlockNode = {
        id: "sb-outer-b",
        type: "NodeSuperBlock",
        ial: { "data-sb-layout": "col" },
        children: [
          { id: "item-1", type: "i", markdown: "- 接入层：API 网关" },
          {
            id: "sb-inner-b",
            type: "NodeSuperBlock",
            ial: { "data-sb-layout": "col" },
            children: [
              { id: "item-2", type: "i", markdown: "- 服务层：微服务集群" },
              { id: "item-3", type: "i", markdown: "- 存储层：分布式缓存" },
            ],
          },
        ],
      }

      const res = detectListSuperBlock(sbOuter)
      expect(res).not.toBeNull()
      expect(res?.count).toBe(3)
      expect(res?.layout).toBe("three-cols-header")
      expect(res?.slots).toEqual(["col-1", "col-2", "col-3"])
      expect(res?.items.map(it => it.id)).toEqual(["item-1", "item-2", "item-3"])
      expect(res?.nestedSuperBlocks?.map(n => n.id)).toEqual(["sb-inner-b"])
    })

    it("动态升级：用户由 2 栏拖入第 3 项包裹成嵌套超级块，自动升级为 three-cols-header 并分配三栏插槽", () => {
      const docId = "doc-nested-upgrade"
      // 初始状态为 2 栏
      const trackedInit = [
        {
          superBlockId: "sb-inner",
          pageTargetId: docId,
          headerId: "h-title",
          itemIds: ["it-1", "it-2"],
          layout: "two-cols-header" as const,
        },
      ]

      // 用户拖入 it-3 与原 sb-inner 组成 sb-outer
      const blocks: ISiYuanBlockNode[] = [
        { id: "h-title", type: "h", markdown: "# 核心架构体系", ial: { "custom-slidev-slot": "header" } },
        {
          id: "sb-outer",
          type: "s",
          subType: "col",
          children: [
            {
              id: "sb-inner",
              type: "s",
              subType: "col",
              children: [
                { id: "it-1", type: "i", markdown: "- 模块 1", ial: { "custom-slidev-slot": "left" } },
                { id: "it-2", type: "i", markdown: "- 模块 2", ial: { "custom-slidev-slot": "right" } },
              ],
            },
            { id: "it-3", type: "i", markdown: "- 模块 3", ial: {} },
          ],
        },
      ]

      const docNode: ISiYuanBlockNode = {
        id: docId,
        type: "d",
        ial: { "custom-slidev-layout": "two-cols-header" },
        children: blocks,
      }

      const result = scanAndTagListSuperBlocks(docId, [docNode, ...blocks], { tracked: trackedInit })
      expect(docNode.ial["custom-slidev-layout"]).toBe("three-cols-header")
      const it1 = blocks[1].children![0].children![0]
      const it2 = blocks[1].children![0].children![1]
      const it3 = blocks[1].children![1]

      expect(it1.ial?.["custom-slidev-slot"]).toBe("col-1")
      expect(it2.ial?.["custom-slidev-slot"]).toBe("col-2")
      expect(it3.ial?.["custom-slidev-slot"]).toBe("col-3")
      expect(result.newTracked[0].layout).toBe("three-cols-header")
      expect(result.newTracked[0].itemIds).toEqual(["it-1", "it-2", "it-3"])
    })

    it("动态降级：嵌套 3 栏中拖走第 3 项变回 2 栏，自动降级为 two-cols-header 并清空第 3 项插槽", () => {
      const docId = "doc-nested-downgrade"
      const trackedInit = [
        {
          superBlockId: "sb-outer",
          nestedSuperBlockIds: ["sb-inner"],
          pageTargetId: docId,
          headerId: "h-title",
          itemIds: ["it-1", "it-2", "it-3"],
          layout: "three-cols-header" as const,
        },
      ]

      // 第 3 项被拖出到超级块外
      const it3Node: ISiYuanBlockNode = {
        id: "it-3",
        type: "i",
        markdown: "- 独立列表项 3",
        ial: { "custom-slidev-slot": "col-3" },
      }
      const blocks: ISiYuanBlockNode[] = [
        { id: "h-title", type: "h", markdown: "# 核心架构体系", ial: { "custom-slidev-slot": "header" } },
        {
          id: "sb-inner",
          type: "s",
          subType: "col",
          children: [
            { id: "it-1", type: "i", markdown: "- 模块 1", ial: { "custom-slidev-slot": "col-1" } },
            { id: "it-2", type: "i", markdown: "- 模块 2", ial: { "custom-slidev-slot": "col-2" } },
          ],
        },
        it3Node,
      ]

      const docNode: ISiYuanBlockNode = {
        id: docId,
        type: "d",
        ial: { "custom-slidev-layout": "three-cols-header" },
        children: blocks,
      }

      const result = scanAndTagListSuperBlocks(docId, [docNode, ...blocks], { tracked: trackedInit })
      expect(docNode.ial["custom-slidev-layout"]).toBe("two-cols-header")
      const it1 = blocks[1].children![0]
      const it2 = blocks[1].children![1]

      expect(it1.ial?.["custom-slidev-slot"]).toBe("left")
      expect(it2.ial?.["custom-slidev-slot"]).toBe("right")
      expect(it3Node.ial?.["custom-slidev-slot"]).toBe("")
      expect(result.newTracked[0].layout).toBe("two-cols-header")
      expect(result.newTracked[0].itemIds).toEqual(["it-1", "it-2"])
    })

    it("全链路编译：嵌套 3 栏在 DocumentCompilerService 编译后产出符合 Slidev 规范的三栏语法", async () => {
      const docId = "doc-nested-compile"
      const mockBlocks: ISiYuanBlockNode[] = [
        { id: "h-head", type: "h", markdown: "# 战略三支柱", content: "战略三支柱" },
        {
          id: "sb-outer",
          type: "s",
          subType: "col",
          children: [
            {
              id: "sb-inner",
              type: "s",
              subType: "col",
              children: [
                { id: "it-1", type: "i", markdown: "- 支柱一\n  组织韧性建设" },
                { id: "it-2", type: "i", markdown: "- 支柱二\n  敏捷效能交付" },
              ],
            },
            { id: "it-3", type: "i", markdown: "- 支柱三\n  全球生态合作" },
          ],
        },
      ]

      const compiler = new DocumentCompilerService({
        getBlockAttrs: vi.fn().mockResolvedValue({}),
        getChildBlocks: vi.fn().mockResolvedValue(mockBlocks),
        setBlockAttrs: vi.fn().mockResolvedValue({}),
        sql: vi.fn().mockResolvedValue([]),
      })

      const doc = await compiler.compile(docId)
      const page = doc.slides[0]

      expect(page.frontmatter.layout).toBe("three-cols-header")
      expect(page.rawMarkdown).toContain("# 战略三支柱")
      expect(page.rawMarkdown).toContain("::col-1::\n\n支柱一\n组织韧性建设")
      expect(page.rawMarkdown).toContain("::col-2::\n\n支柱二\n敏捷效能交付")
      expect(page.rawMarkdown).toContain("::col-3::\n\n支柱三\n全球生态合作")
    })
  })

  describe("7. 避免与 image-left / image-right 自动识别冲突机制验证", () => {
    it("列表项卡片内部包含配图时，isImageBlock 返回 false，不被识别为图文分栏", () => {
      const itemWithImg: ISiYuanBlockNode = {
        id: "li-img",
        type: "i",
        markdown: "- ![架构配图](assets/arch.png)\n  核心微服务集群架构说明",
      }

      expect(isListItemNode(itemWithImg)).toBe(true)
      expect(isImageBlock(itemWithImg)).toBe(false)
    })

    it("包含内嵌配图列表项的双栏超级块，正确识别为 two-cols-header 而非 image-left", () => {
      const sbNode: ISiYuanBlockNode = {
        id: "sb-card-img",
        type: "s",
        subType: "col",
        children: [
          {
            id: "li-1",
            type: "i",
            markdown: "- ![方案A](assets/a.png)\n  方案 A 架构简述",
          },
          {
            id: "li-2",
            type: "i",
            markdown: "- 方案 B 纯文字架构简述",
          },
        ],
      }

      // 验证未被误识别为图文分栏
      expect(detectSuperBlockImageLayout(sbNode)).toBeNull()

      // 正确识别为列表双栏
      const listRes = detectListSuperBlock(sbNode)
      expect(listRes).not.toBeNull()
      expect(listRes?.layout).toBe("two-cols-header")
      expect(listRes?.slots).toEqual(["left", "right"])
    })

    it("顶层图文超级块包裹内层列表超级块时，顶层保持 image-left 版式，不被列表多栏覆盖", () => {
      const docId = "doc-img-left-with-nested-list"
      const imgBlock: ISiYuanBlockNode = {
        id: "img-main",
        type: "p",
        markdown: "![产品全貌大图](assets/overview.png)",
        ial: {},
      }
      const listSb: ISiYuanBlockNode = {
        id: "sb-inner-list",
        type: "s",
        subType: "col",
        children: [
          { id: "it-a", type: "i", markdown: "- 特性一：全量响应" },
          { id: "it-b", type: "i", markdown: "- 特性二：毫秒感知" },
        ],
      }
      const outerImgSb: ISiYuanBlockNode = {
        id: "sb-outer-img",
        type: "s",
        subType: "col",
        children: [imgBlock, listSb],
      }

      // 1. 顶层超级块被正确识别为 image-left
      const imgDet = detectSuperBlockImageLayout(outerImgSb)
      expect(imgDet).not.toBeNull()
      expect(imgDet?.layout).toBe("image-left")

      // 2. scanAndTagSuperBlocks 标记图片
      scanAndTagSuperBlocks([outerImgSb])
      expect(imgBlock.ial?.["custom-slidev-layout"]).toBe("image-left")

      // 3. scanAndTagListSuperBlocks 进行仲裁：检测到顶层图文版式，不会覆盖页面为 two-cols-header
      const docNode: ISiYuanBlockNode = {
        id: docId,
        type: "d",
        ial: { "custom-slidev-layout": "image-left" },
        children: [outerImgSb],
      }

      const listRes = scanAndTagListSuperBlocks(docId, [docNode, outerImgSb])
      expect(docNode.ial["custom-slidev-layout"]).toBe("image-left")
      expect(listRes.newTracked.length).toBe(0)
    })
  })

  describe("7. 嵌套形态 A/B 超级块与列表容器深层递归三栏集成测试 (用户真实场景)", () => {
    it("嵌套形态 A (col1-2 + col3)：宿主 API 分级递归加载 sb-inner，端到端编译为标准三栏布局与独立插槽", async () => {
      const docId = "doc-nested-form-a"
      const mockSetAttrs = vi.fn().mockResolvedValue({})
      const mockSql = vi.fn().mockResolvedValue([])

      // 模拟思源初次调用 getChildBlocks(docId) 时，sb-inner.children 未预加载 (undefined)
      const mockTopBlocks: ISiYuanBlockNode[] = [
        { id: "h-title", type: "h", markdown: "# 个人经历与沉淀", content: "个人经历与沉淀" },
        {
          id: "sb-outer",
          type: "s",
          subType: "col",
          children: [
            {
              id: "sb-inner",
              type: "s",
              subType: "col",
              // children 初始为空/undefined，模拟宿主逐级拉取
            },
            {
              id: "item-3",
              type: "i",
              markdown: "- 2026年全面拓展\n  进阶资深架构师",
              content: "2026年全面拓展",
            },
          ],
        },
      ]

      // 模拟思源响应 getChildBlocks("sb-inner")
      const mockInnerBlocks: ISiYuanBlockNode[] = [
        {
          id: "item-1",
          type: "i",
          markdown: "- 2024年探索起步\n  接触AI与自动化技术",
          content: "2024年探索起步",
        },
        {
          id: "item-2",
          type: "i",
          markdown: "- 2025年项目深耕\n  荣获创新大赛三等奖",
          content: "2025年项目深耕",
        },
      ]

      const compiler = new DocumentCompilerService({
        getBlockAttrs: vi.fn().mockResolvedValue({}),
        getChildBlocks: vi.fn().mockImplementation((blockId: string) => {
          if (blockId === docId) return Promise.resolve(mockTopBlocks)
          if (blockId === "sb-inner") return Promise.resolve(mockInnerBlocks)
          return Promise.resolve([])
        }),
        setBlockAttrs: mockSetAttrs,
        sql: mockSql,
      })

      const doc = await compiler.compile(docId)
      expect(doc.slides.length).toBe(1)
      const page = doc.slides[0]

      // 1. 验证版式识别为 three-cols-header (绝非降级为 two-cols-header)
      expect(page.frontmatter.layout).toBe("three-cols-header")

      // 2. 验证生成的 Slidev Markdown 具备三栏插槽，且三个列表项分别归入独立的栏目
      expect(page.rawMarkdown).toContain("# 个人经历与沉淀")
      expect(page.rawMarkdown).toContain("::col-1::")
      expect(page.rawMarkdown).toContain("2024年探索起步\n接触AI与自动化技术")
      expect(page.rawMarkdown).toContain("::col-2::")
      expect(page.rawMarkdown).toContain("2025年项目深耕\n荣获创新大赛三等奖")
      expect(page.rawMarkdown).toContain("::col-3::")
      expect(page.rawMarkdown).toContain("2026年全面拓展\n进阶资深架构师")

      // 3. 验证严禁将前两项合并在 ::left:: 或同一栏内
      expect(page.rawMarkdown).not.toContain("::left::")
      expect(page.rawMarkdown).not.toContain("::right::")

      // 4. 验证持久化 setBlockAttrs 正确写入对应三栏插槽
      expect(mockSetAttrs).toHaveBeenCalledWith(docId, { [ATTR_PAGE_LAYOUT]: "three-cols-header" })
      expect(mockSetAttrs).toHaveBeenCalledWith("h-title", { [ATTR_ELEM_SLOT]: "header" })
      expect(mockSetAttrs).toHaveBeenCalledWith("item-1", { [ATTR_ELEM_SLOT]: "col-1" })
      expect(mockSetAttrs).toHaveBeenCalledWith("item-2", { [ATTR_ELEM_SLOT]: "col-2" })
      expect(mockSetAttrs).toHaveBeenCalledWith("item-3", { [ATTR_ELEM_SLOT]: "col-3" })

      // 5. 验证单页 HTML/PDF 导出渲染也是三栏独立结构
      const html = renderSlideBlocksToHtml(page)
      expect(html).toContain("layout-three-cols-header-container")
      expect(html).toContain("pdf-col--1")
      expect(html).toContain("pdf-col--2")
      expect(html).toContain("pdf-col--3")
      // 验证圆点符号已被剥离清洗
      expect(html).toContain("2024年探索起步")
      expect(html).toContain("2025年项目深耕")
      expect(html).toContain("2026年全面拓展")
      expect(html).not.toContain("- 2024年探索起步")
    })

    it("嵌套形态 B (col1 + col2-3)：外层第一项为独立列表，第二项为内层超级块，正确解包为三栏", async () => {
      const docId = "doc-nested-form-b"
      const mockSetAttrs = vi.fn().mockResolvedValue({})
      const mockSql = vi.fn().mockResolvedValue([])

      const mockTopBlocks: ISiYuanBlockNode[] = [
        { id: "h-title-b", type: "h", markdown: "# 三阶段演进", content: "三阶段演进" },
        {
          id: "sb-outer-b",
          type: "s",
          subType: "col",
          children: [
            {
              id: "item-b-1",
              type: "i",
              markdown: "- 第一阶段：调研验证",
              content: "第一阶段：调研验证",
            },
            {
              id: "sb-inner-b",
              type: "s",
              subType: "col",
              children: [
                {
                  id: "item-b-2",
                  type: "i",
                  markdown: "- 第二阶段：工程落地",
                  content: "第二阶段：工程落地",
                },
                {
                  id: "item-b-3",
                  type: "i",
                  markdown: "- 第三阶段：商业推广",
                  content: "第三阶段：商业推广",
                },
              ],
            },
          ],
        },
      ]

      const compiler = new DocumentCompilerService({
        getBlockAttrs: vi.fn().mockResolvedValue({}),
        getChildBlocks: vi.fn().mockResolvedValue(mockTopBlocks),
        setBlockAttrs: mockSetAttrs,
        sql: mockSql,
      })

      const doc = await compiler.compile(docId)
      const page = doc.slides[0]

      expect(page.frontmatter.layout).toBe("three-cols-header")
      expect(page.rawMarkdown).toContain("::col-1::")
      expect(page.rawMarkdown).toContain("第一阶段：调研验证")
      expect(page.rawMarkdown).toContain("::col-2::")
      expect(page.rawMarkdown).toContain("第二阶段：工程落地")
      expect(page.rawMarkdown).toContain("::col-3::")
      expect(page.rawMarkdown).toContain("第三阶段：商业推广")

      expect(mockSetAttrs).toHaveBeenCalledWith("item-b-1", { [ATTR_ELEM_SLOT]: "col-1" })
      expect(mockSetAttrs).toHaveBeenCalledWith("item-b-2", { [ATTR_ELEM_SLOT]: "col-2" })
      expect(mockSetAttrs).toHaveBeenCalledWith("item-b-3", { [ATTR_ELEM_SLOT]: "col-3" })
    })

    it("列表容器形态：超级块包含 1 个双项 NodeList 与 1 个单项 NodeList，正确展开解构成独立三栏", async () => {
      const docId = "doc-nodelist-3cols"
      const mockSetAttrs = vi.fn().mockResolvedValue({})
      const mockSql = vi.fn().mockResolvedValue([])

      const mockBlocks: ISiYuanBlockNode[] = [
        { id: "h-list-title", type: "h", markdown: "# 核心模块", content: "核心模块" },
        {
          id: "sb-list-root",
          type: "s",
          subType: "col",
          children: [
            // 第一列容器：包含 2 个列表项
            {
              id: "list-container-1",
              type: "l",
              children: [
                { id: "sub-it-1", type: "i", markdown: "- 模块 1：网关接入" },
                { id: "sub-it-2", type: "i", markdown: "- 模块 2：服务治理" },
              ],
            },
            // 第二列容器：包含 1 个列表项
            {
              id: "list-container-2",
              type: "l",
              children: [
                { id: "sub-it-3", type: "i", markdown: "- 模块 3：可观测中心" },
              ],
            },
          ],
        },
      ]

      const compiler = new DocumentCompilerService({
        getBlockAttrs: vi.fn().mockResolvedValue({}),
        getChildBlocks: vi.fn().mockResolvedValue(mockBlocks),
        setBlockAttrs: mockSetAttrs,
        sql: mockSql,
      })

      const doc = await compiler.compile(docId)
      const page = doc.slides[0]

      expect(page.frontmatter.layout).toBe("three-cols-header")
      expect(page.rawMarkdown).toContain("::col-1::")
      expect(page.rawMarkdown).toContain("模块 1：网关接入")
      expect(page.rawMarkdown).toContain("::col-2::")
      expect(page.rawMarkdown).toContain("模块 2：服务治理")
      expect(page.rawMarkdown).toContain("::col-3::")
      expect(page.rawMarkdown).toContain("模块 3：可观测中心")

      expect(mockSetAttrs).toHaveBeenCalledWith("sub-it-1", { [ATTR_ELEM_SLOT]: "col-1" })
      expect(mockSetAttrs).toHaveBeenCalledWith("sub-it-2", { [ATTR_ELEM_SLOT]: "col-2" })
      expect(mockSetAttrs).toHaveBeenCalledWith("sub-it-3", { [ATTR_ELEM_SLOT]: "col-3" })
    })
  })

  describe("6. 超级块分栏去除圆点与列表项标题 (###) 渲染支持", () => {
    it("列表项包含 ### 三级标题时，应正确渲染为 h3 标签，不残留 ### 字面量，并格式化后续正文", () => {
      const md = `* ### 核心架构
  基于分布式微服务设计，解耦业务逻辑。
* ### 性能指标
  P99 耗时低于 15ms。`

      const html = renderMarkdownList(md)
      expect(html).not.toBeNull()
      expect(html).toContain('<h3 class="slide-list-item-title">核心架构</h3>')
      expect(html).toContain('<p class="slide-list-item-desc">基于分布式微服务设计，解耦业务逻辑。</p>')
      expect(html).toContain('<h3 class="slide-list-item-title">性能指标</h3>')
      expect(html).toContain('<p class="slide-list-item-desc">P99 耗时低于 15ms。</p>')
      expect(html).not.toContain("###")
    })

    it("单行列表项 `- ### 三级标题` 应正确渲染为 h3 标题", () => {
      const md = `- ### 极简微服务
- ### 响应式前端`

      const html = renderMarkdownList(md)
      expect(html).not.toBeNull()
      expect(html).toContain('<h3 class="slide-list-item-title">极简微服务</h3>')
      expect(html).toContain('<h3 class="slide-list-item-title">响应式前端</h3>')
      expect(html).not.toContain("###")
    })

    it("有序列表包含不同级别标题时，应分别渲染为对应级别的 h 标签", () => {
      const md = `1. ## 一级规划：系统拓扑
   第一阶段部署
2. #### 四级细化：具体参数
   超时时间设置为 3000ms`

      const html = renderMarkdownList(md)
      expect(html).not.toBeNull()
      expect(html).toContain('<h2 class="slide-list-item-title">一级规划：系统拓扑</h2>')
      expect(html).toContain('<h4 class="slide-list-item-title">四级细化：具体参数</h4>')
      expect(html).not.toContain("##")
      expect(html).not.toContain("####")
    })

    it("单文件 HTML 导出中应包含分栏布局紧凑自然行距与子列表保留圆点标记样式", async () => {
      const { buildStandaloneHtml } = await import("../src/export/single-html-exporter")
      const testDoc = {
        docId: "doc-no-bullets-test",
        title: "No Bullets Test",
        config: { theme: "default", aspectRatio: "16/9", highlighter: "shiki" as const, defaultTransition: "slide-left", colorSchema: "dark" as const },
        slides: [
          {
            pageIndex: 1,
            startBlockId: "p1",
            frontmatter: { layout: "three-cols-header" },
            notes: "",
            blocks: [
              { id: "h1", type: "h", content: "## 分栏卡片", rawMarkdown: "## 分栏卡片", slot: "header" },
              { id: "c1", type: "i", content: "* ### 第一栏\n  说明", rawMarkdown: "* ### 第一栏\n  说明", slot: "col-1" },
            ],
            rawMarkdown: "## 分栏卡片",
          },
        ],
        fullMarkdown: "",
        assetMap: {},
      }

      const html = await buildStandaloneHtml(testDoc)
      expect(html).toContain(".layout-three-cols ul")
      expect(html).toContain(".three-cols-col ul")
      expect(html).toContain("list-style: disc !important")
      expect(html).toContain("margin-bottom: 6px !important")
      expect(html).toContain(".slide-list-item-title")
    })

    it("三栏表头排版中应正确剥离各栏首项圆点并保留其下子列表圆点及紧凑行距", async () => {
      const { buildSlidevDocument } = await import("../src/compiler/slidev-ast-builder")
      const { renderSlideBlocksToHtml } = await import("../src/export/markdown-renderer")

      const mockBlocks: any[] = [
        {
          id: "doc-header",
          type: "h",
          content: "表头说明",
          markdown: "# 表头说明",
          subType: "h1",
          ial: { "custom-slidev-slot": "header" },
        },
        {
          id: "col-1",
          type: "i",
          content: "* ### 栏目一\n  * 子项 1.1\n  * 子项 1.2",
          markdown: "* ### 栏目一\n  * 子项 1.1\n  * 子项 1.2",
          ial: { "custom-slidev-slot": "col-1" },
        },
        {
          id: "col-2",
          type: "i",
          content: "* 普通文字标题二\n  * 子项 2.1",
          markdown: "* 普通文字标题二\n  * 子项 2.1",
          ial: { "custom-slidev-slot": "col-2" },
        },
        {
          id: "col-3",
          type: "i",
          content: "* ### 栏目三\n  * 子项 3.1",
          markdown: "* ### 栏目三\n  * 子项 3.1",
          ial: { "custom-slidev-slot": "col-3" },
        },
      ]

      const doc = buildSlidevDocument(
        "doc-three-cols-test",
        { "custom-slidev-layout": "three-cols-header" },
        mockBlocks,
      )
      expect(doc.slides.length).toBeGreaterThan(0)
      const slide = doc.slides[0]
      expect(slide.frontmatter.layout).toBe("three-cols-header")

      // 验证第一栏首项剥离了列表圆点标记成为标题
      const col1Block = slide.blocks.find(b => b.slot === "col-1")
      expect(col1Block).toBeDefined()
      expect(col1Block?.rawMarkdown).toContain("### 栏目一")
      expect(col1Block?.rawMarkdown).not.toMatch(/^\s*[*+-]\s+### 栏目一/)

      // 验证第二栏首项剥离了列表标记
      const col2Block = slide.blocks.find(b => b.slot === "col-2")
      expect(col2Block).toBeDefined()
      expect(col2Block?.rawMarkdown).toContain("普通文字标题二")
      expect(col2Block?.rawMarkdown).not.toMatch(/^\s*[*+-]\s+普通文字标题二/)

      // 渲染为 HTML 并验证子项保留圆点 (disc / 嵌套 circle)
      const renderedHtml = renderSlideBlocksToHtml(slide)
      expect(renderedHtml).toContain("slide-list-item-title")
      expect(renderedHtml).toContain("子项 1.1")
      expect(renderedHtml).toContain("子项 2.1")
      expect(renderedHtml).toContain("子项 3.1")
    })

    it("三栏列表容器内放置图片和视频且混入空块时，标题正确渲染为标题标签且首项圆点完全去除", async () => {
      const { buildSlidevDocument } = await import("../src/compiler/slidev-ast-builder")
      const { renderSlideBlocksToHtml } = await import("../src/export/markdown-renderer")
      const { buildStandaloneHtml } = await import("../src/export/single-html-exporter")

      const mockBlocks: any[] = [
        {
          id: "header-1",
          type: "h",
          content: "我的代表作品",
          markdown: "## 我的代表作品",
          subType: "h2",
          ial: { "custom-slidev-slot": "header" },
        },
        {
          id: "col-1-list",
          type: "i",
          content: "- #### AI 摄影师 PoseDirector\n\n  <video controls=\"controls\" src=\"assets/demo.mp4\"></video>",
          markdown: "- #### AI 摄影师 PoseDirector\n\n  <video controls=\"controls\" src=\"assets/demo.mp4\"></video>",
          ial: { "custom-slidev-slot": "col-1" },
        },
        {
          id: "col-2-list",
          type: "i",
          content: "- #### 订阅管家 SubManage\n\n  ![](assets/sub.png)",
          markdown: "- #### 订阅管家 SubManage\n\n  ![](assets/sub.png)",
          ial: { "custom-slidev-slot": "col-2" },
        },
        {
          id: "col-3-list",
          type: "i",
          content: "- #### 方块射手 BlockShooter\n\n  休闲益智小游戏",
          markdown: "- #### 方块射手 BlockShooter\n\n  休闲益智小游戏",
          ial: { "custom-slidev-slot": "col-3" },
        },
        // 混入历史空段落块
        {
          id: "empty-p-1",
          type: "p",
          content: "",
          markdown: "",
          ial: { "custom-slidev-slot": "col-3" },
        },
        {
          id: "empty-p-2",
          type: "p",
          content: "   ",
          markdown: "   ",
          ial: { "custom-slidev-slot": "col-3" },
        },
      ]

      const doc = buildSlidevDocument(
        "doc-media-compound-test",
        { "custom-slidev-layout": "three-cols-header" },
        mockBlocks,
      )
      expect(doc.slides.length).toBeGreaterThan(0)
      const slide = doc.slides[0]
      expect(slide.frontmatter.layout).toBe("three-cols-header")

      // 验证第 3 栏虽然混入空块，首项列表项依然成功剥离了列表前缀
      const col3Block = slide.blocks.find(b => b.id === "col-3-list")
      expect(col3Block).toBeDefined()
      expect(col3Block?.rawMarkdown).not.toMatch(/^\s*[-*+]\s+####/)
      expect(col3Block?.rawMarkdown).toContain("#### 方块射手 BlockShooter")

      // 验证 markdown-renderer 渲染出的 HTML
      const html = renderSlideBlocksToHtml(slide)
      // 1. 标题必须被正确解析为 h4.slide-list-item-title，严禁出现字面量 ####
      expect(html).toContain('<h4 class="slide-list-item-title">AI 摄影师 PoseDirector</h4>')
      expect(html).toContain('<h4 class="slide-list-item-title">订阅管家 SubManage</h4>')
      expect(html).toContain('<h4 class="slide-list-item-title">方块射手 BlockShooter</h4>')
      expect(html).not.toContain('&gt;####')
      expect(html).not.toMatch(/<p[^>]*>####/i)

      // 2. 视频与图片必须正确挂载媒体容器
      expect(html).toContain('slide-video-container')
      expect(html).toContain('assets/demo.mp4')
      expect(html).toContain('slide-media-container')
      expect(html).toContain('assets/sub.png')

      // 3. 验证三栏导出 standalone HTML 也具备正常结构
      const standaloneHtml = buildStandaloneHtml(doc)
      expect(standaloneHtml).toContain("layout-three-cols-header")
    })
  })
})


