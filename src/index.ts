import type {
  Protyle,
} from "siyuan"
import {
  getFrontend,
  openTab,
  Plugin as SyPlugin,
  showMessage,
} from "siyuan"
import { getBlockAttrs, setBlockAttrs } from "@/api"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
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
} from "@/main"
import { registerPluginCommands } from "@/plugin/command-registry"
import type { ISlidevPluginHost } from "@/plugin/command-registry"
import { globalInspectorSyncCoordinator } from "@/sync/inspector-sync-coordinator"
import type { ISlidevDocument } from "@/types/slidev-protocol"
import "@/index.scss"

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
  public latestCompiledDoc: ISlidevDocument | null = null
  public cliBridge = new CliDevServerBridge()
  private debounceTimer: number | null = null
  private activeCursorBlockId = ""

  private onSwitchProtyleBound = this.onSwitchProtyle.bind(this)
  private onWsMainBound = this.onWsMain.bind(this)
  private onBlockClickedBound = this.onBlockClickedFromSlide.bind(this)
  private onClickEditorTitleIconBound = this.onClickEditorTitleIcon.bind(this)
  private onEditorClickBound = this.onEditorClick.bind(this)
  private onSelectionChangeBound = this.onSelectionChange.bind(this)
  private onClickEditorContentBound = this.onClickEditorContent.bind(this)

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
      title: "Slidev 演示 (下方分屏)",
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
    }

    // 8. 插件启动/重启时自动检测当前主编辑区文档并即时编译
    if (typeof document !== "undefined") {
      const detectAndCompile = () => {
        const docId = this.getActiveDocumentId()
        if (docId) {
          if (docId !== this.currentDocId) {
            this.currentDocId = docId
          }
          if (!this.latestCompiledDoc) {
            this.compileCurrentDocument(docId)
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
    // 跨端同步或外部文件覆写时轻量重新编译，避免宿主触发全量重载
    if (this.currentDocId) {
      await this.compileCurrentDocument(this.currentDocId)
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
      await this.compileCurrentDocument(docId)
    }
    return updated
  }

  onunload() {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.eventBus.off("switch-protyle", this.onSwitchProtyleBound)
    this.eventBus.off("ws-main", this.onWsMainBound)
    this.eventBus.off("click-editortitleicon", this.onClickEditorTitleIconBound)
    this.eventBus.off("click-editorcontent" as any, this.onClickEditorContentBound)
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
      this.currentDocId = this.getActiveDocumentId()
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
  private async onSwitchProtyle(event: CustomEvent<{ protyle: Protyle }>) {
    const protyle = event.detail?.protyle
    const docId = (protyle as any)?.block?.rootID
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
      this.compileCurrentDocument(docId)
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
   * WebSocket 事务流监听（150ms 增量防抖）
   */
  private onWsMain(event: CustomEvent<any>) {
    const data = event.detail
    if (!data) return

    globalInspectorSyncCoordinator.patchThematicBreakTransactions(data)

    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = window.setTimeout(() => {
      this.compileCurrentDocument()
    }, 150)
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
        this.compileCurrentDocument(this.currentDocId)
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
        this.compileCurrentDocument(this.currentDocId)
      }
      if (blockId !== this.activeCursorBlockId) {
        this.activeCursorBlockId = blockId
        navigateDockToBlock(blockId)
      }
      this.syncInspectorBlock(blockEl, blockId, blockType)
    }
  }

  private async syncInspectorBlock(blockEl: HTMLElement, blockId: string, blockType: string) {
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
  public async compileCurrentDocument(targetDocId?: string): Promise<void> {
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

    try {
      const slidevDoc = await globalDocumentCompiler.compile(docId)
      this.latestCompiledDoc = slidevDoc
      updateDockDocument(slidevDoc, docId)

      // 全量巡检并清除 Protyle 编辑区中的陈旧/残留 Slidev DOM 属性与角标
      this.purgeStaleDomSlidevAttrs(slidevDoc)
    } catch (err) {
      console.error("[SiYuanSlidev] Failed to compile document:", err)
    }
  }

  public purgeStaleDomSlidevAttrs(doc: ISlidevDocument): void {
    globalInspectorSyncCoordinator.purgeStaleDomSlidevAttrs(doc)
  }
}
