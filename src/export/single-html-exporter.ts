import type { ISlidevDocument } from "../types/slidev-protocol"
import { escapeHtml } from "./markdown-renderer"

export interface IStandaloneHtmlOptions {
  title?: string
  inlineVueBundle?: string
  inlineAssetBase64Map?: Record<string, string>
}

/**
 * 构建无外部依赖的离线单文件独立 HTML 演示包（支持 Base64 资产内联）
 */
export function buildStandaloneHtml(
  doc: ISlidevDocument,
  options?: IStandaloneHtmlOptions,
): string {
  const title = options?.title || "Slidev 演示文稿"
  let processedSlides = doc.slides

  // 若提供 Base64 字典，将各块中匹配到的本地资产 URL 替换为 Base64
  if (options?.inlineAssetBase64Map && Object.keys(options.inlineAssetBase64Map).length > 0) {
    const map = options.inlineAssetBase64Map
    processedSlides = doc.slides.map(slide => {
      let slideMd = slide.rawMarkdown
      for (const [assetPath, b64] of Object.entries(map)) {
        if (slideMd.includes(assetPath)) {
          slideMd = slideMd.split(assetPath).join(b64)
        }
      }
      const newBlocks = slide.blocks.map(b => {
        let md = b.rawMarkdown
        for (const [assetPath, b64] of Object.entries(map)) {
          if (md.includes(assetPath)) {
            md = md.split(assetPath).join(b64)
          }
        }
        return { ...b, rawMarkdown: md }
      })
      return { ...slide, rawMarkdown: slideMd, blocks: newBlocks }
    })
  }

  const slidesJson = JSON.stringify(processedSlides)
  const configJson = JSON.stringify(doc.config)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --slide-bg: #ffffff;
      --slide-text: #1a1a1a;
      --slide-accent: #3b82f6;
      --slide-font: system-ui, -apple-system, sans-serif;
    }
    [data-theme="dark"] {
      --slide-bg: #121214;
      --slide-text: #e2e8f0;
      --slide-accent: #60a5fa;
    }

    /* 1. 默认科技主题 Default */
    [data-slidev-theme="default"],
    .slidev-theme-default {
      --slide-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      --slide-accent: #10b981;
    }
    [data-theme="light"][data-slidev-theme="default"],
    [data-theme="light"] .slidev-theme-default {
      --slide-bg: #ffffff;
      --slide-text: #1e293b;
      --slide-accent: #059669;
    }
    [data-theme="dark"][data-slidev-theme="default"],
    [data-theme="dark"] .slidev-theme-default {
      --slide-bg: #121214;
      --slide-text: #e2e8f0;
      --slide-accent: #34d399;
    }
    .slidev-theme-default .layout-cover h1,
    .slidev-theme-default .layout-cover .slide-block h1 {
      font-size: 3.8rem !important;
      font-weight: 800 !important;
      line-height: 1.15 !important;
      letter-spacing: -0.025em !important;
      margin-bottom: 18px !important;
      background: linear-gradient(135deg, #10b981, #06b6d4) !important;
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
    }
    .slidev-theme-default .layout-cover h2,
    .slidev-theme-default .layout-cover .slide-block h2 {
      font-size: 1.85rem !important;
      font-weight: 600 !important;
      opacity: 0.85 !important;
      margin-bottom: 12px !important;
    }
    .slidev-theme-default .layout-cover p,
    .slidev-theme-default .layout-cover .slide-block p {
      font-size: 1.45rem !important;
      line-height: 1.5 !important;
      opacity: 0.85 !important;
    }

    /* 2. 优雅衬线主题 Seriph */
    [data-slidev-theme="seriph"],
    .slidev-theme-seriph {
      --slide-font: "PT Serif", "Charter", "Georgia", "Cambria", "Times New Roman", "Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", serif;
      --slide-accent: #b45309;
      letter-spacing: 0.015em;
    }
    [data-theme="light"][data-slidev-theme="seriph"],
    [data-theme="light"] .slidev-theme-seriph {
      --slide-bg: #fdfbf7;
      --slide-text: #2a2521;
      --slide-accent: #b45309;
    }
    [data-theme="dark"][data-slidev-theme="seriph"],
    [data-theme="dark"] .slidev-theme-seriph {
      --slide-bg: #1c1a17;
      --slide-text: #e8e3d9;
      --slide-accent: #f59e0b;
    }
    .slidev-theme-seriph,
    .slidev-theme-seriph .slide-content {
      font-family: var(--slide-font) !important;
      line-height: 1.72;
    }
    .slidev-theme-seriph h1,
    .slidev-theme-seriph h2,
    .slidev-theme-seriph h3 {
      font-family: var(--slide-font) !important;
      letter-spacing: 0.025em;
      font-weight: 700;
    }
    .slidev-theme-seriph .layout-cover h1 {
      background: none !important;
      -webkit-background-clip: initial !important;
      -webkit-text-fill-color: initial !important;
      color: var(--slide-accent) !important;
      font-size: 3.4rem !important;
      border-bottom: 2px solid var(--slide-accent);
      display: inline-block;
      padding-bottom: 10px;
    }

    /* 3. 极简发布会主题 Apple Basic */
    [data-slidev-theme="apple-basic"],
    .slidev-theme-apple-basic {
      --slide-font: -apple-system, "SF Pro Display", "SF Pro Text", BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
      --slide-accent: #0071e3;
    }
    [data-theme="light"][data-slidev-theme="apple-basic"],
    [data-theme="light"] .slidev-theme-apple-basic {
      --slide-bg: #ffffff;
      --slide-text: #1d1d1f;
      --slide-accent: #0071e3;
    }
    [data-theme="dark"][data-slidev-theme="apple-basic"],
    [data-theme="dark"] .slidev-theme-apple-basic {
      --slide-bg: #000000;
      --slide-text: #f5f5f7;
      --slide-accent: #2997ff;
    }
    .slidev-theme-apple-basic,
    .slidev-theme-apple-basic .slide-content {
      font-family: var(--slide-font) !important;
    }
    .slidev-theme-apple-basic h1,
    .slidev-theme-apple-basic h2,
    .slidev-theme-apple-basic h3 {
      letter-spacing: -0.035em;
      font-weight: 800;
    }
    .slidev-theme-apple-basic .layout-cover h1 {
      background: none !important;
      -webkit-background-clip: initial !important;
      -webkit-text-fill-color: initial !important;
      color: var(--slide-text) !important;
      font-size: 3.8rem !important;
      letter-spacing: -0.04em !important;
    }
    .slidev-theme-apple-basic .layout-cover p {
      color: #86868b !important;
      font-size: 1.35rem !important;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%; overflow: hidden;
      background: #0f1115; font-family: var(--slide-font);
      display: flex; justify-content: center; align-items: center;
    }
    #app { width: 100%; height: 100%; position: relative; overflow: hidden; }
    .slide-viewport {
      position: absolute; left: 50%; top: 50%;
      background: var(--slide-bg); color: var(--slide-text);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 8px; overflow: hidden;
      display: flex; flex-direction: column; flex-shrink: 0;
      transform: translate(-50%, -50%) scale(var(--slidev-slide-scale, 1));
      transform-origin: center center; will-change: transform;
      transition: background 0.3s ease, color 0.3s ease, border-radius 0.2s ease, box-shadow 0.2s ease;
    }
    :fullscreen .slide-viewport, .is-fullscreen .slide-viewport {
      border-radius: 0 !important; box-shadow: none !important;
    }
    .layout-cover { justify-content: center; align-items: center; text-align: center; }
    .layout-cover h1, .layout-cover .slide-block h1 { font-size: 3.8rem !important; font-weight: 800 !important; line-height: 1.15 !important; letter-spacing: -0.025em !important; margin-bottom: 16px !important; }
    .layout-cover h2, .layout-cover .slide-block h2 { font-size: 1.85rem !important; font-weight: 600 !important; opacity: 0.85 !important; margin-bottom: 12px !important; }
    .layout-cover p, .layout-cover .slide-block p { font-size: 1.45rem !important; line-height: 1.5 !important; opacity: 0.85 !important; }
    .two-cols-left, .two-cols-right { min-width: 0; width: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow-wrap: break-word; word-break: break-word; }
    .pdf-two-cols-wrapper,
    .layout-two-cols-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 32px;
      width: 100%;
      height: 100%;
      flex: 1 1 0%;
      align-items: start;
    }
    .layout-two-cols-header-container,
    .layout-three-cols-header-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }
    .layout-header-section {
      width: 100%;
      margin-bottom: 24px;
      flex-shrink: 0;
    }
    .pdf-three-cols-wrapper,
    .layout-three-cols-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
      gap: 24px;
      width: 100%;
      height: 100%;
      flex: 1 1 0%;
      align-items: start;
      box-sizing: border-box;
    }
    .pdf-col {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-wrap: break-word;
      word-break: break-word;
      white-space: normal;
    }
    .pdf-col * {
      overflow-wrap: break-word;
      word-break: break-word;
      box-sizing: border-box;
    }
    .pdf-col pre,
    .two-cols-left pre,
    .two-cols-right pre,
    .image-right-content pre,
    .image-left-content pre {
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .slide-content.layout-image-right, .slide-content.layout-image-left {
      padding: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: 100%;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      box-sizing: border-box;
    }
    .image-right-content, .image-left-content {
      padding: 44px 50px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      overflow-y: auto;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    .image-right-img-container, .image-left-img-container {
      width: 100%;
      height: 100%;
      overflow: hidden;
      position: relative;
      background: #18181b;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .image-right-img, .image-left-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    .slide-block { margin-bottom: 14px; line-height: 1.6; }
    .slide-block h1 { font-size: 2.2rem; margin-bottom: 12px; }
    .slide-block h2 { font-size: 1.7rem; margin-bottom: 10px; }
    .slide-block p { font-size: 1.15rem; }
    .slide-block ul, .slide-block ol, .pdf-list {
      padding-left: 28px;
      margin: 8px 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .slide-block li, .pdf-list li {
      font-size: 1.15rem;
      line-height: 1.6;
    }
    .pdf-task-item {
      list-style: none;
      margin-left: -20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pdf-task-item input[type="checkbox"] {
      width: 1.15em;
      height: 1.15em;
      cursor: pointer;
    }
    .slide-list-media {
      display: block;
      margin-top: 8px;
      margin-bottom: 6px;
    }
    .slide-list-media img,
    .slide-list-media .list-item-gif {
      max-width: 100%;
      max-height: 240px;
      object-fit: contain;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      display: block;
    }
    .slide-video-container {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      margin: 12px 0;
    }
    .slide-video-player {
      max-width: 100%;
      max-height: 52vh;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      background: #000;
      outline: none;
    }
    kbd {
      display: inline-block;
      padding: 2px 7px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 0.85em;
      font-weight: 600;
      line-height: 1.25;
      color: inherit;
      background: rgba(125, 125, 125, 0.12);
      border: 1px solid rgba(125, 125, 125, 0.35);
      border-bottom-width: 2px;
      border-radius: 5px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
      margin: 0 2px;
      vertical-align: middle;
      white-space: nowrap;
    }
    [data-theme="dark"] kbd, .theme-dark kbd {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.25);
      border-bottom-color: rgba(255, 255, 255, 0.4);
      color: #f1f5f9;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }
    .slide-block pre,
    pre {
      background: rgba(0, 0, 0, 0.1);
      padding: 12px;
      border-radius: 6px;
      font-family: "JetBrains Mono", Consolas, monospace;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .slide-block pre code,
    pre code {
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      display: block !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .code-line {
      display: flex !important;
      align-items: flex-start !important;
      width: 100% !important;
      box-sizing: border-box !important;
      line-height: 1.6;
    }
    .code-line .line-no {
      display: inline-block !important;
      flex-shrink: 0 !important;
      min-width: 2.2em !important;
      text-align: right !important;
      margin-right: 12px !important;
      user-select: none !important;
      opacity: 0.45 !important;
    }
    .code-line .line-content {
      flex: 1 1 0% !important;
      min-width: 0 !important;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
    }
    /* 弱提示滚动条样式 */
    * {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.20) transparent;
    }
    *::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    *::-webkit-scrollbar-track {
      background: transparent;
    }
    *::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.20);
      border-radius: 2px;
      transition: background 0.2s ease;
    }
    *:hover::-webkit-scrollbar-thumb,
    *::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.45);
    }
    /* Slidev Micro-motion Keyframes & Presets */
    @keyframes slidevMotionFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slidevMotionSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slidevMotionSlideDown { from { opacity: 0; transform: translateY(-40px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slidevMotionSlideLeft { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slidevMotionSlideRight { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slidevMotionZoomIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
    @keyframes slidevMotionBounce {
      0% { opacity: 0; transform: translateY(40px); }
      60% { opacity: 1; transform: translateY(-8px); }
      80% { transform: translateY(4px); }
      100% { transform: translateY(0); }
    }
    .slidev-motion-fade-in { animation: slidevMotionFadeIn var(--motion-duration, 0.4s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both; }
    .slidev-motion-slide-up { animation: slidevMotionSlideUp var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both; }
    .slidev-motion-slide-down { animation: slidevMotionSlideDown var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both; }
    .slidev-motion-slide-left { animation: slidevMotionSlideLeft var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both; }
    .slidev-motion-slide-right { animation: slidevMotionSlideRight var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both; }
    .slidev-motion-zoom-in, .slidev-motion-pop { animation: slidevMotionZoomIn var(--motion-duration, 0.4s) cubic-bezier(0.34, 1.56, 0.64, 1) var(--motion-delay, 0s) both; }
    .slidev-motion-bounce { animation: slidevMotionBounce var(--motion-duration, 0.6s) cubic-bezier(0.34, 1.56, 0.64, 1) var(--motion-delay, 0s) both; }
    .controls {
      position: absolute; bottom: 16px; display: flex; gap: 12px; align-items: center;
      background: rgba(24, 24, 27, 0.8); backdrop-filter: blur(8px);
      padding: 6px 18px; border-radius: 20px; color: #fff; font-size: 13px; z-index: 10;
    }
    .controls button { background: transparent; border: none; color: inherit; cursor: pointer; padding: 2px 6px; }

    /* Slidev Native Icons & Interactive Buttons */
    .slidev-icon-btn {
      display: inline-flex !important; flex-direction: row !important; align-items: center !important; justify-content: center !important;
      padding: 0.35rem 0.5rem; border-radius: 0.375rem; background: transparent;
      border: 1px solid transparent; color: inherit; font-size: inherit; line-height: 1;
      cursor: pointer; opacity: 0.8; transition: all 0.2s ease; text-decoration: none;
      vertical-align: middle; user-select: none; margin: 0 4px;
    }
    .slidev-icon-btn:hover { opacity: 1; background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.15); }

    /* 组件从上到下按顺序流式渲染，避免相互重叠 */
    .slide-block > div + div { margin-top: 14px; }

    /* 同一个 div 内的按钮/链接从左到右水平渲染 */
    .slide-block div:has(> .slidev-icon-btn),
    .slide-block div:has(> button),
    .slide-block [class*="abs-"],
    .slidev-btn-row {
      display: inline-flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: center !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
    }

    /* Position Shortcuts 适配：在组件流中保持从上到下排列，不脱离流产生重叠 */
    .slide-block .abs-br,
    .slide-block .abs-bl,
    .slide-block .abs-tr,
    .slide-block .abs-tl,
    .slide-block [class*="abs-"] {
      position: relative !important;
      bottom: auto !important;
      right: auto !important;
      top: auto !important;
      left: auto !important;
      margin: 0.75rem auto !important;
    }

    .slide-block--absolute { position: relative !important; margin-bottom: 14px !important; padding: 0 !important; background: transparent !important; }
    .slide-block--absolute:hover { background: transparent !important; }
    .mt-12 { margin-top: 3rem !important; }
    .py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
    .m-6 { margin: 1.5rem !important; }
    .text-xl { font-size: 1.25rem !important; }
    [hover\\:bg~="white"][hover\\:bg~="op-10"]:hover,
    [hover\\:bg="white op-10"]:hover { background: rgba(255, 255, 255, 0.1) !important; border-radius: 4px; }
    .cursor-pointer, [data-clickable] { cursor: pointer; }
    /* Slidev 规范链接排版 (继承正文颜色，虚线底边，Hover 时平滑点亮为主题色并转为实线) */
    .slide-content a:not(.slidev-ref-tag):not(.slidev-icon-btn):not(.slidev-toc-link),
    .slide-block a:not(.slidev-ref-tag):not(.slidev-icon-btn):not(.slidev-toc-link),
    a.slidev-link {
      color: inherit;
      text-decoration: none;
      border-bottom: 1px dashed currentColor;
      transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                  border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                  border-bottom-style 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }
    .slide-content a:not(.slidev-ref-tag):not(.slidev-icon-btn):not(.slidev-toc-link):hover,
    .slide-block a:not(.slidev-ref-tag):not(.slidev-icon-btn):not(.slidev-toc-link):hover,
    a.slidev-link:hover {
      color: var(--slide-accent);
      border-bottom-style: solid;
      border-bottom-color: var(--slide-accent);
    }
    .slidev-ref-tag, a.slidev-ref-tag {
      display: inline-flex;
      align-items: center;
      background: color-mix(in srgb, var(--slide-accent) 12%, transparent);
      color: var(--slide-accent);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 0.88em;
      text-decoration: none;
      cursor: pointer;
      margin: 2px 4px 2px 0;
      border: 1px solid color-mix(in srgb, var(--slide-accent) 25%, transparent);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .slidev-ref-tag:hover, a.slidev-ref-tag:hover {
      background: color-mix(in srgb, var(--slide-accent) 22%, transparent);
      color: var(--slide-accent);
      border-color: color-mix(in srgb, var(--slide-accent) 55%, transparent);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--slide-accent) 20%, transparent);
    }
    .slidev-block-ref {
      display: block;
      padding: 10px 14px;
      background: color-mix(in srgb, var(--slide-accent) 8%, transparent);
      border-left: 3px solid var(--slide-accent);
      border-radius: 0 6px 6px 0;
      margin: 8px 0;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .slidev-block-ref:hover {
      background: color-mix(in srgb, var(--slide-accent) 15%, transparent);
    }
  </style>
  <script>
    // 注入演示数据载荷
    window.__SLIDEV_DATA__ = {
      docId: ${JSON.stringify(doc.docId)},
      slides: ${slidesJson},
      config: ${configJson}
    };
  </script>
</head>
<body>
  <div id="app">
    <div class="slide-viewport slidev-theme-${doc.config.theme || 'default'}" id="viewport" data-slidev-theme="${doc.config.theme || 'default'}">
      <div class="slide-content" id="slide-container"></div>
    </div>
    <div class="controls">
      <button id="btn-prev">◀ 上一页</button>
      <span id="page-num">1 / 1</span>
      <button id="btn-next">下一页 ▶</button>
      <button id="btn-fullscreen">⛶ 全屏</button>
    </div>
  </div>

  <script>
    (function() {
      const data = window.__SLIDEV_DATA__ || { slides: [] };
      const slides = data.slides || [];
      let currentIndex = 0;

      const container = document.getElementById("slide-container");
      const pageNum = document.getElementById("page-num");
      const btnPrev = document.getElementById("btn-prev");
      const btnNext = document.getElementById("btn-next");
      const btnFullscreen = document.getElementById("btn-fullscreen");

      const baseWidth = 980;
      const aspectStr = (data.config && data.config.aspectRatio) || "16/9";
      let ratioNum = 16 / 9;
      if (aspectStr === "4/3") ratioNum = 4 / 3;
      else if (aspectStr === "16/10") ratioNum = 16 / 10;
      else if (typeof aspectStr === "string" && aspectStr.includes("/")) {
        const parts = aspectStr.split("/").map(Number);
        if (parts[0] && parts[1]) ratioNum = parts[0] / parts[1];
      }
      const baseHeight = Math.ceil(baseWidth / ratioNum);
      const viewport = document.getElementById("viewport");

      function updateScale() {
        if (!viewport) return;
        const isFull = !!document.fullscreenElement;
        const padX = isFull ? 0 : 20;
        const padY = isFull ? 0 : 32;
        const availW = Math.max(100, window.innerWidth - padX);
        const availH = Math.max(100, window.innerHeight - padY);
        const scale = Math.min(availW / baseWidth, availH / baseHeight);
        viewport.style.width = baseWidth + "px";
        viewport.style.height = baseHeight + "px";
        viewport.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
        viewport.style.setProperty("--slidev-slide-scale", scale);
        if (isFull) document.body.classList.add("is-fullscreen");
        else document.body.classList.remove("is-fullscreen");
      }

      window.addEventListener("resize", updateScale);
      document.addEventListener("fullscreenchange", updateScale);

      function renderBlock(block) {
        const div = document.createElement("div");
        div.className = "slide-block";
        if (block && block.motion && block.motion.preset && block.motion.preset !== "none") {
          div.classList.add("slidev-motion-" + block.motion.preset.toLowerCase());
          if (typeof block.motion.duration === "number" && block.motion.duration > 0) {
            div.style.setProperty("--motion-duration", block.motion.duration + "ms");
          }
          if (typeof block.motion.delay === "number" && block.motion.delay > 0) {
            div.style.setProperty("--motion-delay", block.motion.delay + "ms");
          }
        }
        const md = block.rawMarkdown || block.content || "";

        if (md.includes('class="slidev-block-ref"') || md.includes('class="slidev-ref-tag"')) {
          div.innerHTML = md;
          return div;
        }

        const CARBON_MAP = {
          'carbon:arrow-right': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="m18 6l-1.43 1.393L24.15 15H4v2h20.15l-7.58 7.573L18 26l10-10z"/></svg>',
          'carbon:arrow-left': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="m14 26l1.43-1.393L7.85 17H28v-2H7.85l7.58-7.573L14 6L4 16z"/></svg>',
          'carbon:edit': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="M2 26h28v2H2zM25.4 9c.8-.8.8-2 0-2.8l-3.6-3.6c-.8-.8-2-.8-2.8 0l-15 15V24h6.4l15-15zM20.4 4L24 7.6l-2.4 2.4l-3.6-3.6L20.4 4zM6 22v-3.6l11-11l3.6 3.6l-11 11H6z"/></svg>',
          'carbon:logo-github': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path fill-rule="evenodd" d="M16 2a14 14 0 0 0-4.43 27.28c.7.13 1-.3 1-.67v-2.38c-3.89.84-4.71-1.88-4.71-1.88a3.7 3.7 0 0 0-1.56-2.05c-1.27-.86.1-.85.1-.85a2.94 2.94 0 0 1 2.14 1.44a3 3 0 0 0 4.08 1.16a2.93 2.93 0 0 1 .89-1.87c-3.1-.35-6.36-1.55-6.36-6.9a5.4 5.4 0 0 1 1.44-3.75a5 5 0 0 1 .14-3.71s1.17-.38 3.85 1.43a13.3 13.3 0 0 1 7 0c2.67-1.81 3.84-1.43 3.84-1.43a5 5 0 0 1 .14 3.71a5.4 5.4 0 0 1 1.44 3.75c0 5.37-3.27 6.54-6.38 6.89a3.35 3.35 0 0 1 1.26 2.61v3.87c0 .38.26.81 1 .67A14 14 0 0 0 16 2"/></svg>'
        };

        if (/@\\w+=['"]|v-\\w+|<button|<a\\b|<carbon:|^<div/i.test(md)) {
          if (md.includes('abs-br') || md.includes('abs-bl') || md.includes('abs-tr') || md.includes('abs-tl') || md.includes('absolute')) {
            div.classList.add("slide-block--absolute");
          }
          let renderedHtml = md;
          for (const [tag, svg] of Object.entries(CARBON_MAP)) {
            const regex = new RegExp("<" + tag + "\\\\s*\\\\/?>", "gi");
            renderedHtml = renderedHtml.replace(regex, svg);
            const regexDash = new RegExp("<" + tag.replace(":", "-") + "\\\\s*\\\\/?>", "gi");
            renderedHtml = renderedHtml.replace(regexDash, svg);
          }
          div.innerHTML = renderedHtml;

          // 挂载交互事件监听
          const nextBtns = div.querySelectorAll('[\\\\@click*="nav.next"], [\\\\@click*="next"]');
          nextBtns.forEach(btn => {
            btn.style.cursor = "pointer";
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              renderSlide(currentIndex + 1);
            });
          });

          const prevBtns = div.querySelectorAll('[\\\\@click*="nav.prev"], [\\\\@click*="prev"]');
          prevBtns.forEach(btn => {
            btn.style.cursor = "pointer";
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              renderSlide(currentIndex - 1);
            });
          });

          return div;
        }

        if (md.startsWith("### ")) div.innerHTML = "<h3>" + md.slice(4) + "</h3>";
        else if (md.startsWith("## ")) div.innerHTML = "<h2>" + md.slice(3) + "</h2>";
        else if (md.startsWith("# ")) div.innerHTML = "<h1>" + md.slice(2) + "</h1>";
        else if (md.startsWith("\`\`\`")) {
          const customMaxHeight = block?.attributes?.["custom-slidev-max-height"] || block?.attrs?.["custom-slidev-max-height"] || block?.maxHeight || "";
          const heightStyle = customMaxHeight ? ' style="max-height:' + customMaxHeight + ';overflow-y:auto;"' : "";
          div.innerHTML = "<pre" + heightStyle + "><code>" + md.slice(3, -3) + "</code></pre>";
        }
        else if (md.startsWith("> ")) div.innerHTML = "<blockquote><p>" + md.slice(2) + "</p></blockquote>";
        else if (md.startsWith("<video") || (block && block.type === "video")) {
          div.classList.add("slide-video-container");
          const isAutoplay = block && block.attributes && block.attributes["custom-slidev-autoplay"] === "true";
          const isLoop = block && block.attributes && block.attributes["custom-slidev-loop"] === "true";
          const isMuted = block && block.attributes && (block.attributes["custom-slidev-muted"] === "true" || isAutoplay);
          const hideControls = block && block.attributes && block.attributes["custom-slidev-controls"] === "false";
          let videoHtml = md;
          if (hideControls) videoHtml = videoHtml.replace(/\bcontrols\b/gi, "");
          else if (!videoHtml.includes("controls")) videoHtml = videoHtml.replace("<video", "<video controls");
          if (isAutoplay && !videoHtml.includes("autoplay")) videoHtml = videoHtml.replace("<video", "<video autoplay playsinline");
          if (isLoop && !videoHtml.includes("loop")) videoHtml = videoHtml.replace("<video", "<video loop");
          if (isMuted && !videoHtml.includes("muted")) videoHtml = videoHtml.replace("<video", "<video muted");
          videoHtml = videoHtml.replace("<video", '<video class="slide-video-player"');
          div.innerHTML = videoHtml;
        }
        else if (/^(\s*)([-*+]|\d+\.)\s+/m.test(md)) {
          div.classList.add("pdf-list-item");
          const lines = md.split("\n");
          let isOrdered = false;
          const items = [];
          for (const line of lines) {
            const tr = line.trim();
            if (!tr) continue;
            const um = line.match(/^(\s*)[-*+]\s+(.*)$/);
            const om = line.match(/^(\s*)\d+\.\s+(.*)$/);
            if (um) { items.push({ text: um[2], media: [] }); continue; }
            if (om) { if (items.length === 0) isOrdered = true; items.push({ text: om[2], media: [] }); continue; }
            if (items.length > 0) {
              const im = tr.match(/^!\[(.*?)\]\((.*?)\)$/);
              if (im) {
                const isGif = /\.gif(?:\?|$)/i.test(im[2]);
                items[items.length - 1].media.push('<div class="slide-list-media"><img alt="' + im[1] + '" src="' + im[2] + '" class="' + (isGif ? 'list-item-gif' : 'list-item-img') + '" /></div>');
                continue;
              }
              const hm = tr.match(/^<img\b[\s\S]*?\/?>$/i);
              if (hm) {
                items[items.length - 1].media.push('<div class="slide-list-media">' + tr + '</div>');
                continue;
              }
              const vm = tr.match(/^<video\b[\s\S]*?<\/video>$/i);
              if (vm) {
                items[items.length - 1].media.push('<div class="slide-list-media">' + tr + '</div>');
                continue;
              }
              items[items.length - 1].text += " " + tr;
            }
          }
          const tag = isOrdered ? "ol" : "ul";
          const liHtml = items.map(it => {
            let h = it.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
            const med = it.media && it.media.length ? "\n" + it.media.join("\n") : "";
            return "<li>" + h + med + "</li>";
          }).join("\n");
          div.innerHTML = "<" + tag + " class=\"pdf-list\">\n" + liHtml + "\n</" + tag + ">";
        }
        else {
          const imgMatch = md.match(/!\\[(.*?)\\]\\((.*?)\\)/);
          if (imgMatch) {
            div.innerHTML = '<img alt="' + imgMatch[1] + '" src="' + imgMatch[2] + '" style="max-width:100%;max-height:45vh;object-fit:contain;" />';
          } else {
            let html = md.replace(/\\*\\*(.*?)\\*\\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
            div.innerHTML = "<p>" + html + "</p>";
          }
        }
        return div;
      }

      function renderSlide(idx) {
        if (slides.length === 0) return;
        currentIndex = Math.max(0, Math.min(idx, slides.length - 1));
        const slide = slides[currentIndex];
        pageNum.textContent = (currentIndex + 1) + " / " + slides.length;

        container.className = "slide-content layout-" + (slide.frontmatter?.layout || "default");
        container.innerHTML = "";

        const z = typeof slide.frontmatter?.zoom === "number" && slide.frontmatter.zoom > 0 ? slide.frontmatter.zoom : 1;
        if (z !== 1) {
          container.style.width = (100 / z) + "%";
          container.style.height = (100 / z) + "%";
          container.style.transformOrigin = "top left";
          container.style.transform = "scale(" + z + ")";
        } else {
          container.style.width = "100%";
          container.style.height = "100%";
          container.style.transform = "none";
        }

        if (slide.frontmatter?.layout === "two-cols") {
          const leftCol = document.createElement("div");
          leftCol.className = "two-cols-left";
          const rightCol = document.createElement("div");
          rightCol.className = "two-cols-right";

          for (const block of (slide.blocks || [])) {
            const el = renderBlock(block);
            if (block.slot === "right") rightCol.appendChild(el);
            else leftCol.appendChild(el);
          }
          container.appendChild(leftCol);
        } else if (slide.frontmatter?.layout === "two-cols-header") {
          const containerDiv = document.createElement("div");
          containerDiv.className = "layout-two-cols-header-container";
          const headerDiv = document.createElement("div");
          headerDiv.className = "layout-header-section";
          const gridDiv = document.createElement("div");
          gridDiv.className = "pdf-two-cols-wrapper layout-two-cols-grid";
          const leftCol = document.createElement("div");
          leftCol.className = "pdf-col pdf-col--left";
          const rightCol = document.createElement("div");
          rightCol.className = "pdf-col pdf-col--right";

          const blocks = (slide.blocks || []).filter(b => b.slot !== "slot-divider-right");
          let headerBlocks = blocks.filter(b => b.slot === "header");
          if (headerBlocks.length === 0 && blocks.length > 0) {
            const candidate = blocks.find(b => b.type === "h" && (!b.slot || b.slot === "default"));
            if (candidate) headerBlocks = [candidate];
          }
          const rem = blocks.filter(b => !headerBlocks.includes(b));
          for (const b of headerBlocks) headerDiv.appendChild(renderBlock(b));
          for (const b of rem) {
            if (b.slot === "right" || b.slot === "col-2") rightCol.appendChild(renderBlock(b));
            else leftCol.appendChild(renderBlock(b));
          }
          gridDiv.appendChild(leftCol);
          gridDiv.appendChild(rightCol);
          containerDiv.appendChild(headerDiv);
          containerDiv.appendChild(gridDiv);
          container.appendChild(containerDiv);
        } else if (slide.frontmatter?.layout === "three-cols-header") {
          const containerDiv = document.createElement("div");
          containerDiv.className = "layout-three-cols-header-container";
          const headerDiv = document.createElement("div");
          headerDiv.className = "layout-header-section";
          const gridDiv = document.createElement("div");
          gridDiv.className = "pdf-three-cols-wrapper layout-three-cols-grid";
          const col1 = document.createElement("div");
          col1.className = "pdf-col pdf-col--1";
          const col2 = document.createElement("div");
          col2.className = "pdf-col pdf-col--2";
          const col3 = document.createElement("div");
          col3.className = "pdf-col pdf-col--3";

          const blocks = (slide.blocks || []).filter(b => b.slot !== "slot-divider-right");
          let headerBlocks = blocks.filter(b => b.slot === "header");
          if (headerBlocks.length === 0 && blocks.length > 0) {
            const candidate = blocks.find(b => b.type === "h" && (!b.slot || b.slot === "default"));
            if (candidate) headerBlocks = [candidate];
          }
          const rem = blocks.filter(b => !headerBlocks.includes(b));
          let c1 = [], c2 = [], c3 = [];
          const hasExplicitCols = rem.some(b => b.slot === "col-1" || b.slot === "col-2" || b.slot === "col-3" || b.slot === "center" || b.slot === "left" || b.slot === "right");
          if (hasExplicitCols) {
            c2 = rem.filter(b => b.slot === "col-2" || b.slot === "center");
            c3 = rem.filter(b => b.slot === "col-3" || b.slot === "right");
            c1 = rem.filter(b => !c2.includes(b) && !c3.includes(b));
          } else if (rem.length >= 3) {
            const count1 = Math.ceil(rem.length / 3);
            const count2 = Math.ceil((rem.length - count1) / 2);
            c1 = rem.slice(0, count1);
            c2 = rem.slice(count1, count1 + count2);
            c3 = rem.slice(count1 + count2);
          } else if (rem.length === 2) {
            c1 = [rem[0]];
            c2 = [rem[1]];
            c3 = [];
          } else if (rem.length === 1) {
            const lines = (rem[0].rawMarkdown || rem[0].content || "").trim().split(/\r?\n/);
            const itemLines = lines.filter(l => /^[ \t]*[-*+]\s+|^[ \t]*\d+\.\s+/.test(l));
            if (itemLines.length >= 3) {
              const count1 = Math.ceil(itemLines.length / 3);
              const count2 = Math.ceil((itemLines.length - count1) / 2);
              const items1 = itemLines.slice(0, count1).join("\n");
              const items2 = itemLines.slice(count1, count1 + count2).join("\n");
              const items3 = itemLines.slice(count1 + count2).join("\n");
              c1 = [{ ...rem[0], rawMarkdown: items1, content: items1 }];
              c2 = [{ ...rem[0], id: rem[0].id + "-col2", rawMarkdown: items2, content: items2 }];
              c3 = [{ ...rem[0], id: rem[0].id + "-col3", rawMarkdown: items3, content: items3 }];
            } else {
              c1 = rem;
            }
          } else {
            c1 = rem;
          }
          for (const b of headerBlocks) headerDiv.appendChild(renderBlock(b));
          for (const b of c1) col1.appendChild(renderBlock(b));
          for (const b of c2) col2.appendChild(renderBlock(b));
          for (const b of c3) col3.appendChild(renderBlock(b));
          gridDiv.appendChild(col1);
          gridDiv.appendChild(col2);
          gridDiv.appendChild(col3);
          containerDiv.appendChild(headerDiv);
          containerDiv.appendChild(gridDiv);
          container.appendChild(containerDiv);
        } else if (slide.frontmatter?.layout === "image-right" || slide.frontmatter?.layout === "image-left") {
          const isImageRight = slide.frontmatter?.layout === "image-right";
          const contentCol = document.createElement("div");
          contentCol.className = isImageRight ? "image-right-content" : "image-left-content";

          for (const block of (slide.blocks || [])) {
            contentCol.appendChild(renderBlock(block));
          }

          const imgCol = document.createElement("div");
          imgCol.className = isImageRight ? "image-right-img-container" : "image-left-img-container";
          const img = document.createElement("img");
          img.className = isImageRight ? "image-right-img" : "image-left-img";
          img.src = slide.frontmatter?.image || slide.frontmatter?.background || "";
          img.alt = "Slide cover";
          img.onerror = function() {
            this.src = "https://fastly.jsdelivr.net/gh/slidevjs/slidev-covers@main/static/2HmfbSpvcos.webp";
          };
          imgCol.appendChild(img);

          if (isImageRight) {
            container.appendChild(contentCol);
            container.appendChild(imgCol);
          } else {
            container.appendChild(imgCol);
            container.appendChild(contentCol);
          }
        } else {
          for (const block of (slide.blocks || [])) {
            container.appendChild(renderBlock(block));
          }
        }
      }

      btnPrev.addEventListener("click", () => renderSlide(currentIndex - 1));
      btnNext.addEventListener("click", () => renderSlide(currentIndex + 1));
      btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().then(() => updateScale()).catch(() => {});
        } else {
          document.exitFullscreen().then(() => updateScale()).catch(() => {});
        }
      });

      window.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === " ") renderSlide(currentIndex + 1);
        if (e.key === "ArrowLeft") renderSlide(currentIndex - 1);
        if (e.key === "f" || e.key === "F") btnFullscreen.click();
      });

      document.addEventListener("click", (e) => {
        const refEl = e.target && e.target.closest ? e.target.closest("[data-ref-id]") : null;
        if (refEl) {
          const id = refEl.getAttribute("data-ref-id");
          if (id) {
            window.open("siyuan://blocks/" + id, "_blank");
          }
        }
      });

      renderSlide(0);
      updateScale();
    })();
  </script>
</body>
</html>`
}

/**
 * 触发浏览器本地下载单文件 HTML
 */
export function downloadHtmlFile(filename: string, content: string): boolean {
  if (typeof document === "undefined") {
    return false
  }

  const blob = new Blob([content], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
