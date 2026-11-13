import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  isHeadingBlock,
  isListItemBlock,
  flattenSlideContentItems,
  scanSlideForAutoAnimation,
  scanDocumentForAutoAnimation,
  runAutoAnimationForDocument,
  scanDocumentForAnimationClear,
  clearAnimationsForDocument,
} from "../src/sync/auto-animation-normalizer"
import { globalDocumentCompiler } from "../src/compiler/document-compiler"
import { ATTR_ELEM_CLICK, ATTR_ELEM_MOTION, ATTR_ELEM_NOTE } from "../src/types/slides-protocol"
import type { ISlidesBlockItem, ISlidesVirtualPage } from "../src/types/slides-protocol"

describe("auto-animation-normalizer (智能动效配置编排)", () => {
  beforeEach(() => {
    globalDocumentCompiler.clearAllOverrides()
    vi.restoreAllMocks()
  })

  describe("块类型判定工具", () => {
    it("正确识别标题块 (h / NodeHeading / subType h1~h6 / markdown 井号)", () => {
      expect(isHeadingBlock({ type: "h" })).toBe(true)
      expect(isHeadingBlock({ type: "NodeHeading" })).toBe(true)
      expect(isHeadingBlock({ type: "p", subType: "h2" })).toBe(true)
      expect(isHeadingBlock({ type: "p", markdown: "## 二级标题" })).toBe(true)
      expect(isHeadingBlock({ type: "p", markdown: "普通段落" })).toBe(false)
      expect(isHeadingBlock(null)).toBe(false)
    })

    it("正确识别列表项 (i / NodeListItem)", () => {
      expect(isListItemBlock({ type: "i" })).toBe(true)
      expect(isListItemBlock({ type: "NodeListItem" })).toBe(true)
      expect(isListItemBlock({ type: "l" })).toBe(false)
      expect(isListItemBlock(null)).toBe(false)
    })
  })

  describe("flattenSlideContentItems (阅读顺序展平)", () => {
    it("自动排除讲稿备注块、分页线与插槽分界标记", () => {
      const blocks: ISlidesBlockItem[] = [
        { id: "h1", type: "h", content: "标题", rawMarkdown: "# 标题" },
        { id: "p1", type: "p", content: "正文", rawMarkdown: "正文" },
        { id: "note1", type: "callout", content: "讲稿", rawMarkdown: "> [!NOTE] 讲稿", isNote: true },
        { id: "note2", type: "b", content: "备注", rawMarkdown: "> 备注", attributes: { [ATTR_ELEM_NOTE]: "true" } },
        { id: "tb", type: "tb", content: "", rawMarkdown: "---" },
      ]

      const items = flattenSlideContentItems(blocks)
      expect(items.map(i => i.id)).toEqual(["h1", "p1"])
    })

    it("遇到列表容器时展开其子列表项", () => {
      const blocks: any[] = [
        { id: "h1", type: "h", rawMarkdown: "## 特性列表" },
        {
          id: "list-1",
          type: "l",
          children: [
            { id: "item-1", type: "i", rawMarkdown: "* 特性一" },
            { id: "item-2", type: "i", rawMarkdown: "* 特性二" },
          ],
        },
      ]

      const items = flattenSlideContentItems(blocks)
      expect(items.map(i => i.id)).toEqual(["h1", "item-1", "item-2"])
      expect(items[0].isHeading).toBe(true)
      expect(items[1].isHeading).toBe(false)
      expect(items[2].isHeading).toBe(false)
    })

    it("遇到超级块分栏容器时按阅读顺序展开各分栏内的子块", () => {
      const blocks: any[] = [
        { id: "h1", type: "h", rawMarkdown: "## 双栏展示" },
        {
          id: "sb-1",
          type: "s",
          children: [
            {
              id: "col-1",
              type: "p",
              children: [
                { id: "p-left-1", type: "p", rawMarkdown: "左栏第 1 块" },
                { id: "p-left-2", type: "p", rawMarkdown: "左栏第 2 块" },
              ],
            },
            {
              id: "col-2",
              type: "p",
              children: [
                { id: "p-right-1", type: "p", rawMarkdown: "右栏第 1 块" },
              ],
            },
          ],
        },
      ]

      const items = flattenSlideContentItems(blocks)
      expect(items.map(i => i.id)).toEqual(["h1", "p-left-1", "p-left-2", "p-right-1"])
    })
  })

  describe("scanSlideForAutoAnimation (单页动效扫描规则)", () => {
    it("自动跳过第 1 页（封面页）", () => {
      const coverSlide: ISlidesVirtualPage = {
        pageIndex: 1,
        startBlockId: "start-1",
        frontmatter: {},
        notes: "",
        blocks: [
          { id: "h1", type: "h", content: "大标题", rawMarkdown: "# 大标题" },
          { id: "p1", type: "p", content: "副标题", rawMarkdown: "副标题" },
          { id: "p2", type: "p", content: "作者与日期", rawMarkdown: "讲师" },
        ],
        rawMarkdown: "",
      }

      const targets = scanSlideForAutoAnimation(coverSlide)
      expect(targets).toEqual([])
    })

    it("自动跳过显式声明 layout: 'cover' 的页面", () => {
      const coverSlide: ISlidesVirtualPage = {
        pageIndex: 3,
        startBlockId: "start-3",
        frontmatter: { layout: "cover" },
        notes: "",
        blocks: [
          { id: "h1", type: "h", content: "过渡大标题", rawMarkdown: "# 章节过渡" },
          { id: "p1", type: "p", content: "副标题", rawMarkdown: "第二部分" },
        ],
        rawMarkdown: "",
      }

      const targets = scanSlideForAutoAnimation(coverSlide)
      expect(targets).toEqual([])
    })

    it("普通页有标题与多个内容块：标题和首个内容块直接显示，后续块顺延 (+1)", () => {
      const slide: ISlidesVirtualPage = {
        pageIndex: 2,
        startBlockId: "start-2",
        frontmatter: {},
        notes: "",
        blocks: [
          { id: "title", type: "h", content: "核心特性", rawMarkdown: "## 核心特性" },
          { id: "p1", type: "p", content: "特性一", rawMarkdown: "特性一" },
          { id: "p2", type: "p", content: "特性二", rawMarkdown: "特性二" },
          { id: "p3", type: "p", content: "特性三", rawMarkdown: "特性三" },
        ],
        rawMarkdown: "",
      }

      const targets = scanSlideForAutoAnimation(slide)
      expect(targets).toHaveLength(2)
      expect(targets[0]).toEqual({ blockId: "p2", pageIndex: 2, targetClick: "+1" })
      expect(targets[1]).toEqual({ blockId: "p3", pageIndex: 2, targetClick: "+1" })
    })

    it("普通页包含标题与列表：标题和列表首项直接显示，后续列表项顺延 (+1)", () => {
      const slide: ISlidesVirtualPage = {
        pageIndex: 2,
        startBlockId: "start-2",
        frontmatter: {},
        notes: "",
        blocks: [
          { id: "title", type: "h", content: "特性", rawMarkdown: "## 特性" },
          {
            id: "list-1",
            type: "l",
            content: "",
            rawMarkdown: "",
            children: [
              { id: "item-1", type: "i", content: "第一项", rawMarkdown: "* 第一项" },
              { id: "item-2", type: "i", content: "第二项", rawMarkdown: "* 第二项" },
              { id: "item-3", type: "i", content: "第三项", rawMarkdown: "* 第三项" },
            ],
          },
        ],
        rawMarkdown: "",
      }

      const targets = scanSlideForAutoAnimation(slide)
      expect(targets).toHaveLength(2)
      expect(targets[0]).toEqual({ blockId: "item-2", pageIndex: 2, targetClick: "+1" })
      expect(targets[1]).toEqual({ blockId: "item-3", pageIndex: 2, targetClick: "+1" })
    })

    it("页首有主副双标题时：双标题与首个正文块均直接显示，次正文块起顺延 (+1)", () => {
      const slide: ISlidesVirtualPage = {
        pageIndex: 2,
        startBlockId: "start-2",
        frontmatter: {},
        notes: "",
        blocks: [
          { id: "h1", type: "h", content: "主标题", rawMarkdown: "# 主标题" },
          { id: "h2", type: "h", content: "副标题", rawMarkdown: "## 副标题" },
          { id: "p1", type: "p", content: "正文一", rawMarkdown: "正文一" },
          { id: "p2", type: "p", content: "正文二", rawMarkdown: "正文二" },
        ],
        rawMarkdown: "",
      }

      const targets = scanSlideForAutoAnimation(slide)
      expect(targets).toHaveLength(1)
      expect(targets[0]).toEqual({ blockId: "p2", pageIndex: 2, targetClick: "+1" })
    })

    it("无标题页：首个内容块直接显示，后续块顺延 (+1)", () => {
      const slide: ISlidesVirtualPage = {
        pageIndex: 2,
        startBlockId: "start-2",
        frontmatter: {},
        notes: "",
        blocks: [
          { id: "p1", type: "p", content: "论点一", rawMarkdown: "论点一" },
          { id: "p2", type: "p", content: "论点二", rawMarkdown: "论点二" },
        ],
        rawMarkdown: "",
      }

      const targets = scanSlideForAutoAnimation(slide)
      expect(targets).toHaveLength(1)
      expect(targets[0]).toEqual({ blockId: "p2", pageIndex: 2, targetClick: "+1" })
    })

    it("仅有标题与单个内容块时：无需配置动效，返回空", () => {
      const slide: ISlidesVirtualPage = {
        pageIndex: 2,
        startBlockId: "start-2",
        frontmatter: {},
        notes: "",
        blocks: [
          { id: "title", type: "h", content: "标题", rawMarkdown: "# 标题" },
          { id: "p1", type: "p", content: "唯一正文", rawMarkdown: "正文" },
        ],
        rawMarkdown: "",
      }

      const targets = scanSlideForAutoAnimation(slide)
      expect(targets).toEqual([])
    })

    it("增量补充模式：保留块上已有的手工配置动效值，仅补充空动效块", () => {
      const slide: ISlidesVirtualPage = {
        pageIndex: 2,
        startBlockId: "start-2",
        frontmatter: {},
        notes: "",
        blocks: [
          { id: "title", type: "h", content: "标题", rawMarkdown: "# 标题" },
          { id: "p1", type: "p", content: "第一块", rawMarkdown: "第一块" },
          { id: "p2", type: "p", content: "第二块（已有设定）", rawMarkdown: "第二块", clicks: "2" },
          { id: "p3", type: "p", content: "第三块", rawMarkdown: "第三块" },
        ],
        rawMarkdown: "",
      }

      const targets = scanSlideForAutoAnimation(slide)
      // p2 已有 clicks="2"，保留；仅 p3 补充 "+1"
      expect(targets).toHaveLength(1)
      expect(targets[0]).toEqual({ blockId: "p3", pageIndex: 2, targetClick: "+1" })
    })
  })

  describe("scanDocumentForAutoAnimation & runAutoAnimationForDocument (全链路与确认机制)", () => {
    it("文档无待补充动效块时，直接提示并返回", async () => {
      const mockDoc: any = {
        docId: "doc-clean",
        slides: [
          {
            pageIndex: 1,
            frontmatter: {},
            blocks: [{ id: "h1", type: "h", rawMarkdown: "# 封面" }],
          },
          {
            pageIndex: 2,
            frontmatter: {},
            blocks: [
              { id: "h2", type: "h", rawMarkdown: "## 标题" },
              { id: "p1", type: "p", rawMarkdown: "单块正文" },
            ],
          },
        ],
      }

      const mockShow = vi.fn()
      const mockConfirm = vi.fn()

      const res = await runAutoAnimationForDocument("doc-clean", {
        compileDocFn: vi.fn().mockResolvedValue(mockDoc),
        showMessageFn: mockShow,
        confirmFn: mockConfirm,
      })

      expect(res.targets).toHaveLength(0)
      expect(mockShow).toHaveBeenCalledWith("未检测到需要配置顺延动效的后续块")
      expect(mockConfirm).not.toHaveBeenCalled()
    })

    it("检测到待配置块且用户确认时，依次打标属性、更新覆盖层与重新编译", async () => {
      const mockDoc: any = {
        docId: "doc-anim",
        slides: [
          { pageIndex: 1, frontmatter: {}, blocks: [{ id: "h1", type: "h" }] },
          {
            pageIndex: 2,
            frontmatter: {},
            blocks: [
              { id: "h2", type: "h", rawMarkdown: "## 标题" },
              { id: "p1", type: "p", rawMarkdown: "首块" },
              { id: "p2", type: "p", rawMarkdown: "次块" },
              { id: "p3", type: "p", rawMarkdown: "末块" },
            ],
          },
        ],
      }

      const mockShow = vi.fn()
      const mockConfirm = vi.fn((_title, _text, onConfirm) => onConfirm?.())
      const mockSetAttrs = vi.fn().mockResolvedValue({})
      const mockSyncDom = vi.fn()
      const mockCompile = vi.fn().mockResolvedValue(undefined)
      const mockNotice = vi.fn()

      const res = await runAutoAnimationForDocument("doc-anim", {
        compileDocFn: vi.fn().mockResolvedValue(mockDoc),
        showMessageFn: mockShow,
        confirmFn: mockConfirm,
        setBlockAttrsFn: mockSetAttrs,
        syncDomFn: mockSyncDom,
        compileCurrentDocFn: mockCompile,
        onSuccessNotice: mockNotice,
      })

      expect(mockConfirm).toHaveBeenCalledWith(
        "智能设置动效",
        expect.stringContaining("检测到可为 1 页中的 2 个后续块配置顺延 (+1) 动效"),
        expect.any(Function),
        expect.any(Function)
      )

      expect(mockSetAttrs).toHaveBeenCalledTimes(2)
      expect(mockSetAttrs).toHaveBeenCalledWith("p2", { [ATTR_ELEM_CLICK]: "+1" })
      expect(mockSetAttrs).toHaveBeenCalledWith("p3", { [ATTR_ELEM_CLICK]: "+1" })

      expect(globalDocumentCompiler.getBlockAttrOverride("p2")).toEqual({ [ATTR_ELEM_CLICK]: "+1" })
      expect(globalDocumentCompiler.getBlockAttrOverride("p3")).toEqual({ [ATTR_ELEM_CLICK]: "+1" })

      expect(mockSyncDom).toHaveBeenCalledTimes(2)
      expect(mockCompile).toHaveBeenCalled()
      expect(mockNotice).toHaveBeenCalledWith("已配置智能动效")
      expect(mockShow).toHaveBeenCalledWith("已成功为 2 个后续块配置顺延 (+1) 动效")
      expect(res.successCount).toBe(2)
    })

    it("用户在确认弹窗中取消时，不执行任何写库操作", async () => {
      const mockDoc: any = {
        docId: "doc-cancel",
        slides: [
          {
            pageIndex: 2,
            frontmatter: {},
            blocks: [
              { id: "h1", type: "h" },
              { id: "p1", type: "p" },
              { id: "p2", type: "p" },
            ],
          },
        ],
      }

      const mockShow = vi.fn()
      const mockConfirm = vi.fn((_title, _text, _onConfirm, onCancel) => onCancel?.())
      const mockSetAttrs = vi.fn()

      const res = await runAutoAnimationForDocument("doc-cancel", {
        compileDocFn: vi.fn().mockResolvedValue(mockDoc),
        showMessageFn: mockShow,
        confirmFn: mockConfirm,
        setBlockAttrsFn: mockSetAttrs,
      })

      expect(mockConfirm).toHaveBeenCalled()
      expect(mockSetAttrs).not.toHaveBeenCalled()
      expect(res.successCount).toBe(0)
    })
  })

  describe("scanDocumentForAnimationClear & clearAnimationsForDocument (清除全篇动效)", () => {
    it("文档无任何块级动效时，直接提示且不弹警告窗", async () => {
      const mockDoc: any = {
        docId: "doc-no-anim",
        slides: [
          {
            pageIndex: 1,
            frontmatter: { transition: "fade" },
            blocks: [{ id: "p1", type: "p" }],
          },
        ],
      }
      const mockShow = vi.fn()
      const mockConfirm = vi.fn()

      const res = await clearAnimationsForDocument("doc-no-anim", {
        compileDocFn: vi.fn().mockResolvedValue(mockDoc),
        showMessageFn: mockShow,
        confirmFn: mockConfirm,
      })

      expect(res.targets).toHaveLength(0)
      expect(mockConfirm).not.toHaveBeenCalled()
      expect(mockShow).toHaveBeenCalledWith("当前文档未检测到已配置的页面动效，无需清除")
    })

    it("应递归扫描超级块/列表子块上的 click 与 motion，并在用户确认后清空动效", async () => {
      const mockDoc: any = {
        docId: "doc-clear-anim",
        slides: [
          {
            pageIndex: 1,
            frontmatter: { transition: "slide-left" },
            blocks: [
              { id: "p1", type: "p", clicks: "+1" },
              {
                id: "sb1",
                type: "s",
                children: [
                  { id: "c1", type: "p", attributes: { [ATTR_ELEM_MOTION]: "fade-up" } },
                  { id: "c2", type: "p" },
                ],
              },
            ],
          },
          {
            pageIndex: 2,
            frontmatter: {},
            blocks: [
              {
                id: "list1",
                type: "l",
                children: [{ id: "li1", type: "i", ial: { [ATTR_ELEM_CLICK]: "2", [ATTR_ELEM_MOTION]: "zoom" } }],
              },
            ],
          },
        ],
      }

      globalDocumentCompiler.setBlockAttrOverride("p1", { [ATTR_ELEM_CLICK]: "+1" })
      const scanRes = await scanDocumentForAnimationClear("doc-clear-anim", {
        compileDocFn: vi.fn().mockResolvedValue(mockDoc),
      })
      expect(scanRes.affectedPagesCount).toBe(2)
      expect(scanRes.targets.map(t => t.blockId)).toEqual(["p1", "c1", "li1"])

      const mockShow = vi.fn()
      const mockConfirm = vi.fn((title, text, onConfirm) => {
        expect(title).toContain("危险操作")
        expect(text).toContain("2 页中全部 3 个内容块")
        onConfirm?.()
      })
      const mockSetAttrs = vi.fn().mockResolvedValue({})
      const mockSyncDom = vi.fn()
      const mockCompile = vi.fn().mockResolvedValue(undefined)
      const mockNotice = vi.fn()

      const res = await clearAnimationsForDocument("doc-clear-anim", {
        compileDocFn: vi.fn().mockResolvedValue(mockDoc),
        showMessageFn: mockShow,
        confirmFn: mockConfirm,
        setBlockAttrsFn: mockSetAttrs,
        syncDomFn: mockSyncDom,
        compileCurrentDocFn: mockCompile,
        onSuccessNotice: mockNotice,
      })

      expect(mockSetAttrs).toHaveBeenCalledTimes(3)
      expect(mockSetAttrs).toHaveBeenCalledWith("p1", {
        [ATTR_ELEM_CLICK]: "",
        [ATTR_ELEM_MOTION]: "",
      })
      expect(mockSetAttrs).toHaveBeenCalledWith("c1", {
        [ATTR_ELEM_CLICK]: "",
        [ATTR_ELEM_MOTION]: "",
      })
      expect(mockSetAttrs).toHaveBeenCalledWith("li1", {
        [ATTR_ELEM_CLICK]: "",
        [ATTR_ELEM_MOTION]: "",
      })
      expect(globalDocumentCompiler.getBlockAttrOverride("p1")).toBeUndefined()
      expect(mockSyncDom).toHaveBeenCalledTimes(3)
      expect(mockCompile).toHaveBeenCalled()
      expect(mockNotice).toHaveBeenCalledWith("已清除动效")
      expect(res.successCount).toBe(3)
    })

    it("用户在清除动效警告弹窗中取消时，不执行任何清理操作", async () => {
      const mockDoc: any = {
        docId: "doc-clear-cancel",
        slides: [
          {
            pageIndex: 1,
            frontmatter: {},
            blocks: [{ id: "p1", type: "p", clicks: "1" }],
          },
        ],
      }

      const mockConfirm = vi.fn((_t, _x, _onConfirm, onCancel) => onCancel?.())
      const mockSetAttrs = vi.fn()

      const res = await clearAnimationsForDocument("doc-clear-cancel", {
        compileDocFn: vi.fn().mockResolvedValue(mockDoc),
        confirmFn: mockConfirm,
        setBlockAttrsFn: mockSetAttrs,
      })

      expect(mockConfirm).toHaveBeenCalled()
      expect(mockSetAttrs).not.toHaveBeenCalled()
      expect(res.successCount).toBe(0)
    })
  })
})
