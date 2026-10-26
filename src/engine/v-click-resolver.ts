import type { ISlidevBlock } from "../types/slidev-protocol"

export type TClickRuleType = "always" | "step" | "range" | "hide"

export interface IBlockClickRule {
  type: TClickRuleType
  step?: number
  min?: number
  max?: number
}

export interface ISlideClicksPlan {
  maxStep: number
  blockMap: Map<ISlidevBlock, IBlockClickRule>
  idMap: Map<string, IBlockClickRule>
}

/**
 * 解析幻灯片中所有块的 v-click 调度计划 (Single Source of Truth)
 * 严格按照 Slidev 规范与文档顺序递增计算步数，确保顺延 (+1) 逻辑正确生效
 */
export function computeSlideClicksPlan(blocks?: ISlidevBlock[]): ISlideClicksPlan {
  if (!blocks || blocks.length === 0) {
    return { maxStep: 0, blockMap: new Map(), idMap: new Map() }
  }

  const blockMap = new Map<ISlidevBlock, IBlockClickRule>()
  const idMap = new Map<string, IBlockClickRule>()
  const containerBaseStepMap = new Map<string, number>()
  let stepCounter = 0

  const setRule = (b: ISlidevBlock, rule: IBlockClickRule) => {
    blockMap.set(b, rule)
    const bid = b.id || (b as any).blockId
    if (bid) idMap.set(bid, rule)
  }

  // 按页面内块的顺序遍历 (排除纯插槽分界块)
  const validBlocks = blocks.filter(b => b.slot !== "slot-divider-right")

  for (const b of validBlocks) {
    // 1. 若当前块归属于特定主容器 (如分栏列表项)，且容器开启了逐步呈现
    if (b.parentContainerId && b.parentClicks && b.parentClicks.trim() !== "") {
      if (!containerBaseStepMap.has(b.parentContainerId)) {
        const rawParent = String(b.parentClicks).trim()
        if (/^\d+$/.test(rawParent)) {
          const target = parseInt(rawParent, 10)
          stepCounter = Math.max(stepCounter, target)
          containerBaseStepMap.set(b.parentContainerId, target)
        } else {
          stepCounter += 1
          containerBaseStepMap.set(b.parentContainerId, stepCounter)
        }
      }
    }

    const hasSelfClicks = Boolean(b.clicks && String(b.clicks).trim() !== "")

    if (!hasSelfClicks) {
      // 当前块未配置自身 clicks：
      // 若其所属容器已获得基础步长，则作为基础层共享该步长同时呈现；否则始终可见
      if (b.parentContainerId && containerBaseStepMap.has(b.parentContainerId)) {
        const baseStep = containerBaseStepMap.get(b.parentContainerId)!
        setRule(b, { type: "step", step: baseStep })
      } else {
        setRule(b, { type: "always" })
      }
      continue
    }

    const rawStr = String(b.clicks).trim()
    if (!rawStr) {
      // 空字符串但配置了 clicks 属性：等同于顺延 +1
      stepCounter += 1
      setRule(b, { type: "step", step: stepCounter })
      continue
    }

    // 1. 区间定义 [min, max]
    if (rawStr.startsWith("[") && rawStr.endsWith("]")) {
      try {
        const arr = JSON.parse(rawStr)
        if (Array.isArray(arr) && arr.length >= 2) {
          const min = Math.min(Number(arr[0]), Number(arr[1]))
          const max = Math.max(Number(arr[0]), Number(arr[1]))
          if (!isNaN(min) && !isNaN(max)) {
            stepCounter = Math.max(stepCounter, max)
            setRule(b, { type: "range", min, max })
            continue
          }
        }
      } catch {}
    }

    // 2. 隐藏指令 hide
    if (rawStr.toLowerCase() === "hide") {
      stepCounter += 1
      setRule(b, { type: "hide", step: stepCounter })
      continue
    }

    // 3. 相对步进 +N (如 "+1", "+2") 或布尔值 "true"
    if (/^\+\d+$/.test(rawStr) || rawStr === "true") {
      const delta = rawStr === "true" ? 1 : (parseInt(rawStr.slice(1), 10) || 1)
      stepCounter += delta
      setRule(b, { type: "step", step: stepCounter })
      continue
    }

    // 4. 相对回退 -N (如 "-1")
    if (/^-\d+$/.test(rawStr)) {
      const delta = parseInt(rawStr.slice(1), 10) || 1
      stepCounter = Math.max(1, stepCounter - delta)
      setRule(b, { type: "step", step: stepCounter })
      continue
    }

    // 5. 绝对步数 N (如 "1", "2", "3")
    if (/^\d+$/.test(rawStr)) {
      const target = parseInt(rawStr, 10)
      if (!isNaN(target)) {
        stepCounter = Math.max(stepCounter, target)
        setRule(b, { type: "step", step: target })
        continue
      }
    }

    // 6. 其他兜底解析
    const parsedNum = parseInt(rawStr, 10)
    if (!isNaN(parsedNum) && parsedNum > 0) {
      stepCounter = Math.max(stepCounter, parsedNum)
      setRule(b, { type: "step", step: parsedNum })
    } else {
      // 无法解析的非空字符，默认作为顺延一步处理
      stepCounter += 1
      setRule(b, { type: "step", step: stepCounter })
    }
  }

  return {
    maxStep: stepCounter,
    blockMap,
    idMap,
  }
}

/**
 * 判断块在当前 step 下的显隐 class
 */
export function getBlockClickStatus(
  block: ISlidevBlock,
  currentStep: number,
  plan: ISlideClicksPlan,
): "v-click-visible" | "v-click-hidden" {
  if (!block) return "v-click-visible"
  const bid = block.id || (block as any).blockId
  const rule = plan.blockMap.get(block) || (bid ? plan.idMap.get(bid) : null)
  if (!rule || rule.type === "always") {
    return "v-click-visible"
  }

  if (rule.type === "range") {
    return (currentStep >= rule.min! && currentStep <= rule.max!)
      ? "v-click-visible"
      : "v-click-hidden"
  }

  if (rule.type === "hide") {
    return currentStep < rule.step!
      ? "v-click-visible"
      : "v-click-hidden"
  }

  if (rule.type === "step") {
    return currentStep >= rule.step!
      ? "v-click-visible"
      : "v-click-hidden"
  }

  return "v-click-visible"
}
