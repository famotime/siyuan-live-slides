import { showMessage } from "siyuan"
import { getChildBlocks, insertBlock, setBlockAttrs } from "@/api"
import { analyzeSlideSplits } from "@/ai/auto-splitter"
import type { ISiYuanBlockNode } from "@/types/slides-protocol"

/** AI 智能分页动作所需的最小宿主能力（ISlidesPluginHost 结构性子集） */
export interface IAiAutoSplitHost {
  currentDocId: string
  compileCurrentDocument(docId?: string): Promise<void>
}

/**
 * AI 智能大纲断页建议与自动分页核心回调。
 * 独立成模块以便命令面板与 Dock「AI 智能分页」按钮直接复用
 * （思源 Plugin 类没有 executeCommand，不能经命令转发触发）。
 */
export async function runAiAutoSplit(plugin: IAiAutoSplitHost): Promise<void> {
  if (!plugin.currentDocId) {
    if (typeof document !== "undefined") {
      const activeEl = document.querySelector(".protyle-content[data-doc-id]")
      plugin.currentDocId = activeEl?.getAttribute("data-doc-id") || ""
    }
  }
  if (!plugin.currentDocId) {
    showMessage("请先打开一篇思源笔记文档")
    return
  }

  const rawBlocks: any[] = await getChildBlocks(plugin.currentDocId).catch(() => [])
  if (!rawBlocks || rawBlocks.length === 0) {
    showMessage("当前文档无内容，无需断页")
    return
  }

  const nodes: ISiYuanBlockNode[] = rawBlocks.map((r: any) => ({
    id: r.id,
    type: r.type,
    subType: r.subType,
    content: r.content || "",
    markdown: r.markdown || "",
  }))

  const suggestions = analyzeSlideSplits(nodes)
  if (suggestions.length === 0) {
    showMessage("AI 分析完毕：当前文档篇幅合理，暂无分页建议")
    return
  }

  showMessage(`AI 分析完毕：发现 ${suggestions.length} 处建议分页点，正在自动插入分页分割线...`)
  let inserted = 0
  for (const sug of suggestions) {
    try {
      await insertBlock("markdown", "---", undefined, sug.blockId)
      await setBlockAttrs(sug.blockId, { "custom-slides-layout": sug.recommendedLayout })
      inserted++
    } catch (e) {
      console.warn("Failed to insert divider:", e)
    }
  }
  showMessage(`已成功在 ${inserted} 处插入分页线并重新编译`)
  plugin.compileCurrentDocument(plugin.currentDocId)
}
