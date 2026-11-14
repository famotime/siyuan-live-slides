import { describe, expect, it } from "vitest"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import { generatePdfExportStyles, getPageSizeCss } from "../src/export/pdf-template-styles"

describe("Export Styles Golden Verification (RF-022 导出样式层解耦一致性保障)", () => {
  it("getPageSizeCss 应支持各种纸张比例并具备 16:9 兜底", () => {
    expect(getPageSizeCss("16:9")).toBe("size: 16in 9in;")
    expect(getPageSizeCss("4:3")).toBe("size: 12in 9in;")
    expect(getPageSizeCss("A4-landscape")).toBe("size: 297mm 210mm;")
    expect(getPageSizeCss("A4-portrait")).toBe("size: 210mm 297mm;")
    expect(getPageSizeCss(undefined)).toBe("size: 16in 9in;")
  })

  it("generateStandaloneExportStyles 输出应包含三大主题、全部核心版式与无 undefined 泄漏", () => {
    const css = generateStandaloneExportStyles()
    expect(typeof css).toBe("string")
    expect(css.length).toBeGreaterThan(10000)
    expect(css).not.toContain("undefined")
    expect(css).not.toContain("[object Object]")

    // 主题变量
    expect(css).toContain('[data-slides-theme="tech"]')
    expect(css).toContain('[data-slides-theme="seriph"]')
    expect(css).toContain('[data-slides-theme="apple-basic"]')

    // 版式样式规则
    expect(css).toContain("/* Fact 大字报版式")
    expect(css).toContain(".layout-fact")
    expect(css).toContain("/* Timeline / Steps 时间线")
    expect(css).toContain(".layout-timeline")
    expect(css).toContain("/* Quote 引言版式")
    expect(css).toContain(".layout-quote")
    expect(css).toContain("/* Intro 个人/章节介绍版式")
    expect(css).toContain(".layout-intro")

    // 独立播放器专有特性
    expect(css).toContain("/* Lightbox 大图与视频灯箱模态窗口 */")
    expect(css).toContain("/* 页面动态蒙版 (Dynamic Mask) GPU 合成器硬件加速体系 */")
  })

  it("generatePdfExportStyles 输出应包含 @page 尺寸定义、三主题与版式且无 undefined 泄漏", () => {
    const css = generatePdfExportStyles({ pageRatio: "16:9" })
    expect(typeof css).toBe("string")
    expect(css.length).toBeGreaterThan(8000)
    expect(css).not.toContain("undefined")
    expect(css).not.toContain("[object Object]")

    // 页面打印规则
    expect(css).toContain("@page {")
    expect(css).toContain("size: 16in 9in;")
    expect(css).toContain("-webkit-print-color-adjust: exact !important;")

    // 主题变量
    expect(css).toContain(".slides-theme-tech")
    expect(css).toContain(".slides-theme-seriph")
    expect(css).toContain(".slides-theme-apple-basic")

    // 版式样式规则
    expect(css).toContain(".layout-timeline")
    expect(css).toContain(".layout-quote")
    expect(css).toContain(".layout-intro")
  })
})
