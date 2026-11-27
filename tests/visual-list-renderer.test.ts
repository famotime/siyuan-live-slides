import { describe, expect, it } from "vitest"
import {
  formatLeadContent,
  formatListItemContent,
  renderCompoundMarkdown,
  renderMarkdownList,
} from "../src/export/visual-list-renderer"

describe("VisualListRenderer (列表渲染器与复合块拆解)", () => {
  it("renderMarkdownList 应正确解析无序、有序与任务列表项", () => {
    const unorderedMd = "- 列表项 1\n- 列表项 2"
    const unHtml = renderMarkdownList(unorderedMd)
    expect(unHtml).toContain('<ul class="pdf-list pdf-list--unordered">')
    expect(unHtml).toContain("<li>列表项 1</li>")
    expect(unHtml).toContain("<li>列表项 2</li>")

    const orderedMd = "1. 第一项\n2. 第二项"
    const orHtml = renderMarkdownList(orderedMd)
    expect(orHtml).toContain('<ol class="pdf-list pdf-list--ordered">')
    expect(orHtml).toContain("<li>第一项</li>")
    expect(orHtml).toContain("<li>第二项</li>")

    const unpackedOrderedHtml = renderMarkdownList("2. 文档组织\n")
    expect(unpackedOrderedHtml).toContain('<ol class="pdf-list pdf-list--ordered" start="2">')
    expect(unpackedOrderedHtml).toContain("<li>文档组织</li>")

    const skippedOrderedHtml = renderMarkdownList("1. 父项\n  1. 子项\n3. 跳号项")
    expect(skippedOrderedHtml).toContain('value="1"')
    expect(skippedOrderedHtml).toContain('value="3"')

    const taskMd = "- [x] 已完成\n- [ ] 未完成"
    const taskHtml = renderMarkdownList(taskMd)
    expect(taskHtml).toContain('class="pdf-task-item"')
    expect(taskHtml).toContain('checked=""')
  })

  it("renderMarkdownList 应支持嵌套列表项与缩进层级样式", () => {
    const nestedMd = "- 父级 1\n  - 子级 1.1\n    - 孙级 1.1.1"
    const html = renderMarkdownList(nestedMd)
    expect(html).toContain("slide-list-item--nested")
    expect(html).toContain("margin-left:1.25em")
    expect(html).toContain("margin-left:2.50em")
  })

  it("renderMarkdownList 应支持列表项下属多媒体资源 (GIF / 图片 / 视频)", () => {
    const mediaMd = "- 功能演示\n  ![演示动画](demo.gif)\n  <video src=\"test.mp4\"></video>"
    const html = renderMarkdownList(mediaMd)
    expect(html).toContain("slide-list-media")
    expect(html).toContain("list-item-gif")
    expect(html).toContain("slide-video-player")
  })

  it("renderCompoundMarkdown 应正确拆解复合 Markdown 块并组织标题与多媒体", () => {
    const compoundMd = "## 卡片主标题\n\n卡片描述段落\n\n![配图](card.png)"
    const html = renderCompoundMarkdown(compoundMd)
    expect(html).toContain('<h2 class="slide-list-item-title">卡片主标题</h2>')
    expect(html).toContain('<p class="slide-list-item-desc">卡片描述段落</p>')
    expect(html).toContain('slide-media-block')
  })
})
