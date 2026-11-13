import { describe, it, expect, beforeEach } from "vitest"
import {
  DEFAULT_GLOBAL_SETTINGS,
  normalizeGlobalSettings,
  setRuntimeSettings,
  getRuntimeSettings,
} from "../src/settings"
import { parseDocumentConfig } from "../src/compiler/scope-mapper"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import { buildPrintableHtml } from "../src/export/pdf-exporter"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import { generatePdfExportStyles } from "../src/export/pdf-template-styles"
import type { ISiYuanBlockNode, ISlidesDocument } from "../src/types/slides-protocol"
import {
  ATTR_DOC_SHOW_UNORDERED_LIST_MARKERS,
  ATTR_DOC_SHOW_ORDERED_LIST_MARKERS,
} from "../src/types/slides-protocol"

describe("列表前缀标记与列表动效解包一致性", () => {
  beforeEach(() => {
    setRuntimeSettings({ ...DEFAULT_GLOBAL_SETTINGS })
  })

  describe("1. 列表动效解包一致性 (正文列表项保留前缀符号，分栏卡片清洗标题前缀)", () => {
    it("当正文列表项存在 custom-slides-click 触发父列表展开时，所有列表项应统一保留列表前缀符号，首块直显，后续逐步呈现", () => {
      // 模拟思源无序列表结构：父列表 NodeList 包含 3 个 NodeListItem
      // 第 1 项：无 click（首块直显）
      // 第 2 项：custom-slides-click = "+1"
      // 第 3 项：custom-slides-click = "+1"
      const listBlock: ISiYuanBlockNode = {
        id: "list-1",
        type: "l",
        children: [
          {
            id: "item-1",
            type: "i",
            children: [
              {
                id: "p-1",
                type: "p",
                markdown: "* 技术大会 / 行业大会: 大字报结论、蒙版叙事，干货层层递进",
                content: "* 技术大会 / 行业大会: 大字报结论、蒙版叙事，干货层层递进",
              },
            ],
          },
          {
            id: "item-2",
            type: "i",
            ial: { "custom-slides-click": "+1" },
            children: [
              {
                id: "p-2",
                type: "p",
                markdown: "* 团队日常分享: 记完即讲，文档即演示，零排版负担",
                content: "* 团队日常分享: 记完即讲，文档即演示，零排版负担",
              },
            ],
          },
          {
            id: "item-3",
            type: "i",
            ial: { "custom-slides-click": "+1" },
            children: [
              {
                id: "p-3",
                type: "p",
                markdown: "* 答辩与答疑: 缩略图墙极速跳页，任何提问都接得住",
                content: "* 答辩与答疑: 缩略图墙极速跳页，任何提问都接得住",
              },
            ],
          },
        ],
      }

      const doc = buildSlidesDocument("doc-1", {}, [listBlock])
      const slide = doc.slides[0]

      // 应当展开为 3 个列表项块
      expect(slide.blocks).toHaveLength(3)

      const firstBlock = slide.blocks[0]
      const secondBlock = slide.blocks[1]
      const thirdBlock = slide.blocks[2]

      // 第 1 块：无 click，且保留列表前缀符号
      expect(firstBlock.clicks).toBeUndefined()
      expect(firstBlock.rawMarkdown).toBe("* 技术大会 / 行业大会: 大字报结论、蒙版叙事，干货层层递进")

      // 第 2 块与第 3 块：带 click 动效，且开头列表标记同样保留
      expect(secondBlock.clicks).toBe("+1")
      expect(secondBlock.rawMarkdown).toBe("* 团队日常分享: 记完即讲，文档即演示，零排版负担")

      expect(thirdBlock.clicks).toBe("+1")
      expect(thirdBlock.rawMarkdown).toBe("* 答辩与答疑: 缩略图墙极速跳页，任何提问都接得住")

      // 正文列表全部保留列表语法供解析为带有圆点的 li
      expect(slide.rawMarkdown).toContain("* 技术大会 / 行业大会: 大字报结论、蒙版叙事，干货层层递进")
      expect(slide.rawMarkdown).toContain("* 团队日常分享: 记完即讲，文档即演示，零排版负担")
      expect(slide.rawMarkdown).toContain("* 答辩与答疑: 缩略图墙极速跳页，任何提问都接得住")
    })

    it("当列表项处于分栏卡片上下文 (isColContext) 时，首行标题才清洗列表标记", () => {
      const colListBlock: ISiYuanBlockNode = {
        id: "col-list",
        type: "l",
        children: [
          {
            id: "col-item-1",
            type: "i",
            ial: { "custom-slides-slot": "col-1" },
            children: [
              {
                id: "col-p-1",
                type: "p",
                markdown: "* 第一栏标题\n第一栏内容",
                content: "* 第一栏标题\n第一栏内容",
              },
            ],
          },
        ],
      }

      const doc = buildSlidesDocument("doc-col", { "custom-slides-layout": "two-cols-header" }, [colListBlock])
      const slide = doc.slides[0]
      expect(slide.blocks[0].rawMarkdown).toContain("第一栏标题")
      expect(slide.blocks[0].rawMarkdown).not.toMatch(/^\*\s+第一栏标题/)
    })
  })

  describe("2. 全局演示配置：分别控制无序列表与有序列表前缀标记", () => {
    it("默认情况下无序与有序列表标记均启用 (true)", () => {
      expect(DEFAULT_GLOBAL_SETTINGS.showUnorderedListMarkers).toBe(true)
      expect(DEFAULT_GLOBAL_SETTINGS.showOrderedListMarkers).toBe(true)
      expect(getRuntimeSettings().showUnorderedListMarkers).toBe(true)
      expect(getRuntimeSettings().showOrderedListMarkers).toBe(true)
    })

    it("normalizeGlobalSettings 正确归一化布尔选项", () => {
      const res = normalizeGlobalSettings({
        showUnorderedListMarkers: false,
        showOrderedListMarkers: false,
      })
      expect(res.showUnorderedListMarkers).toBe(false)
      expect(res.showOrderedListMarkers).toBe(false)

      const emptyRes = normalizeGlobalSettings({})
      expect(emptyRes.showUnorderedListMarkers).toBe(true)
      expect(emptyRes.showOrderedListMarkers).toBe(true)
    })

    it("setRuntimeSettings 响应式更新并被 parseDocumentConfig 正确读取", () => {
      setRuntimeSettings({ showUnorderedListMarkers: false, showOrderedListMarkers: true })
      const config = parseDocumentConfig({})
      expect(config.showUnorderedListMarkers).toBe(false)
      expect(config.showOrderedListMarkers).toBe(true)
    })

    it("parseDocumentConfig 支持文档级显式属性优先于全局配置", () => {
      setRuntimeSettings({ showUnorderedListMarkers: true, showOrderedListMarkers: true })

      const config = parseDocumentConfig({
        [ATTR_DOC_SHOW_UNORDERED_LIST_MARKERS]: "false",
        [ATTR_DOC_SHOW_ORDERED_LIST_MARKERS]: "false",
      })

      expect(config.showUnorderedListMarkers).toBe(false)
      expect(config.showOrderedListMarkers).toBe(false)
    })

    it("single-html-exporter 与 pdf-exporter 应正确挂载 data-hide-* 属性", () => {
      const doc: ISlidesDocument = {
        docId: "doc-test",
        config: {
          theme: "default",
          aspectRatio: "16/9",
          highlighter: "shiki",
          defaultTransition: "fade",
          colorSchema: "auto",
          showUnorderedListMarkers: false,
          showOrderedListMarkers: true,
        },
        slides: [
          {
            pageIndex: 1,
            frontmatter: {},
            blocks: [],
            rawMarkdown: "# 测试",
          },
        ],
      }

      const html = buildStandaloneHtml(doc)
      expect(html).toContain('data-hide-unordered-markers="true"')
      expect(html).toContain('data-hide-ordered-markers="false"')

      const pdfHtml = buildPrintableHtml(doc)
      expect(pdfHtml).toContain('data-hide-unordered-markers="true"')
      expect(pdfHtml).toContain('data-hide-ordered-markers="false"')
    })

    it("standalone 与 pdf 样式生成器中包含对应的隐藏规则", () => {
      const standaloneStyles = generateStandaloneExportStyles()
      expect(standaloneStyles).toContain('[data-hide-unordered-markers="true"] ul')
      expect(standaloneStyles).toContain('[data-hide-ordered-markers="true"] ol')

      const pdfStyles = generatePdfExportStyles({ pageRatio: "16/9" })
      expect(pdfStyles).toContain('[data-hide-unordered-markers="true"] ul')
      expect(pdfStyles).toContain('[data-hide-ordered-markers="true"] ol')
    })
  })
})
