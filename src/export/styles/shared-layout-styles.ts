/**
 * 共享页面版式样式规则（Fact 大字报、Timeline/Steps 时间线与步骤、Quote 引言、Intro 介绍）
 */
export function getSharedLayoutStyles(): string {
  return `
    /* Fact 大字报版式：震撼巨型数字看板与径向光晕氛围 (支持单大数字与多指标列表冒号分割) */
    .layout-fact,
    .layout-fact-container {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 36px 48px;
      overflow: hidden;
    }
    .fact-hero-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 650px;
      height: 650px;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.28) 0%, rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08) 45%, transparent 70%);
      pointer-events: none;
      filter: blur(32px);
      z-index: 0;
    }
    .layout-fact-container .layout-header-section {
      position: relative;
      z-index: 1;
      width: 100%;
      margin-bottom: 24px;
      text-align: center;
    }
    .fact-content-box,
    .fact-stats-grid {
      position: relative;
      z-index: 1;
      display: grid;
      width: 100%;
      max-width: 1080px;
      margin: 0 auto;
      gap: 36px;
      justify-content: center;
      align-items: center;
    }
    .fact-stats-grid--cols-1 {
      grid-template-columns: 1fr;
      max-width: 860px;
    }
    .fact-stats-grid--cols-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 48px;
    }
    .fact-stats-grid--cols-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 32px;
    }
    .fact-stats-grid--cols-4 {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 24px;
    }
    .fact-stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      width: 100%;
      box-sizing: border-box;
      padding: 12px 16px;
      position: relative;
    }
    .fact-value-wrapper,
    .fact-value-box,
    .fact-value-text {
      font-weight: 900 !important;
      line-height: 1.05 !important;
      letter-spacing: -0.02em !important;
      color: var(--slide-accent, #3b82f6) !important;
      background: linear-gradient(135deg, var(--slide-accent, #3b82f6), #60a5fa, #93c5fd) !important;
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
      filter: drop-shadow(0 4px 24px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.42));
      margin-bottom: 8px !important;
      text-align: center !important;
      word-break: break-word;
    }
    .fact-stats-grid--cols-1 .fact-value-wrapper,
    .fact-stats-grid--cols-1 .fact-value-box,
    .fact-stats-grid--cols-1 .fact-value-text,
    .layout-fact-cols-1 .fact-value-wrapper {
      font-size: clamp(5.5rem, 12vw, 8.5rem) !important;
    }
    .fact-stats-grid--cols-2 .fact-value-wrapper,
    .fact-stats-grid--cols-2 .fact-value-box,
    .fact-stats-grid--cols-2 .fact-value-text,
    .layout-fact-cols-2 .fact-value-wrapper {
      font-size: clamp(4.2rem, 7.5vw, 6.2rem) !important;
    }
    .fact-stats-grid--cols-3 .fact-value-wrapper,
    .fact-stats-grid--cols-3 .fact-value-box,
    .fact-stats-grid--cols-3 .fact-value-text,
    .layout-fact-cols-3 .fact-value-wrapper {
      font-size: clamp(3.4rem, 5.5vw, 4.8rem) !important;
    }
    .fact-stats-grid--cols-4 .fact-value-wrapper,
    .fact-stats-grid--cols-4 .fact-value-box,
    .fact-stats-grid--cols-4 .fact-value-text,
    .layout-fact-cols-4 .fact-value-wrapper {
      font-size: clamp(2.8rem, 4.5vw, 3.8rem) !important;
    }
    .fact-value-box :is(h1, h2, h3, h4, p, span, div),
    .fact-value-wrapper :is(h1, h2, h3, h4, p, span, div) {
      font-size: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
      letter-spacing: inherit !important;
      color: inherit !important;
      background: inherit !important;
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
      margin: 0 !important;
      text-align: center !important;
    }
    .fact-divider-line {
      width: 60px;
      height: 3px;
      border-radius: 2px;
      background: var(--slide-accent, #3b82f6);
      margin: 12px auto 14px;
      opacity: 0.8;
      box-shadow: 0 2px 8px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.5);
    }
    .fact-label-wrapper,
    .fact-label-box,
    .fact-label-text {
      font-size: 1.25rem !important;
      font-weight: 500 !important;
      line-height: 1.5 !important;
      letter-spacing: normal !important;
      color: var(--b3-theme-on-surface, #e2e8f0) !important;
      background: none !important;
      -webkit-background-clip: border-box !important;
      -webkit-text-fill-color: initial !important;
      filter: none !important;
      opacity: 0.88 !important;
      max-width: 480px;
      margin: 0 auto;
      text-align: center !important;
    }
    .fact-stats-grid--cols-1 .fact-label-wrapper,
    .fact-stats-grid--cols-1 .fact-label-box,
    .fact-stats-grid--cols-1 .fact-label-text {
      font-size: 1.6rem !important;
      max-width: 720px;
    }
    .fact-label-box :is(h1, h2, h3, h4, p, span, div, li),
    .fact-label-wrapper :is(h1, h2, h3, h4, p, span, div, li) {
      font-size: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
      letter-spacing: normal !important;
      color: inherit !important;
      background: none !important;
      -webkit-background-clip: border-box !important;
      -webkit-text-fill-color: initial !important;
      filter: none !important;
      opacity: inherit !important;
      margin: 0 !important;
      text-align: center !important;
    }

    /* Timeline / Steps 时间线与步骤流程版式 */
    .layout-timeline-container,
    .layout-steps-container,
    .slide-content-wrapper.layout-timeline,
    .slide-content-wrapper.layout-steps {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 32px 56px;
      overflow: hidden;
      flex: 1;
    }
    .timeline-track-wrapper {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
      width: 100%;
      flex: 1;
      gap: 24px;
      margin-top: auto;
      margin-bottom: auto;
      padding: 24px 0 36px;
      position: relative;
    }
    .timeline-step-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      min-width: 0;
      position: relative;
      text-align: center;
    }
    .timeline-node-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      margin-bottom: 24px;
    }
    .timeline-node-badge {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--slide-accent, var(--b3-theme-primary));
      color: #ffffff;
      font-size: 1.35rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.4);
      z-index: 2;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }
    .timeline-connector-line {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, var(--slide-accent, #3b82f6), rgba(125, 125, 125, 0.25));
      transform: translateY(-50%);
      z-index: 1;
    }
    .timeline-step-content {
      width: 100%;
      padding: 16px;
      background: rgba(125, 125, 125, 0.05);
      border: 1px solid rgba(125, 125, 125, 0.12);
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      backdrop-filter: blur(6px);
    }
    .timeline-step-content h1,
    .timeline-step-content h2,
    .timeline-step-content h3,
    .timeline-step-content h4 {
      font-size: 1.35rem !important;
      font-weight: 700 !important;
      margin-bottom: 8px !important;
      color: var(--b3-theme-on-surface);
    }
    .timeline-step-content p,
    .timeline-step-content li {
      font-size: 1.05rem !important;
      line-height: 1.55 !important;
      opacity: 0.85;
      margin-bottom: 4px;
    }
    .timeline-step-content ul {
      padding-left: 0;
      list-style: none;
    }

    /* Quote 引言版式：居中大字、衬线字体、水印双引号与右对齐出处 */
    .layout-quote,
    .layout-quote-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      position: relative;
      box-sizing: border-box;
      padding: 48px 72px;
      overflow: hidden;
      flex: 1;
    }
    .quote-watermark-icon {
      position: absolute;
      top: 10%;
      left: 8%;
      font-size: 16rem;
      line-height: 1;
      font-family: Georgia, serif;
      opacity: 0.08;
      pointer-events: none;
      user-select: none;
      color: currentColor;
    }
    .quote-content-body {
      position: relative;
      z-index: 1;
      max-width: 850px;
      width: 100%;
      text-align: center;
    }
    .quote-text,
    .layout-quote-container .quote-body {
      font-size: 2.2rem !important;
      font-style: italic !important;
      line-height: 1.6 !important;
      font-family: var(--slides-font-serif, "Noto Serif SC", Georgia, serif) !important;
      letter-spacing: 0.01em;
      margin-bottom: 24px !important;
    }
    .quote-text p,
    .layout-quote-container .quote-body p {
      font-size: inherit !important;
      font-style: inherit !important;
      line-height: inherit !important;
    }
    .quote-footer,
    .quote-author {
      font-size: 1.25rem !important;
      opacity: 0.75 !important;
      text-align: right !important;
      font-style: normal !important;
      letter-spacing: 0.05em;
    }

    /* Intro 个人/章节介绍版式：头像配图与右侧个人履历卡片 */
    .layout-intro,
    .layout-intro-container {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 56px;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 40px 64px;
      overflow: hidden;
      flex: 1;
    }
    .intro-avatar-col {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .intro-avatar-box {
      width: 240px;
      height: 240px;
      border-radius: 50%;
      overflow: hidden;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.16);
      border: 4px solid rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.35);
      background: rgba(125, 125, 125, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .intro-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .intro-avatar-svg {
      width: 120px;
      height: 120px;
      opacity: 0.35;
      fill: currentColor;
    }
    .intro-info-col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .intro-info-col h1 {
      font-size: 3rem !important;
      font-weight: 800 !important;
      line-height: 1.2 !important;
      margin-bottom: 8px !important;
    }
    .intro-info-col h2, .intro-info-col h3 {
      font-size: 1.5rem !important;
      font-weight: 600 !important;
      color: var(--slide-accent) !important;
      margin-bottom: 16px !important;
    }
    .intro-info-col p {
      font-size: 1.25rem !important;
      line-height: 1.6 !important;
      opacity: 0.9 !important;
    }
    .intro-info-col ul {
      margin-top: 12px;
      padding-left: 20px;
    }
    .intro-info-col li {
      font-size: 1.15rem !important;
      line-height: 1.6 !important;
      margin-bottom: 6px;
      opacity: 0.9 !important;
    }
    .two-cols-left, .two-cols-right { min-width: 0; width: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow-wrap: break-word; word-break: break-word; }
    .pdf-two-cols-wrapper,
    .layout-two-cols-grid,
    .layout-cols-wrapper,
    .layout-cols-grid {
      display: grid;
      grid-template-columns: var(--slide-grid-cols, minmax(0, 1fr) minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr) !important;
      gap: var(--slides-cols-gap, 32px);
      width: 100%;
      height: 100%;
      min-height: 0 !important;
      max-height: 100% !important;
      flex: 1 1 0%;
      align-items: stretch;
      overflow: hidden !important;
    }
    .layout-cols-header-container,
    .layout-two-cols-header-container,
    .layout-three-cols-header-container,
    .layout-clover-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0 !important;
      max-height: 100% !important;
      overflow: hidden !important;
    }
    .layout-header-section {
      width: 100%;
      margin-bottom: var(--slides-header-gap, 16px) !important;
      flex-shrink: 0;
    }
    .layout-header-section h1,
    .layout-header-section h2,
    .layout-header-section h3 {
      margin-bottom: var(--slides-title-margin-bottom, 10px) !important;
    }
    .pdf-three-cols-wrapper,
    .layout-three-cols-grid {
      display: grid;
      grid-template-columns: var(--slide-grid-cols, minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr) !important;
      gap: calc(var(--slides-cols-gap, 32px) * 0.75);
      width: 100%;
      height: 100%;
      min-height: 0 !important;
      max-height: 100% !important;
      flex: 1 1 0%;
      align-items: stretch;
      box-sizing: border-box;
      overflow: hidden !important;
    }
    .pdf-clover-wrapper,
    .layout-clover-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      grid-template-rows: repeat(2, minmax(0, 1fr)) !important;
      gap: calc(var(--slides-cols-gap, 32px) * 0.625);
      width: 100%;
      height: 100%;
      min-height: 0 !important;
      max-height: 100% !important;
      flex: 1 1 0%;
      align-items: stretch;
      box-sizing: border-box;
      overflow: hidden !important;
    }
    .layout-clover-grid .pdf-col {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }
    .pdf-col {
      display: flex;
      flex-direction: column;
      gap: var(--slides-block-gap, 14px);
      min-width: 0;
      width: 100%;
      max-width: 100%;
      height: 100%;
      max-height: 100%;
      min-height: 0;
      justify-content: flex-start;
      box-sizing: border-box;
      overflow: hidden;
      overflow-wrap: break-word;
      word-break: break-word;
      white-space: normal;
    }
    .pdf-col * {
  `;
}
