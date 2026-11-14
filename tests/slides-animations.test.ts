import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { parseElementAttrs } from "../src/compiler/scope-mapper"
import { buildSlidesDocument } from "../src/compiler/slides-ast-builder"
import { convertBlockToHtml } from "../src/export/markdown-renderer"
import {
  ATTR_ELEM_ANIM,
  ATTR_ELEM_ANIM_PROPS,
  ATTR_ELEM_MOTION,
} from "../src/types/slides-protocol"
import {
  startCountUp,
  startTypewriter,
  runSlideAnimations,
  resetSlideAnimations,
} from "../src/export/standalone-runtime-sections/animation-runtime"
import { FEATURE_FLAGS } from "../src/feature-flags/feature-flags"

function createMockEl(tag = "div", attrs: Record<string, string> = {}) {
  const children: any[] = []
  const classList = new Set<string>()
  const attributeMap: Record<string, string> = { ...attrs }
  const el: any = {
    tagName: tag.toUpperCase(),
    textContent: "",
    className: "",
    children,
    classList: {
      add: (c: string) => classList.add(c),
      remove: (c: string) => classList.delete(c),
      contains: (c: string) => classList.has(c),
    },
    getAttribute: (k: string) => attributeMap[k] ?? null,
    setAttribute: (k: string, v: string) => { attributeMap[k] = String(v) },
    removeAttribute: (k: string) => { delete attributeMap[k] },
    hasAttribute: (k: string) => k in attributeMap,
    querySelector: (sel: string) => {
      for (const child of children) {
        if (sel === ".slides-countup-target" && child.classList.contains("slides-countup-target")) return child
      }
      return null
    },
    querySelectorAll: (sel: string) => {
      const res: any[] = []
      if (sel === "[data-slides-anim]") {
        for (const child of children) {
          if (child.hasAttribute("data-slides-anim")) res.push(child)
        }
      }
      return res
    },
    appendChild: (child: any) => {
      children.push(child)
      return child
    },
  }
  return el
}

describe("Slides Animations (微动效与强调体系)", () => {
  beforeEach(() => {
    (globalThis as any).requestAnimationFrame = (fn: any) => setTimeout(fn, 10)
    ;(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id)
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

  describe("4. 轻量调度器运行时 (animation-runtime)", () => {
    it("CountUp 调度器能按预期设置初始文本并可提前取消", () => {
      const el = createMockEl("span")
      const cancel = startCountUp(el, {
        from: 0,
        to: 100,
        prefix: "$",
        suffix: "k",
        decimals: 1,
        duration: 1000,
      })
      expect(el.textContent).toBe("$0.0k")
      expect(typeof cancel).toBe("function")
      cancel()
    })

    it("Typewriter 调度器能清空并逐步打印文本，且支持提前取消", () => {
      const el = createMockEl("p")
      el.textContent = "待打字长句"
      const cancel = startTypewriter(el, "待打字长句", { duration: 800 })
      expect(el.textContent).toBe("")
      expect(typeof cancel).toBe("function")
      cancel()
    })

    it("runSlideAnimations 与 resetSlideAnimations 正常处理容器内的微动效节点", () => {
      const container = createMockEl("div")
      const node1 = createMockEl("div", {
        "data-slides-anim": "countup",
        "data-countup-from": "0",
        "data-countup-to": "99",
        "data-countup-suffix": "%",
      })
      node1.textContent = "99%"
      container.appendChild(node1)

      const cancelAll = runSlideAnimations(container)
      expect(typeof cancelAll).toBe("function")
      expect(node1.textContent).toBe("0%")

      resetSlideAnimations(container)
      expect(node1.textContent).toBe("99%")
      cancelAll()
    })

    it("带有 v-click-hidden 的节点在 runSlideAnimations 时被自动跳过", () => {
      const container = createMockEl("div")
      const node = createMockEl("div", {
        "data-slides-anim": "countup",
        "data-countup-to": "88",
      })
      node.classList.add("v-click-hidden")
      node.textContent = "原始未展示文本"
      container.appendChild(node)

      const cancelAll = runSlideAnimations(container)
      // 处于隐藏状态时不应被提前修改或触发调度
      expect(node.textContent).toBe("原始未展示文本")
      cancelAll()
    })
  })

  describe("5. Feature Flag 拦截行为", () => {
    it("当 isAnimationEnabled 关闭时，scope-mapper 不解析 anim 属性", () => {
      const originalFlag = FEATURE_FLAGS.advancedAnimations
      try {
        FEATURE_FLAGS.advancedAnimations = false
        const attrs = {
          [ATTR_ELEM_ANIM]: "countup",
          [ATTR_ELEM_ANIM_PROPS]: JSON.stringify({ to: 88 }),
        }
        const res = parseElementAttrs(attrs)
        expect(res.anim).toBeUndefined()
      } finally {
        FEATURE_FLAGS.advancedAnimations = originalFlag
      }
    })

    it("当特定动效被关闭时，仅该动效被忽略，其余正常解析", () => {
      const origPulse = FEATURE_FLAGS.animationEffects.pulse
      try {
        FEATURE_FLAGS.animationEffects.pulse = false
        const resPulse = parseElementAttrs({ [ATTR_ELEM_ANIM]: "pulse" })
        expect(resPulse.anim).toBeUndefined()

        const resFloat = parseElementAttrs({ [ATTR_ELEM_ANIM]: "float" })
        expect(resFloat.anim).toBeDefined()
        expect(resFloat.anim?.type).toBe("float")
      } finally {
        FEATURE_FLAGS.animationEffects.pulse = origPulse
      }
    })
  })
})
