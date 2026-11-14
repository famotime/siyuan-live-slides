import { confirm, showMessage } from "siyuan"
import { deleteBlock, getChildBlocks, insertBlock, setBlockAttrs } from "@/api"
import { analyzeSlideSplits } from "@/ai/auto-splitter"
import { ATTR_PAGE_LAYOUT, ATTR_PAGE_SLIDE } from "@/types/slides-protocol"
import type { ISiYuanBlockNode } from "@/types/slides-protocol"

/** 智能分页动作所需的最小宿主能力（ISlidesPluginHost 结构性子集） */
export interface IAiAutoSplitHost {
  currentDocId: string
  compileCurrentDocument(docId?: string): Promise<void>
}

/**
 * 智能大纲断页建议与自动分页核心回调。
 * 独立成模块以便命令面板与 Dock「智能分页」按钮直接复用
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
    showMessage("智能分析完毕：当前文档结构合理，暂无新增分页建议")
    return
  }

  showMessage(`智能分析完毕：发现 ${suggestions.length} 处建议分页点，正在自动插入分页线...`)
  let inserted = 0
  for (const sug of suggestions) {
    try {
      // nextID 传入 sug.blockId，将分页线插入到该标题块之前（上方），把标题归为下一页
      await insertBlock("markdown", "---", sug.blockId, undefined)
      await setBlockAttrs(sug.blockId, { "custom-slides-layout": sug.recommendedLayout })
      inserted++
    } catch (e) {
      console.warn("Failed to insert divider:", e)
    }
  }
  showMessage(`已成功在 ${inserted} 处插入分页线并重新编译`)
  plugin.compileCurrentDocument(plugin.currentDocId)
}

/**
 * 一键清除当前文档中的所有幻灯片分页线（物理分隔符）与自动版式属性
 */
export async function clearSlideDividers(plugin: IAiAutoSplitHost): Promise<void> {
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
    showMessage("当前文档无内容")
    return
  }

  const blocksToDelete: string[] = []
  const blocksToClearAttrs: string[] = []

  for (const b of rawBlocks) {
    const isDividerBlock =
      b.type === "tb" ||
      b.type === "thematic-break" ||
      b.type === "NodeThematicBreak" ||
      b.markdown?.trim() === "---" ||
      b.markdown?.trim() === "***" ||
      (b.type === "b" && (b.markdown?.trim() === "---" || b.content?.trim() === "---"))

    if (isDividerBlock) {
      blocksToDelete.push(b.id)
    } else if (b.ial?.[ATTR_PAGE_SLIDE] || b.ial?.[ATTR_PAGE_LAYOUT]) {
      blocksToClearAttrs.push(b.id)
    }
  }

  if (blocksToDelete.length === 0 && blocksToClearAttrs.length === 0) {
    showMessage("当前文档中未发现需要清除的幻灯片分页线")
    return
  }

  const dividerCount = blocksToDelete.length

  return new Promise((resolve) => {
    confirm(
      "危险操作：清除所有分页线",
      `此操作将从正文中彻底删除全部 ${dividerCount} 处幻灯片分页线（全篇将合并为单页），删除后无法撤销。是否确认继续？`,
      async () => {
        showMessage(`正在清除文档中的 ${dividerCount} 处分页线...`)
        let deleted = 0
        for (const id of blocksToDelete) {
          try {
            await deleteBlock(id)
            deleted++
          } catch (e) {
            console.warn("Failed to delete divider block:", e)
          }
        }

        for (const id of blocksToClearAttrs) {
          try {
            await setBlockAttrs(id, { [ATTR_PAGE_SLIDE]: "", [ATTR_PAGE_LAYOUT]: "" })
          } catch (e) {
            console.warn("Failed to clear slide attrs:", e)
          }
        }

        showMessage(`已成功清除文档中的 ${deleted} 处分页线并重新编译`)
        await plugin.compileCurrentDocument(plugin.currentDocId)
        resolve()
      },
      () => {
        resolve()
      }
    )
  })
}

/** 智能分页函数别名（语义化去 AI） */
export const runAutoSplit = runAiAutoSplit
