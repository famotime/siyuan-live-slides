export const fetchSyncPost = async (_url: string, _data?: any) => ({ code: 0, data: null, msg: "" })
export const getFrontend = () => "desktop"
export const openTab = async () => {}
export class Plugin {
  app: any = {}
  name = "siyuan-live-slides"
  eventBus = { on: () => {}, off: () => {}, emit: () => {} }
  addIcons = () => {}
  addTopBar = () => {}
  addCommand = () => {}
  addTab = () => {}
  addDock = () => {}
}
export const showMessage = (_msg: string, ..._args: any[]) => {}
export const confirm = (
  _title: string,
  _text: string,
  confirmCallback?: (dialog?: any) => void,
  cancelCallback?: (dialog?: any) => void
) => {
  confirmCallback?.()
}
export const openWindow = (_options?: any) => {}
export class Protyle {
  destroy = () => {}
  disable = () => {}
  enable = () => {}
  resize = () => {}
}
export class Setting {
  items: any[] = []
  width?: string
  element: HTMLElement
  constructor(options?: { width?: string }) {
    this.width = options?.width
    this.element = typeof document !== "undefined" ? document.createElement("div") : ({} as any)
  }
  addItem(item: any) {
    this.items.push(item)
    if (item.actionElement && this.element && typeof this.element.appendChild === "function") {
      this.element.appendChild(item.actionElement)
    }
  }
}
