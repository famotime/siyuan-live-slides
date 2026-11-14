import type { Plugin } from "siyuan"
import { showMessage } from "siyuan"
import {
  getChildBlocks,
  appendBlock,
  setBlockAttrs,
  sql,
} from "@/api"
import { requestAiChat } from "@/ai/ai-service"
import { generateSpeakerNotesWithAI } from "@/ai/notes-generator"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { isFeatureDisabled } from "@/feature-flags/feature-flags"
import { openDockImportDialog } from "@/main"
import { clearSlideDividers, runAiAutoSplit } from "@/plugin/ai-auto-split-action"
import { mirrorBlockSelection } from "@/sync/selection-mirror"
import { PropertyManagerBridge } from "@/synergy/property-manager-bridge"
import { identifyAndNormalizeDocumentNotes } from "@/sync/notes-normalizer"
import { runAutoAnimationForDocument } from "@/sync/auto-animation-normalizer"
import type { ISlidesDocument } from "@/types/slides-protocol"
import { runHeadlessImageExport, resolveDocumentTitle } from "@/export/image-exporter"

export interface ISlidesPluginHost extends Plugin {
  currentDocId: string
  latestCompiledDoc: ISlidesDocument | null
  openBottomPreviewTab(): Promise<void>
  openPresenterTab(): Promise<void>
  compileCurrentDocument(docId?: string): Promise<void>
}

/**
 * 集中注册即现演示插件的所有快捷指令与动作回调
 */
export function registerPluginCommands(plugin: ISlidesPluginHost): void {
  // 1. 下方分屏演示预览
  plugin.addCommand({
    langKey: "slidesPresentation",
    langText: "即现: 在文档下方开启分屏演示预览",
    hotkey: "⌥P",
    enabled: () => true,
    execute: () => {
      plugin.openBottomPreviewTab()
    },
  })

  // 2. 导入演示文档（import 开关关闭时不注册）
  if (!isFeatureDisabled("import")) {
    plugin.addCommand({
      langKey: "slidesImport",
      langText: "即现: 导入 Slidev 演示文档 (.md / .zip)",
      hotkey: "⌥I",
      enabled: () => true,
      execute: () => {
        const opened = openDockImportDialog()
        if (!opened) {
          showMessage("请先在右侧栏打开「即现演示配置」Dock 面板以呼起导入窗口")
        }
      },
    })
  }

  // 3. 初始化当前文档演示属性
  plugin.addCommand({
    langKey: "slidesInitAttrs",
    langText: "即现: 初始化当前文档演示属性",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      if (!plugin.currentDocId) {
        const activeEl = document.querySelector(".protyle-content[data-doc-id]")
        plugin.currentDocId = activeEl?.getAttribute("data-doc-id") || ""
      }
      if (plugin.currentDocId) {
        await setBlockAttrs(plugin.currentDocId, {
          "custom-slides-theme": "default",
          "custom-slides-aspect-ratio": "16/9",
          "custom-slides-default-transition": "slide-left",
        })
        showMessage("已为当前文档初始化即现演示属性")
        plugin.compileCurrentDocument(plugin.currentDocId)
      }
    },
  })

  // 4. 智能大纲断页建议与自动分页（aiScript 开关关闭时不注册）
  if (!isFeatureDisabled("aiScript")) {
    plugin.addCommand({
      langKey: "slidesAiSplit",
      langText: "即现: 智能大纲断页建议与自动分页",
      hotkey: "",
      enabled: () => true,
      execute: () => runAiAutoSplit(plugin),
    })

    plugin.addCommand({
      langKey: "slidesClearDividers",
      langText: "即现: 清除当前文档分页线",
      hotkey: "",
      enabled: () => true,
      execute: () => clearSlideDividers(plugin),
    })
  }

  // 5. AI 自动为当前文档生成演讲者提词卡（aiScript 开关关闭时不注册）
  if (!isFeatureDisabled("aiScript")) {
    plugin.addCommand({
      langKey: "slidesAiNotes",
      langText: "即现 AI: 自动为当前文档生成演讲者提词卡 (Notes)",
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

        const notes = await generateSpeakerNotesWithAI(dummySlide, requestAiChat)
        const noteLines = notes.split(/\r?\n/).map((l: string) => `> ${l}`).join("\n")
        const noteMd = `> [!NOTE] 💡 演讲备注\n${noteLines}\n{: custom-slides-note="true"}`
        const appendRes: any = await appendBlock("markdown", noteMd, plugin.currentDocId).catch(() => null)
        const newBlockId = appendRes?.[0]?.doOperations?.[0]?.id || appendRes?.[0]?.id
        if (newBlockId) {
          await setBlockAttrs(newBlockId, { "custom-slides-note": "true" })
          globalDocumentCompiler.setBlockAttrOverride(newBlockId, { "custom-slides-note": "true" })
          mirrorBlockSelection(newBlockId, plugin.app)
        }
        showMessage("已成功生成口播提词卡并插入为正文讲稿备注块")
        plugin.compileCurrentDocument(plugin.currentDocId)
      },
    })
  }

  // 6. 识别正文讲稿块并规范化
  plugin.addCommand({
    langKey: "slidesIdentifyNotes",
    langText: "即现演示: 识别正文讲稿块并规范化",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      let docId = plugin.currentDocId
      if (!docId) {
        const activeEl = document.querySelector(".protyle-content[data-doc-id]")
        docId = activeEl?.getAttribute("data-doc-id") || ""
        if (docId) {
          plugin.currentDocId = docId
        }
      }
      if (!docId) {
        showMessage("请先在主编辑区打开幻灯片文档")
        return
      }

      await identifyAndNormalizeDocumentNotes(docId, {
        compileFn: async () => {
          await plugin.compileCurrentDocument(docId)
        },
      })
    },
  })

  // 7. 智能配置演示动效
  plugin.addCommand({
    langKey: "slidesAutoAnimate",
    langText: "即现演示: 智能配置演示动效",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      let docId = plugin.currentDocId
      if (!docId) {
        const activeEl = document.querySelector(".protyle-content[data-doc-id]")
        docId = activeEl?.getAttribute("data-doc-id") || ""
        if (docId) {
          plugin.currentDocId = docId
        }
      }
      if (!docId) {
        showMessage("请先在主编辑区打开幻灯片文档")
        return
      }

      await runAutoAnimationForDocument(docId, {
        compileCurrentDocFn: async () => {
          await plugin.compileCurrentDocument(docId)
        },
      })
    },
  })

  // 8. 统计全库转场效果分布
  plugin.addCommand({
    langKey: "slidesBatchTransitions",
    langText: "即现协同: 统计全库转场效果分布",
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

  // 9. 复制即现预设属性模板至剪贴板
  plugin.addCommand({
    langKey: "slidesExportTemplates",
    langText: "即现协同: 复制即现预设属性模板至剪贴板",
    hotkey: "",
    enabled: () => true,
    execute: async () => {
      const pmBridge = new PropertyManagerBridge()
      const json = pmBridge.exportTemplatesJson()
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(json)
        showMessage("已将即现属性模板 JSON 复制至剪贴板，可直接导入属性管家")
      } else {
        showMessage("已生成模板数据（请在控制台查看）：\n" + json)
      }
    },
  })

  // 10. 批量替换全库淡入淡出转场为滑动
  plugin.addCommand({
    langKey: "slidesBatchReplaceTransition",
    langText: "即现协同: 批量替换全库淡入淡出转场为滑动 (fade -> slide-left)",
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

  // 11. 打开双屏演讲者控制台（以思源页签承载，避免桌面端 window.open 被甩至系统浏览器；
  // presenterMode 开关关闭时不注册）
  if (!isFeatureDisabled("presenterMode")) {
    plugin.addCommand({
      langKey: "slidesPresenterMode",
      langText: "即现: 打开双屏演讲者控制台 (Presenter Mode)",
      hotkey: "⌥M",
      enabled: () => true,
      execute: () => {
        plugin.openPresenterTab()
      },
    })
  }

  // 12. 导出幻灯片为图片包 (ZIP)（exportImage 开关关闭时不注册）
  if (!isFeatureDisabled("exportImage")) {
    let isCommandExportingImages = false
    plugin.addCommand({
      langKey: "slidesExportImagesZip",
      langText: "即现: 逐页导出幻灯片为高清图片包 (ZIP)",
      hotkey: "",
      enabled: () => true,
      execute: async () => {
        if (isCommandExportingImages) {
          showMessage("正在导出图片中，请稍候...", 2000)
          return
        }
        if (!plugin.latestCompiledDoc) {
          await plugin.compileCurrentDocument()
        }
        if (!plugin.latestCompiledDoc) {
          showMessage("请先打开并放映一篇思源笔记文档")
          return
        }
        isCommandExportingImages = true
        try {
          showMessage("正在启动后台沙箱并逐页导出幻灯片图片...")
          const doc = plugin.latestCompiledDoc
          const title = await resolveDocumentTitle(doc, plugin.currentDocId, plugin)
          const res = await runHeadlessImageExport(doc, {
            title,
            onProgress: (current, total) => {
              showMessage(`正在导出幻灯片图片 (${current} / ${total})...`, 2000)
            },
          })
          if (res.success) {
            showMessage(`🎉 成功导出 ${res.total || 0} 张幻灯片高清图片并已保存为 ${title}.zip！`, 4000)
          } else {
            showMessage(`导出图片失败：${res.error || "未知异常"}`)
          }
        } finally {
          isCommandExportingImages = false
        }
      },
    })
  }
}
