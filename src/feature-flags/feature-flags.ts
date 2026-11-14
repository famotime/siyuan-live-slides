/**
 * 功能开关（Feature Flags）构建期配置
 *
 * 编辑下方 FEATURE_FLAGS 常量来控制发布版本中启用哪些功能。
 * 修改后需重新构建（npm run build）才能生效。
 * 开关为纯构建期常量：关闭某功能时，其 UI 入口不渲染、命令面板命令不注册，
 * 但功能代码仍打包进 bundle（仅裁剪入口，不做死代码消除）。
 *
 * 示例 — 发布一个不带 AI 讲稿、导入与演讲者视图功能的版本：
 *
 *   const FEATURE_FLAGS: FeatureFlagConfig = {
 *     presenterMode: false,
 *     exportHtml: true,
 *     exportPdf: true,
 *     exportImage: true,
 *     import: false,
 *     aiScript: false,
 *   }
 *
 * 各开关控制的入口范围：
 *   'presenterMode' — 演讲者视图（双屏演讲者控制台）：DocInspectorSection
 *                     「演讲者视图」按钮 + 预览页签演讲者图标（含沙箱放映内的
 *                     呼起请求）+ 命令 slidesPresenterMode。注意：讲稿体系
 *                     （讲稿块管理、备注开关）不受此开关影响
 *   'exportHtml'  — 导出离线单文件 HTML：Dock「导出 HTML」按钮 + 预览页签工具栏图标
 *   'exportPdf'   — 导出 PDF 讲义：Dock「导出 PDF」按钮 + 预览页签工具栏图标
 *   'exportImage' — 逐页导出图片：Dock「导出图片」按钮 + 预览页签图片导出下拉
 *                   （全篇 ZIP / 当前页 PNG / 复制剪贴板）+ 命令 slidesExportImagesZip
 *   'import'      — 导入 Slidev 演示文档：Dock 顶栏「导入」按钮 + 导入对话框
 *                   + 命令 slidesImport
 *   'aiScript'    — AI 讲稿生成类入口：PageInspectorSection「AI 讲稿」按钮
 *                   + 命令 slidesAiNotes。注意：手动讲稿体系（讲稿块定位/追加/批量管理、
 *                   「设为讲稿备注」开关）不受此开关影响
 *   'smartSplit'  — 智能分页与清除分页：DocInspectorSection「智能分页」与「清除分页」按钮
 *                   + 命令 slidesAiSplit / slidesClearDividers
 *   'smartAnimation' — 智能动效与清除动效：DocInspectorSection「智能动效」与「清除动效」按钮
 *                   + 命令 slidesAutoAnimate
 *   'speakerNotesBlocks' — 讲稿块识别增加与清除：DocInspectorSection「增加讲稿块」与「清除讲稿块」按钮
 *                   + 命令 slidesIdentifyNotes
 *   'layouts'     — 页面版式细粒度开关：控制 LayoutPicker 中具体版式（双栏、四叶草、图文、封面等）
 *                   是否显示。default（标准版式）始终兜底保留。
 *
 * 永远保留、不受任何开关影响：沙箱预览全链路（顶栏「即现」、预览页签、
 * Dock 分屏预览按钮、独立窗口放映、slidesPresentation 命令）、headless 图片
 * 导出实现层、核心与协同命令。演讲者视图为独立开关（presenterMode）。
 */

// ── 类型定义 ──

/** 可独立开关的功能 key */
export type FeatureKey =
  | 'presenterMode'
  | 'exportHtml'
  | 'exportPdf'
  | 'exportImage'
  | 'import'
  | 'aiScript'
  | 'smartSplit'
  | 'smartAnimation'
  | 'speakerNotesBlocks';

/** 可独立开关的页面版式 key（default 始终保留不可关闭） */
export type LayoutKey =
  | 'two-cols'
  | 'cols-header'
  | 'clover'
  | 'timeline'
  | 'image-right'
  | 'image-left'
  | 'cover'
  | 'fact'
  | 'quote'
  | 'intro'
  | 'center';

export type LayoutFlagConfig = Record<LayoutKey, boolean>;

export interface FeatureFlagConfig {
  presenterMode: boolean;
  exportHtml: boolean;
  exportPdf: boolean;
  exportImage: boolean;
  import: boolean;
  aiScript: boolean;
  smartSplit: boolean;
  smartAnimation: boolean;
  speakerNotesBlocks: boolean;
  layouts: LayoutFlagConfig;
}

// ── 编辑此对象来控制功能可见性 ──

const FEATURE_FLAGS: FeatureFlagConfig = {
  presenterMode: true,
  exportHtml: false,
  exportPdf: false,
  exportImage: false,
  import: false,
  aiScript: true,
  smartSplit: true,
  smartAnimation: true,
  speakerNotesBlocks: true,
  layouts: {
    'two-cols': true,
    'cols-header': true,
    'clover': false,
    'timeline': false,
    'image-right': true,
    'image-left': true,
    'cover': true,
    'fact': false,
    'quote': true,
    'intro': false,
    'center': true,
  },
};

// ── 工具函数 ──

/** 功能是否已被构建期配置关闭（入口不渲染、命令不注册） */
export function isFeatureDisabled(key: FeatureKey): boolean {
  return FEATURE_FLAGS[key] === false;
}

/** 功能是否启用（UI 入口渲染、命令注册） */
export function isFeatureEnabled(key: FeatureKey): boolean {
  return !isFeatureDisabled(key);
}

/** 页面版式是否启用（default 始终开启，其余由 layouts 开关控制） */
export function isLayoutEnabled(layoutName: string): boolean {
  if (layoutName === 'default') {
    return true;
  }
  const flag = FEATURE_FLAGS.layouts?.[layoutName as LayoutKey];
  return flag !== false;
}
