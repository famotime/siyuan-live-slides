import { describe, expect, it } from "vitest"
import { computeSlideClicksPlan, getBlockClickStatus } from "../src/engine/v-click-resolver"
import type { ISlidevBlock } from "../src/types/slidev-protocol"

describe("v-click Resolver (逐步呈现调度计划解析器)", () => {
  it("应该正确让连续顺延 (+1) 部件依次递增呈现，而不是随上一个部件一起出现", () => {
    const blocks: ISlidevBlock[] = [
      { id: "b1", type: "p", content: "第一条论点", rawMarkdown: "第一条论点", clicks: "+1" },
      { id: "b2", type: "p", content: "第二条论点", rawMarkdown: "第二条论点", clicks: "+1" },
      { id: "b3", type: "p", content: "第三条论点", rawMarkdown: "第三条论点", clicks: "+1" },
    ]

    const plan = computeSlideClicksPlan(blocks)

    // 总步数应为 3
    expect(plan.maxStep).toBe(3)

    // b1 应在 step 1 出现，b2 应在 step 2 出现，b3 应在 step 3 出现
    expect(plan.idMap.get("b1")).toEqual({ type: "step", step: 1 })
    expect(plan.idMap.get("b2")).toEqual({ type: "step", step: 2 })
    expect(plan.idMap.get("b3")).toEqual({ type: "step", step: 3 })

    // Step 0: 全隐
    expect(getBlockClickStatus(blocks[0], 0, plan)).toBe("v-click-hidden")
    expect(getBlockClickStatus(blocks[1], 0, plan)).toBe("v-click-hidden")
    expect(getBlockClickStatus(blocks[2], 0, plan)).toBe("v-click-hidden")

    // Step 1: b1 出现，b2、b3 仍隐藏
    expect(getBlockClickStatus(blocks[0], 1, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[1], 1, plan)).toBe("v-click-hidden")
    expect(getBlockClickStatus(blocks[2], 1, plan)).toBe("v-click-hidden")

    // Step 2: b1, b2 出现，b3 仍隐藏
    expect(getBlockClickStatus(blocks[0], 2, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[1], 2, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[2], 2, plan)).toBe("v-click-hidden")

    // Step 3: 全部出现
    expect(getBlockClickStatus(blocks[0], 3, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[1], 3, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[2], 3, plan)).toBe("v-click-visible")
  })

  it("当包含无动效的静态标题与后续顺延部件时，静态标题始终可见且顺延部件从第 1 步起算", () => {
    const blocks: ISlidevBlock[] = [
      { id: "title", type: "h", content: "大标题", rawMarkdown: "# 大标题" },
      { id: "item1", type: "p", content: "项目 1", rawMarkdown: "项目 1", clicks: "+1" },
      { id: "item2", type: "p", content: "项目 2", rawMarkdown: "项目 2", clicks: "+1" },
    ]

    const plan = computeSlideClicksPlan(blocks)
    expect(plan.maxStep).toBe(2)

    // 大标题始终可见
    expect(getBlockClickStatus(blocks[0], 0, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[0], 1, plan)).toBe("v-click-visible")

    // item1 在第 1 步出现
    expect(getBlockClickStatus(blocks[1], 0, plan)).toBe("v-click-hidden")
    expect(getBlockClickStatus(blocks[1], 1, plan)).toBe("v-click-visible")

    // item2 在第 2 步出现
    expect(getBlockClickStatus(blocks[2], 1, plan)).toBe("v-click-hidden")
    expect(getBlockClickStatus(blocks[2], 2, plan)).toBe("v-click-visible")
  })

  it("显式绝对步数与顺延混合时，顺延部件应在绝对步数之后顺延呈现", () => {
    const blocks: ISlidevBlock[] = [
      { id: "b1", type: "p", content: "第 1 步部件", rawMarkdown: "第 1 步部件", clicks: "1" },
      { id: "b2", type: "p", content: "顺延部件", rawMarkdown: "顺延部件", clicks: "+1" },
    ]

    const plan = computeSlideClicksPlan(blocks)
    expect(plan.maxStep).toBe(2)

    expect(plan.idMap.get("b1")?.step).toBe(1)
    expect(plan.idMap.get("b2")?.step).toBe(2)

    // Step 1: 仅 b1 显示，b2 不显示（修复顺延随上一个部件一起出现的 Bug）
    expect(getBlockClickStatus(blocks[0], 1, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[1], 1, plan)).toBe("v-click-hidden")

    // Step 2: b2 显示
    expect(getBlockClickStatus(blocks[1], 2, plan)).toBe("v-click-visible")
  })

  it("绝对步数为 2 与后续顺延混合时，顺延部件应在第 3 步呈现", () => {
    const blocks: ISlidevBlock[] = [
      { id: "b1", type: "p", content: "第 2 步部件", rawMarkdown: "第 2 步部件", clicks: "2" },
      { id: "b2", type: "p", content: "顺延部件", rawMarkdown: "顺延部件", clicks: "+1" },
    ]

    const plan = computeSlideClicksPlan(blocks)
    expect(plan.maxStep).toBe(3)

    expect(plan.idMap.get("b1")?.step).toBe(2)
    expect(plan.idMap.get("b2")?.step).toBe(3)

    expect(getBlockClickStatus(blocks[0], 1, plan)).toBe("v-click-hidden")
    expect(getBlockClickStatus(blocks[1], 1, plan)).toBe("v-click-hidden")

    expect(getBlockClickStatus(blocks[0], 2, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[1], 2, plan)).toBe("v-click-hidden")

    expect(getBlockClickStatus(blocks[0], 3, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[1], 3, plan)).toBe("v-click-visible")
  })

  it("支持区间 [min, max] 语法并在区间外隐藏", () => {
    const blocks: ISlidevBlock[] = [
      { id: "b1", type: "p", content: "区间部件", rawMarkdown: "区间部件", clicks: "[2, 4]" },
      { id: "b2", type: "p", content: "顺延部件", rawMarkdown: "顺延部件", clicks: "+1" },
    ]

    const plan = computeSlideClicksPlan(blocks)
    expect(plan.maxStep).toBe(5)

    expect(plan.idMap.get("b1")).toEqual({ type: "range", min: 2, max: 4 })
    expect(plan.idMap.get("b2")).toEqual({ type: "step", step: 5 })

    expect(getBlockClickStatus(blocks[0], 1, plan)).toBe("v-click-hidden")
    expect(getBlockClickStatus(blocks[0], 2, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[0], 3, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[0], 4, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[0], 5, plan)).toBe("v-click-hidden") // 超过区间后隐藏

    expect(getBlockClickStatus(blocks[1], 4, plan)).toBe("v-click-hidden")
    expect(getBlockClickStatus(blocks[1], 5, plan)).toBe("v-click-visible")
  })

  it("支持 hide 隐藏指令（初始可见，点击到达时隐藏）", () => {
    const blocks: ISlidevBlock[] = [
      { id: "b1", type: "p", content: "临时提醒", rawMarkdown: "临时提醒", clicks: "hide" },
      { id: "b2", type: "p", content: "替代内容", rawMarkdown: "替代内容", clicks: "+1" },
    ]

    const plan = computeSlideClicksPlan(blocks)
    expect(plan.maxStep).toBe(2)

    // b1 在 step 0 初始可见，step 1 时隐藏
    expect(getBlockClickStatus(blocks[0], 0, plan)).toBe("v-click-visible")
    expect(getBlockClickStatus(blocks[0], 1, plan)).toBe("v-click-hidden")
    expect(getBlockClickStatus(blocks[0], 2, plan)).toBe("v-click-hidden")

    // b2 在 step 2 时呈现
    expect(getBlockClickStatus(blocks[1], 1, plan)).toBe("v-click-hidden")
    expect(getBlockClickStatus(blocks[1], 2, plan)).toBe("v-click-visible")
  })

  it("忽略 slot-divider-right 虚拟分栏块", () => {
    const blocks: ISlidevBlock[] = [
      { id: "left1", type: "p", content: "左栏", rawMarkdown: "左栏", clicks: "+1" },
      { id: "div", type: "p", content: ":::", rawMarkdown: ":::", slot: "slot-divider-right" },
      { id: "right1", type: "p", content: "右栏", rawMarkdown: "右栏", clicks: "+1" },
    ]

    const plan = computeSlideClicksPlan(blocks)
    expect(plan.maxStep).toBe(2)
    expect(plan.idMap.get("left1")?.step).toBe(1)
    expect(plan.idMap.get("right1")?.step).toBe(2)
  })
})
