import { describe, expect, it, beforeAll, afterAll } from "vitest"
import { parseElementAttrs } from "../src/compiler/scope-mapper"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { convertBlockToHtml } from "../src/export/markdown-renderer"
import {
  ATTR_ELEM_ANIM,
  ATTR_ELEM_ANIM_PROPS,
  ATTR_ELEM_MOTION,
} from "../src/types/slides-protocol"
import { getStandaloneClientRuntimeScript } from "../src/export/standalone-client-runtime"
import { FEATURE_FLAGS } from "../src/feature-flags/feature-flags"

describe("Slides Animations (微动效与强调体系)", () => {
  const origElementAnimations = JSON.parse(JSON.stringify(FEATURE_FLAGS.elementAnimations))

  beforeAll(() => {
    FEATURE_FLAGS.elementAnimations.entrance.enabled = true
    FEATURE_FLAGS.elementAnimations.emphasis.enabled = true
    FEATURE_FLAGS.elementAnimations.text.enabled = true
  })

  afterAll(() => {
    FEATURE_FLAGS.elementAnimations = JSON.parse(JSON.stringify(origElementAnimations))
  })

  describe("1. 属性解析 (scope-mapper)", () => {
    it("正确解析 custom-slides-anim 与 JSON 格式的 custom-slides-anim-props", () => {
      const attrs = {
        [ATTR_ELEM_ANIM]: "countup",
        [ATTR_ELEM_ANIM_PROPS]: JSON.stringify({
          to: 98.5,
          from: 0,
          suffix: "%",
          decimals: 1,
          duration: 1800,
        }),
      }
      const res = parseElementAttrs(attrs)
      expect(res.anim).toBeDefined()
      expect(res.anim?.type).toBe("countup")
      expect(res.anim?.to).toBe(98.5)
      expect(res.anim?.suffix).toBe("%")
      expect(res.anim?.decimals).toBe(1)
      expect(res.anim?.duration).toBe(1800)
    })

    it("容错解析分号分隔的旧版或手写 anim-props 键值对", () => {
      const attrs = {
        [ATTR_ELEM_ANIM]: "countup",
        [ATTR_ELEM_ANIM_PROPS]: "duration:1200;decimals:2;suffix:ms",
      }
      const res = parseElementAttrs(attrs)
      expect(res.anim).toBeDefined()
      expect(res.anim?.type).toBe("countup")
      expect(res.anim?.duration).toBe(1200)
      expect(res.anim?.decimals).toBe(2)
      expect(res.anim?.suffix).toBe("ms")
    })

    it("正确解析持续强调动效 (pulse, float, shimmer)", () => {
      for (const type of ["pulse", "float", "shimmer"]) {
        const res = parseElementAttrs({
          [ATTR_ELEM_ANIM]: type,
          [ATTR_ELEM_ANIM_PROPS]: JSON.stringify({ duration: 2500 }),
        })
        expect(res.anim).toBeDefined()
        expect(res.anim?.type).toBe(type)
        expect(res.anim?.duration).toBe(2500)
      }
    })
  })

  describe("2. AST 构建与挂载 (slides-ast-builder)", () => {
    it("编译文档节点时将 anim 属性挂载至 ISlidesBlockItem", () => {
      const blocks = [
        {
          id: "b-1",
          type: "p",
          content: "核心性能提升 85%",
          ial: {
            id: "b-1",
            [ATTR_ELEM_ANIM]: "countup",
            [ATTR_ELEM_ANIM_PROPS]: JSON.stringify({ to: 85, suffix: "%" }),
          },
        },
      ]
      const ast = buildSlidesDocument("doc-anim-test", {}, blocks as any)
      expect(ast.slides.length).toBeGreaterThan(0)
      const block = ast.slides[0].blocks.find((b) => b.id === "b-1")
      expect(block).toBeDefined()
      expect(block?.anim).toBeDefined()
      expect(block?.anim?.type).toBe("countup")
      expect(block?.anim?.to).toBe(85)
      expect(block?.anim?.suffix).toBe("%")
    })
  })

  describe("3. 渲染管线终态与类名生成 (markdown-renderer)", () => {
    it("正确生成强调动效类名 slides-anim-* 与内联时长样式", () => {
      const block: any = {
        id: "b-pulse",
        type: "p",
        content: "关键架构中枢",
        rawMarkdown: "关键架构中枢",
        anim: {
          type: "pulse",
          duration: 2000,
          delay: 200,
        },
      }
      const html = convertBlockToHtml(block, [
        { id: "p1", pageIndex: 1, frontmatter: {}, blocks: [block] },
      ] as any)
      expect(html).toContain("slides-anim-pulse")
      expect(html).toContain("--anim-duration:2s")
      expect(html).toContain("--anim-delay:0.2s")
    })

    it("Typewriter 动效在渲染时添加光标类名 slides-typewriter-cursor", () => {
      const block: any = {
        id: "b-typewriter",
        type: "p",
        content: "console.log('Hello SiYuan')",
        rawMarkdown: "console.log('Hello SiYuan')",
        anim: {
          type: "typewriter",
          duration: 1500,
        },
      }
      const html = convertBlockToHtml(block, [
        { id: "p1", pageIndex: 1, frontmatter: {}, blocks: [block] },
      ] as any)
      expect(html).toContain("slides-anim-typewriter")
      expect(html).toContain("slides-typewriter-cursor")
      expect(html).toContain("--anim-duration:1.5s")
    })
  })

  describe("4. 生产播放器运行时调度器 (slide-rendering 内联副本)", () => {
    // 生产播放器执行的 runSlideAnimations 位于 slide-rendering.ts 的运行时脚本内联副本中，
    // 此处直接对拼装后的生产脚本断言，避免再出现「测试测的是没在跑的代码」的假保障；
    // 精确字节级回归由 tests/standalone-runtime-sections.test.ts 的快照基线兜底。
    const script = getStandaloneClientRuntimeScript()

    it("运行时包含 runSlideAnimations 调度器并在进入页面时自动执行", () => {
      expect(script).toContain("function runSlideAnimations(container)")
      expect(script).toContain('container.querySelectorAll("[data-slides-anim]")')
      expect(script).toContain("runSlideAnimations(stage);")
    })

    it("CountUp 分支使用 easeOutExpo 曲线与生产选择器链（含 strong 回退）", () => {
      expect(script).toContain('"data-countup-to"')
      expect(script).toContain('"data-countup-from"')
      expect(script).toContain("easeOutExpo")
      expect(script).toContain('".slides-countup-target"')
      expect(script).toContain("strong")
    })

    it("Typewriter 分支基于 data-anim-original 原文逐步打印", () => {
      expect(script).toContain('animType === "typewriter"')
      expect(script).toContain('"data-anim-original"')
      expect(script).toContain("fullText.slice(0, idx)")
    })

    it("带有 v-click-hidden 的节点被调度器自动跳过", () => {
      expect(script).toContain('node.classList.contains("v-click-hidden")')
    })
  })

  describe("5. Feature Flag 拦截行为", () => {
    it("当文本动效分类关闭时，scope-mapper 不解析 anim 文本动效属性", () => {
      const originalFlag = FEATURE_FLAGS.elementAnimations.text.enabled
      try {
        FEATURE_FLAGS.elementAnimations.text.enabled = false
        const attrs = {
          [ATTR_ELEM_ANIM]: "countup",
          [ATTR_ELEM_ANIM_PROPS]: JSON.stringify({ to: 88 }),
        }
        const res = parseElementAttrs(attrs)
        expect(res.anim).toBeUndefined()
      } finally {
        FEATURE_FLAGS.elementAnimations.text.enabled = originalFlag
      }
    })

    it("当特定微动效预设被关闭时，仅该动效被忽略，其余正常解析", () => {
      const origPulse = FEATURE_FLAGS.elementAnimations.emphasis.effects.pulse
      try {
        FEATURE_FLAGS.elementAnimations.emphasis.effects.pulse = false
        const resPulse = parseElementAttrs({ [ATTR_ELEM_ANIM]: "pulse" })
        expect(resPulse.anim).toBeUndefined()

        const resFloat = parseElementAttrs({ [ATTR_ELEM_ANIM]: "float" })
        expect(resFloat.anim).toBeDefined()
        expect(resFloat.anim?.type).toBe("float")
      } finally {
        FEATURE_FLAGS.elementAnimations.emphasis.effects.pulse = origPulse
      }
    })
  })
})
