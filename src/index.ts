import type {
  Protyle,
} from "siyuan"
import {
  getFrontend,
  openTab,
  openWindow,
  Plugin as SyPlugin,
} from "siyuan"
import { getBlockAttrs } from "@/api"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import { isFeatureDisabled } from "@/feature-flags/feature-flags"
import {
  globalSandboxBridge,
  isPreviewTabMounted,
  mountInspectorDock,
  mountPresenterTab,
  mountPreviewTab,
  navigateDockToBlock,
  unmountInspectorDock,
  unmountPresenterTab,
  unmountPreviewTab,
  updateDockDocument,
  updateInspectorCurrentBlock,
} from "@/main"
import { registerPluginCommands } from "@/plugin/command-registry"
import type { ISlidesPluginHost } from "@/plugin/command-registry"
import {
  buildPreviewTabTitle as buildTabTitle,
  fetchDocumentTitle as fetchDocTitle,
  updatePreviewTabHeader as updateTabHeader,
} from "@/plugin/preview-tab-title"
import { globalInspectorSyncCoordinator } from "@/sync/inspector-sync-coordinator"
import { globalCompileConsumerGate, HIDDEN_CONSUMER_COMPILE_DELAY_MS } from "@/sync/compile-consumer-gate"
import { CompileScheduler } from "@/sync/compile-scheduler"
import { InspectorSyncThrottle } from "@/sync/inspector-sync-cache"
import { isMultiBlockSelected } from "@/sync/selection-mirror"
import type { ISlidesDocument } from "@/types/slides-protocol"
import "@/index.scss"

/** 自动编译防抖时长：编辑器事务停歇该时长后才向内核发起编译 */
const AUTO_COMPILE_DEBOUNCE_MS = 150

// 专属 SVG 幻灯片放映图标
const ICON_SLIDES_SVG = `<symbol id="iconSlides" viewBox="0 0 1024 1024">
  <path fill="currentColor" d="M128 160h768c35.3 0 64 28.7 64 64v480c0 35.3-28.7 64-64 64H128c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64z m64 64v480h640V224H192z m128 640h384v64H320z"/>
  <path fill="currentColor" d="M416 336l256 144-256 144z"/>
</symbol>`

import {
  DEFAULT_GLOBAL_SETTINGS,
  getRuntimeSettings,
  normalizeGlobalSettings,
  setManagedAiConfig,
  setRuntimeSettings,
  SETTINGS_STORAGE_NAME,
} from "./settings"
import type { ISlidesGlobalSettings } from "./settings"
import { createSlidesSettings } from "@/ui/settings/slides-settings"
import type { SharedConfig } from "./types/api-switch"

const DOCK_TYPE = "slides-dock"
const TAB_TYPE = "slides-preview-tab"
const PRESENTER_TAB_TYPE = "slides-presenter-tab"
const STORAGE_NAME = SETTINGS_STORAGE_NAME

export default class SiYuanLiveSlidesPlugin extends SyPlugin implements ISlidesPluginHost {
  public isMobile = false
  public currentDocId = ""
  public previewTab: any = null
  public latestCompiledDoc: ISlidesDocument | null = null
  public setting: any = null
  private debounceTimer: number | null = null
  private activeCursorBlockId = ""
  private cancelledCursorBlockId = ""
  // P0 优化：编译消费者门闩 + 脏文档 + 单飞/代际调度
  private compileScheduler = new CompileScheduler()
  private dirtyDocId: string | null = null
  /** 光标联动节流：同一块的重复触发在时间窗内只同步一次 */
  private inspectorSyncThrottle = new InspectorSyncThrottle()

  private onSwitchProtyleBound = this.onSwitchProtyle.bind(this)
  private onWsMainBound = this.onWsMain.bind(this)
  private onBlockClickedBound = this.onBlockClickedFromSlide.bind(this)
  private onEditorClickBound = this.onEditorClick.bind(this)
  private onSelectionChangeBound = this.onSelectionChange.bind(this)
  private onClickEditorContentBound = this.onClickEditorContent.bind(this)
  private onVisibilityChangeBound = this.onVisibilityChange.bind(this)

  async onload() {
    const frontEnd = getFrontend()
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"

    // 0. 加载全局持久化配置
    await this.loadGlobalSettings()
    this.initApiSwitchSync()

    // 1. 注册图标
    this.addIcons(ICON_SLIDES_SVG)

    // 2. 注册顶栏快捷放映入口 (在文档下方分屏)
    this.addTopBar({
      id: "slides-topbar-play",
      icon: "iconSlides",
      title: "即现",
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
        // 跨窗口恢复：页签被「移动到新窗口」后，新窗口内无编辑器、常规管线不会编译，
        // 依据页签序列化数据携带的 docId 主动编译，为大屏窗口自行喂数据；
        // 主窗口（存在活动编辑文档）仍走常规管线，避免重复编译
        const restoreDocId = (customObj as any)?.data?.docId
        if (restoreDocId && !self.getActiveDocumentId()) {
          void self.compileCurrentDocument(restoreDocId, { reason: "explicit" })
        }
        void self.updatePreviewTabHeader()
      },
      destroy() {
        if (self.previewTab === (this as any)?.tab) {
          self.previewTab = null
        }
        unmountPreviewTab((this as any).element as HTMLElement)
      },
    })

    // 4.5 注册演讲者控制台页签（内嵌同源 presenter.html，经 BroadcastChannel 与预览沙箱双屏同步）
    this.addTab({
      type: PRESENTER_TAB_TYPE,
      init(custom) {
        const customObj = this || custom
        mountPresenterTab((customObj as any).element as HTMLElement, self)
      },
      destroy() {
        unmountPresenterTab((this as any).element as HTMLElement)
      },
    })

    // 5. 注册右侧 Dock 演示配置面板
    this.addDock({
      config: {
        position: "RightTop",
        size: { width: 320, height: 0 },
        icon: "iconSlides",
        title: "即现配置",
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
    this.eventBus.on("slides:request-compile" as any, () => this.compileCurrentDocument())
    this.eventBus.on("slides:block-clicked" as any, this.onBlockClickedBound)
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

  async onDataChanged(_reason?: "sync" | "overwrite") {
    // 跨端同步或外部配置更新时重新载入全局配置
    await this.loadGlobalSettings()
    // 跨端同步或外部文件覆写时轻量重新编译，避免宿主触发全量重载（交由门闩与防抖决定是否真正编译）
    if (this.currentDocId) {
      this.markCompileDirty(this.currentDocId)
    }
  }

  async loadGlobalSettings(): Promise<ISlidesGlobalSettings> {
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

  async saveGlobalSettings(nextSettings?: Partial<ISlidesGlobalSettings>): Promise<ISlidesGlobalSettings> {
    const current = getRuntimeSettings()
    const updated = setRuntimeSettings({
      ...current,
      ...(nextSettings || {}),
    })
    try {
      await this.saveData(STORAGE_NAME, updated)
    } catch (err) {
      console.error("保存即现全局配置失败", err)
    }
    const docId = this.currentDocId || this.getActiveDocumentId()
    if (docId) {
      this.markCompileDirty(docId)
    }
    return updated
  }

  openSetting() {
    this.setting = createSlidesSettings(this)
    this.setting.open(this.name)
  }

  private initApiSwitchSync() {
    const sync = (shared: SharedConfig | null) => {
      setManagedAiConfig(shared)
      if (this.setting) {
        const updater = (this.setting as any).updateManagedConfig
        if (typeof updater === "function") {
          updater(shared)
        }
      }
    }

    const getLocalConfig = () => {
      const local = getRuntimeSettings().aiConfig
      return {
        provider: "custom",
        baseUrl: local.baseUrl,
        apiKey: local.apiKey,
        model: local.model,
        requestTimeoutSeconds: local.requestTimeoutSeconds,
        temperature: local.temperature,
        maxTokens: local.maxTokens,
      }
    }

    const register = () => {
      if (window.siyuanApiSwitch) {
        window.siyuanApiSwitch.register(
          this.name,
          this.displayName || "即现 (SiYuan Live Slides)",
          sync,
          getLocalConfig()
        )
      }
    }

    if (window.siyuanApiSwitch) {
      register()
    } else {
      window.addEventListener(
        "siyuan-api-switch:ready",
        () => {
          register()
        },
        { once: true }
      )
    }
  }

  onunload() {
    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.unregister(this.name)
    }
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
        icon: "iconSlides",
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
   * 打开演讲者控制台页签（双屏演讲的提词端）
   *
   * 桌面端宿主会拦截 window.open 并甩给系统浏览器，导致演讲者视图与思源内
   * 沙箱跨进程隔离、BroadcastChannel 失效，因此必须以思源页签形态承载。
   * 若预览页签（大屏放映端）尚未开启，则顺带拉起，保证有应答 SYNC 的沙箱。
   */
  public async openPresenterTab(): Promise<void> {
    // presenterMode 开关关闭时演讲者视图整体下架，不响应任何唤起（含沙箱放映内请求）
    if (isFeatureDisabled("presenterMode")) {
      return
    }
    if (!isPreviewTabMounted()) {
      await this.openBottomPreviewTab()
    }
    await openTab({
      app: this.app,
      custom: {
        id: this.name + PRESENTER_TAB_TYPE,
        title: "演讲者控制台",
        icon: "iconSlides",
        data: {},
      },
      position: "right",
    })
  }

  /**
   * 一键将大屏放映页签弹出为 16:9 独立窗口（1280×760），便于单屏线上会议按窗口共享或双屏扩展投屏
   */
  public async openStandalonePreviewWindow(): Promise<void> {
    if (!this.currentDocId) {
      this.currentDocId = this.getActiveDocumentId()
    }
    if (this.currentDocId && !this.latestCompiledDoc) {
      await this.compileCurrentDocument(this.currentDocId, { reason: "explicit" })
    }

    const frontEnd = getFrontend()
    if (frontEnd === "browser-desktop" || frontEnd === "browser-mobile") {
      if (typeof window !== "undefined" && typeof window.open === "function") {
        window.open(
          "/plugins/siyuan-live-slides/slides-client/index.html",
          "SlidesBigScreenWindow",
          "width=1280,height=760,menubar=no,toolbar=no,location=no,status=no",
        )
      }
      return
    }

    let targetTab = this.previewTab
    if (!targetTab) {
      const initialDocTitle = this.currentDocId ? await this.fetchDocumentTitle(this.currentDocId) : ""
      const initialTitle = this.buildPreviewTabTitle(initialDocTitle)
      const opened = await openTab({
        app: this.app,
        custom: {
          id: this.name + TAB_TYPE,
          title: initialTitle,
          icon: "iconSlides",
          data: { docId: this.currentDocId },
        },
        position: "bottom",
      })
      targetTab = this.previewTab || (opened as any)
    }

    if (targetTab) {
      if (this.currentDocId && (targetTab as any).model) {
        ;(targetTab as any).model.data = {
          ...((targetTab as any).model.data || {}),
          docId: this.currentDocId,
        }
      }
      openWindow({
        tab: targetTab,
        width: 1280,
        height: 760,
      })
    }
  }

  /**
   * 文档切换钩子
   */
  private async onSwitchProtyle(event: CustomEvent<{ protyle: Protyle }>) {
    const protyle = event.detail?.protyle
    const docId = (protyle as any)?.block?.rootID
    const docTitle = (protyle as any)?.title?.editElement?.textContent?.trim() || ""
    if (docId && docId !== this.currentDocId) {
      this.cancelledCursorBlockId = ""
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
   * 构造预览页签标题（委托 preview-tab-title 服务）
   */
  public buildPreviewTabTitle(docTitle?: string): string {
    return buildTabTitle(docTitle)
  }

  /**
   * 获取指定文档的标题内容（委托 preview-tab-title 服务）
   */
  public async fetchDocumentTitle(docId: string): Promise<string> {
    return fetchDocTitle(this, docId)
  }

  /**
   * 动态更新预览窗口思源 Tab 页签标题（委托 preview-tab-title 服务）
   */
  public async updatePreviewTabHeader(docTitle?: string, targetDocId?: string): Promise<void> {
    return updateTabHeader(this, docTitle, targetDocId)
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
  public handleBlockClickedFromSlide(blockId: string, page?: number): boolean {
    if (!blockId) {
      this.cancelledCursorBlockId = this.activeCursorBlockId
      this.activeCursorBlockId = ""
    } else {
      this.cancelledCursorBlockId = ""
      this.activeCursorBlockId = blockId
    }
    return globalInspectorSyncCoordinator.handleBlockClickedFromSlide(
      blockId,
      this.app,
      this.currentDocId,
      this.latestCompiledDoc,
      page,
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

    // 若当前编辑区处于多选状态（包含思源整块多选或跨块文本连续划选），保持当前设置界面与预览不跳转
    const protyleRoot = target.closest?.(".protyle") || target.closest?.(".protyle-wysiwyg")
    if (isMultiBlockSelected(protyleRoot)) {
      return
    }

    const titleEl = (target.closest(".protyle-title") || target.closest(".protyle-background")) as HTMLElement | null
    const isDocHeader = Boolean(titleEl)

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
      this.cancelledCursorBlockId = ""
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

    // 若当前编辑区处于多选状态（包含思源整块多选或跨块文本连续划选），保持当前设置界面与预览不跳转
    const protyleRoot = el.closest?.(".protyle") || el.closest?.(".protyle-wysiwyg")
    if (isMultiBlockSelected(protyleRoot)) {
      return
    }

    const titleEl = (el.closest(".protyle-title") || el.closest(".protyle-background")) as HTMLElement | null
    const isDocHeader = Boolean(titleEl)

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
      // FSM-2 缺陷修复：反向定位平滑滚动期间屏蔽沿途中间过渡块的选区触发
      if (globalInspectorSyncCoordinator.isLocatingLocked(blockId)) {
        return
      }

      if (!this.currentDocId) {
        this.currentDocId = this.resolveDocIdFromElement(el) || ""
      }
      if (this.currentDocId && !this.latestCompiledDoc) {
        this.markCompileDirty(this.currentDocId)
      }
      if (blockId !== this.activeCursorBlockId) {
        if (blockId === this.cancelledCursorBlockId) {
          return
        }
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
   * 提取并编译当前文档为即现模型，推送给 Dock
   */
  /**
   * 编译指定文档为即现模型，推送给 Dock 与预览页签
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
      const slidesDoc = await globalDocumentCompiler.compile(docId)
      // P0-3：代际校验——期间有更新的编译请求时丢弃过期结果；
      // 仅当明确知道用户已切到其它文档时（currentDocId 非空且不一致）才不回写，避免首编译阶段空 id 导致结果被误丢
      const docSwitchedAway = Boolean(this.currentDocId) && docId !== this.currentDocId
      if (!this.compileScheduler.isStale(generation) && !docSwitchedAway) {
        if (!this.currentDocId) {
          this.currentDocId = docId
        }
        this.latestCompiledDoc = slidesDoc
        updateDockDocument(slidesDoc, docId)
        void this.updatePreviewTabHeader("", docId)

        // 全量巡检并清除 Protyle 编辑区中的陈旧/残留即现 DOM 属性与角标
        this.purgeStaleDomSlidesAttrs(slidesDoc)
      }
    } catch (err) {
      console.error("[SiYuanLiveSlides] Failed to compile document:", err)
    } finally {
      const pendingBatch = this.compileScheduler.finishBatch()
      const pendingDocId = pendingBatch.length > 0 ? pendingBatch[0] : this.compileScheduler.finish()
      // 补跑被合并的请求：重新走脏标记与防抖，保证全部待编译文档均不遗漏，且"编辑器静默后才编译"
      if (pendingDocId) {
        this.markCompileDirty(pendingDocId)
      }
      for (let i = 1; i < pendingBatch.length; i++) {
        this.markCompileDirty(pendingBatch[i])
      }
    }
  }

  public purgeStaleDomSlidesAttrs(doc: ISlidesDocument): void {
    globalInspectorSyncCoordinator.purgeStaleDomSlidesAttrs(doc)
  }
}
