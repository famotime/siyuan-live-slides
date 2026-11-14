import { describe, expect, it } from "vitest"
import fs from "fs"
import path from "path"
import { getStandaloneClientRuntimeScript } from "../src/export/standalone-client-runtime"
import { getCoreStateSection } from "../src/export/standalone-runtime-sections/core-state"
import { getOverviewDomSection } from "../src/export/standalone-runtime-sections/overview-dom"
import { getNavigationHelpersSection } from "../src/export/standalone-runtime-sections/navigation-helpers"
import { getBlockRenderingSection } from "../src/export/standalone-runtime-sections/block-rendering"
import { getSlideRenderingSection } from "../src/export/standalone-runtime-sections/slide-rendering"
import { getLightboxSection } from "../src/export/standalone-runtime-sections/lightbox"
import { getJumpBadgeSection } from "../src/export/standalone-runtime-sections/jump-badge"
import { getOverviewLayerSection } from "../src/export/standalone-runtime-sections/overview-layer"
import { getKeyboardScrollInitSection } from "../src/export/standalone-runtime-sections/keyboard-scroll-init"

/**
 * RF-018 快照基线测试：分节拆分后的运行时输出必须与拆分前完全一致（字节级）。
 * 基线文件由拆分前的 getStandaloneClientRuntimeScript() 输出固化生成。
 */

const BASELINE_PATH = path.join(__dirname, "__fixtures__", "standalone-runtime-baseline.txt")

function readBaseline(): string {
  return fs.readFileSync(BASELINE_PATH, "utf8")
}

describe("standalone client runtime 分节拼装 (RF-018)", () => {
  it("完整输出应与拆分前基线字节级一致", () => {
    expect(getStandaloneClientRuntimeScript()).toBe(readBaseline())
  })

  it("导出的完整运行时脚本必须语法完全合法且可通过 new Function 解析", () => {
    const script = getStandaloneClientRuntimeScript()
    const ts = require("typescript")
    const sf = ts.createSourceFile("test.js", script, ts.ScriptTarget.ES2020, true)
    if (sf.parseDiagnostics.length > 0) {
      const lines = script.split("\n")
      for (const d of sf.parseDiagnostics) {
        const { line, character } = sf.getLineAndCharacterOfPosition(d.start)
        console.log(`Line ${line + 1}:${character + 1} - ${d.messageText}`)
        console.log("  Content:", lines[line])
      }
    }
    expect(sf.parseDiagnostics.length).toBe(0)
    expect(() => new Function(script)).not.toThrow()
  })

  it("九个功能分节均应为非空字符串", () => {
    const sections = [
      getCoreStateSection(),
      getOverviewDomSection(),
      getNavigationHelpersSection(),
      getBlockRenderingSection(),
      getSlideRenderingSection(),
      getLightboxSection(),
      getJumpBadgeSection(),
      getOverviewLayerSection(),
      getKeyboardScrollInitSection(),
    ]
    for (const section of sections) {
      expect(typeof section).toBe("string")
      expect(section.length).toBeGreaterThan(0)
    }
  })

  it("分节按序拼接应还原完整输出", () => {
    const joined = [
      getCoreStateSection(),
      getOverviewDomSection(),
      getNavigationHelpersSection(),
      getBlockRenderingSection(),
      getSlideRenderingSection(),
      getLightboxSection(),
      getJumpBadgeSection(),
      getOverviewLayerSection(),
      getKeyboardScrollInitSection(),
    ].join("")
    expect(joined).toBe(getStandaloneClientRuntimeScript())
  })
})
