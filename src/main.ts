import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import type { Plugin } from 'siyuan'
import SlidesPreviewTab from './ui/tab/SlidesPreviewTab.vue'
import SlidesPresenterTab from './ui/tab/SlidesPresenterTab.vue'
import SlidesInspectorDockView from './ui/dock/SlidesInspectorDockView.vue'
import { WebSandboxBridge } from './engine/web-sandbox-bridge'
import { globalCompileConsumerGate } from './sync/compile-consumer-gate'
import type { ICompileConsumerHost } from './sync/compile-consumer-gate'
import type { IActiveBlockInfo, ISlidesDocument } from './types/slides-protocol'
import { isFeatureDisabled } from './feature-flags/feature-flags'

export const globalSandboxBridge = new WebSandboxBridge()

// 0. 编译消费者注册：预览页签与 Dock 面板是自动编译的唯一消费者，
//    二者全部关闭/不可见时插件只登记脏文档、不再向内核发起编译请求
function registerConsumer(
  kind: 'preview' | 'dock',
  element: HTMLElement,
  pluginInstance: Plugin,
): () => void {
  const flush = () => {
    try {
      ;(pluginInstance as unknown as ICompileConsumerHost)?.flushDirtyCompile?.()
    } catch {}
  }
  // 消费者由不可见转为可见（含后台页签切回前台、Dock 展开、窗口恢复）时补跑积压编译
  const dispose = globalCompileConsumerGate.register(kind, element, flush)
  flush()
  return dispose
}

// 1. 下方分屏预览页签 (SlidesPreviewTab) 实例管理
let previewTabApp: VueApp | null = null
let previewTabInstance: any = null
let disposePreviewConsumer: (() => void) | null = null

export function getPreviewTabInstance(): any {
  return previewTabInstance
}

export function mountPreviewTab(element: HTMLElement, pluginInstance: Plugin): any {
  if (previewTabApp) {
    unmountPreviewTab(element)
  }

  previewTabApp = createApp(SlidesPreviewTab)
  previewTabApp.provide('plugin', pluginInstance)
  previewTabApp.provide('sandboxBridge', globalSandboxBridge)

  const mounted = previewTabApp.mount(element)
  previewTabInstance = mounted
  disposePreviewConsumer = registerConsumer('preview', element, pluginInstance)
  return mounted
}

export function unmountPreviewTab(_element?: HTMLElement): void {
  if (disposePreviewConsumer) {
    disposePreviewConsumer()
    disposePreviewConsumer = null
  }
  if (previewTabApp) {
    previewTabApp.unmount()
    previewTabApp = null
    previewTabInstance = null
  }
}

export function isPreviewTabMounted(): boolean {
  return previewTabInstance !== null
}

// 1.5 演讲者控制台页签 (SlidesPresenterTab) 实例管理
// 注意：演讲者页签不是编译消费者，其数据由宿主 updateDockDocument 直连推送，
//       跨窗口（页签被移动到其它思源窗口）时经 BroadcastChannel 兜底同步
let presenterTabApp: VueApp | null = null
let presenterTabInstance: any = null

export function mountPresenterTab(element: HTMLElement, pluginInstance: Plugin): any {
  if (presenterTabApp) {
    unmountPresenterTab(element)
  }

  presenterTabApp = createApp(SlidesPresenterTab)
  presenterTabApp.provide('plugin', pluginInstance)
  presenterTabApp.provide('sandboxBridge', globalSandboxBridge)
  presenterTabInstance = presenterTabApp.mount(element)
  return presenterTabInstance
}

export function unmountPresenterTab(_element?: HTMLElement): void {
  if (presenterTabApp) {
    presenterTabApp.unmount()
    presenterTabApp = null
    presenterTabInstance = null
  }
}

/**
 * 跨窗口幻灯片数据广播：预览页签被「移动到新窗口」后，本窗口已无沙盒 iframe
 * 可投递，改由广播信道把最新编译结果推给远端窗口中的沙盒（其 BC 监听器接收
 * SYNC_SLIDES 后自行更新），保证大屏窗口持续获得编辑刷新
 */
function broadcastDocToRemoteSandbox(doc: ISlidesDocument): void {
  try {
    const channel = new BroadcastChannel('siyuan-slides-sync')
    channel.postMessage({
      type: 'SYNC_SLIDES',
      slides: doc.slides || [],
      config: doc.config || {},
    })
    channel.close()
  } catch (err) {
    // 广播失败不影响同窗口数据流
  }
}

// 2. 右侧演示配置 Dock 面板 (SlidesInspectorDockView) 实例管理
let inspectorDockApp: VueApp | null = null
let inspectorDockInstance: any = null
let disposeDockConsumer: (() => void) | null = null

export function mountInspectorDock(element: HTMLElement, pluginInstance: Plugin): any {
  if (inspectorDockApp) {
    unmountInspectorDock(element)
  }

  inspectorDockApp = createApp(SlidesInspectorDockView)
  inspectorDockApp.provide('plugin', pluginInstance)
  inspectorDockApp.provide('sandboxBridge', globalSandboxBridge)

  const mounted = inspectorDockApp.mount(element)
  inspectorDockInstance = mounted
  disposeDockConsumer = registerConsumer('dock', element, pluginInstance)
  return mounted
}

export function unmountInspectorDock(_element?: HTMLElement): void {
  if (disposeDockConsumer) {
    disposeDockConsumer()
    disposeDockConsumer = null
  }
  if (inspectorDockApp) {
    inspectorDockApp.unmount()
    inspectorDockApp = null
    inspectorDockInstance = null
  }
}

// 兼容别名
export const mountDock = mountInspectorDock
export const unmountDock = unmountInspectorDock

// 3. 数据调度与联动桥梁
export function updateDockDocument(doc: ISlidesDocument, targetDocId?: string): void {
  // 更新右侧配置面板
  if (inspectorDockInstance?.updateDocument) {
    inspectorDockInstance.updateDocument(doc)
  }

  // 更新下方分屏预览页签；页签被移动到其它窗口时经广播信道推送远端沙盒
  if (previewTabInstance?.updateDocument) {
    previewTabInstance.updateDocument(doc, targetDocId)
  } else {
    // 即使页签未挂载，沙箱桥接器也自动缓存当前文档数据
    globalSandboxBridge.updateSlides(doc.slides, doc.config, doc.fullMarkdown)
    broadcastDocToRemoteSandbox(doc)
  }

  // 更新演讲者控制台页签（同窗口宿主直连，与 Dock 同源通路）
  if (presenterTabInstance?.updateDocument) {
    presenterTabInstance.updateDocument(doc)
  }
}

export function navigateDockToBlock(blockId: string): void {
  if (previewTabInstance?.navigateToBlock) {
    previewTabInstance.navigateToBlock(blockId)
  } else {
    globalSandboxBridge.highlightElement(blockId)
  }
}

export function updateInspectorCurrentBlock(info: IActiveBlockInfo): void {
  if (inspectorDockInstance?.setActiveBlock) {
    inspectorDockInstance.setActiveBlock(info)
  }
}

export function openDockImportDialog(): boolean {
  // import 开关关闭时导入功能整体下架，不响应外部唤起
  if (isFeatureDisabled('import')) {
    return false
  }
  if (inspectorDockInstance?.openImportDialog) {
    inspectorDockInstance.openImportDialog()
    return true
  }
  return false
}
