import { beforeEach, describe, expect, it, vi } from "vitest"

// 功能开关可变桩：通过 gatingState.disabled 模拟构建期关闭某些功能
const gatingState = vi.hoisted(() => ({ disabled: new Set<string>() }))

vi.mock("@/feature-flags/feature-flags", () => ({
  isFeatureDisabled: (key: string) => gatingState.disabled.has(key),
  isFeatureEnabled: (key: string) => !gatingState.disabled.has(key),
}))

// 控制内核 API 与分页分析器，验证 AI 分页回调的完整执行链
// 仅覆盖动作链路用到的三个函数，其余导出保持真实实现（document-compiler 等模块依赖）
vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>()
  return {
    ...actual,
    getChildBlocks: vi.fn(async () => [
      { id: "b1", type: "h", subType: "h2", content: "第一章", markdown: "# 第一章" },
      { id: "b2", type: "p", subType: "", content: "正文", markdown: "正文" },
    ]),
    insertBlock: vi.fn(async () => ({})),
    setBlockAttrs: vi.fn(async () => ({})),
  }
})

vi.mock("@/ai/auto-splitter", () => ({
  analyzeSlideSplits: vi.fn(() => [{ blockId: "b1", recommendedLayout: "default" }]),
}))

import { registerPluginCommands } from "../src/plugin/command-registry"
import type { ISlidesPluginHost } from "../src/plugin/command-registry"
import { runAiAutoSplit } from "../src/plugin/ai-auto-split-action"
import { getChildBlocks, insertBlock, setBlockAttrs } from "@/api"

function createMockPlugin() {
  const commands: any[] = []
  const mockPlugin: any = {
    addCommand: vi.fn((cmd: any) => {
      commands.push(cmd)
    }),
    openBottomPreviewTab: vi.fn(),
    openPresenterTab: vi.fn(),
    compileCurrentDocument: vi.fn(),
    cliBridge: {
      probeServer: vi.fn(),
      downloadSlidesMd: vi.fn(),
      syncToWorkspaceFile: vi.fn(),
    },
    currentDocId: "doc-1",
    latestCompiledDoc: null,
  }
  return { mockPlugin: mockPlugin as ISlidesPluginHost, commands }
}

const CORE_KEYS = [
  "slidesPresentation",
  "slidesInitAttrs",
  "slidesIdentifyNotes",
  "slidesBatchTransitions",
  "slidesExportTemplates",
  "slidesBatchReplaceTransition",
]

describe("FeatureFlags 门控 (命令条件注册)", () => {
  beforeEach(() => {
    gatingState.disabled.clear()
    vi.clearAllMocks()
  })

  it("默认（无关闭项）注册全部 14 条命令", () => {
    const { mockPlugin, commands } = createMockPlugin()
    registerPluginCommands(mockPlugin)
    expect(mockPlugin.addCommand).toHaveBeenCalledTimes(14)
    expect(commands.map(c => c.langKey)).toHaveLength(14)
  })

  it("关闭 import 开关后 slidesImport 不注册", () => {
    gatingState.disabled.add("import")
    const { mockPlugin, commands } = createMockPlugin()
    registerPluginCommands(mockPlugin)
    expect(mockPlugin.addCommand).toHaveBeenCalledTimes(13)
    expect(commands.map(c => c.langKey)).not.toContain("slidesImport")
  })

  it("关闭 aiScript 开关后 AI 双命令不注册", () => {
    gatingState.disabled.add("aiScript")
    const { mockPlugin, commands } = createMockPlugin()
    registerPluginCommands(mockPlugin)
    expect(mockPlugin.addCommand).toHaveBeenCalledTimes(12)
    const keys = commands.map(c => c.langKey)
    expect(keys).not.toContain("slidesAiSplit")
    expect(keys).not.toContain("slidesAiNotes")
  })

  it("关闭 proMode 开关后三条 Pro 命令整组不注册", () => {
    gatingState.disabled.add("proMode")
    const { mockPlugin, commands } = createMockPlugin()
    registerPluginCommands(mockPlugin)
    expect(mockPlugin.addCommand).toHaveBeenCalledTimes(11)
    const keys = commands.map(c => c.langKey)
    expect(keys).not.toContain("slidesExportCliMd")
    expect(keys).not.toContain("slidesProbeCliDevServer")
    expect(keys).not.toContain("slidesSyncToCliWorkspace")
  })

  it("关闭 exportImage 开关后图片导出命令不注册", () => {
    gatingState.disabled.add("exportImage")
    const { mockPlugin, commands } = createMockPlugin()
    registerPluginCommands(mockPlugin)
    expect(mockPlugin.addCommand).toHaveBeenCalledTimes(13)
    expect(commands.map(c => c.langKey)).not.toContain("slidesExportImagesZip")
  })

  it("关闭 presenterMode 开关后演讲者控制台命令不注册", () => {
    gatingState.disabled.add("presenterMode")
    const { mockPlugin, commands } = createMockPlugin()
    registerPluginCommands(mockPlugin)
    expect(mockPlugin.addCommand).toHaveBeenCalledTimes(13)
    expect(commands.map(c => c.langKey)).not.toContain("slidesPresenterMode")
  })

  it("五组开关全部关闭时仅剩核心与协同命令", () => {
    ;["import", "aiScript", "proMode", "exportImage", "presenterMode"].forEach(k =>
      gatingState.disabled.add(k),
    )
    const { mockPlugin, commands } = createMockPlugin()
    registerPluginCommands(mockPlugin)
    expect(mockPlugin.addCommand).toHaveBeenCalledTimes(6)
    expect(commands.map(c => c.langKey).sort()).toEqual([...CORE_KEYS].sort())
  })

  it("slidesAiSplit 命令 execute 直接委派 runAiAutoSplit 并插入分页线", async () => {
    const { mockPlugin, commands } = createMockPlugin()
    registerPluginCommands(mockPlugin)
    const splitCmd = commands.find(c => c.langKey === "slidesAiSplit")
    expect(splitCmd).toBeDefined()

    await splitCmd.execute()

    expect(getChildBlocks).toHaveBeenCalledWith("doc-1")
    expect(insertBlock).toHaveBeenCalledWith("markdown", "---", undefined, "b1")
    expect(setBlockAttrs).toHaveBeenCalledWith("b1", { "custom-slides-layout": "default" })
    expect(mockPlugin.compileCurrentDocument).toHaveBeenCalledWith("doc-1")
  })

  it("runAiAutoSplit 可被 Dock「AI 智能分页」按钮直接调用（绕过不存在的 executeCommand）", async () => {
    const { mockPlugin } = createMockPlugin()
    await runAiAutoSplit(mockPlugin)
    expect(insertBlock).toHaveBeenCalled()
    expect(mockPlugin.compileCurrentDocument).toHaveBeenCalledWith("doc-1")
  })

  it("runAiAutoSplit 在无文档时提示且不触发编译", async () => {
    const { mockPlugin } = createMockPlugin()
    mockPlugin.currentDocId = ""
    await runAiAutoSplit(mockPlugin)
    expect(insertBlock).not.toHaveBeenCalled()
    expect(mockPlugin.compileCurrentDocument).not.toHaveBeenCalled()
  })
})
