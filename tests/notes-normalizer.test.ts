import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  isCalloutOrBlockquote,
  isStandardNoteBlock,
  scanDocumentForCandidateNotes,
  normalizeNoteBlock,
  identifyAndNormalizeDocumentNotes,
} from "../src/sync/notes-normalizer"
import { globalDocumentCompiler } from "../src/compiler/document-compiler"
import { ATTR_ELEM_NOTE } from "../src/types/slides-protocol"

describe("notes-normalizer (讲稿块识别与规范化)", () => {
  beforeEach(() => {
    globalDocumentCompiler.clearAllOverrides()
    vi.restoreAllMocks()
  })

  describe("isCalloutOrBlockquote", () => {
    it("正确识别 callout、b 以及 NodeCallout、NodeBlockquote 类型", () => {
      expect(isCalloutOrBlockquote({ type: "callout" })).toBe(true)
      expect(isCalloutOrBlockquote({ type: "NodeCallout" })).toBe(true)
      expect(isCalloutOrBlockquote({ type: "b" })).toBe(true)
      expect(isCalloutOrBlockquote({ type: "NodeBlockquote" })).toBe(true)
    })

    it("正确识别 markdown 以 > 开头的段落或引用块", () => {
      expect(isCalloutOrBlockquote({ type: "p", markdown: "> 这是一段引用文本" })).toBe(true)
      expect(isCalloutOrBlockquote({ type: "NodeParagraph", markdown: "> [!NOTE] 提示" })).toBe(true)
    })

    it("非引用/提示块应返回 false", () => {
      expect(isCalloutOrBlockquote(null)).toBe(false)
      expect(isCalloutOrBlockquote({ type: "p", markdown: "普通段落内容" })).toBe(false)
      expect(isCalloutOrBlockquote({ type: "h", markdown: "# 标题" })).toBe(false)
      expect(isCalloutOrBlockquote({ type: "c", markdown: "```ts\ncode\n```" })).toBe(false)
    })
  })

  describe("isStandardNoteBlock", () => {
    it("具备 custom-slides-note 属性且具备标准演讲备注标题时返回 true", () => {
      const attrs = { [ATTR_ELEM_NOTE]: "true" }
      expect(isStandardNoteBlock("> [!NOTE] 💡 演讲备注\n> 讲稿内容", attrs)).toBe(true)
      expect(isStandardNoteBlock("> [!NOTE] 演讲备注\n> 讲稿内容", attrs)).toBe(true)
      expect(isStandardNoteBlock("> [!NOTE] 讲稿备注\n> 讲稿内容", attrs)).toBe(true)
    })

    it("虽然具备 custom-slides-note 属性但格式非标准提示块标题时返回 false", () => {
      const attrs = { [ATTR_ELEM_NOTE]: "true" }
      expect(isStandardNoteBlock("> 普通的口播提词，未加标准提示头", attrs)).toBe(false)
      expect(isStandardNoteBlock("> [!TIP] 额外提示\n> 内容", attrs)).toBe(false)
    })

    it("无 custom-slides-note 属性即使格式类似也返回 false", () => {
      expect(isStandardNoteBlock("> [!NOTE] 💡 演讲备注\n> 讲稿内容", {})).toBe(false)
      expect(isStandardNoteBlock("> [!NOTE] 💡 演讲备注\n> 讲稿内容", undefined)).toBe(false)
    })
  })

  describe("scanDocumentForCandidateNotes", () => {
    it("空文档返回空候选列表", async () => {
      const mockGetChildBlocks = vi.fn().mockResolvedValue([])
      const res = await scanDocumentForCandidateNotes("doc-empty", {
        getChildBlocksFn: mockGetChildBlocks,
      })
      expect(res).toEqual([])
    })

    it("能准确识别 --- 分隔线前紧邻的提示块和引用块", async () => {
      const mockBlocks = [
        { id: "p-1", type: "p", markdown: "第一页内容" },
        { id: "note-1", type: "callout", markdown: "> [!TIP] 第一页提示块\n> 演讲者说明" },
        { id: "divider-1", type: "tb", markdown: "---" },
        { id: "p-2", type: "p", markdown: "第二页内容" },
        { id: "note-2", type: "b", markdown: "> 第二页普通引用块讲稿" },
        { id: "divider-2", type: "tb", markdown: "---" },
        { id: "p-3", type: "p", markdown: "第三页内容，无讲稿" },
      ]

      const res = await scanDocumentForCandidateNotes("doc-1", {
        getChildBlocksFn: vi.fn().mockResolvedValue(mockBlocks),
      })

      expect(res).toHaveLength(2)
      expect(res[0].id).toBe("note-1")
      expect(res[0].pageIndex).toBe(1)
      expect(res[0].cleanContent).toBe("演讲者说明")

      expect(res[1].id).toBe("note-2")
      expect(res[1].pageIndex).toBe(2)
      expect(res[1].cleanContent).toContain("第二页普通引用块讲稿")
    })

    it("能准确识别最后一页末尾紧贴的提示块（即便末尾无 --- 分隔线）", async () => {
      const mockBlocks = [
        { id: "p-1", type: "p", markdown: "第一页内容" },
        { id: "divider-1", type: "tb", markdown: "---" },
        { id: "p-2", type: "p", markdown: "第二页内容" },
        { id: "note-last", type: "b", markdown: "> 最后一页末尾讲稿提词" },
      ]

      const res = await scanDocumentForCandidateNotes("doc-last", {
        getChildBlocksFn: vi.fn().mockResolvedValue(mockBlocks),
      })

      expect(res).toHaveLength(1)
      expect(res[0].id).toBe("note-last")
      expect(res[0].pageIndex).toBe(2)
      expect(res[0].cleanContent).toBe("最后一页末尾讲稿提词")
    })

    it("若提示块位于页中、其后还有其他内容元素分隔，则不得识别为讲稿块", async () => {
      const mockBlocks = [
        { id: "callout-mid", type: "callout", markdown: "> [!INFO] 页中提示卡片" },
        { id: "p-after", type: "p", markdown: "紧随提示块之后的普通正文" },
        { id: "divider-1", type: "tb", markdown: "---" },
        { id: "p-end", type: "p", markdown: "第二页" },
      ]

      const res = await scanDocumentForCandidateNotes("doc-mid", {
        getChildBlocksFn: vi.fn().mockResolvedValue(mockBlocks),
      })

      expect(res).toHaveLength(0)
    })

    it("提示块与分隔线之间存在空段落时能自动容错并识别该提示块", async () => {
      const mockBlocks = [
        { id: "p-1", type: "p", markdown: "第一页内容" },
        { id: "note-1", type: "callout", markdown: "> [!NOTE] 💡 演讲备注\n> 有效提词内容" },
        { id: "empty-p", type: "p", markdown: "", content: "" },
        { id: "divider-1", type: "tb", markdown: "---" },
      ]

      // note-1 尚未打标 custom-slides-note
      const res = await scanDocumentForCandidateNotes("doc-empty-p", {
        getChildBlocksFn: vi.fn().mockResolvedValue(mockBlocks),
      })

      expect(res).toHaveLength(1)
      expect(res[0].id).toBe("note-1")
      expect(res[0].cleanContent).toBe("有效提词内容")
    })

    it("若块已具备 custom-slides-note 且已符合标准提示块格式，自动跳过", async () => {
      const mockBlocks = [
        {
          id: "note-already-std",
          type: "callout",
          markdown: "> [!NOTE] 💡 演讲备注\n> 已规范讲稿内容",
          ial: { [ATTR_ELEM_NOTE]: "true" },
        },
        { id: "divider-1", type: "tb", markdown: "---" },
      ]

      const res = await scanDocumentForCandidateNotes("doc-std", {
        getChildBlocksFn: vi.fn().mockResolvedValue(mockBlocks),
      })

      expect(res).toHaveLength(0)
    })

    it("若块具备 custom-slides-note 属性但格式非标准（如粗糙引用块），仍应识别并规范化", async () => {
      const mockBlocks = [
        {
          id: "note-raw",
          type: "b",
          markdown: "> 仅打标但未规范格式的讲稿提词",
          ial: { [ATTR_ELEM_NOTE]: "true" },
        },
        { id: "divider-1", type: "tb", markdown: "---" },
      ]

      const res = await scanDocumentForCandidateNotes("doc-raw", {
        getChildBlocksFn: vi.fn().mockResolvedValue(mockBlocks),
      })

      expect(res).toHaveLength(1)
      expect(res[0].id).toBe("note-raw")
      expect(res[0].cleanContent).toBe("仅打标但未规范格式的讲稿提词")
    })
  })

  describe("normalizeNoteBlock", () => {
    it("调用 updateBlock 和 setBlockAttrs 规范化讲稿块", async () => {
      const mockUpdate = vi.fn().mockResolvedValue({})
      const mockSetAttrs = vi.fn().mockResolvedValue({})
      const mockSyncDom = vi.fn()

      await normalizeNoteBlock("block-1", "这里是讲稿提词第一行\n这里是第二行", {
        updateBlockFn: mockUpdate,
        setBlockAttrsFn: mockSetAttrs,
        syncDomFn: mockSyncDom,
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        "markdown",
        expect.stringContaining("> [!NOTE] 💡 演讲备注\n> 这里是讲稿提词第一行\n> 这里是第二行"),
        "block-1"
      )
      expect(mockSetAttrs).toHaveBeenCalledWith("block-1", {
        [ATTR_ELEM_NOTE]: "true",
      })
      expect(globalDocumentCompiler.getBlockAttrOverride("block-1")).toEqual({
        [ATTR_ELEM_NOTE]: "true",
      })
      expect(mockSyncDom).toHaveBeenCalledWith("block-1", {
        [ATTR_ELEM_NOTE]: "true",
      })
    })
  })

  describe("identifyAndNormalizeDocumentNotes (全链路编排与确认反馈)", () => {
    it("未发现待规范化候选块时直接弹窗提示，不调用更新", async () => {
      const mockShowMsg = vi.fn()
      const mockConfirm = vi.fn()

      const res = await identifyAndNormalizeDocumentNotes("doc-clean", {
        getChildBlocksFn: vi.fn().mockResolvedValue([
          { id: "p-1", type: "p", markdown: "普通正文" },
        ]),
        showMessageFn: mockShowMsg,
        confirmFn: mockConfirm,
      })

      expect(res.matchedCount).toBe(0)
      expect(mockShowMsg).toHaveBeenCalledWith("未发现待规范化的候选讲稿块")
      expect(mockConfirm).not.toHaveBeenCalled()
    })

    it("检测到候选块且用户确认时，依次执行规范化、覆盖层更新与重新编译", async () => {
      const mockShowMsg = vi.fn()
      const mockConfirm = vi.fn((_title, _text, onConfirm) => onConfirm?.())
      const mockUpdate = vi.fn().mockResolvedValue({})
      const mockSetAttrs = vi.fn().mockResolvedValue({})
      const mockCompile = vi.fn().mockResolvedValue(undefined)
      const mockNotice = vi.fn()

      const mockBlocks = [
        { id: "note-1", type: "b", markdown: "> 第一页讲稿" },
        { id: "div-1", type: "tb", markdown: "---" },
        { id: "note-2", type: "callout", markdown: "> [!TIP] 第二页讲稿" },
      ]

      const res = await identifyAndNormalizeDocumentNotes("doc-normalize", {
        getChildBlocksFn: vi.fn().mockResolvedValue(mockBlocks),
        showMessageFn: mockShowMsg,
        confirmFn: mockConfirm,
        updateBlockFn: mockUpdate,
        setBlockAttrsFn: mockSetAttrs,
        compileFn: mockCompile,
        onSuccessNotice: mockNotice,
      })

      expect(mockConfirm).toHaveBeenCalledWith(
        "识别讲稿块",
        expect.stringContaining("扫描检测到 2 处候选讲稿块"),
        expect.any(Function),
        expect.any(Function)
      )

      expect(mockUpdate).toHaveBeenCalledTimes(2)
      expect(mockSetAttrs).toHaveBeenCalledTimes(2)
      expect(mockCompile).toHaveBeenCalled()
      expect(mockNotice).toHaveBeenCalledWith("已规范化讲稿")
      expect(mockShowMsg).toHaveBeenCalledWith("已成功识别并规范化 2 个讲稿块")
      expect(res.successCount).toBe(2)
    })

    it("用户在二次确认弹窗中取消时，不执行任何写库操作", async () => {
      const mockShowMsg = vi.fn()
      const mockConfirm = vi.fn((_title, _text, _onConfirm, onCancel) => onCancel?.())
      const mockUpdate = vi.fn()

      const mockBlocks = [
        { id: "note-1", type: "b", markdown: "> 讲稿" },
        { id: "div-1", type: "tb", markdown: "---" },
      ]

      const res = await identifyAndNormalizeDocumentNotes("doc-cancel", {
        getChildBlocksFn: vi.fn().mockResolvedValue(mockBlocks),
        showMessageFn: mockShowMsg,
        confirmFn: mockConfirm,
        updateBlockFn: mockUpdate,
      })

      expect(mockConfirm).toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(res.successCount).toBe(0)
    })
  })
})
