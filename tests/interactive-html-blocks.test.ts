import fs from "fs"
import path from "path"
import vm from "vm"
import { describe, expect, it, vi } from "vitest"
import { WebSandboxBridge } from "../src/engine/web-sandbox-bridge"
import { buildStandaloneHtml } from "../src/export/single-html-exporter"
import type { ISlidesDocument } from "../src/types/slides-protocol"

describe("Native Slidev Interactive HTML Blocks & Icons", () => {
  const snippet1 = `<div @click="$slidev.nav.next" class="mt-12 py-1" hover:bg="white op-10">
  Press Space for next page <carbon:arrow-right />
</div>`

  const snippet2 = `<div class="abs-br m-6 text-xl">
  <button @click="$slidev.nav.openInEditor()" title="Open in Editor" class="slidev-icon-btn">
    <carbon:edit />
  </button>
  <a href="https://github.com/slidevjs/slidev" target="_blank" class="slidev-icon-btn">
    <carbon:logo-github />
  </a>
</div>`

  it("should verify Web Sandbox assets and HTML script integrity", () => {
    const indexPath = path.resolve(__dirname, "../public/slides-client/index.html")
    const unocssPath = path.resolve(__dirname, "../public/slides-client/assets/unocss.attributify.global.js")
    const vuePath = path.resolve(__dirname, "../public/slides-client/assets/vue.global.prod.js")

    expect(fs.existsSync(indexPath)).toBe(true)
    expect(fs.existsSync(unocssPath)).toBe(true)
    expect(fs.existsSync(vuePath)).toBe(true)

    const indexHtml = fs.readFileSync(indexPath, "utf-8")
    expect(indexHtml).toContain("unocss.attributify.global.js")
    expect(indexHtml).toContain(".slidev-icon-btn")
    expect(indexHtml).toContain(".abs-br")
    expect(indexHtml).toContain("carbon:arrow-right")
    expect(indexHtml).toContain("carbon:edit")
    expect(indexHtml).toContain("carbon:logo-github")
    expect(indexHtml).toContain("slide-block-renderer")
    expect(indexHtml).toContain("openInEditor")
    expect(indexHtml).toContain("$slidev")
  })

  it("should successfully compile user snippets in Vue runtime environment", () => {
    const vueCode = fs.readFileSync(
      path.resolve(__dirname, "../public/slides-client/assets/vue.global.prod.js"),
      "utf-8",
    )
    const sandboxCtx: any = {}
    vm.runInNewContext(vueCode, sandboxCtx)

    const Vue = sandboxCtx.Vue
    expect(typeof Vue.compile).toBe("function")

    // 编译 snippet 1
    const processed1 = snippet1.replace(/<(carbon:[a-zA-Z0-9_-]+)\s*\/>/g, "<$1></$1>")
    const render1 = Vue.compile(processed1)
    expect(typeof render1).toBe("function")

    // 编译 snippet 2
    const processed2 = snippet2.replace(/<(carbon:[a-zA-Z0-9_-]+)\s*\/>/g, "<$1></$1>")
    const render2 = Vue.compile(processed2)
    expect(typeof render2).toBe("function")
  })

  it("should handle OPEN_IN_EDITOR action in WebSandboxBridge", () => {
    const bridge = new WebSandboxBridge()
    const handler = vi.fn()
    const unbind = bridge.onOpenInEditor(handler)

    // 模拟 message 事件派发
    const mockEvent = {
      data: {
        source: "siyuan-slides-client",
        action: "OPEN_IN_EDITOR",
        payload: {
          blockId: "20231019-abc1234",
          currentPage: 3,
        },
      },
    } as MessageEvent

    ;(bridge as any).handleWindowMessage(mockEvent)
    expect(handler).toHaveBeenCalledWith("20231019-abc1234", 3)

    unbind()
    ;(bridge as any).handleWindowMessage(mockEvent)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("should render icons and styles in Standalone HTML export", () => {
    const mockDoc: ISlidesDocument = {
      docId: "doc-1",
      config: { theme: "default", aspectRatio: "16/9" },
      fullMarkdown: "",
      slides: [
        {
          pageIndex: 1,
          startBlockId: "block-1",
          frontmatter: { layout: "cover" },
          rawMarkdown: "",
          blocks: [
            {
              id: "b-1",
              type: "html",
              content: snippet1,
              rawMarkdown: snippet1,
            },
            {
              id: "b-2",
              type: "html",
              content: snippet2,
              rawMarkdown: snippet2,
            },
          ],
        },
      ],
    }

    const html = buildStandaloneHtml(mockDoc, { title: "测试交互幻灯片" })
    expect(html).toContain(".slidev-icon-btn")
    expect(html).toContain(".abs-br")
    expect(html).toContain("slide-block--absolute")
    expect(html).toContain("flex-direction: row")
    expect(html).toContain(".slide-block > div + div")
    expect(html).toContain("CARBON_MAP")
    expect(html).toContain("<svg viewBox=\"0 0 32 32\"")
    expect(html).toContain("nav.next")
  })

  it("should not hijack markdown list containing text 'v-click' as dynamic vue component", () => {
    const listRaw = `- ✨ **步长灵活掌控**：支持对列表项、正文段落及栏内组件设置逐步呈现（\`v-click\`）步长
- 🚀 **四种灵动微动效**：内置上浮（\`slide-up\`）、淡入（\`fade-in\`）、缩放（\`zoom-in\`）与微弹跳（\`bounce\`）`

    const mockDoc: ISlidesDocument = {
      docId: "doc-list-vclick",
      config: { theme: "default", aspectRatio: "16/9" },
      fullMarkdown: "",
      slides: [
        {
          pageIndex: 1,
          startBlockId: "block-list",
          frontmatter: { layout: "default" },
          rawMarkdown: listRaw,
          blocks: [
            {
              id: "b-list-1",
              type: "l",
              isListItem: true,
              content: listRaw,
              rawMarkdown: listRaw,
            },
          ],
        },
      ],
    }

    const html = buildStandaloneHtml(mockDoc, { title: "测试列表 v-click 规避" })
    expect(html).toContain("isListBlock")
    expect(html).toContain("isInteractiveVue")
    expect(html).toContain("步长灵活掌控")
  })
})
