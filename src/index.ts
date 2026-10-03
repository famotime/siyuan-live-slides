import type {
  ICommandContext,
  Protyle,
  TPluginDataChangeReason,
} from "siyuan"
import {
  getFrontend,
  openInputDialog,
  Plugin,
  showMessage,
} from "siyuan"
import PluginInfoString from "@/../plugin.json"
import {
  destroy,
  init,
} from "@/main"
import "@/index.scss"

// 注册插件专属 SVG 图标（使用 currentColor 适配明暗主题）
const CUSTOM_ICON_SVG = `<symbol id="iconSamplePlugin" viewBox="0 0 1024 1024">
  <path fill="currentColor" d="M853.333333 469.333333h-128v-128c0-47.146667-38.186667-85.333333-85.333333-85.333333h-128v-128c0-35.306667-28.693333-64-64-64s-64 28.693333-64 64v128h-128c-47.146667 0-85.333333 38.186667-85.333333 85.333333v128h-128c-35.306667 0-64 28.693333-64 64s28.693333 64 64 64h128v128c0 47.146667 38.186667 85.333333 85.333333 85.333333h128v128c0 35.306667 28.693333 64 64 64s64-28.693333 64-64v-128h128c47.146667 0 85.333333-38.186667 85.333333-85.333333v-128h128c35.306667 0 64-28.693333 64-64s-28.693333-64-64-64z"/>
</symbol>`

const CUSTOM_BLOCK_TYPE = "counter"
const STORAGE_NAME = "config.json"

let PluginInfo = {
  version: "",
}
try {
  PluginInfo = PluginInfoString
} catch {
  // 解析失败使用默认兜底版本
}
const {
  version,
} = PluginInfo

export default class PluginSample extends Plugin {
  // Run as mobile
  public isMobile: boolean
  // Run in browser
  public isBrowser: boolean
  // Run as local
  public isLocal: boolean
  // Run in Electron
  public isElectron: boolean
  // Run in window
  public isInWindow: boolean
  // Run in readonly or publish environment
  public isReadonly: boolean
  public publishDataStatus = ""
  public platform: SyFrontendTypes
  public readonly version = version

  /**
   * 自定义块渲染器：计数器示例
   * 对应 Markdown:
   * ;;;plugin-sample-vite-vue/counter
   * 0
   * ;;;
   */
  private readonly renderCounterCustomBlock = ({
    element,
    content,
    setContent,
  }: {
    element: HTMLElement
    content: string
    setContent: (content: string) => boolean
  }) => {
    let count = Number(content)
    if (!Number.isSafeInteger(count)) {
      count = 0
    }
    const button = document.createElement("button")
    button.type = "button"
    button.className = "b3-button b3-button--outline"
    const updateLabel = () => {
      const label = `Vue 模板计数器: ${count}`
      button.textContent = label
      button.setAttribute("aria-label", label)
    }
    const increase = () => {
      const nextCount = count + 1
      // setContent 在只读或包含独占行 ;;; 时会返回 false
      if (setContent(nextCount.toString())) {
        count = nextCount
        updateLabel()
      }
    }
    updateLabel()
    button.addEventListener("click", increase)
    element.append(button)
    // 返回清理函数，在块销毁或重新渲染时执行
    return () => button.removeEventListener("click", increase)
  }

  async onload() {
    // 0. 判断是否处于只读或公开数据发布环境
    this.isReadonly = Boolean((window as any).siyuan?.config?.readonly || (window as any).siyuan?.isPublish)
    this.data[STORAGE_NAME] = { sampleText: "默认配置" }

    // 1. 注册自定义专属图标
    this.addIcons(CUSTOM_ICON_SVG)

    const frontEnd = getFrontend()
    this.platform = frontEnd as SyFrontendTypes
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"
    this.isBrowser = frontEnd.includes("browser")
    this.isLocal =
      location.href.includes("127.0.0.1")
      || location.href.includes("localhost")
    this.isInWindow = location.href.includes("window.html")

    try {
      require("@electron/remote").require("@electron/remote/main")
      this.isElectron = true
    } catch {
      this.isElectron = false
    }

    // 发布/只读模式下加载公开快照；管理员模式下加载私有配置
    if (this.isReadonly) {
      await this.loadPublishedSettings()
    } else {
      const localData = await this.loadData(STORAGE_NAME).catch(() => null)
      if (localData && typeof localData.sampleText === "string") {
        this.data[STORAGE_NAME] = localData
      }
    }

    // 2. 注册自定义块渲染器 (Custom Block Renderers)
    this.customBlockRenders[CUSTOM_BLOCK_TYPE] = {
      render: this.renderCounterCustomBlock,
    }

    // 3. 注册动态编辑器工具栏条目 (Dynamic Toolbar Items)
    this.addToolbarItem({
      name: "sample-insert-text",
      icon: "iconSamplePlugin",
      hotkey: "⌥⇧T",
      tip: "插入示例内容",
      click: (protyle: Protyle) => {
        protyle.insert(" 🚀 欢迎使用思源插件开发项目模板！ ")
      },
    })

    // 4. 注册编辑器面包屑按钮 (Editor Breadcrumb Button)
    this.addBreadcrumbButton({
      id: "sample-toggle-fullscreen",
      icon: "iconFullscreen",
      title: "切换当前编辑器全屏",
      callback: (event: MouseEvent, protyle: any) => {
        event.preventDefault()
        const editor = protyle.getInstance ? protyle.getInstance() : protyle
        if (editor && typeof editor.isFullscreen === "function") {
          editor.setFullscreen(!editor.isFullscreen())
        }
      },
    })

    // 5. 注册命令（使用统一命令执行上下文 ICommandContext 与多快捷键 / 条件控制）
    this.addCommand({
      langKey: "sampleCommand",
      hotkey: "⌥⇧O",
      hotkeys: ["⌥⇧O", "Alt+Shift+O"],
      when: () => !this.isReadonly,
      enabled: () => true,
      execute: (context: ICommandContext) => {
        console.log("Command executed with context:", {
          source: context.source,
          focus: context.focus,
          protyle: context.protyle,
          range: context.range,
          fileTree: context.fileTree,
          dock: context.dock,
        })
        showMessage("已触发示例命令！")
      },
    })

    // 6. 添加顶栏按钮（支持右键上下文菜单 contextMenu）
    this.addTopBar({
      id: "sample-topbar",
      icon: "iconSamplePlugin",
      title: "示例插件顶栏入口",
      contextMenu: (menu) => {
        if (this.isReadonly || this.isMobile) {
          return
        }
        menu.addItem({
          id: "sample-topbar-settings",
          icon: "iconSettings",
          label: "打开插件设置 (openInputDialog)",
          click: () => {
            this.openSetting()
          },
        })
      },
      callback: () => {
        this.openSetting()
      },
    })

    // 7. 初始化 Vue UI
    init(this)
  }

  async onLayoutReady() {
    // 布局就绪钩子：此时工作空间、编辑器与内核插件均已就绪
    console.log(`[${this.name}] Layout is ready`)
  }

  /**
   * 数据变更生命周期：当其他实例通过文件接口写入或跨设备同步合并时触发
   * @param reason 数据变更来源："sync" 为同步合并，"overwrite" 为文件写入覆盖
   */
  async onDataChanged(reason?: TPluginDataChangeReason): Promise<void> {
    console.log(`[${this.name}] onDataChanged triggered with reason:`, reason)
    // 重新加载数据以保持前端状态一致
    await this.loadData(STORAGE_NAME).catch(() => {})
  }

  onunload() {
    if (this.isReadonly) {
      return
    }
    // 拆除钩子：必须幂等，且在 5 秒共享拆除预算内迅速完成
    destroy()
  }

  /**
   * 彻底卸载生命周期：仅在插件从工作空间彻底移除时触发一次
   */
  async uninstall(): Promise<void> {
    if (this.isReadonly) {
      return
    }
    console.log(`[${this.name}] uninstalling: cleaning up stored data`)
    await this.removeData(STORAGE_NAME).catch(() => {})
  }

  /**
   * 打开插件设置对话框
   * 基于 SiYuan v3.8.4+ / petal v1.2.8 官方 openInputDialog 统一对话框 API
   */
  openSetting() {
    if (this.isReadonly) {
      showMessage(`当前处于只读/发布环境。公开数据状态: ${this.publishDataStatus || "已加载公开快照"}`)
      return
    }

    const currentVal = this.data[STORAGE_NAME]?.sampleText || "默认配置"
    openInputDialog({
      title: "插件设置与快速输入",
      value: currentVal,
      label: "配置参数 (sampleText)",
      placeholder: "请输入配置文本...",
      description: "基于 SiYuan 官方 openInputDialog 统一组件实现，支持自定义扩展操作",
      width: this.isMobile ? "92vw" : "520px",
      actions: [
        {
          text: "发布为公开快照",
          position: "beforeConfirm",
          onClick: async (val) => {
            await this.publishSettings(val)
          },
        },
      ],
      onConfirm: async (val, dialog) => {
        this.data[STORAGE_NAME] = { sampleText: val }
        await this.saveData(STORAGE_NAME, this.data[STORAGE_NAME])
        showMessage(`配置已保存: ${val}`)
        dialog.destroy()
      },
    })
  }

  /**
   * 读取已获管理员授权的公开快照，供发布页面使用
   * 未授权 (403) 或尚未生成 (404) 时优雅降级，绝对不回退到私有存储 loadData
   */
  private async loadPublishedSettings(): Promise<void> {
    this.data[STORAGE_NAME] = { sampleText: "公开快照默认值" }
    this.publishDataStatus = ""
    try {
      const data = await this.loadPublishData()
      if (typeof data?.sampleText === "string") {
        this.data[STORAGE_NAME] = { sampleText: data.sampleText }
      }
    } catch (error: any) {
      const code = error?.code
      this.publishDataStatus =
        code === 403
          ? "公开数据尚未获管理员授权"
          : code === 404
            ? "公开数据快照尚未生成"
            : "读取公开数据快照失败"
      console.warn(`[${this.name}] loadPublishData status:`, this.publishDataStatus)
    }
  }

  /**
   * 在管理员环境中完整替换公开快照，仅支持 plugin.json 的 publish.data 声明并获单独授权的标量字段
   */
  public async publishSettings(sampleText: string): Promise<void> {
    if (this.isReadonly) {
      return
    }
    try {
      await this.savePublishData({ sampleText })
      showMessage("已将 sampleText 发布为公开数据快照！")
    } catch (error: any) {
      const code = error?.code
      showMessage(
        code === 403
          ? "发布失败：需要管理员在「设置 - 集市 - 已下载 - 插件卡片」中点击发布数据图标进行单独授权"
          : "保存公开数据失败",
      )
    }
  }
}

