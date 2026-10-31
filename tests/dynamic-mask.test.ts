import { describe, expect, it } from "vitest"
import {
  parseMaskRatio,
  ATTR_PAGE_MASK,
  ATTR_PAGE_MASK_RATIO,
  ATTR_PAGE_MASK_STYLE,
  ATTR_PAGE_MASK_INITIAL,
} from "../src/types/slides-protocol"
import { parsePageAttrs } from "../src/compiler/scope-mapper"
import { parseSlidesPresentation } from "../src/compiler/slides-importer"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import { getStandaloneClientRuntimeScript } from "../src/export/standalone-client-runtime"
import { generatePdfExportStyles } from "../src/export/pdf-template-styles"

describe("Dynamic Mask (页面动态蒙版功能测试)", () => {
  describe("1. parseMaskRatio 比例解析与断点计算", () => {
    it("空值或非法输入应回退为默认 1:1（2 步等分）", () => {
      expect(parseMaskRatio("")).toEqual({ steps: 2, breakpoints: [50, 100] })
      expect(parseMaskRatio("   ")).toEqual({ steps: 2, breakpoints: [50, 100] })
      expect(parseMaskRatio(undefined)).toEqual({ steps: 2, breakpoints: [50, 100] })
      expect(parseMaskRatio("invalid:text")).toEqual({ steps: 2, breakpoints: [50, 100] })
    })

    it("等分比例应准确计算累计百分比断点", () => {
      // 1:1 -> 2步等分 [50, 100]
      const twoSteps = parseMaskRatio("1:1")
      expect(twoSteps.steps).toBe(2)
      expect(twoSteps.breakpoints).toEqual([50, 100])

      // 1:1:1 -> 3步等分 [33.33, 66.67, 100]
      const threeSteps = parseMaskRatio("1:1:1")
      expect(threeSteps.steps).toBe(3)
      expect(threeSteps.breakpoints).toEqual([33.33, 66.67, 100])

      // 1:1:1:1 -> 4步等分 [25, 50, 75, 100]
      const fourSteps = parseMaskRatio("1:1:1:1")
      expect(fourSteps.steps).toBe(4)
      expect(fourSteps.breakpoints).toEqual([25, 50, 75, 100])
    })

    it("非等分权重比例（如 1:2:1）应按权重累计归一化", () => {
      // 1:2:1 总权重 4 -> 1/4 (25%), 3/4 (75%), 4/4 (100%)
      const res = parseMaskRatio("1:2:1")
      expect(res.steps).toBe(3)
      expect(res.breakpoints).toEqual([25, 75, 100])

      // 1:3 总权重 4 -> 1/4 (25%), 4/4 (100%)
      const res2 = parseMaskRatio("1:3")
      expect(res2.steps).toBe(2)
      expect(res2.breakpoints).toEqual([25, 100])
    })

    it("直接输入绝对百分比断点（如 25:75:100 或 30:80）应精准保留", () => {
      const explicit = parseMaskRatio("25:75:100")
      expect(explicit.steps).toBe(3)
      expect(explicit.breakpoints).toEqual([25, 75, 100])

      // 30:80 若未写 100，自动以 100 作为完全展露终点
      const incomplete = parseMaskRatio("30:80")
      expect(incomplete.steps).toBe(3)
      expect(incomplete.breakpoints).toEqual([30, 80, 100])
    })

    it("单值边界处理", () => {
      expect(parseMaskRatio("50")).toEqual({ steps: 2, breakpoints: [50, 100] })
      expect(parseMaskRatio("100")).toEqual({ steps: 1, breakpoints: [100] })
    })
  })

  describe("2. AST 编译器与 Frontmatter 往返解析", () => {
    it("parsePageAttrs 应正确将 custom-slides-mask-* 属性映射到 frontmatter", () => {
      const ial = {
        [ATTR_PAGE_MASK]: "down",
        [ATTR_PAGE_MASK_RATIO]: "1:2:1",
        [ATTR_PAGE_MASK_STYLE]: "blur",
        [ATTR_PAGE_MASK_INITIAL]: "revealed",
      }

      const { frontmatter } = parsePageAttrs(ial)
      expect(frontmatter.mask).toBe("down")
      expect(frontmatter.maskRatio).toBe("1:2:1")
      expect(frontmatter.maskStyle).toBe("blur")
      expect(frontmatter.maskInitial).toBe("revealed")
    })

    it("importSlidevMarkdown 应将 Slidev Frontmatter 中的 mask 配置映射为思源块属性", () => {
      const md = `---
layout: default
mask: right
maskRatio: 25:75:100
maskStyle: blur
maskInitial: hidden
---

# 动态蒙版页面标题

正文段落第一段

正文段落第二段
`
      const imported = parseSlidesPresentation(md)
      expect(imported.slides.length).toBe(1)
      const pageAttrs = imported.slides[0].pageAttrs

      expect(pageAttrs[ATTR_PAGE_MASK]).toBe("right")
      expect(pageAttrs[ATTR_PAGE_MASK_RATIO]).toBe("25:75:100")
      expect(pageAttrs[ATTR_PAGE_MASK_STYLE]).toBe("blur")
      expect(pageAttrs[ATTR_PAGE_MASK_INITIAL]).toBe("hidden")
    })

    it("buildSlidesDocument 应支持生成包含 mask 的 Frontmatter", () => {
      const doc = buildSlidesDocument(
        "doc-mask-test",
        {},
        [
          {
            id: "divider-1",
            type: "tb",
            markdown: "---",
            ial: {
              [ATTR_PAGE_MASK]: "down",
              [ATTR_PAGE_MASK_RATIO]: "1:1:1",
              [ATTR_PAGE_MASK_STYLE]: "solid",
            },
          },
          {
            id: "heading-1",
            type: "h",
            markdown: "# 演示主标题",
          },
          {
            id: "p-1",
            type: "p",
            markdown: "这是受蒙版保护的第一段",
          },
        ],
        {},
      )

      expect(doc.slides.length).toBe(1)
      expect(doc.slides[0].frontmatter.mask).toBe("down")
      expect(doc.slides[0].frontmatter.maskRatio).toBe("1:1:1")
      expect(doc.slides[0].frontmatter.maskStyle).toBe("solid")
      expect(doc.slides[0].rawMarkdown).toContain("mask: down")
      expect(doc.slides[0].rawMarkdown).toMatch(/maskRatio:\s*["']?1:1:1["']?/)
      expect(doc.slides[0].rawMarkdown).toContain("maskStyle: solid")
    })
  })

  describe("3. 单文件 HTML 导出集成支持", () => {
    it("generateStandaloneExportStyles 应包含动态蒙版完整 CSS 规则与过渡样式", () => {
      const css = generateStandaloneExportStyles()
      expect(css).toContain(".slides-mask-body-container")
      expect(css).toContain(".slides-mask-body-container--has-mask")
      expect(css).toContain("contain: layout paint;")
      expect(css).toContain("isolation: isolate;")
      expect(css).toContain(".slides-mask-layer")
      expect(css).toContain(".slides-mask-overlay")
      expect(css).toContain("margin-left: calc(-1 * var(--slides-padding-x, 48px))")
      expect(css).toContain("margin-bottom: calc(-1 * var(--slides-padding-y, 32px))")
      expect(css).toContain("width: calc(100% + 2 * var(--slides-padding-x, 48px))")
      expect(css).toContain("backdrop-filter: blur(30px) saturate(180%);")
      expect(css).toContain("background: color-mix(in srgb, var(--slide-bg, #ffffff) 90%, transparent);")
    })

    it("getStandaloneClientRuntimeScript 应包含蒙版解析算法与步进状态调度，并在就绪时进行 GPU 预热", () => {
      const js = getStandaloneClientRuntimeScript()
      expect(js).toContain("parseMaskRatio")
      expect(js).toContain("currentMaskConfig")
      expect(js).toContain("updateMaskVisual")
      expect(js).toContain("requestAnimationFrame")
      expect(js).toContain("slides-mask-layer")
      expect(js).toContain("slides-mask-overlay")
      expect(js).toContain("slides-mask-divider-line")
      expect(js).toContain("goNext")
      expect(js).toContain("goPrev")
    })
  })

  describe("4. PDF 打印讲义导出规则", () => {
    it("generatePdfExportStyles 应在 @media print 中强制隐藏蒙版，保证内容完整可见", () => {
      const pdfCss = generatePdfExportStyles()
      expect(pdfCss).toContain(".slides-mask-layer")
      expect(pdfCss).toContain(".slides-mask-overlay")
      expect(pdfCss).toContain(".slides-mask-divider-line")
      expect(pdfCss).toContain("display: none !important;")
      expect(pdfCss).toContain("clip-path: none !important;")
    })
  })
})
