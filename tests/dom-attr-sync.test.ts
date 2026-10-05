import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { syncDomBlockAttrs, syncBatchDomBlockAttrs, purgeStaleDomSlidevAttrs } from "../src/sync/dom-attr-sync"
import { ATTR_PAGE_LAYOUT, ATTR_PAGE_TRANSITION, ATTR_ELEM_CLICK, ATTR_ELEM_ROLE } from "../src/types/slidev-protocol"

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
      if (name === "data-node-id") return this.nodeId
      if (name === "data-type") return this.type
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
        if (sel.includes("custom-slidev-layout") || sel.includes("custom-slidev-role")) {
          return mockElements.filter(el =>
            el.hasAttribute("custom-slidev-layout") ||
            el.hasAttribute("custom-slidev-role")
          )
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
      purgeStaleDomSlidevAttrs(new Map())
    }).not.toThrow()
  })

  it("当分隔行 (NodeThematicBreak) 去除 image-right 自定义属性时，DOM 属性应被彻底移除 (removeAttribute)", () => {
    const dividerId = "20261005110000-divider"
    const dividerEl = createMockElement(dividerId, "NodeThematicBreak", {
      "custom-slidev-layout": "image-right",
    })
    mockElements.push(dividerEl)

    expect(dividerEl.hasAttribute("custom-slidev-layout")).toBe(true)
    expect(dividerEl.getAttribute("custom-slidev-layout")).toBe("image-right")

    // 模拟属性置空/去除
    syncDomBlockAttrs(dividerId, { [ATTR_PAGE_LAYOUT]: "" })

    expect(dividerEl.hasAttribute("custom-slidev-layout")).toBe(false)
    expect(dividerEl.getAttribute("custom-slidev-layout")).toBeNull()
  })

  it("当列表项 (NodeListItem) 及其子段落去除 image-right 时，DOM 属性应被彻底清除", () => {
    const liId = "20261005110001-li"
    const paraId = "20261005110002-para"

    const liEl = createMockElement(liId, "NodeListItem", {
      "custom-slidev-layout": "image-right",
    })
    const paraEl = createMockElement(paraId, "NodeParagraph", {
      "custom-slidev-layout": "image-right",
    })
    mockElements.push(liEl, paraEl)

    // 验证初始状态均带有 image-right
    expect(liEl.getAttribute("custom-slidev-layout")).toBe("image-right")
    expect(paraEl.getAttribute("custom-slidev-layout")).toBe("image-right")

    // 模拟列表项及内部段落去除版式属性
    syncDomBlockAttrs(liId, { [ATTR_PAGE_LAYOUT]: "", [ATTR_ELEM_ROLE]: "" })
    syncDomBlockAttrs(paraId, { [ATTR_PAGE_LAYOUT]: "", [ATTR_ELEM_ROLE]: "" })

    expect(liEl.hasAttribute("custom-slidev-layout")).toBe(false)
    expect(paraEl.hasAttribute("custom-slidev-layout")).toBe(false)
  })

  it("purgeStaleDomSlidevAttrs 应全量巡检并自愈清理已不在有效集合中的孤立 DOM 属性与角标", () => {
    const staleDividerId = "stale-divider"
    const staleLiId = "stale-li"
    const validBlockId = "valid-block"

    // 创建残存旧属性的 DOM 元素
    const staleDividerEl = createMockElement(staleDividerId, "NodeThematicBreak", {
      "custom-slidev-layout": "image-right",
    })
    const staleLiEl = createMockElement(staleLiId, "NodeListItem", {
      "custom-slidev-layout": "image-right",
      "custom-slidev-role": "background",
    })
    const validEl = createMockElement(validBlockId, "NodeParagraph", {
      "custom-slidev-layout": "image-left",
    })
    mockElements.push(staleDividerEl, staleLiEl, validEl)

    // 有效映射中仅保留 validBlockId 为 image-left，staleDividerId 与 staleLiId 均无属性
    const validMap = new Map<string, Record<string, string>>()
    validMap.set(validBlockId, { [ATTR_PAGE_LAYOUT]: "image-left" })

    // 执行全量自愈巡检清理
    purgeStaleDomSlidevAttrs(validMap)

    // 验证：残存的分隔行和列表项属性被彻底清理
    expect(staleDividerEl.hasAttribute("custom-slidev-layout")).toBe(false)
    expect(staleLiEl.hasAttribute("custom-slidev-layout")).toBe(false)
    expect(staleLiEl.hasAttribute("custom-slidev-role")).toBe(false)

    // 验证：合法的块保留属性
    expect(validEl.getAttribute("custom-slidev-layout")).toBe("image-left")
  })
})
