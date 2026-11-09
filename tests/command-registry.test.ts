import { describe, expect, it, vi } from "vitest"
import { registerPluginCommands } from "../src/plugin/command-registry"
import type { ISlidesPluginHost } from "../src/plugin/command-registry"

describe("CommandRegistry (插件命令注册器)", () => {
  it("应成功注册全套 14 项命令并包含对应的 langKey", () => {
    const commands: any[] = []
    const mockPlugin: any = {
      addCommand: vi.fn((cmd: any) => {
        commands.push(cmd)
      }),
      openBottomPreviewTab: vi.fn(),
      compileCurrentDocument: vi.fn(),
      cliBridge: {
        probeServer: vi.fn(),
        downloadSlidesMd: vi.fn(),
        syncToWorkspaceFile: vi.fn(),
      },
      currentDocId: "doc-1",
      latestCompiledDoc: null,
    }

    registerPluginCommands(mockPlugin as ISlidesPluginHost)

    expect(mockPlugin.addCommand).toHaveBeenCalledTimes(14)
    const registeredKeys = commands.map(c => c.langKey)
    expect(registeredKeys).toContain("slidesPresentation")
    expect(registeredKeys).toContain("slidesImport")
    expect(registeredKeys).toContain("slidesInitAttrs")
    expect(registeredKeys).toContain("slidesAiSplit")
    expect(registeredKeys).toContain("slidesAiNotes")
    expect(registeredKeys).toContain("slidesIdentifyNotes")
    expect(registeredKeys).toContain("slidesBatchTransitions")
    expect(registeredKeys).toContain("slidesExportTemplates")
    expect(registeredKeys).toContain("slidesBatchReplaceTransition")
    expect(registeredKeys).toContain("slidesPresenterMode")
    expect(registeredKeys).toContain("slidesExportCliMd")
    expect(registeredKeys).toContain("slidesProbeCliDevServer")
    expect(registeredKeys).toContain("slidesSyncToCliWorkspace")
    expect(registeredKeys).toContain("slidesExportImagesZip")

    // 测试 slidesPresentation 执行
    const presentationCmd = commands.find(c => c.langKey === "slidesPresentation")
    presentationCmd.execute()
    expect(mockPlugin.openBottomPreviewTab).toHaveBeenCalled()
  })
})
