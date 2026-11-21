import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/feature-flags/feature-flags", () => ({
  isFeatureDisabled: () => false,
  isFeatureEnabled: () => true,
}))

import { registerPluginCommands } from "../src/plugin/command-registry"
import type { ISlidesPluginHost } from "../src/plugin/command-registry"
import { setI18nMessages, t } from "../src/utils/i18n"

describe("CommandRegistry (插件命令注册器)", () => {
  it("应成功注册全套 13 项命令并包含对应的 langKey", () => {
    const commands: any[] = []
    const mockPlugin: any = {
      addCommand: vi.fn((cmd: any) => {
        commands.push(cmd)
      }),
      openBottomPreviewTab: vi.fn(),
      compileCurrentDocument: vi.fn(),
      currentDocId: "doc-1",
      latestCompiledDoc: null,
    }

    registerPluginCommands(mockPlugin as ISlidesPluginHost)

    expect(mockPlugin.addCommand).toHaveBeenCalledTimes(13)
    const registeredKeys = commands.map(c => c.langKey)
    expect(registeredKeys).toContain("slidesPresentation")
    expect(registeredKeys).toContain("slidesImport")
    expect(registeredKeys).toContain("slidesInitAttrs")
    expect(registeredKeys).toContain("slidesAiSplit")
    expect(registeredKeys).toContain("slidesClearDividers")
    expect(registeredKeys).toContain("slidesAiNotes")
    expect(registeredKeys).toContain("slidesIdentifyNotes")
    expect(registeredKeys).toContain("slidesAutoAnimate")
    expect(registeredKeys).toContain("slidesBatchTransitions")
    expect(registeredKeys).toContain("slidesExportTemplates")
    expect(registeredKeys).toContain("slidesBatchReplaceTransition")
    expect(registeredKeys).toContain("slidesPresenterMode")
    expect(registeredKeys).toContain("slidesExportImagesZip")

    // 测试 slidesPresentation 执行
    const presentationCmd = commands.find(c => c.langKey === "slidesPresentation")
    presentationCmd.execute()
    expect(mockPlugin.openBottomPreviewTab).toHaveBeenCalled()
  })

  it("未注册 i18n 时命令 langText 应回退中文默认文案", () => {
    setI18nMessages(null)
    const commands: any[] = []
    const mockPlugin: any = {
      addCommand: vi.fn((cmd: any) => commands.push(cmd)),
      openBottomPreviewTab: vi.fn(),
      compileCurrentDocument: vi.fn(),
      currentDocId: "doc-1",
      latestCompiledDoc: null,
    }

    registerPluginCommands(mockPlugin as ISlidesPluginHost)

    const presentationCmd = commands.find(c => c.langKey === "slidesPresentation")
    expect(presentationCmd.langText).toBe("即现: 在文档下方开启分屏演示预览")
  })

  it("注册 i18n 后命令 langText 应采用当前语言译文", () => {
    setI18nMessages({ slidesPresentation: "Live Slides: Open Split-Screen Presentation Preview" })
    try {
      const commands: any[] = []
      const mockPlugin: any = {
        addCommand: vi.fn((cmd: any) => commands.push(cmd)),
        openBottomPreviewTab: vi.fn(),
        compileCurrentDocument: vi.fn(),
        currentDocId: "doc-1",
        latestCompiledDoc: null,
      }

      registerPluginCommands(mockPlugin as ISlidesPluginHost)

      const presentationCmd = commands.find(c => c.langKey === "slidesPresentation")
      expect(presentationCmd.langText).toBe("Live Slides: Open Split-Screen Presentation Preview")
    } finally {
      // 还原为未注册态，避免影响其他用例
      setI18nMessages(null)
    }
  })

  it("t() 对缺失键与非字符串值均应回退 fallback", () => {
    setI18nMessages({ empty: "", bad: 42 as unknown as string })
    try {
      expect(t("missing", "默认文案")).toBe("默认文案")
      expect(t("empty", "默认文案")).toBe("默认文案")
      expect(t("bad", "默认文案")).toBe("默认文案")
      expect(t("slidesImport", "即现: 导入 Slidev 演示文档 (.md / .zip)")).toBe("即现: 导入 Slidev 演示文档 (.md / .zip)")
    } finally {
      setI18nMessages(null)
    }
  })
})
