import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import type { Plugin } from 'siyuan'
import SlidevPreviewTab from './ui/tab/SlidevPreviewTab.vue'
import SlidevInspectorDockView from './ui/dock/SlidevInspectorDockView.vue'
import { WebSandboxBridge } from './engine/web-sandbox-bridge'
import type { IActiveBlockInfo, ISlidevDocument } from './types/slidev-protocol'

export const globalSandboxBridge = new WebSandboxBridge()

// 1. 下方分屏预览页签 (SlidevPreviewTab) 实例管理
let previewTabApp: VueApp | null = null
let previewTabInstance: any = null

export function mountPreviewTab(element: HTMLElement, pluginInstance: Plugin): any {
  if (previewTabApp) {
    unmountPreviewTab(element)
  }

  previewTabApp = createApp(SlidevPreviewTab)
  previewTabApp.provide('plugin', pluginInstance)
  previewTabApp.provide('sandboxBridge', globalSandboxBridge)

  const mounted = previewTabApp.mount(element)
  previewTabInstance = mounted
  return mounted
}

export function unmountPreviewTab(element: HTMLElement): void {
  if (previewTabApp) {
    previewTabApp.unmount()
    previewTabApp = null
    previewTabInstance = null
  }
}

export function isPreviewTabMounted(): boolean {
  return previewTabInstance !== null
}

// 2. 右侧演示配置 Dock 面板 (SlidevInspectorDockView) 实例管理
let inspectorDockApp: VueApp | null = null
let inspectorDockInstance: any = null

export function mountInspectorDock(element: HTMLElement, pluginInstance: Plugin): any {
  if (inspectorDockApp) {
    unmountInspectorDock(element)
  }

  inspectorDockApp = createApp(SlidevInspectorDockView)
  inspectorDockApp.provide('plugin', pluginInstance)
  inspectorDockApp.provide('sandboxBridge', globalSandboxBridge)

  const mounted = inspectorDockApp.mount(element)
  inspectorDockInstance = mounted
  return mounted
}

export function unmountInspectorDock(element: HTMLElement): void {
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
export function updateDockDocument(doc: ISlidevDocument, targetDocId?: string): void {
  // 更新右侧配置面板
  if (inspectorDockInstance?.updateDocument) {
    inspectorDockInstance.updateDocument(doc)
  }

  // 更新下方分屏预览页签
  if (previewTabInstance?.updateDocument) {
    previewTabInstance.updateDocument(doc, targetDocId)
  } else {
    // 即使页签未挂载，沙箱桥接器也自动缓存当前文档数据
    globalSandboxBridge.updateSlides(doc.slides, doc.config, doc.fullMarkdown)
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
  if (inspectorDockInstance?.openImportDialog) {
    inspectorDockInstance.openImportDialog()
    return true
  }
  return false
}
