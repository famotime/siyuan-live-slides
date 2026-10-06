export const fetchSyncPost = async (_url: string, _data?: any) => ({ code: 0, data: null, msg: "" })
export const getFrontend = () => "desktop"
export const openTab = async () => {}
export class Plugin {
  app: any = {}
  name = "siyuan-slidev"
  eventBus = { on: () => {}, off: () => {}, emit: () => {} }
  addIcons = () => {}
  addTopBar = () => {}
  addCommand = () => {}
  addTab = () => {}
  addDock = () => {}
}
export const showMessage = (_msg: string) => {}
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
