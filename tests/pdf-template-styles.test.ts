import { describe, expect, it } from "vitest"
import {
  generatePdfExportStyles,
  getPageSizeCss,
} from "../src/export/pdf-template-styles"

describe("PDF Template Styles Generator (PDF 打印讲义样式生成器)", () => {
  it("应根据不同纸张比例正确生成 @page size 定义", () => {
    expect(getPageSizeCss("16:9")).toBe("size: 16in 9in;")
    expect(getPageSizeCss("4:3")).toBe("size: 12in 9in;")
    expect(getPageSizeCss("A4-landscape")).toBe("size: 297mm 210mm;")
    expect(getPageSizeCss("A4-portrait")).toBe("size: 210mm 297mm;")
    // 默认回退 16:9
    expect(getPageSizeCss(undefined as any)).toBe("size: 16in 9in;")
  })

  it("应生成包含基础重置、主题变量与纸张分页规则的样式表", () => {
    const css = generatePdfExportStyles({ pageRatio: "16:9" })
    expect(css).toContain("@page")
    expect(css).toContain("size: 16in 9in;")
    expect(css).toContain(".pdf-slide-page")
    expect(css).toContain("page-break-after: always;")
    expect(css).toContain("break-after: page;")
    expect(css).toContain("-webkit-print-color-adjust: exact !important;")
  })

  it("生成的样式表应包含多栏分栏布局与媒体展示规则", () => {
    const css = generatePdfExportStyles({ pageRatio: "A4-landscape" })
    expect(css).toContain("size: 297mm 210mm;")
    expect(css).toContain(".pdf-two-cols-wrapper")
    expect(css).toContain(".layout-two-cols-grid")
    expect(css).toContain(".pdf-three-cols-wrapper")
    expect(css).toContain(".layout-three-cols-grid")
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);")
    expect(css).toContain(".slide-media-container")
    expect(css).toContain(".slide-video-player")
  })

  it("生成的样式表应包含暗黑主题、间距类与思源引用标签样式", () => {
    const css = generatePdfExportStyles()
    expect(css).toContain(".pdf-slide-page.theme-dark")
    expect(css).toContain(".pdf-slide-page.spacing-compact")
    expect(css).toContain(".pdf-slide-page.spacing-loose")
    expect(css).toContain(".slides-ref-tag, a.slides-ref-tag")
    expect(css).toContain("border-bottom: 1px dashed currentColor")
  })
})
