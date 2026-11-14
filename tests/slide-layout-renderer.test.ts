import { describe, expect, it } from "vitest"
import { renderSlideBlocksToHtml } from "../src/export/slide-layout-renderer"
import type { ISlidesVirtualPage } from "../src/types/slides-protocol"

describe("SlideLayoutRenderer (幻灯片版式容器渲染器)", () => {
  it("应支持 two-cols 自动二分或显式 right 插槽分栏", () => {
    const page: ISlidesVirtualPage = {
      pageIndex: 1,
      frontmatter: { layout: "two-cols" },
      blocks: [
        { id: "b1", rawMarkdown: "左侧内容 1" },
        { id: "b2", rawMarkdown: "右侧内容 2", slot: "right" },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(page)
    expect(html).toContain("layout-two-cols-grid")
    expect(html).toContain("pdf-col--left")
    expect(html).toContain("pdf-col--right")
    expect(html).toContain("左侧内容 1")
    expect(html).toContain("右侧内容 2")
  })

  it("应支持 two-cols-header 表头与双栏网格组合", () => {
    const page: ISlidesVirtualPage = {
      pageIndex: 2,
      frontmatter: { layout: "two-cols-header" },
      blocks: [
        { id: "h", type: "h", rawMarkdown: "# 页面大标题", slot: "header" },
        { id: "left", rawMarkdown: "左栏" },
        { id: "right", rawMarkdown: "右栏", slot: "right" },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(page)
    expect(html).toContain("layout-two-cols-header-container")
    expect(html).toContain("layout-header-section")
    expect(html).toContain("<h1>页面大标题</h1>")
    expect(html).toContain("pdf-col--left")
    expect(html).toContain("pdf-col--right")
  })

  it("应支持 image-right 与 image-left 图文版式", () => {
    const page: ISlidesVirtualPage = {
      pageIndex: 3,
      frontmatter: { layout: "image-right", image: "https://example.com/cover.png" },
      blocks: [
        { id: "b", rawMarkdown: "# 图文介绍" },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(page)
    expect(html).toContain("layout-image-cols-grid")
    expect(html).toContain("pdf-content-col")
    expect(html).toContain("pdf-image-col")
    expect(html).toContain("https://example.com/cover.png")
  })

  it("应支持 cover 与 fact 专属展示版式", () => {
    const coverPage: ISlidesVirtualPage = {
      pageIndex: 4,
      frontmatter: { layout: "cover" },
      blocks: [{ id: "c", rawMarkdown: "# 封面大字" }],
      rawMarkdown: "",
    }
    expect(renderSlideBlocksToHtml(coverPage)).toContain("layout-cover-container")

    const factPage: ISlidesVirtualPage = {
      pageIndex: 5,
      frontmatter: { layout: "fact" },
      blocks: [
        { id: "f1", rawMarkdown: "# 99.9%" },
        { id: "f2", rawMarkdown: "系统可用性 SLA" },
      ],
      rawMarkdown: "",
    }
    const factHtml = renderSlideBlocksToHtml(factPage)
    expect(factHtml).toContain("layout-fact-container")
    expect(factHtml).toContain("fact-value-wrapper")
    expect(factHtml).toContain("fact-label-wrapper")
  })

  it("应支持 fact 大字报列表模式（中英文冒号分割）并渲染多指标网格卡片", () => {
    const factPage: ISlidesVirtualPage = {
      pageIndex: 5,
      frontmatter: { layout: "fact" },
      blocks: [
        { id: "h", type: "h", rawMarkdown: "# 核心系统指标" },
        {
          id: "list",
          type: "l",
          rawMarkdown: "- 99.99%：核心服务高可用性保障 SLA\n- 45%: 测试性能优化提升",
        },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(factPage)
    expect(html).toContain("layout-fact-container")
    expect(html).toContain("fact-stats-grid--cols-2")
    expect(html).toContain("99.99%")
    expect(html).toContain("核心服务高可用性保障 SLA")
    expect(html).toContain("45%")
    expect(html).toContain("测试性能优化提升")
    expect(html).toContain("fact-stat-card")
    expect(html).toContain("fact-value-box")
    expect(html).toContain("fact-label-box")
  })

  it("应支持 quote 引言版式并自动识别出处署名", () => {
    const quotePage: ISlidesVirtualPage = {
      pageIndex: 6,
      frontmatter: { layout: "quote" },
      blocks: [
        { id: "q1", rawMarkdown: "保持饥渴，保持愚蠢。" },
        { id: "q2", rawMarkdown: "—— 史蒂夫·乔布斯" },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(quotePage)
    expect(html).toContain("layout-quote-container")
    expect(html).toContain("quote-watermark-icon")
    expect(html).toContain("quote-content-body")
    expect(html).toContain("quote-author")
    expect(html).toContain("史蒂夫·乔布斯")
  })

  it("应支持 intro 介绍版式并渲染头像与履历名片", () => {
    const introPage: ISlidesVirtualPage = {
      pageIndex: 7,
      frontmatter: { layout: "intro", image: "https://example.com/avatar.jpg" },
      blocks: [
        { id: "i1", rawMarkdown: "# 张三" },
        { id: "i2", rawMarkdown: "资深前端架构师" },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(introPage)
    expect(html).toContain("layout-intro-container")
    expect(html).toContain("intro-avatar-col")
    expect(html).toContain("intro-avatar-img")
    expect(html).toContain("https://example.com/avatar.jpg")
    expect(html).toContain("intro-info-col")
    expect(html).toContain("张三")
  })

  it("应支持 center 居中版式生成居中容器", () => {
    const centerPage: ISlidesVirtualPage = {
      pageIndex: 8,
      frontmatter: { layout: "center" },
      blocks: [{ id: "ct", rawMarkdown: "正中聚焦的一句话" }],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(centerPage)
    expect(html).toContain("layout-center-container")
    expect(html).toContain("正中聚焦的一句话")
  })

  it("应支持 timeline / steps 时间线步骤版式并生成节点与连接线", () => {
    const timelinePage: ISlidesVirtualPage = {
      pageIndex: 9,
      frontmatter: { layout: "timeline" },
      blocks: [
        { id: "h", type: "h", rawMarkdown: "# 数字化演进路线" },
        { id: "s1", rawMarkdown: "阶段一：系统上云" },
        { id: "s2", rawMarkdown: "阶段二：数据智能" },
        { id: "s3", rawMarkdown: "阶段三：AI 原生" },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(timelinePage)
    expect(html).toContain("layout-timeline-container")
    expect(html).toContain("layout-header-section")
    expect(html).toContain("数字化演进路线")
    expect(html).toContain("timeline-track-wrapper")
    expect(html).toContain("timeline-step-item")
    expect(html).toContain("timeline-node-badge")
    expect(html).toContain("timeline-connector-line")
    expect(html).toContain("阶段一：系统上云")
    expect(html).toContain("阶段三：AI 原生")
  })

  it("应支持 timeline / steps 单个复合列表块自动解构为多个步骤节点", () => {
    const timelinePage: ISlidesVirtualPage = {
      pageIndex: 10,
      frontmatter: { layout: "timeline" },
      blocks: [
        { id: "h", type: "h", rawMarkdown: "# SWOT 商业战略分析" },
        {
          id: "list-container",
          type: "l",
          rawMarkdown: "- 第 1 块：左上象限\n- 第 2 块：右上象限\n- 第 3 块：左下象限\n- 第 4 块：右下象限",
        },
      ],
      rawMarkdown: "",
    }
    const html = renderSlideBlocksToHtml(timelinePage)
    expect(html).toContain("SWOT 商业战略分析")
    expect(html).toContain('class="timeline-node-badge">1</div>')
    expect(html).toContain('class="timeline-node-badge">2</div>')
    expect(html).toContain('class="timeline-node-badge">3</div>')
    expect(html).toContain('class="timeline-node-badge">4</div>')
    expect(html).toContain("第 1 块：左上象限")
    expect(html).toContain("第 4 块：右下象限")
  })
})
