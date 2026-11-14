import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Inspector & Dock Tooltips UX Defensive System (侧栏检查器 Tooltip 防遮挡与防截断规范)', () => {
  const scssPath = path.resolve(__dirname, '../src/index.scss')
  const pageInspectorPath = path.resolve(__dirname, '../src/ui/components/PageInspectorSection.vue')
  const blockInspectorPath = path.resolve(__dirname, '../src/ui/components/BlockInspectorSection.vue')
  const docInspectorPath = path.resolve(__dirname, '../src/ui/components/DocInspectorSection.vue')
  const dockViewPath = path.resolve(__dirname, '../src/ui/dock/SlidesInspectorDockView.vue')

  const scssContent = fs.readFileSync(scssPath, 'utf8')
  const pageInspectorContent = fs.readFileSync(pageInspectorPath, 'utf8')
  const blockInspectorContent = fs.readFileSync(blockInspectorPath, 'utf8')
  const docInspectorContent = fs.readFileSync(docInspectorPath, 'utf8')
  const dockViewContent = fs.readFileSync(dockViewPath, 'utf8')

  it('1. 全局样式必须为侧栏 Tooltip 建立自动换行、断词与最大宽度防御，杜绝横向撑破被 overflow 裁切', () => {
    // 检查侧栏上下文中的 b3-tooltips 防御规则
    expect(scssContent).toContain('.spm-slides-inspector')
    expect(scssContent).toMatch(/white-space:\s*pre-wrap\s*!important;/)
    expect(scssContent).toMatch(/word-break:\s*break-word\s*!important;/)
    expect(scssContent).toMatch(/max-width:\s*min\(240px,\s*calc\(100%\s*\+\s*60px\)\)\s*!important;/)
    expect(scssContent).toMatch(/z-index:\s*10000000\s*!important;/)
  })

  it('2. 全局样式必须针对 2 列操作网格与分段控制注入左右边界自适应偏置，杜绝贴墙截断', () => {
    expect(scssContent).toContain('.spm-action-grid')
    expect(scssContent).toMatch(/\.spm-action-grid[\s\S]*?nth-child\(2n\+1\)[\s\S]*?left:\s*10%\s*!important;/)
    expect(scssContent).toMatch(/\.spm-action-grid[\s\S]*?nth-child\(2n\)[\s\S]*?right:\s*10%\s*!important;/)
    expect(scssContent).toContain('.spm-segmented-group')
    expect(scssContent).toMatch(/\.spm-segmented-group[\s\S]*?first-child[\s\S]*?left:\s*0\s*!important;/)
    expect(scssContent).toMatch(/\.spm-segmented-group[\s\S]*?last-child[\s\S]*?right:\s*0\s*!important;/)
  })

  it('3. 全局样式必须杜绝在输入框或输入容器外部误用 Tooltip 遮挡输入交互', () => {
    expect(scssContent).toMatch(/input\.spm-input[\s\S]*?display:\s*none\s*!important;/)
  })

  it('4. 页面检查器中动态蒙版比例输入框严禁外裹 b3-tooltips，输入规则帮助图标必须采用防越界方位', () => {
    // 动态蒙版比例输入框直接裸露，绝不被任何包含 b3-tooltips 的外部容器包裹
    expect(pageInspectorContent).not.toMatch(/<div[^>]*b3-tooltips[^>]*>\s*<input[^>]*effectiveMaskRatio/)
    // 输入规则问号必须采用向下偏左 (b3-tooltips__sw)，避免向左 (b3-tooltips__w) 冲出侧栏左边界
    expect(pageInspectorContent).toMatch(/class="b3-tooltips\s+b3-tooltips__sw"[\s\S]*?maskHelpTooltip/)
  })

  it('5. 块检查器中多列网格控件（视频设置、超级块操作、快捷操作）必须采用 se / sw 智能防越界方位', () => {
    // 视频设置网格（2列）：左列 se，右列 sw
    expect(blockInspectorContent).toMatch(/class="spm-switch\s+b3-tooltips\s+b3-tooltips__se"[\s\S]*?videoControls/)
    expect(blockInspectorContent).toMatch(/class="spm-switch\s+b3-tooltips\s+b3-tooltips__sw"[\s\S]*?videoAutoplay/)
    expect(blockInspectorContent).toMatch(/class="spm-switch\s+b3-tooltips\s+b3-tooltips__se"[\s\S]*?videoLoop/)
    expect(blockInspectorContent).toMatch(/class="spm-switch\s+b3-tooltips\s+b3-tooltips__sw"[\s\S]*?videoMuted/)

    // 快捷操作网格（2列）
    expect(blockInspectorContent).toContain('b3-tooltips b3-tooltips__se')
    expect(blockInspectorContent).toContain('b3-tooltips b3-tooltips__sw')
  })

  it('6. 文档检查器中密集分段按钮与动作网格必须采用防越界方位', () => {
    // 间距按钮（3项紧凑并排）：首项紧凑 se，末项宽松 sw
    expect(docInspectorContent).toMatch(/class="spm-segmented-item\s+b3-tooltips\s+b3-tooltips__se"[\s\S]*?compact/)
    expect(docInspectorContent).toMatch(/class="spm-segmented-item\s+b3-tooltips\s+b3-tooltips__sw"[\s\S]*?loose/)

    // 6 个动作按钮网格（2列）
    expect(docInspectorContent).toMatch(/class="spm-btn-action\s+b3-tooltips\s+b3-tooltips__se"[\s\S]*?openBottomPreview/)
    expect(docInspectorContent).toMatch(/class="spm-btn-action\s+b3-tooltips\s+b3-tooltips__sw"[\s\S]*?openPresenter/)
  })

  it('7. 侧栏 Dock 视图顶栏按钮靠右对齐时必须使用 b3-tooltips__sw 避免向右穿出边界', () => {
    expect(dockViewContent).toMatch(/class="spm-icon-btn\s+b3-tooltips\s+b3-tooltips__sw"[\s\S]*?showImportDialog/)
    expect(dockViewContent).toMatch(/class="spm-icon-btn\s+is-primary\s+b3-tooltips\s+b3-tooltips__sw"[\s\S]*?onOpenBottomPreview/)
  })

  it('8. 侧栏三大检查器卡片取消所有副标题显示，改为标题悬浮 tooltips 说明', () => {
    // 检查三大面板模板中不再包含任何常驻副标题 spm-control-desc
    expect(pageInspectorContent).not.toContain('class="spm-control-desc"')
    expect(blockInspectorContent).not.toContain('class="spm-control-desc"')
    expect(docInspectorContent).not.toContain('class="spm-control-desc"')

    // 检查卡片标题具备 b3-tooltips 及对应 aria-label
    expect(pageInspectorContent).toMatch(/class="spm-control-title\s+b3-tooltips\s+b3-tooltips__se"[\s\S]*?aria-label="设置各列横向空间占比，默认平均分配"/)
    expect(pageInspectorContent).toMatch(/class="spm-control-title\s+b3-tooltips\s+b3-tooltips__se"[\s\S]*?aria-label="随着点击操作分段展露正文内容"/)
    expect(blockInspectorContent).toMatch(/class="spm-control-title\s+b3-tooltips\s+b3-tooltips__se"[\s\S]*?aria-label="放映时按步长逐个呈现"/)
    expect(blockInspectorContent).toMatch(/class="spm-control-title\s+b3-tooltips\s+b3-tooltips__se"[\s\S]*?aria-label="为当前块添加平滑位移与渐入动画"/)
    expect(docInspectorContent).toMatch(/class="spm-control-title\s+b3-tooltips\s+b3-tooltips__se"[\s\S]*?aria-label="全局幻灯片视觉设计范式"/)
    expect(docInspectorContent).toMatch(/class="spm-control-title\s+b3-tooltips\s+b3-tooltips__se"[\s\S]*?aria-label="全篇幻灯片统一底色、微渐变或壁纸"/)
  })

  it('9. 卡片容器严禁外裹 b3-tooltips，杜绝与内部子控件产生双重重复 Tooltip 冲突', () => {
    // 卡片外部容器与头部不能直接具有 b3-tooltips，避免鼠标悬浮内部按钮时父级和子级同时触发
    expect(pageInspectorContent).not.toMatch(/class="spm-card-control[^"]*b3-tooltips/)
    expect(blockInspectorContent).not.toMatch(/class="spm-card-control[^"]*b3-tooltips/)
    expect(docInspectorContent).not.toMatch(/class="spm-card-control[^"]*b3-tooltips/)
    expect(pageInspectorContent).not.toMatch(/class="spm-control-header[^"]*b3-tooltips/)
    expect(blockInspectorContent).not.toMatch(/class="spm-control-header[^"]*b3-tooltips/)
    expect(docInspectorContent).not.toMatch(/class="spm-control-header[^"]*b3-tooltips/)
  })
})
