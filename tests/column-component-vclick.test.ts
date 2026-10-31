import { describe, it, expect, vi } from "vitest"
import { DocumentCompilerService } from "../src/compiler/document-compiler"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { computeSlideClicksPlan, getBlockClickStatus } from "../src/engine/v-click-resolver"
import type { ISiYuanBlockNode, ISlidesBlockItem } from "../src/types/slides-protocol"
import { ATTR_PAGE_LAYOUT, ATTR_ELEM_SLOT, ATTR_ELEM_CLICK } from "../src/types/slides-protocol"

describe("表头多栏分栏内组件逐步呈现 (v-click) 级联调度集成测试", () => {
  describe("1. 编译器 AST 列表项子块解构与属性隔离", () => {
    it("分栏列表项包含多个子块时，应展开为独立的 ISlidesBlockItem 并隔离各自 clicks 属性", () => {
      const mockBlocks: ISiYuanBlockNode[] = [
        {
          id: "h-title",
          type: "h",
          markdown: "# 架构设计方案",
          content: "架构设计方案",
          ial: { [ATTR_ELEM_SLOT]: "header" },
        },
        {
          id: "sb-cols",
          type: "s",
          subType: "col",
          children: [
            {
              id: "item-col1",
              type: "i",
              ial: {
                [ATTR_ELEM_SLOT]: "col-1",
                [ATTR_ELEM_CLICK]: "+1",
              },
              children: [
                {
                  id: "p-col1-title",
                  type: "p",
                  markdown: "### 核心服务",
                  content: "核心服务",
                },
                {
                  id: "p-col1-desc",
                  type: "p",
                  markdown: "基于分布式高可用架构",
                  content: "基于分布式高可用架构",
                },
                {
                  id: "img-col1-arch",
                  type: "p",
                  markdown: "![架构图](assets/arch.png)",
                  content: "架构图",
                  ial: {
                    [ATTR_ELEM_CLICK]: "+1",
                  },
                },
              ],
            },
            {
              id: "item-col2",
              type: "i",
              ial: {
                [ATTR_ELEM_SLOT]: "col-2",
              },
              children: [
                {
                  id: "p-col2-title",
                  type: "p",
                  markdown: "### 存储服务",
                  content: "存储服务",
                },
                {
                  id: "p-col2-desc",
                  type: "p",
                  markdown: "海量多模态数据持久化",
                  content: "海量多模态数据持久化",
                  ial: {
                    [ATTR_ELEM_CLICK]: "+1",
                  },
                },
              ],
            },
          ],
        },
      ]

      const doc = buildSlidesDocument("doc-test", { [ATTR_PAGE_LAYOUT]: "cols-header" }, mockBlocks, {
        theme: "default",
        aspectRatio: "16/9",
      })

      expect(doc.slides.length).toBe(1)
      const page = doc.slides[0]

      // 验证页面中的 blocks 是否展开了子组件块
      const col1Blocks = page.blocks.filter(b => b.slot === "col-1")
      expect(col1Blocks.length).toBe(3)

      // 验证 col-1 的三个子块
      expect(col1Blocks[0].id).toBe("p-col1-title")
      expect(col1Blocks[0].clicks).toBeUndefined()
      expect(col1Blocks[0].parentClicks).toBe("+1")

      expect(col1Blocks[1].id).toBe("p-col1-desc")
      expect(col1Blocks[1].clicks).toBeUndefined()
      expect(col1Blocks[1].parentClicks).toBe("+1")

      expect(col1Blocks[2].id).toBe("img-col1-arch")
      expect(col1Blocks[2].clicks).toBe("+1")
      expect(col1Blocks[2].parentClicks).toBe("+1")

      // 验证 col-2 的两个子块
      const col2Blocks = page.blocks.filter(b => b.slot === "col-2")
      expect(col2Blocks.length).toBe(2)
      expect(col2Blocks[0].id).toBe("p-col2-title")
      expect(col2Blocks[0].clicks).toBeUndefined()
      expect(col2Blocks[0].parentClicks).toBeUndefined()

      expect(col2Blocks[1].id).toBe("p-col2-desc")
      expect(col2Blocks[1].clicks).toBe("+1")
      expect(col2Blocks[1].parentClicks).toBeUndefined()
    })

    it("子块配置 clicks 时，不应向上冒泡污染父级列表项容器", () => {
      const mockBlocks: ISiYuanBlockNode[] = [
        {
          id: "item-parent",
          type: "i",
          ial: {
            [ATTR_ELEM_SLOT]: "col-1",
            // 父级未配置 clicks
          },
          children: [
            {
              id: "child-p",
              type: "p",
              markdown: "子段落",
              ial: {
                [ATTR_ELEM_CLICK]: "+1",
              },
            },
          ],
        },
      ]

      const doc = buildSlidesDocument("doc-test", { [ATTR_PAGE_LAYOUT]: "cols-header" }, mockBlocks, {
        theme: "default",
        aspectRatio: "16/9",
      })

      const page = doc.slides[0]
      const childBlock = page.blocks.find(b => b.id === "child-p")
      expect(childBlock).toBeDefined()
      expect(childBlock?.clicks).toBe("+1")
      expect(childBlock?.parentClicks).toBeUndefined()
    })
  })

  describe("2. computeSlideClicksPlan 级联步进调度算法", () => {
    it("场景 A：主容器开启 +1，基础子组件同时在第 1 步出现，独立配置子组件顺延在第 2 步出现", () => {
      const blocks: ISlidesBlockItem[] = [
        {
          id: "col1-title",
          type: "p",
          content: "标题",
          rawMarkdown: "标题",
          slot: "col-1",
          parentContainerId: "item-1",
          parentClicks: "+1",
        },
        {
          id: "col1-desc",
          type: "p",
          content: "描述",
          rawMarkdown: "描述",
          slot: "col-1",
          parentContainerId: "item-1",
          parentClicks: "+1",
        },
        {
          id: "col1-img",
          type: "p",
          content: "图片",
          rawMarkdown: "图片",
          slot: "col-1",
          parentContainerId: "item-1",
          parentClicks: "+1",
          clicks: "+1",
        },
      ]

      const plan = computeSlideClicksPlan(blocks)
      expect(plan.maxStep).toBe(2)

      // 基础层：标题与描述均在第 1 步出现
      expect(getBlockClickStatus(blocks[0], 0, plan)).toBe("v-click-hidden")
      expect(getBlockClickStatus(blocks[0], 1, plan)).toBe("v-click-visible")

      expect(getBlockClickStatus(blocks[1], 0, plan)).toBe("v-click-hidden")
      expect(getBlockClickStatus(blocks[1], 1, plan)).toBe("v-click-visible")

      // 独立层：图片在第 2 步才出现
      expect(getBlockClickStatus(blocks[2], 1, plan)).toBe("v-click-hidden")
      expect(getBlockClickStatus(blocks[2], 2, plan)).toBe("v-click-visible")
    })

    it("场景 B：主容器未开启逐步，基础子组件始终可见，独立配置子组件顺延在第 1 步出现", () => {
      const blocks: ISlidesBlockItem[] = [
        {
          id: "col1-title",
          type: "p",
          content: "标题",
          rawMarkdown: "标题",
          slot: "col-1",
          parentContainerId: "item-1",
          // 主容器无 clicks
        },
        {
          id: "col1-desc",
          type: "p",
          content: "描述",
          rawMarkdown: "描述",
          slot: "col-1",
          parentContainerId: "item-1",
        },
        {
          id: "col1-img",
          type: "p",
          content: "图片",
          rawMarkdown: "图片",
          slot: "col-1",
          parentContainerId: "item-1",
          clicks: "+1",
        },
      ]

      const plan = computeSlideClicksPlan(blocks)
      expect(plan.maxStep).toBe(1)

      // 基础层：初始（step 0）立即可见
      expect(getBlockClickStatus(blocks[0], 0, plan)).toBe("v-click-visible")
      expect(getBlockClickStatus(blocks[1], 0, plan)).toBe("v-click-visible")

      // 独立层：初始隐藏，第 1 步出现
      expect(getBlockClickStatus(blocks[2], 0, plan)).toBe("v-click-hidden")
      expect(getBlockClickStatus(blocks[2], 1, plan)).toBe("v-click-visible")
    })

    it("场景 C：双栏均有子组件，不同栏之间各司其职，步长连贯递增", () => {
      const blocks: ISlidesBlockItem[] = [
        // 栏 1：容器 +1，基础块 1 个，独立块 1 个
        {
          id: "c1-p1",
          type: "p",
          content: "栏1标题",
          rawMarkdown: "栏1标题",
          slot: "col-1",
          parentContainerId: "col1",
          parentClicks: "+1",
        },
        {
          id: "c1-p2",
          type: "p",
          content: "栏1高亮",
          rawMarkdown: "栏1高亮",
          slot: "col-1",
          parentContainerId: "col1",
          parentClicks: "+1",
          clicks: "+1",
        },
        // 栏 2：容器未开，基础块 1 个，独立块 1 个
        {
          id: "c2-p1",
          type: "p",
          content: "栏2标题",
          rawMarkdown: "栏2标题",
          slot: "col-2",
          parentContainerId: "col2",
        },
        {
          id: "c2-p2",
          type: "p",
          content: "栏2高亮",
          rawMarkdown: "栏2高亮",
          slot: "col-2",
          parentContainerId: "col2",
          clicks: "+1",
        },
      ]

      const plan = computeSlideClicksPlan(blocks)
      // 栏 1 容器占用 step 1，栏 1 独立块占用 step 2，栏 2 基础块 always，栏 2 独立块占用 step 3
      expect(plan.maxStep).toBe(3)

      expect(getBlockClickStatus(blocks[2], 0, plan)).toBe("v-click-visible") // c2-p1 始终可见
      expect(getBlockClickStatus(blocks[0], 1, plan)).toBe("v-click-visible") // c1-p1 第 1 步出现
      expect(getBlockClickStatus(blocks[1], 2, plan)).toBe("v-click-visible") // c1-p2 第 2 步出现
      expect(getBlockClickStatus(blocks[3], 3, plan)).toBe("v-click-visible") // c2-p2 第 3 步出现
    })
  })

  describe("3. Slidev 原生 Markdown 格式化输出", () => {
    it("输出 ::col-X:: 插槽时，应将基础层聚合包裹并为独立子组件分别包装 <v-click>", () => {
      const mockBlocks: ISiYuanBlockNode[] = [
        {
          id: "h-title",
          type: "h",
          markdown: "# 核心架构对比",
          content: "核心架构对比",
        },
        {
          id: "sb-cols",
          type: "s",
          subType: "col",
          children: [
            {
              id: "item-1",
              type: "i",
              ial: {
                [ATTR_ELEM_SLOT]: "col-1",
                [ATTR_ELEM_CLICK]: "+1",
              },
              children: [
                { id: "p1", type: "p", markdown: "方案 A" },
                { id: "p2", type: "p", markdown: "基础描述" },
                { id: "p3", type: "p", markdown: "独立特性", ial: { [ATTR_ELEM_CLICK]: "+1" } },
              ],
            },
            {
              id: "item-2",
              type: "i",
              ial: {
                [ATTR_ELEM_SLOT]: "col-2",
              },
              children: [
                { id: "p4", type: "p", markdown: "方案 B" },
                { id: "p5", type: "p", markdown: "独立亮点", ial: { [ATTR_ELEM_CLICK]: "+1" } },
              ],
            },
          ],
        },
      ]

      const doc = buildSlidesDocument("doc-test", { [ATTR_PAGE_LAYOUT]: "cols-header" }, mockBlocks, {
        theme: "default",
        aspectRatio: "16/9",
      })

      const rawMd = doc.slides[0].rawMarkdown

      // col-1 应该包含：包裹基础层的 <v-click> 以及包裹独立特性的 <v-click>
      expect(rawMd).toContain("::col-1::")
      expect(rawMd).toContain("::col-2::")

      // 验证 col-1 中基础层方案 A 与描述在同组出现
      expect(rawMd).toMatch(/<v-click>[\s\S]*方案 A[\s\S]*基础描述[\s\S]*<\/v-click>/)
      // 验证独立特性单独包裹
      expect(rawMd).toMatch(/<v-click>[\s\S]*独立特性[\s\S]*<\/v-click>/)

      // 验证 col-2 方案 B 直接裸露输出（无容器 v-click 包裹），而独立亮点有 <v-click>
      expect(rawMd).toMatch(/方案 B[\s\S]*<v-click>[\s\S]*独立亮点[\s\S]*<\/v-click>/)
    })

    it("顶层 NodeList 在 cols-header 下自动展开列表项与其多组件，且子组件不受大纲标题 clicks 污染", () => {
      const mockBlocks: ISiYuanBlockNode[] = [
        {
          id: "page-title",
          type: "h",
          markdown: "# 架构设计方案",
          content: "架构设计方案",
          ial: {
            [ATTR_ELEM_CLICK]: "+1", // 页面标题配置了逐步呈现
          },
        },
        {
          id: "list-root",
          type: "l", // 顶层无序列表，非超级块
          children: [
            {
              id: "item-1",
              type: "i",
              ial: {
                [ATTR_ELEM_CLICK]: "+1", // 主容器开启逐步呈现
              },
              children: [
                { id: "p1-title", type: "p", markdown: "### 核心服务" },
                { id: "p1-desc", type: "p", markdown: "基于分布式高可用架构" },
                { id: "p1-sub", type: "p", markdown: "独立扩展组件", ial: { [ATTR_ELEM_CLICK]: "+1" } },
              ],
            },
            {
              id: "item-2",
              type: "i",
              children: [
                { id: "p2-title", type: "p", markdown: "### 存储服务" },
                { id: "p2-desc", type: "p", markdown: "海量多模态数据持久化" },
              ],
            },
          ],
        },
      ]

      const doc = buildSlidesDocument("doc-test", { [ATTR_PAGE_LAYOUT]: "cols-header" }, mockBlocks, {
        theme: "default",
        aspectRatio: "16/9",
      })

      const page = doc.slides[0]

      // 验证子组件没有继承 page-title 的 clicks
      const p1Title = page.blocks.find(b => b.id === "p1-title")
      const p1Desc = page.blocks.find(b => b.id === "p1-desc")
      const p1Sub = page.blocks.find(b => b.id === "p1-sub")

      expect(p1Title).toBeDefined()
      expect(p1Title?.clicks).toBeUndefined() // 绝不受 page-title 污染
      expect(p1Title?.parentClicks).toBe("+1")

      expect(p1Desc).toBeDefined()
      expect(p1Desc?.clicks).toBeUndefined() // 绝不受 page-title 污染
      expect(p1Desc?.parentClicks).toBe("+1")

      expect(p1Sub).toBeDefined()
      expect(p1Sub?.clicks).toBe("+1") // 自身显式配置

      // 验证调度计划：p1Title 与 p1Desc 必须在同一个 step 同时呈现
      const plan = computeSlideClicksPlan(page.blocks)
      const p1TitleRule = plan.idMap.get("p1-title")
      const p1DescRule = plan.idMap.get("p1-desc")
      const p1SubRule = plan.idMap.get("p1-sub")

      expect(p1TitleRule?.type).toBe("step")
      expect(p1DescRule?.type).toBe("step")
      expect(p1TitleRule?.step).toBe(p1DescRule?.step) // 随主容器同一步数呈现
      expect(p1SubRule?.step).toBeGreaterThan(p1TitleRule!.step!) // 独立配置在之后一步呈现
    })
  })

  describe("4. 列表主容器顺延与未配置子组件（图片等）同拍呈现与防倒置调度", () => {
    it("场景 4.1：属性配置在列表项容器上，图片未单独配置时，文本与图片必须在第 1 步共同出现", () => {
      const mockBlocks: ISiYuanBlockNode[] = [
        {
          id: "cols-root",
          type: "s",
          subType: "col",
          children: [
            {
              id: "item-card",
              type: "i",
              ial: {
                [ATTR_ELEM_SLOT]: "col-1",
                [ATTR_ELEM_CLICK]: "+1", // 列表项容器配置 +1
              },
              children: [
                {
                  id: "p-card-title",
                  type: "p",
                  markdown: "### 核心特性说明",
                  content: "核心特性说明",
                },
                {
                  id: "img-card-cover",
                  type: "p",
                  markdown: "![封面图](assets/cover.png)",
                  content: "封面图",
                  // 图片未单独配置 clicks
                },
              ],
            },
          ],
        },
      ]

      const doc = buildSlidesDocument("doc-test", { [ATTR_PAGE_LAYOUT]: "cols-header" }, mockBlocks, {
        theme: "default",
        aspectRatio: "16/9",
      })

      const page = doc.slides[0]
      const titleBlock = page.blocks.find(b => b.id === "p-card-title")
      const imgBlock = page.blocks.find(b => b.id === "img-card-cover")

      expect(titleBlock).toBeDefined()
      expect(imgBlock).toBeDefined()

      // 两者必须共享主容器 parentClicks
      expect(titleBlock?.parentClicks).toBe("+1")
      expect(titleBlock?.clicks).toBeUndefined()
      expect(imgBlock?.parentClicks).toBe("+1")
      expect(imgBlock?.clicks).toBeUndefined()

      // 调度引擎验证：两者必须获得完全相同的步长，杜绝先后倒置
      const plan = computeSlideClicksPlan(page.blocks)
      const titleRule = plan.idMap.get("p-card-title")
      const imgRule = plan.idMap.get("img-card-cover")

      expect(titleRule?.type).toBe("step")
      expect(imgRule?.type).toBe("step")
      expect(titleRule?.step).toBe(1)
      expect(imgRule?.step).toBe(1)

      // 第 0 步翻页时均隐藏，第 1 步同时显现
      expect(getBlockClickStatus(titleBlock!, 0, plan)).toBe("v-click-hidden")
      expect(getBlockClickStatus(imgBlock!, 0, plan)).toBe("v-click-hidden")
      expect(getBlockClickStatus(titleBlock!, 1, plan)).toBe("v-click-visible")
      expect(getBlockClickStatus(imgBlock!, 1, plan)).toBe("v-click-visible")

      // Slidev 原生 Markdown 格式化：两者必须合并在同一个 <v-click> 内
      const rawMd = page.rawMarkdown
      expect(rawMd).toMatch(/<v-click>[\s\S]*核心特性说明[\s\S]*封面图[\s\S]*<\/v-click>/)
    })

    it("场景 4.2：用户光标在首行文本闪烁时设置 +1（思源将属性写入首行段落），图片未单独配置时，文本与图片依然必须在第 1 步共同出现", () => {
      const mockBlocks: ISiYuanBlockNode[] = [
        {
          id: "cols-root",
          type: "s",
          subType: "col",
          children: [
            {
              id: "item-card",
              type: "i",
              ial: {
                [ATTR_ELEM_SLOT]: "col-1",
                // 外层列表项未设置 clicks
              },
              children: [
                {
                  id: "p-card-title",
                  type: "p",
                  markdown: "### 核心特性说明",
                  content: "核心特性说明",
                  ial: {
                    [ATTR_ELEM_CLICK]: "+1", // 用户在首行文本点击设置顺延 +1
                  },
                },
                {
                  id: "img-card-cover",
                  type: "p",
                  markdown: "![封面图](assets/cover.png)",
                  content: "封面图",
                  // 图片未单独配置 clicks
                },
              ],
            },
          ],
        },
      ]

      const doc = buildSlidesDocument("doc-test", { [ATTR_PAGE_LAYOUT]: "cols-header" }, mockBlocks, {
        theme: "default",
        aspectRatio: "16/9",
      })

      const page = doc.slides[0]
      const titleBlock = page.blocks.find(b => b.id === "p-card-title")
      const imgBlock = page.blocks.find(b => b.id === "img-card-cover")

      expect(titleBlock).toBeDefined()
      expect(imgBlock).toBeDefined()

      // 首行文本的 clicks 提升为容器 clicks，首行文本自身剥离独立 clicks 归入基础层
      expect(titleBlock?.parentClicks).toBe("+1")
      expect(titleBlock?.clicks).toBeUndefined()
      expect(imgBlock?.parentClicks).toBe("+1")
      expect(imgBlock?.clicks).toBeUndefined()

      // 调度引擎验证：文本与图片完全同拍，第 1 步共同出现，绝无图片先出现的问题
      const plan = computeSlideClicksPlan(page.blocks)
      const titleRule = plan.idMap.get("p-card-title")
      const imgRule = plan.idMap.get("img-card-cover")

      expect(titleRule?.type).toBe("step")
      expect(imgRule?.type).toBe("step")
      expect(titleRule?.step).toBe(1)
      expect(imgRule?.step).toBe(1)

      expect(getBlockClickStatus(titleBlock!, 0, plan)).toBe("v-click-hidden")
      expect(getBlockClickStatus(imgBlock!, 0, plan)).toBe("v-click-hidden")
      expect(getBlockClickStatus(titleBlock!, 1, plan)).toBe("v-click-visible")
      expect(getBlockClickStatus(imgBlock!, 1, plan)).toBe("v-click-visible")
    })

    it("场景 4.3：主容器开启 +1，图片单独开启 +1 时，主文本第 1 步出现，图片在第 2 步后出现", () => {
      const mockBlocks: ISiYuanBlockNode[] = [
        {
          id: "cols-root",
          type: "s",
          subType: "col",
          children: [
            {
              id: "item-card",
              type: "i",
              ial: {
                [ATTR_ELEM_SLOT]: "col-1",
                [ATTR_ELEM_CLICK]: "+1",
              },
              children: [
                {
                  id: "p-card-title",
                  type: "p",
                  markdown: "### 核心特性说明",
                  content: "核心特性说明",
                },
                {
                  id: "img-card-cover",
                  type: "p",
                  markdown: "![封面图](assets/cover.png)",
                  content: "封面图",
                  ial: {
                    [ATTR_ELEM_CLICK]: "+1", // 图片单独开启逐步呈现
                  },
                },
              ],
            },
          ],
        },
      ]

      const doc = buildSlidesDocument("doc-test", { [ATTR_PAGE_LAYOUT]: "cols-header" }, mockBlocks, {
        theme: "default",
        aspectRatio: "16/9",
      })

      const page = doc.slides[0]
      const titleBlock = page.blocks.find(b => b.id === "p-card-title")
      const imgBlock = page.blocks.find(b => b.id === "img-card-cover")

      expect(titleBlock?.clicks).toBeUndefined()
      expect(titleBlock?.parentClicks).toBe("+1")
      expect(imgBlock?.clicks).toBe("+1")
      expect(imgBlock?.parentClicks).toBe("+1")

      const plan = computeSlideClicksPlan(page.blocks)
      expect(plan.maxStep).toBe(2)

      // 第 0 步：均隐藏
      expect(getBlockClickStatus(titleBlock!, 0, plan)).toBe("v-click-hidden")
      expect(getBlockClickStatus(imgBlock!, 0, plan)).toBe("v-click-hidden")

      // 第 1 步：文本先出现，图片仍隐藏
      expect(getBlockClickStatus(titleBlock!, 1, plan)).toBe("v-click-visible")
      expect(getBlockClickStatus(imgBlock!, 1, plan)).toBe("v-click-hidden")

      // 第 2 步：图片单独出现
      expect(getBlockClickStatus(titleBlock!, 2, plan)).toBe("v-click-visible")
      expect(getBlockClickStatus(imgBlock!, 2, plan)).toBe("v-click-visible")
    })

    it("场景 4.4：多栏排版下两个列表项，分别带图片，主容器依次顺延，栏内未配置图片与各自标题同拍", () => {
      const mockBlocks: ISiYuanBlockNode[] = [
        {
          id: "cols-root",
          type: "s",
          subType: "col",
          children: [
            {
              id: "item-1",
              type: "i",
              ial: {
                [ATTR_ELEM_SLOT]: "col-1",
                [ATTR_ELEM_CLICK]: "+1",
              },
              children: [
                { id: "p1", type: "p", markdown: "栏1标题" },
                { id: "img1", type: "p", markdown: "![图1](assets/1.png)" },
              ],
            },
            {
              id: "item-2",
              type: "i",
              ial: {
                [ATTR_ELEM_SLOT]: "col-2",
                [ATTR_ELEM_CLICK]: "+1",
              },
              children: [
                { id: "p2", type: "p", markdown: "栏2标题" },
                { id: "img2", type: "p", markdown: "![图2](assets/2.png)" },
              ],
            },
          ],
        },
      ]

      const doc = buildSlidesDocument("doc-test", { [ATTR_PAGE_LAYOUT]: "cols-header" }, mockBlocks, {
        theme: "default",
        aspectRatio: "16/9",
      })

      const page = doc.slides[0]
      const p1 = page.blocks.find(b => b.id === "p1")!
      const img1 = page.blocks.find(b => b.id === "img1")!
      const p2 = page.blocks.find(b => b.id === "p2")!
      const img2 = page.blocks.find(b => b.id === "img2")!

      const plan = computeSlideClicksPlan(page.blocks)
      expect(plan.maxStep).toBe(2)

      // 栏 1 组在 step 1 同时出现
      expect(getBlockClickStatus(p1, 1, plan)).toBe("v-click-visible")
      expect(getBlockClickStatus(img1, 1, plan)).toBe("v-click-visible")
      expect(getBlockClickStatus(p2, 1, plan)).toBe("v-click-hidden")
      expect(getBlockClickStatus(img2, 1, plan)).toBe("v-click-hidden")

      // 栏 2 组在 step 2 同时出现
      expect(getBlockClickStatus(p2, 2, plan)).toBe("v-click-visible")
      expect(getBlockClickStatus(img2, 2, plan)).toBe("v-click-visible")
    })
  })
})
