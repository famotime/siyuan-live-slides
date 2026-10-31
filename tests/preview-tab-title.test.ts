import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import SiYuanLiveSlidesPlugin from "../src/index"
import * as mainModule from "../src/main"
import * as apiModule from "../src/api"
import fs from "fs"
import path from "path"

describe("Preview Tab Title & Header Layout (预览页签标题与工具栏精简)", () => {
  let plugin: SiYuanLiveSlidesPlugin

  beforeEach(() => {
    vi.restoreAllMocks()
    ;(globalThis as any).document = {
      querySelector: vi.fn().mockReturnValue(null),
      querySelectorAll: vi.fn().mockReturnValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    plugin = new SiYuanLiveSlidesPlugin({
      name: "siyuan-live-slides",
      displayName: "Slidev",
      app: {} as any,
    } as any)
  })

  afterEach(() => {
    delete (globalThis as any).document
  })

  describe("1. buildPreviewTabTitle 命名规范", () => {
    it("传入有效文档名称时应格式化为『即现（文档名称）』", () => {
      expect(plugin.buildPreviewTabTitle("架构设计与技术选型")).toBe("即现（架构设计与技术选型）")
      expect(plugin.buildPreviewTabTitle("   产品发布会 2026   ")).toBe("即现（产品发布会 2026）")
    })

    it("文档名称为空、空字符串或纯空格时应回退显示『即现』", () => {
      expect(plugin.buildPreviewTabTitle("")).toBe("即现")
      expect(plugin.buildPreviewTabTitle("   ")).toBe("即现")
      expect(plugin.buildPreviewTabTitle(undefined)).toBe("即现")
    })
  })

  describe("2. fetchDocumentTitle 文档名称多层解析", () => {
    it("优先从 DOM 活跃编辑区中的 .protyle-title__input 提取标题", async () => {
      const docId = "doc-2026-test"
      ;(globalThis as any).document.querySelector = vi.fn((sel: string) => {
        if (sel.includes(docId) && sel.includes(".protyle-title__input")) {
          return { innerText: "2026 技术演进路线" }
        }
        return null
      })

      const title = await plugin.fetchDocumentTitle(docId)
      expect(title).toBe("2026 技术演进路线")
    })

    it("DOM 未匹配时，应降级从内核 blocks SQL 查询获取文档标题", async () => {
      const docId = "doc-sql-query"
      vi.spyOn(apiModule, "sql").mockResolvedValueOnce([
        { content: "思源笔记 Slidev 深度整合指南" },
      ])

      const title = await plugin.fetchDocumentTitle(docId)
      expect(title).toBe("思源笔记 Slidev 深度整合指南")
    })

    it("当 DOM 与 SQL 均无有效数据时，应优雅返回空字符串", async () => {
      const docId = "doc-empty"
      vi.spyOn(apiModule, "sql").mockResolvedValueOnce([])

      const title = await plugin.fetchDocumentTitle(docId)
      expect(title).toBe("")
    })
  })

  describe("3. updatePreviewTabHeader 动态更新与 Pin 联动", () => {
    it("当挂载官方 Tab 实例时，应调用 tab.updateTitle 并设置原生 title 属性", async () => {
      const mockHeadElement = {
        setAttribute: vi.fn(),
      }
      const mockTab = {
        updateTitle: vi.fn(),
        headElement: mockHeadElement,
      }
      plugin.previewTab = mockTab

      await plugin.updatePreviewTabHeader("分布式系统全景图", "doc-123")

      expect(mockTab.updateTitle).toHaveBeenCalledWith("即现（分布式系统全景图）")
      expect(mockHeadElement.setAttribute).toHaveBeenCalledWith("title", "即现（分布式系统全景图）")
    })

    it("当没有 tab 实例引用时，应通过 DOM 遍历兜底更新思源页签栏", async () => {
      const mockTextEl = { textContent: "Slidev 演示预览" }
      const mockHeaderEl = {
        querySelector: vi.fn().mockReturnValue(mockTextEl),
        setAttribute: vi.fn(),
      }
      ;(globalThis as any).document.querySelectorAll = vi.fn().mockReturnValue([mockHeaderEl])

      await plugin.updatePreviewTabHeader("年度工作总结")

      expect(mockTextEl.textContent).toBe("即现（年度工作总结）")
      expect(mockHeaderEl.setAttribute).toHaveBeenCalledWith("title", "即现（年度工作总结）")
    })

    it("若预览页签已被 Pin 锁定到特定文档，切换到其他文档时不应篡改 Tab 标题", async () => {
      const mockTab = {
        updateTitle: vi.fn(),
        headElement: { setAttribute: vi.fn() },
      }
      plugin.previewTab = mockTab

      // 模拟 previewTabInstance 处于 Pin 锁定状态
      vi.spyOn(mainModule, "getPreviewTabInstance").mockReturnValue({
        isPinned: { value: true },
        pinnedDocId: { value: "locked-doc-id" },
      })

      // 尝试为新文档 doc-other 更新标题，应被拦截忽略
      await plugin.updatePreviewTabHeader("新文档标题", "doc-other")
      expect(mockTab.updateTitle).not.toHaveBeenCalled()

      // 为被锁定的文档更新，应正常放行（宿主钩子 fetchDocumentTitle 可被实例级打桩）
      vi.spyOn(plugin, "fetchDocumentTitle").mockResolvedValueOnce("锁定文档原标题")
      await plugin.updatePreviewTabHeader("", "locked-doc-id")
      expect(mockTab.updateTitle).toHaveBeenCalledWith("即现（锁定文档原标题）")
    })
  })

  describe("4. SlidesPreviewTab 内层工具栏精简结构验证", () => {
    it("源码中应彻底移除重复的『Slidev 演示预览』文本，并采用左右分栏排布", () => {
      const tabSource = fs.readFileSync(path.resolve(__dirname, "../src/ui/tab/SlidesPreviewTab.vue"), "utf-8")

      // 1. 不再包含重复的文本
      expect(tabSource).not.toContain("<span>Slidev 演示预览</span>")
      expect(tabSource).not.toContain("spm-slides-tab__title")

      // 2. 工具栏左右分栏
      expect(tabSource).toContain("spm-slides-tab__nav")
      expect(tabSource).toContain("spm-slides-tab__tools")
    })
  })

  describe("5. preview-tab-title 服务模块直测 (RF-019)", () => {
    it("buildPreviewTabTitle 纯函数应独立于插件实例工作", async () => {
      const { buildPreviewTabTitle } = await import("../src/plugin/preview-tab-title")
      expect(buildPreviewTabTitle("模块直测")).toBe("即现（模块直测）")
      expect(buildPreviewTabTitle("  ")).toBe("即现")
    })

    it("fetchDocumentTitle 应从已编译模型提取一级标题", async () => {
      const { fetchDocumentTitle } = await import("../src/plugin/preview-tab-title")
      const host = {
        currentDocId: "doc-x",
        latestCompiledDoc: {
          docId: "doc-x",
          slides: [{ blocks: [{ type: "h", content: " 编译模型标题 " }] }],
        },
        previewTab: null,
        getActiveDocumentId: () => "",
      }
      const title = await fetchDocumentTitle(host as any, "doc-x")
      expect(title).toBe("编译模型标题")
    })

    it("updatePreviewTabHeader 无 previewTab 实例时应走 DOM 兜底路径", async () => {
      const { updatePreviewTabHeader } = await import("../src/plugin/preview-tab-title")
      const textEl = { textContent: "即现（旧标题）" }
      const headerEl = { querySelector: vi.fn().mockReturnValue(textEl), setAttribute: vi.fn() }
      ;(globalThis as any).document = {
        querySelectorAll: vi.fn().mockReturnValue([headerEl]),
      }
      const host = {
        currentDocId: "doc-y",
        latestCompiledDoc: null,
        previewTab: null,
        getActiveDocumentId: () => "doc-y",
      }

      await updatePreviewTabHeader(host as any, "DOM 兜底标题")

      expect(textEl.textContent).toBe("即现（DOM 兜底标题）")
      expect(headerEl.setAttribute).toHaveBeenCalledWith("title", "即现（DOM 兜底标题）")
      delete (globalThis as any).document
    })
  })
})
