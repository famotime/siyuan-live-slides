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
  const isDocRoot = !activeBlockId || activeBlockId === currentDocId
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
})
