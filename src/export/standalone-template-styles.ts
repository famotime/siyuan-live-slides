import { generateCompleteSiYuanThemeCss } from "../compiler/theme-styles-generator"
import { getSharedLayoutStyles } from "./styles/shared-layout-styles"
import { getStandaloneExtraStyles } from "./styles/standalone-extra-styles"

/**
 * 生成离线单文件独立 HTML 演示包所需的全套内联样式
 */
export function generateStandaloneExportStyles(customInlineStyles?: any): string {
  return `
    ${generateCompleteSiYuanThemeCss(customInlineStyles)}

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

    /* 1. 默认科技主题 Default (Modern Tech / Digital Geek) */
    [data-slides-theme="tech"],
    .slides-theme-tech {
      --slide-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      --slide-accent: #10b981;
      --slide-accent-secondary: #06b6d4;
    }
    [data-theme="light"][data-slides-theme="tech"],
    [data-theme="light"] .slides-theme-tech,
    .slide-viewport[data-theme="light"].slides-theme-tech,
    .slide-viewport[data-theme="light"] {
      --slide-bg: #f8fafc;
      --slide-text: #0f172a;
      --slide-text-secondary: #475569;
      --slide-code-bg: #f1f5f9;
      --slide-code-border: rgba(15, 23, 42, 0.12);
      --slide-accent: #059669;
      --slide-accent-secondary: #0284c7;
      --slide-card-bg: rgba(255, 255, 255, 0.85);
      --slide-card-border: rgba(148, 163, 184, 0.35);
      --slide-card-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
    }
    [data-theme="dark"][data-slides-theme="tech"],
    [data-theme="dark"] .slides-theme-tech,
    .slide-viewport[data-theme="dark"].slides-theme-tech,
    .slide-viewport:not([data-theme="light"]) {
      --slide-bg: #090d16;
      --slide-text: #f1f5f9;
      --slide-text-secondary: #94a3b8;
      --slide-code-bg: #0f172a;
      --slide-code-border: rgba(56, 189, 248, 0.22);
      --slide-accent: #10b981;
      --slide-accent-secondary: #38bdf8;
      --slide-card-bg: rgba(15, 23, 42, 0.7);
      --slide-card-border: rgba(56, 189, 248, 0.2);
      --slide-card-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    }
    /* 单页为 light 时高特异性覆盖，即使外层是 dark 也强制生效 */
    [data-theme="dark"] .slide-viewport[data-theme="light"],
    .slide-viewport[data-theme="light"] {
      color: var(--slide-text) !important;
    }
    [data-theme="dark"] .slide-viewport[data-theme="light"].slides-theme-tech,
    .slide-viewport[data-theme="light"].slides-theme-tech {
      --slide-text: #0f172a !important;
      --slide-text-secondary: #475569 !important;
      --slide-accent: #059669 !important;
    }
    [data-theme="dark"] .slide-viewport[data-theme="light"].slides-theme-seriph,
    .slide-viewport[data-theme="light"].slides-theme-seriph {
      --slide-text: #231f1d !important;
      --slide-text-secondary: #57534e !important;
      --slide-accent: #b45309 !important;
    }
    [data-theme="dark"] .slide-viewport[data-theme="light"].slides-theme-apple-basic,
    .slide-viewport[data-theme="light"].slides-theme-apple-basic {
      --slide-text: #000000 !important;
      --slide-text-secondary: #6e6e73 !important;
      --slide-accent: #0071e3 !important;
    }
    /* 单页为 dark 时高特异性覆盖，即使外层是 light 也强制生效 */
    [data-theme="light"] .slide-viewport[data-theme="dark"],
    .slide-viewport[data-theme="dark"] {
      color: var(--slide-text) !important;
    }
    [data-theme="light"] .slide-viewport[data-theme="dark"].slides-theme-tech,
    .slide-viewport[data-theme="dark"].slides-theme-tech {
      --slide-text: #f1f5f9 !important;
      --slide-text-secondary: #94a3b8 !important;
      --slide-accent: #10b981 !important;
    }
    [data-theme="light"] .slide-viewport[data-theme="dark"].slides-theme-seriph,
    .slide-viewport[data-theme="dark"].slides-theme-seriph {
      --slide-text: #f5f2eb !important;
      --slide-text-secondary: #a8a29e !important;
      --slide-accent: #f59e0b !important;
    }
    [data-theme="light"] .slide-viewport[data-theme="dark"].slides-theme-apple-basic,
    .slide-viewport[data-theme="dark"].slides-theme-apple-basic {
      --slide-text: #ffffff !important;
      --slide-text-secondary: #86868b !important;
      --slide-accent: #2997ff !important;
    }
    .slides-theme-tech .layout-cover h1,
    .slides-theme-tech .layout-cover .slide-block h1 {
      font-size: 3.8rem !important;
      font-weight: 800 !important;
      line-height: 1.15 !important;
      letter-spacing: -0.025em !important;
      margin-bottom: 18px !important;
      background: linear-gradient(135deg, var(--slide-accent), var(--slide-accent-secondary)) !important;
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
    }
    .slides-theme-tech .layout-cover h2,
    .slides-theme-tech .layout-cover .slide-block h2 {
      font-size: 1.85rem !important;
      font-weight: 600 !important;
      color: var(--slide-text-secondary) !important;
      margin-bottom: 12px !important;
    }
    .slides-theme-tech .layout-cover p,
    .slides-theme-tech .layout-cover .slide-block p {
      font-size: 1.45rem !important;
      line-height: 1.5 !important;
      color: var(--slide-text-secondary) !important;
    }
    /* 默认科技风：内容页顶部标题带 Accent 垂直指示条与柔和横向高亮底衬 */
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2,
    .slides-theme-tech .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3 {
      color: var(--slide-accent);
      border-left: 4px solid var(--slide-accent);
      padding: 4px 14px;
      padding-left: 14px;
      background: linear-gradient(90deg, color-mix(in srgb, var(--slide-accent) 13%, transparent), transparent 76%);
      border-radius: 0 6px 6px 0;
      letter-spacing: -0.015em;
    }
    .slides-theme-tech blockquote {
      border-left: 3px solid var(--slide-accent) !important;
      background: color-mix(in srgb, var(--slide-accent) 8%, transparent) !important;
      border-radius: 4px;
      padding: 12px 18px !important;
    }
    .slides-theme-tech pre {
      border: 1px solid var(--slide-code-border) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18) !important;
      border-radius: 8px !important;
    }

    /* 2. 优雅衬线主题 Seriph (典雅学术书卷风) */
    [data-slides-theme="seriph"],
    .slides-theme-seriph {
      --slide-font: "PT Serif", "Charter", "Georgia", "Cambria", "Times New Roman", "Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", serif;
      --slide-accent: #b45309;
      --slide-accent-secondary: #9a3412;
      letter-spacing: 0.02em;
    }
    [data-theme="light"][data-slides-theme="seriph"],
    [data-theme="light"] .slides-theme-seriph {
      --slide-bg: #fcfbf7;
      --slide-text: #231f1d;
      --slide-text-secondary: #57534e;
      --slide-code-bg: #f5f0e6;
      --slide-code-border: rgba(180, 83, 9, 0.2);
      --slide-accent: #b45309;
      --slide-accent-secondary: #9a3412;
      --slide-card-bg: rgba(255, 255, 255, 0.75);
      --slide-card-border: rgba(180, 83, 9, 0.25);
      --slide-card-shadow: 0 2px 10px rgba(41, 37, 36, 0.04);
    }
    [data-theme="dark"][data-slides-theme="seriph"],
    [data-theme="dark"] .slides-theme-seriph {
      --slide-bg: #171513;
      --slide-text: #f5f2eb;
      --slide-text-secondary: #a8a29e;
      --slide-code-bg: #24201c;
      --slide-code-border: rgba(245, 158, 11, 0.22);
      --slide-accent: #f59e0b;
      --slide-accent-secondary: #fb923c;
      --slide-card-bg: rgba(32, 28, 24, 0.8);
      --slide-card-border: rgba(245, 158, 11, 0.22);
      --slide-card-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }
    .slides-theme-seriph,
    .slides-theme-seriph .slide-content {
      font-family: var(--slide-font) !important;
      line-height: 1.75;
    }
    .slides-theme-seriph h1,
    .slides-theme-seriph h2,
    .slides-theme-seriph h3 {
      font-family: var(--slide-font) !important;
      letter-spacing: 0.025em;
      font-weight: 700;
    }
    .slides-theme-seriph .layout-cover h1 {
      background: none !important;
      -webkit-background-clip: initial !important;
      -webkit-text-fill-color: initial !important;
      color: var(--slide-accent) !important;
      font-size: 3.4rem !important;
      font-weight: 700 !important;
      border-bottom: 2px solid var(--slide-accent);
      display: inline-block;
      padding-bottom: 10px;
      margin-bottom: 24px;
    }
    .slides-theme-seriph .layout-cover p {
      font-style: italic;
      color: var(--slide-text-secondary);
    }
    /* 优雅衬线风：内容页顶部标题学术双线眉批 */
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3 {
      display: block;
      position: relative;
      color: var(--slide-accent);
      border-bottom: 1.5px solid color-mix(in srgb, var(--slide-accent) 45%, transparent);
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2::after,
    .slides-theme-seriph .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 3px;
      height: 1.5px;
      pointer-events: none;
      background: linear-gradient(90deg, var(--slide-accent) 0%, color-mix(in srgb, var(--slide-accent) 35%, transparent) 50%, transparent 92%);
    }
    .slides-theme-seriph blockquote {
      position: relative;
      font-style: italic;
      border-left: 2px solid var(--slide-accent) !important;
      background: color-mix(in srgb, var(--slide-accent) 6%, transparent) !important;
      padding: 14px 20px 14px 28px !important;
      border-radius: 4px;
      margin: 12px 0 !important;
    }
    .slides-theme-seriph blockquote::before {
      content: "“";
      position: absolute;
      left: 8px;
      top: 6px;
      font-size: 2rem;
      line-height: 1;
      color: var(--slide-accent);
      opacity: 0.6;
      font-family: Georgia, serif;
    }
    .slides-theme-seriph pre {
      border: 1px solid var(--slide-code-border) !important;
      border-radius: 4px !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
    }

    /* 3. 极简发布会主题 Apple Basic (苹果 Keynote / 瑞士纯粹主义) */
    [data-slides-theme="apple-basic"],
    .slides-theme-apple-basic {
      --slide-font: -apple-system, "SF Pro Display", "SF Pro Text", BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
      --slide-accent: #0071e3;
      --slide-accent-secondary: #0077ed;
      letter-spacing: -0.025em;
    }
    [data-theme="light"][data-slides-theme="apple-basic"],
    [data-theme="light"] .slides-theme-apple-basic {
      --slide-bg: #ffffff;
      --slide-text: #000000;
      --slide-text-secondary: #6e6e73;
      --slide-code-bg: #f5f5f7;
      --slide-code-border: transparent;
      --slide-accent: #0071e3;
      --slide-accent-secondary: #0077ed;
      --slide-card-bg: #f5f5f7;
      --slide-card-border: transparent;
      --slide-card-shadow: none;
    }
    [data-theme="dark"][data-slides-theme="apple-basic"],
    [data-theme="dark"] .slides-theme-apple-basic {
      --slide-bg: #000000;
      --slide-text: #ffffff;
      --slide-text-secondary: #86868b;
      --slide-code-bg: #161617;
      --slide-code-border: transparent;
      --slide-accent: #2997ff;
      --slide-accent-secondary: #64d2ff;
      --slide-card-bg: #161617;
      --slide-card-border: transparent;
      --slide-card-shadow: none;
    }
    .slides-theme-apple-basic,
    .slides-theme-apple-basic .slide-content {
      font-family: var(--slide-font) !important;
    }
    .slides-theme-apple-basic h1,
    .slides-theme-apple-basic h2,
    .slides-theme-apple-basic h3 {
      letter-spacing: -0.035em;
      font-weight: 800;
    }
    .slides-theme-apple-basic .layout-cover h1 {
      background: none !important;
      -webkit-background-clip: initial !important;
      -webkit-text-fill-color: initial !important;
      color: var(--slide-text) !important;
      font-size: 4rem !important;
      font-weight: 800 !important;
      letter-spacing: -0.045em !important;
      margin-bottom: 12px;
    }
    .slides-theme-apple-basic .layout-cover p {
      color: var(--slide-text-secondary) !important;
      font-size: 1.35rem !important;
      font-weight: 500 !important;
      opacity: 1 !important;
    }
    /* 极简发布会风：彻底去装饰化，高字重、紧凑字距与充沛留白 */
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2,
    .slides-theme-apple-basic .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3 {
      border: none !important;
      background: none !important;
      padding: 0 !important;
      margin-bottom: 16px !important;
      letter-spacing: -0.04em !important;
      font-weight: 800 !important;
    }
    .slides-theme-apple-basic pre {
      border-radius: 16px !important;
      border: none !important;
      background: var(--slide-code-bg) !important;
      box-shadow: none !important;
    }
    .slides-theme-apple-basic blockquote {
      border-left: none !important;
      background: var(--slide-card-bg) !important;
      border-radius: 14px !important;
      padding: 18px 24px !important;
      font-size: 1.15rem !important;
      color: var(--slide-text) !important;
    }

    /* 复杂背景防穿透文字保护 (Text Scrim & Backdrop Protection) */
    .slide-viewport[style*="background-image"] .slide-content h1,
    .slide-viewport[style*="background-image"] .slide-content h2,
    .slide-viewport[style*="background-image"] .slide-content h3,
    .slide-viewport[style*="background-image"] .slide-content p,
    .slide-viewport[style*="background-image"] .slide-content li {
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75), 0 2px 8px rgba(0, 0, 0, 0.45);
    }
    [data-theme="light"].slide-viewport[style*="background-image"] .slide-content h1,
    [data-theme="light"].slide-viewport[style*="background-image"] .slide-content h2,
    [data-theme="light"].slide-viewport[style*="background-image"] .slide-content h3,
    [data-theme="light"].slide-viewport[style*="background-image"] .slide-content p,
    [data-theme="light"].slide-viewport[style*="background-image"] .slide-content li {
      text-shadow: 0 1px 3px rgba(255, 255, 255, 0.85);
    }
    .slide-viewport[style*="background-image"] .layout-cols-grid > div,
    .slide-viewport[style*="background-image"] .layout-two-cols-grid > div,
    .slide-viewport[style*="background-image"] .layout-three-cols-grid > div,
    .slide-viewport[style*="background-image"] .two-cols-left,
    .slide-viewport[style*="background-image"] .two-cols-right,
    .slide-viewport[style*="background-image"] .pdf-col {
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    /* 封面页在背景图或显式设置文字颜色时，禁用透明渐变镂空，避免与 text-shadow 叠加成浮雕黑芯并遵循主题及实际文字色 */
    .slide-viewport[style*="background-image"] .layout-cover h1,
    .slide-viewport[style*="background-image"] .layout-cover .slide-block h1,
    .slides-overview-canvas[style*="background-image"].layout-cover h1,
    .slides-overview-canvas[style*="background-image"].layout-cover .slide-block h1,
    .slides-overview-canvas[style*="background-image"] .layout-cover h1,
    .slides-overview-canvas[style*="background-image"] .layout-cover .slide-block h1,
    .slides-theme-tech .layout-cover .slide-block[style^="color:"] h1,
    .slides-theme-tech .layout-cover .slide-block[style*=" color:"] h1,
    .slides-theme-tech .layout-cover .slide-block[style*=";color:"] h1,
    .slides-theme-tech .layout-cover h1[style^="color:"],
    .slides-theme-tech .layout-cover h1[style*=" color:"],
    .slides-theme-tech .layout-cover h1[style*=";color:"] {
      background: none !important;
      -webkit-background-clip: initial !important;
      -webkit-text-fill-color: initial !important;
    }
    .layout-cover h1 span[style^="color:"],
    .layout-cover h1 span[style*=" color:"],
    .layout-cover h1 span[style*=";color:"],
    .layout-cover h1 font[color] {
      -webkit-background-clip: initial !important;
      -webkit-text-fill-color: currentColor !important;
    }
    /* 当内容页存在背景图时，顶部标题回退至高对比正文字色并配合局部半透明底衬，同时保留主题装饰 */
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2,
    .slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3 {
      color: var(--slide-text);
    }
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) > .slide-block:first-child h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .slide-block:first-child h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .slide-block:first-child h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-left-content > .slide-block:first-child h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .image-right-content > .slide-block:first-child h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .slide-block:first-child h3,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h1,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h2,
    .slides-theme-tech.slide-viewport[style*="background-image"] .slide-content:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .slide-block:first-child h3 {
      background: linear-gradient(90deg, color-mix(in srgb, var(--slide-bg) 42%, transparent), transparent 82%);
    }
    /* 用户显式块级前景色优先于主题及背景图默认回退色 */
    .slide-viewport .slide-block[style^="color:"] h1,
    .slide-viewport .slide-block[style*=" color:"] h1,
    .slide-viewport .slide-block[style*=";color:"] h1,
    .slide-viewport .slide-block[style^="color:"] h2,
    .slide-viewport .slide-block[style*=" color:"] h2,
    .slide-viewport .slide-block[style*=";color:"] h2,
    .slide-viewport .slide-block[style^="color:"] h3,
    .slide-viewport .slide-block[style*=" color:"] h3,
    .slide-viewport .slide-block[style*=";color:"] h3 {
      color: inherit !important;
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
      transform: translate(-50%, -50%) scale(var(--slides-slide-scale, 1));
      transform-origin: center center; will-change: transform;
      transition: background 0.3s ease, color 0.3s ease, border-radius 0.2s ease, box-shadow 0.2s ease;
      container-type: size;
    }
    :fullscreen .slide-viewport, .is-fullscreen .slide-viewport {
      border-radius: 0 !important; box-shadow: none !important;
    }
    .slide-content {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100%;
      flex: 1 1 0%;
      padding: var(--slides-padding-y, 32px) var(--slides-padding-x, 48px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* 间距预设风格 */
    .slide-content.spacing-compact,
    .slide-viewport[data-spacing="compact"] .slide-content,
    [data-slides-spacing="compact"] {
      --slides-padding-y: 16px;
      --slides-padding-x: 28px;
      --slides-block-gap: 8px;
      --slides-list-gap: 4px;
      --slides-cols-gap: 20px;
      --slides-title-margin-bottom: 8px;
      --slides-header-gap: 10px;
      --slides-line-height: 1.45;
    }
    .slide-content.spacing-normal,
    .slide-viewport[data-spacing="normal"] .slide-content,
    [data-slides-spacing="normal"] {
      --slides-padding-y: 32px;
      --slides-padding-x: 48px;
      --slides-block-gap: 14px;
      --slides-list-gap: 6px;
      --slides-cols-gap: 32px;
      --slides-title-margin-bottom: 12px;
      --slides-header-gap: 16px;
      --slides-line-height: 1.6;
    }
    .slide-content.spacing-loose,
    .slide-viewport[data-spacing="loose"] .slide-content,
    [data-slides-spacing="loose"] {
      --slides-padding-y: 52px;
      --slides-padding-x: 72px;
      --slides-block-gap: 22px;
      --slides-list-gap: 10px;
      --slides-cols-gap: 44px;
      --slides-title-margin-bottom: 18px;
      --slides-header-gap: 24px;
      --slides-line-height: 1.75;
    }

    /* Cover, Center, Fact, Quote, Intro 版式样式全链路对齐 */
    .layout-cover,
    .layout-center,
    .layout-fact,
    .layout-cover-container,
    .layout-center-container,
    .layout-fact-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      width: 100%;
      height: 100%;
      min-height: 0;
      box-sizing: border-box;
      flex: 1;
    }

    .layout-cover h1, .layout-cover .slide-block h1, .layout-cover-container h1 { font-size: 3.8rem !important; font-weight: 800 !important; line-height: 1.15 !important; letter-spacing: -0.025em !important; margin-bottom: 16px !important; }
    .layout-cover h2, .layout-cover .slide-block h2, .layout-cover-container h2 { font-size: 1.85rem !important; font-weight: 600 !important; opacity: 0.85 !important; margin-bottom: 12px !important; }
    .layout-cover p, .layout-cover .slide-block p, .layout-cover-container p { font-size: 1.45rem !important; line-height: 1.5 !important; opacity: 0.85 !important; }

    /* Center 版式：保持标准字阶梯但全屏绝对居中对齐 */
    .layout-center-container { padding: 40px 60px; }
    .layout-center-container h1, .layout-center h1 { font-size: 2.8rem !important; font-weight: 700 !important; margin-bottom: 16px !important; }
    .layout-center-container p, .layout-center p { font-size: 1.35rem !important; line-height: 1.6 !important; max-width: 800px; margin-left: auto; margin-right: auto; }

    ${getSharedLayoutStyles()}

    /* 表头多栏内超级块子块首个列表项去圆点后居中显示标题/首行文本 (仅在存在超级块分栏时生效) */
    .has-superblock-cols .pdf-col > *:first-child .slide-list-item-title,
    .has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6),
    .has-superblock-cols .pdf-col > *:first-child p.slide-list-item-title,
    .has-superblock-cols .pdf-col > *:first-child p:first-of-type,
    .has-superblock-cols .pdf-col > *:first-child p:first-child,
    .has-superblock-cols .pdf-col > *:first-child :is(ul, ol) > li:first-child,
    .has-superblock-cols .pdf-col > *:first-child .slide-list > .slide-list-item:first-child,
    .has-superblock-cols .pdf-col > *:first-child .pdf-list > li:first-child,
    .has-superblock-cols .slides-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    .has-superblock-cols .slides-col-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
      list-style: none !important;
      list-style-type: none !important;
      text-align: center !important;
      margin-left: 0 !important;
      padding-left: 0 !important;
      width: 100% !important;
    }

    /* 彻底清除首个列表项的原生圆点 Marker (仅在存在超级块分栏时生效) */
    .has-superblock-cols .pdf-col > *:first-child :is(ul, ol) > li:first-child::marker {
      content: "" !important;
      display: none !important;
    }

    /* 确保首个列表项内部内联与块级元素居中 (仅在存在超级块分栏时生效) */
    .has-superblock-cols .pdf-col > *:first-child :is(ul, ol) > li:first-child * {
      text-align: center !important;
    }

    /* 栏内说明段落与列表项：左对齐，自然阅读排版 */
    .has-superblock-cols .pdf-col .slide-list-item-desc,
    .has-superblock-cols .pdf-col li:not(:first-child) {
      text-align: left !important;
    }

    /* 全局特定标题大小规范化 (除封面外页首首个标题按 H2 1.7rem，表头多栏内首个标题按 H3 1.3rem) */
    [data-normalize-headings="true"] .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .slides-page-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .slide-content:not(.layout-cover) > :is(.pdf-block, .slide-block):first-child :is(h1, h2, h3, h4, h5, h6),
    [data-normalize-headings="true"] .slide-content:not(.layout-cover) > .layout-header-section :is(.pdf-block, .slide-block):first-child :is(h1, h2, h3, h4, h5, h6),
    [data-normalize-headings="true"] .slide-content:not(.layout-cover) > :not(.layout-cols-wrapper):not(.pdf-two-cols-wrapper):not(.layout-image-cols-grid):first-child :is(h1, h2, h3, h4, h5, h6) {
      font-size: 1.7rem !important;
      font-weight: 600 !important;
      line-height: 1.25 !important;
      margin-bottom: var(--slides-title-margin-bottom, 10px) !important;
    }

    [data-normalize-headings="true"] .has-superblock-cols .slides-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .has-superblock-cols .slides-col-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
      font-size: 1.3rem !important;
      font-weight: 600 !important;
      line-height: 1.3 !important;
      margin-bottom: 8px !important;
      text-align: center !important;
    }

    /* 图左与图右版式标题完全保留用户原始字号与默认排版，不进行任何固定大小规范化 */
    [data-normalize-headings="true"] :is(.layout-image-left, .layout-image-right, .image-left-content, .image-right-content) :is(h1, h2, h3, h4, h5, h6) {
      text-align: left !important;
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
      grid-template-columns: var(--slide-grid-cols, minmax(0, 1fr) minmax(0, 1fr));
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
      padding: var(--slides-padding-y, 32px) var(--slides-padding-x, 48px);
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
    .slide-block { margin-bottom: var(--slides-block-gap, 14px); line-height: var(--slides-line-height, 1.6); }
    .slide-block h1 { font-size: 2.2rem; margin-bottom: var(--slides-title-margin-bottom, 12px); }
    .slide-block h2 { font-size: 1.7rem; margin-bottom: calc(var(--slides-title-margin-bottom, 10px) * 0.85); }
    .slide-block p { font-size: 1.15rem; line-height: var(--slides-line-height, 1.6); }
    .slide-block ul, .slide-block ol, .pdf-list {
      padding-left: 28px;
      margin: calc(var(--slides-block-gap, 14px) * 0.6) 0;
      display: flex;
      flex-direction: column;
      gap: var(--slides-list-gap, 6px);
    }
    .slide-block li, .pdf-list li {
      font-size: 1.15rem;
      line-height: var(--slides-line-height, 1.6);
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

    /* 两栏与三栏及多栏（超级块分栏）布局：紧凑自然行距，子列表保留圆点与层级缩进 */
    .layout-two-cols ul,
    .layout-cols-header ul,
    .layout-two-cols-header ul,
    .layout-three-cols ul,
    .layout-three-cols-header ul,
    .two-cols-left ul,
    .two-cols-right ul,
    .three-cols-col ul,
    .col ul,
    .pdf-col ul,
    .layout-two-cols-grid .pdf-list,
    .layout-three-cols-grid .pdf-list,
    .layout-cols-grid .pdf-list,
    .layout-two-cols-grid .pdf-list--unordered,
    .layout-three-cols-grid .pdf-list--unordered,
    .layout-cols-grid .pdf-list--unordered {
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

    .layout-two-cols ol,
    .layout-cols-header ol,
    .layout-two-cols-header ol,
    .layout-three-cols ol,
    .layout-three-cols-header ol,
    .two-cols-left ol,
    .two-cols-right ol,
    .three-cols-col ol,
    .col ol,
    .pdf-col ol,
    .layout-two-cols-grid .pdf-list--ordered,
    .layout-three-cols-grid .pdf-list--ordered,
    .layout-cols-grid .pdf-list--ordered {
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

    .layout-two-cols li,
    .layout-cols-header li,
    .layout-two-cols-header li,
    .layout-three-cols li,
    .layout-three-cols-header li,
    .two-cols-left li,
    .two-cols-right li,
    .three-cols-col li,
    .col li,
    .pdf-col li,
    .pdf-col .pdf-list-item {
      padding-left: 0.2em !important;
      margin-left: 0 !important;
      margin-bottom: var(--slides-list-gap, 6px) !important;
      flex: 0 0 auto !important;
      height: auto !important;
      display: list-item !important;
      line-height: var(--slides-line-height, 1.6) !important;
    }

    .layout-two-cols ul ul,
    .layout-three-cols ul ul,
    .three-cols-col ul ul,
    .pdf-col ul ul {
      list-style: circle !important;
      list-style-type: circle !important;
      padding-left: 1.25em !important;
      margin-top: 4px !important;
      margin-bottom: 4px !important;
    }

    /* 列表项内嵌标题与说明排版 */
    .slide-list-item-title,
    .pdf-list li > h1,
    .pdf-list li > h2,
    .pdf-list li > h3,
    .pdf-list li > h4,
    .pdf-list li > h5,
    .pdf-list li > h6,
    li > h1.slide-list-item-title,
    li > h2.slide-list-item-title,
    li > h3.slide-list-item-title,
    li > h4.slide-list-item-title {
      margin-top: 2px !important;
      margin-bottom: 6px !important;
      line-height: 1.35 !important;
      font-weight: 700 !important;
    }
    .pdf-list li > h1, li > h1.slide-list-item-title { font-size: 1.6rem !important; }
    .pdf-list li > h2, li > h2.slide-list-item-title { font-size: 1.4rem !important; }
    .pdf-list li > h3, li > h3.slide-list-item-title { font-size: 1.22rem !important; }
    .pdf-list li > h4, li > h4.slide-list-item-title { font-size: 1.1rem !important; }

    /* 全局特定标题大小规范化后置强力锁定 (防止被列表项内部字号覆盖) */
    [data-normalize-headings="true"] .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .slides-page-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
      font-size: 1.7rem !important;
      font-weight: 600 !important;
      line-height: 1.25 !important;
      margin-bottom: 10px !important;
    }
    [data-normalize-headings="true"] .slides-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .slides-col-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] :is(.layout-cols-wrapper, .pdf-two-cols-wrapper, .layout-cols-header-container, .layout-cols-grid) .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] :is(.two-cols-left, .two-cols-right, .pdf-col, .col) > *:first-child :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
      font-size: 1.3rem !important;
      font-weight: 600 !important;
      line-height: 1.3 !important;
      margin-bottom: 8px !important;
      text-align: center !important;
    }
    /* 基础列表项前缀样式 */
    .slide-block ul,
    .slide-list--unordered,
    .pdf-list--unordered {
      list-style: disc !important;
      list-style-type: disc !important;
    }
    .slide-block ol,
    .slide-list--ordered,
    .pdf-list--ordered {
      list-style: decimal !important;
      list-style-type: decimal !important;
    }
    .slide-block li,
    .slide-list-item,
    .pdf-list-item,
    .pdf-list li {
      display: list-item !important;
    }

    /* 隐藏无序列表前缀标记 */
    [data-hide-unordered-markers="true"] :is(ul, .slide-list, .slide-list--unordered, .pdf-list, .pdf-list--unordered),
    [data-hide-unordered-markers="true"] :is(ul, .slide-list, .slide-list--unordered, .pdf-list, .pdf-list--unordered) > li,
    [data-hide-unordered-markers="true"] li.slide-list-item,
    [data-hide-unordered-markers="true"] ul > li {
      list-style: none !important;
      list-style-type: none !important;
      padding-left: 0 !important;
      margin-left: 0 !important;
    }
    [data-hide-unordered-markers="true"] :is(ul, .slide-list, .slide-list--unordered, .pdf-list, .pdf-list--unordered) > li::marker,
    [data-hide-unordered-markers="true"] li.slide-list-item::marker {
      content: "" !important;
      display: none !important;
    }

    /* 隐藏有序列表前缀标记 */
    [data-hide-ordered-markers="true"] :is(ol, .slide-list, .slide-list--ordered, .pdf-list, .pdf-list--ordered),
    [data-hide-ordered-markers="true"] :is(ol, .slide-list, .slide-list--ordered, .pdf-list, .pdf-list--ordered) > li,
    [data-hide-ordered-markers="true"] li.slide-list-item,
    [data-hide-ordered-markers="true"] ol > li {
      list-style: none !important;
      list-style-type: none !important;
      padding-left: 0 !important;
      margin-left: 0 !important;
    }
    [data-hide-ordered-markers="true"] :is(ol, .slide-list, .slide-list--ordered, .pdf-list, .pdf-list--ordered) > li::marker,
    [data-hide-ordered-markers="true"] li.slide-list-item::marker {
      content: "" !important;
      display: none !important;
    }

    .slide-list-item-desc,
    .pdf-list li > p {
      margin-top: 4px !important;
      margin-bottom: 6px !important;
      font-size: 1.05rem;
      line-height: 1.55;
      opacity: 0.92;
    }

    /* 多媒体（GIF动图、静态图片、MP4视频）全视口最大化自适应且不超出视口 */
    .slide-media-block,
    .slide-media-container,
    .slide-video-container,
    .slide-block--media,
    .slide-block--image,
    .slide-block--video,
    .slide-block:has(> img),
    .slide-block:has(> .slide-media-container),
    .slide-block:has(> p > img:only-child),
    .slide-block:has(> .slide-video-container),
    .slide-block:has(> video) {
      flex: 1 1 0% !important;
      min-height: 0 !important;
      min-width: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      overflow: hidden !important;
      margin: 4px 0 !important;
      box-sizing: border-box !important;
    }

    .two-cols-left > .slide-block,
    .two-cols-right > .slide-block,
    .three-cols-col > .slide-block,
    .pdf-col > .slide-block,
    .pdf-col .slide-block {
      flex: 1 1 0% !important;
      min-height: 0 !important;
      max-height: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      margin-bottom: 0 !important;
    }

    /* 列内列表项的标题与段落文字：固定高度，不压缩 */
    .two-cols-left .slide-list-item-title,
    .two-cols-right .slide-list-item-title,
    .three-cols-col .slide-list-item-title,
    .pdf-col .slide-list-item-title,
    .two-cols-left h1, .two-cols-left h2, .two-cols-left h3, .two-cols-left h4, .two-cols-left h5, .two-cols-left h6,
    .two-cols-right h1, .two-cols-right h2, .two-cols-right h3, .two-cols-right h4, .two-cols-right h5, .two-cols-right h6,
    .three-cols-col h1, .three-cols-col h2, .three-cols-col h3, .three-cols-col h4, .three-cols-col h5, .three-cols-col h6,
    .pdf-col h1, .pdf-col h2, .pdf-col h3, .pdf-col h4, .pdf-col h5, .pdf-col h6,
    .three-cols-col .slide-list-item-desc,
    .pdf-col .slide-list-item-desc {
      flex: 0 0 auto !important;
      margin-top: 0 !important;
      margin-bottom: 6px !important;
    }

    /* 列内媒体容器：填满标题下方所有剩余垂直空间，纵向顶部对齐，横向居中，无溢出 */
    .two-cols-left .slide-list-media,
    .two-cols-right .slide-list-media,
    .three-cols-col .slide-list-media,
    .pdf-col .slide-list-media,
    .two-cols-left .slide-video-container,
    .two-cols-right .slide-video-container,
    .three-cols-col .slide-video-container,
    .pdf-col .slide-video-container,
    .two-cols-left .slide-media-container,
    .two-cols-right .slide-media-container,
    .three-cols-col .slide-media-container,
    .pdf-col .slide-media-container {
      flex: 1 1 0% !important;
      min-height: 0 !important;
      min-width: 0 !important;
      width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      max-width: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }

    /* 列内多媒体播放器：以 contain 模式等比缩放完整可见，绝对不超高超宽、不产生遮挡与滚动条 */
    .two-cols-left video,
    .two-cols-right video,
    .three-cols-col video,
    .pdf-col video,
    .two-cols-left img,
    .two-cols-right img,
    .three-cols-col img,
    .pdf-col img,
    .two-cols-left .slide-video-player,
    .two-cols-right .slide-video-player,
    .three-cols-col .slide-video-player,
    .pdf-col .slide-video-player,
    .layout-three-cols-grid video,
    .layout-two-cols-grid video,
    .layout-three-cols-grid img,
    .layout-two-cols-grid img {
      max-width: 100% !important;
      max-height: 100% !important;
      width: auto !important;
      height: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
      object-fit: contain !important;
      display: block !important;
      margin: 0 auto !important;
      cursor: zoom-in;
    }

    .slide-block img,
    .slide-media-img,
    .slide-media-container img,
    .slide-video-player,
    video.slide-video-player,
    .slide-block video {
      max-width: 100% !important;
      max-height: 100% !important;
      width: auto !important;
      height: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
      object-fit: contain !important;
      display: block !important;
      margin: 0 auto !important;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
      background: transparent;
      outline: none;
      cursor: zoom-in;
    }

    .slide-list-media {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      width: 100% !important;
      max-width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      flex: 1 1 0% !important;
      margin-top: 4px !important;
      margin-bottom: 4px !important;
      min-height: 0 !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    .slide-list-media img,
    .slide-list-media video,
    .slide-list-media .list-item-gif,
    .slide-list-media .slide-video-player {
      max-width: 100% !important;
      max-height: 100% !important;
      width: auto !important;
      height: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
      object-fit: contain !important;
      border-radius: 6px !important;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.14) !important;
      display: block !important;
      margin: 0 auto !important;
      cursor: zoom-in;
    }

    .slide-block:has(.slide-list-media) {
      flex: 1 1 0% !important;
      min-height: 0 !important;
      height: 100% !important;
      max-height: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }
    .slide-block:has(.slide-list-media) .pdf-list,
    .slide-block:has(.slide-list-media) ul,
    .slide-block:has(.slide-list-media) ol {
      display: block !important;
      flex: 1 1 auto;
      min-height: 0;
      max-height: 100%;
      overflow: visible !important;
      list-style: disc !important;
      list-style-type: disc !important;
    }
    .slide-block:has(.slide-list-media) li,
    .slide-block:has(.slide-list-media) .slide-list-item,
    .slide-block:has(.slide-list-media) .pdf-list-item,
    .slide-block:has(.slide-media-container) li,
    .slide-block:has(.slide-video-container) li,
    .layout-cols-wrapper li:has(.slide-list-media),
    .layout-cols-header-container li:has(.slide-list-media),
    .two-cols-left li:has(.slide-list-media),
    .two-cols-right li:has(.slide-list-media),
    .three-cols-col li:has(.slide-list-media),
    .pdf-col li:has(.slide-list-media),
    li:has(.slide-list-media),
    li:has(.slide-video-container),
    li:has(.slide-media-container) {
      display: list-item !important;
      list-style-type: disc !important;
      flex: 0 0 auto !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      margin-bottom: 6px !important;
    }

    .layout-two-cols .slide-media-block,
    .layout-two-cols .slide-video-container,
    .layout-two-cols .slide-media-container,
    .layout-three-cols .slide-media-block,
    .layout-three-cols .slide-video-container,
    .layout-three-cols .slide-media-container {
      max-width: 100% !important;
      max-height: 100% !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      overflow: hidden !important;
    }

    ${getStandaloneExtraStyles()}
    }`;
}
