import { describe, expect, it } from "vitest"
import { buildPrintableHtml, triggerPdfExport } from "../src/export/pdf-exporter"
import {
  buildStandaloneHtml,
  downloadHtmlFile,
  extractDocAssetUrls,
  collectDocAssetsAsBase64Map,
  exportStandaloneHtml,
} from "../src/export/single-html-exporter"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import { getStandaloneClientRuntimeScript } from "../src/export/standalone-client-runtime"
import type { ISlidesDocument } from "../src/types/slides-protocol"

const dummyDoc: ISlidesDocument = {
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
}

describe("Single-File HTML Exporter (单文件离线 HTML 导出)", () => {
  it("应生成自包含完整脱机演示 HTML 文档", () => {
    const html = buildStandaloneHtml(dummyDoc, { title: "年度技术汇报" })
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("<title>年度技术汇报</title>")
    expect(html).toContain("window.__SLIDES_DATA__")
    expect(html).toContain("主标题")
    expect(html).toContain("doc-test-1")
    expect(html).toContain("layout-cover")
  })

  it("导出的独立 HTML 应包含 980px 基础画布尺寸与动态自适应缩放 updateScale 逻辑", () => {
    const html = buildStandaloneHtml(dummyDoc)
    expect(html).toContain("const baseWidth = 980")
    expect(html).toContain("function updateScale()")
    expect(html).toContain("--slides-slide-scale")
    expect(html).toContain("translate(-50%, -50%) scale(")
  })

  it("应支持将本地资产路径内联替换为 Base64 data URL", () => {
    const docWithImage: ISlidesDocument = {
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

  it("应支持按键名长度降序替换带 host 前缀的完整资产 URL，彻底避免前缀残留", () => {
    const docWithFullUrl: ISlidesDocument = {
      ...dummyDoc,
      slides: [
        {
          pageIndex: 1,
          startBlockId: "s1",
          frontmatter: {
            background: "https://127.0.0.1:9031/assets/stage-cover.jpg",
            image: "https://127.0.0.1:9031/assets/end-card.jpg",
          },
          notes: "",
          blocks: [
            { id: "img-1", type: "p", content: "", rawMarkdown: "![架构](https://127.0.0.1:9031/assets/stage-cover.jpg)" },
          ],
          rawMarkdown: "![架构](https://127.0.0.1:9031/assets/stage-cover.jpg)",
        },
      ],
    }

    const html = buildStandaloneHtml(docWithFullUrl, {
      inlineAssetBase64Map: {
        "assets/stage-cover.jpg": "data:image/jpeg;base64,SHORT_COVER",
        "https://127.0.0.1:9031/assets/stage-cover.jpg": "data:image/jpeg;base64,LONG_COVER",
        "https://127.0.0.1:9031/assets/end-card.jpg": "data:image/jpeg;base64,END_CARD",
      },
    })

    expect(html).toContain("data:image/jpeg;base64,LONG_COVER")
    expect(html).toContain("data:image/jpeg;base64,END_CARD")
    expect(html).not.toContain("https://127.0.0.1:9031data:image/jpeg;base64")
    expect(html).not.toContain("stage-cover.jpg")
  })

  it("extractDocAssetUrls 应能正确提取正文、版式与 frontmatter 中的各种本地资产路径", () => {
    const docWithMixedAssets: ISlidesDocument = {
      ...dummyDoc,
      config: {
        ...dummyDoc.config,
        background: "assets/global-bg.png",
      },
      slides: [
        {
          pageIndex: 1,
          startBlockId: "s1",
          frontmatter: {
            background: "https://127.0.0.1:9031/assets/cover.jpg",
            image: "./assets/sidebar.png",
          },
          notes: "备注里的图片 ![note](assets/note.png)",
          blocks: [
            {
              id: "b1",
              type: "p",
              content: "<img src=\"/assets/html-pic.png\">",
              rawMarkdown: "![md](assets/md-pic.png)",
              children: [
                {
                  id: "b2",
                  type: "p",
                  content: "纯文本",
                  rawMarkdown: "![nested](assets/nested.jpg)",
                },
              ],
            },
          ],
          rawMarkdown: "![md](assets/md-pic.png)",
        },
      ],
    }

    const urls = extractDocAssetUrls(docWithMixedAssets)
    expect(urls).toContain("assets/global-bg.png")
    expect(urls).toContain("https://127.0.0.1:9031/assets/cover.jpg")
    expect(urls).toContain("./assets/sidebar.png")
    expect(urls).toContain("assets/note.png")
    expect(urls).toContain("/assets/html-pic.png")
    expect(urls).toContain("assets/md-pic.png")
    expect(urls).toContain("assets/nested.jpg")
  })

  it("exportStandaloneHtml 应支持自动拉取并内联资产字典", async () => {
    const docWithAssets: ISlidesDocument = {
      ...dummyDoc,
      slides: [
        {
          pageIndex: 1,
          startBlockId: "s1",
          frontmatter: {
            background: "https://127.0.0.1:9031/assets/auto-bg.jpg",
          },
          notes: "",
          blocks: [
            { id: "b1", type: "p", content: "", rawMarkdown: "![img](assets/auto-body.png)" },
          ],
          rawMarkdown: "![img](assets/auto-body.png)",
        },
      ],
    }

    const mockFetcher = async (url: string) => {
      if (url.includes("auto-bg.jpg")) {
        return "data:image/jpeg;base64,MOCK_BG_DATA"
      }
      if (url.includes("auto-body.png")) {
        return "data:image/png;base64,MOCK_BODY_DATA"
      }
      return null
    }

    const html = await exportStandaloneHtml(docWithAssets, {
      title: "自动内联测试",
      fetcher: mockFetcher,
    })

    expect(html).toContain("data:image/jpeg;base64,MOCK_BG_DATA")
    expect(html).toContain("data:image/png;base64,MOCK_BODY_DATA")
    expect(html).not.toContain("auto-bg.jpg")
    expect(html).not.toContain("auto-body.png")
  })

  it("在非浏览器环境调用 downloadHtmlFile 应安全返回 false", () => {
    expect(downloadHtmlFile("demo.html", "<html></html>")).toBe(false)
  })

  it("导出的独立 HTML 应包含 Slidev 规范的超链接虚线底边与主题色块引用样式", () => {
    const html = buildStandaloneHtml(dummyDoc)
    expect(html).toContain("border-bottom: 1px dashed currentColor")
    expect(html).toContain(".slides-ref-tag, a.slides-ref-tag")
    expect(html).toContain("var(--slide-accent)")
  })

  it("导出的独立 HTML 应包含鼠标左键空白处左右翻页调度与页面组件排除逻辑", () => {
    const html = buildStandaloneHtml(dummyDoc)
    expect(html).toContain("if (e.button !== 0) return;")
    expect(html).toContain("const isComponent = targetEl.closest(")
    expect(html).toContain(".slide-block, .controls-bar")
    expect(html).toContain("const isLeft = e.clientX < window.innerWidth / 2;")
    expect(html).toContain("renderSlide(currentIndex - 1);")
    expect(html).toContain("renderSlide(currentIndex + 1);")
  })

  it("导出的独立 HTML 应包含间距系统 CSS 变量、分栏弹性链、contain 媒体与 Lightbox 模态", () => {
    const spacingDoc: ISlidesDocument = {
      ...dummyDoc,
      config: {
        ...dummyDoc.config,
        spacing: "compact",
      },
      slides: [
        {
          ...dummyDoc.slides[0],
          frontmatter: { layout: "three-cols-header", spacing: "loose" },
        },
      ],
    }
    const html = buildStandaloneHtml(spacingDoc)
    expect(html).toContain("--slides-padding-y")
    expect(html).toContain("--slides-header-gap")
    expect(html).toContain(".slide-content.spacing-compact")
    expect(html).toContain(".slide-content.spacing-normal")
    expect(html).toContain(".slide-content.spacing-loose")
    expect(html).toContain("object-fit: contain !important;")
    expect(html).toContain("cursor: zoom-in;")
    expect(html).toContain('id="slides-lightbox"')
    expect(html).toContain("openLightbox")
    expect(html).toContain("closeLightbox")
    expect(html).toContain('e.key === "Escape"')
  })

  it("generateStandaloneExportStyles 应生成包含主题、视口与媒体自适应的完整 CSS", () => {
    const css = generateStandaloneExportStyles()
    expect(css).toContain(":root")
    expect(css).toContain("--slide-bg")
    expect(css).toContain(".slides-theme-tech")
    expect(css).toContain(".slides-theme-seriph")
    expect(css).toContain("@keyframes slidesMotionFadeIn")
    expect(css).toContain(".slide-media-container")
  })

  it("getStandaloneClientRuntimeScript 应包含离线播放器自适应与交互按键逻辑", () => {
    const js = getStandaloneClientRuntimeScript()
    expect(js).toContain("updateScale")
    expect(js).toContain("renderSlide")
    expect(js).toContain("window.__SLIDES_DATA__")
    expect(js).toContain("btnPrev")
    expect(js).toContain("btnNext")
  })
})

describe("PDF Exporter (高保真 PDF 讲义导出)", () => {
  it("应生成支持打印分页的 HTML 视窗结构与默认页眉页脚", () => {
    const html = buildPrintableHtml(dummyDoc)
    expect(html).toContain("@page")
    expect(html).toContain("pdf-slide-page")
    expect(html).toContain("P. 1 / 2")
    expect(html).toContain("P. 2 / 2")
    expect(html).toContain("演讲备注:")
    expect(html).toContain("这是第一页备注")
    expect(html).toContain("size: 16in 9in;")
  })

  it("应正确支持配置项 (比例/暗黑主题/关闭备注与页码)", () => {
    const html = buildPrintableHtml(dummyDoc, {
      title: "产品发布会讲义",
      pageRatio: "A4-landscape",
      theme: "dark",
      showNotes: false,
      showPageNumber: false,
    })

    expect(html).toContain("<title>产品发布会讲义 - 高保真讲义</title>")
    expect(html).toContain("size: 297mm 210mm;")
    expect(html).toContain("theme-dark")
    expect(html).not.toContain("演讲备注:")
    expect(html).not.toContain("pdf-page-badge")
  })

  it("应正确渲染双栏布局 (two-cols) 与富文本块", () => {
    const richDoc: ISlidesDocument = {
      docId: "rich-1",
      config: dummyDoc.config,
      slides: [
        {
          pageIndex: 1,
          startBlockId: "s1",
          frontmatter: { layout: "two-cols" },
          notes: "",
          blocks: [
            { id: "b1", type: "h", content: "左栏标题", rawMarkdown: "## 左栏标题" },
            { id: "b2", type: "c", content: "const a = 1", rawMarkdown: "```ts\nconst a = 1\n```" },
            { id: "b3", type: "p", content: "右栏段落", rawMarkdown: "右栏段落 **粗体**", slot: "right" },
            { id: "b4", type: "p", content: "", rawMarkdown: "> 重要引言", slot: "right" },
          ],
          rawMarkdown: "",
        },
      ],
    }

    const html = buildPrintableHtml(richDoc)
    expect(html).toContain("pdf-two-cols-wrapper")
    expect(html).toContain("pdf-col--left")
    expect(html).toContain("pdf-col--right")
    expect(html).toContain("<h2>左栏标题</h2>")
    expect(html).toContain("pdf-code")
    expect(html).toContain("const a = 1")
    expect(html).toContain("<strong>粗体</strong>")
    expect(html).toContain("pdf-quote")
    expect(html).toContain("重要引言")
  })

  it("导出的 PDF 打印文档应支持间距预设类与分栏媒体 contain 样式", () => {
    const spacingDoc: ISlidesDocument = {
      ...dummyDoc,
      config: { ...dummyDoc.config, spacing: "compact" },
      slides: [
        {
          ...dummyDoc.slides[0],
          frontmatter: { layout: "three-cols-header", spacing: "loose" },
        },
      ],
    }
    const html = buildPrintableHtml(spacingDoc)
    expect(html).toContain("spacing-loose")
    expect(html).toContain(".pdf-slide-page.spacing-compact")
    expect(html).toContain(".pdf-slide-page.spacing-normal")
    expect(html).toContain(".pdf-slide-page.spacing-loose")
    expect(html).toContain("object-fit: contain !important;")
  })

  it("在非浏览器环境调用 triggerPdfExport 应安全返回 false", () => {
    expect(triggerPdfExport(dummyDoc)).toBe(false)
  })

  it("导出的 PDF 打印文档应包含 Slidev 规范的超链接虚线底边与主题色块引用样式", () => {
    const html = buildPrintableHtml(dummyDoc)
    expect(html).toContain("border-bottom: 1px dashed currentColor")
    expect(html).toContain(".slides-ref-tag, a.slides-ref-tag")
  })
})
