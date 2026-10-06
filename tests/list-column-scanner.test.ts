import { describe, expect, it } from "vitest"
import {
  detectListSuperBlock,
  extractListSuperBlockItems,
  extractListUnits,
  isInvalidListSuperBlock,
  scanAndTagListSuperBlocks,
} from "../src/compiler/list-column-scanner"
import type { ISiYuanBlockNode } from "../src/types/slidev-protocol"

describe("ListColumnScanner (多栏列表超级块扫描与槽位分配)", () => {
  it("extractListUnits 应正确提取列表或横向分栏中的独立列表项单元", () => {
    const listNode: ISiYuanBlockNode = {
      id: "l1",
      type: "l",
      children: [
        { id: "i1", type: "i", content: "第一项" },
        { id: "i2", type: "i", content: "第二项" },
      ],
    }
    const units = extractListUnits(listNode)
    expect(units.length).toBe(2)
    expect(units[0].id).toBe("i1")
    expect(units[1].id).toBe("i2")
  })

  it("detectListSuperBlock 应正确识别 2 栏至 4 栏横向列表超级块为 cols-header", () => {
    const sb2: ISiYuanBlockNode = {
      id: "sb2",
      type: "s",
      subType: "col",
      children: [
        { id: "i1", type: "i", content: "列 1" },
        { id: "i2", type: "i", content: "列 2" },
      ],
    }
    const det2 = detectListSuperBlock(sb2)
    expect(det2).not.toBeNull()
    expect(det2?.count).toBe(2)
    expect(det2?.layout).toBe("cols-header")
    expect(det2?.slots).toEqual(["col-1", "col-2"])

    const sb3: ISiYuanBlockNode = {
      id: "sb3",
      type: "s",
      subType: "col",
      children: [
        { id: "i1", type: "i", content: "列 1" },
        { id: "i2", type: "i", content: "列 2" },
        { id: "i3", type: "i", content: "列 3" },
      ],
    }
    const det3 = detectListSuperBlock(sb3)
    expect(det3).not.toBeNull()
    expect(det3?.count).toBe(3)
    expect(det3?.layout).toBe("cols-header")
    expect(det3?.slots).toEqual(["col-1", "col-2", "col-3"])

    const sb4: ISiYuanBlockNode = {
      id: "sb4",
      type: "s",
      subType: "col",
      children: [
        { id: "i1", type: "i", content: "列 1" },
        { id: "i2", type: "i", content: "列 2" },
        { id: "i3", type: "i", content: "列 3" },
        { id: "i4", type: "i", content: "列 4" },
      ],
    }
    const det4 = detectListSuperBlock(sb4)
    expect(det4).not.toBeNull()
    expect(det4?.count).toBe(4)
    expect(det4?.layout).toBe("cols-header")
    expect(det4?.slots).toEqual(["col-1", "col-2", "col-3", "col-4"])
  })

  it("isInvalidListSuperBlock 应识别超出 2~6 栏范围或项数不足的异常形态", () => {
    const sb1: ISiYuanBlockNode = {
      id: "sb1",
      type: "s",
      subType: "col",
      children: [{ id: "i1", type: "i", content: "单列" }],
    }
    expect(isInvalidListSuperBlock(sb1)).not.toBeNull()

    // 4 栏属于合法有效范围 (2~6 栏)
    const sb4: ISiYuanBlockNode = {
      id: "sb4",
      type: "s",
      subType: "col",
      children: [
        { id: "i1", type: "i", content: "列 1" },
        { id: "i2", type: "i", content: "列 2" },
        { id: "i3", type: "i", content: "列 3" },
        { id: "i4", type: "i", content: "列 4" },
      ],
    }
    expect(isInvalidListSuperBlock(sb4)).toBeNull()

    // 超出 6 栏（如 7 栏）识别为无效/超限
    const sb7: ISiYuanBlockNode = {
      id: "sb7",
      type: "s",
      subType: "col",
      children: Array.from({ length: 7 }, (_, i) => ({ id: `i${i + 1}`, type: "i", content: `列 ${i + 1}` })),
    }
    expect(isInvalidListSuperBlock(sb7)).not.toBeNull()
  })

  it("scanAndTagListSuperBlocks 应为匹配页面自动注入版式与 header/slots 属性", () => {
    const blocks: ISiYuanBlockNode[] = [
      { id: "doc-head", type: "h", content: "页面标题" },
      {
        id: "sb",
        type: "s",
        subType: "col",
        children: [
          { id: "col-left", type: "i", content: "左栏" },
          { id: "col-right", type: "i", content: "右栏" },
        ],
      },
    ]

    const result = scanAndTagListSuperBlocks("doc-1", blocks)
    expect(result.changes.length).toBeGreaterThan(0)
    expect(result.newTracked.length).toBe(1)
    expect(result.newTracked[0].layout).toBe("cols-header")
    expect(result.newTracked[0].itemIds).toEqual(["col-left", "col-right"])
  })
})
