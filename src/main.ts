import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import type { Plugin } from 'siyuan'
import SlidevDockView from './ui/dock/SlidevDockView.vue'
import { WebSandboxBridge } from './engine/web-sandbox-bridge'
import type { ISlidevDocument } from './types/slidev-protocol'

let dockApp: VueApp | null = null
let dockComponentInstance: any = null
export const globalSandboxBridge = new WebSandboxBridge()

export function mountDock(element: HTMLElement, pluginInstance: Plugin): any {
  if (dockApp) {
    unmountDock(element)
  }

  dockApp = createApp(SlidevDockView)
  dockApp.provide('plugin', pluginInstance)
  dockApp.provide('sandboxBridge', globalSandboxBridge)

  const mounted = dockApp.mount(element)
  dockComponentInstance = mounted
  return mounted
}

export function unmountDock(element: HTMLElement): void {
  if (dockApp) {
    dockApp.unmount()
    dockApp = null
    dockComponentInstance = null
  }
}

export function updateDockDocument(doc: ISlidevDocument): void {
  if (dockComponentInstance?.updateDocument) {
    dockComponentInstance.updateDocument(doc)
  } else {
    // 即使 Dock 尚未渲染挂载，沙箱桥接器也会自动排队
    globalSandboxBridge.updateSlides(doc.slides, doc.config, doc.fullMarkdown)
  }
}

export function navigateDockToBlock(blockId: string): void {
  if (dockComponentInstance?.navigateToBlock) {
    dockComponentInstance.navigateToBlock(blockId)
  } else {
    globalSandboxBridge.highlightElement(blockId)
  }
}
