import { describe, expect, it } from "vitest"
import fs from "fs"
import path from "path"
import { describePeekNetError } from "../src/ui/components/peek/WebviewPeekDrawer.vue"

const PROJECT_ROOT = path.resolve(__dirname, "..")
const DRAWER_PATH = path.join(PROJECT_ROOT, "src/ui/components/peek/WebviewPeekDrawer.vue")
const drawerSource = fs.readFileSync(DRAWER_PATH, "utf-8")

describe("速览抽屉代理继承：必须复用宿主默认 Session", () => {
  it("webview 不得声明 partition 属性", () => {
    // 思源桌面端本地内核模式以 --no-proxy-server 启动，且只用 setProxy 给主窗体 Session 下发
    // 「设置 → 网络代理」；Electron 的 session.setProxy 按 Session 生效，一旦使用 partition
    // 就会落到无代理的独立 Session，公司内网访问外网恒为空白页
    expect(drawerSource).not.toMatch(/<webview[\s\S]*?partition=/)
    expect(drawerSource).not.toContain("persist:slides-peek")
  })

  it("应保留 allowpopups 与 useragent 能力，并写明复用默认 Session 的原因", () => {
    expect(drawerSource).toMatch(/<webview[\s\S]*?allowpopups="true"/)
    expect(drawerSource).toMatch(/<webview[\s\S]*?:useragent="currentUserAgent"/)
    expect(drawerSource).toContain("--no-proxy-server")
    expect(drawerSource).toContain("不声明 partition")
  })
})

describe("速览抽屉加载失败诊断", () => {
  it("应监听 did-fail-load 与 did-fail-provisional-load 并在卸载时移除", () => {
    expect(drawerSource).toContain("wv.addEventListener('did-fail-load', onDidFailLoad)")
    expect(drawerSource).toContain("wv.addEventListener('did-fail-provisional-load', onDidFailLoad)")
    expect(drawerSource).toContain("wv.removeEventListener('did-fail-load', onDidFailLoad)")
    expect(drawerSource).toContain("wv.removeEventListener('did-fail-provisional-load', onDidFailLoad)")
  })

  it("应忽略子框架失败与主动打断（ERR_ABORTED = -3），重启加载时清空错误态", () => {
    expect(drawerSource).toContain("e.isMainFrame === false")
    expect(drawerSource).toContain("Number(e.errorCode) === -3")
    expect(drawerSource).toContain("loadError.value = null")
  })

  it("失败卡片应暴露错误码并同时提供重试与系统浏览器外跳", () => {
    expect(drawerSource).toContain("spm-load-error")
    expect(drawerSource).toContain("loadError.errorCode")
    expect(drawerSource).toContain("loadError.validatedURL")
    expect(drawerSource).toContain("retryAfterError")
  })

  it("describePeekNetError 应对代理类错误给出可操作提示", () => {
    expect(describePeekNetError("ERR_PROXY_CONNECTION_FAILED")).toContain("网络代理")
    expect(describePeekNetError("ERR_TUNNEL_CONNECTION_FAILED")).toContain("HTTPS")
    expect(describePeekNetError("ERR_MANDATORY_PROXY_CONFIGURATION_FAILED")).toContain("PAC")
    expect(describePeekNetError("ERR_NAME_NOT_RESOLVED")).toContain("域名解析失败")
    expect(describePeekNetError("ERR_NAME_RESOLUTION_FAILED")).toContain("域名解析失败")
    expect(describePeekNetError("ERR_CERT_AUTHORITY_INVALID")).toContain("证书")
    expect(describePeekNetError("ERR_CONNECTION_REFUSED")).toContain("内核")
    // 大小写不敏感
    expect(describePeekNetError("err_proxy_connection_failed")).toContain("网络代理")
    // 未知错误码回退到内网通用的代理排查提示，不臆测具体成因
    expect(describePeekNetError("ERR_SOMETHING_UNKNOWN")).toContain("设置 → 网络代理")
    expect(describePeekNetError("")).toContain("设置 → 网络代理")
  })
})

describe("速览抽屉代理相关的既有契约不回退", () => {
  it("iframe 降级分支与远程内核降级逻辑保持完好", () => {
    expect(drawerSource).toContain('sandbox="allow-scripts allow-same-origin allow-forms allow-popups"')
    expect(drawerSource).toContain("isDesktopEnvironment() && !isRemoteKernelHost()")
    // 地址栏仍需走 resolvePeekUrl 归一化
    expect(drawerSource).toContain("resolvePeekUrl(urlInputValue.value)")
  })
})
