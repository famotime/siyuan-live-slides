import type { ISlidesDocument } from "../types/slides-protocol"
import { CliDevServerBridge } from "./cli-devserver-bridge"
import { getDefaultProWorkspaceDir, getRuntimeModule, resolvePhysicalPath } from "./runtime-node"
import { DEFAULT_SIYUAN_PALETTE_CSS } from "../compiler/theme-styles-generator"

export interface IWorkspaceConfig {
  workspacePath: string
  slidesFileName?: string
}

export interface IScaffoldResult {
  success: boolean
  slidesPath: string
  physicalSlidesPath?: string
  packageJsonPath: string
  error?: string
}

export const DEFAULT_STARTER_SNIPPETS: Record<string, string> = {
  "snippets/external.ts": `// Inside ./snippets/external.ts
// #region snippet
export function emptyArray<T>(length: number) {
  return Array.from<T>({ length })
}
// #endregion snippet

export function sayHello() {
  console.log('Hello from snippets/external.ts')
}
`,
}

export const COLS_HEADER_LAYOUT_VUE = `<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = defineProps({
  layoutRatio: {
    type: String,
    default: '',
  },
  cols: {
    type: [Number, String],
    default: 0,
  },
})

const slots = useSlots()

const detectedColsCount = computed(() => {
  const explicitCols = Number(props.cols)
  if (explicitCols >= 2 && explicitCols <= 6) return explicitCols
  const r = (props.layoutRatio || '').trim()
  if (r.includes(':')) {
    const parts = r.split(':').map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0)
    if (parts.length >= 2) return Math.min(parts.length, 6)
  }
  const tokens = r.split(/\\s+/).filter(Boolean)
  if (tokens.length >= 2) return Math.min(tokens.length, 6)
  for (let i = 6; i >= 3; i--) {
    if (slots[\`col-\${i}\`]) return i
  }
  if (slots['col-2'] || slots['right']) return 2
  return 2
})

const gridStyle = computed(() => {
  const r = props.layoutRatio || ''
  if (r) {
    if (r.includes(':')) {
      const parts = r.split(':').map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0)
      if (parts.length >= 2) {
        return { gridTemplateColumns: parts.map(n => \`\${n}fr\`).join(' ') }
      }
    }
    const tokens = r.split(/\\s+/).filter(Boolean)
    if (tokens.length >= 2) {
      return { gridTemplateColumns: tokens.join(' ') }
    }
  }
  return { gridTemplateColumns: \`repeat(\${detectedColsCount.value}, minmax(0, 1fr))\` }
})
</script>

<template>
  <div class="slidev-layout cols-header w-full h-full flex flex-col">
    <div class="header-section mb-4 w-full">
      <slot />
    </div>
    <div class="grid gap-6 flex-1 items-stretch" :style="gridStyle">
      <div v-if="detectedColsCount >= 1" class="col-1 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
        <slot name="col-1"><slot name="left" /></slot>
      </div>
      <div v-if="detectedColsCount >= 2" class="col-2 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
        <slot name="col-2"><slot v-if="detectedColsCount === 2" name="right" /></slot>
      </div>
      <div v-if="detectedColsCount >= 3" class="col-3 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
        <slot name="col-3" />
      </div>
      <div v-if="detectedColsCount >= 4" class="col-4 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
        <slot name="col-4" />
      </div>
      <div v-if="detectedColsCount >= 5" class="col-5 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
        <slot name="col-5" />
      </div>
      <div v-if="detectedColsCount >= 6" class="col-6 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
        <slot name="col-6" />
      </div>
    </div>
  </div>
</template>
`

export const THREE_COLS_HEADER_LAYOUT_VUE = `<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  layoutRatio: {
    type: String,
    default: '',
  },
})

const gridStyle = computed(() => {
  const r = props.layoutRatio || ''
  if (!r) return {}
  if (r.includes(':')) {
    const parts = r.split(':').map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0)
    if (parts.length >= 2) {
      return { gridTemplateColumns: parts.map(n => \`\${n}fr\`).join(' ') }
    }
  }
  const tokens = r.split(/\\s+/).filter(Boolean)
  if (tokens.length >= 2) {
    return { gridTemplateColumns: tokens.join(' ') }
  }
  return {}
})
</script>

<template>
  <div class="slidev-layout three-cols-header w-full h-full flex flex-col">
    <div class="header-section mb-4 w-full">
      <slot />
    </div>
    <div class="grid gap-6 flex-1 items-stretch" :class="gridStyle.gridTemplateColumns ? '' : 'grid-cols-3'" :style="gridStyle">
      <div class="col-1 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
        <slot name="col-1" />
      </div>
      <div class="col-2 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
        <slot name="col-2" />
      </div>
      <div class="col-3 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
        <slot name="col-3" />
      </div>
    </div>
  </div>
</template>
`

export const CLOVER_LAYOUT_VUE = `<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = defineProps({
  mask: {
    type: String,
    default: '',
  },
  maskStyle: {
    type: String,
    default: 'solid',
  },
  maskInitial: {
    type: String,
    default: 'hidden',
  },
  clicks: {
    type: [Number, String],
    default: 0,
  },
})

const slots = useSlots()

const isClockMask = computed(() => {
  const m = props.mask || ''
  return m === 'clockwise' || m === 'counter-clockwise' || m === 'cw' || m === 'ccw'
})

const currentClockClicks = computed(() => {
  // 优先取 Slidev 全局 $slidev.nav.clicks，否则降级为 props.clicks
  // @ts-ignore
  const navClicks = typeof window !== 'undefined' && (window as any).$slidev?.nav?.clicks
  return typeof navClicks === 'number' ? navClicks : Number(props.clicks || 0)
})

const clockPercent = computed(() => {
  if (!isClockMask.value) return 100
  const isInitRev = props.maskInitial === 'revealed'
  const step = currentClockClicks.value
  const bps = [25, 50, 75, 100]
  if (step <= 0) return isInitRev ? bps[0] : 0
  const effectiveIdx = isInitRev ? step : (step - 1)
  if (effectiveIdx >= bps.length) return 100
  return bps[effectiveIdx] || 100
})

const clockNeedleAngle = computed(() => {
  const isCw = props.mask === 'clockwise' || props.mask === 'cw'
  const sweepDeg = Math.min(360, Math.max(0, (clockPercent.value / 100) * 360))
  return isCw ? (-180 + sweepDeg) : (-90 - sweepDeg)
})

const clockMaskOverlayStyle = computed(() => {
  if (!isClockMask.value) return {}
  const p = clockPercent.value
  const isCw = props.mask === 'clockwise' || props.mask === 'cw'
  const sweepDeg = Math.min(360, Math.max(0, (p / 100) * 360))
  let maskGrad = ''
  if (sweepDeg <= 0) {
    maskGrad = 'conic-gradient(from 0deg at 50% 50%, #000 0deg, #000 360deg)'
  } else if (sweepDeg >= 360) {
    maskGrad = 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 360deg)'
  } else if (isCw) {
    maskGrad = \`conic-gradient(from 270deg at 50% 50%, transparent 0deg, transparent \${sweepDeg}deg, #000 \${sweepDeg}deg, #000 360deg)\`
  } else {
    const remDeg = 360 - sweepDeg
    maskGrad = \`conic-gradient(from 0deg at 50% 50%, #000 0deg, #000 \${remDeg}deg, transparent \${remDeg}deg, transparent 360deg)\`
  }
  return {
    WebkitMaskImage: maskGrad,
    maskImage: maskGrad,
  }
})
</script>

<template>
  <div class="slidev-layout clover w-full h-full flex flex-col">
    <div class="header-section mb-4 w-full">
      <slot />
    </div>
    <div class="relative flex-1 min-h-0 overflow-hidden">
      <div class="grid grid-cols-2 grid-rows-2 gap-6 w-full h-full items-stretch">
        <div class="col-1 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
          <slot name="col-1" />
        </div>
        <div class="col-2 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
          <slot name="col-2" />
        </div>
        <div class="col-3 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
          <slot name="col-3" />
        </div>
        <div class="col-4 min-w-0 h-full max-h-full overflow-hidden break-words [overflow-wrap:break-word] [word-break:break-word]">
          <slot name="col-4" />
        </div>
      </div>
      <div
        v-if="isClockMask"
        class="slides-mask-layer slides-mask-layer--clock pointer-events-none absolute inset-0 z-50 transition-opacity duration-300"
        :class="props.maskStyle === 'blur' ? 'slides-mask-layer--blur' : 'slides-mask-layer--solid'"
        :style="{ opacity: clockPercent >= 100 ? 0 : 1 }"
      >
        <div
          class="slides-mask-overlay absolute inset-0 w-full h-full"
          :class="props.maskStyle === 'blur' ? 'backdrop-blur-xl bg-white/70 dark:bg-black/70' : 'bg-[var(--slide-bg,#fff)] dark:bg-[var(--slide-bg,#121214)]'"
          :style="clockMaskOverlayStyle"
        />
        <div
          class="slides-mask-divider-line slides-mask-divider-line--clock absolute pointer-events-none transition-all duration-300"
          :style="{
            top: '50%',
            left: '50%',
            width: '55%',
            height: '2.5px',
            transformOrigin: '0% 50%',
            transform: \`translateY(-50%) rotate(\${clockNeedleAngle}deg)\`,
            opacity: (clockPercent <= 0 || clockPercent >= 100) ? 0 : 1,
            background: 'linear-gradient(90deg, var(--slide-accent, #3b82f6) 0%, var(--slide-accent, #3b82f6) 75%, transparent 100%)',
            boxShadow: '0 0 10px var(--slide-accent, #3b82f6), 0 0 4px var(--slide-accent, #3b82f6)',
          }"
        />
      </div>
    </div>
  </div>
</template>
`

export const SLIDES_PEEK_INTERCEPTOR_SETUP_TS = `// Auto-generated by SiYuan Slidev Studio
// 本地 HTML 链接（思源资产 / 工作区文件 / 绝对文件路径）速览判定
// 注意：需与 public/slides-client/index.html 中的拦截器保持同步
function isPeekableLocalHtml(href: string): boolean {
  const clean = (href || '').trim()
  if (!clean || clean.startsWith('#') || clean.startsWith('//')) return false
  if (!/\\.html?($|[?#])/i.test(clean)) return false
  if (/^https?:\\/\\//i.test(clean)) return false
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(clean)
  if (!scheme) return true
  const schemeName = scheme[1].toLowerCase()
  if (schemeName === 'file') return true
  // Windows 盘符路径（D:\\\\docs\\\\demo.html）并非协议前缀
  return schemeName.length === 1 && /^[a-zA-Z]:[\\\\/]/.test(clean)
}

// 本地 HTML 链接预处理：思源资产统一指向内核 /assets/ 静态服务，其余原样转交宿主归一化
// 不基于 location 绝对化，保证 Pro 模式（Slidev dev server）与沙箱模式行为完全一致
function resolvePeekHref(href: string): string {
  const clean = (href || '').trim()
  if (/^(?:\\.\\/|\\/)?assets\\//.test(clean)) {
    return '/' + clean.replace(/^(?:\\.\\/|\\/)/, '')
  }
  return clean
}

export default function() {
  if (typeof window === 'undefined') return
  window.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target || !target.closest) return

    const refEl = target.closest('[data-ref-id]')
    if (refEl) {
      const blockId = refEl.getAttribute('data-ref-id')
      if (blockId) {
        e.preventDefault()
        e.stopPropagation()
        window.parent.postMessage({
          source: 'siyuan-slides-client',
          action: 'OPEN_PEEK_DRAWER',
          payload: { peekType: 'siyuan', blockId, title: (refEl.innerText || refEl.title || '').trim() }
        }, '*')
        return
      }
    }

    const linkEl = target.closest('a') as HTMLAnchorElement | null
    if (linkEl) {
      const href = linkEl.getAttribute('href') || ''
      if (href.startsWith('siyuan://blocks/')) {
        e.preventDefault()
        e.stopPropagation()
        const cleanBlockId = href.replace('siyuan://blocks/', '').split('?')[0]
        window.parent.postMessage({
          source: 'siyuan-slides-client',
          action: 'OPEN_PEEK_DRAWER',
          payload: { peekType: 'siyuan', blockId: cleanBlockId, title: (linkEl.innerText || linkEl.title || '').trim() }
        }, '*')
      } else if (/^https?:\\/\\//i.test(href)) {
        e.preventDefault()
        e.stopPropagation()
        window.parent.postMessage({
          source: 'siyuan-slides-client',
          action: 'OPEN_PEEK_DRAWER',
          payload: { peekType: 'web', url: href, title: (linkEl.innerText || linkEl.title || '').trim() }
        }, '*')
      } else if (isPeekableLocalHtml(href)) {
        e.preventDefault()
        e.stopPropagation()
        window.parent.postMessage({
          source: 'siyuan-slides-client',
          action: 'OPEN_PEEK_DRAWER',
          payload: { peekType: 'web', url: resolvePeekHref(href), title: (linkEl.innerText || linkEl.title || '').trim() }
        }, '*')
      }
    }
  }, true)
}
`

export const SLIDES_CUSTOM_STYLES_CSS = `${DEFAULT_SIYUAN_PALETTE_CSS}

/* Auto-generated by SiYuan Slidev Studio */
.slides-ref-tag,
a.slides-ref-tag {
  display: inline-flex;
  align-items: center;
  background: color-mix(in srgb, var(--slides-theme-primary, #10b981) 12%, transparent);
  color: var(--slides-theme-primary, #10b981);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.88em;
  text-decoration: none;
  border: 1px solid color-mix(in srgb, var(--slides-theme-primary, #10b981) 25%, transparent);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.slides-ref-tag:hover,
a.slides-ref-tag:hover {
  background: color-mix(in srgb, var(--slides-theme-primary, #10b981) 22%, transparent);
  color: var(--slides-theme-primary, #10b981);
  border-color: color-mix(in srgb, var(--slides-theme-primary, #10b981) 55%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--slides-theme-primary, #10b981) 20%, transparent);
}

.slides-block-ref {
  display: block;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--slides-theme-primary, #10b981) 8%, transparent);
  border-left: 3px solid var(--slides-theme-primary, #10b981);
  border-radius: 0 6px 6px 0;
  margin: 8px 0;
  cursor: pointer;
  transition: background 0.2s ease;
}

.slides-block-ref:hover {
  background: color-mix(in srgb, var(--slides-theme-primary, #10b981) 15%, transparent);
}

/* 幻灯片容器查询支持与代码块换行、弱提示滚动条样式 */
.slidev-page, .slidev-layout {
  container-type: size;
}

/* 代码块自动换行与无横向滚动条 */
pre,
pre code {
  white-space: pre-wrap !important;
  word-break: break-all !important;
  overflow-wrap: anywhere !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* 弱提示滚动条样式 */
* {
  scrollbar-width: thin;
}
html:not(.dark) * {
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}
html.dark * {
  scrollbar-color: rgba(255, 255, 255, 0.20) transparent;
}
*::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
html:not(.dark) *::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}
html:not(.dark) *:hover::-webkit-scrollbar-thumb,
html:not(.dark) *::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.35);
}
html.dark *::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.20);
  border-radius: 2px;
}
html.dark *:hover::-webkit-scrollbar-thumb,
html.dark *::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.45);
}

/* 多媒体（GIF动图、静态图片、MP4视频）最大化自适应且不超出视口：顶部对齐，横向居中 */
.slidev-layout img,
.slidev-layout video {
  max-width: 100% !important;
  max-height: 100% !important;
  width: auto;
  height: auto;
  object-fit: contain !important;
}
.three-cols-header video,
.two-cols-header video,
.grid-cols-3 video,
.grid-cols-2 video,
.col-1 video,
.col-2 video,
.col-3 video {
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  display: block !important;
  margin: 0 auto !important;
}
.slide-list-media {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: flex-start !important;
  margin-top: 4px !important;
  margin-bottom: 4px !important;
  width: 100% !important;
  max-width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  flex: 1 1 0% !important;
  overflow: hidden !important;
}
.slide-list-media img,
.slide-list-media video,
.slide-list-media .list-item-gif {
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  border-radius: 6px !important;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.14) !important;
  display: block !important;
  margin: 0 auto !important;
}
.slide-video-container {
  display: flex !important;
  flex-direction: column !important;
  justify-content: flex-start !important;
  align-items: center !important;
  width: 100% !important;
  max-height: 100% !important;
  margin: 6px 0 !important;
}
.slide-video-player {
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  border-radius: 8px !important;
}

/* 两栏与多栏（超级块分栏）布局：紧凑自然行距，子列表保留圆点与层级缩进 */
.cols-header ul,
.three-cols-header ul,
.two-cols-header ul,
.two-cols ul,
.col-1 ul,
.col-2 ul,
.col-3 ul,
.col-4 ul,
.col-5 ul,
.col-6 ul,
.grid-cols-2 ul,
.grid-cols-3 ul {
  list-style: disc !important;
  list-style-type: disc !important;
  padding-left: 1.25em !important;
  margin-left: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 8px !important;
  flex: 0 0 auto !important;
  height: auto !important;
  display: block !important;
}
.cols-header ol,
.three-cols-header ol,
.two-cols-header ol,
.two-cols ol,
.col-1 ol,
.col-2 ol,
.col-3 ol,
.col-4 ol,
.col-5 ol,
.col-6 ol,
.grid-cols-2 ol,
.grid-cols-3 ol {
  list-style: decimal !important;
  list-style-type: decimal !important;
  padding-left: 1.25em !important;
  margin-left: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 8px !important;
  flex: 0 0 auto !important;
  height: auto !important;
  display: block !important;
}
.cols-header li,
.three-cols-header li,
.two-cols-header li,
.two-cols li,
.col-1 li,
.col-2 li,
.col-3 li,
.col-4 li,
.col-5 li,
.col-6 li,
.grid-cols-2 li,
.grid-cols-3 li {
  padding-left: 0.2em !important;
  margin-left: 0 !important;
  margin-bottom: 6px !important;
  flex: 0 0 auto !important;
  height: auto !important;
  display: list-item !important;
  line-height: 1.6 !important;
}
.cols-header ul ul,
.three-cols-header ul ul,
.two-cols-header ul ul,
.two-cols ul ul,
.col-1 ul ul,
.col-2 ul ul,
.col-3 ul ul,
.col-4 ul ul,
.col-5 ul ul,
.col-6 ul ul {
  list-style: circle !important;
  list-style-type: circle !important;
  padding-left: 1.25em !important;
  margin-top: 4px !important;
  margin-bottom: 4px !important;
}

/* 列表项内嵌标题与说明排版 */
.slide-list-item-title,
li > h1,
li > h2,
li > h3,
li > h4,
li > h5,
li > h6 {
  margin-top: 2px !important;
  margin-bottom: 6px !important;
  line-height: 1.35 !important;
  font-weight: 700 !important;
}
li > h1 { font-size: 1.6rem !important; }
li > h2 { font-size: 1.4rem !important; }
li > h3 { font-size: 1.22rem !important; }
li > h4 { font-size: 1.1rem !important; }
.slide-list-item-desc,
li > p {
  margin-top: 4px !important;
  margin-bottom: 6px !important;
  font-size: 1.05rem;
  line-height: 1.55;
  opacity: 0.92;
}
`

/**
 * 从 Markdown 中提取所有引用的代码切片文件相对路径
 * 匹配格式: <<< @/snippets/external.ts#snippet 或 <<< ./snippets/foo.ts 或 <<< snippets/bar.js
 */
export function extractSnippetPaths(markdown: string): string[] {
  const paths: string[] = []
  const regex = /^[ \t]*<<<[ \t]+(?:@\/|\.\/|)([^\s#]+)(?:#[^\s]+)?/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(markdown)) !== null) {
    const rawPath = match[1]?.trim()
    if (rawPath && !paths.includes(rawPath)) {
      paths.push(rawPath)
    }
  }
  return paths
}

/**
 * 官方 Slidev Pro 模式零配置临时工程自动编排器
 */
export class WorkspaceScaffolder {
  private workspacePath: string
  private slidesFileName: string
  private cliBridge = new CliDevServerBridge()

  constructor(config?: IWorkspaceConfig) {
    const defaultDir = getDefaultProWorkspaceDir()
    // 若未指定或传入了旧版的 /data/ 内部路径，一律迁移到安全的系统独立目录
    if (!config?.workspacePath || config.workspacePath.includes("/data/storage/petal/siyuan-live-slides/pro-workspace")) {
      this.workspacePath = defaultDir
    } else {
      this.workspacePath = config.workspacePath
    }
    this.slidesFileName = config?.slidesFileName || "slides.md"
  }

  public getWorkspacePath(): string {
    return this.workspacePath
  }

  public getSlidesPath(): string {
    return `${this.workspacePath}/${this.slidesFileName}`
  }

  /**
   * 生成最小化标准的 Slidev package.json 配置
   */
  public generatePackageJson(theme = "default"): string {
    const pkg = {
      name: "siyuan-live-slides-pro-workspace",
      type: "module",
      private: true,
      scripts: {
        dev: "slidev --port 3030",
        build: "slidev build",
      },
      dependencies: {
        "@slidev/cli": "^53.0.0",
        "@slidev/theme-default": "latest",
      },
    }
    if (theme && theme !== "default") {
      (pkg.dependencies as any)[`@slidev/theme-${theme}`] = "latest"
    }
    return JSON.stringify(pkg, null, 2)
  }

  /**
   * 将当前思源演示文档编译为官方规范的 slides.md 文本
   */
  public buildSlidesMarkdown(doc: ISlidesDocument): string {
    return this.cliBridge.buildStandardSlidevMarkdown(doc)
  }

  /**
   * 编排并写入工作空间文件
   */
  public async scaffold(
    doc: ISlidesDocument,
    putFileFn?: (path: string, isDir: boolean, file: any) => Promise<any>,
  ): Promise<IScaffoldResult> {
    const slidesMd = this.buildSlidesMarkdown(doc)
    const pkgJson = this.generatePackageJson(doc.config.theme)
    const slidesPath = this.getSlidesPath()
    const pkgPath = `${this.workspacePath}/package.json`

    const physicalSlidesPath = resolvePhysicalPath(slidesPath)
    const physicalPkgPath = resolvePhysicalPath(pkgPath)

    // 编排 snippets 切片文件集合（防止 Slidev 官方 unplugin-vue-markdown 编译切片时报错路径不存在）
    const referencedSnippets = extractSnippetPaths(slidesMd)
    if (!referencedSnippets.includes("snippets/external.ts")) {
      referencedSnippets.push("snippets/external.ts")
    }

    const snippetsMap = new Map<string, string>()
    for (const snippetRel of referencedSnippets) {
      const content = DEFAULT_STARTER_SNIPPETS[snippetRel] || `// Auto-generated snippet placeholder for SiYuan Slidev\n// #region snippet\n// ${snippetRel}\n// #endregion snippet\n`
      snippetsMap.set(snippetRel, content)
    }

    // 若幻灯片包含 cols-header 布局，自动注入官方 Slidev 自定义布局文件 layouts/cols-header.vue
    const hasColsHeader = doc.slides.some(s => s.frontmatter?.layout === "cols-header")
    if (hasColsHeader) {
      snippetsMap.set("layouts/cols-header.vue", COLS_HEADER_LAYOUT_VUE)
    }

    // 若幻灯片包含 three-cols-header 布局，自动注入官方 Slidev 自定义布局文件 layouts/three-cols-header.vue
    const hasThreeColsHeader = doc.slides.some(s => s.frontmatter?.layout === "three-cols-header")
    if (hasThreeColsHeader) {
      snippetsMap.set("layouts/three-cols-header.vue", THREE_COLS_HEADER_LAYOUT_VUE)
    }

    // 若幻灯片包含 clover 布局，自动注入官方 Slidev 自定义布局文件 layouts/clover.vue
    const hasClover = doc.slides.some(s => s.frontmatter?.layout === "clover")
    if (hasClover) {
      snippetsMap.set("layouts/clover.vue", CLOVER_LAYOUT_VUE)
    }

    // 默认注入链接点击拦截与原位速览 setup/root.ts 脚本
    snippetsMap.set("setup/root.ts", SLIDES_PEEK_INTERCEPTOR_SETUP_TS)

    // 默认注入 Slidev 规范自定义样式 styles/index.css (联动主题色的块引用与链接)
    snippetsMap.set("styles/index.css", SLIDES_CUSTOM_STYLES_CSS)

    // 物理文件系统落盘增强（确保 Node 子进程立即感知，并彻底避免思源内核文件写锁冲突）
    const fsMod = getRuntimeModule("fs")
    const pathMod = getRuntimeModule("path")
    let physicalWriteSuccess = false

    const targetPhysicalDir = pathMod?.dirname ? pathMod.dirname(physicalSlidesPath) : ""
    const isPhysicalCandidate = /^[a-zA-Z]:[/\\]/.test(physicalSlidesPath) || physicalSlidesPath.includes("siyuan-live-slides-pro")

    if (fsMod && pathMod && isPhysicalCandidate) {
      try {
        if (!fsMod.existsSync(targetPhysicalDir)) {
          fsMod.mkdirSync(targetPhysicalDir, { recursive: true })
        }
        fsMod.writeFileSync(physicalPkgPath, pkgJson, "utf-8")
        fsMod.writeFileSync(physicalSlidesPath, slidesMd, "utf-8")

        for (const [snippetRel, content] of snippetsMap.entries()) {
          const physicalSnippetPath = pathMod.join(targetPhysicalDir, snippetRel)
          const snippetDir = pathMod.dirname(physicalSnippetPath)
          if (!fsMod.existsSync(snippetDir)) {
            fsMod.mkdirSync(snippetDir, { recursive: true })
          }
          if (!fsMod.existsSync(physicalSnippetPath)) {
            fsMod.writeFileSync(physicalSnippetPath, content, "utf-8")
          }
        }
        physicalWriteSuccess = true
      } catch {
        // 物理写入失败时将回退到 putFileFn
      }
    }

    // 仅当未进行物理文件写入（例如无真实文件系统访问权限的纯 Web 客户端）且提供了 putFileFn 时，才通过思源内核 API 写入
    if (!physicalWriteSuccess && putFileFn) {
      try {
        const slidesBlob = typeof Blob !== "undefined"
          ? new Blob([slidesMd], { type: "text/markdown;charset=utf-8" })
          : Buffer.from(slidesMd, "utf-8")
        const pkgBlob = typeof Blob !== "undefined"
          ? new Blob([pkgJson], { type: "application/json;charset=utf-8" })
          : Buffer.from(pkgJson, "utf-8")

        await putFileFn(pkgPath, false, pkgBlob)
        await putFileFn(slidesPath, false, slidesBlob)

        for (const [snippetRel, content] of snippetsMap.entries()) {
          const snippetPath = `${this.workspacePath}/${snippetRel}`
          const snippetBlob = typeof Blob !== "undefined"
            ? new Blob([content], { type: "text/plain;charset=utf-8" })
            : Buffer.from(content, "utf-8")
          await putFileFn(snippetPath, false, snippetBlob).catch(() => {})
        }

        return {
          success: true,
          slidesPath,
          physicalSlidesPath,
          packageJsonPath: pkgPath,
        }
      } catch (err: any) {
        return {
          success: false,
          slidesPath,
          physicalSlidesPath,
          packageJsonPath: pkgPath,
          error: String(err),
        }
      }
    }

    return {
      success: true,
      slidesPath,
      physicalSlidesPath,
      packageJsonPath: pkgPath,
    }
  }
}
