import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

// 回归守卫：slides-client 静态页曾因「计算属性 nextSlide 与翻页函数 nextSlide() 同名」
// 触发 SyntaxError，整段内联脚本解析失败、Vue 应用从未挂载，放映视图呈现占位符
// 且按钮全部失效。此处对静态 HTML 的全部内联脚本做语法可解析性校验，
// 让同类致命错误在测试阶段即被拦截。

function extractInlineScripts(htmlPath: string): string[] {
  const html = readFileSync(htmlPath, "utf8")
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  return scripts.map(m => m[1]).filter(code => code.trim().length > 0)
}

function assertScriptsParse(htmlPath: string): void {
  const scripts = extractInlineScripts(htmlPath)
  expect(scripts.length).toBeGreaterThan(0)
  for (const code of scripts) {
    expect(() =>
      // eslint-disable-next-line no-new-func -- 内联脚本语法可解析性守卫
      new Function(code),
    ).not.toThrow()
  }
}

describe("slides-client 静态页内联脚本语法守卫", () => {
  it("index.html 内联脚本必须可完整解析", () => {
    assertScriptsParse(resolve(__dirname, "../public/slides-client/index.html"))
  })

  it("index.html 中的 cleanAndTransformInlineKramdown 与 formatInlineMarkdown 应正确渲染带 IAL 的图片", () => {
    const html = readFileSync(resolve(__dirname, "../public/slides-client/index.html"), "utf8")
    const helperStart = html.indexOf("function extractStyleFromKramdownAttrs(attrBody)")
    const helperEnd = html.indexOf("function renderMarkdownTable(tableLines)")
    expect(helperStart).toBeGreaterThan(-1)
    expect(helperEnd).toBeGreaterThan(helperStart)

    const snippet = html.slice(helperStart, helperEnd)
    const factory = new Function(`
      function escapeHtml(str) {
        return String(str || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
      }
      ${snippet}
      return { cleanAndTransformInlineKramdown, formatInlineMarkdown, BLOCK_MD_IMAGE_REGEX, extractCleanImageUrl }
    `)
    const { cleanAndTransformInlineKramdown, formatInlineMarkdown, BLOCK_MD_IMAGE_REGEX, extractCleanImageUrl } = factory()

    const resized = '![image](http://127.0.0.1:6806/assets/a(1).png){: style="width: 344px;"}'
    expect(cleanAndTransformInlineKramdown(resized)).toBe("![image](http://127.0.0.1:6806/assets/a(1).png)")
    const rendered = formatInlineMarkdown(resized)
    expect(rendered).toContain('<img alt="image" src="http://127.0.0.1:6806/assets/a(1).png" class="slide-inline-img" />')
    expect(rendered).not.toContain("!<a")
    expect(rendered).not.toContain("slides-link")
    expect(BLOCK_MD_IMAGE_REGEX.test(resized)).toBe(true)
    expect(extractCleanImageUrl('assets/foo.png "title"')).toBe("assets/foo.png")
  })
})
