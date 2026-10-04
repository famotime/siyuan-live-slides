import { describe, expect, it } from "vitest"

/**
 * 演示配置面板的纯函数状态机与标签辅助解析器
 */
export function resolveInspectorTarget(
  activeBlockId: string,
  activeBlockType: string,
  currentDocId: string,
) {
  const isDivider = activeBlockType === "NodeThematicBreak"
  const isDocRoot = !activeBlockId || activeBlockId === currentDocId || activeBlockType === "doc" || activeBlockType === "NodeDocument"
  const isCodeBlock = activeBlockType === "NodeCodeBlock"

  const id = activeBlockId || currentDocId || ""
  const displayShortId = id.length > 8 ? id.slice(-8) : id || "无"

  let targetTagLabel = "内容块"
  let targetTagClass = "tag-block"

  if (isDivider) {
    targetTagLabel = "分页符 (---)"
    targetTagClass = "tag-divider"
  } else if (isDocRoot) {
    targetTagLabel = "全局文档"
    targetTagClass = "tag-doc"
  } else {
    switch (activeBlockType) {
      case "NodeHeading": targetTagLabel = "标题块"; break
      case "NodeParagraph": targetTagLabel = "段落块"; break
      case "NodeCodeBlock": targetTagLabel = "代码块"; break
      case "NodeList":
      case "NodeListItem": targetTagLabel = "列表项"; break
      case "NodeBlockquote": targetTagLabel = "引述块"; break
      case "NodeTable": targetTagLabel = "表格块"; break
      default: targetTagLabel = "内容块"; break
    }
  }

  return {
    isDivider,
    isDocRoot,
    isCodeBlock,
    displayShortId,
    targetTagLabel,
    targetTagClass,
  }
}

describe("Inspector State Machine (演示配置面板状态推断)", () => {
  it("当激活块为 NodeThematicBreak 时应正确识别为分页符状态", () => {
    const state = resolveInspectorTarget("block-div-12345678", "NodeThematicBreak", "doc-root-999")
    expect(state.isDivider).toBe(true)
    expect(state.isDocRoot).toBe(false)
    expect(state.targetTagLabel).toBe("分页符 (---)")
    expect(state.targetTagClass).toBe("tag-divider")
    expect(state.displayShortId).toBe("12345678")
  })

  it("当未聚焦具体块或聚焦文档根时应正确识别为全局文档状态", () => {
    const state1 = resolveInspectorTarget("", "", "doc-root-12345678")
    expect(state1.isDocRoot).toBe(true)
    expect(state1.isDivider).toBe(false)
    expect(state1.targetTagLabel).toBe("全局文档")
    expect(state1.targetTagClass).toBe("tag-doc")

    const state2 = resolveInspectorTarget("doc-root-12345678", "NodeDocument", "doc-root-12345678")
    expect(state2.isDocRoot).toBe(true)
    expect(state2.targetTagLabel).toBe("全局文档")

    // 光标在文档标题时派发的 doc 类型
    const stateTitle = resolveInspectorTarget("doc-root-12345678", "doc", "doc-root-12345678")
    expect(stateTitle.isDocRoot).toBe(true)
    expect(stateTitle.isDivider).toBe(false)
    expect(stateTitle.targetTagLabel).toBe("全局文档")
    expect(stateTitle.targetTagClass).toBe("tag-doc")
  })

  it("当聚焦普通内容块时应根据具体 blockType 返回对应标签与短 ID", () => {
    const stateCode = resolveInspectorTarget("b-code-12345678", "NodeCodeBlock", "doc-root")
    expect(stateCode.isCodeBlock).toBe(true)
    expect(stateCode.targetTagLabel).toBe("代码块")
    expect(stateCode.targetTagClass).toBe("tag-block")

    const stateHeading = resolveInspectorTarget("b-head-12345678", "NodeHeading", "doc-root")
    expect(stateHeading.targetTagLabel).toBe("标题块")

    const stateQuote = resolveInspectorTarget("b-quote-12345678", "NodeBlockquote", "doc-root")
    expect(stateQuote.targetTagLabel).toBe("引述块")
  })

  it("当 ID 极短或为空时安全处理", () => {
    const state = resolveInspectorTarget("123", "NodeParagraph", "")
    expect(state.displayShortId).toBe("123")

    const empty = resolveInspectorTarget("", "", "")
    expect(empty.displayShortId).toBe("无")
  })

  describe("Block Slot & Layout Inference (多栏与三栏插槽状态推断及恢复)", () => {
    it("当 currentSlideLayout 为 three-cols-header 时展示三栏插槽选项", () => {
      const state = resolveBlockSlotState("three-cols-header", "")
      expect(state.effectiveLayout).toBe("three-cols-header")
      expect(state.isMultiColsLayout).toBe(true)
      expect(state.slotControlTitle).toBe("三栏插槽归属 (Slot)")
      expect(state.actionButtonText).toBe("设为第1栏")
      expect(state.availableSlots).toEqual([
        { value: "header", label: "表头" },
        { value: "col-1", label: "第 1 栏" },
        { value: "col-2", label: "第 2 栏" },
        { value: "col-3", label: "第 3 栏" },
      ])
    })

    it("当切换操作返回该页面且 currentSlideLayout 降级为 default，但块自身保留 col-1 插槽时，应智能推断恢复为 three-cols-header 并呈现三栏选项而非双栏", () => {
      const state = resolveBlockSlotState("default", "col-1")
      expect(state.effectiveLayout).toBe("three-cols-header")
      expect(state.isMultiColsLayout).toBe(true)
      expect(state.slotControlTitle).toBe("三栏插槽归属 (Slot)")
      expect(state.actionButtonText).toBe("设为第1栏")
      expect(state.availableSlots.map(s => s.value)).toEqual(["header", "col-1", "col-2", "col-3"])
      expect(state.isSlotActive("col-1")).toBe(true)
      expect(state.isSlotActive("header")).toBe(false)
      // 在三栏模式下严禁错误激活 left
      expect(state.isSlotActive("left")).toBe(false)
    })

    it("当块为 col-2 或 col-3 时同样正确锁定为 three-cols-header", () => {
      const stateCol2 = resolveBlockSlotState("", "col-2")
      expect(stateCol2.effectiveLayout).toBe("three-cols-header")
      expect(stateCol2.isSlotActive("col-2")).toBe(true)

      const stateCol3 = resolveBlockSlotState("two-cols", "col-3")
      expect(stateCol3.effectiveLayout).toBe("three-cols-header")
      expect(stateCol3.isSlotActive("col-3")).toBe(true)
    })

    it("双栏布局依然正常保持双栏选项", () => {
      const stateTwoCols = resolveBlockSlotState("two-cols", "right")
      expect(stateTwoCols.effectiveLayout).toBe("two-cols")
      expect(stateTwoCols.actionButtonText).toBe("设为双栏")
      expect(stateTwoCols.isSlotActive("right")).toBe(true)
    })
  })
})

/**
 * 块检查器（BlockInspectorSection）的分栏与插槽推断模型
 */
export function resolveBlockSlotState(currentSlideLayout: string, elemSlot: string) {
  const effectiveLayout = ['col-1', 'col-2', 'col-3'].includes(elemSlot)
    ? 'three-cols-header'
    : (currentSlideLayout || '')

  const isMultiColsLayout = ['two-cols', 'two-cols-header', 'three-cols-header'].includes(effectiveLayout)

  const slotControlTitle = effectiveLayout === 'three-cols-header'
    ? '三栏插槽归属 (Slot)'
    : effectiveLayout === 'two-cols-header'
    ? '带表头双栏插槽 (Slot)'
    : '多栏插槽归属 (Slot)'

  let availableSlots: Array<{ value: string; label: string }> = []
  if (effectiveLayout === 'three-cols-header') {
    availableSlots = [
      { value: 'header', label: '表头' },
      { value: 'col-1', label: '第 1 栏' },
      { value: 'col-2', label: '第 2 栏' },
      { value: 'col-3', label: '第 3 栏' },
    ]
  } else if (effectiveLayout === 'two-cols-header') {
    availableSlots = [
      { value: 'header', label: '表头' },
      { value: 'left', label: '左栏' },
      { value: 'right', label: '右栏' },
    ]
  } else if (effectiveLayout === 'two-cols') {
    availableSlots = [
      { value: '', label: '默认 (左)' },
      { value: 'right', label: '右栏' },
    ]
  } else {
    availableSlots = [
      { value: '', label: '默认' },
      { value: 'header', label: '表头' },
      { value: 'left', label: '左栏' },
      { value: 'right', label: '右栏' },
    ]
  }

  const isSlotActive = (val: string) => {
    if (!val) return !elemSlot || elemSlot === 'default'
    if (elemSlot === val) return true
    if (effectiveLayout === 'three-cols-header') return false
    if (val === 'col-1' && elemSlot === 'left') return true
    if (val === 'col-2' && elemSlot === 'center') return true
    if (val === 'col-3' && elemSlot === 'right') return true
    if (val === 'left' && elemSlot === 'col-1') return true
    if (val === 'right' && elemSlot === 'col-2') return true
    return false
  }

  const actionButtonText = effectiveLayout === 'three-cols-header' ? '设为第1栏' : '设为双栏'

  return {
    effectiveLayout,
    isMultiColsLayout,
    slotControlTitle,
    availableSlots,
    isSlotActive,
    actionButtonText,
  }
}
