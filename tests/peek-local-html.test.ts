import { describe, expect, it } from "vitest"
import fs from "fs"
import path from "path"
import {
  fileUrlToPath,
  isLocalHtmlHref,
  mapFilePathToKernelUrl,
  resolvePeekUrl,
  withHTMLAssetIFrameParam,
} from "../src/utils/peek-url"
import { isRemoteKernelHost } from "../src/engine/runtime-node"

const PROJECT_ROOT = path.resolve(__dirname, "..")
const SANDBOX_CLIENT_PATH = path.join(PROJECT_ROOT, "public/slides-client/index.html")

/**
 * 从源码文本中按花括号配平截取指定函数的完整定义
 */
function extractInlineFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`)
  if (start < 0) {
    throw new Error(`未找到内联函数: ${name}`)
  }
  let depth = 0
  let end = -1
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") {
      depth++
    } else if (source[i] === "}") {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end < 0) {
    throw new Error(`内联函数 ${name} 花括号未配平`)
  }
  return source.slice(start, end)
}

/**
 * 动态求值内联源码中的函数（剥离 TS 类型标注后可直接在 Node 中运行）
 */
function evalInlineFunction(source: string, name: string, isTypeScript = false): (href: string) => any {
  const raw = extractInlineFunction(source, name)
  const jsSource = isTypeScript ? raw.replace(/:\s*(string|boolean|number)\b/g, "") : raw
  return new Function(`${jsSource}; return ${name}`)() as (href: string) => any
}

const LOCAL_HTML_CASES: Array<[string, boolean]> = [
  // 应被拦截并转交抽屉
  ["assets/demo.html", true],
  ["./assets/demo.html", true],
  ["/assets/demo.html", true],
  ["/assets/demo.html?v=2", true],
  ["demo.html", true],
  ["docs/demo.htm", true],
  ["../docs/demo.html", true],
  ["D:\\SiYuan\\data\\assets\\demo.html", true],
  ["file:///D:/SiYuan/data/assets/demo.html", true],
  ["/plugins/siyuan-live-slides/slides-client/presenter.html", true],
  // 保持原生行为
  ["https://sli.dev/guide/index.html", false],
  ["http://localhost:8080/demo.html", false],
  ["//example.com/demo.html", false],
  ["#anchor-heading", false],
  ["mailto:demo@example.com", false],
  ["siyuan://blocks/20231005120000-abcdef1", false],
  ["assets/cover.png", false],
  ["", false],
]

const PEEK_URL_CASES: Array<[string, string, boolean]> = [
  // [输入, 期望加载地址, 是否外跳]
  ["https://sli.dev/guide/", "https://sli.dev/guide/", false],
  ["http://localhost:8080/demo.html", "http://localhost:8080/demo.html", false],
  ["//example.com/demo.html", "https://example.com/demo.html", false],
  // 本地 HTML 资源必须补 ?iframe=true，否则内核会加 Content-Disposition: attachment 触发下载
  ["assets/demo.html", "/assets/demo.html?iframe=true", false],
  ["./assets/demo.html", "/assets/demo.html?iframe=true", false],
  ["/assets/demo.html", "/assets/demo.html?iframe=true", false],
  ["assets/sub/demo.html", "/assets/sub/demo.html?iframe=true", false],
  ["/assets/demo.html?v=2", "/assets/demo.html?v=2&iframe=true", false],
  ["/assets/demo.html#top", "/assets/demo.html?iframe=true#top", false],
  ["/assets/demo.html?box=20260810000000-abcdefg", "/assets/demo.html?box=20260810000000-abcdefg&iframe=true", false],
  ["/assets/demo.html?iframe=true", "/assets/demo.html?iframe=true", false],
  ["/assets/demo.html?download=true", "/assets/demo.html?download=true", false],
  // 非 HTML 资源与插件目录资源无需该参数
  ["assets/cover.png", "/assets/cover.png", false],
  ["/plugins/siyuan-live-slides/slides-client/presenter.html", "/plugins/siyuan-live-slides/slides-client/presenter.html", false],
  ["demo.html", "/demo.html", false],
  ["./docs/demo.html", "/docs/demo.html", false],
  ["../docs/demo.html", "/docs/demo.html", false],
  // 工作区内的本地文件 → 内核静态服务
  ["file:///D:/SiYuan/data/assets/demo.html", "/assets/demo.html?iframe=true", false],
  ["file:///home/me/siyuan/data/assets/sub/demo.html", "/assets/sub/demo.html?iframe=true", false],
  ["file:///D:/SiYuan/data/assets/cover.png", "/assets/cover.png", false],
  ["file:///D:/SiYuan/data/plugins/foo/index.html", "/plugins/foo/index.html", false],
  ["D:\\SiYuan\\data\\assets\\demo.html", "/assets/demo.html?iframe=true", false],
  // 工作区之外的本地文件 → 外跳系统浏览器
  ["file:///home/me/Downloads/report.html", "file:///home/me/Downloads/report.html", true],
  ["D:\\Downloads\\report.html", "D:\\Downloads\\report.html", true],
  ["\\\\server\\share\\report.html", "\\\\server\\share\\report.html", true],
  ["mailto:demo@example.com", "mailto:demo@example.com", true],
  // 裸主机输入（地址栏场景）自动补全协议
  ["example.com", "https://example.com", false],
  ["localhost:8080", "https://localhost:8080", false],
  ["192.168.1.10:6806/stage/build/desktop/", "https://192.168.1.10:6806/stage/build/desktop/", false],
  ["www.example.com/index.html", "https://www.example.com/index.html", false],
  // 思源块协议与内联数据保持原样
  ["siyuan://blocks/20231005120000-abcdef1", "siyuan://blocks/20231005120000-abcdef1", false],
  ["data:text/html,<h1>hi</h1>", "data:text/html,<h1>hi</h1>", false],
  ["", "", false],
]

describe("本地 HTML 链接速览：URL 归一化 (peek-url)", () => {
  it("isLocalHtmlHref 应仅放行本地 HTML 链接，保持锚点/远端/其它协议的原生行为", () => {
    for (const [href, expected] of LOCAL_HTML_CASES) {
      expect(isLocalHtmlHref(href), `isLocalHtmlHref(${JSON.stringify(href)})`).toBe(expected)
    }
  })

  it("resolvePeekUrl 应将各类本地 HTML 地址收敛为抽屉内可加载的内核地址", () => {
    for (const [input, expectedUrl, expectedExternal] of PEEK_URL_CASES) {
      const resolution = resolvePeekUrl(input)
      expect(resolution.url, `resolvePeekUrl(${JSON.stringify(input)}).url`).toBe(expectedUrl)
      expect(resolution.external, `resolvePeekUrl(${JSON.stringify(input)}).external`).toBe(expectedExternal)
    }
  })

  it("mapFilePathToKernelUrl 应映射工作区资产与插件目录，工作区外文件返回 null", () => {
    expect(mapFilePathToKernelUrl("D:\\SiYuan\\data\\assets\\demo.html")).toBe("/assets/demo.html")
    expect(mapFilePathToKernelUrl("/home/me/siyuan/data/assets/a/b.html")).toBe("/assets/a/b.html")
    expect(mapFilePathToKernelUrl("/home/me/siyuan/data/plugins/foo/index.html")).toBe("/plugins/foo/index.html")
    // 中文与空格文件名需正确解码
    expect(mapFilePathToKernelUrl("D:\\SiYuan\\data\\assets\\%E6%BC%94%E7%A4%BA%20demo.html")).toBe(
      "/assets/演示 demo.html",
    )
    expect(mapFilePathToKernelUrl("/home/me/Downloads/report.html")).toBeNull()
    expect(mapFilePathToKernelUrl("")).toBeNull()
  })

  it("fileUrlToPath 应还原系统文件路径以适配 shell.openPath", () => {
    expect(fileUrlToPath("file:///D:/SiYuan/data/assets/demo.html")).toBe("D:/SiYuan/data/assets/demo.html")
    expect(fileUrlToPath("file:///home/me/Downloads/report.html")).toBe("/home/me/Downloads/report.html")
    expect(fileUrlToPath("file:///home/me/%E6%BC%94%E7%A4%BA.html")).toBe("/home/me/演示.html")
  })

  it("withHTMLAssetIFrameParam 应遵循内核 IsHTMLAssetIFrameSrc 约定（app/src/asset/html.ts 同款行为）", () => {
    // 内核仅在该参数存在时以 text/html 内联输出，否则强制附件下载
    expect(withHTMLAssetIFrameParam("/assets/a.html")).toBe("/assets/a.html?iframe=true")
    expect(withHTMLAssetIFrameParam("/assets/a.htm")).toBe("/assets/a.htm?iframe=true")
    expect(withHTMLAssetIFrameParam("assets/a.html")).toBe("assets/a.html?iframe=true")
    // 保留既有查询参数与锚点
    expect(withHTMLAssetIFrameParam("/assets/a.html?box=20260810000000-abcdefg")).toBe(
      "/assets/a.html?box=20260810000000-abcdefg&iframe=true",
    )
    expect(withHTMLAssetIFrameParam("/assets/a.html#sec-2")).toBe("/assets/a.html?iframe=true#sec-2")
    // 幂等
    expect(withHTMLAssetIFrameParam("/assets/a.html?iframe=true")).toBe("/assets/a.html?iframe=true")
    // 作者显式要求下载时保持原意图
    expect(withHTMLAssetIFrameParam("/assets/a.html?download=true")).toBe("/assets/a.html?download=true")
    // 非本地资产 HTML（远端地址、插件目录、非 HTML 资源）不加参数
    expect(withHTMLAssetIFrameParam("https://sli.dev/index.html")).toBe("https://sli.dev/index.html")
    expect(withHTMLAssetIFrameParam("/plugins/foo/index.html")).toBe("/plugins/foo/index.html")
    expect(withHTMLAssetIFrameParam("/assets/a.png")).toBe("/assets/a.png")
    expect(withHTMLAssetIFrameParam("/assets/a.pdf")).toBe("/assets/a.pdf")
  })
})

describe("速览抽屉：远程内核模式降级", () => {
  it("isRemoteKernelHost 应依据宿主主窗体 URL 的 remote=1 判定远程内核", () => {
    const previousWindow = (globalThis as any).window
    try {
      ;(globalThis as any).window = { location: { search: "" } }
      expect(isRemoteKernelHost()).toBe(false)

      ;(globalThis as any).window = { location: { search: "?remote=1" } }
      expect(isRemoteKernelHost()).toBe(true)

      ;(globalThis as any).window = { location: { search: "?foo=bar&remote=1&r=abc1234" } }
      expect(isRemoteKernelHost()).toBe(true)

      // 本地内核模式即便带 remote 参数（如导出窗口携带 origin）也不应误判
      ;(globalThis as any).window = { location: { search: "?remote=https%3A%2F%2Fexample.com" } }
      expect(isRemoteKernelHost()).toBe(false)
    } finally {
      ;(globalThis as any).window = previousWindow
    }
  })

  it("微型浏览器在远程内核模式下必须放弃 <webview> 改走 iframe 分支", () => {
    const drawerSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "src/ui/components/peek/WebviewPeekDrawer.vue"),
      "utf-8",
    )
    expect(drawerSource).toContain("isDesktopEnvironment() && !isRemoteKernelHost()")
  })
})

describe("本地 HTML 链接速览：客户端拦截器与宿主归一化逻辑一致性", () => {
  const sandboxSource = fs.readFileSync(SANDBOX_CLIENT_PATH, "utf-8")

  it("沙箱播放器应内置本地 HTML 判定与绝对化函数", () => {
    expect(sandboxSource).toContain("isPeekableLocalHtml")
    expect(sandboxSource).toContain("resolvePeekHref")
    expect(sandboxSource).toContain("本地 HTML 链接")
    // 必须把本地 HTML 链接转交宿主抽屉，而非在沙箱内原地跳转
    expect(sandboxSource).toContain("} else if (isPeekableLocalHtml(href)) {")
  })

  it("沙箱播放器内联判定函数应与 peek-url 的 isLocalHtmlHref 行为一致", () => {
    const inlinePredicate = evalInlineFunction(sandboxSource, "isPeekableLocalHtml")
    for (const [href, expected] of LOCAL_HTML_CASES) {
      expect(inlinePredicate(href), `沙箱内联判定 isPeekableLocalHtml(${JSON.stringify(href)})`).toBe(expected)
    }
  })

  it("沙箱内联的 resolvePeekHref 应把思源资产链接指向内核 /assets/ 静态服务", () => {
    const resolveHref = evalInlineFunction(sandboxSource, "resolvePeekHref", false)
    expect(resolveHref("assets/demo.html")).toBe("/assets/demo.html")
    expect(resolveHref("./assets/sub/demo.html")).toBe("/assets/sub/demo.html")
    expect(resolveHref("/assets/demo.html")).toBe("/assets/demo.html")
    // 非资产链接保持原样转交宿主
    expect(resolveHref("demo.html")).toBe("demo.html")
    expect(resolveHref("docs/demo.html")).toBe("docs/demo.html")
    expect(resolveHref("file:///D:/SiYuan/data/assets/demo.html")).toBe("file:///D:/SiYuan/data/assets/demo.html")
  })

  it("抽屉宿主与微型浏览器都应接入 resolvePeekUrl，工作区外文件外跳系统浏览器", () => {
    const tabSource = fs.readFileSync(path.join(PROJECT_ROOT, "src/ui/tab/SlidesPreviewTab.vue"), "utf-8")
    expect(tabSource).toContain("resolvePeekUrl(detail.target)")
    expect(tabSource).toContain("openLocalFileExternally")
    expect(tabSource).toContain("fileUrlToPath")

    const drawerSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "src/ui/components/peek/WebviewPeekDrawer.vue"),
      "utf-8",
    )
    expect(drawerSource).toContain("resolvePeekUrl(urlInputValue.value)")
    // 地址栏不再无脑补全 https://
    expect(drawerSource).not.toContain("target = `https://${target}`")
  })
})
