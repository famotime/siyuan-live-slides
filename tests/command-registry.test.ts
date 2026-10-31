import { describe, expect, it, vi } from "vitest"
import { registerPluginCommands } from "../src/plugin/command-registry"
import type { ISlidevPluginHost } from "../src/plugin/command-registry"

describe("CommandRegistry (插件命令注册器)", () => {
  it("应成功注册全套 13 项命令并包含对应的 langKey", () => {
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

    registerPluginCommands(mockPlugin as ISlidevPluginHost)

    expect(mockPlugin.addCommand).toHaveBeenCalledTimes(13)
    const registeredKeys = commands.map(c => c.langKey)
    expect(registeredKeys).toContain("slidevPresentation")
    expect(registeredKeys).toContain("slidevImport")
    expect(registeredKeys).toContain("slidevInitAttrs")
    expect(registeredKeys).toContain("slidevAiSplit")
    expect(registeredKeys).toContain("slidevAiNotes")
    expect(registeredKeys).toContain("slidevBatchTransitions")
    expect(registeredKeys).toContain("slidevExportTemplates")
    expect(registeredKeys).toContain("slidevBatchReplaceTransition")
    expect(registeredKeys).toContain("slidevPresenterMode")
    expect(registeredKeys).toContain("slidevExportCliMd")
    expect(registeredKeys).toContain("slidevProbeCliDevServer")
    expect(registeredKeys).toContain("slidevSyncToCliWorkspace")
    expect(registeredKeys).toContain("slidevExportImagesZip")

    // 测试 slidevPresentation 执行
    const presentationCmd = commands.find(c => c.langKey === "slidevPresentation")
    presentationCmd.execute()
    expect(mockPlugin.openBottomPreviewTab).toHaveBeenCalled()
  })
})
