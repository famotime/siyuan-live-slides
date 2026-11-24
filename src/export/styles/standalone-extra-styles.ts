/**
 * 离线单文件播放器专有特性样式（大图/视频灯箱、弱提示滚动条、Slidev 微动效与按钮、GPU 动态蒙版）
 */
export function getStandaloneExtraStyles(): string {
  return `
    /* Lightbox 大图与视频灯箱模态窗口 */
    .slides-lightbox {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(8px);
      z-index: 999999;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: zoom-out;
      opacity: 0;
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .slides-lightbox.active {
      display: flex;
      opacity: 1;
    }
    .slides-lightbox-content {
      position: relative;
      max-width: 92vw;
      max-height: 92vh;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: default;
    }
    .slides-lightbox-img {
      max-width: 92vw;
      max-height: 92vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
      user-select: none;
      -webkit-user-drag: none;
      touch-action: none;
    }
    .slides-lightbox-video {
      max-width: 92vw;
      max-height: 92vh;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
    }
    .slides-lightbox-close {
      position: absolute;
      top: 24px;
      right: 28px;
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 50%;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      cursor: pointer;
      transition: background 0.2s, transform 0.2s;
      z-index: 1000000;
    }
    .slides-lightbox-close:hover {
      background: rgba(255, 255, 255, 0.35);
      transform: scale(1.05);
    }

    img.slide-inline-img {
      max-width: 100% !important;
      max-height: min(320px, 40vh) !important;
      object-fit: contain !important;
      vertical-align: middle;
      border-radius: 4px;
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
    @keyframes slidesMotionFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slidesMotionSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slidesMotionSlideDown { from { opacity: 0; transform: translateY(-40px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slidesMotionSlideLeft { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slidesMotionSlideRight { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slidesMotionZoomIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
    @keyframes slidesMotionBounce {
      0% { opacity: 0; transform: translateY(40px); }
      60% { opacity: 1; transform: translateY(-8px); }
      80% { transform: translateY(4px); }
      100% { transform: translateY(0); }
    }
    .slides-motion-fade-in { animation: slidesMotionFadeIn var(--motion-duration, 0.4s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both; }
    .slides-motion-slide-up { animation: slidesMotionSlideUp var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both; }
    .slides-motion-slide-down { animation: slidesMotionSlideDown var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both; }
    .slides-motion-slide-left { animation: slidesMotionSlideLeft var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both; }
    .slides-motion-slide-right { animation: slidesMotionSlideRight var(--motion-duration, 0.45s) cubic-bezier(0.16, 1, 0.3, 1) var(--motion-delay, 0s) both; }
    .slides-motion-zoom-in, .slides-motion-pop { animation: slidesMotionZoomIn var(--motion-duration, 0.4s) cubic-bezier(0.34, 1.56, 0.64, 1) var(--motion-delay, 0s) both; }
    .slides-motion-bounce { animation: slidesMotionBounce var(--motion-duration, 0.6s) cubic-bezier(0.34, 1.56, 0.64, 1) var(--motion-delay, 0s) both; }

    /* Slidev Emphasis & Advanced Micro-Animations */
    @keyframes slidesPulseGlow {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(var(--slide-accent-rgb, 59, 130, 246), 0.4);
        transform: scale(1);
      }
      50% {
        box-shadow: 0 0 24px 6px rgba(var(--slide-accent-rgb, 59, 130, 246), 0.7);
        transform: scale(1.015);
      }
    }
    .slides-anim-pulse {
      animation: slidesPulseGlow var(--anim-duration, 2.4s) ease-in-out infinite;
    }

    @keyframes slidesFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    .slides-anim-float {
      animation: slidesFloat var(--anim-duration, 3.6s) ease-in-out infinite;
    }

    @keyframes slidesShimmerSweep {
      0% { transform: translateX(-150%) skewX(-20deg); }
      100% { transform: translateX(150%) skewX(-20deg); }
    }
    .slides-anim-shimmer {
      position: relative;
      overflow: hidden;
    }
    .slides-anim-shimmer::after {
      content: "";
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
      animation: slidesShimmerSweep var(--anim-duration, 2.8s) ease-in-out infinite;
      pointer-events: none;
    }

    /* Typewriter Cursor */
    .slides-typewriter-cursor::after {
      content: "|";
      display: inline-block;
      margin-left: 2px;
      animation: slidesBlinkCursor 0.8s step-start infinite;
      color: var(--slide-accent, #3b82f6);
    }
    @keyframes slidesBlinkCursor {
      50% { opacity: 0; }
    }

    /* Shiki Smooth Code Spotlight Transition */
    .slide-block .code-line {
      transition: opacity 0.35s ease, filter 0.35s ease, background 0.35s ease;
    }

    .v-click-hidden.slides-anim-pulse,
    .v-click-hidden.slides-anim-float,
    .v-click-hidden.slides-anim-shimmer {
      animation: none !important;
      opacity: 0 !important;
    }
    .controls {
      position: absolute; bottom: 16px; display: flex; gap: 12px; align-items: center;
      background: rgba(24, 24, 27, 0.8); backdrop-filter: blur(8px);
      padding: 6px 18px; border-radius: 20px; color: #fff; font-size: 13px; z-index: 10;
      opacity: 0; pointer-events: auto;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .controls::before {
      content: ""; position: absolute; top: -20px; bottom: -16px; left: -24px; right: -24px; z-index: -1;
    }
    .controls:hover, .controls:focus-within {
      opacity: 1; transform: translateY(-2px);
    }
    .controls button { position: relative; z-index: 1; background: transparent; border: none; color: inherit; cursor: pointer; padding: 2px 6px; }

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
    .slides-btn-row {
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
    .slide-content a:not(.slides-ref-tag):not(.slidev-icon-btn):not(.slides-toc-link),
    .slide-block a:not(.slides-ref-tag):not(.slidev-icon-btn):not(.slides-toc-link),
    a.slides-link {
      color: inherit;
      text-decoration: none;
      border-bottom: 1px dashed currentColor;
      transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                  border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                  border-bottom-style 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }
    .slide-content a:not(.slides-ref-tag):not(.slidev-icon-btn):not(.slides-toc-link):hover,
    .slide-block a:not(.slides-ref-tag):not(.slidev-icon-btn):not(.slides-toc-link):hover,
    a.slides-link:hover {
      color: var(--slide-accent);
      border-bottom-style: solid;
      border-bottom-color: var(--slide-accent);
    }
    .slides-ref-tag, a.slides-ref-tag {
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
    .slides-ref-tag:hover, a.slides-ref-tag:hover {
      background: color-mix(in srgb, var(--slide-accent) 22%, transparent);
      color: var(--slide-accent);
      border-color: color-mix(in srgb, var(--slide-accent) 55%, transparent);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--slide-accent) 20%, transparent);
    }
    .slides-block-ref {
      display: block;
      padding: 10px 14px;
      background: color-mix(in srgb, var(--slide-accent) 8%, transparent);
      border-left: 3px solid var(--slide-accent);
      border-radius: 0 6px 6px 0;
      margin: 8px 0;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .slides-block-ref:hover {
      background: color-mix(in srgb, var(--slide-accent) 15%, transparent);
    }

    /* 页面动态蒙版 (Dynamic Mask) GPU 合成器硬件加速体系 */
    .slides-mask-body-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden !important;
      contain: layout paint;
      isolation: isolate;
    }
    .slides-mask-body-container--has-mask {
      overflow: hidden !important;
      /* 向左右、向下突破父容器内边距，完全贴合幻灯片视口边缘 */
      margin-left: calc(-1 * var(--slides-padding-x, 48px)) !important;
      margin-right: calc(-1 * var(--slides-padding-x, 48px)) !important;
      margin-bottom: calc(-1 * var(--slides-padding-y, 32px)) !important;
      padding-left: var(--slides-padding-x, 48px) !important;
      padding-right: var(--slides-padding-x, 48px) !important;
      padding-bottom: var(--slides-padding-y, 32px) !important;
      width: calc(100% + 2 * var(--slides-padding-x, 48px)) !important;
      box-sizing: border-box !important;
    }
    /* 无标题且首个元素即为蒙版正文容器时，向上同步扩展至顶部边缘 */
    .slide-content-wrapper > .slides-mask-body-container--has-mask:first-child,
    .slide-content > .slides-mask-body-container--has-mask:first-child {
      margin-top: calc(-1 * var(--slides-padding-y, 32px)) !important;
      padding-top: var(--slides-padding-y, 32px) !important;
    }
    /* 针对全屏零内边距特殊布局（如 image-right/image-left），仅重置蒙版容器的负边距扩展，保留 --slides-padding-* 变量供文字区使用 */
    .slide-content-wrapper.layout-image-right > .slides-mask-body-container--has-mask,
    .slide-content-wrapper.layout-image-left > .slides-mask-body-container--has-mask,
    .slide-content.layout-image-right > .slides-mask-body-container--has-mask,
    .slide-content.layout-image-left > .slides-mask-body-container--has-mask {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
    }
    /* 蒙版运动总图层：纯 GPU Compositor 硬件加速 translate3d */
    .slides-mask-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 50;
      will-change: transform, opacity;
      transform: translate3d(0, 0, 0);
      backface-visibility: hidden;
      transition: transform 0.42s cubic-bezier(0.2, 0, 0, 1),
                  opacity 0.42s cubic-bezier(0.2, 0, 0, 1);
    }
    /* 蒙版内部遮罩层：纯色或磨砂玻璃 */
    .slides-mask-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .slides-mask-layer--solid .slides-mask-overlay,
    .slides-mask-overlay--solid {
      background: var(--slide-bg, #ffffff);
    }
    [data-theme="dark"] .slides-mask-layer--solid .slides-mask-overlay,
    [data-theme="dark"] .slides-mask-overlay--solid {
      background: var(--slide-bg, #121214);
    }
    .slides-mask-layer--blur .slides-mask-overlay,
    .slides-mask-overlay--blur {
      backdrop-filter: blur(30px) saturate(180%);
      -webkit-backdrop-filter: blur(30px) saturate(180%);
      background: color-mix(in srgb, var(--slide-bg, #ffffff) 90%, transparent);
    }
    [data-theme="dark"] .slides-mask-layer--blur .slides-mask-overlay,
    [data-theme="dark"] .slides-mask-overlay--blur {
      background: color-mix(in srgb, var(--slide-bg, #121214) 90%, transparent);
    }
    /* 动态展露分界提示线：物理内嵌于蒙版边缘，相对坐标永为 0，绝对物理同步 */
    .slides-mask-divider-line {
      position: absolute;
      pointer-events: none;
      z-index: 51;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .slides-mask-layer--down .slides-mask-divider-line,
    .slides-mask-divider-line--down {
      top: 0;
      left: 0;
      right: 0;
      height: 2.5px;
      transform: translateY(-50%);
      background: linear-gradient(90deg, transparent 0%, var(--slide-accent, #3b82f6) 6%, var(--slide-accent, #3b82f6) 94%, transparent 100%);
      box-shadow: 0 0 10px var(--slide-accent, #3b82f6), 0 0 4px var(--slide-accent, #3b82f6);
    }
    .slides-mask-layer--right .slides-mask-divider-line,
    .slides-mask-divider-line--right {
      top: 0;
      bottom: 0;
      left: 0;
      width: 2.5px;
      transform: translateX(-50%);
      background: linear-gradient(180deg, transparent 0%, var(--slide-accent, #3b82f6) 6%, var(--slide-accent, #3b82f6) 94%, transparent 100%);
      box-shadow: 0 0 10px var(--slide-accent, #3b82f6), 0 0 4px var(--slide-accent, #3b82f6);
    }
    .slides-mask-layer--clockwise,
    .slides-mask-layer--counter-clockwise,
    .slides-mask-layer--cw,
    .slides-mask-layer--ccw,
    .slides-mask-layer--clock {
      transform: none !important;
    }
    .slides-mask-layer--clockwise .slides-mask-divider-line,
    .slides-mask-layer--counter-clockwise .slides-mask-divider-line,
    .slides-mask-layer--cw .slides-mask-divider-line,
    .slides-mask-layer--ccw .slides-mask-divider-line,
    .slides-mask-layer--clock .slides-mask-divider-line,
    .slides-mask-divider-line--clock,
    .slides-mask-divider-line--clockwise,
    .slides-mask-divider-line--counter-clockwise {
      top: 50%;
      left: 50%;
      right: auto;
      bottom: auto;
      width: 55%;
      height: 2.5px;
      transform-origin: 0% 50%;
      transform: translateY(-50%) rotate(-180deg);
      background: linear-gradient(90deg, var(--slide-accent, #3b82f6) 0%, var(--slide-accent, #3b82f6) 75%, transparent 100%);
      box-shadow: 0 0 10px var(--slide-accent, #3b82f6), 0 0 4px var(--slide-accent, #3b82f6);
      transition: transform 0.42s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s ease;
      will-change: transform, opacity;
    }
    .slides-mask-layer--counter-clockwise .slides-mask-divider-line,
    .slides-mask-divider-line--counter-clockwise {
      transform: translateY(-50%) rotate(-90deg);
  `;
}
