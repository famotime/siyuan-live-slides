/**
 * 跨端 Node.js / Electron 运行时自适应适配器
 * 统一桥接：
 * 1. 思源桌面端 Electron 渲染进程 (window.require / globalThis.require / window.siyuan)
 * 2. Node.js 测试环境 (Vitest / CLI)
 * 3. 纯浏览器/移动端无 Node 环境 (平滑降级)
 */

export type TRuntimeRequire = (id: string) => any

/**
 * 获取当前运行时中可用的 CommonJS require 函数
 */
export function getRuntimeRequire(): TRuntimeRequire | undefined {
  if (typeof window !== "undefined" && typeof (window as any).require === "function") {
    return (window as any).require.bind(window)
  }
  if (typeof globalThis !== "undefined" && typeof (globalThis as any).require === "function") {
    return (globalThis as any).require.bind(globalThis)
  }
  if (typeof require === "function") {
    return require
  }
  return undefined
}

/**
 * 安全加载 Node 原生模块（优先运行时动态 require，避免被打包工具静态裁剪）
 */
export function getRuntimeModule<T = any>(moduleName: string): T | undefined {
  const req = getRuntimeRequire()
  if (req) {
    try {
      return req(moduleName) as T
    } catch {
      try {
        const alt = moduleName.startsWith("node:") ? moduleName.slice(5) : `node:${moduleName}`
        return req(alt) as T
      } catch {}
    }
  }
  return undefined
}

/**
 * 获取底层真实的 process 对象（包含系统环境变量 versions 与 env）
 */
export function getRuntimeProcess(): NodeJS.Process | undefined {
  if (typeof window !== "undefined" && (window as any).process) {
    return (window as any).process
  }
  const procMod = getRuntimeModule<NodeJS.Process>("process")
  if (procMod && procMod.versions) {
    return procMod
  }
  if (typeof process !== "undefined" && process.versions?.node) {
    return process
  }
  return (globalThis as any).process
}

/**
 * 判断当前是否处于思源笔记桌面端客户端或支持 Node 调度的桌面环境
 */
export function isDesktopEnvironment(): boolean {
  const proc = getRuntimeProcess()
  if (proc && Boolean(proc.versions?.node)) {
    return true
  }

  // 处于思源桌面端（window.siyuan 存在且 window.require 具备）
  if (typeof window !== "undefined" && Boolean((window as any).siyuan)) {
    const cp = getRuntimeModule("child_process")
    if (cp && typeof cp.spawn === "function") {
      return true
    }
  }

  // Node 单元测试环境兜底
  if (typeof process !== "undefined" && Boolean(process.versions?.node)) {
    return true
  }

  return false
}

/**
 * 判断当前思源宿主是否连接远程内核（桌面端 ←→ 远程/容器内核）
 *
 * 桌面端在远程内核模式下的主窗体 URL 会附带 remote=1（app/electron/main.js 的
 * appURL.searchParams.set("remote", "1")），且该模式下主窗体 webPreferences 为
 * webviewTag: false 并注册了 will-attach-webview 拦截，<webview> 元素完全失效。
 * 判定方式与思源前端 app/src/util/hostCapabilities.ts 的 hasRemoteQuery 保持一致。
 */
export function isRemoteKernelHost(): boolean {
  if (typeof window === "undefined" || !window.location) {
    return false
  }
  try {
    return new URLSearchParams(window.location.search).get("remote") === "1"
  } catch {
    return false
  }
}

/**
 * 获取操作系统平台标识 (win32 | darwin | linux | web)
 */
export function getPlatform(): string {
  const proc = getRuntimeProcess()
  if (proc?.platform) {
    return proc.platform
  }
  if (typeof process !== "undefined" && process.platform) {
    return process.platform
  }
  const os = getRuntimeModule("os")
  if (os && typeof os.platform === "function") {
    return os.platform()
  }
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes("win")) return "win32"
    if (ua.includes("mac")) return "darwin"
    if (ua.includes("linux")) return "linux"
  }
  return "web"
}

/**
 * 解析思源虚拟数据路径至本地真实文件系统物理路径
 * 例如: /data/storage/petal/... -> D:/siyuan-plugin-test/data/storage/petal/...
 */
export function resolvePhysicalPath(virtualPath: string): string {
  if (!virtualPath) return ""

  // 如果已经是 Windows 盘符或绝对路径，直接返回
  if (/^[a-zA-Z]:[/\\]/.test(virtualPath)) {
    return virtualPath.replace(/\\/g, "/")
  }

  let dataDir = ""
  if (typeof window !== "undefined" && (window as any).siyuan?.config?.system?.dataDir) {
    dataDir = (window as any).siyuan.config.system.dataDir.replace(/\\/g, "/")
  }

  if (dataDir && virtualPath.startsWith("/data/")) {
    const sub = virtualPath.slice(6) // 去除 /data/
    return `${dataDir}/${sub}`.replace(/\\/g, "/")
  }

  return virtualPath
}
