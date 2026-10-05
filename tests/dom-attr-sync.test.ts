import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { syncDomBlockAttrs, syncBatchDomBlockAttrs } from "../src/sync/dom-attr-sync"
import { ATTR_PAGE_LAYOUT, ATTR_PAGE_TRANSITION, ATTR_ELEM_CLICK } from "../src/types/slidev-protocol"

interface IMockElement {
  nodeId: string
  type: string
  className: string
  attrs: Record<string, string>
  getAttribute(name: string): string | null
  setAttribute(name: string, val: string): void
  removeAttribute(name: string): void
  hasAttribute(name: string): boolean
}

function createMockElement(id: string, type = "NodeThematicBreak", initialAttrs: Record<string, string> = {}): IMockElement {
  const attrs: Record<string, string> = {
    "data-node-id": id,
    "data-type": type,
    ...initialAttrs,
  }
  return {
    nodeId: id,
    type,
    className: type === "NodeThematicBreak" ? "hr" : "",
    attrs,
    getAttribute(name: string) {
      return this.attrs[name] ?? null
    },
    setAttribute(name: string, val: string) {
      this.attrs[name] = String(val)
    },
    removeAttribute(name: string) {
      delete this.attrs[name]
    },
    hasAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name)
    },
  }
}

describe("DOM Attribute Synchronizer (思源编辑区 DOM 属性实时同步器)", () => {
  let mockElements: IMockElement[] = []
  let originalDocument: any

  beforeEach(() => {
    mockElements = []
    originalDocument = (globalThis as any).document

    ;(globalThis as any).document = {
      querySelectorAll: vi.fn((sel: string) => {
        const match = sel.match(/\[data-node-id="([^"]+)"\]/)
        if (match) {
          const targetId = match[1]
          return mockElements.filter(el => el.nodeId === targetId)
        }
        return []
      }),
    }
  })

  afterEach(() => {
    ;(globalThis as any).document = originalDocument
  })

  it("当水平分割线 (NodeThematicBreak) 从图右 (image-right) 改为标准 (default) 时，DOM 属性应即刻更新，浮动提示选择器不再匹配", () => {
    const dividerId = "20261005100000-divider1"
    const dividerEl = createMockElement(dividerId, "NodeThematicBreak", {
      "custom-slidev-layout": "image-right",
    })
    mockElements.push(dividerEl)

    // 初始状态：带有 image-right 属性
    expect(dividerEl.getAttribute("custom-slidev-layout")).toBe("image-right")

    // 执行属性同步：改为 default (标准)
    syncDomBlockAttrs(dividerId, { [ATTR_PAGE_LAYOUT]: "default" })

    // 验证：DOM 属性已即时更新为 default，浮动提示 [custom-slidev-layout="image-right"] 规则不再命中
    expect(dividerEl.getAttribute("custom-slidev-layout")).toBe("default")
  })

  it("当属性值被置空 (空字符串) 时，DOM 元素上的对应属性应被完全移除", () => {
    const blockId = "20261005100001-block1"
    const blockEl = createMockElement(blockId, "NodeParagraph", {
      "custom-slidev-layout": "image-right",
      "custom-slidev-click": "+1",
    })
    mockElements.push(blockEl)

    syncDomBlockAttrs(blockId, {
      [ATTR_PAGE_LAYOUT]: "",
      [ATTR_ELEM_CLICK]: null as any,
    })

    expect(blockEl.hasAttribute("custom-slidev-layout")).toBe(false)
    expect(blockEl.hasAttribute("custom-slidev-click")).toBe(false)
  })

  it("当版式切换为图左 (image-left) 时，DOM 属性应即刻切换为 image-left", () => {
    const dividerId = "20261005100002-divider2"
    const dividerEl = createMockElement(dividerId, "NodeThematicBreak", {
      "custom-slidev-layout": "image-right",
    })
    mockElements.push(dividerEl)

    syncDomBlockAttrs(dividerId, { [ATTR_PAGE_LAYOUT]: "image-left" })

    expect(dividerEl.getAttribute("custom-slidev-layout")).toBe("image-left")
  })

  it("多窗口/多分屏存在相同 blockId 的多个 DOM 节点时，应全部被同步更新", () => {
    const blockId = "20261005100003-multi"
    const el1 = createMockElement(blockId, "NodeThematicBreak", {
      "custom-slidev-layout": "image-right",
    })
    const el2 = createMockElement(blockId, "NodeThematicBreak", {
      "custom-slidev-layout": "image-right",
    })
    mockElements.push(el1, el2)

    syncDomBlockAttrs(blockId, { [ATTR_PAGE_LAYOUT]: "default" })

    expect(el1.getAttribute("custom-slidev-layout")).toBe("default")
    expect(el2.getAttribute("custom-slidev-layout")).toBe("default")
  })

  it("syncBatchDomBlockAttrs 应支持批量同步多个块的 DOM 属性", () => {
    const idA = "block-a"
    const idB = "block-b"

    const elA = createMockElement(idA, "NodeThematicBreak", {
      "custom-slidev-layout": "image-right",
    })
    const elB = createMockElement(idB, "NodeParagraph", {
      "custom-slidev-transition": "fade",
    })
    mockElements.push(elA, elB)

    syncBatchDomBlockAttrs([
      { id: idA, attrs: { [ATTR_PAGE_LAYOUT]: "default" } },
      { id: idB, attrs: { [ATTR_PAGE_TRANSITION]: "slide-left" } },
    ])

    expect(elA.getAttribute("custom-slidev-layout")).toBe("default")
    expect(elB.getAttribute("custom-slidev-transition")).toBe("slide-left")
  })

  it("防御测试：空 blockId 或不存在的 blockId 不应抛出异常", () => {
    expect(() => {
      syncDomBlockAttrs("", { "custom-slidev-layout": "default" })
      syncDomBlockAttrs("not-exist-id", { "custom-slidev-layout": "default" })
      syncBatchDomBlockAttrs([])
    }).not.toThrow()
  })

  it("在非浏览器环境 (document 为 undefined) 下调用时应安全无报错退出", () => {
    ;(globalThis as any).document = undefined
    expect(() => {
      syncDomBlockAttrs("some-block-id", { "custom-slidev-layout": "default" })
      syncBatchDomBlockAttrs([{ id: "some-block-id", attrs: { "custom-slidev-layout": "default" } }])
    }).not.toThrow()
  })
})
