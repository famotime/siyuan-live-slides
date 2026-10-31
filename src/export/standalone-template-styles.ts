import { generateCompleteSiYuanThemeCss } from "../compiler/theme-styles-generator"

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
    .slide-content {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100%;
      flex: 1 1 0%;
      padding: var(--slidev-padding-y, 32px) var(--slidev-padding-x, 48px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* 间距预设风格 */
    .slide-content.spacing-compact,
    .slide-viewport[data-spacing="compact"] .slide-content,
    [data-slidev-spacing="compact"] {
      --slidev-padding-y: 20px;
      --slidev-padding-x: 36px;
      --slidev-header-gap: 10px;
      --slidev-title-margin-bottom: 6px;
    }
    .slide-content.spacing-normal,
    .slide-viewport[data-spacing="normal"] .slide-content,
    [data-slidev-spacing="normal"] {
      --slidev-padding-y: 32px;
      --slidev-padding-x: 48px;
      --slidev-header-gap: 16px;
      --slidev-title-margin-bottom: 10px;
    }
    .slide-content.spacing-loose,
    .slide-viewport[data-spacing="loose"] .slide-content,
    [data-slidev-spacing="loose"] {
      --slidev-padding-y: 48px;
      --slidev-padding-x: 56px;
      --slidev-header-gap: 24px;
      --slidev-title-margin-bottom: 16px;
    }

    .layout-cover { justify-content: center; align-items: center; text-align: center; }
    .layout-cover h1, .layout-cover .slide-block h1 { font-size: 3.8rem !important; font-weight: 800 !important; line-height: 1.15 !important; letter-spacing: -0.025em !important; margin-bottom: 16px !important; }
    .layout-cover h2, .layout-cover .slide-block h2 { font-size: 1.85rem !important; font-weight: 600 !important; opacity: 0.85 !important; margin-bottom: 12px !important; }
    .layout-cover p, .layout-cover .slide-block p { font-size: 1.45rem !important; line-height: 1.5 !important; opacity: 0.85 !important; }
    .two-cols-left, .two-cols-right { min-width: 0; width: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow-wrap: break-word; word-break: break-word; }
    .pdf-two-cols-wrapper,
    .layout-two-cols-grid,
    .layout-cols-wrapper,
    .layout-cols-grid {
      display: grid;
      grid-template-columns: var(--slide-grid-cols, minmax(0, 1fr) minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr) !important;
      gap: 32px;
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
      margin-bottom: var(--slidev-header-gap, 16px) !important;
      flex-shrink: 0;
    }
    .layout-header-section h1,
    .layout-header-section h2,
    .layout-header-section h3 {
      margin-bottom: var(--slidev-title-margin-bottom, 10px) !important;
    }
    .pdf-three-cols-wrapper,
    .layout-three-cols-grid {
      display: grid;
      grid-template-columns: var(--slide-grid-cols, minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr) !important;
      gap: 24px;
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
      gap: 20px;
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
      gap: 14px;
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
      overflow-wrap: break-word;
      word-break: break-word;
      box-sizing: border-box;
    }
    /* 表头多栏内超级块子块首个列表项去圆点后居中显示标题/首行文本 (仅在存在超级块分栏时生效) */
    .has-superblock-cols .pdf-col > *:first-child .slide-list-item-title,
    .has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6),
    .has-superblock-cols .pdf-col > *:first-child p.slide-list-item-title,
    .has-superblock-cols .pdf-col > *:first-child p:first-of-type,
    .has-superblock-cols .pdf-col > *:first-child p:first-child,
    .has-superblock-cols .pdf-col > *:first-child :is(ul, ol) > li:first-child,
    .has-superblock-cols .pdf-col > *:first-child .slide-list > .slide-list-item:first-child,
    .has-superblock-cols .pdf-col > *:first-child .pdf-list > li:first-child,
    .has-superblock-cols .slidev-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    .has-superblock-cols .slidev-col-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
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
    [data-normalize-headings="true"] .slidev-page-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .slidev-page-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .slide-content:not(.layout-cover) > :is(.pdf-block, .slide-block):first-child :is(h1, h2, h3, h4, h5, h6),
    [data-normalize-headings="true"] .slide-content:not(.layout-cover) > .layout-header-section :is(.pdf-block, .slide-block):first-child :is(h1, h2, h3, h4, h5, h6),
    [data-normalize-headings="true"] .slide-content:not(.layout-cover) > :not(.layout-cols-wrapper):not(.pdf-two-cols-wrapper):not(.layout-image-cols-grid):first-child :is(h1, h2, h3, h4, h5, h6) {
      font-size: 1.7rem !important;
      font-weight: 600 !important;
      line-height: 1.25 !important;
      margin-bottom: 10px !important;
    }

    [data-normalize-headings="true"] .has-superblock-cols .slidev-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .has-superblock-cols .slidev-col-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
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
      margin-bottom: 6px !important;
      flex: 0 0 auto !important;
      height: auto !important;
      display: list-item !important;
      line-height: 1.6 !important;
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
    [data-normalize-headings="true"] .slidev-page-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .slidev-page-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
      font-size: 1.7rem !important;
      font-weight: 600 !important;
      line-height: 1.25 !important;
      margin-bottom: 10px !important;
    }
    [data-normalize-headings="true"] .slidev-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .slidev-col-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] :is(.layout-cols-wrapper, .pdf-two-cols-wrapper, .layout-cols-header-container, .layout-cols-grid) .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] :is(.two-cols-left, .two-cols-right, .pdf-col, .col) > *:first-child :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
      font-size: 1.3rem !important;
      font-weight: 600 !important;
      line-height: 1.3 !important;
      margin-bottom: 8px !important;
      text-align: center !important;
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

    /* Lightbox 大图与视频灯箱模态窗口 */
    .slidev-lightbox {
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
    .slidev-lightbox.active {
      display: flex;
      opacity: 1;
    }
    .slidev-lightbox-content {
      position: relative;
      max-width: 92vw;
      max-height: 92vh;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: default;
    }
    .slidev-lightbox-img {
      max-width: 92vw;
      max-height: 92vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
      user-select: none;
      -webkit-user-drag: none;
      touch-action: none;
    }
    .slidev-lightbox-video {
      max-width: 92vw;
      max-height: 92vh;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
    }
    .slidev-lightbox-close {
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
    .slidev-lightbox-close:hover {
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
      opacity: 0; pointer-events: auto;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .controls::before {
      content: ""; position: absolute; top: -20px; bottom: -16px; left: -24px; right: -24px;
    }
    .controls:hover, .controls:focus-within {
      opacity: 1; transform: translateY(-2px);
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

    /* 页面动态蒙版 (Dynamic Mask) GPU 合成器硬件加速体系 */
    .slidev-mask-body-container {
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
    .slidev-mask-body-container--has-mask {
      overflow: hidden !important;
      /* 向左右、向下突破父容器内边距，完全贴合幻灯片视口边缘 */
      margin-left: calc(-1 * var(--slidev-padding-x, 48px)) !important;
      margin-right: calc(-1 * var(--slidev-padding-x, 48px)) !important;
      margin-bottom: calc(-1 * var(--slidev-padding-y, 32px)) !important;
      padding-left: var(--slidev-padding-x, 48px) !important;
      padding-right: var(--slidev-padding-x, 48px) !important;
      padding-bottom: var(--slidev-padding-y, 32px) !important;
      width: calc(100% + 2 * var(--slidev-padding-x, 48px)) !important;
      box-sizing: border-box !important;
    }
    /* 无标题且首个元素即为蒙版正文容器时，向上同步扩展至顶部边缘 */
    .slide-content-wrapper > .slidev-mask-body-container--has-mask:first-child,
    .slide-content > .slidev-mask-body-container--has-mask:first-child {
      margin-top: calc(-1 * var(--slidev-padding-y, 32px)) !important;
      padding-top: var(--slidev-padding-y, 32px) !important;
    }
    /* 针对全屏零内边距特殊布局（如 image-right/image-left），重置内边距变量避免越界 */
    .slide-content-wrapper.layout-image-right,
    .slide-content-wrapper.layout-image-left,
    .slide-content.layout-image-right,
    .slide-content.layout-image-left {
      --slidev-padding-x: 0px !important;
      --slidev-padding-y: 0px !important;
    }
    /* 蒙版运动总图层：纯 GPU Compositor 硬件加速 translate3d */
    .slidev-mask-layer {
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
    .slidev-mask-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .slidev-mask-layer--solid .slidev-mask-overlay,
    .slidev-mask-overlay--solid {
      background: var(--slide-bg, #ffffff);
    }
    [data-theme="dark"] .slidev-mask-layer--solid .slidev-mask-overlay,
    [data-theme="dark"] .slidev-mask-overlay--solid {
      background: var(--slide-bg, #121214);
    }
    .slidev-mask-layer--blur .slidev-mask-overlay,
    .slidev-mask-overlay--blur {
      backdrop-filter: blur(30px) saturate(180%);
      -webkit-backdrop-filter: blur(30px) saturate(180%);
      background: color-mix(in srgb, var(--slide-bg, #ffffff) 90%, transparent);
    }
    [data-theme="dark"] .slidev-mask-layer--blur .slidev-mask-overlay,
    [data-theme="dark"] .slidev-mask-overlay--blur {
      background: color-mix(in srgb, var(--slide-bg, #121214) 90%, transparent);
    }
    /* 动态展露分界提示线：物理内嵌于蒙版边缘，相对坐标永为 0，绝对物理同步 */
    .slidev-mask-divider-line {
      position: absolute;
      pointer-events: none;
      z-index: 51;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .slidev-mask-layer--down .slidev-mask-divider-line,
    .slidev-mask-divider-line--down {
      top: 0;
      left: 0;
      right: 0;
      height: 2.5px;
      transform: translateY(-50%);
      background: linear-gradient(90deg, transparent 0%, var(--slide-accent, #3b82f6) 6%, var(--slide-accent, #3b82f6) 94%, transparent 100%);
      box-shadow: 0 0 10px var(--slide-accent, #3b82f6), 0 0 4px var(--slide-accent, #3b82f6);
    }
    .slidev-mask-layer--right .slidev-mask-divider-line,
    .slidev-mask-divider-line--right {
      top: 0;
      bottom: 0;
      left: 0;
      width: 2.5px;
      transform: translateX(-50%);
      background: linear-gradient(180deg, transparent 0%, var(--slide-accent, #3b82f6) 6%, var(--slide-accent, #3b82f6) 94%, transparent 100%);
      box-shadow: 0 0 10px var(--slide-accent, #3b82f6), 0 0 4px var(--slide-accent, #3b82f6);
    }`;
}
