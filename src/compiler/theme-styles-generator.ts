/**
 * 思源笔记主题色彩体系与字体样式生成器
 * 为 Slidev（沙箱预览、CLI 演示、单文件 HTML、PDF 导出）提供全套高保真思源色彩变量与块级排版规则
 */

export interface ISiYuanCustomInlineStyle {
  id: string
  name?: string
  light?: {
    color?: string
    backgroundColor?: string
  }
  dark?: {
    color?: string
    backgroundColor?: string
  }
}

export interface ISiYuanInlineStylesPayload {
  version?: number
  styles?: ISiYuanCustomInlineStyle[]
  builtin?: {
    colors?: Array<{
      index: number
      light?: { color?: string; backgroundColor?: string }
      dark?: { color?: string; backgroundColor?: string }
    }>
    styles?: Array<{
      id: string
      light?: { color?: string; backgroundColor?: string }
      dark?: { color?: string; backgroundColor?: string }
    }>
  }
}

/**
 * 思源笔记官方 13 种内置文字颜色与背景颜色 + 4 种卡片标牌在浅色 (daylight) 与深色 (midnight) 下的标准色值
 */
export const DEFAULT_SIYUAN_PALETTE_CSS = `/* SiYuan Note Built-in Font & Background Styles for Slidev */
:root,
html:not(.dark),
[data-theme="light"],
[data-theme-mode="light"],
.slide-viewport[data-theme="light"] {
  /* 思源基础卡片与主题色 (浅色模式 daylight) */
  --b3-card-error-color: #790600;
  --b3-card-error-background: #f5d1cf;
  --b3-card-warning-color: #8a4f00;
  --b3-card-warning-background: #ffe8c8;
  --b3-card-info-color: #005599;
  --b3-card-info-background: #d6eaf9;
  --b3-card-success-color: #006b04;
  --b3-card-success-background: #d7eed8;

  --b3-theme-primary: #3575f0;
  --b3-theme-secondary: #ff9200;
  --b3-theme-error: #d23f31;
  --b3-theme-background: #ffffff;
  --b3-theme-on-background: #222222;
  --b3-theme-on-surface: #5f6368;
  --b3-theme-surface-lighter: #e0e0e0;

  /* 13 种内置文字颜色 */
  --b3-font-color1: var(--b3-card-error-color);
  --b3-font-color2: var(--b3-card-warning-color);
  --b3-font-color3: var(--b3-card-info-color);
  --b3-font-color4: var(--b3-card-success-color);
  --b3-font-color5: var(--b3-theme-on-surface);
  --b3-font-color6: var(--b3-theme-primary);
  --b3-font-color7: var(--b3-theme-secondary);
  --b3-font-color8: var(--b3-theme-error);
  --b3-font-color9: #a40074;
  --b3-font-color10: #007080;
  --b3-font-color11: #006e2a;
  --b3-font-color12: #6b5a00;
  --b3-font-color13: var(--b3-theme-background);

  /* 13 种内置背景颜色 */
  --b3-font-background1: var(--b3-card-error-background);
  --b3-font-background2: var(--b3-card-warning-background);
  --b3-font-background3: var(--b3-card-info-background);
  --b3-font-background4: var(--b3-card-success-background);
  --b3-font-background5: #e2e3e4;
  --b3-font-background6: #acd0fc;
  --b3-font-background7: #fddaab;
  --b3-font-background8: #ffb0a9;
  --b3-font-background9: #fdbfff;
  --b3-font-background10: #b1ffff;
  --b3-font-background11: #affad1;
  --b3-font-background12: #fff88f;
  --b3-font-background13: var(--b3-theme-on-background);
}

html.dark,
[data-theme="dark"],
[data-theme-mode="dark"],
.theme-dark,
.dark,
.slide-viewport[data-theme="dark"] {
  /* 思源基础卡片与主题色 (深色模式 midnight) */
  --b3-card-error-color: rgb(243, 153, 147);
  --b3-card-error-background: #442724;
  --b3-card-warning-color: rgb(255, 213, 153);
  --b3-card-warning-background: #554636;
  --b3-card-info-color: rgb(166, 213, 250);
  --b3-card-info-background: #28405c;
  --b3-card-success-color: rgb(183, 223, 185);
  --b3-card-success-background: #425347;

  --b3-theme-primary: #3575f0;
  --b3-theme-secondary: #ff9200;
  --b3-theme-error: #d23f31;
  --b3-theme-background: #1e1e1e;
  --b3-theme-on-background: #c8ccd6;
  --b3-theme-on-surface: #8b949e;
  --b3-theme-surface-lighter: #282a2e;

  /* 13 种内置文字颜色 */
  --b3-font-color1: var(--b3-card-error-color);
  --b3-font-color2: var(--b3-card-warning-color);
  --b3-font-color3: var(--b3-card-info-color);
  --b3-font-color4: var(--b3-card-success-color);
  --b3-font-color5: var(--b3-theme-on-surface);
  --b3-font-color6: var(--b3-theme-primary);
  --b3-font-color7: var(--b3-theme-secondary);
  --b3-font-color8: var(--b3-theme-error);
  --b3-font-color9: #f47c9c;
  --b3-font-color10: #4dd0e1;
  --b3-font-color11: #10df54;
  --b3-font-color12: #ecd424;
  --b3-font-color13: var(--b3-theme-background);

  /* 13 种内置背景颜色 */
  --b3-font-background1: var(--b3-card-error-background);
  --b3-font-background2: var(--b3-card-warning-background);
  --b3-font-background3: var(--b3-card-info-background);
  --b3-font-background4: var(--b3-card-success-background);
  --b3-font-background5: #3a3f42;
  --b3-font-background6: #031840;
  --b3-font-background7: #593905;
  --b3-font-background8: #3a0c09;
  --b3-font-background9: #4d1b40;
  --b3-font-background10: #1a5459;
  --b3-font-background11: #305415;
  --b3-font-background12: #4a4712;
  --b3-font-background13: var(--b3-theme-on-background);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-theme-mode="light"]):not(.light) {
    --b3-card-error-color: rgb(243, 153, 147);
    --b3-card-error-background: #442724;
    --b3-card-warning-color: rgb(255, 213, 153);
    --b3-card-warning-background: #554636;
    --b3-card-info-color: rgb(166, 213, 250);
    --b3-card-info-background: #28405c;
    --b3-card-success-color: rgb(183, 223, 185);
    --b3-card-success-background: #425347;

    --b3-theme-primary: #3575f0;
    --b3-theme-secondary: #ff9200;
    --b3-theme-error: #d23f31;
    --b3-theme-background: #1e1e1e;
    --b3-theme-on-background: #c8ccd6;
    --b3-theme-on-surface: #8b949e;
    --b3-theme-surface-lighter: #282a2e;

    --b3-font-color1: var(--b3-card-error-color);
    --b3-font-color2: var(--b3-card-warning-color);
    --b3-font-color3: var(--b3-card-info-color);
    --b3-font-color4: var(--b3-card-success-color);
    --b3-font-color5: var(--b3-theme-on-surface);
    --b3-font-color6: var(--b3-theme-primary);
    --b3-font-color7: var(--b3-theme-secondary);
    --b3-font-color8: var(--b3-theme-error);
    --b3-font-color9: #f47c9c;
    --b3-font-color10: #4dd0e1;
    --b3-font-color11: #10df54;
    --b3-font-color12: #ecd424;
    --b3-font-color13: var(--b3-theme-background);

    --b3-font-background1: var(--b3-card-error-background);
    --b3-font-background2: var(--b3-card-warning-background);
    --b3-font-background3: var(--b3-card-info-background);
    --b3-font-background4: var(--b3-card-success-background);
    --b3-font-background5: #3a3f42;
    --b3-font-background6: #031840;
    --b3-font-background7: #593905;
    --b3-font-background8: #3a0c09;
    --b3-font-background9: #4d1b40;
    --b3-font-background10: #1a5459;
    --b3-font-background11: #305415;
    --b3-font-background12: #4a4712;
    --b3-font-background13: var(--b3-theme-on-background);
  }
}

/* 演示块级样式排版增强 (带背景色时赋予呼吸内边距与舒适圆角) */
.slide-styled-block {
  border-radius: 6px;
  padding: 8px 14px;
  box-sizing: border-box;
  margin: 6px 0;
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* 块级显式字体大小继承：防止内层 rem 固定字号规则覆盖思源块级字号 */
.slide-block--custom-font-size p,
.slide-block--custom-font-size h1,
.slide-block--custom-font-size h2,
.slide-block--custom-font-size h3,
.slide-block--custom-font-size h4,
.slide-block--custom-font-size h5,
.slide-block--custom-font-size h6,
.slide-block--custom-font-size li,
.slide-block--custom-font-size blockquote,
.slide-block--custom-font-size .slide-list-item-title,
.slide-block--custom-font-size .slide-list-item-desc {
  font-size: inherit !important;
}

/* 块级显式文字颜色继承：确保内层标题/段落继承块级前景色（同时保留行内 span 局部高亮） */
.slide-block--custom-color p,
.slide-block--custom-color h1,
.slide-block--custom-color h2,
.slide-block--custom-color h3,
.slide-block--custom-color h4,
.slide-block--custom-color h5,
.slide-block--custom-color h6,
.slide-block--custom-color li,
.slide-block--custom-color blockquote,
.slide-block--custom-color .slide-list-item-title,
.slide-block--custom-color .slide-list-item-desc {
  color: inherit !important;
}

/* 行内带背景色文本的精美圆角与微边距 */
span[style*="background-color"],
span[style*="background:"] {
  border-radius: 3px;
  padding: 1px 5px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
`

/**
 * 根据思源笔记工作空间的扩展样式定义 (/api/storage/getInlineStyles) 动态生成 CSS 变量声明
 */
export function generateCustomInlineStylesCss(data?: ISiYuanInlineStylesPayload | null): string {
  if (!data || typeof data !== "object") {
    return ""
  }

  const lightDeclarations: string[] = []
  const darkDeclarations: string[] = []

  // 1. 处理用户自定义样式列表 (styles)
  if (Array.isArray(data.styles)) {
    for (const style of data.styles) {
      if (!style || !style.id) continue
      const varPrefix = `--b3-inline-style-${style.id}`

      if (style.light?.color) {
        lightDeclarations.push(`  ${varPrefix}-color: ${style.light.color};`)
      }
      if (style.light?.backgroundColor) {
        lightDeclarations.push(`  ${varPrefix}-background-color: ${style.light.backgroundColor};`)
      }

      if (style.dark?.color) {
        darkDeclarations.push(`  ${varPrefix}-color: ${style.dark.color};`)
      }
      if (style.dark?.backgroundColor) {
        darkDeclarations.push(`  ${varPrefix}-background-color: ${style.dark.backgroundColor};`)
      }
    }
  }

  // 2. 处理对内置颜色的定制覆写 (builtin.colors)
  if (data.builtin && Array.isArray(data.builtin.colors)) {
    for (const color of data.builtin.colors) {
      if (!color || typeof color.index !== "number") continue
      const idx = color.index

      if (color.light?.color) {
        lightDeclarations.push(`  --b3-font-color${idx}: ${color.light.color};`)
      }
      if (color.light?.backgroundColor) {
        lightDeclarations.push(`  --b3-font-background${idx}: ${color.light.backgroundColor};`)
      }

      if (color.dark?.color) {
        darkDeclarations.push(`  --b3-font-color${idx}: ${color.dark.color};`)
      }
      if (color.dark?.backgroundColor) {
        darkDeclarations.push(`  --b3-font-background${idx}: ${color.dark.backgroundColor};`)
      }
    }
  }

  // 3. 处理对内置卡片标牌样式的定制覆写 (builtin.styles)
  if (data.builtin && Array.isArray(data.builtin.styles)) {
    for (const card of data.builtin.styles) {
      if (!card || !card.id) continue
      const id = card.id

      if (card.light?.color) {
        lightDeclarations.push(`  --b3-card-${id}-color: ${card.light.color};`)
      }
      if (card.light?.backgroundColor) {
        lightDeclarations.push(`  --b3-card-${id}-background: ${card.light.backgroundColor};`)
      }

      if (card.dark?.color) {
        darkDeclarations.push(`  --b3-card-${id}-color: ${card.dark.color};`)
      }
      if (card.dark?.backgroundColor) {
        darkDeclarations.push(`  --b3-card-${id}-background: ${card.dark.backgroundColor};`)
      }
    }
  }

  if (lightDeclarations.length === 0 && darkDeclarations.length === 0) {
    return ""
  }

  const parts: string[] = []
  if (lightDeclarations.length > 0) {
    parts.push(`:root, html:not(.dark), [data-theme="light"] {\n${lightDeclarations.join("\n")}\n}`)
  }
  if (darkDeclarations.length > 0) {
    parts.push(`html.dark, [data-theme="dark"], .dark {\n${darkDeclarations.join("\n")}\n}`)
  }

  return parts.join("\n\n")
}

/**
 * 生成全套思源主题样式 CSS 代码（内置标准色表 + 用户自定义扩展）
 */
export function generateCompleteSiYuanThemeCss(customStyles?: ISiYuanInlineStylesPayload | null): string {
  const customCss = generateCustomInlineStylesCss(customStyles)
  if (!customCss) {
    return DEFAULT_SIYUAN_PALETTE_CSS
  }
  return `${DEFAULT_SIYUAN_PALETTE_CSS}\n\n/* Custom Workspace Inline Styles */\n${customCss}`
}
