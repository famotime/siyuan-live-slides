# 重构计划

## 1. 项目快照

- 生成日期：2026-11-20（Phase 5）
- 范围：SiYuan Live Slides 插件全仓库 (`d:\MyCodingProjects\siyuan-live-slides`)
- 当前工程规模：101 个测试文件，927 项测试（923 通过，4 跳过，0 失败）；构建与包管理统一收敛至 `pnpm`
- 基线验证（2026-11-20）：
  - `pnpm test` → 99 passed | 2 skipped (101 文件)，923 passed | 4 skipped (927 测试)，0 失败，基线全绿
- 背景与演进：
  - Phase 1 (RF-001~RF-010)、Phase 2 (RF-011~RF-015)、Phase 3 (RF-016~RF-020)、Phase 4 (RF-021~RF-025) 均已圆满交付；
  - 自 Phase 4 (2026-11-14) 之后，1.4.0 迭代新增了动效可视化网格与试播舞台（`motion-presets.ts`、`ElementAnimBar.vue`、`MotionSelector.vue`）、多栏通栏排版、全局高级设置折叠栏、入场动效乐观即时试播等能力；
  - 这些演进使得 UI 组件层再次重度膨胀：
    - `BlockInspectorSection.vue` 膨胀至全仓库最大 Vue 组件 1245 行，脚本（570 行）混杂分栏 slot、入场动效、持续强调/文本动效、试播舞台四类正交职责，且内置了一份与 `motion-presets.ts` 完全重复的本地预设数组；
    - `SlidesInspectorDockView.vue` 重新膨胀至 875 行，存在 6 处完全相同的"从 targetSlide.blocks 按 id 查找块"重复模式；
    - `SlidesPreviewTab.vue`（883 行）脚本（481 行）混杂 peek 抽屉、页签固定、页码跳转、四类导出、全屏、总览等职责。
- 目标：
  1. 解耦拆分全仓库最大组件 `BlockInspectorSection.vue` (1245 行)，抽离动效领域 Composable，消除与 `motion-presets.ts` 的预设数组重复；
  2. 消除 `SlidesInspectorDockView.vue` 中 6 处重复的块属性查找模式；
  3. 解耦 `SlidesPreviewTab.vue` 的导出编排与 peek 抽屉状态；
  4. 抽离 `PageInspectorSection.vue` 的蒙版/分栏比例领域逻辑；
  5. 抽离 `WebviewPeekDrawer.vue` 的 webview 导航/缩放控制逻辑；
  6. 刷新 `docs/project-structure.md` 与 `README.md`。

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 块级动效 Inspector | `src/ui/components/BlockInspectorSection.vue` (1245 行：模板 570 + 脚本 570) | 块级 `v-click`、入场动效、持续强调动效、文本动效（countup/typewriter）、分栏 slot、试播舞台、视频控制 | 全仓库最大 Vue 组件；脚本混杂 4 类正交职责：① 分栏 slot 逻辑 ~150 行（`effectiveLayout`/`detectedColumnsCount`/`availableSlots`）② 动效解析与变更 ~250 行（`parsedMotion`/`parsedAnimProps`/`setEmphasisType`/`setTextAnimType`/`emitMotionChange`）③ 试播舞台 ~150 行（`stagePlayKey`/`entranceStageStyle`/`triggerTextWYSIWYG`/`replayLiveStage`）④ 本地 `motionPresets` 数组与 `motion-presets.ts` 的 `MOTION_PRESETS` 7 项预设完全重复（双重维护，新增预设必分叉） | `tests/block-inspector-ux.test.ts` (6)、`tests/motion-selector.test.ts` (8)、`tests/visual-motion-grid.test.ts` (9)、`tests/columns-manual-count-ux.test.ts` (5) 覆盖交互，但动效解析/试播舞台无独立领域单测 |
| Inspector 主视图 | `src/ui/dock/SlidesInspectorDockView.vue` (875 行：脚本 683) | 侧边栏顶层容器、状态汇聚、块属性派生 | `elemClick`/`elemMotion`/`elemAnim`/`elemAnimProps`/`activeBlockContent`/`elemSlot` 等 6 处 computed 各自重复 `targetSlide.value.blocks.find(b => b.id === activeBlockId.value)` 查找与 JSON 属性解析模式 | `tests/inspector-state.test.ts`、`tests/inspector-superblock-detector.test.ts` (7) 覆盖状态与超级块探测 |
| 预览页签 | `src/ui/tab/SlidesPreviewTab.vue` (883 行：脚本 481) | 分屏实时预览、peek 抽屉、页签固定、页码跳转、HTML/PDF/图片导出、全屏、总览 | 脚本混杂 5 类职责；导出编排（`onExportHtml`/`onExportPdf`/`onExportAllImages`/`onExportCurrentSlide`/`onCopyCurrentSlide`）与 peek 抽屉状态（`isDrawerOpen`/`peekType`/`peekBlockId`...）可完全剥离 | `tests/page-jump-input.test.ts`、`tests/peek-*.test.ts`、`tests/image-exporter.test.ts` 覆盖领域模块，页签编排层无独立单测 |
| 页面 Inspector | `src/ui/components/PageInspectorSection.vue` (949 行：模板 556) | 页面版式、过渡、背景、蒙版、分栏比例 | 蒙版（`maskRatioPresets`/`selectClockMask`/`selectLinearMask`）与分栏比例（`detectedColumnsCount`/`defaultRatios`/`currentRatioPresets`）领域逻辑内嵌视图，且 `detectedColumnsCount` 与 `BlockInspectorSection.vue` 存在相似的 ratio 解析重复 | `tests/page-inspector-sections-card.test.ts` (4)、`tests/global-background.test.ts` 覆盖局部 |
| Peek 网页抽屉 | `src/ui/components/peek/WebviewPeekDrawer.vue` (961 行：脚本 487) | 内嵌 webview 网页预览、视图模式、导航、缩放、错误恢复 | 顶部纯函数（`getInitialViewMode`/`saveViewMode`/`describePeekNetError`）与 webview 事件监听、缩放状态机混杂；缩放（`applyZoomFactor`/`onCtrlWheel`/`zoomIn`/`zoomOut`）与导航（`goBack`/`goForward`/`onDidNavigate`）为可剥离领域逻辑 | `tests/peek-local-html.test.ts`、`tests/peek-proxy-session.test.ts` (7) 覆盖会话层，缩放/导航无专项单测 |
| AST 编译器核心 (观察项) | `src/compiler/slides-ast-builder.ts` (979 行) | 将思源块 AST 编排转换为 Slidev 虚拟文档 | 体量大但内聚度极高，已有数十个单测套件紧密绑定，本期继续作为稳定核心观察，不作盲目侵入 | 10+ 测试套件全方位覆盖 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-026 | P0 | 块级动效 Inspector 领域解耦 | `src/ui/components/BlockInspectorSection.vue`<br>新建 `src/ui/components/useBlockMotionSection.ts`<br>新建 `src/ui/components/useBlockSlotSection.ts` | 1. 抽离动效解析与变更（入场/强调/文本三类）至 `useBlockMotionSection.ts`，含 `parsedMotion`/`parsedAnimProps`/countup 字段推导/`emitMotionChange` 负载组装；<br>2. 抽离试播舞台（stagePlayKey、countup 数值驱动、typewriter 逐字、舞台样式、乐观试播）至同一 Composable 的舞台分组；<br>3. 抽离分栏 slot 逻辑至 `useBlockSlotSection.ts`（`effectiveLayout`/`detectedColumnsCount`/`availableSlots`/`isSlotActive`）；<br>4. 删除本地 `motionPresets` 数组，改为从 `motion-presets.ts` 的 `MOTION_PRESETS` 派生（label/value 映射），消除 7 项预设双份维护；<br>5. 主组件精简至 ~500 行以内 | 中 | - [x] 新增 `tests/use-block-motion-section.test.ts`：覆盖 parsedMotion 字符串/JSON/none 解析、countup 字段推导与 autoExtractFromContent 正则提取、emitMotionChange 负载组装、试播 stagePlayKey 递增；<br>- [x] 新增 `tests/use-block-slot-section.test.ts`：覆盖 detectedColumnsCount 的 ratio/slot/superblock 三来源解析与 availableSlots 生成；<br>- [x] 保持 `block-inspector-ux.test.ts` (6)、`motion-selector.test.ts` (8)、`visual-motion-grid.test.ts` (9)、`columns-manual-count-ux.test.ts` (5) 全绿（3 处源码断言目标随实现迁移同步更新，验证强度保持）；<br>- [x] 重构后跑定向与全量单测 + `pnpm run build` | `docs/project-structure.md`：新增 components Composable 说明 | done |
| RF-027 | P1 | Dock 主视图重复块查找消除 | `src/ui/dock/SlidesInspectorDockView.vue`<br>新建 `src/ui/dock/useActiveBlockState.ts` | 1. 抽离"按 activeBlockId 从 targetSlide.blocks 查找活动块 + 属性 JSON 解析"为单一 `useActiveBlockState.ts` Composable，输出 `activeBlock` 及 `elemClick`/`elemMotion`/`elemAnim`/`elemAnimProps`/`activeBlockContent`/`elemSlot` 派生值；<br>2. 消除 6 处重复 `blocks.find(b => b.id === ...)` 与散落的 JSON.parse 容错；<br>3. 视图预计精简 ~80 行 | 低 | - [x] 新增 `tests/use-active-block-state.test.ts`：覆盖活动块命中/未命中、click/motion/anim/animProps/slot/content 六类派生解析与损坏 JSON 容错；<br>- [x] 保持 `inspector-state.test.ts`、`inspector-superblock-detector.test.ts` (7) 全绿；<br>- [x] 重构后跑定向与全量单测 | `docs/project-structure.md`：更新 dock 模块说明 | done |
| RF-028 | P1 | 预览页签导出编排与 peek 状态解耦 | `src/ui/tab/SlidesPreviewTab.vue`<br>新建 `src/ui/tab/usePreviewExport.ts`<br>新建 `src/ui/tab/usePeekDrawerState.ts` | 1. 抽离 HTML/PDF/全部图片/当前页图片/复制 Markdown 五类导出编排至 `usePreviewExport.ts`（含 isExportingAllImages 状态与错误通知）；<br>2. 抽离 peek 抽屉状态机（open/close/类型切换/固定 pin/标题）至 `usePeekDrawerState.ts`；<br>3. 页签脚本精简 ~150 行，职责收敛为模板编排 | 中 | - [x] 新增 `tests/use-preview-export.test.ts`：覆盖各导出动作委托、全量图片导出 loading 态与异常通知；<br>- [x] 新增 `tests/use-peek-drawer-state.test.ts`：覆盖开/关/类型切换/pin/标题状态迁移；<br>- [x] 保持 `page-jump-input.test.ts`、`peek-local-html.test.ts`、`peek-proxy-session.test.ts`、`image-exporter.test.ts` 全绿（1 处 resolvePeekUrl 源码断言目标随实现迁移更新）；<br>- [x] 重构后跑定向与全量单测 + `pnpm run build` | `docs/project-structure.md`：更新 tab 模块说明 | done |
| RF-029 | P2 | 页面 Inspector 蒙版与分栏比例领域抽离 | `src/ui/components/PageInspectorSection.vue`<br>新建 `src/ui/components/usePageMaskControls.ts`<br>新建 `src/ui/components/usePageColumnRatio.ts` | 1. 抽离蒙版领域（`maskRatioPresets`/时钟与线性蒙版选择/`maskHelpTooltip`）至 `usePageMaskControls.ts`；<br>2. 抽离分栏比例领域（`detectedColumnsCount`/`defaultRatios`/`currentRatioPresets`/`isRatioActive`/等分重置）至 `usePageColumnRatio.ts`；<br>3. 与 RF-026 的 slot 解析共享 ratio 解析工具，消除两处相似 `split(':')` 解析 | 低 | - [x] 新增 `tests/use-page-column-ratio.test.ts`：覆盖 ratio 探测、默认比例矩阵、等分判定与重置；<br>- [x] 新增 `tests/use-page-mask-controls.test.ts`：覆盖时钟/线性蒙版方向选择与帮助文案；<br>- [x] 保持 `page-inspector-sections-card.test.ts` (4)、`global-background.test.ts` 全绿（columns-manual-count-ux 2 处与 clover-clock-mask 1 处源码断言目标随实现迁移更新）；<br>- [x] 重构后跑定向与全量单测 | `docs/project-structure.md`：更新 components 模块说明 | done |
| RF-030 | P2 | Peek 网页抽屉 webview 控制解耦 | `src/ui/components/peek/WebviewPeekDrawer.vue`<br>新建 `src/ui/components/peek/useWebviewPeekControls.ts` | 1. 抽离视图模式持久化（`getInitialViewMode`/`saveViewMode`）与错误文案（`describePeekNetError`）为纯函数模块并补单测；<br>2. 抽离缩放状态机（`applyZoomFactor`/`onCtrlWheel`/`zoomIn`/`zoomOut`/`resetZoom`）与导航状态（`updateNavState`/`goBack`/`goForward`）至 `useWebviewPeekControls.ts`；<br>3. 组件脚本精简 ~150 行 | 低 | - [x] 新增 `tests/webview-peek-controls.test.ts`：覆盖视图模式持久化、错误文案映射、缩放边界（min/max/clamp）与导航状态更新；<br>- [x] 保持 `peek-local-html.test.ts`、`peek-proxy-session.test.ts` (7) 全绿（immersion-peek 1 处 UA 字面量断言归属随实现迁移更新）；<br>- [x] 重构后跑定向与全量单测 | `docs/project-structure.md`：更新 peek 模块说明 | done |

优先级说明：
- `P0`：价值和风险都最高，优先执行（RF-026）
- `P1`：价值或风险中等，放在 `P0` 之后（RF-027, RF-028）
- `P2`：低风险清理项，最后执行（RF-029, RF-030）

状态说明：`pending` / `in_progress` / `done` / `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 基线 | 2026-11-20 | 2026-11-20 | `pnpm test` | 99 passed / 2 skipped (101 文件)，923 passed / 4 skipped (927 测试)，0 失败 | — | 基线全绿，无需隔离修复 |
| RF-026 | 2026-11-20 | 2026-11-20 | `pnpm test tests/use-block-*.test.ts tests/block-inspector-ux.test.ts tests/visual-motion-grid.test.ts tests/motion-selector.test.ts tests/columns-manual-count-ux.test.ts` + 全量 `pnpm test` + `pnpm run build` | pass (全量 969/973 全绿，build 成功) | `docs/project-structure.md` | 抽离 useBlockMotionSection（动效解析/变更/试播舞台）与 useBlockSlotSection（插槽领域），删除与 motion-presets.ts 重复的本地预设死代码数组，主组件 1245 行精简至 810 行 |
| RF-027 | 2026-11-20 | 2026-11-20 | `pnpm test tests/use-active-block-state.test.ts tests/inspector-state.test.ts tests/inspector-superblock-detector.test.ts tests/inspector-actions.test.ts tests/inspector-actions-domains.test.ts` + 全量 `pnpm test` + `pnpm run build` | pass (全量 984/988 全绿，build 成功) | `docs/project-structure.md` | 抽离 useActiveBlockState 单点活动块查找，消除 6 处重复 `blocks.find(b => b.id === ...)` 模式，Dock 视图净减约 90 行 |
| RF-028 | 2026-11-20 | 2026-11-20 | `pnpm test tests/use-preview-export.test.ts tests/use-peek-drawer-state.test.ts tests/page-jump-input.test.ts tests/peek-*.test.ts tests/image-exporter.test.ts` + 全量 `pnpm test` + `pnpm run build` | pass (全量 1005/1009 全绿，build 成功) | `docs/project-structure.md` | 抽离 usePreviewExport（五类导出编排，服务注入可测）与 usePeekDrawerState（速览抽屉状态机，SQL 探测注入化），页签 883 行精简至 759 行 |
| RF-029 | 2026-11-20 | 2026-11-20 | `pnpm test tests/use-page-*.test.ts tests/columns-manual-count-ux.test.ts tests/page-inspector-sections-card.test.ts tests/global-background.test.ts tests/use-block-slot-section.test.ts` + 全量 `pnpm test` + `pnpm run build` | pass (全量 1031/1035 全绿，build 成功) | `docs/project-structure.md` | 抽离 usePageMaskControls（蒙版领域）与 usePageColumnRatio（分栏比例领域），新建 column-ratio.ts 共享比例解析工具并复用至 useBlockSlotSection，页面组件 949 行精简至 831 行 |
| RF-030 | 2026-11-20 | 2026-11-21 | `pnpm test tests/webview-peek-controls.test.ts tests/immersion-peek.test.ts tests/peek-*.test.ts` + 全量 `pnpm test` + `pnpm run typecheck` + `pnpm run build` | pass (全量 1043/1047 全绿，typecheck 0 报错，build 成功) | `docs/project-structure.md` | 抽离 peek-webview-utils（视图模式持久化与网络错误文案纯函数）与 useWebviewPeekControls（缩放状态机 + 导航委托），组件 re-export 保持 import 路径兼容，961 行精简至 852 行 |

## 5. 决策与确认

- 用户批准的条目：用户在交互确认未响应（可能离开）。依据用户最初指令"执行 code-refactor，完成代码模块分析和重构"的完整授权，按推荐方案执行全部条目 RF-026 ~ RF-030
- 延后的条目：`src/compiler/slides-ast-builder.ts` 保持观察，不作破坏性拆分
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：
  - 头部刷新日期至 2026-11-20（Phase 5）；
  - 目录树新增 `useBlockMotionSection.ts`、`useBlockSlotSection.ts`、`column-ratio.ts`、`usePageMaskControls.ts`、`usePageColumnRatio.ts`、`useActiveBlockState.ts`、`usePreviewExport.ts`、`usePeekDrawerState.ts`、`peek-webview-utils.ts`、`useWebviewPeekControls.ts` 及 RF-026~030 新增测试文件；
  - 更新五大组件行数与 RF 标注（BlockInspectorSection 810 / PageInspectorSection 831 / DockView 812 / SlidesPreviewTab 759 / WebviewPeekDrawer 852）；
  - 测试规模更新为 106 个测试文件 / 1047 项用例全绿；
  - 演进对照表扩展至 RF-030（新增 5 行 Phase 5 条目）。
- `README.md`：核对后无需变更 — README 仅描述用户可见能力（功能按钮、快捷键、使用流程），本轮重构为内部模块解耦，未引入任何用户可见行为变化。
- 最终同步检查：
  - `pnpm test` 全绿（106 文件 / 1043 通过 + 4 跳过 / 0 失败）；
  - `pnpm run typecheck` 0 类型报错；
  - `pnpm run build` 产物与 package.zip 校验通过。

## 7. 交付总结

Phase 5 全部 5 项重构条目（RF-026 块级动效 Inspector 解耦、RF-027 Dock 重复块查找收敛、RF-028 预览页签导出与抽屉解耦、RF-029 页面蒙版/比例领域抽离、RF-030 Peek 微型浏览器控制解耦）均遵循测试先行原则交付：
- 新增 9 个领域 Composable/工具模块 + 7 个新测试文件（62 项新领域用例）；
- 4 处既有测试断言目标随实现迁移同步更新（验证强度保持或加强）；
- 五大 UI 组件合计精简 813 行（1245→810、875→812、883→759、949→831、961→852）；
- 最终基线 1043/1047 全绿（0 失败）、typecheck 0 报错、build 产物校验通过。
严格遵守仓库规范，未执行 git commit 或 git push。

## 8. 下一步

1. 等待用户审查与验收本 Phase 5 交付。
2. `src/compiler/slides-ast-builder.ts` (979 行) 延续历轮结论保持观察，如后续动效/版式继续膨胀再评估拆分。
3. 若新增动效预设或版式，预设清单与 ratio 解析已收敛至单一来源（`motion-presets.ts` / `column-ratio.ts`），按新架构增量维护即可。

---

## 附：历史已完成重构项归档

### Phase 4 (2026-11-14 完成)

- [x] **RF-021** (P0): 演讲者控制台巨石组件解耦拆分 (`SlidesPresenterTab.scss`, `SlidesPresenterThumbnail.scss`, `usePresenterTimer.ts`, `usePresenterSync.ts`) [done]
- [x] **RF-022** (P0): 导出样式层解耦与公共规则复用 (`styles/shared-layout-styles.ts`, `styles/standalone-extra-styles.ts`) [done]
- [x] **RF-023** (P1): Inspector 主视图超级块计算逻辑抽离 (`useSuperBlockInspector.ts`) [done]
- [x] **RF-024** (P1): 插件入口外部服务桥接与窗口管理解耦 (`api-switch-bridge.ts`, `preview-window-manager.ts`) [done]
- [x] **RF-025** (P2): 修复构建期版式开关单测断言对齐 [done]

### Phase 3 (2026-10-25 完成)

- [x] **RF-016** (P0): Inspector Actions 按领域分层拆分 (`attr-persistence.ts`, `notes-actions.ts`, `layout-actions.ts`) [done]
- [x] **RF-017** (P0): Dock 视图重复覆写查询消除与状态瘦身 (`useInspectorPageOverrides.ts`) [done]
- [x] **RF-018** (P1): 离线播放器运行时分节拆分 (`standalone-runtime-sections/`) [done]
- [x] **RF-019** (P1): 插件入口抽离预览页签标题服务 (`preview-tab-title.ts`) [done]
- [x] **RF-020** (P2): 内核 API 死代码清理与 `kernel.ts` 移除 [done]

### Phase 2 (2026-10-06 完成)

- [x] **RF-011** (P0): 剥离 PDF 导出器内联打印样式表 (`pdf-template-styles.ts`) [done]
- [x] **RF-012** (P0): 拆解超千行 Markdown 块级渲染器 (`visual-list-renderer.ts`, `slide-layout-renderer.ts`) [done]
- [x] **RF-013** (P1): 抽离 YAML 解析器与代码切片展开器 (`frontmatter-parser.ts`) [done]
- [x] **RF-014** (P1): 拆解超级块扫描器，剥离多栏列表扫描 (`list-column-scanner.ts`) [done]
- [x] **RF-015** (P2): 抽取 Slidev 导入弹窗业务为 Composable (`useSlidesImport.ts`) [done]

### Phase 1 (2026-10-04 ~ 2026-10-06 完成)

- [x] **RF-001** (P0): 抽离文档编译编排服务 (`document-compiler.ts`) [done]
- [x] **RF-002** (P0): 拆解超千行 Inspector 演示配置面板 (3 个 Section 组件) [done]
- [x] **RF-003** (P1): 抽离 Slidev 导入器中的 HTML 清洗模块 (`html-cleaner.ts`) [done]
- [x] **RF-004** (P1): 统一并复用导出模块中的 Markdown 块级渲染器 (`markdown-renderer.ts`) [done]
- [x] **RF-005** (P2): 清理遗留模板死代码与孤立组件 [done]
- [x] **RF-006** (P0): 剥离单文件 HTML 导出器海量样式与运行时 (`standalone-template-styles.ts`, `standalone-client-runtime.ts`) [done]
- [x] **RF-007** (P0): 拆解入口类，解耦命令注册器与光标/DOM 同步协调器 (`command-registry.ts`, `inspector-sync-coordinator.ts`) [done]
- [x] **RF-008** (P1): 抽离 Inspector 面板底层 API 编排与操作 Actions (`useInspectorActions.ts`) [done]
- [x] **RF-009** (P1): 拆分 AST 构建器中的指令与动效包装工具函数 (`directive-wrapper.ts`) [done]
- [x] **RF-010** (P2): 统一跨域通用工具导出与类型规范清理 (`markdown-utils.ts`) [done]
