import { describe, expect, it } from "vitest"
import fs from "fs"
import path from "path"
import {
  parseMaskRatio,
  isClockwiseMask,
  isCounterClockwiseMask,
  isClockMask,
  ATTR_PAGE_MASK,
  ATTR_PAGE_MASK_RATIO,
  ATTR_PAGE_MASK_STYLE,
  ATTR_PAGE_MASK_INITIAL,
  ATTR_PAGE_LAYOUT,
} from "../src/types/slides-protocol"
import { parsePageAttrs } from "../src/compiler/scope-mapper"
import { parseSlidesPresentation } from "../src/compiler/slides-importer"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { renderSlideBlocksToHtml } from "../src/export/slide-layout-renderer"
import { distributeNColumns } from "../src/compiler/directive-wrapper"
import { generateStandaloneExportStyles } from "../src/export/standalone-template-styles"
import { getStandaloneClientRuntimeScript } from "../src/export/standalone-client-runtime"
import { generatePdfExportStyles } from "../src/export/pdf-template-styles"

describe("Clover Clock Mask (四叶草排版时钟蒙版规范与功能测试)", () => {
  describe("1. 协议与类型定义及断点解析", () => {
    it("isClockwiseMask / isCounterClockwiseMask / isClockMask 工具函数判定", () => {
      expect(isClockwiseMask("clockwise")).toBe(true)
      expect(isClockwiseMask("cw")).toBe(true)
      expect(isClockwiseMask("counter-clockwise")).toBe(false)
      expect(isClockwiseMask("down")).toBe(false)

      expect(isCounterClockwiseMask("counter-clockwise")).toBe(true)
      expect(isCounterClockwiseMask("ccw")).toBe(true)
      expect(isCounterClockwiseMask("clockwise")).toBe(false)

      expect(isClockMask("clockwise")).toBe(true)
      expect(isClockMask("cw")).toBe(true)
      expect(isClockMask("counter-clockwise")).toBe(true)
      expect(isClockMask("ccw")).toBe(true)
      expect(isClockMask("down")).toBe(false)
      expect(isClockMask("right")).toBe(false)
      expect(isClockMask("")).toBe(false)
    })

    it("parseMaskRatio 在 defaultSteps=4 时空值或缺省回退为 4 象限 4 步等分", () => {
      const res = parseMaskRatio("", 4)
      expect(res.steps).toBe(4)
      expect(res.breakpoints).toEqual([25, 50, 75, 100])

      const res2 = parseMaskRatio(undefined, 4)
      expect(res2.steps).toBe(4)
      expect(res2.breakpoints).toEqual([25, 50, 75, 100])
    })

    it("parseMaskRatio 针对四步等分 1:1:1:1 应解析为 4 步 25% 递增", () => {
      const res = parseMaskRatio("1:1:1:1")
      expect(res.steps).toBe(4)
      expect(res.breakpoints).toEqual([25, 50, 75, 100])
    })

    it("parseMaskRatio 自定义非等分权重（如 1:2:1:2）应正确归一化计算", () => {
      // 总权重 6 -> 1/6 (16.67%), 3/6 (50%), 4/6 (66.67%), 6/6 (100%)
      const res = parseMaskRatio("1:2:1:2")
      expect(res.steps).toBe(4)
      expect(res.breakpoints).toEqual([16.67, 50, 66.67, 100])
    })
  })

  describe("2. AST 编译器与 Frontmatter 往返解析", () => {
    it("parsePageAttrs 应正确映射 clockwise / counter-clockwise 属性", () => {
      const { frontmatter } = parsePageAttrs({
        [ATTR_PAGE_LAYOUT]: "clover",
        [ATTR_PAGE_MASK]: "clockwise",
        [ATTR_PAGE_MASK_RATIO]: "1:1:1:1",
        [ATTR_PAGE_MASK_STYLE]: "blur",
        [ATTR_PAGE_MASK_INITIAL]: "revealed",
      })

      expect(frontmatter.layout).toBe("clover")
      expect(frontmatter.mask).toBe("clockwise")
      expect(frontmatter.maskRatio).toBe("1:1:1:1")
      expect(frontmatter.maskStyle).toBe("blur")
      expect(frontmatter.maskInitial).toBe("revealed")
    })

    it("buildSlidesDocument 应将四叶草时钟蒙版配置正确序列化至 Slidev Markdown Frontmatter", () => {
      const doc = buildSlidesDocument(
        "doc-clover-mask",
        {},
        [
          {
            id: "tb-1",
            type: "tb",
            markdown: "---",
            ial: {
              [ATTR_PAGE_LAYOUT]: "clover",
              [ATTR_PAGE_MASK]: "counter-clockwise",
              [ATTR_PAGE_MASK_STYLE]: "solid",
              [ATTR_PAGE_MASK_INITIAL]: "hidden",
            },
          },
          {
            id: "h-1",
            type: "h",
            markdown: "# 四叶草时钟蒙版标题",
          },
        ],
        {},
      )

      expect(doc.slides.length).toBe(1)
      const slide = doc.slides[0]
      expect(slide.frontmatter.layout).toBe("clover")
      expect(slide.frontmatter.mask).toBe("counter-clockwise")
      expect(slide.frontmatter.maskStyle).toBe("solid")
      expect(slide.frontmatter.maskInitial).toBe("hidden")
    })

    it("parseSlidesPresentation 导入 Slidev Markdown 应完整还原思源块属性", () => {
      const md = `---
layout: clover
mask: clockwise
maskRatio: 1:1:1:1
maskStyle: blur
maskInitial: revealed
---

# 标题
`
      const imported = parseSlidesPresentation(md)
      expect(imported.slides.length).toBe(1)
      const attrs = imported.slides[0].pageAttrs
      expect(attrs[ATTR_PAGE_LAYOUT]).toBe("clover")
      expect(attrs[ATTR_PAGE_MASK]).toBe("clockwise")
      expect(attrs[ATTR_PAGE_MASK_RATIO]).toBe("1:1:1:1")
      expect(attrs[ATTR_PAGE_MASK_STYLE]).toBe("blur")
      expect(attrs[ATTR_PAGE_MASK_INITIAL]).toBe("revealed")
    })
  })

  describe("3. 单文件 HTML 导出样式与客户端脚本生成", () => {
    it("generateStandaloneExportStyles 应包含时钟指针与时钟蒙版图层规则", () => {
      const css = generateStandaloneExportStyles()
      expect(css).toContain(".slides-mask-layer--clockwise")
      expect(css).toContain(".slides-mask-layer--counter-clockwise")
      expect(css).toContain(".slides-mask-layer--clock")
      expect(css).toContain(".slides-mask-divider-line--clock")
      expect(css).toContain("transform-origin: 0% 50%")
      expect(css).toContain("var(--slide-accent")
    })

    it("getStandaloneClientRuntimeScript 应包含时钟角度换算与 conic-gradient 扇形扫掠调度", () => {
      const script = getStandaloneClientRuntimeScript()
      expect(script).toContain("currentMaskConfig.isClock")
      expect(script).toContain("sweepDeg")
      expect(script).toContain("needleAngle")
      expect(script).toContain("conic-gradient(from 270deg")
      expect(script).toContain("conic-gradient(from 0deg")
      expect(script).toContain("webkitMaskImage")
      expect(script).toContain("maskImage")
      expect(script).toContain("slides-mask-divider-line--clock")
    })
  })

  describe("4. 内置 Web 沙箱客户端播放器 (public/slides-client/index.html)", () => {
    it("index.html 模板中应具备时钟蒙版样式与 conic-gradient 动态遮罩计算", () => {
      const htmlPath = path.join(__dirname, "..", "public", "slides-client", "index.html")
      const html = fs.readFileSync(htmlPath, "utf8")
      expect(html).toContain(".slides-mask-layer--clockwise")
      expect(html).toContain(".slides-mask-layer--counter-clockwise")
      expect(html).toContain(".slides-mask-divider-line--clock")
      expect(html).toContain("maskOverlayStyle")
      expect(html).toContain("conic-gradient(from 270deg")
      expect(html).toContain("conic-gradient(from 0deg")
      expect(html).toContain("transform-origin: 0% 50%")
    })
  })

  describe("5. PDF 打印讲义无遮挡导出", () => {
    it("generatePdfExportStyles 应在打印介质中完全禁用时钟蒙版图层与指针", () => {
      const pdfCss = generatePdfExportStyles()
      expect(pdfCss).toContain(".slides-mask-layer")
      expect(pdfCss).toContain(".slides-mask-overlay")
      expect(pdfCss).toContain(".slides-mask-divider-line")
      expect(pdfCss).toContain("display: none !important;")
      expect(pdfCss).toContain("mask: none !important;")
    })
  })

  describe("7. 遮罩不改变页面布局 & 多栏/四叶草残余插槽孤立块归位防御", () => {
    it("常规 default 版式启用 clockwise 时钟蒙版时，正文应保持全宽流式布局而非 2x2 网格", () => {
      const pageBlocks: any[] = [
        { id: "h1", type: "h", markdown: "# 一个产品经理的业余VibeCoding实践", content: "一个产品经理的业余VibeCoding实践" },
        { id: "c1", type: "b", markdown: "> GitHub 项目与提交分布可视化报告 - Quincy Zou", content: "GitHub 项目与提交分布可视化报告 - Quincy Zou" },
      ]
      const doc = buildSlidesDocument("doc-default-mask", {
        "custom-slides-layout": "default",
        "custom-slides-mask": "clockwise",
        "custom-slides-mask-ratio": "1:1:1:1",
      }, pageBlocks)

      const slide = doc.slides[0]
      expect(slide.frontmatter.layout).toBe("default")
      expect(slide.frontmatter.mask).toBe("clockwise")

      // 渲染为 HTML：不得包含 2x2 网格类 layout-clover-grid
      const html = renderSlideBlocksToHtml(slide)
      expect(html).not.toContain("layout-clover-grid")
      expect(html).not.toContain("pdf-clover-wrapper")
      expect(html).toContain("GitHub 项目与提交分布可视化报告")
    })

    it("单块正文即使残留 slot='right'，在 4 栏/四叶草下也绝不得被分配至第 4 栏（右下角），应安全归入第 1 栏", () => {
      const rem = [
        { id: "b1", slot: "right", rawMarkdown: "GitHub 项目与提交分布可视化报告" }
      ]
      // 4 栏分配
      const cols = distributeNColumns(rem, 4)
      expect(cols).toHaveLength(4)
      // 必须归入 cols[0]（左上首栏），绝不能留在 cols[3]（右下角）
      expect(cols[0]).toHaveLength(1)
      expect(cols[0][0].id).toBe("b1")
      expect(cols[1]).toHaveLength(0)
      expect(cols[2]).toHaveLength(0)
      expect(cols[3]).toHaveLength(0)
    })

    it("PageInspectorSection 中时钟蒙版方向按钮不再依赖 clover 版式，对所有版式开放", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("src/ui/components/PageInspectorSection.vue", "utf8")
      // 确认不再包含限制条件 v-if="pageLayout === 'clover'"
      expect(content).not.toContain("v-if=\"pageLayout === 'clover'\"")
      expect(content).toContain("selectClockMask('clockwise')")
      expect(content).toContain("selectClockMask('counter-clockwise')")
    })

    it("顺时针时钟蒙版初始状态分界线必须位于左侧水平位置（-180deg），首步旋转至上方竖直位置（-90deg）", async () => {
      const fs = await import("fs")
      const clientHtml = fs.readFileSync("public/slides-client/index.html", "utf8")
      // 确认 CSS 默认分界线在 -180deg
      expect(clientHtml).toContain("transform: translateY(-50%) rotate(-180deg);")
      // 确认 parseMaskRatio 在 defaultSteps=4 且输入 '1:1' 时，自动升级为 4 步每步 25%
      const r = parseMaskRatio("1:1", 4)
      expect(r.steps).toBe(4)
      expect(r.breakpoints).toEqual([25, 50, 75, 100])
    })

    it("蒙版未完成步进时（hasPendingMaskSteps）点击第二/三分区链接或组件区域直接推进下一步，无需点击页面两侧空白", async () => {
      const fs = await import("fs")
      const clientHtml = fs.readFileSync("public/slides-client/index.html", "utf8")
      expect(clientHtml).toContain("hasPendingMaskSteps")
      expect(clientHtml).toContain("currentSlideMaskConfig.value && (currentStep.value < maxStepInCurrentSlide.value)")
      expect(clientHtml).toContain("nextStepOrSlide()")
    })

    it("PageInspectorSection 选中顺时针或逆时针选项时默认自动选择 1:1:1:1 4步比例并允许手工调整", async () => {
      const fs = await import("fs")
      const content = fs.readFileSync("src/ui/components/PageInspectorSection.vue", "utf8")
      expect(content).toContain("defaultMaskRatio")
      expect(content).toContain("effectiveMaskRatio")
      expect(content).toContain("isClockMask")
      expect(content).toContain("emit('update:pageMaskRatio', '1:1:1:1')")
    })
  })
})
