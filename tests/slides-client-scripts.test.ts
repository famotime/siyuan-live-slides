import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

// 回归守卫：slides-client 静态页曾因「计算属性 nextSlide 与翻页函数 nextSlide() 同名」
// 触发 SyntaxError，整段内联脚本解析失败、Vue 应用从未挂载，演讲者视图呈现占位符
// 且按钮全部失效。此处对两份静态 HTML 的全部内联脚本做语法可解析性校验，
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
    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function(code)
    }).not.toThrow()
  }
}

describe("slides-client 静态页内联脚本语法守卫", () => {
  it("presenter.html 内联脚本必须可完整解析", () => {
    assertScriptsParse(resolve(__dirname, "../public/slides-client/presenter.html"))
  })

  it("index.html 内联脚本必须可完整解析", () => {
    assertScriptsParse(resolve(__dirname, "../public/slides-client/index.html"))
  })
})
