import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import SiYuanLiveSlidesPlugin from "../src/index"
import { isMultiBlockSelected } from "../src/sync/selection-mirror"
import * as mainModule from "../src/main"

describe("Multi-Block Selection Guard & Doc Header Strict Trigger (多选块保持当前界面与文档标题严格触发)", () => {
  let plugin: any
  let navigateSpy: any
  let updateInspectorSpy: any

  beforeEach(() => {
    plugin = new SiYuanLiveSlidesPlugin({} as any)
    plugin.currentDocId = "doc-test-123"
    navigateSpy = vi.spyOn(mainModule, "navigateDockToBlock").mockImplementation(() => {})
    updateInspectorSpy = vi.spyOn(mainModule, "updateInspectorCurrentBlock").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("1. isMultiBlockSelected 判定函数", () => {
    it("无选区且无选中块时应返回 false", () => {
      const mockRoot = {
        querySelectorAll: () => [],
      } as any
      expect(isMultiBlockSelected(mockRoot)).toBe(false)
    })

    it("仅有 1 个块带有 .protyle-wysiwyg--select 时应返回 false", () => {
      const mockBlock = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlock : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "block-1" : null),
      }
      const mockRoot = {
        querySelectorAll: (sel: string) => (sel === ".protyle-wysiwyg--select" ? [mockBlock] : []),
      } as any
      expect(isMultiBlockSelected(mockRoot)).toBe(false)
    })

    it("有多个元素带有 .protyle-wysiwyg--select 但归属于同一块 ID 时应返回 false", () => {
      const mockChild = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockParentBlock : null),
        getAttribute: () => null,
      }
      const mockParentBlock = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockParentBlock : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "block-same" : null),
      }
      const mockRoot = {
        querySelectorAll: (sel: string) => (sel === ".protyle-wysiwyg--select" ? [mockChild, mockParentBlock] : []),
      } as any
      expect(isMultiBlockSelected(mockRoot)).toBe(false)
    })

    it("存在 2 个及以上属于不同 data-node-id 的块带有 .protyle-wysiwyg--select 时应返回 true", () => {
      const mockBlock1 = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlock1 : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "block-1" : null),
      }
      const mockBlock2 = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlock2 : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "block-2" : null),
      }
      const mockRoot = {
        querySelectorAll: (sel: string) => (sel === ".protyle-wysiwyg--select" ? [mockBlock1, mockBlock2] : []),
      } as any
      expect(isMultiBlockSelected(mockRoot)).toBe(true)
    })

    it("文本连续划选跨越两个不同 data-node-id 块时应返回 true", () => {
      const mockRoot = { querySelectorAll: () => [] } as any
      const mockBlockA = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlockA : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "block-a" : null),
      }
      const mockBlockB = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlockB : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "block-b" : null),
      }
      const nodeA = { nodeType: 1, closest: (sel: string) => (sel === "[data-node-id]" ? mockBlockA : null) }
      const nodeB = { nodeType: 1, closest: (sel: string) => (sel === "[data-node-id]" ? mockBlockB : null) }

      const origWindow = (globalThis as any).window
      ;(globalThis as any).window = {
        getSelection: () => ({
          rangeCount: 1,
          isCollapsed: false,
          getRangeAt: () => ({
            startContainer: nodeA,
            endContainer: nodeB,
          }),
        }),
      }

      try {
        expect(isMultiBlockSelected(mockRoot)).toBe(true)
      } finally {
        ;(globalThis as any).window = origWindow
      }
    })

    it("文本划选位于同一块内部时应返回 false", () => {
      const mockRoot = { querySelectorAll: () => [] } as any
      const mockBlockA = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlockA : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "block-a" : null),
      }
      const nodeStart = { nodeType: 1, closest: (sel: string) => (sel === "[data-node-id]" ? mockBlockA : null) }
      const nodeEnd = { nodeType: 1, closest: (sel: string) => (sel === "[data-node-id]" ? mockBlockA : null) }

      const origWindow = (globalThis as any).window
      ;(globalThis as any).window = {
        getSelection: () => ({
          rangeCount: 1,
          isCollapsed: false,
          getRangeAt: () => ({
            startContainer: nodeStart,
            endContainer: nodeEnd,
          }),
        }),
      }

      try {
        expect(isMultiBlockSelected(mockRoot)).toBe(false)
      } finally {
        ;(globalThis as any).window = origWindow
      }
    })
  })

  describe("2. onEditorClick 多选与点击分支", () => {
    it("处于多选块状态时，点击事件应直接返回，不触发跳转全局设置或单块联动", () => {
      const mockBlock1 = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlock1 : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "b-1" : null),
      }
      const mockBlock2 = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlock2 : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "b-2" : null),
      }
      const mockTarget = {
        closest: (sel: string) => {
          if (sel === ".protyle" || sel === ".protyle-wysiwyg") {
            return {
              querySelectorAll: (s: string) => (s === ".protyle-wysiwyg--select" ? [mockBlock1, mockBlock2] : []),
            }
          }
          if (sel === "[data-node-id]") return mockBlock1
          return null
        },
      }

      const syncSpy = vi.spyOn(plugin as any, "syncInspectorBlock").mockImplementation(() => Promise.resolve())
      const switchDocSpy = vi.spyOn(plugin, "switchToDocGlobalInspector").mockImplementation(() => Promise.resolve())

      ;(plugin as any).onEditorClick({ target: mockTarget } as any)

      expect(navigateSpy).not.toHaveBeenCalled()
      expect(syncSpy).not.toHaveBeenCalled()
      expect(switchDocSpy).not.toHaveBeenCalled()
    })

    it("点击正文空白边距 (.protyle-content 边距区域) 时，不应误判为文档头跳转全局设置", () => {
      const mockMarginTarget = {
        closest: (sel: string) => {
          if (sel === ".protyle-content") return {}
          return null
        },
      }
      const switchDocSpy = vi.spyOn(plugin, "switchToDocGlobalInspector").mockImplementation(() => Promise.resolve())

      ;(plugin as any).onEditorClick({ target: mockMarginTarget } as any)

      expect(switchDocSpy).not.toHaveBeenCalled()
    })

    it("明确点击文档标题 (.protyle-title) 时，应正确切换至全局设置", () => {
      const mockTitleInput = { innerText: "测试文档标题" }
      const mockTitleEl = {
        querySelector: (sel: string) => (sel === ".protyle-title__input" ? mockTitleInput : null),
        innerText: "测试文档标题",
        closest: (sel: string) => (sel === ".protyle-title" ? mockTitleEl : null),
      }
      const mockTarget = {
        closest: (sel: string) => (sel === ".protyle-title" ? mockTitleEl : null),
      }

      vi.spyOn(plugin as any, "resolveDocIdFromElement").mockReturnValue("doc-test-123")
      const switchDocSpy = vi.spyOn(plugin, "switchToDocGlobalInspector").mockImplementation(() => Promise.resolve())

      ;(plugin as any).onEditorClick({ target: mockTarget } as any)

      expect(switchDocSpy).toHaveBeenCalledWith("doc-test-123", "测试文档标题")
    })
  })

  describe("3. onSelectionChange 选区变化联动分支", () => {
    it("多选状态下 selectionchange 不得触发任何跳转与同步", () => {
      const mockBlock1 = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlock1 : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "b-1" : null),
      }
      const mockBlock2 = {
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlock2 : null),
        getAttribute: (attr: string) => (attr === "data-node-id" ? "b-2" : null),
      }
      const mockAnchor = {
        nodeType: 1,
        closest: (sel: string) => {
          if (sel === ".protyle" || sel === ".protyle-wysiwyg") {
            return {
              querySelectorAll: (s: string) => (s === ".protyle-wysiwyg--select" ? [mockBlock1, mockBlock2] : []),
            }
          }
          if (sel === "[data-node-id]") return mockBlock1
          return null
        },
      }

      const origWindow = (globalThis as any).window
      const origNode = (globalThis as any).Node
      ;(globalThis as any).window = {
        getSelection: () => ({ rangeCount: 1, anchorNode: mockAnchor }),
      }
      ;(globalThis as any).Node = { ELEMENT_NODE: 1 }

      const syncSpy = vi.spyOn(plugin as any, "syncInspectorBlock").mockImplementation(() => Promise.resolve())
      const switchDocSpy = vi.spyOn(plugin, "switchToDocGlobalInspector").mockImplementation(() => Promise.resolve())

      try {
        ;(plugin as any).onSelectionChange()

        expect(navigateSpy).not.toHaveBeenCalled()
        expect(syncSpy).not.toHaveBeenCalled()
        expect(switchDocSpy).not.toHaveBeenCalled()
      } finally {
        ;(globalThis as any).window = origWindow
        ;(globalThis as any).Node = origNode
      }
    })

    it("单块状态下正常恢复联动光标与更新配置面板", () => {
      const mockBlockSingle = {
        getAttribute: (attr: string) => (attr === "data-node-id" ? "block-single-1" : "NodeParagraph"),
        closest: (sel: string) => (sel === "[data-node-id]" ? mockBlockSingle : null),
      }
      const mockAnchor = {
        nodeType: 1,
        closest: (sel: string) => {
          if (sel === ".protyle-wysiwyg") return { querySelectorAll: () => [] }
          if (sel === ".protyle") return { querySelectorAll: () => [] }
          if (sel === "[data-node-id]") return mockBlockSingle
          return null
        },
      }

      const origWindow = (globalThis as any).window
      const origNode = (globalThis as any).Node
      ;(globalThis as any).window = {
        getSelection: () => ({ rangeCount: 1, anchorNode: mockAnchor }),
      }
      ;(globalThis as any).Node = { ELEMENT_NODE: 1 }

      const syncSpy = vi.spyOn(plugin as any, "syncInspectorBlock").mockImplementation(() => Promise.resolve())

      try {
        ;(plugin as any).onSelectionChange()

        expect(navigateSpy).toHaveBeenCalledWith("block-single-1")
        expect(syncSpy).toHaveBeenCalledWith(mockBlockSingle, "block-single-1", "NodeParagraph")
      } finally {
        ;(globalThis as any).window = origWindow
        ;(globalThis as any).Node = origNode
      }
    })
  })
})
