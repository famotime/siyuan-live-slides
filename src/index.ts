import type {
  ICommandContext,
  Plugin,
  Protyle,
} from "siyuan"
import {
  getFrontend,
  Plugin as SyPlugin,
  showMessage,
} from "siyuan"
import { getBlockAttrs, getChildBlocks, insertBlock, setBlockAttrs, sql, chatAI } from "@/api"
import { analyzeSlideSplits } from "@/ai/auto-splitter"
import { generateSpeakerNotesWithAI } from "@/ai/notes-generator"
import { extractBlockRefs } from "@/compiler/block-ref-resolver"
import { buildSlidevDocument } from "@/compiler/slidev-ast-builder"
import {
  globalSandboxBridge,
  mountDock,
  navigateDockToBlock,
  unmountDock,
  updateDockDocument,
} from "@/main"
import { mirrorBlockSelection } from "@/sync/selection-mirror"
import { PropertyManagerBridge } from "@/synergy/property-manager-bridge"
import type { ISiYuanBlockNode } from "@/types/slidev-protocol"
import {
  closeCurrentPopover,
  openElementAnimBar,
  openQuickDividerPopover,
} from "@/ui/popover-manager"
import "@/index.scss"

// 专属 SVG 幻灯片放映图标
const ICON_SLIDEV_SVG = `<symbol id="iconSlidev" viewBox="0 0 1024 1024">
  <path fill="currentColor" d="M128 160h768c35.3 0 64 28.7 64 64v480c0 35.3-28.7 64-64 64H128c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64z m64 64v480h640V224H192z m128 640h384v64H320z"/>
  <path fill="currentColor" d="M416 336l256 144-256 144z"/>
</symbol>`

const DOCK_TYPE = "slidev-dock"
const STORAGE_NAME = "slidev-config.json"

export default class SiYuanSlidevPlugin extends SyPlugin {
  public isMobile = false
  public currentDocId = ""
  private debounceTimer: number | null = null
  private activeCursorBlockId = ""

  private onSwitchProtyleBound = this.onSwitchProtyle.bind(this)
  private onWsMainBound = this.onWsMain.bind(this)
  private onBlockClickedBound = this.onBlockClickedFromSlide.bind(this)
  private onClickBlockIconBound = this.onClickBlockIcon.bind(this)
  private onClickEditorTitleIconBound = this.onClickEditorTitleIcon.bind(this)
  private onEditorClickBound = this.onEditorClick.bind(this)
  private onSelectionChangeBound = this.onSelectionChange.bind(this)

  async onload() {
    const frontEnd = getFrontend()
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"

    // 1. 注册图标
    this.addIcons(ICON_SLIDEV_SVG)

    // 2. 注册顶栏快捷放映入口
    this.addTopBar({
      id: "slidev-topbar-play",
      icon: "iconSlidev",
      title: "Slidev 演示",
      position: "right",
      callback: () => {
        this.compileCurrentDocument()
      },
    })

    // 3. 注册命令
    this.addCommand({
      langKey: "slidevPresentation",
      hotkey: "⌥P",
      hotkeys: ["⌥P", "Alt+P"],
      enabled: () => true,
      execute: () => {
        this.compileCurrentDocument()
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
        if (!rows || rows.length === 0) {
          showMessage("全库目前暂无已设置 Slidev 转场效果的块")
          return
        }
        const summary = rows.map((r: any) => `${r.value}: ${r.count} 个`).join("，")
        showMessage(`全库 Slidev 转场分布统计：${summary}`)
      },
    })

    // 4. 注册右侧 Dock 分屏预览面板
    const self = this
    this.addDock({
      config: {
        position: "RightTop",
        size: { width: 360, height: 0 },
        icon: "iconSlidev",
        title: "Slidev 演示",
      },
      data: {},
      type: DOCK_TYPE,
      init() {
        mountDock(this.element as HTMLElement, self)
      },
      destroy() {
        unmountDock(this.element as HTMLElement)
      },
    })

    // 5. 监听思源内核与编辑器事件
    this.eventBus.on("switch-protyle", this.onSwitchProtyleBound)
    this.eventBus.on("ws-main", this.onWsMainBound)
    this.eventBus.on("slidev:request-compile" as any, () => this.compileCurrentDocument())
    this.eventBus.on("slidev:block-clicked" as any, this.onBlockClickedBound)
    this.eventBus.on("click-blockicon", this.onClickBlockIconBound)
    this.eventBus.on("click-editortitleicon", this.onClickEditorTitleIconBound)

    // 6. 监听编辑器选区变动与点击（双向光标联动中枢）
    if (typeof document !== "undefined") {
      document.addEventListener("click", this.onEditorClickBound, true)
      document.addEventListener("selectionchange", this.onSelectionChangeBound)
    }
  }

  onunload() {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.eventBus.off("switch-protyle", this.onSwitchProtyleBound)
    this.eventBus.off("ws-main", this.onWsMainBound)
    this.eventBus.off("click-blockicon", this.onClickBlockIconBound)
    this.eventBus.off("click-editortitleicon", this.onClickEditorTitleIconBound)
    if (typeof document !== "undefined") {
      document.removeEventListener("click", this.onEditorClickBound, true)
      document.removeEventListener("selectionchange", this.onSelectionChangeBound)
    }
    closeCurrentPopover()
    globalSandboxBridge.detach()
  }

  /**
   * 监听块标右键上下文菜单，注入 Slidev 版式与动效快捷操作
   */
  private onClickBlockIcon(event: CustomEvent<any>) {
    const detail = event.detail
    const menu = detail?.menu
    const blockElements = detail?.blockElements as HTMLElement[]
    if (!menu || !blockElements || blockElements.length === 0) return

    const targetEl = blockElements[0]
    const blockId = targetEl.getAttribute("data-node-id")
    const blockType = targetEl.getAttribute("data-type")
    if (!blockId) return

    const isDivider = blockType === "NodeThematicBreak"

    const submenu: any[] = []

    if (isDivider) {
      submenu.push(
        {
          icon: "iconEdit",
          label: "⚡ 打开幻灯片页面设置气泡",
          click: async () => {
            const attrs = await getBlockAttrs(blockId).catch(() => ({}))
            openQuickDividerPopover(targetEl, blockId, attrs, () => {
              this.compileCurrentDocument()
            })
          },
        },
        { type: "separator" },
      )
    } else {
      const isCode = blockType === "NodeCodeBlock"
      submenu.push(
        {
          icon: "iconPlay",
          label: "✨ 打开动效与排版浮动条",
          click: async () => {
            const attrs = await getBlockAttrs(blockId).catch(() => ({}))
            openElementAnimBar(targetEl, blockId, isCode, attrs, () => {
              this.compileCurrentDocument()
            })
          },
        },
        { type: "separator" },
      )
    }

    submenu.push(
      {
        icon: "iconLayout",
        label: "版式: 🎯 封面 (cover)",
        click: async () => {
          await setBlockAttrs(blockId, { "custom-slidev-layout": "cover" })
          showMessage("已设置版式为封面 (cover)")
          this.compileCurrentDocument()
        },
      },
      {
        icon: "iconLayout",
        label: "版式: 📄 标准 (default)",
        click: async () => {
          await setBlockAttrs(blockId, { "custom-slidev-layout": "default" })
          showMessage("已设置版式为标准 (default)")
          this.compileCurrentDocument()
        },
      },
      {
        icon: "iconLayout",
        label: "版式: ▥ 双栏对比 (two-cols)",
        click: async () => {
          await setBlockAttrs(blockId, { "custom-slidev-layout": "two-cols" })
          showMessage("已设置版式为双栏对比 (two-cols)")
          this.compileCurrentDocument()
        },
      },
      {
        icon: "iconLayout",
        label: "版式: 🔢 大字报 (fact)",
        click: async () => {
          await setBlockAttrs(blockId, { "custom-slidev-layout": "fact" })
          showMessage("已设置版式为大字报 (fact)")
          this.compileCurrentDocument()
        },
      },
      {
        icon: "iconLayout",
        label: "版式: 🀄 居中 (center)",
        click: async () => {
          await setBlockAttrs(blockId, { "custom-slidev-layout": "center" })
          showMessage("已设置版式为居中 (center)")
          this.compileCurrentDocument()
        },
      },
      { type: "separator" },
      {
        icon: "iconRefresh",
        label: "转场: ↔ 向左滑入 (slide-left)",
        click: async () => {
          await setBlockAttrs(blockId, { "custom-slidev-transition": "slide-left" })
          showMessage("已设置转场为向左滑入 (slide-left)")
          this.compileCurrentDocument()
        },
      },
      {
        icon: "iconRefresh",
        label: "转场: 🌫 淡入淡出 (fade)",
        click: async () => {
          await setBlockAttrs(blockId, { "custom-slidev-transition": "fade" })
          showMessage("已设置转场为淡入淡出 (fade)")
          this.compileCurrentDocument()
        },
      },
    )

    if (!isDivider) {
      submenu.push(
        { type: "separator" },
        {
          icon: "iconPlay",
          label: "动效: 逐步出现 (v-click)",
          click: async () => {
            await setBlockAttrs(blockId, { "custom-slidev-click": "+1" })
            showMessage("已添加逐步出现动效 (v-click)")
            this.compileCurrentDocument()
          },
        },
        {
          icon: "iconSplit",
          label: "多栏插槽: 放入右栏 (::right::)",
          click: async () => {
            await setBlockAttrs(blockId, { "custom-slidev-slot": "right" })
            showMessage("已设为右栏内容")
            this.compileCurrentDocument()
          },
        },
      )
    }

    menu.addItem({
      icon: "iconSlidev",
      label: isDivider ? "Slidev 分页设置" : "Slidev 元素设置",
      submenu,
    })
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
    const docId = protyle?.block?.rootID
    if (docId && docId !== this.currentDocId) {
      this.currentDocId = docId
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
   * 监听编辑器点击事件（点击分割线唤起气泡，点击任意块联动光标）
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
    if (blockId && blockId !== this.activeCursorBlockId) {
      this.activeCursorBlockId = blockId
      navigateDockToBlock(blockId)
    }

    // 若点击的是水平分割线，弹出快捷气泡
    const isDivider = blockEl.getAttribute("data-type") === "NodeThematicBreak"
    if (isDivider && blockId) {
      setTimeout(async () => {
        const attrs = await getBlockAttrs(blockId).catch(() => ({}))
        openQuickDividerPopover(blockEl, blockId, attrs, () => {
          this.compileCurrentDocument()
        })
      }, 50)
    }
  }

  /**
   * 监听选区变化（键盘上下左右移动光标时联动幻灯片）
   */
  private onSelectionChange() {
    if (typeof window === "undefined") return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const anchor = sel.anchorNode
    if (!anchor) return

    const el = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement
    if (!el || !el.closest(".protyle-wysiwyg")) return

    const blockEl = el.closest("[data-node-id]")
    const blockId = blockEl?.getAttribute("data-node-id")
    if (blockId && blockId !== this.activeCursorBlockId) {
      this.activeCursorBlockId = blockId
      navigateDockToBlock(blockId)
    }
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

      // 8. 推送更新至沙箱
      updateDockDocument(slidevDoc)
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
