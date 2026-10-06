import { describe, expect, it } from "vitest"
import { extractSuperBlockWidthRatios } from "../src/compiler/superblock-scanner"
import { scanAndTagListSuperBlocks } from "../src/compiler/list-column-scanner"
import { scanAndTagSuperBlocks } from "../src/compiler/superblock-scanner"
import { parseRatioToGridCols } from "../src/utils"
import { renderSlideBlocksToHtml } from "../src/export/slide-layout-renderer"
import { buildSlidevDocument } from "../src/compiler/slidev-ast-builder"
import type { ISiYuanBlockNode, ISlidevVirtualPage } from "../src/types/slidev-protocol"
import {
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_LAYOUT_RATIO,
  ATTR_ELEM_SLOT,
} from "../src/types/slidev-protocol"

describe("Layout Ratio & SuperBlock Width Integration (分栏与图文布局比例及超级块宽度识别)", () => {
  describe("extractSuperBlockWidthRatios (思源超级块子块宽度解析)", () => {
    it("应正确解析双栏超级块中的 calc 百分比并化简为经典比值", () => {
      const node: ISiYuanBlockNode = {
        id: "sb-1",
        type: "s",
        subType: "col",
        children: [
          {
            id: "col-1",
            type: "p",
            content: "左侧内容",
            ial: { style: "width: calc(33.3% - 13.8px); flex: none;" },
          },
          {
            id: "col-2",
            type: "p",
            content: "右侧内容",
            ial: { style: "width: calc(66.7% - 13.8px); flex: none;" },
          },
        ],
      }
      const ratio = extractSuperBlockWidthRatios(node)
      expect(ratio).toBe("1:2")
    })

    it("应正确解析双栏 30%:70% 比例", () => {
      const node: ISiYuanBlockNode = {
        id: "sb-2",
        type: "s",
        subType: "col",
        children: [
          {
            id: "c-1",
            type: "p",
            content: "左栏",
            ial: { style: "width: calc(30% - 10px);" },
          },
          {
            id: "c-2",
            type: "p",
            content: "右栏",
            ial: { style: "width: calc(70% - 10px);" },
          },
        ],
      }
      expect(extractSuperBlockWidthRatios(node)).toBe("3:7")
    })

    it("应正确解析三栏超级块的 1:2:1 比例", () => {
      const node: ISiYuanBlockNode = {
        id: "sb-3",
        type: "s",
        subType: "col",
        children: [
          {
            id: "c-1",
            type: "p",
            ial: { style: "width: calc(25% - 10px);" },
          },
          {
            id: "c-2",
            type: "p",
            ial: { style: "width: calc(50% - 10px);" },
          },
          {
            id: "c-3",
            type: "p",
            ial: { style: "width: calc(25% - 10px);" },
          },
        ],
      }
      expect(extractSuperBlockWidthRatios(node)).toBe("1:2:1")
    })

    it("子块均未设置宽度时应返回 null（表示默认等分）", () => {
      const node: ISiYuanBlockNode = {
        id: "sb-empty",
        type: "s",
        subType: "col",
        children: [
          { id: "c-1", type: "p", content: "A" },
          { id: "c-2", type: "p", content: "B" },
        ],
      }
      expect(extractSuperBlockWidthRatios(node)).toBeNull()
    })
  })

  describe("parseRatioToGridCols (比例转 CSS Grid 工具)", () => {
    it("应正确将冒号比值转化为 CSS fr", () => {
      expect(parseRatioToGridCols("1:2")).toBe("1fr 2fr")
      expect(parseRatioToGridCols("3:7")).toBe("3fr 7fr")
      expect(parseRatioToGridCols("1:2:1", 3)).toBe("1fr 2fr 1fr")
      expect(parseRatioToGridCols("30:70")).toBe("30fr 70fr")
    })

    it("空或无效输入应回退为 repeat(n, 1fr)", () => {
      expect(parseRatioToGridCols(undefined, 2)).toBe("repeat(2, 1fr)")
      expect(parseRatioToGridCols("", 3)).toBe("repeat(3, 1fr)")
      expect(parseRatioToGridCols("invalid", 2)).toBe("repeat(2, 1fr)")
    })

    it("应保留合法的百分比或已转化的空格分隔规则", () => {
      expect(parseRatioToGridCols("40% 60%")).toBe("40% 60%")
    })
  })

  describe("自动识别与手动优先策略协同", () => {
    it("未手动配置比例时，超级块扫描器应自动将提取的比例写入 custom-slidev-layout-ratio", () => {
      const docId = "doc-root"
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "div-1",
          type: "NodeThematicBreak",
          markdown: "---",
          ial: {},
        },
        {
          id: "head-1",
          type: "h",
          content: "表头标题",
          markdown: "# 表头标题",
        },
        {
          id: "sb-list",
          type: "s",
          subType: "col",
          children: [
            {
              id: "li-1",
              type: "i",
              markdown: "* 第一项",
              ial: { style: "width: calc(30% - 10px);" },
            },
            {
              id: "li-2",
              type: "i",
              markdown: "* 第二项",
              ial: { style: "width: calc(70% - 10px);" },
            },
          ],
        },
      ]

      const res = scanAndTagListSuperBlocks(docId, blocks)
      const ratioChange = res.changes.find(c => c.attrs[ATTR_PAGE_LAYOUT_RATIO])
      expect(ratioChange).toBeDefined()
      expect(ratioChange?.blockId).toBe("div-1")
      expect(ratioChange?.attrs[ATTR_PAGE_LAYOUT_RATIO]).toBe("3:7")
    })

    it("用户已在页面手动配置 custom-slidev-layout-ratio 时，以手动为准，不被超级块覆盖", () => {
      const docId = "doc-root"
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "div-2",
          type: "NodeThematicBreak",
          markdown: "---",
          ial: {
            [ATTR_PAGE_LAYOUT]: "two-cols-header",
            [ATTR_PAGE_LAYOUT_RATIO]: "1:2", // 用户手动锁定为 1:2
          },
        },
        {
          id: "head-2",
          type: "h",
          content: "标题",
          markdown: "# 标题",
          ial: { [ATTR_ELEM_SLOT]: "header" },
        },
        {
          id: "sb-list-2",
          type: "s",
          subType: "col",
          children: [
            {
              id: "li-3",
              type: "i",
              markdown: "* 选项 A",
              ial: { style: "width: calc(40% - 10px);", [ATTR_ELEM_SLOT]: "left" }, // 超级块拖动成了 40%
            },
            {
              id: "li-4",
              type: "i",
              markdown: "* 选项 B",
              ial: { style: "width: calc(60% - 10px);", [ATTR_ELEM_SLOT]: "right" },
            },
          ],
        },
      ]

      const res = scanAndTagListSuperBlocks(docId, blocks)
      // 不应生成重写 ATTR_PAGE_LAYOUT_RATIO 的变动
      const ratioChange = res.changes.find(c => c.attrs[ATTR_PAGE_LAYOUT_RATIO])
      expect(ratioChange).toBeUndefined()
    })
  })

  describe("导出渲染管线中的比例注入 (slide-layout-renderer)", () => {
    it("双栏布局渲染应包含由 layoutRatio 生成的 grid-template-columns", () => {
      const slide: ISlidevVirtualPage = {
        pageIndex: 1,
        startBlockId: "p1",
        frontmatter: {
          layout: "two-cols",
          layoutRatio: "1:2",
        },
        notes: "",
        blocks: [
          { id: "b1", type: "p", content: "Left", rawMarkdown: "Left", slot: "left" },
          { id: "b2", type: "p", content: "Right", rawMarkdown: "Right", slot: "right" },
        ],
        rawMarkdown: "",
      }

      const html = renderSlideBlocksToHtml(slide)
      expect(html).toContain('style="grid-template-columns: 1fr 2fr;"')
    })

    it("三栏布局渲染应包含三栏比例样式", () => {
      const slide: ISlidevVirtualPage = {
        pageIndex: 2,
        startBlockId: "p2",
        frontmatter: {
          layout: "three-cols-header",
          layoutRatio: "1:2:1",
        },
        notes: "",
        blocks: [
          { id: "h1", type: "h", content: "Header", rawMarkdown: "# Header", slot: "header" },
          { id: "b1", type: "p", content: "C1", rawMarkdown: "C1", slot: "col-1" },
          { id: "b2", type: "p", content: "C2", rawMarkdown: "C2", slot: "col-2" },
          { id: "b3", type: "p", content: "C3", rawMarkdown: "C3", slot: "col-3" },
        ],
        rawMarkdown: "",
      }

      const html = renderSlideBlocksToHtml(slide)
      expect(html).toContain('style="grid-template-columns: 1fr 2fr 1fr;"')
    })

    it("图文分栏布局渲染应包含图文比例样式", () => {
      const slide: ISlidevVirtualPage = {
        pageIndex: 3,
        startBlockId: "p3",
        frontmatter: {
          layout: "image-left",
          image: "assets/img.png",
          layoutRatio: "3:7",
        },
        notes: "",
        blocks: [
          { id: "b1", type: "p", content: "Text content", rawMarkdown: "Text content" },
        ],
        rawMarkdown: "",
      }

      const html = renderSlideBlocksToHtml(slide)
      expect(html).toContain("grid-template-columns:3fr 7fr;")
    })
  })

  describe("AST 编译与 Frontmatter 暴露", () => {
    it("构建的 SlidevDocument 页面 frontmatter 应正确包含 layoutRatio", () => {
      const blocks: ISiYuanBlockNode[] = [
        {
          id: "div-test",
          type: "NodeThematicBreak",
          markdown: "---",
          ial: {
            [ATTR_PAGE_LAYOUT]: "two-cols",
            [ATTR_PAGE_LAYOUT_RATIO]: "1:2",
          },
        },
        {
          id: "p1",
          type: "p",
          content: "L",
          markdown: "L",
          ial: { [ATTR_ELEM_SLOT]: "left" },
        },
        {
          id: "p2",
          type: "p",
          content: "R",
          markdown: "R",
          ial: { [ATTR_ELEM_SLOT]: "right" },
        },
      ]

      const doc = buildSlidevDocument("doc-test", {}, blocks)
      expect(doc.slides.length).toBe(1)
      expect(doc.slides[0].frontmatter.layoutRatio).toBe("1:2")
    })
  })
})
