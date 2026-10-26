import { describe, expect, it } from "vitest"
import {
  PRESENTER_THUMB_BASE_WIDTH,
  computeThumbnailScale,
  parseSlideAspectRatio,
  renderPresenterSlideThumbnailHtml,
} from "../src/ui/tab/presenter-slide-thumbnail"
import type { ISlidevVirtualPage } from "../src/types/slidev-protocol"

describe("presenter-slide-thumbnail", () => {
  describe("parseSlideAspectRatio", () => {
    it("defaults to 16/9 (980x552)", () => {
      const res = parseSlideAspectRatio()
      expect(res.baseWidth).toBe(PRESENTER_THUMB_BASE_WIDTH)
      expect(res.baseHeight).toBe(552)
      expect(res.ratio).toBeCloseTo(16 / 9, 4)
    })

    it("supports 4/3 and 16/10 aspect ratios", () => {
      const r43 = parseSlideAspectRatio("4/3")
      expect(r43.baseWidth).toBe(980)
      expect(r43.baseHeight).toBe(735)

      const r1610 = parseSlideAspectRatio("16:10")
      expect(r1610.baseWidth).toBe(980)
      expect(r1610.baseHeight).toBe(613)
    })

    it("handles custom ratio strings and invalid inputs gracefully", () => {
      const custom = parseSlideAspectRatio("21/9", 1050)
      expect(custom.baseWidth).toBe(1050)
      expect(custom.baseHeight).toBe(450)

      const fallback = parseSlideAspectRatio("invalid-ratio")
      expect(fallback.baseWidth).toBe(980)
      expect(fallback.baseHeight).toBe(552)
    })
  })

  describe("computeThumbnailScale", () => {
    it("computes proportional scale fitting within container dimensions", () => {
      const metrics = computeThumbnailScale(506, 320, 980, 552, 16)
      // availW = 490 (490/980 = 0.5), availH = 304 (304/552 = 0.5507) -> min = 0.5
      expect(metrics.scale).toBeCloseTo(0.5, 3)
      expect(metrics.boxWidth).toBe(490)
      expect(metrics.boxHeight).toBe(276)
    })

    it("falls back safely when container dimensions are zero or negative", () => {
      const metrics = computeThumbnailScale(0, 0, 980, 552, 16)
      expect(metrics.scale).toBe(0.36)
      expect(metrics.boxWidth).toBe(Math.round(980 * 0.36))
      expect(metrics.boxHeight).toBe(Math.round(552 * 0.36))
    })
  })

  describe("renderPresenterSlideThumbnailHtml", () => {
    it("returns empty string for null or undefined slide", () => {
      expect(renderPresenterSlideThumbnailHtml(null)).toBe("")
      expect(renderPresenterSlideThumbnailHtml(undefined)).toBe("")
    })

    it("renders full multi-column cols-header slide with heading, text, video, and image without mutating source slide", () => {
      const slide: ISlidevVirtualPage = {
        pageIndex: 1,
        frontmatter: {
          layout: "cols-header",
          spacing: "compact",
          background: "linear-gradient(135deg, #1e293b, #0f172a)",
          zoom: 0.9,
        },
        blocks: [
          {
            blockId: "b-title",
            blockType: "h",
            subType: "h2",
            rawMarkdown: "## 混排超级块 1",
            content: "混排超级块 1",
            column: "header",
          },
          {
            blockId: "b-col1-list",
            blockType: "i",
            rawMarkdown: "* 111111111111111111",
            content: "111111111111111111",
            column: "col-1",
            isColFirst: true,
          },
          {
            blockId: "b-col1-video",
            blockType: "video",
            rawMarkdown: '<video src="/assets/demo.mp4" controls="controls"></video>',
            content: "",
            column: "col-1",
          },
          {
            blockId: "b-col2-list",
            blockType: "i",
            rawMarkdown: "* 22222222222222222",
            content: "22222222222222222",
            column: "col-2",
            isColFirst: true,
          },
          {
            blockId: "b-col2-img",
            blockType: "p",
            rawMarkdown: "![示意图](/assets/chart.png)",
            content: "![示意图](/assets/chart.png)",
            column: "col-2",
          },
        ],
      }

      const html = renderPresenterSlideThumbnailHtml(slide, {
        config: { spacing: "normal" },
        allSlides: [slide],
        pageIndex: 1,
      })

      // Layout wrapper & spacing & zoom & background
      expect(html).toContain('class="slide-content layout-cols-header spacing-compact"')
      expect(html).toContain("background:linear-gradient(135deg, #1e293b, #0f172a);")
      expect(html).toContain("transform:scale(0.9);")

      // Full slide content (header + columns + image + muted video without controls)
      expect(html).toContain("混排超级块 1")
      expect(html).toContain("layout-cols-header-container")
      expect(html).toContain("layout-cols-grid")
      expect(html).toContain("111111111111111111")
      expect(html).toContain("22222222222222222")
      expect(html).toContain('/assets/chart.png')
      expect(html).toContain("<video")
      expect(html).toContain("muted")
      expect(html).not.toContain("controls=")

      // Input slide object must not be mutated in place by column first-item cleanup
      expect(slide.blocks[1].rawMarkdown).toBe("* 111111111111111111")
      expect(slide.blocks[1].isColFirst).toBe(true)
    })

    it("inherits global config image on image-right layout when slide has no local image", () => {
      const slide: ISlidevVirtualPage = {
        pageIndex: 2,
        frontmatter: {
          layout: "image-right",
        },
        blocks: [
          {
            blockId: "b-1",
            blockType: "h",
            subType: "h2",
            rawMarkdown: "## 图右页面",
            content: "图右页面",
          },
          {
            blockId: "b-2",
            blockType: "p",
            rawMarkdown: "正文段落说明",
            content: "正文段落说明",
          },
        ],
      }

      const html = renderPresenterSlideThumbnailHtml(slide, {
        config: { image: "/assets/global-cover.png", spacing: "relaxed" },
      })

      expect(html).toContain("layout-image-right")
      expect(html).toContain("spacing-relaxed")
      expect(html).toContain("/assets/global-cover.png")
      expect(html).toContain("正文段落说明")
      expect(slide.frontmatter.image).toBeUndefined()
    })
  })
})
