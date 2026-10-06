import type { Component } from "vue"
import { createApp } from "vue"

export * from "./markdown-utils"

/**
 * 将 Vue 组件挂载并返回对应的原生 DOM 容器
 */
export function getDomByVueComponent(component: Component): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("getDomByVueComponent can only be run in DOM environments")
  }
  const div = document.createElement("div")
  const app = createApp(component)
  app.mount(div)
  return div
}
