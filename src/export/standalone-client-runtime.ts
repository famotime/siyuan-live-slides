/**
 * 生成离线单文件独立 HTML 演示包内置的原生客户端播放器运行时脚本
 *
 * 运行时按功能分节维护（standalone-runtime-sections/），此处仅负责按序拼装。
 * 输出与分节拆分前字节级一致，由 tests/standalone-runtime-sections.test.ts 快照基线保障。
 */
import { getCoreStateSection } from "./standalone-runtime-sections/core-state"
import { getOverviewDomSection } from "./standalone-runtime-sections/overview-dom"
import { getNavigationHelpersSection } from "./standalone-runtime-sections/navigation-helpers"
import { getBlockRenderingSection } from "./standalone-runtime-sections/block-rendering"
import { getSlideRenderingSection } from "./standalone-runtime-sections/slide-rendering"
import { getLightboxSection } from "./standalone-runtime-sections/lightbox"
import { getJumpBadgeSection } from "./standalone-runtime-sections/jump-badge"
import { getOverviewLayerSection } from "./standalone-runtime-sections/overview-layer"
import { getKeyboardScrollInitSection } from "./standalone-runtime-sections/keyboard-scroll-init"

export function getStandaloneClientRuntimeScript(): string {
  return [
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
}
