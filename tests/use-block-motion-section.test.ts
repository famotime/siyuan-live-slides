import { describe, expect, it, beforeEach, afterEach, afterAll, vi } from "vitest"
import { reactive } from "vue"
import { useBlockMotionSection } from "../src/ui/components/useBlockMotionSection"
import { MOTION_PRESETS } from "../src/ui/components/motion-presets"
import { FEATURE_FLAGS } from "../src/feature-flags/feature-flags"

/**
 * useBlockMotionSection 领域测试
 *
 * 覆盖：入场动效解析（字符串/JSON/none/损坏 JSON）、乐观预设选择与负载组装、
 * 强调与文本动效 Tab 切换、CountUp 字段推导与内容自动提取、试播舞台重播驱动。
 */

function createHarness(overrides: Partial<{
  elemMotion: string
  elemAnim: string
  elemAnimProps: string
  activeBlockContent: string
}> = {}) {
  const emitted: Array<{ event: string; args: any[] }> = []
  // 模拟父组件 v-model：emit 后同步更新响应式源状态，使派生值随发射联动
  const state = reactive({
    elemMotion: overrides.elemMotion ?? "",
    elemAnim: overrides.elemAnim ?? "",
    elemAnimProps: overrides.elemAnimProps as string | undefined,
    activeBlockContent: overrides.activeBlockContent as string | undefined,
  })
  const emit = ((event: string, ...args: any[]) => {
    emitted.push({ event, args })
    if (event === "update:elemMotion") state.elemMotion = args[0]
    if (event === "update:elemAnim") {
      state.elemAnim = args[0]
      if (args[1] !== undefined) state.elemAnimProps = args[1]
    }
  }) as any
  const source = {
    elemMotion: () => state.elemMotion,
    elemAnim: () => state.elemAnim,
    elemAnimProps: () => state.elemAnimProps,
    activeBlockContent: () => state.activeBlockContent,
  }
  const section = useBlockMotionSection(source, emit)
  return { section, emitted, emit }
}

describe("useBlockMotionSection (块级动效领域解耦)", () => {
  const origElementAnimations = JSON.parse(JSON.stringify(FEATURE_FLAGS.elementAnimations))

  beforeEach(() => {
    // 默认测试上下文开启全部动效，确保领域方法与试播舞台功能完整受测
    FEATURE_FLAGS.elementAnimations.entrance.enabled = true
    FEATURE_FLAGS.elementAnimations.emphasis.enabled = true
    FEATURE_FLAGS.elementAnimations.text.enabled = true

    vi.useFakeTimers()
    // node 环境无 rAF：用 16ms 定时器模拟帧驱动
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as any)
    vi.stubGlobal("cancelAnimationFrame", (id: any) => clearTimeout(id))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  afterAll(() => {
    FEATURE_FLAGS.elementAnimations = JSON.parse(JSON.stringify(origElementAnimations))
  })

  describe("motionPresetOptions (预设选项派生自 motion-presets 单一来源)", () => {
    it("应从 MOTION_PRESETS 派生 7 项入场预设选项，label/value 与预设保持同步", () => {
      const { section } = createHarness()
      expect(section.motionPresetOptions.value.length).toBe(MOTION_PRESETS.length)
      for (const preset of MOTION_PRESETS) {
        expect(section.motionPresetOptions.value).toContainEqual({ label: preset.label, value: preset.name })
      }
    })
  })

  describe("parsedMotion (入场动效解析)", () => {
    it("空字符串与 none 应解析为 null", () => {
      const empty = createHarness({ elemMotion: "" })
      expect(empty.section.parsedMotion.value).toBeNull()
      const none = createHarness({ elemMotion: "none" })
      expect(none.section.parsedMotion.value).toBeNull()
      const blank = createHarness({ elemMotion: "  " })
      expect(blank.section.parsedMotion.value).toBeNull()
    })

    it("JSON 对象负载应解析出 preset/duration/delay，缺失字段回退默认", () => {
      const full = createHarness({ elemMotion: JSON.stringify({ preset: "zoom-in", duration: 600, delay: 200 }) })
      expect(full.section.parsedMotion.value).toEqual({ preset: "zoom-in", duration: 600, delay: 200 })
      const partial = createHarness({ elemMotion: JSON.stringify({ type: "bounce" }) })
      expect(partial.section.parsedMotion.value).toEqual({ preset: "bounce", duration: 0, delay: 0 })
    })

    it("损坏 JSON 与纯字符串预设应回退为字符串预设形态", () => {
      const broken = createHarness({ elemMotion: "{invalid json" })
      expect(broken.section.parsedMotion.value).toEqual({ preset: "{invalid json", duration: 0, delay: 0 })
      const plain = createHarness({ elemMotion: "slide-left" })
      expect(plain.section.parsedMotion.value).toEqual({ preset: "slide-left", duration: 0, delay: 0 })
    })
  })

  describe("乐观预设选择与负载组装", () => {
    it("selectPreset 应立即生效 currentPreset（乐观更新）并发射 update:elemMotion", () => {
      const { section, emitted } = createHarness({ elemMotion: "slide-up" })
      section.selectPreset("fade-in")
      expect(section.currentPreset.value).toBe("fade-in")
      const last = emitted[emitted.length - 1]
      expect(last.event).toBe("update:elemMotion")
      expect(last.args[0]).toBe("fade-in")
    })

    it("带时长与延时的预设选择应组装为 JSON 负载", () => {
      const { section, emitted } = createHarness()
      section.handleMotionChange({ preset: "zoom-in", duration: 600, delay: 150 })
      const motionCall = emitted.find(e => e.event === "update:elemMotion")
      expect(motionCall).toBeTruthy()
      const payload = JSON.parse(motionCall!.args[0])
      expect(payload).toEqual({ preset: "zoom-in", duration: 600, delay: 150 })
    })

    it("零时长零延时应发射纯字符串预设而非 JSON", () => {
      const { section, emitted } = createHarness()
      section.handleMotionChange({ preset: "bounce", duration: 0, delay: 0 })
      const motionCall = emitted.find(e => e.event === "update:elemMotion")
      expect(motionCall!.args[0]).toBe("bounce")
    })

    it("none 预设应发射空字符串以清除属性", () => {
      const { section, emitted } = createHarness({ elemMotion: "slide-up" })
      section.handleMotionChange({ preset: "none", duration: 0, delay: 0 })
      const motionCall = emitted.find(e => e.event === "update:elemMotion")
      expect(motionCall!.args[0]).toBe("")
    })

    it("selectPreset 应同时清除强调/文本动效属性", () => {
      const { section, emitted } = createHarness({ elemAnim: "pulse", elemAnimProps: "{}" })
      section.selectPreset("fade-in")
      const animCall = emitted.find(e => e.event === "update:elemAnim")
      expect(animCall).toBeTruthy()
      expect(animCall!.args[0]).toBe("")
    })

    it("updateDuration / updateDelay 应保留当前预设并只调整对应字段", () => {
      const { section, emitted } = createHarness({ elemMotion: "slide-up" })
      section.updateDuration(800)
      let payload = JSON.parse(emitted.find(e => e.event === "update:elemMotion")!.args[0])
      expect(payload).toEqual({ preset: "slide-up", duration: 800 })
      section.updateDelay(300)
      payload = JSON.parse(emitted.find(e => e.event === "update:elemMotion" && e.args[0]!.includes("delay"))!.args[0])
      expect(payload).toEqual({ preset: "slide-up", duration: 800, delay: 300 })
    })
  })

  describe("总开关与 Tab 切换", () => {
    it("toggleAllMotion 在无动效时应默认开启入场 slide-up", () => {
      const { section, emitted } = createHarness()
      expect(section.hasAnyMotion.value).toBe(false)
      section.toggleAllMotion()
      const motionCall = emitted.find(e => e.event === "update:elemMotion")
      expect(motionCall!.args[0]).toBe("slide-up")
    })

    it("toggleAllMotion 在已有动效时应清空入场与强调/文本属性", () => {
      const { section, emitted } = createHarness({ elemMotion: "slide-up", elemAnim: "pulse" })
      section.toggleAllMotion()
      const events = emitted.filter(e => e.event === "update:elemMotion" || e.event === "update:elemAnim")
      expect(events.some(e => e.event === "update:elemMotion" && e.args[0] === "")).toBe(true)
      expect(events.some(e => e.event === "update:elemAnim" && e.args[0] === "")).toBe(true)
    })

    it("switchAnimTab('entrance') 应切换到入场并清除强调属性", () => {
      const { section, emitted } = createHarness({ elemAnim: "pulse", elemAnimProps: "{}" })
      section.switchAnimTab("entrance")
      expect(section.activeAnimTab.value).toBe("entrance")
      const animCall = emitted.find(e => e.event === "update:elemAnim")
      expect(animCall!.args[0]).toBe("")
    })

    it("switchAnimTab('emphasis') 应按 Feature Flags 优先级选择 pulse 并保留时长", () => {
      const { section, emitted } = createHarness({ elemAnim: "countup", elemAnimProps: JSON.stringify({ duration: 1800 }) })
      section.switchAnimTab("emphasis")
      expect(section.activeAnimTab.value).toBe("emphasis")
      const animCall = emitted.find(e => e.event === "update:elemAnim")
      expect(animCall!.args[0]).toBe("pulse")
      const props = JSON.parse(animCall!.args[1])
      expect(props.duration).toBe(1800)
    })

    it("setEmphasisType 应清除入场动效并发射强调类型与合并后的属性", () => {
      const { section, emitted } = createHarness({ elemMotion: "slide-up", elemAnimProps: JSON.stringify({ duration: 3000 }) })
      section.setEmphasisType("shimmer")
      const motionCall = emitted.find(e => e.event === "update:elemMotion")
      expect(motionCall!.args[0]).toBe("")
      const animCall = emitted.find(e => e.event === "update:elemAnim")
      expect(animCall!.args[0]).toBe("shimmer")
      expect(JSON.parse(animCall!.args[1]).duration).toBe(3000)
    })

    it("setAnimDuration 应仅调整当前动效类型的 duration", () => {
      const { section, emitted } = createHarness({ elemAnim: "float", elemAnimProps: "{}" })
      section.setAnimDuration(1200)
      const animCall = emitted.find(e => e.event === "update:elemAnim")
      expect(animCall!.args[0]).toBe("float")
      expect(JSON.parse(animCall!.args[1])).toEqual({ duration: 1200 })
    })
  })

  describe("CountUp 字段推导与内容自动提取", () => {
    it("countUpProps 应为缺失字段提供安全默认值", () => {
      const { section } = createHarness({ elemAnim: "countup", elemAnimProps: "{}" })
      expect(section.countUpProps.value).toEqual({ from: 0, to: 0, prefix: "", suffix: "", decimals: 0, duration: 1500 })
    })

    it("updateCountUpField 应发射合并后的 countup 属性", () => {
      const { section, emitted } = createHarness({ elemAnim: "countup", elemAnimProps: "{}" })
      section.updateCountUpField("to", 99)
      const animCall = emitted.find(e => e.event === "update:elemAnim")
      expect(animCall!.args[0]).toBe("countup")
      const props = JSON.parse(animCall!.args[1])
      expect(props.to).toBe(99)
      expect(props.duration).toBe(1500)
    })

    it("autoExtractFromContent 应从块内容中提取数字与前后缀、推导小数位", () => {
      const { section, emitted } = createHarness({ activeBlockContent: "增长率达 85.5%" })
      section.autoExtractFromContent()
      const animCall = emitted.find(e => e.event === "update:elemAnim")
      expect(animCall!.args[0]).toBe("countup")
      expect(JSON.parse(animCall!.args[1])).toEqual({ from: 0, to: 85.5, prefix: "", suffix: "%", decimals: 1, duration: 1500 })
    })

    it("setTextAnimType('countup') 在无既有参数时应触发内容自动提取", () => {
      const { section, emitted } = createHarness({ activeBlockContent: "共 1,200 名用户" })
      section.setTextAnimType("countup")
      const animCall = emitted.find(e => e.event === "update:elemAnim")
      expect(animCall!.args[0]).toBe("countup")
      const props = JSON.parse(animCall!.args[1])
      expect(props.to).toBe(1200)
      expect(props.decimals).toBe(0)
    })

    it("setTextAnimType('typewriter') 应清除入场动效并发射 typewriter", () => {
      const { section, emitted } = createHarness({ elemMotion: "slide-up" })
      section.setTextAnimType("typewriter")
      const motionCall = emitted.find(e => e.event === "update:elemMotion")
      expect(motionCall!.args[0]).toBe("")
      const animCall = emitted.find(e => e.event === "update:elemAnim")
      expect(animCall!.args[0]).toBe("typewriter")
    })
  })

  describe("试播舞台 (Live Preview Stage)", () => {
    it("selectPreset 应递增 stagePlayKey 触发舞台重播", () => {
      const { section } = createHarness({ elemMotion: "slide-up" })
      const before = section.stagePlayKey.value
      section.selectPreset("fade-in")
      expect(section.stagePlayKey.value).toBeGreaterThan(before)
    })

    it("countup 试播应在动画完成后收敛到目标值", () => {
      const { section } = createHarness({ elemAnim: "countup", elemAnimProps: JSON.stringify({ from: 0, to: 100, decimals: 0, duration: 300 }) })
      section.replayLiveStage()
      expect(section.currentStageCountUpValue.value).toBe("0")
      vi.advanceTimersByTime(400)
      expect(section.currentStageCountUpValue.value).toBe("100")
    })

    it("typewriter 试播应在动画完成后输出截断后的完整文本", () => {
      const { section } = createHarness({ elemAnim: "typewriter", elemAnimProps: "{}", activeBlockContent: "# 短标题文本" })
      section.replayLiveStage()
      vi.advanceTimersByTime(6000)
      expect(section.currentStageTypewriterText.value).toBe("短标题文本")
    })

    it("activeMotionSummaryBadge 应按 Tab 输出对应摘要", () => {
      const entrance = createHarness({ elemMotion: "slide-up" })
      expect(entrance.section.activeMotionSummaryBadge.value).toContain("上浮")
      const emphasis = createHarness({ elemAnim: "pulse", elemAnimProps: "{}" })
      expect(emphasis.section.activeMotionSummaryBadge.value).toContain("呼吸微光")
    })

    it("entranceStageStyle 应输出时长与延时 CSS 变量，默认值 450ms", () => {
      const withCustom = createHarness({ elemMotion: JSON.stringify({ preset: "fade-in", duration: 700, delay: 120 }) })
      expect(withCustom.section.entranceStageStyle.value).toEqual({
        "--motion-duration": "700ms",
        "--motion-delay": "120ms",
      })
      const fallback = createHarness({ elemMotion: "slide-up" })
      expect(fallback.section.entranceStageStyle.value["--motion-duration"]).toBe("450ms")
    })

    it("emphasisStageStyle 应输出强调周期 CSS 变量", () => {
      const { section } = createHarness({ elemAnim: "pulse", elemAnimProps: JSON.stringify({ duration: 3600 }) })
      expect(section.emphasisStageStyle.value).toEqual({ "--emphasis-duration": "3600ms" })
    })

    it("activeTabTitle 应按 Tab 输出标题文案", () => {
      const entrance = createHarness()
      expect(entrance.section.activeTabTitle.value).toBe("入场微动效")
      entrance.section.switchAnimTab("emphasis")
      expect(entrance.section.activeTabTitle.value).toBe("持续强调动效")
    })
  })

  describe("Feature Flags 细粒度控制 (全部关闭与部分关闭 tab 显示逻辑)", () => {
    const origConfig = JSON.parse(JSON.stringify(FEATURE_FLAGS.elementAnimations))

    afterEach(() => {
      FEATURE_FLAGS.elementAnimations = JSON.parse(JSON.stringify(origConfig))
    })

    it("1. 默认全部开启时：availableAnimTabs 包含 3 项且 showTabSwitch 为 true (显示 tab 切换栏)", () => {
      FEATURE_FLAGS.elementAnimations.entrance.enabled = true
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = true
      FEATURE_FLAGS.elementAnimations.text.enabled = true
      const { section } = createHarness()
      expect(section.availableAnimTabs.value).toEqual(["entrance", "emphasis", "text"])
      expect(section.showTabSwitch.value).toBe(true)
      expect(section.hasAnyMotionFeatureEnabled.value).toBe(true)
      expect(section.isEntranceEnabled.value).toBe(true)
      expect(section.hasEmphasisEffects.value).toBe(true)
      expect(section.hasTextEffects.value).toBe(true)
    })

    it("2. 部分关闭 (开启 2 项)：showTabSwitch 仍为 true，tab 仅包含开启项", () => {
      FEATURE_FLAGS.elementAnimations.entrance.enabled = true
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = false
      FEATURE_FLAGS.elementAnimations.text.enabled = true
      const { section } = createHarness()
      expect(section.availableAnimTabs.value).toEqual(["entrance", "text"])
      expect(section.showTabSwitch.value).toBe(true)
      expect(section.isEntranceEnabled.value).toBe(true)
      expect(section.hasEmphasisEffects.value).toBe(false)
      expect(section.hasTextEffects.value).toBe(true)

      // 切换已被关闭的 tab 应被拦截
      section.switchAnimTab("emphasis")
      expect(section.activeAnimTab.value).not.toBe("emphasis")
    })

    it("3. 部分关闭 (仅开启 1 项)：showTabSwitch 为 false (不显示 tab 切换栏)，直接生效该分类", () => {
      // 场景 A：仅保留入场过渡
      FEATURE_FLAGS.elementAnimations.entrance.enabled = true
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = false
      FEATURE_FLAGS.elementAnimations.text.enabled = false

      const harnessEntrance = createHarness()
      expect(harnessEntrance.section.availableAnimTabs.value).toEqual(["entrance"])
      expect(harnessEntrance.section.showTabSwitch.value).toBe(false) // 不显示 tab
      expect(harnessEntrance.section.activeAnimTab.value).toBe("entrance")

      // 场景 B：仅保留持续强调
      FEATURE_FLAGS.elementAnimations.entrance.enabled = false
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = true
      FEATURE_FLAGS.elementAnimations.text.enabled = false

      const harnessEmphasis = createHarness()
      expect(harnessEmphasis.section.availableAnimTabs.value).toEqual(["emphasis"])
      expect(harnessEmphasis.section.showTabSwitch.value).toBe(false) // 不显示 tab
      expect(harnessEmphasis.section.activeAnimTab.value).toBe("emphasis")

      // 场景 C：仅保留文本动效
      FEATURE_FLAGS.elementAnimations.entrance.enabled = false
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = false
      FEATURE_FLAGS.elementAnimations.text.enabled = true

      const harnessText = createHarness()
      expect(harnessText.section.availableAnimTabs.value).toEqual(["text"])
      expect(harnessText.section.showTabSwitch.value).toBe(false) // 不显示 tab
      expect(harnessText.section.activeAnimTab.value).toBe("text")
    })

    it("4. 全部关闭 (3 项均关闭)：showTabSwitch 为 false (不显示 tab)，hasAnyMotionFeatureEnabled 为 false", () => {
      FEATURE_FLAGS.elementAnimations.entrance.enabled = false
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = false
      FEATURE_FLAGS.elementAnimations.text.enabled = false

      const { section } = createHarness()
      expect(section.availableAnimTabs.value).toEqual([])
      expect(section.showTabSwitch.value).toBe(false) // 不显示 tab
      expect(section.hasAnyMotionFeatureEnabled.value).toBe(false)
    })

    it("5. toggleAllMotion 在入场过渡关闭但持续强调开启时，应默认激活持续强调", () => {
      FEATURE_FLAGS.elementAnimations.entrance.enabled = false
      FEATURE_FLAGS.elementAnimations.emphasis.enabled = true
      FEATURE_FLAGS.elementAnimations.text.enabled = false

      const { section, emitted } = createHarness()
      section.toggleAllMotion()
      const animCall = emitted.find(e => e.event === "update:elemAnim")
      expect(animCall).toBeDefined()
      expect(animCall!.args[0]).toBe("pulse")
    })
  })
})
