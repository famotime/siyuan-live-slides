import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  generateBlockId,
  checkCanConvertToSuperBlock,
  executeConvertToSuperBlock,
} from "@/sync/superblock-transform"
import * as api from "@/api"

class MockElement {
  nodeId: string
  type: string
  classes: Set<string>
  attrs: Record<string, string>
  children: MockElement[] = []
  parentElement: MockElement | null = null
  previousElementSibling: MockElement | null = null
  nextElementSibling: MockElement | null = null

  constructor(nodeId: string, type: string, classes: string[] = [], attrs: Record<string, string> = {}) {
    this.nodeId = nodeId
    this.type = type
    this.classes = new Set(classes)
    this.attrs = {
      "data-node-id": nodeId,
      "data-type": type,
      ...attrs,
    }
  }

  get outerHTML(): string {
    return `<div data-node-id="${this.nodeId}" data-type="${this.type}"></div>`
  }

  getAttribute(name: string): string | null {
    if (name === "data-node-id") return this.nodeId
    if (name === "data-type") return this.type
    return this.attrs[name] ?? null
  }

  setAttribute(name: string, val: string) {
    this.attrs[name] = val
  }

  get classList() {
    return {
      contains: (c: string) => this.classes.has(c),
      add: (c: string) => this.classes.add(c),
      remove: (c: string) => this.classes.delete(c),
    }
  }

  closest(sel: string): MockElement | null {
    // eslint-disable-next-line ts/no-this-alias -- 模拟 DOM closest 沿父链回溯的惯用写法
    let cur: MockElement | null = this
    while (cur) {
      if (cur.matches(sel)) return cur
      cur = cur.parentElement
    }
    return null
  }

  matches(sel: string): boolean {
    if (sel.includes("NodeList") && (this.type === "NodeList" || this.classes.has("list"))) return true
    if (sel.includes("NodeListItem") && (this.type === "NodeListItem" || this.classes.has("li"))) return true
    if (sel.includes("protyle-wysiwyg") && this.classes.has("protyle-wysiwyg")) return true
    return false
  }

  appendChild(child: MockElement) {
    const last = this.children[this.children.length - 1]
    if (last) {
      last.nextElementSibling = child
      child.previousElementSibling = last
    }
    child.parentElement = this
    this.children.push(child)
  }

  querySelectorAll(sel: string): MockElement[] {
    const res: MockElement[] = []
    const isDirectChildOnly = sel.startsWith(":scope >")
    if (isDirectChildOnly) {
      for (const c of this.children) {
        if (sel.includes("NodeListItem") && (c.type === "NodeListItem" || c.classes.has("li"))) {
          res.push(c)
        }
      }
      return res
    }

    const walk = (el: MockElement) => {
      for (const c of el.children) {
        if (sel.includes(".protyle-wysiwyg--select") && c.classes.has("protyle-wysiwyg--select")) {
          res.push(c)
        } else if (sel.includes("NodeListItem") && (c.type === "NodeListItem" || c.classes.has("li"))) {
          res.push(c)
        }
        walk(c)
      }
    }
    walk(this)
    return res
  }

  querySelector(sel: string): MockElement | null {
    const match = sel.match(/\[data-node-id="([^"]+)"\]/)
    const targetId = match ? match[1] : ""
    let found: MockElement | null = null
    const walk = (el: MockElement) => {
      if (found) return
      if (targetId && el.nodeId === targetId) {
        found = el
        return
      }
      for (const c of el.children) {
        walk(c)
      }
    }
    walk(this)
    return found
  }
}

describe("SuperBlock Transform & Multi-block / List Items Merge", () => {
  let mockEditor: MockElement
  let originalDocument: any

  beforeEach(() => {
    vi.restoreAllMocks()
    originalDocument = (globalThis as any).document
    mockEditor = new MockElement("doc-root", "NodeDocument", ["protyle-wysiwyg"])

    ;(globalThis as any).document = {
      querySelector: vi.fn((sel: string) => {
        if (sel.includes(".protyle-wysiwyg")) return mockEditor
        return mockEditor.querySelector(sel)
      }),
      querySelectorAll: vi.fn((sel: string) => {
        return mockEditor.querySelectorAll(sel)
      }),
    }
  })

  afterEach(() => {
    ;(globalThis as any).document = originalDocument
  })

  describe("generateBlockId", () => {
    it("should generate a valid SiYuan block ID format (14 digits timestamp + hyphen + 7 random chars)", () => {
      const id = generateBlockId()
      expect(id).toMatch(/^\d{14}-[a-z0-9]{7}$/)
    })

    it("should generate unique IDs on successive calls", () => {
      const id1 = generateBlockId()
      const id2 = generateBlockId()
      expect(id1).not.toBe(id2)
    })
  })

  describe("checkCanConvertToSuperBlock", () => {
    it("should return false when editor is empty and no blocks selected", () => {
      const p1 = new MockElement("p1", "NodeParagraph", ["p"])
      mockEditor.appendChild(p1)
      expect(checkCanConvertToSuperBlock("p1", "NodeParagraph")).toBe(false)
    })

    it("should return true when 2 or more blocks are selected with .protyle-wysiwyg--select", () => {
      const p1 = new MockElement("p1", "NodeParagraph", ["p", "protyle-wysiwyg--select"])
      const p2 = new MockElement("p2", "NodeParagraph", ["p", "protyle-wysiwyg--select"])
      mockEditor.appendChild(p1)
      mockEditor.appendChild(p2)
      expect(checkCanConvertToSuperBlock("p1", "NodeParagraph")).toBe(true)
    })

    it("should return true when a NodeList with >= 2 items is focused or selected", () => {
      const list1 = new MockElement("list-1", "NodeList", ["list"])
      const li1 = new MockElement("li-1", "NodeListItem", ["li"])
      const li2 = new MockElement("li-2", "NodeListItem", ["li"])
      list1.appendChild(li1)
      list1.appendChild(li2)
      mockEditor.appendChild(list1)

      expect(checkCanConvertToSuperBlock("list-1", "NodeList")).toBe(true)
    })

    it("should return false when a NodeList has only 1 item", () => {
      const list1 = new MockElement("list-1", "NodeList", ["list"])
      const li1 = new MockElement("li-1", "NodeListItem", ["li"])
      list1.appendChild(li1)
      mockEditor.appendChild(list1)

      expect(checkCanConvertToSuperBlock("list-1", "NodeList")).toBe(false)
    })
  })

  describe("executeConvertToSuperBlock - Multiple Normal Blocks", () => {
    it("should merge multiple selected normal blocks into a horizontal superblock with atomic operations", async () => {
      const heading = new MockElement("heading-1", "NodeHeading")
      const blockA = new MockElement("block-a", "NodeParagraph", ["p", "protyle-wysiwyg--select"])
      const blockB = new MockElement("block-b", "NodeParagraph", ["p", "protyle-wysiwyg--select"])
      const blockC = new MockElement("block-c", "NodeParagraph", ["p"])
      mockEditor.appendChild(heading)
      mockEditor.appendChild(blockA)
      mockEditor.appendChild(blockB)
      mockEditor.appendChild(blockC)

      const performTxSpy = vi.spyOn(api, "performTransactions").mockResolvedValue({ code: 0, data: null })

      const res = await executeConvertToSuperBlock({
        currentDocId: "doc-root",
        activeBlockId: "block-a",
      })

      expect(res.success).toBe(true)
      expect(res.colCount).toBe(2)
      expect(res.superBlockId).toBeDefined()

      expect(performTxSpy).toHaveBeenCalledTimes(1)
      const tx = performTxSpy.mock.calls[0][0][0]

      // 验证 doOperations
      expect(tx.doOperations).toHaveLength(3)
      // 1. 插入横向超级块
      expect(tx.doOperations[0].action).toBe("insert")
      expect(tx.doOperations[0].data).toContain('data-type="NodeSuperBlock"')
      expect(tx.doOperations[0].data).toContain('data-sb-layout="col"')
      expect(tx.doOperations[0].previousID).toBe("heading-1")

      // 2. 移入 block-a 和 block-b
      expect(tx.doOperations[1]).toEqual({
        action: "move",
        id: "block-a",
        parentID: res.superBlockId,
        previousID: undefined,
      })
      expect(tx.doOperations[2]).toEqual({
        action: "move",
        id: "block-b",
        parentID: res.superBlockId,
        previousID: "block-a",
      })

      // 验证 undoOperations
      expect(tx.undoOperations).toHaveLength(3)
      expect(tx.undoOperations[0].action).toBe("move")
      expect(tx.undoOperations[0].id).toBe("block-a")
      expect(tx.undoOperations[1].action).toBe("move")
      expect(tx.undoOperations[1].id).toBe("block-b")
      expect(tx.undoOperations[2]).toEqual({
        action: "delete",
        id: res.superBlockId,
      })
    })
  })

  describe("executeConvertToSuperBlock - List Items to SuperBlock", () => {
    it("should split selected list items into separate list blocks and merge them into a horizontal superblock (all items)", async () => {
      const listRoot = new MockElement("list-root", "NodeList", ["list"], { "data-subtype": "u" })
      const li1 = new MockElement("li-1", "NodeListItem", ["li", "protyle-wysiwyg--select"])
      const li2 = new MockElement("li-2", "NodeListItem", ["li", "protyle-wysiwyg--select"])
      const li3 = new MockElement("li-3", "NodeListItem", ["li", "protyle-wysiwyg--select"])
      listRoot.appendChild(li1)
      listRoot.appendChild(li2)
      listRoot.appendChild(li3)
      mockEditor.appendChild(listRoot)

      const performTxSpy = vi.spyOn(api, "performTransactions").mockResolvedValue({ code: 0, data: null })

      const res = await executeConvertToSuperBlock({
        currentDocId: "doc-root",
        activeBlockId: "li-1",
      })

      expect(res.success).toBe(true)
      expect(res.colCount).toBe(3)
      expect(res.superBlockId).toBeDefined()

      expect(performTxSpy).toHaveBeenCalledTimes(1)
      const tx = performTxSpy.mock.calls[0][0][0]

      // doOperations:
      // 1. insert sb
      // 2. insert list-1, move li-1
      // 3. insert list-2, move li-2
      // 4. insert list-3, move li-3
      // 5. delete original list-root
      expect(tx.doOperations).toHaveLength(8)
      expect(tx.doOperations[0].action).toBe("insert")
      expect(tx.doOperations[0].data).toContain('data-sb-layout="col"')

      // 各独立列表块继承无序列表 subtype="u"
      expect(tx.doOperations[1].action).toBe("insert")
      expect(tx.doOperations[1].data).toContain('data-type="NodeList"')
      expect(tx.doOperations[1].data).toContain('data-subtype="u"')
      expect(tx.doOperations[2]).toEqual({
        action: "move",
        id: "li-1",
        parentID: tx.doOperations[1].id,
      })

      expect(tx.doOperations[3].action).toBe("insert")
      expect(tx.doOperations[4]).toEqual({
        action: "move",
        id: "li-2",
        parentID: tx.doOperations[3].id,
      })

      expect(tx.doOperations[5].action).toBe("insert")
      expect(tx.doOperations[6]).toEqual({
        action: "move",
        id: "li-3",
        parentID: tx.doOperations[5].id,
      })

      expect(tx.doOperations[7]).toEqual({
        action: "delete",
        id: "list-root",
      })

      // 验证撤销操作完整性
      expect(tx.undoOperations?.some(op => op.action === "insert" && op.id === "list-root")).toBe(true)
      expect(tx.undoOperations?.some(op => op.action === "delete" && op.id === res.superBlockId)).toBe(true)
    })

    it("should support selecting the whole NodeList block directly and auto-split all direct items", async () => {
      const listOrdered = new MockElement("list-ordered", "NodeList", ["list", "protyle-wysiwyg--select"], { "data-subtype": "o" })
      const oli1 = new MockElement("oli-1", "NodeListItem", ["li"])
      const oli2 = new MockElement("oli-2", "NodeListItem", ["li"])
      listOrdered.appendChild(oli1)
      listOrdered.appendChild(oli2)
      mockEditor.appendChild(listOrdered)

      const performTxSpy = vi.spyOn(api, "performTransactions").mockResolvedValue({ code: 0, data: null })

      const res = await executeConvertToSuperBlock({
        currentDocId: "doc-root",
        activeBlockId: "list-ordered",
      })

      expect(res.success).toBe(true)
      expect(res.colCount).toBe(2)

      const tx = performTxSpy.mock.calls[0][0][0]
      // 验证有序列表类型被继承 (subtype="o")
      const listInsertOps = tx.doOperations.filter(op => op.action === "insert" && op.data?.includes('data-type="NodeList"'))
      expect(listInsertOps).toHaveLength(2)
      expect(listInsertOps[0].data).toContain('data-subtype="o"')
      expect(listInsertOps[1].data).toContain('data-subtype="o"')
    })

    it("should handle partial list item selection without deleting the remaining list", async () => {
      const listRoot = new MockElement("list-root", "NodeList", ["list"], { "data-subtype": "u" })
      const li1 = new MockElement("li-1", "NodeListItem", ["li"])
      const li2 = new MockElement("li-2", "NodeListItem", ["li", "protyle-wysiwyg--select"])
      const li3 = new MockElement("li-3", "NodeListItem", ["li", "protyle-wysiwyg--select"])
      listRoot.appendChild(li1)
      listRoot.appendChild(li2)
      listRoot.appendChild(li3)
      mockEditor.appendChild(listRoot)

      const performTxSpy = vi.spyOn(api, "performTransactions").mockResolvedValue({ code: 0, data: null })

      const res = await executeConvertToSuperBlock({
        currentDocId: "doc-root",
        activeBlockId: "li-2",
      })

      expect(res.success).toBe(true)
      expect(res.colCount).toBe(2)

      const tx = performTxSpy.mock.calls[0][0][0]
      // 原列表不得被删除
      expect(tx.doOperations.some(op => op.action === "delete" && op.id === "list-root")).toBe(false)
      // 超级块插入在原列表之后
      expect(tx.doOperations[0].previousID).toBe("list-root")
    })

    it("should return error when selection does not meet criteria", async () => {
      const singleP = new MockElement("single-p", "NodeParagraph", ["p"])
      mockEditor.appendChild(singleP)

      const res = await executeConvertToSuperBlock({
        currentDocId: "doc-root",
        activeBlockId: "single-p",
      })
      expect(res.success).toBe(false)
      expect(res.error).toContain("请在编辑区选中多个块")
    })
  })
})
