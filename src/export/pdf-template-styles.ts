import { generateCompleteSiYuanThemeCss } from "../compiler/theme-styles-generator"
import { getSharedLayoutStyles } from "./styles/shared-layout-styles"

export type TPdfPageRatio = "16:9" | "4:3" | "A4-landscape" | "A4-portrait"

/**
 * 获取对应纸张比例的 CSS @page 尺寸定义
 */
export function getPageSizeCss(ratio?: TPdfPageRatio): string {
  switch (ratio) {
    case "4:3":
      return "size: 12in 9in;"
    case "A4-landscape":
      return "size: 297mm 210mm;"
    case "A4-portrait":
      return "size: 210mm 297mm;"
    case "16:9":
    default:
      return "size: 16in 9in;"
  }
}

/**
 * 生成高保真 PDF 打印讲义专用样式表（包含思源配色变量、纸张尺寸、分栏网格与打印规则）
 */
export function generatePdfExportStyles(options?: {
  pageRatio?: TPdfPageRatio
  customInlineStyles?: any
}): string {
  const sizeCss = getPageSizeCss(options?.pageRatio)

  return `
    ${generateCompleteSiYuanThemeCss(options?.customInlineStyles)}

    @page {
      ${sizeCss}
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #f8fafc;
      color: #1e293b;
    }
    .pdf-slide-page {
      width: 100vw;
      height: 100vh;
      page-break-after: always;
      break-after: page;
      padding: var(--slides-padding-y, 36px) var(--slides-padding-x, 56px);
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
      overflow: hidden;
      container-type: size;
    }
    .pdf-slide-page.spacing-compact {
      --slides-padding-y: 16px;
      --slides-padding-x: 28px;
      --slides-block-gap: 8px;
      --slides-list-gap: 4px;
      --slides-cols-gap: 20px;
      --slides-title-margin-bottom: 8px;
      --slides-header-gap: 10px;
      --slides-line-height: 1.45;
    }
    .pdf-slide-page.spacing-normal {
      --slides-padding-y: 32px;
      --slides-padding-x: 48px;
      --slides-block-gap: 14px;
      --slides-list-gap: 6px;
      --slides-cols-gap: 32px;
      --slides-title-margin-bottom: 12px;
      --slides-header-gap: 16px;
      --slides-line-height: 1.6;
    }
    .pdf-slide-page.spacing-loose {
      --slides-padding-y: 52px;
      --slides-padding-x: 72px;
      --slides-block-gap: 22px;
      --slides-list-gap: 10px;
      --slides-cols-gap: 44px;
      --slides-title-margin-bottom: 18px;
      --slides-header-gap: 24px;
      --slides-line-height: 1.75;
    }
    .pdf-slide-page.theme-dark {
      background: #0f1117;
      color: #f1f5f9;
    }

    /* 1. 默认科技主题 Default (Modern Tech) */
    .pdf-slide-page.slides-theme-tech {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    .pdf-slide-page.slides-theme-tech.theme-light {
      background: #f8fafc;
      color: #0f172a;
    }
    .pdf-slide-page.slides-theme-tech.theme-dark {
      background: #090d16;
      color: #f1f5f9;
    }
    .slides-theme-tech .pdf-block h1 { color: #059669; }
    .theme-dark.slides-theme-tech .pdf-block h1 { color: #10b981; }
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h1,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h2,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h3,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h1,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h2,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h3,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h1,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h2,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h3,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h1,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h2,
    .slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h3 {
      color: #059669;
      border-left: 4px solid #059669;
      padding: 4px 14px;
      padding-left: 14px;
      background: linear-gradient(90deg, rgba(5, 150, 105, 0.13), transparent 76%);
      border-radius: 0 6px 6px 0;
      letter-spacing: -0.015em;
    }
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h1,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h2,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h3,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h1,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h2,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h3,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h1,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h2,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h3,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h1,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h2,
    .theme-dark.slides-theme-tech:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h3 {
      color: #10b981;
      border-left-color: #10b981;
      background: linear-gradient(90deg, rgba(16, 185, 129, 0.14), transparent 76%);
    }

    /* 2. 优雅衬线主题 Seriph (Editorial Academic) */
    .pdf-slide-page.slides-theme-seriph {
      font-family: "PT Serif", "Charter", "Georgia", "Cambria", "Times New Roman", "Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", serif;
      letter-spacing: 0.015em;
    }
    .pdf-slide-page.slides-theme-seriph.theme-light {
      background: #fcfbf7;
      color: #231f1d;
    }
    .pdf-slide-page.slides-theme-seriph.theme-dark {
      background: #171513;
      color: #f5f2eb;
    }
    .slides-theme-seriph .pdf-block h1 { color: #b45309; }
    .theme-dark.slides-theme-seriph .pdf-block h1 { color: #f59e0b; }
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h1,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h2,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h3,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h1,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h2,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h3,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h1,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h2,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h3,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h1,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h2,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h3 {
      display: block;
      position: relative;
      color: #b45309;
      border-bottom: 1.5px solid rgba(180, 83, 9, 0.45);
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h1::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h2::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h3::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h1::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h2::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h3::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h1::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h2::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h3::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h1::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h2::after,
    .slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h3::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 3px;
      height: 1.5px;
      pointer-events: none;
      background: linear-gradient(90deg, #b45309 0%, rgba(180, 83, 9, 0.35) 50%, transparent 92%);
    }
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h1,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h2,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h3,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h1,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h2,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h3,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h1,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h2,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h3,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h1,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h2,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h3 {
      color: #f59e0b;
      border-bottom-color: rgba(245, 158, 11, 0.45);
    }
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h1::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h2::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h3::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h1::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h2::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h3::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h1::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h2::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h3::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h1::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h2::after,
    .theme-dark.slides-theme-seriph:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h3::after {
      background: linear-gradient(90deg, #f59e0b 0%, rgba(245, 158, 11, 0.35) 50%, transparent 92%);
    }

    /* 3. 极简发布会主题 Apple Basic (Swiss Minimal) */
    .pdf-slide-page.slides-theme-apple-basic {
      font-family: -apple-system, "SF Pro Display", "SF Pro Text", BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
      letter-spacing: -0.025em;
    }
    .pdf-slide-page.slides-theme-apple-basic.theme-light {
      background: #ffffff;
      color: #000000;
    }
    .pdf-slide-page.slides-theme-apple-basic.theme-dark {
      background: #000000;
      color: #ffffff;
    }
    .slides-theme-apple-basic .pdf-block h1 {
      color: #000000;
      font-weight: 800;
      letter-spacing: -0.035em;
    }
    .theme-dark.slides-theme-apple-basic .pdf-block h1 {
      color: #ffffff;
      font-weight: 800;
      letter-spacing: -0.035em;
    }
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h1,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h2,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h3,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h1,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h2,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h3,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h1,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h2,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h3,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h1,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h2,
    .slides-theme-apple-basic:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h3 {
      border: none !important;
      background: none !important;
      padding: 0 !important;
      margin-bottom: 16px !important;
      letter-spacing: -0.04em !important;
      font-weight: 800 !important;
    }
    /* 页面存在背景图时，内容页顶部标题回退高对比文字与局部衬底，保留用户块级前景色 */
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h1,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h2,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .cols-header-top h3,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h1,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h2,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-header-top h3,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h1,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h2,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .three-cols-header-top h3,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h1,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h2,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-page-first-heading-block h3,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h1,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h2,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h3,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h1,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h2,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .two-cols-left > .pdf-block:first-child h3,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h1,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h2,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h3,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h1,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h2,
    .pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .slides-mask-body-container > .pdf-block:first-child h3 {
      color: #0f172a;
      text-shadow: 0 1px 3px rgba(255, 255, 255, 0.85);
    }
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h1,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h2,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-col--left > .pdf-block:first-child h3,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h1,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h2,
    .pdf-slide-page.theme-dark[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-content-col > .pdf-block:first-child h3 {
      color: #f8fafc;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }
    .slides-theme-tech.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .slides-theme-tech.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .slides-theme-tech.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .slides-theme-tech.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1,
    .slides-theme-tech.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2,
    .slides-theme-tech.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3 {
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.55), transparent 82%);
    }
    .slides-theme-tech.theme-dark.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h1,
    .slides-theme-tech.theme-dark.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h2,
    .slides-theme-tech.theme-dark.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .layout-header-section h3,
    .slides-theme-tech.theme-dark.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h1,
    .slides-theme-tech.theme-dark.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h2,
    .slides-theme-tech.theme-dark.pdf-slide-page[style*="background-image"]:not(.layout-cover):not(.layout-center):not(.layout-fact) .pdf-slide-body > .pdf-block:first-child h3 {
      background: linear-gradient(90deg, rgba(15, 23, 42, 0.42), transparent 82%);
    }
    .pdf-slide-page .pdf-block[style^="color:"] h1,
    .pdf-slide-page .pdf-block[style*=" color:"] h1,
    .pdf-slide-page .pdf-block[style*=";color:"] h1,
    .pdf-slide-page .pdf-block[style^="color:"] h2,
    .pdf-slide-page .pdf-block[style*=" color:"] h2,
    .pdf-slide-page .pdf-block[style*=";color:"] h2,
    .pdf-slide-page .pdf-block[style^="color:"] h3,
    .pdf-slide-page .pdf-block[style*=" color:"] h3,
    .pdf-slide-page .pdf-block[style*=";color:"] h3 {
      color: inherit !important;
    }
    .slides-theme-apple-basic .pdf-code,
    .slides-theme-apple-basic pre {
      border-radius: 14px !important;
      border-left: none !important;
    }
    .pdf-slide-header {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
    }
    .theme-dark .pdf-slide-header {
      border-bottom-color: #2e3346;
      color: #94a3b8;
    }
    .pdf-slide-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-size: 20px;
      line-height: 1.6;
      overflow: hidden;
    }
    .pdf-block h1 { font-size: 2.5rem; font-weight: 800; color: #2563eb; margin-bottom: 12px; }
    .pdf-block h2 { font-size: 1.9rem; font-weight: 700; color: #1d4ed8; margin-bottom: 10px; }
    .pdf-block h3 { font-size: 1.4rem; font-weight: 600; margin-bottom: 8px; }
    .pdf-block h4 { font-size: 1.2rem; font-weight: 600; margin-bottom: 6px; }
    .pdf-block p { font-size: 1.15rem; color: inherit; }
    .pdf-code,
    pre {
      background: #f1f5f9;
      padding: 14px 18px;
      border-radius: 6px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 0.95rem;
      border-left: 4px solid #3b82f6;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .pdf-code code,
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
    .theme-dark .pdf-code {
      background: #1e1e24;
      border-left-color: #60a5fa;
    }
    .pdf-quote {
      border-left: 4px solid #10b981;
      background: rgba(16, 185, 129, 0.08);
      padding: 10px 16px;
      border-radius: 0 4px 4px 0;
      font-style: italic;
    }
    .pdf-image,
    .slide-media-img {
      max-width: 100% !important;
      max-height: 48vh !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
      border-radius: 6px;
      margin: auto;
      display: block;
    }
    .slide-media-block,
    .slide-media-container,
    .slide-video-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      max-height: 48vh;
      margin: 8px 0;
      overflow: hidden;
    }
    .slide-list-media {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      margin-top: 8px;
      margin-bottom: 6px;
      max-width: 100%;
      overflow: hidden;
    }
    .slide-list-media img,
    .slide-list-media video,
    .slide-list-media .list-item-gif {
      max-width: 100% !important;
      max-height: min(280px, 36vh) !important;
      width: auto !important;
      height: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
      object-fit: contain !important;
      border-radius: 6px;
      display: block;
      margin: 0 auto !important;
    }
    .slide-video-player {
      max-width: 100% !important;
      max-height: 48vh !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
      border-radius: 6px;
      background: #000;
      border: 1px solid #cbd5e1;
    }
    .pdf-two-cols-wrapper,
    .layout-two-cols-grid,
    .layout-cols-wrapper,
    .layout-cols-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
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
      overflow: hidden;
      box-sizing: border-box;
      overflow-wrap: break-word;
      word-break: break-word;
      white-space: normal;
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
    [data-normalize-headings="true"] .pdf-slide:not(.layout-cover) > :is(.pdf-block, .slide-block):first-child :is(h1, h2, h3, h4, h5, h6),
    [data-normalize-headings="true"] .pdf-slide:not(.layout-cover) > .layout-header-section :is(.pdf-block, .slide-block):first-child :is(h1, h2, h3, h4, h5, h6),
    [data-normalize-headings="true"] .pdf-slide:not(.layout-cover) > :not(.layout-cols-wrapper):not(.pdf-two-cols-wrapper):not(.layout-image-cols-grid):first-child :is(h1, h2, h3, h4, h5, h6) {
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
    .pdf-col > .pdf-block,
    .pdf-col > .slide-block {
      flex: 1 1 0% !important;
      min-height: 0 !important;
      max-height: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
    }
    .pdf-col .slide-list-item-title,
    .pdf-col h1, .pdf-col h2, .pdf-col h3, .pdf-col h4, .pdf-col h5, .pdf-col h6,
    .pdf-col .slide-list-item-desc {
      flex: 0 0 auto !important;
      margin-top: 0 !important;
      margin-bottom: 6px !important;
    }
    .pdf-col .slide-list-media,
    .pdf-col .slide-video-container,
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
    .pdf-col li:has(.slide-list-media),
    .pdf-col li:has(.slide-media-container),
    .pdf-col li:has(.slide-video-container),
    .pdf-col li:has(img),
    .pdf-col li:has(video),
    .pdf-col .pdf-list-item:has(.slide-list-media),
    .pdf-col .pdf-list-item:has(.slide-media-container),
    .pdf-col .pdf-list-item:has(.slide-video-container),
    .pdf-col .pdf-list-item:has(img),
    .pdf-col .pdf-list-item:has(video) {
      display: list-item !important;
      list-style-type: disc !important;
      flex: 0 0 auto !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      margin-bottom: 6px !important;
    }
    .pdf-col video,
    .layout-three-cols-grid video,
    .layout-two-cols-grid video,
    .pdf-col img,
    .layout-three-cols-grid img,
    .layout-two-cols-grid img,
    .pdf-col .slide-video-player {
      max-width: 100% !important;
      max-height: 100% !important;
      width: auto !important;
      height: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
      object-fit: contain !important;
      display: block !important;
      margin: 0 auto !important;
    }
    .pdf-col * {
      overflow-wrap: break-word;
      word-break: break-word;
      box-sizing: border-box;
    }
    .pdf-col pre {
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .pdf-list-item {
      padding-left: 20px;
    }
    .pdf-list {
      padding-left: 24px;
      margin: calc(var(--slides-block-gap, 14px) * 0.6) 0;
      display: flex;
      flex-direction: column;
      gap: var(--slides-list-gap, 6px);
    }
    .pdf-list li {
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
    .pdf-two-cols-wrapper ul,
    .pdf-three-cols-wrapper ul,
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
    .pdf-two-cols-wrapper ol,
    .pdf-three-cols-wrapper ol,
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
    [data-normalize-headings="true"] .has-superblock-cols .slides-col-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .has-superblock-cols .slides-col-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title),
    [data-normalize-headings="true"] .has-superblock-cols .pdf-col > *:first-child :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title) {
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
    .theme-dark kbd {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.25);
      border-bottom-color: rgba(255, 255, 255, 0.4);
      color: #f1f5f9;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }
    a {
      color: inherit;
      text-decoration: none;
      border-bottom: 1px dashed currentColor;
    }
    .slides-ref-tag, a.slides-ref-tag {
      display: inline-flex;
      align-items: center;
      background: rgba(16, 185, 129, 0.1);
      color: #059669;
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 0.88em;
      text-decoration: none;
      margin: 2px 4px 2px 0;
    }
    .theme-dark .slides-ref-tag, .theme-dark a.slides-ref-tag {
      background: rgba(52, 211, 153, 0.15);
      color: #34d399;
      border-color: rgba(52, 211, 153, 0.3);
    }
    .slides-block-ref, .pdf-block--ref {
      background: rgba(16, 185, 129, 0.06);
      border-left: 3px solid #059669;
      border-radius: 0 6px 6px 0;
      padding: 10px 14px;
      margin: 8px 0;
    }
    .theme-dark .slides-block-ref, .theme-dark .pdf-block--ref {
      background: rgba(52, 211, 153, 0.08);
      border-left-color: #34d399;
    }
    .pdf-slide-notes {
      font-size: 14px;
      color: #059669;
      border-top: 1px dashed #cbd5e1;
      padding-top: 12px;
      margin-top: auto;
      line-height: 1.5;
    }
    .theme-dark .pdf-slide-notes {
      color: #34d399;
      border-top-color: #334155;
    }
    /* Layouts */
    .layout-cover .pdf-slide-body,
    .layout-center .pdf-slide-body,
    .layout-fact .pdf-slide-body,
    .layout-cover-container,
    .layout-center-container,
    .layout-fact-container {
      justify-content: center;
      align-items: center;
      text-align: center;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .layout-cover h1,
    .layout-cover-container h1 {
      font-size: 3.2rem;
      font-weight: 800;
      margin-bottom: 16px;
    }
    .layout-center-container h1,
    .layout-center h1 {
      font-size: 2.6rem;
      font-weight: 700;
    }
    .layout-fact .fact-hero-glow,
    .layout-fact-container .fact-hero-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 600px;
      height: 600px;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.22) 0%, rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.05) 45%, transparent 70%);
      pointer-events: none;
      filter: blur(28px);
      z-index: 0;
    }
    .layout-fact .fact-stats-grid,
    .layout-fact-container .fact-stats-grid {
      position: relative;
      z-index: 1;
      display: grid;
      width: 100%;
      gap: 32px;
      justify-content: center;
      align-items: center;
    }
    .layout-fact-container .fact-stats-grid--cols-1 { grid-template-columns: 1fr; max-width: 800px; }
    .layout-fact-container .fact-stats-grid--cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 48px; }
    .layout-fact-container .fact-stats-grid--cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }
    .layout-fact-container .fact-stats-grid--cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
    .layout-fact .fact-stat-card,
    .layout-fact-container .fact-stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      width: 100%;
      box-sizing: border-box;
      padding: 10px 14px;
    }
    .layout-fact .fact-value,
    .layout-fact-container .fact-value,
    .layout-fact .fact-value-wrapper,
    .layout-fact-container .fact-value-wrapper,
    .layout-fact .fact-value-box,
    .layout-fact-container .fact-value-box {
      font-weight: 900 !important;
      color: var(--slide-accent, #3b82f6) !important;
      line-height: 1.05 !important;
      margin-bottom: 8px;
    }
    .layout-fact-cols-1 .fact-value-wrapper,
    .fact-stats-grid--cols-1 .fact-value-wrapper { font-size: 5.5rem !important; }
    .layout-fact-cols-2 .fact-value-wrapper,
    .fact-stats-grid--cols-2 .fact-value-wrapper { font-size: 4.2rem !important; }
    .layout-fact-cols-3 .fact-value-wrapper,
    .fact-stats-grid--cols-3 .fact-value-wrapper { font-size: 3.4rem !important; }
    .layout-fact-cols-4 .fact-value-wrapper,
    .fact-stats-grid--cols-4 .fact-value-wrapper { font-size: 2.8rem !important; }
    .layout-fact .fact-value-box :is(h1, h2, h3, h4, p, span),
    .layout-fact-container .fact-value-box :is(h1, h2, h3, h4, p, span),
    .layout-fact .fact-value-wrapper :is(h1, h2, h3, h4, p, span),
    .layout-fact-container .fact-value-wrapper :is(h1, h2, h3, h4, p, span) {
      font-size: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
      color: inherit !important;
      margin: 0 !important;
    }
    .layout-fact .fact-divider-line,
    .layout-fact-container .fact-divider-line {
      width: 50px;
      height: 3px;
      background: var(--slide-accent, #3b82f6);
      margin: 10px auto 12px;
      opacity: 0.8;
    }
    .layout-fact .fact-label,
    .layout-fact-container .fact-label,
    .layout-fact .fact-label-wrapper,
    .layout-fact-container .fact-label-wrapper,
    .layout-fact .fact-label-box,
    .layout-fact-container .fact-label-box {
      font-size: 1.25rem !important;
      font-weight: 500 !important;
      opacity: 0.88;
      line-height: 1.4 !important;
      max-width: 440px;
      margin: 0 auto;
      text-align: center !important;
    }
    .fact-stats-grid--cols-1 .fact-label-wrapper,
    .layout-fact-cols-1 .fact-label-wrapper { font-size: 1.55rem !important; max-width: 680px; }
    .layout-fact .fact-label-box :is(h1, h2, h3, h4, p, span, li),
    .layout-fact-container .fact-label-box :is(h1, h2, h3, h4, p, span, li),
    .layout-fact .fact-label-wrapper :is(h1, h2, h3, h4, p, span, li),
    .layout-fact-container .fact-label-wrapper :is(h1, h2, h3, h4, p, span, li) {
      font-size: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
      color: inherit !important;
      opacity: inherit !important;
      margin: 0 !important;
      text-align: center !important;
    }

    ${getSharedLayoutStyles()}

      /* PDF 打印讲义下禁用动态蒙版遮挡，保证内容 100% 完整可见 */
      .slides-mask-layer,
      .slides-mask-overlay,
      .slides-mask-divider-line {
        display: none !important;
        opacity: 0 !important;
        mask: none !important;
        -webkit-mask: none !important;
      }
      .slides-mask-body-container {
        clip-path: none !important;
        -webkit-clip-path: none !important;
        overflow: visible !important;
      }
    }
  `
}
