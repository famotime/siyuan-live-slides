import type {
  ISlidesPluginConfig,
  ISlidesVirtualPage,
} from "./slides-protocol"

/**
 * 主进程宿主 -> 渲染沙箱 (Host to Sandboxed Slidev) 消息
 */
export type THostToSlidesAction =
  | "UPDATE_SLIDES"
  | "NAVIGATE_PAGE"
  | "HIGHLIGHT_ELEMENT"
  | "CONFIG_UPDATE"
  | "NEXT_STEP"
  | "PREV_STEP"
  | "FREEZE_KEYBOARD_NAV"
  | "FULLSCREEN_CHANGED"
  | "TOGGLE_OVERVIEW"
  | "START_IMAGE_EXPORT"
  | "CANCEL_IMAGE_EXPORT"

export interface IHostToSlidesMessage {
  source: "siyuan-slides-host"
  action: THostToSlidesAction
  payload: {
    // 全量或增量幻灯片数据载荷
    slides?: ISlidesVirtualPage[]
    // 目标跳转页码 (1-based)
    pageIndex?: number
    // 目标页内步进 (0-based, v-click / mask step)
    step?: number
    // 目标高亮聚焦的块 ID
    targetBlockId?: string
    // 全局演示配置 (主题、字体、宽高比)
    config?: ISlidesPluginConfig
    // 是否冻结幻灯片沙箱键盘翻页
    frozen?: boolean
    // 是否全屏状态变更通知
    isFullscreen?: boolean
    // 思源主题与字体样式 CSS 变量定义
    customThemeCss?: string
    // 图片导出选项
    captureOptions?: {
      mode: "current" | "all"
      scale?: number
      format?: "png" | "jpeg"
    }
  }
}

/**
 * 渲染沙箱 -> 主进程宿主 (Sandboxed Slidev to Host) 消息
 */
export type TSlidesToHostAction =
  | "SLIDE_CHANGED"
  | "BLOCK_CLICKED"
  | "OPEN_IN_EDITOR"
  | "REQUEST_SAVE_ATTRS"
  | "EXPORT_TRIGGER"
  | "CLIENT_READY"
  | "OPEN_PEEK_DRAWER"
  | "REQUEST_TOGGLE_FULLSCREEN"
  | "OPEN_PRESENTER"
  | "CAPTURE_PROGRESS"
  | "CAPTURE_PAGE_DONE"
  | "CAPTURE_COMPLETE"
  | "CAPTURE_ERROR"

export interface ISlidesToHostMessage {
  source: "siyuan-slides-client"
  action: TSlidesToHostAction
  payload: {
    // 当前激活页码 (1-based)
    currentPage?: number
    // 总页数
    totalPages?: number
    // 当前页内已触发步进数 (0-based)
    currentStep?: number
    // 当前页内最大步进数
    maxStep?: number
    // 当前幻灯片绑定的思源起始 Block ID
    currentBlockId?: string
    // 用户在演示中点击的特定 Block ID (用于编辑器精准对齐)
    clickedBlockId?: string
    // 打开在编辑器中的 Block ID
    blockId?: string
    // 快捷修改属性请求 (如演示中修改了备注)
    updatedAttrs?: Record<string, string>
    // 导出类型
    exportType?: "html" | "pdf" | "pptx"
    // 原位沉浸式速览请求参数
    peekType?: "siyuan" | "web"
    url?: string
    title?: string
    // 幻灯片逐页导出图片回调载荷
    captureProgress?: {
      current: number
      total: number
      pageIndex: number
    }
    captureResult?: {
      pageIndex: number
      dataUrl: string
      total: number
      mode?: "current" | "all"
    }
    captureError?: string
  }
}
