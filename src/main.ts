import {
  Plugin,
} from "siyuan"
import { createApp } from 'vue'
import App from './App.vue'

let plugin: Plugin | null = null
export function usePlugin(pluginProps?: Plugin): Plugin {
  if (pluginProps) {
    plugin = pluginProps
  }
  return plugin!
}


let app: any = null
export function init(pluginInstance: Plugin) {
  // 绑定插件实例
  usePlugin(pluginInstance)

  const div = document.createElement('div')
  div.classList.toggle('plugin-sample-vite-vue-app')
  div.id = pluginInstance.name
  app = createApp(App)
  app.mount(div)
  document.body.appendChild(div)
}

export function destroy() {
  if (app) {
    app.unmount()
  }
  if (plugin) {
    const div = document.getElementById(plugin.name)
    if (div) {
      document.body.removeChild(div)
    }
  }
}
