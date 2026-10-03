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
import { getBlockAttrs, sql } from "@/api"
import { buildSlidevDocument } from "@/compiler/slidev-ast-builder"
import {
  globalSandboxBridge,
  mountDock,
  unmountDock,
  updateDockDocument,
} from "@/main"
import type { ISiYuanBlockNode } from "@/types/slidev-protocol"
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
    this.eventBus.on("switch-protyle", this.onSwitchProtyle.bind(this))
    this.eventBus.on("ws-main", this.onWsMain.bind(this))
    this.eventBus.on("slidev:request-compile" as any, () => this.compileCurrentDocument())
    this.eventBus.on("slidev:block-clicked" as any, this.onBlockClickedFromSlide.bind(this))
  }

  onunload() {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    globalSandboxBridge.detach()
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
    const blockEl = document.querySelector(`[data-node-id="${eventData.blockId}"]`)
    if (blockEl) {
      blockEl.scrollIntoView({ behavior: "smooth", block: "center" })
      blockEl.classList.add("protyle-wysiwyg--select")
      setTimeout(() => {
        blockEl.classList.remove("protyle-wysiwyg--select")
      }, 1200)
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

      // 2. 通过 SQL 检索当前文档的所有直接子块
      const querySql = `SELECT id, parent_id, root_id, type, sub_type as subType, content, markdown, ial FROM blocks WHERE root_id = '${docId}' AND parent_id = '${docId}' ORDER BY sort ASC`
      const rows = (await sql(querySql).catch(() => [])) || []

      // 3. 构造节点数组并反序列化 IAL
      const blockNodes: ISiYuanBlockNode[] = rows.map((r: any) => {
        let ialMap: Record<string, string> = {}
        if (r.ial && typeof r.ial === "string") {
          ialMap = this.parseIALString(r.ial)
        }
        return {
          id: r.id,
          parent_id: r.parent_id,
          root_id: r.root_id,
          type: r.type,
          subType: r.subType,
          content: r.content,
          markdown: r.markdown,
          ial: ialMap,
        }
      })

      // 4. 调用核心 AST 编译器
      const baseUrl = typeof location !== "undefined" ? location.origin : ""
      const slidevDoc = buildSlidevDocument(docId, docAttrs, blockNodes, { baseUrl })

      // 5. 推送更新至沙箱
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
