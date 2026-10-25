import type {
  Protyle,
} from "siyuan"
import {
  getFrontend,
  openTab,
  Plugin as SyPlugin,
  showMessage,
} from "siyuan"
import { getBlockAttrs, setBlockAttrs, sql } from "@/api"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { CliDevServerBridge } from "@/engine/cli-devserver-bridge"
import {
  globalSandboxBridge,
  mountInspectorDock,
  getPreviewTabInstance,
  mountPreviewTab,
  navigateDockToBlock,
  unmountInspectorDock,
  unmountPreviewTab,
  updateDockDocument,
  updateInspectorCurrentBlock,
} from "@/main"
import { registerPluginCommands } from "@/plugin/command-registry"
import type { ISlidevPluginHost } from "@/plugin/command-registry"
import { globalInspectorSyncCoordinator } from "@/sync/inspector-sync-coordinator"
import { globalCompileConsumerGate, HIDDEN_CONSUMER_COMPILE_DELAY_MS } from "@/sync/compile-consumer-gate"
import { CompileScheduler } from "@/sync/compile-scheduler"
import { InspectorSyncThrottle } from "@/sync/inspector-sync-cache"
import type { ISlidevDocument } from "@/types/slidev-protocol"
import "@/index.scss"

/** 自动编译防抖时长：编辑器事务停歇该时长后才向内核发起编译 */
const AUTO_COMPILE_DEBOUNCE_MS = 150

// 专属 SVG 幻灯片放映图标
const ICON_SLIDEV_SVG = `<symbol id="iconSlidev" viewBox="0 0 1024 1024">
  <path fill="currentColor" d="M128 160h768c35.3 0 64 28.7 64 64v480c0 35.3-28.7 64-64 64H128c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64z m64 64v480h640V224H192z m128 640h384v64H320z"/>
  <path fill="currentColor" d="M416 336l256 144-256 144z"/>
</symbol>`

import {
  DEFAULT_GLOBAL_SETTINGS,
  getRuntimeSettings,
  normalizeGlobalSettings,
  setRuntimeSettings,
  SETTINGS_STORAGE_NAME,
} from "./settings"
import type { ISlidevGlobalSettings } from "./settings"

const DOCK_TYPE = "slidev-dock"
const TAB_TYPE = "slidev-preview-tab"
const STORAGE_NAME = SETTINGS_STORAGE_NAME

export default class SiYuanSlidevPlugin extends SyPlugin implements ISlidevPluginHost {
  public isMobile = false
  public currentDocId = ""
  public previewTab: any = null
  public latestCompiledDoc: ISlidevDocument | null = null
  public cliBridge = new CliDevServerBridge()
  private debounceTimer: number | null = null
  private activeCursorBlockId = ""
  // P0 优化：编译消费者门闩 + 脏文档 + 单飞/代际调度
  private compileScheduler = new CompileScheduler()
  private dirtyDocId: string | null = null
  /** 光标联动节流：同一块的重复触发在时间窗内只同步一次 */
  private inspectorSyncThrottle = new InspectorSyncThrottle()

  private onSwitchProtyleBound = this.onSwitchProtyle.bind(this)
  private onWsMainBound = this.onWsMain.bind(this)
  private onBlockClickedBound = this.onBlockClickedFromSlide.bind(this)
  private onClickEditorTitleIconBound = this.onClickEditorTitleIcon.bind(this)
  private onEditorClickBound = this.onEditorClick.bind(this)
  private onSelectionChangeBound = this.onSelectionChange.bind(this)
  private onClickEditorContentBound = this.onClickEditorContent.bind(this)
  private onVisibilityChangeBound = this.onVisibilityChange.bind(this)

  async onload() {
    const frontEnd = getFrontend()
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"

    // 0. 加载全局持久化配置
    await this.loadGlobalSettings()

    // 1. 注册图标
    this.addIcons(ICON_SLIDEV_SVG)

    // 2. 注册顶栏快捷放映入口 (在文档下方分屏)
    this.addTopBar({
      id: "slidev-topbar-play",
      icon: "iconSlidev",
      title: "即现演示",
      position: "right",
      callback: () => {
        this.openBottomPreviewTab()
      },
    })

    // 3. 集中注册 12 项命令
    registerPluginCommands(this)

    // 4. 注册下方分屏预览页签
    const self = this
    this.addTab({
      type: TAB_TYPE,
      init(custom) {
        const customObj = this || custom
        self.previewTab = (customObj as any)?.tab || null
        mountPreviewTab((customObj as any).element as HTMLElement, self)
        void self.updatePreviewTabHeader()
      },
      destroy() {
        if (self.previewTab === (this as any)?.tab) {
          self.previewTab = null
        }
        unmountPreviewTab((this as any).element as HTMLElement)
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
    if (this.eventBus && typeof (this.eventBus as any).emit !== "function") {
      (this.eventBus as any).emit = (type: string, detail?: any) => {
        try {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(`siyuan-event-${type}`, { detail }))
          }
        } catch {}
      }
    }
    this.eventBus.on("switch-protyle", this.onSwitchProtyleBound)
    this.eventBus.on("ws-main", this.onWsMainBound)
    this.eventBus.on("slidev:request-compile" as any, () => this.compileCurrentDocument())
    this.eventBus.on("slidev:block-clicked" as any, this.onBlockClickedBound)
    this.eventBus.on("click-editortitleicon", this.onClickEditorTitleIconBound)
    this.eventBus.on("click-editorcontent" as any, this.onClickEditorContentBound)

    // 7. 监听编辑器选区变动与点击（双向光标联动中枢）
    if (typeof document !== "undefined") {
      document.addEventListener("click", this.onEditorClickBound, true)
      document.addEventListener("selectionchange", this.onSelectionChangeBound)
      // 宿主窗口重新可见时补跑期间积压的脏文档编译
      document.addEventListener("visibilitychange", this.onVisibilityChangeBound)
    }

    // 8. 插件启动/重启时自动检测当前主编辑区文档并即时编译
    if (typeof document !== "undefined") {
      const detectAndCompile = () => {
        const docId = this.getActiveDocumentId()
        if (docId) {
          if (docId !== this.currentDocId) {
            this.currentDocId = docId
            void this.updatePreviewTabHeader("", docId)
          }
          if (!this.latestCompiledDoc) {
            this.markCompileDirty(docId)
          }
        }
      }
      setTimeout(detectAndCompile, 300)
      setTimeout(detectAndCompile, 1000)
    }
  }

  async onDataChanged(reason?: "sync" | "overwrite") {
    // 跨端同步或外部配置更新时重新载入全局配置
    await this.loadGlobalSettings()
    // 跨端同步或外部文件覆写时轻量重新编译，避免宿主触发全量重载（交由门闩与防抖决定是否真正编译）
    if (this.currentDocId) {
      this.markCompileDirty(this.currentDocId)
    }
  }

  async loadGlobalSettings(): Promise<ISlidevGlobalSettings> {
    try {
      const stored = await this.loadData(STORAGE_NAME)
      const normalized = normalizeGlobalSettings(stored)
      setRuntimeSettings(normalized)
      return normalized
    } catch {
      setRuntimeSettings(DEFAULT_GLOBAL_SETTINGS)
      return DEFAULT_GLOBAL_SETTINGS
    }
  }

  async saveGlobalSettings(nextSettings?: Partial<ISlidevGlobalSettings>): Promise<ISlidevGlobalSettings> {
    const current = getRuntimeSettings()
    const updated = setRuntimeSettings({
      ...current,
      ...(nextSettings || {}),
    })
    try {
      await this.saveData(STORAGE_NAME, updated)
    } catch (err) {
      console.error("保存 Slidev 全局配置失败", err)
    }
    const docId = this.currentDocId || this.getActiveDocumentId()
    if (docId) {
      this.markCompileDirty(docId)
    }
    return updated
  }

  onunload() {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.compileScheduler.reset()
    this.inspectorSyncThrottle.reset()
    this.dirtyDocId = null
    globalCompileConsumerGate.clear()
    this.eventBus.off("switch-protyle", this.onSwitchProtyleBound)
    this.eventBus.off("ws-main", this.onWsMainBound)
    this.eventBus.off("click-editortitleicon", this.onClickEditorTitleIconBound)
    this.eventBus.off("click-editorcontent" as any, this.onClickEditorContentBound)
    if (typeof document !== "undefined") {
      document.removeEventListener("click", this.onEditorClickBound, true)
      document.removeEventListener("selectionchange", this.onSelectionChangeBound)
      document.removeEventListener("visibilitychange", this.onVisibilityChangeBound)
    }
    globalSandboxBridge.detach()
  }

  /**
   * 宿主窗口可见性变化：重新可见时补跑期间积压的脏文档编译
   */
  private onVisibilityChange() {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      this.flushDirtyCompile()
    }
  }

  /**
   * 在当前文档下方开启分屏演示预览
   */
  public async openBottomPreviewTab(): Promise<void> {
    if (!this.currentDocId) {
      this.currentDocId = this.getActiveDocumentId()
    }
    const initialDocTitle = this.currentDocId ? await this.fetchDocumentTitle(this.currentDocId) : ""
    const initialTitle = this.buildPreviewTabTitle(initialDocTitle)
    await openTab({
      app: this.app,
      custom: {
        id: this.name + TAB_TYPE,
        title: initialTitle,
        icon: "iconSlidev",
        data: { docId: this.currentDocId },
      },
      position: "bottom",
    })
    if (this.currentDocId) {
      this.compileCurrentDocument(this.currentDocId)
    }
    void this.updatePreviewTabHeader(initialDocTitle, this.currentDocId)
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
  private async onSwitchProtyle(event: CustomEvent<{ protyle: Protyle }>) {
    const protyle = event.detail?.protyle
    const docId = (protyle as any)?.block?.rootID
    const docTitle = (protyle as any)?.title?.editElement?.textContent?.trim() || ""
    if (docId && docId !== this.currentDocId) {
      this.currentDocId = docId
      this.activeCursorBlockId = docId
      const attrs = await getBlockAttrs(docId).catch(() => ({}))
      updateInspectorCurrentBlock({
        id: docId,
        rootId: docId,
        type: "doc",
        attrs,
      })
      this.markCompileDirty(docId)
      void this.updatePreviewTabHeader(docTitle, docId)
    }
  }

  /**
   * 监听思源原生 click-editorcontent 事件
   */
  private onClickEditorContent(event: CustomEvent<any>) {
    const detail = event?.detail
    if (!detail) return
    const rootId = detail.protyle?.block?.rootID
    if (rootId && (!this.currentDocId || this.currentDocId !== rootId)) {
      this.currentDocId = rootId
    }
    if (detail.event) {
      this.onEditorClick(detail.event)
    }
  }

  /**
   * 构造预览页签标题
   * 规范：即现（当前文档名称）；文档名称为空时显示“即现”
   */
  public buildPreviewTabTitle(docTitle?: string): string {
    const trimmed = (docTitle || "").trim()
    return trimmed ? `即现（${trimmed}）` : "即现"
  }

  /**
   * 获取指定文档的标题内容
   */
  public async fetchDocumentTitle(docId: string): Promise<string> {
    if (!docId) return ""

    // 1. 优先从 DOM 活跃编辑区或特定文档标题容器提取
    if (typeof document !== "undefined") {
      const titleInput = (
        document.querySelector(`.protyle-title[data-node-id="${docId}"] .protyle-title__input`) ||
        document.querySelector(`.protyle[data-doc-id="${docId}"] .protyle-title__input`) ||
        (this.getActiveDocumentId() === docId ? document.querySelector(".layout__wnd--active .protyle-title__input") : null) ||
        document.querySelector(".protyle-title__input")
      ) as HTMLElement | null
      const domTitle = (titleInput?.innerText || titleInput?.textContent || "").trim()
      if (domTitle) {
        return domTitle
      }
    }

    // 2. 从已编译的当前文档模型提取（若匹配）
    if (this.latestCompiledDoc && this.latestCompiledDoc.docId === docId) {
      const firstSlide = this.latestCompiledDoc.slides?.[0]
      const firstH1 = firstSlide?.blocks?.find((b: any) => b.type === "h" || b.type === "NodeHeading")
      if (firstH1?.content) {
        return firstH1.content.trim()
      }
    }

    // 3. 降级通过内核 SQL 查询 blocks 表文档根块 content
    try {
      const rows = await sql(`SELECT content FROM blocks WHERE id = '${docId}' AND type = 'd' LIMIT 1`).catch(() => [])
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.content) {
        return String(rows[0].content).trim()
      }
    } catch {}

    return ""
  }

  /**
   * 动态更新预览窗口思源 Tab 页签标题
   */
  public async updatePreviewTabHeader(docTitle?: string, targetDocId?: string): Promise<void> {
    // 若预览窗口处于 Pin 锁定状态，非锁定文档的切换不应修改 Tab 标题
    const previewInstance = getPreviewTabInstance()
    const isPinned = Boolean(previewInstance?.isPinned?.value)
    const pinnedId = String(previewInstance?.pinnedDocId?.value || "")
    if (isPinned && pinnedId && targetDocId && targetDocId !== pinnedId) {
      return
    }

    const docId = targetDocId || (isPinned && pinnedId ? pinnedId : this.currentDocId || this.getActiveDocumentId())
    let titleText = (docTitle || "").trim()
    if (!titleText && docId) {
      titleText = await this.fetchDocumentTitle(docId)
    }
    const tabTitle = this.buildPreviewTabTitle(titleText)

    // 1. 调用思源 Tab 官方 API 更新标题
    if (this.previewTab && typeof this.previewTab.updateTitle === "function") {
      this.previewTab.updateTitle(tabTitle)
      if (this.previewTab.headElement) {
        this.previewTab.headElement.setAttribute("title", tabTitle)
      }
      return
    }

    // 2. DOM 兜底更新（遍历思源页签栏）
    if (typeof document !== "undefined") {
      const tabHeaders = Array.from(document.querySelectorAll('.layout-tab-bar .item[data-type="tab-header"]'))
      for (const header of tabHeaders) {
        const textEl = header.querySelector(".item__text")
        const currentText = textEl?.textContent?.trim() || ""
        if (
          currentText.includes("Slidev 演示预览") ||
          currentText.startsWith("即现")
        ) {
          if (textEl) {
            textEl.textContent = tabTitle
          }
          header.setAttribute("title", tabTitle)
          break
        }
      }
    }
  }

  public getActiveDocumentId(): string {
    return globalInspectorSyncCoordinator.getActiveDocumentId()
  }

  public resolveDocIdFromElement(el: HTMLElement): string {
    return globalInspectorSyncCoordinator.resolveDocIdFromElement(el, this.currentDocId)
  }

  public async switchToDocGlobalInspector(docId: string, titleText?: string): Promise<void> {
    if (!docId) return
    this.activeCursorBlockId = docId
    this.currentDocId = docId
    await globalInspectorSyncCoordinator.switchToDocGlobalInspector(docId, titleText)
  }

  /**
   * WebSocket 事务流监听（150ms 增量防抖 + 消费者门闩 + 单飞合并）
   *
   * P0 优化：内核会把所有推送（transactions / savedoc / progress / readystate ...）原样转发给插件，
   * 此前任何一条消息都会触发一次全量编译。这里只对携带内容变更的 transactions 事务做处理，
   * 其余高频非内容消息（尤其每次保存后的 savedoc）一律忽略。
   */
  private onWsMain(event: CustomEvent<any>) {
    const data = event.detail
    if (!data) return
    if (data.cmd !== "transactions") return

    globalInspectorSyncCoordinator.patchThematicBreakTransactions(data)
    this.markCompileDirty()
  }

  /**
   * 登记脏文档并排程一次自动编译（消费者不可见时仅登记，不发请求）
   */
  private markCompileDirty(docId?: string) {
    const target = docId || this.currentDocId || this.getActiveDocumentId()
    if (!target) return
    // 首次编译阶段 currentDocId 可能为空：此处补齐，避免后续结果因 id 缺失被判定为过期
    if (!this.currentDocId) {
      this.currentDocId = target
    }
    this.dirtyDocId = target
    this.scheduleDirtyCompile()
  }

  /**
   * 排程脏文档编译：消费者可见性决定延迟
   * - 消费者全部关闭（none）：只保留脏标记，不发请求
   * - 消费者被宿主隐藏（hidden）：有界低频编译，保证同步不会长时间停摆
   * - 消费者可见（visible）：编辑器静默 AUTO_COMPILE_DEBOUNCE_MS 后编译
   */
  private scheduleDirtyCompile(delay: number = AUTO_COMPILE_DEBOUNCE_MS) {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (!this.dirtyDocId) return

    const visibility = globalCompileConsumerGate.getVisibility()
    if (visibility === "none") {
      // 预览页签与 Dock 均已关闭：只保留脏标记，待消费者重新挂载时补跑
      return
    }
    const effectiveDelay = visibility === "visible" ? delay : Math.max(delay, HIDDEN_CONSUMER_COMPILE_DELAY_MS)

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null
      const docId = this.dirtyDocId
      this.dirtyDocId = null
      if (docId) {
        void this.compileCurrentDocument(docId, { reason: "auto" })
      }
    }, effectiveDelay)
  }

  /**
   * 消费者重新可见（预览页签/Dock 挂载、窗口恢复可见）时立即补跑积压编译
   */
  public flushDirtyCompile() {
    if (!this.dirtyDocId) return
    this.scheduleDirtyCompile(0)
  }

  /**
   * 幻灯片点击回传，反向平滑定位到思源块并同步配置面板
   */
  public handleBlockClickedFromSlide(blockId: string, _page?: number): boolean {
    if (!blockId) return false
    this.activeCursorBlockId = blockId
    return globalInspectorSyncCoordinator.handleBlockClickedFromSlide(
      blockId,
      this.app,
      this.currentDocId,
      this.latestCompiledDoc,
    )
  }

  private onBlockClickedFromSlide(eventData: any) {
    const data = eventData?.detail || eventData
    if (!data?.blockId) return
    this.handleBlockClickedFromSlide(data.blockId, data.page)
  }

  /**
   * 监听编辑器点击事件（点击任意块联动光标并更新右侧演示配置面板）
   */
  private onEditorClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (!target) return

    const titleEl = (target.closest(".protyle-title") || target.closest(".protyle-background")) as HTMLElement | null
    const isDocHeader = Boolean(
      titleEl ||
      (target.closest(".protyle-content") && !target.closest(".protyle-wysiwyg") && !target.closest(".protyle-breadcrumb") && !target.closest(".protyle-gutters"))
    )

    if (isDocHeader) {
      const docId = this.resolveDocIdFromElement(target)
      if (docId) {
        if (this.activeCursorBlockId !== docId) {
          const actualTitleEl = (titleEl || document.querySelector(`.protyle-title[data-node-id="${docId}"]`) || document.querySelector(`.protyle[data-doc-id="${docId}"] .protyle-title`)) as HTMLElement | null
          const titleInput = actualTitleEl?.querySelector(".protyle-title__input") as HTMLElement | null
          const titleText = (titleInput?.innerText || actualTitleEl?.innerText || "").trim()
          this.switchToDocGlobalInspector(docId, titleText)
        }
      }
      return
    }

    const protyle = target.closest(".protyle-wysiwyg")
    if (!protyle) return

    const blockEl = target.closest("[data-node-id]") as HTMLElement | null
    if (!blockEl) return

    const blockId = blockEl.getAttribute("data-node-id")
    const blockType = blockEl.getAttribute("data-type") || ""
    if (blockId) {
      if (!this.currentDocId) {
        this.currentDocId = this.resolveDocIdFromElement(target) || ""
      }
      if (this.currentDocId && !this.latestCompiledDoc) {
        this.markCompileDirty(this.currentDocId)
      }
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

    const el = (anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement) as HTMLElement | null
    if (!el) return

    const titleEl = el.closest(".protyle-title") as HTMLElement | null
    const isDocHeader = Boolean(
      titleEl ||
      (el.closest(".protyle-content") && !el.closest(".protyle-wysiwyg"))
    )

    if (isDocHeader) {
      const docId = this.resolveDocIdFromElement(el as HTMLElement)
      if (docId) {
        if (this.activeCursorBlockId !== docId) {
          const actualTitleEl = (titleEl || document.querySelector(`.protyle-title[data-node-id="${docId}"]`) || document.querySelector(`.protyle[data-doc-id="${docId}"] .protyle-title`)) as HTMLElement | null
          const titleInput = actualTitleEl?.querySelector(".protyle-title__input") as HTMLElement | null
          const titleText = (titleInput?.innerText || actualTitleEl?.innerText || "").trim()
          this.switchToDocGlobalInspector(docId, titleText)
        }
      }
      return
    }

    if (!el.closest(".protyle-wysiwyg")) return

    const blockEl = el.closest("[data-node-id]") as HTMLElement | null
    const blockId = blockEl?.getAttribute("data-node-id")
    const blockType = blockEl?.getAttribute("data-type") || ""
    if (blockEl && blockId) {
      if (!this.currentDocId) {
        this.currentDocId = this.resolveDocIdFromElement(el) || ""
      }
      if (this.currentDocId && !this.latestCompiledDoc) {
        this.markCompileDirty(this.currentDocId)
      }
      if (blockId !== this.activeCursorBlockId) {
        this.activeCursorBlockId = blockId
        navigateDockToBlock(blockId)
      }
      this.syncInspectorBlock(blockEl, blockId, blockType)
    }
  }

  private async syncInspectorBlock(blockEl: HTMLElement, blockId: string, blockType: string) {
    // P1 优化：同一块在短时间窗内的重复联动（敲字时 selectionchange 逐字符触发）只处理一次，
    // 避免每字符都走一轮属性解析与 DOM 同步
    if (this.inspectorSyncThrottle.shouldSkip(blockId)) {
      return
    }
    await globalInspectorSyncCoordinator.syncInspectorBlock(
      blockEl,
      blockId,
      blockType,
      this.currentDocId,
      this.latestCompiledDoc,
    )
  }

  /**
   * 提取并编译当前文档为 Slidev 演示模型，推送给 Dock
   */
  /**
   * 编译指定文档为 Slidev 演示模型，推送给 Dock 与预览页签
   *
   * @param targetDocId 目标文档 id，缺省取当前文档
   * @param options.reason "auto" 表示由编辑器事件驱动，需要经过消费者门闩与单飞合并；
   *                       "explicit"（默认）表示用户显式发起（命令、刷新按钮、设置变更），不受门闩限制
   */
  public async compileCurrentDocument(
    targetDocId?: string,
    options?: { reason?: "auto" | "explicit" },
  ): Promise<void> {
    const reason = options?.reason ?? "explicit"
    let docId = targetDocId || this.currentDocId
    if (!docId) {
      const inferredId = this.getActiveDocumentId()
      if (inferredId) {
        this.currentDocId = inferredId
        docId = inferredId
      } else {
        return
      }
    }

    // P0-1：自动编译在消费者全部关闭时只登记脏文档，不向内核发起请求
    if (reason === "auto" && globalCompileConsumerGate.getVisibility() === "none") {
      this.dirtyDocId = docId
      return
    }

    // P0-3：单飞合并——已有编译在执行时只登记最新待编译文档，杜绝编译重叠叠加
    const generation = this.compileScheduler.tryBegin(docId)
    if (generation === null) {
      return
    }
    if (this.dirtyDocId === docId) {
      this.dirtyDocId = null
    }

    try {
      const slidevDoc = await globalDocumentCompiler.compile(docId)
      // P0-3：代际校验——期间有更新的编译请求时丢弃过期结果；
      // 仅当明确知道用户已切到其它文档时（currentDocId 非空且不一致）才不回写，避免首编译阶段空 id 导致结果被误丢
      const docSwitchedAway = Boolean(this.currentDocId) && docId !== this.currentDocId
      if (!this.compileScheduler.isStale(generation) && !docSwitchedAway) {
        if (!this.currentDocId) {
          this.currentDocId = docId
        }
        this.latestCompiledDoc = slidevDoc
        updateDockDocument(slidevDoc, docId)
        void this.updatePreviewTabHeader("", docId)

        // 全量巡检并清除 Protyle 编辑区中的陈旧/残留 Slidev DOM 属性与角标
        this.purgeStaleDomSlidevAttrs(slidevDoc)
      }
    } catch (err) {
      console.error("[SiYuanSlidev] Failed to compile document:", err)
    } finally {
      const pendingDocId = this.compileScheduler.finish()
      // 补跑被合并的请求：重新走脏标记与防抖，保证"编辑器静默后才编译"
      if (pendingDocId) {
        this.markCompileDirty(pendingDocId)
      }
    }
  }

  public purgeStaleDomSlidevAttrs(doc: ISlidevDocument): void {
    globalInspectorSyncCoordinator.purgeStaleDomSlidevAttrs(doc)
  }
}
