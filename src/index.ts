import type {
  ICommandContext,
  Plugin,
  Protyle,
} from "siyuan"
import {
  getFrontend,
  openTab,
  Plugin as SyPlugin,
  showMessage,
} from "siyuan"
import { getBlockAttrs, getChildBlocks, insertBlock, setBlockAttrs, sql, chatAI, putFile } from "@/api"
import { analyzeSlideSplits } from "@/ai/auto-splitter"
import { generateSpeakerNotesWithAI } from "@/ai/notes-generator"
import { extractBlockRefs } from "@/compiler/block-ref-resolver"
import { buildSlidevDocument } from "@/compiler/slidev-ast-builder"
import { CliDevServerBridge } from "@/engine/cli-devserver-bridge"
import {
  globalSandboxBridge,
  mountInspectorDock,
  mountPreviewTab,
  navigateDockToBlock,
  unmountInspectorDock,
  unmountPreviewTab,
  updateDockDocument,
  updateInspectorCurrentBlock,
  openDockImportDialog,
} from "@/main"
import { mirrorBlockSelection } from "@/sync/selection-mirror"
import { PropertyManagerBridge } from "@/synergy/property-manager-bridge"
import type { ISlidevDocument, ISiYuanBlockNode } from "@/types/slidev-protocol"
import "@/index.scss"

// 专属 SVG 幻灯片放映图标
const ICON_SLIDEV_SVG = `<symbol id="iconSlidev" viewBox="0 0 1024 1024">
  <path fill="currentColor" d="M128 160h768c35.3 0 64 28.7 64 64v480c0 35.3-28.7 64-64 64H128c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64z m64 64v480h640V224H192z m128 640h384v64H320z"/>
  <path fill="currentColor" d="M416 336l256 144-256 144z"/>
</symbol>`

const DOCK_TYPE = "slidev-dock"
const TAB_TYPE = "slidev-preview-tab"
const STORAGE_NAME = "slidev-config.json"

export default class SiYuanSlidevPlugin extends SyPlugin {
  public isMobile = false
  public currentDocId = ""
  public latestCompiledDoc: ISlidevDocument | null = null
  private cliBridge = new CliDevServerBridge()
  private debounceTimer: number | null = null
  private activeCursorBlockId = ""


  private onSwitchProtyleBound = this.onSwitchProtyle.bind(this)
  private onWsMainBound = this.onWsMain.bind(this)
  private onBlockClickedBound = this.onBlockClickedFromSlide.bind(this)
  private onClickEditorTitleIconBound = this.onClickEditorTitleIcon.bind(this)
  private onEditorClickBound = this.onEditorClick.bind(this)
  private onSelectionChangeBound = this.onSelectionChange.bind(this)

  async onload() {
    const frontEnd = getFrontend()
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"

    // 1. 注册图标
    this.addIcons(ICON_SLIDEV_SVG)

    // 2. 注册顶栏快捷放映入口 (在文档下方分屏)
    this.addTopBar({
      id: "slidev-topbar-play",
      icon: "iconSlidev",
      title: "Slidev 演示 (下方分屏)",
      position: "right",
      callback: () => {
        this.openBottomPreviewTab()
      },
    })

    // 3. 注册命令
    this.addCommand({
      langKey: "slidevPresentation",
      langText: "Slidev: 在文档下方开启分屏演示预览",
      hotkey: "⌥P",
      enabled: () => true,
      execute: () => {
        this.openBottomPreviewTab()
      },
    })

    this.addCommand({
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

    this.addCommand({
      langKey: "slidevInitAttrs",
      langText: "Slidev: 初始化当前文档演示属性",
      hotkey: "",
      enabled: () => true,
      execute: async () => {
        if (!this.currentDocId) {
          const activeEl = document.querySelector(".protyle-content[data-doc-id]")
          this.currentDocId = activeEl?.getAttribute("data-doc-id") || ""
        }
        if (this.currentDocId) {
          await setBlockAttrs(this.currentDocId, {
            "custom-slidev-theme": "default",
            "custom-slidev-aspect-ratio": "16/9",
            "custom-slidev-default-transition": "slide-left",
          })
          showMessage("已为当前文档初始化 Slidev 演示属性")
          this.compileCurrentDocument(this.currentDocId)
        }
      },
    })

    this.addCommand({
      langKey: "slidevAiSplit",
      langText: "Slidev AI: 智能大纲断页建议与自动分页",
      hotkey: "",
      enabled: () => true,
      execute: async () => {
        if (!this.currentDocId) {
          const activeEl = document.querySelector(".protyle-content[data-doc-id]")
          this.currentDocId = activeEl?.getAttribute("data-doc-id") || ""
        }
        if (!this.currentDocId) {
          showMessage("请先打开一篇思源笔记文档")
          return
        }

        const rawBlocks: any[] = await getChildBlocks(this.currentDocId).catch(() => [])
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
        this.compileCurrentDocument(this.currentDocId)
      },
    })

    this.addCommand({
      langKey: "slidevAiNotes",
      langText: "Slidev AI: 自动为当前文档生成演讲者提词卡 (Notes)",
      hotkey: "",
      enabled: () => true,
      execute: async () => {
        if (!this.currentDocId) {
          const activeEl = document.querySelector(".protyle-content[data-doc-id]")
          this.currentDocId = activeEl?.getAttribute("data-doc-id") || ""
        }
        if (!this.currentDocId) {
          showMessage("请先打开一篇思源笔记文档")
          return
        }

        showMessage("正在调用思源 AI 提炼演讲者口播提词...")
        const rawBlocks: any[] = await getChildBlocks(this.currentDocId).catch(() => [])
        const dummySlide = {
          pageIndex: 1,
          startBlockId: this.currentDocId,
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
        await setBlockAttrs(this.currentDocId, { "custom-slidev-notes": notes })
        showMessage("已成功生成口播提词卡并保存至文档属性")
        this.compileCurrentDocument(this.currentDocId)
      },
    })

    this.addCommand({
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

    this.addCommand({
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

    this.addCommand({
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
        this.compileCurrentDocument()
      },
    })

    this.addCommand({
      langKey: "slidevPresenterMode",
      langText: "Slidev: 打开双屏演讲者控制台 (Presenter Mode)",
      hotkey: "⌥M",
      enabled: () => true,
      execute: () => {
        if (typeof window !== "undefined") {
          window.open(
            "/plugins/siyuan-slidev/slidev-client/presenter.html",
            "SlidevPresenter",
            "width=1200,height=800",
          )
        }
      },
    })

    this.addCommand({
      langKey: "slidevExportCliMd",
      langText: "Slidev Pro: 导出 Slidev 标准 slides.md 文档 (下载到本地)",
      hotkey: "",
      enabled: () => true,
      execute: async () => {
        if (!this.latestCompiledDoc) {
          await this.compileCurrentDocument()
        }
        if (!this.latestCompiledDoc) {
          showMessage("请先打开并放映一篇思源笔记文档")
          return
        }
        const ok = this.cliBridge.downloadSlidesMd(this.latestCompiledDoc, `slides-${this.currentDocId || "demo"}.md`)
        if (ok) {
          showMessage("已生成标准 Slidev Markdown 并触发下载，可在本地使用 npx @slidev/cli 运行")
        }
      },
    })

    this.addCommand({
      langKey: "slidevProbeCliDevServer",
      langText: "Slidev Pro: 检测本地 Slidev CLI DevServer 状态 (localhost:3030)",
      hotkey: "",
      enabled: () => true,
      execute: async () => {
        showMessage("正在探测本地 Slidev CLI DevServer (http://localhost:3030)...")
        const alive = await this.cliBridge.probeServer(1500)
        if (alive) {
          showMessage("🟢 本地 Slidev CLI DevServer 运行正常！可直接在浏览器访问 http://localhost:3030")
        } else {
          showMessage("⚪ 未检测到运行中的本地 Slidev CLI DevServer (端口 3030 未开启)")
        }
      },
    })

    this.addCommand({
      langKey: "slidevSyncToCliWorkspace",
      langText: "Slidev Pro: 同步 slides.md 至思源工作空间存储目录",
      hotkey: "",
      enabled: () => true,
      execute: async () => {
        if (!this.latestCompiledDoc) {
          await this.compileCurrentDocument()
        }
        if (!this.latestCompiledDoc) {
          showMessage("请先打开并放映一篇思源笔记文档")
          return
        }
        const res = await this.cliBridge.syncToWorkspaceFile(
          this.latestCompiledDoc,
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




    // 4. 注册下方分屏预览页签
    const self = this
    this.addTab({
      type: TAB_TYPE,
      init() {
        mountPreviewTab(this.element as HTMLElement, self)
      },
      destroy() {
        unmountPreviewTab(this.element as HTMLElement)
      },
    })

    // 5. 注册右侧 Dock 演示配置面板
    this.addDock({
      config: {
        position: "RightTop",
        size: { width: 320, height: 0 },
        icon: "iconSlidev",
        title: "Slidev 演示配置",
      },
      data: {},
      type: DOCK_TYPE,
      init() {
        mountInspectorDock(this.element as HTMLElement, self)
      },
      destroy() {
        unmountInspectorDock(this.element as HTMLElement)
      },
    })

    // 6. 监听思源内核与编辑器事件
    this.eventBus.on("switch-protyle", this.onSwitchProtyleBound)
    this.eventBus.on("ws-main", this.onWsMainBound)
    this.eventBus.on("slidev:request-compile" as any, () => this.compileCurrentDocument())
    this.eventBus.on("slidev:block-clicked" as any, this.onBlockClickedBound)
    this.eventBus.on("click-editortitleicon", this.onClickEditorTitleIconBound)

    // 7. 监听编辑器选区变动与点击（双向光标联动中枢）
    if (typeof document !== "undefined") {
      document.addEventListener("click", this.onEditorClickBound, true)
      document.addEventListener("selectionchange", this.onSelectionChangeBound)
    }
  }

  async onDataChanged(reason?: "sync" | "overwrite") {
    // 跨端同步或外部文件覆写时轻量重新编译，避免宿主触发全量重载
    if (this.currentDocId) {
      await this.compileCurrentDocument(this.currentDocId)
    }
  }

  onunload() {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.eventBus.off("switch-protyle", this.onSwitchProtyleBound)
    this.eventBus.off("ws-main", this.onWsMainBound)
    this.eventBus.off("click-editortitleicon", this.onClickEditorTitleIconBound)
    if (typeof document !== "undefined") {
      document.removeEventListener("click", this.onEditorClickBound, true)
      document.removeEventListener("selectionchange", this.onSelectionChangeBound)
    }
    globalSandboxBridge.detach()
  }

  /**
   * 在当前文档下方开启分屏演示预览
   */
  public async openBottomPreviewTab(): Promise<void> {
    if (!this.currentDocId) {
      const activeEl = document.querySelector(".protyle-content[data-doc-id]")
      this.currentDocId = activeEl?.getAttribute("data-doc-id") || ""
    }
    await openTab({
      app: this.app,
      custom: {
        id: this.name + TAB_TYPE,
        title: "Slidev 演示预览",
        icon: "iconSlidev",
        data: { docId: this.currentDocId },
      },
      position: "bottom",
    })
    if (this.currentDocId) {
      this.compileCurrentDocument(this.currentDocId)
    }
  }

  /**
   * 监听文档大标题块标菜单，注入全局演示配置项
   */
  private onClickEditorTitleIcon(event: CustomEvent<any>) {
    const detail = event.detail
    const menu = detail?.menu
    const docId = detail?.data?.id || this.currentDocId
    if (!menu || !docId) return

    menu.addItem({
      icon: "iconSlidev",
      label: "Slidev 全局演示配置",
      submenu: [
        {
          label: "初始化演示属性 (custom-slidev-*)",
          click: async () => {
            await setBlockAttrs(docId, {
              "custom-slidev-theme": "default",
              "custom-slidev-aspect-ratio": "16/9",
              "custom-slidev-default-transition": "slide-left",
            })
            showMessage("已为当前文档初始化 Slidev 演示属性")
            this.compileCurrentDocument(docId)
          },
        },
        { type: "separator" },
        {
          label: "主题: 默认 (default)",
          click: async () => {
            await setBlockAttrs(docId, { "custom-slidev-theme": "default" })
            showMessage("已切换为 default 主题")
            this.compileCurrentDocument(docId)
          },
        },
        {
          label: "主题: 优雅衬线 (seriph)",
          click: async () => {
            await setBlockAttrs(docId, { "custom-slidev-theme": "seriph" })
            showMessage("已切换为 seriph 主题")
            this.compileCurrentDocument(docId)
          },
        },
        {
          label: "主题: 苹果极简 (apple-basic)",
          click: async () => {
            await setBlockAttrs(docId, { "custom-slidev-theme": "apple-basic" })
            showMessage("已切换为 apple-basic 主题")
            this.compileCurrentDocument(docId)
          },
        },
        { type: "separator" },
        {
          label: "画幅: 16 / 9 (宽屏)",
          click: async () => {
            await setBlockAttrs(docId, { "custom-slidev-aspect-ratio": "16/9" })
            showMessage("已切换画幅为 16/9")
            this.compileCurrentDocument(docId)
          },
        },
        {
          label: "画幅: 4 / 3 (标屏)",
          click: async () => {
            await setBlockAttrs(docId, { "custom-slidev-aspect-ratio": "4/3" })
            showMessage("已切换画幅为 4/3")
            this.compileCurrentDocument(docId)
          },
        },
      ],
    })
  }

  /**
   * 文档切换钩子
   */
  private onSwitchProtyle(event: CustomEvent<{ protyle: Protyle }>) {
    const protyle = event.detail?.protyle
    const docId = (protyle as any)?.block?.rootID
    if (docId && docId !== this.currentDocId) {
      this.currentDocId = docId
      this.activeCursorBlockId = ""
      updateInspectorCurrentBlock({
        id: "",
        rootId: docId,
        type: "doc",
        attrs: {},
      })
      this.compileCurrentDocument(docId)
    }
  }

  /**
   * WebSocket 事务流监听（150ms 增量防抖）
   */
  private onWsMain(event: CustomEvent<any>) {
    const data = event.detail
    if (!data) return

    // 检查事务是否关联当前打开文档
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = window.setTimeout(() => {
      this.compileCurrentDocument()
    }, 150)
  }

  /**
   * 幻灯片点击回传，定位到思源块
   */
  private onBlockClickedFromSlide(eventData: { blockId: string; page: number }) {
    if (!eventData?.blockId) return
    mirrorBlockSelection(eventData.blockId)
  }

  /**
   * 监听编辑器点击事件（点击任意块联动光标并更新右侧演示配置面板）
   */
  private onEditorClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (!target) return

    // 仅在思源正文编辑区有效
    const protyle = target.closest(".protyle-wysiwyg")
    if (!protyle) return

    const blockEl = target.closest("[data-node-id]") as HTMLElement | null
    if (!blockEl) return

    const blockId = blockEl.getAttribute("data-node-id")
    const blockType = blockEl.getAttribute("data-type") || ""
    if (blockId) {
      if (blockId !== this.activeCursorBlockId) {
        this.activeCursorBlockId = blockId
        navigateDockToBlock(blockId)
      }
      this.syncInspectorBlock(blockEl, blockId, blockType)
    }
  }

  /**
   * 监听选区变化（键盘上下左右移动光标时联动幻灯片与配置面板）
   */
  private onSelectionChange() {
    if (typeof window === "undefined") return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const anchor = sel.anchorNode
    if (!anchor) return

    const el = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement
    if (!el || !el.closest(".protyle-wysiwyg")) return

    const blockEl = el.closest("[data-node-id]") as HTMLElement | null
    const blockId = blockEl?.getAttribute("data-node-id")
    const blockType = blockEl?.getAttribute("data-type") || ""
    if (blockEl && blockId) {
      if (blockId !== this.activeCursorBlockId) {
        this.activeCursorBlockId = blockId
        navigateDockToBlock(blockId)
      }
      this.syncInspectorBlock(blockEl, blockId, blockType)
    }
  }

  /**
   * 同步当前激活块元信息至右侧演示配置面板
   */
  private async syncInspectorBlock(blockEl: HTMLElement, blockId: string, blockType: string) {
    const isDivider = blockType === "NodeThematicBreak"
    const isCode = blockType === "NodeCodeBlock"
    const contentText = blockEl.innerText?.trim() || ""
    const attrs = await getBlockAttrs(blockId).catch(() => ({}))
    updateInspectorCurrentBlock({
      id: blockId,
      rootId: this.currentDocId,
      type: blockType,
      content: contentText,
      attrs,
      isDivider,
      isCode,
    })
  }

  /**
   * 提取并编译当前文档为 Slidev 演示模型，推送给 Dock
   */
  public async compileCurrentDocument(targetDocId?: string): Promise<void> {
    const docId = targetDocId || this.currentDocId
    if (!docId) {
      // 尝试从当前激活编辑器提取
      const activeEl = document.querySelector(".protyle-content[data-doc-id]")
      const inferredId = activeEl?.getAttribute("data-doc-id")
      if (inferredId) {
        this.currentDocId = inferredId
        return this.compileCurrentDocument(inferredId)
      }
      return
    }

    try {
      // 1. 获取文档属性
      const docAttrs = await getBlockAttrs(docId).catch(() => ({}))

      // 2. 优先通过 getChildBlocks 获取按思源文档真实排版顺序排列的所有子块
      let rawBlocks: any[] = await getChildBlocks(docId).catch(() => [])

      // 3. 批量检索当前文档所有块的 IAL 属性字典
      const ialQuery = `SELECT id, ial FROM blocks WHERE root_id = '${docId}'`
      const ialRows = (await sql(ialQuery).catch(() => [])) || []
      const ialMapById = new Map<string, Record<string, string>>()
      for (const row of ialRows) {
        if (row.id && row.ial) {
          ialMapById.set(row.id, this.parseIALString(row.ial))
        }
      }

      // 4. 容错降级：如果 getChildBlocks 为空，从 SQL 回退检索
      if (!rawBlocks || rawBlocks.length === 0) {
        const fallbackSql = `SELECT id, parent_id, root_id, type, sub_type as subType, content, markdown, ial FROM blocks WHERE root_id = '${docId}' AND id != '${docId}' ORDER BY created ASC`
        rawBlocks = (await sql(fallbackSql).catch(() => [])) || []
      }

      // 5. 构造节点数组并反序列化 IAL
      const blockNodes: ISiYuanBlockNode[] = rawBlocks.map((r: any) => {
        const ialMap = ialMapById.get(r.id) || (r.ial ? this.parseIALString(r.ial) : {})
        return {
          id: r.id,
          parent_id: r.parent_id,
          root_id: r.root_id || docId,
          type: r.type,
          subType: r.subType,
          content: r.content || "",
          markdown: r.markdown || "",
          ial: ialMap,
        }
      })

      // 6. 批量检索并解析块引用 ((block-id))
      const allRefIds = new Set<string>()
      for (const node of blockNodes) {
        const text = node.markdown || node.content || ""
        if (text.includes("((")) {
          const refs = extractBlockRefs(text)
          for (const ref of refs) {
            allRefIds.add(ref.blockId)
          }
        }
      }

      const refContentMap: Record<string, string> = {}
      if (allRefIds.size > 0) {
        const quotedIds = Array.from(allRefIds).map(id => `'${id}'`).join(",")
        const refRows = (await sql(`SELECT id, content, markdown FROM blocks WHERE id IN (${quotedIds})`).catch(() => [])) || []
        if (Array.isArray(refRows)) {
          for (const row of refRows) {
            if (row.id) {
              refContentMap[row.id] = row.markdown || row.content || ""
            }
          }
        }
      }

      // 7. 调用核心 AST 编译器
      const baseUrl = typeof location !== "undefined" ? location.origin : ""
      const slidevDoc = buildSlidevDocument(docId, docAttrs, blockNodes, { baseUrl, refContentMap })

      // 8. 推送更新至沙箱与分屏预览
      this.latestCompiledDoc = slidevDoc
      updateDockDocument(slidevDoc, docId)
    } catch (err) {

      console.error("[SiYuanSlidev] Failed to compile document:", err)
    }
  }

  /**
   * 辅助解析数据库中的 IAL 字段文本
   */
  private parseIALString(ialStr: string): Record<string, string> {
    const result: Record<string, string> = {}
    const clean = ialStr.replace(/^\{:\s*/, "").replace(/\s*\}$/, "")
    const regex = /([\w-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(clean)) !== null) {
      const key = match[1]
      const val = match[2] ?? match[3] ?? match[4] ?? ""
      result[key] = val
    }
    return result
  }
}
