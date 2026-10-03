import { describe, expect, it } from "vitest"
import { CliDevServerBridge } from "../src/engine/cli-devserver-bridge"
import { buildPrintableHtml, triggerPdfExport } from "../src/export/pdf-exporter"
import { buildStandaloneHtml, downloadHtmlFile } from "../src/export/single-html-exporter"
import type { ISlidevDocument } from "../src/types/slidev-protocol"

const dummyDoc: ISlidevDocument = {
  docId: "doc-test-1",
  config: {
    theme: "default",
    aspectRatio: "16/9",
    highlighter: "shiki",
    defaultTransition: "fade",
    colorSchema: "auto",
  },
  slides: [
    {
      pageIndex: 1,
      startBlockId: "start-1",
      frontmatter: { layout: "cover" },
      notes: "这是第一页备注",
      blocks: [
        { id: "h1", type: "h", content: "主标题", rawMarkdown: "# 主标题" },
      ],
      rawMarkdown: "# 主标题",
    },
    {
      pageIndex: 2,
      startBlockId: "start-2",
      frontmatter: { layout: "two-cols" },
      notes: "",
      blocks: [
        { id: "p1", type: "p", content: "正文内容", rawMarkdown: "正文内容" },
      ],
      rawMarkdown: "正文内容",
    },
  ],
  fullMarkdown: "# 主标题\n\n---\n\n正文内容",
}

describe("Single-File HTML Exporter (单文件离线 HTML 导出)", () => {
  it("应生成自包含完整脱机演示 HTML 文档", () => {
    const html = buildStandaloneHtml(dummyDoc, { title: "年度技术汇报" })
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("<title>年度技术汇报</title>")
    expect(html).toContain("window.__SLIDEV_DATA__")
    expect(html).toContain("主标题")
    expect(html).toContain("doc-test-1")
    expect(html).toContain("layout-cover")
  })

  it("应支持将本地资产路径内联替换为 Base64 data URL", () => {
    const docWithImage: ISlidevDocument = {
      ...dummyDoc,
      slides: [
        {
          pageIndex: 1,
          startBlockId: "s1",
          frontmatter: {},
          notes: "",
          blocks: [
            { id: "img-1", type: "p", content: "", rawMarkdown: "![架构图](assets/arch.png)" },
          ],
          rawMarkdown: "![架构图](assets/arch.png)",
        },
      ],
    }

    const html = buildStandaloneHtml(docWithImage, {
      inlineAssetBase64Map: {
        "assets/arch.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      },
    })

    expect(html).toContain("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==")
    expect(html).not.toContain("assets/arch.png")
  })

  it("在非浏览器环境调用 downloadHtmlFile 应安全返回 false", () => {
    expect(downloadHtmlFile("demo.html", "<html></html>")).toBe(false)
  })
})

describe("PDF Exporter (高保真 PDF 讲义导出)", () => {
  it("应生成支持打印分页的 HTML 视窗结构", () => {
    const html = buildPrintableHtml(dummyDoc)
    expect(html).toContain("@page")
    expect(html).toContain("pdf-slide-page")
    expect(html).toContain("Page 1")
    expect(html).toContain("Page 2")
    expect(html).toContain("备注: 这是第一页备注")
  })

  it("在非浏览器环境调用 triggerPdfExport 应安全返回 false", () => {
    expect(triggerPdfExport(dummyDoc)).toBe(false)
  })
})

describe("CliDevServerBridge (Pro 模式本地 DevServer 桥接)", () => {
  it("应默认连接 3030 端口并支持配置", () => {
    const bridge = new CliDevServerBridge()
    expect(bridge.getUrl()).toBe("http://localhost:3030")

    bridge.setUrl("http://127.0.0.1:4000/")
    expect(bridge.getUrl()).toBe("http://127.0.0.1:4000")
  })

  it("在本地无服务时 probeServer 优雅返回 false", async () => {
    const bridge = new CliDevServerBridge("http://127.0.0.1:59999")
    const isAlive = await bridge.probeServer(200)
    expect(isAlive).toBe(false)
    expect(bridge.isServerConnected()).toBe(false)
  })
})
