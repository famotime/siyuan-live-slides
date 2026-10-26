import type { Plugin } from "siyuan"
import { showMessage } from "siyuan"
import {
  getChildBlocks,
  insertBlock,
  appendBlock,
  setBlockAttrs,
  sql,
  chatAI,
  putFile,
} from "@/api"
import { analyzeSlideSplits } from "@/ai/auto-splitter"
import { generateSpeakerNotesWithAI } from "@/ai/notes-generator"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { openDockImportDialog } from "@/main"
import { mirrorBlockSelection } from "@/sync/selection-mirror"
import { PropertyManagerBridge } from "@/synergy/property-manager-bridge"
import type { ISiYuanBlockNode, ISlidevDocument } from "@/types/slidev-protocol"
import type { CliDevServerBridge } from "@/engine/cli-devserver-bridge"

export interface ISlidevPluginHost extends Plugin {
  currentDocId: string
  latestCompiledDoc: ISlidevDocument | null
  cliBridge: CliDevServerBridge
  openBottomPreviewTab(): Promise<void>
  openPresenterTab(): Promise<void>
  compileCurrentDocument(docId?: string): Promise<void>
}

/**
 * 集中注册 Slidev 插件的所有快捷指令与动作回调
 */
export function registerPluginCommands(plugin: ISlidevPluginHost): void {
  // 1. 下方分屏演示预览
  plugin.addCommand({
    langKey: "slidevPresentation",
    langText: "Slidev: 在文档下方开启分屏演示预览",
    hotkey: "⌥P",
    enabled: () => true,
    execute: () => {
      plugin.openBottomPreviewTab()
    },
  })

  // 2. 导入演示文档
  plugin.addCommand({
    langKey: "slidevImport",
    langText: "Slidev: 导入 Slidev 演示文档 (.md / .zip)",
    hotkey: "⌥I",
    enabled: () => true,
    execute: () => {
      const opened = openDockImportDialog()
      if (!opened) {
        showMessage("请先在右侧栏打开「Slidev 演示配置」Dock 面板以呼起导入窗口")
      }
    },
  })

  // 3. 初始化当前文档演示属性
  plugin.addCommand({
    langKey: "slidevInitAttrs",
    langText: "Slidev: 初始化当前文档演示属性",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      if (!plugin.currentDocId) {
        const activeEl = document.querySelector(".protyle-content[data-doc-id]")
        plugin.currentDocId = activeEl?.getAttribute("data-doc-id") || ""
      }
      if (plugin.currentDocId) {
        await setBlockAttrs(plugin.currentDocId, {
          "custom-slidev-theme": "default",
          "custom-slidev-aspect-ratio": "16/9",
          "custom-slidev-default-transition": "slide-left",
        })
        showMessage("已为当前文档初始化 Slidev 演示属性")
        plugin.compileCurrentDocument(plugin.currentDocId)
      }
    },
  })

  // 4. AI 智能大纲断页建议与自动分页
  plugin.addCommand({
    langKey: "slidevAiSplit",
    langText: "Slidev AI: 智能大纲断页建议与自动分页",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      if (!plugin.currentDocId) {
        const activeEl = document.querySelector(".protyle-content[data-doc-id]")
        plugin.currentDocId = activeEl?.getAttribute("data-doc-id") || ""
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
          await setBlockAttrs(sug.blockId, { "custom-slidev-layout": sug.recommendedLayout })
          inserted++
        } catch (e) {
          console.warn("Failed to insert divider:", e)
        }
      }
      showMessage(`已成功在 ${inserted} 处插入分页线并重新编译`)
      plugin.compileCurrentDocument(plugin.currentDocId)
    },
  })

  // 5. AI 自动为当前文档生成演讲者提词卡
  plugin.addCommand({
    langKey: "slidevAiNotes",
    langText: "Slidev AI: 自动为当前文档生成演讲者提词卡 (Notes)",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      if (!plugin.currentDocId) {
        const activeEl = document.querySelector(".protyle-content[data-doc-id]")
        plugin.currentDocId = activeEl?.getAttribute("data-doc-id") || ""
      }
      if (!plugin.currentDocId) {
        showMessage("请先打开一篇思源笔记文档")
        return
      }

      showMessage("正在调用思源 AI 提炼演讲者口播提词...")
      const rawBlocks: any[] = await getChildBlocks(plugin.currentDocId).catch(() => [])
      const dummySlide = {
        pageIndex: 1,
        startBlockId: plugin.currentDocId,
        frontmatter: {},
        notes: "",
        blocks: rawBlocks.map((r: any) => ({
          id: r.id,
          type: r.type,
          content: r.content || "",
          rawMarkdown: r.markdown || "",
        })),
        rawMarkdown: "",
      }

      const notes = await generateSpeakerNotesWithAI(dummySlide, chatAI)
      const noteLines = notes.split(/\r?\n/).map((l: string) => `> ${l}`).join("\n")
      const noteMd = `> [!NOTE] 💡 演讲备注\n${noteLines}\n{: custom-slidev-note="true"}`
      const appendRes: any = await appendBlock("markdown", noteMd, plugin.currentDocId).catch(() => null)
      const newBlockId = appendRes?.[0]?.doOperations?.[0]?.id || appendRes?.[0]?.id
      if (newBlockId) {
        await setBlockAttrs(newBlockId, { "custom-slidev-note": "true" })
        globalDocumentCompiler.setBlockAttrOverride(newBlockId, { "custom-slidev-note": "true" })
        mirrorBlockSelection(newBlockId, plugin.app)
      }
      showMessage("已成功生成口播提词卡并插入为正文讲稿备注块")
      plugin.compileCurrentDocument(plugin.currentDocId)
    },
  })

  // 6. 统计全库转场效果分布
  plugin.addCommand({
    langKey: "slidevBatchTransitions",
    langText: "Slidev 协同: 统计全库转场效果分布",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      const pmBridge = new PropertyManagerBridge()
      const statsSql = pmBridge.buildTransitionStatsSql()
      const rows = await sql(statsSql).catch(() => [])
      const summaryText = pmBridge.formatTransitionSummary(rows || [])
      showMessage(summaryText)
    },
  })

  // 7. 复制 Slidev 预设属性模板至剪贴板
  plugin.addCommand({
    langKey: "slidevExportTemplates",
    langText: "Slidev 协同: 复制 Slidev 预设属性模板至剪贴板",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      const pmBridge = new PropertyManagerBridge()
      const json = pmBridge.exportTemplatesJson()
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(json)
        showMessage("已将 Slidev 属性模板 JSON 复制至剪贴板，可直接导入属性管家")
      } else {
        showMessage("已生成模板数据（请在控制台查看）：\n" + json)
      }
    },
  })

  // 8. 批量替换全库淡入淡出转场为滑动
  plugin.addCommand({
    langKey: "slidevBatchReplaceTransition",
    langText: "Slidev 协同: 批量替换全库淡入淡出转场为滑动 (fade -> slide-left)",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      const pmBridge = new PropertyManagerBridge()
      const res = await pmBridge.batchUpdateTransitions(
        "fade",
        "slide-left",
        (q: string) => sql(q).catch(() => []),
        (id: string, attrs: Record<string, string>) => setBlockAttrs(id, attrs),
      )
      showMessage(`全库批量替换完成：已将 ${res.updatedCount} 处 fade 转场更新为 slide-left`)
      plugin.compileCurrentDocument()
    },
  })

  // 9. 打开双屏演讲者控制台（以思源页签承载，避免桌面端 window.open 被甩至系统浏览器）
  plugin.addCommand({
    langKey: "slidevPresenterMode",
    langText: "Slidev: 打开双屏演讲者控制台 (Presenter Mode)",
    hotkey: "⌥M",
    enabled: () => true,
    execute: () => {
      plugin.openPresenterTab()
    },
  })

  // 10. 导出 Slidev 标准 slides.md 文档 (下载到本地)
  plugin.addCommand({
    langKey: "slidevExportCliMd",
    langText: "Slidev Pro: 导出 Slidev 标准 slides.md 文档 (下载到本地)",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      if (!plugin.latestCompiledDoc) {
        await plugin.compileCurrentDocument()
      }
      if (!plugin.latestCompiledDoc) {
        showMessage("请先打开并放映一篇思源笔记文档")
        return
      }
      const ok = plugin.cliBridge.downloadSlidesMd(
        plugin.latestCompiledDoc,
        `slides-${plugin.currentDocId || "demo"}.md`,
      )
      if (ok) {
        showMessage("已生成标准 Slidev Markdown 并触发下载，可在本地使用 npx @slidev/cli 运行")
      }
    },
  })

  // 11. 检测本地 Slidev CLI DevServer 状态
  plugin.addCommand({
    langKey: "slidevProbeCliDevServer",
    langText: "Slidev Pro: 检测本地 Slidev CLI DevServer 状态 (localhost:3030)",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      showMessage("正在探测本地 Slidev CLI DevServer (http://localhost:3030)...")
      const alive = await plugin.cliBridge.probeServer(1500)
      if (alive) {
        showMessage("🟢 本地 Slidev CLI DevServer 运行正常！可直接在浏览器访问 http://localhost:3030")
      } else {
        showMessage("⚪ 未检测到运行中的本地 Slidev CLI DevServer (端口 3030 未开启)")
      }
    },
  })

  // 12. 同步 slides.md 至思源工作空间存储目录
  plugin.addCommand({
    langKey: "slidevSyncToCliWorkspace",
    langText: "Slidev Pro: 同步 slides.md 至思源工作空间存储目录",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      if (!plugin.latestCompiledDoc) {
        await plugin.compileCurrentDocument()
      }
      if (!plugin.latestCompiledDoc) {
        showMessage("请先打开并放映一篇思源笔记文档")
        return
      }
      const res = await plugin.cliBridge.syncToWorkspaceFile(
        plugin.latestCompiledDoc,
        "/data/storage/petal/siyuan-slidev/slides.md",
        putFile,
      )
      if (res.success) {
        showMessage(`已成功同步最新 slides.md 至工作空间：${res.path}`)
      } else {
        showMessage(`同步失败：${res.error}`)
      }
    },
  })
}
