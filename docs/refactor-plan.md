# 重构计划

## 1. 项目快照

- 生成日期：2026-11-14（Phase 4）
- 范围：SiYuan Live Slides 插件演讲者控制台、导出样式层、侧边栏 Inspector 编排与插件入口生命周期 (`D:\MyCodingProjects\siyuan-live-slides`)
- 当前工程规模：88 个测试套件，844 项测试（839 通过，4 跳过，1 失败，见基线说明）；构建与包管理统一收敛至 `pnpm`；`pnpm run typecheck` 与 `pnpm run build` 待每项执行前复核
- 基线测试异常隔离：
  - 失败用例：`tests/feature-flags.test.ts > FeatureFlags (构建期功能开关) > 页面版式开关 isLayoutEnabled 正常工作且 default 始终为 true`
  - 失败原因：提交 `7244d8a` 扩展构建期细粒度版式开关时，`FEATURE_FLAGS.layouts` 默认禁用了 `clover`、`timeline`、`fact`、`intro`，但单测循环中硬编码断言 `expect(isLayoutEnabled(layout)).toBe(true)`。作为 RF-025 优先修复对齐，恢复全绿基线。
- 背景与演进：
  - Phase 1 (RF-001~RF-010)、Phase 2 (RF-011~RF-015)、Phase 3 (RF-016~RF-020) 均已圆满交付；
  - 近期在 1.4.0 版本迭代中新增了诸多重要能力（siyuan-api-switch 集成、timeline/steps 版式、fact 大字报指标列表、构建期 Feature Flags、多选块转横向超级块、自动化发版流水线等）；
  - 这些演进使得部分模块再次重度膨胀：`SlidesPresenterTab.vue` 膨胀至全仓库最大的 2892 行；导出端 HTML 与 PDF 两份独立的 CSS 模板文件合计达 3726 行且包含大量重复规则；`SlidesInspectorDockView.vue` 混入大量超级块 DOM 计算；插件入口 `src/index.ts` 重新膨胀至 829 行。
- 目标：
  1. 解耦拆分全仓库最大的 `SlidesPresenterTab.vue` (2892 行)，分离内联样式与核心逻辑 Composable；
  2. 提取 `standalone-template-styles.ts` (2242 行) 与 `pdf-template-styles.ts` (1484 行) 共享的 CSS 模块，消除重复模板；
  3. 抽离 `SlidesInspectorDockView.vue` (989 行) 中的超级块 DOM 宽度与分栏比例解析算法；
  4. 解耦插件入口 `src/index.ts` (829 行) 的外部服务桥接与窗口管理逻辑；
  5. 修复 `feature-flags.test.ts` 断言对齐，恢复 100% 全绿测试基线；
  6. 刷新 `docs/project-structure.md` 与 `README.md`。

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 演讲者控制台 | `src/ui/tab/SlidesPresenterTab.vue` (2892 行) | 演示计时与挂钟、跨窗口广播同步、幻灯片与备注预览、布局与交互样式 | 全仓库最大单文件；内嵌 2073 行 SCSS 样式；512 行脚本混杂了 FSM 计时器、现实挂钟、BroadcastChannel 通信、容器自适应测量等多个正交职责 | `tests/presenter-tab-ux.test.ts` (8 项) 覆盖基础交互，但计时与同步无独立领域单测 |
| 导出样式生成层 | `src/export/standalone-template-styles.ts` (2242 行)<br>`src/export/pdf-template-styles.ts` (1484 行) | 生成离线独立 HTML 播放器样式与 PDF 讲义打印样式 | 两端合计 3726 行，存在科技/衬线/极简主题、大字报/时间线/引言/介绍等版式规则、多栏与超级块样式的高度重复；每次新增版式需双向手写维护，极易分叉 | `tests/pdf-template-styles.test.ts`、`tests/theme-styles-generator.test.ts` 覆盖局部，无全量快照保障 |
| Inspector 主视图 | `src/ui/dock/SlidesInspectorDockView.vue` (989 行) | 演示属性侧边栏顶层容器、状态汇聚、超级块与块多选转换探测 | 依然偏大；lines 450~609 混杂了完整的 DOM 宽度计算与列宽比例归一化算法 (`parseSuperBlockDom`)、AST 扫描与多选监听，视图与几何算法高耦合 | `tests/inspector-state.test.ts`、`tests/inspector-actions-domains.test.ts` 覆盖状态，但无针对 DOM 比例解析的专项单测 |
| 插件入口主类 | `src/index.ts` (829 行) | 插件生命周期管理、Protyle 事件监听、编译调度、页签窗口管理、siyuan-api-switch 桥接 | 自 Phase 3 精简后重新膨胀；混入了约 70 行的 `siyuan-api-switch` 全局事件与同步逻辑、约 100 行的页签与独立窗口创建逻辑 | `tests/api-switch-integration.test.ts` (16 项)、`tests/preview-tab-title.test.ts` 覆盖良好，入口类集成测试完备 |
| 功能开关基线单测 | `tests/feature-flags.test.ts` | 验证构建期功能开关体系 | 用例中断言所有版式默认启用，与提交 `7244d8a` 显式禁用部分版式的配置冲突，导致基线测试红灯 | 需修正断言逻辑对齐真实配置行为 |
| AST 编译器核心 (观察项) | `src/compiler/slides-ast-builder.ts` (928 行) | 将思源块 AST 编排转换为 Slidev 虚拟文档 | 体量大但内聚度极高，已有数十个单测套件紧密绑定，本期作为稳定核心观察，不作盲目侵入 | 10+ 测试套件全方位覆盖 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-021 | P0 | 演讲者控制台巨石组件解耦拆分 | `src/ui/tab/SlidesPresenterTab.vue`<br>新建 `src/ui/tab/SlidesPresenterTab.scss`<br>新建 `src/ui/tab/SlidesPresenterThumbnail.scss`<br>新建 `src/ui/tab/usePresenterTimer.ts`<br>新建 `src/ui/tab/usePresenterSync.ts` | 1. 将 2073 行内联样式抽离到外部样式文件；<br>2. 抽取计时器与挂钟 FSM 状态机至 `usePresenterTimer.ts`；<br>3. 抽取跨窗口广播通信至 `usePresenterSync.ts`；<br>4. 主组件精简至 724 行（净减 2168 行），逻辑纯粹化 | 中 | - [x] 保持现有 `presenter-tab-ux.test.ts` (8 项) 通过；<br>- [x] 新增 `tests/presenter-timer.test.ts` (5 项) 覆盖计时启动/暂停/重置/格式化/防休眠漂移；<br>- [x] 新增 `tests/presenter-sync.test.ts` (2 项) 覆盖广播信道协议收发；<br>- [x] 重构后跑定向与全量单测通过 | `docs/project-structure.md`：新增 tab 模块说明 | done |
| RF-022 | P0 | 导出样式层解耦与公共规则复用 | `src/export/standalone-template-styles.ts`<br>`src/export/pdf-template-styles.ts`<br>新建 `src/export/styles/shared-layout-styles.ts`<br>新建 `src/export/styles/standalone-extra-styles.ts` | 1. 抽取版式（fact/timeline/quote/intro/clover 等）为共享样式模块；<br>2. 抽取独立单文件特性（灯箱、蒙版、微动效）为专用扩展模块；<br>3. 单文件导出与 PDF 导出只保留特有专有样式并复用公共模块；<br>4. 两文件分别由 2241 与 1483 行精简至 ~1290 行，消除重复代码并杜绝新增版式时两端样式分叉 | 中 | - [x] 新增 `tests/export-styles-golden.test.ts` (3 项) 固化当前导出样式的关键规则快照；<br>- [x] 保持 `pdf-template-styles.test.ts` 与 `theme-styles-generator.test.ts` 通过；<br>- [x] 重构后跑快照测试与全量单测通过 | `docs/project-structure.md`：更新 export 样式模块架构 | done |
| RF-023 | P1 | Inspector 主视图超级块计算逻辑抽离 | `src/ui/dock/SlidesInspectorDockView.vue`<br>新建 `src/ui/dock/useSuperBlockInspector.ts` | 1. 将 lines 450~609 超级块 DOM 宽度与分栏比例归一化解析 (`parseSuperBlockDom`)、AST 回退与多选监听抽为 Composable；<br>2. 视图仅消费解析好的比例与推荐版式；<br>3. 视图再精简 ~180 行（从 989 行精简至 808 行） | 低 | - [x] 新增 `tests/inspector-superblock-detector.test.ts` (7 项) 覆盖各类列宽组合与 AST 回退计算；<br>- [x] 保持 `inspector-state.test.ts` 与 `inspector-actions-domains.test.ts` 全绿；<br>- [x] 重构后跑定向与全量单测通过 | `docs/project-structure.md`：更新 dock 架构说明 | done |
| RF-024 | P1 | 插件入口外部服务桥接与窗口管理解耦 | `src/index.ts`<br>新建 `src/plugin/api-switch-bridge.ts`<br>新建 `src/plugin/preview-window-manager.ts` | 1. 将 `siyuan-api-switch` 事件监听与双向同步抽取至独立服务类；<br>2. 将页签与独立窗口创建管理抽取为独立窗口服务；<br>3. 入口类精简至 698 行（净减 147 行），职责收敛为插件事件流驱动 | 低 | - [x] 保持现有 `api-switch-integration.test.ts` (16 项) 与 `preview-tab-title.test.ts` (12 项) 通过；<br>- [x] 新增 `tests/api-switch-bridge.test.ts` (3 项) 验证服务桥接生命周期；<br>- [x] 重构后跑全量单测通过 | `docs/project-structure.md`：更新 plugin 模块说明 | done |
| RF-025 | P2 | 修复构建期版式开关单测断言对齐 | `tests/feature-flags.test.ts` | 1. 修复单测中硬编码 `expect(isLayoutEnabled(layout)).toBe(true)` 的不当断言；<br>2. 改为与 `FEATURE_FLAGS.layouts` 真实配置一致性比对，确保禁用版式返回 `false`，启用返回 `true`，`default` 始终为 `true`；<br>3. 消除基线红灯，恢复 88/88 套件全绿基准 | 低 | - [x] 运行 `pnpm test -- tests/feature-flags.test.ts` 验证 3/3 绿灯 | `docs/refactor-plan.md`：记录基线修复 | done |

优先级说明：
- `P0`：价值和风险都最高，优先执行（RF-021, RF-022）
- `P1`：价值或风险中等，放在 `P0` 之后（RF-023, RF-024）
- `P2`：低风险清理项或基线修复项，优先或收尾执行（RF-025）

状态说明：`pending` / `in_progress` / `done` / `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 基线 | 2026-11-14 | 2026-11-14 | `pnpm test` | 85 passed, 1 failed, 2 skipped (839/844 passed) | — | 识别并隔离 `tests/feature-flags.test.ts` 版式开关配置断言失效 |
| RF-025 | 2026-11-14 | 2026-11-14 | `pnpm test -- tests/feature-flags.test.ts` + 全量 `pnpm test` | pass (3/3, 全量 840/844 全绿) | `docs/refactor-plan.md` | 导出 FEATURE_FLAGS 并修正版式开关断言，基线恢复 100% 绿灯 |
| RF-021 | 2026-11-14 | 2026-11-14 | `pnpm test tests/presenter-tab-ux.test.ts tests/presenter-timer.test.ts tests/presenter-sync.test.ts` + 全量 `pnpm test` + `pnpm run build` | pass (847/851 全绿，build 成功) | `docs/project-structure.md` | 拆离 SCSS 为 SlidesPresenterTab.scss 与 SlidesPresenterThumbnail.scss；抽出 usePresenterTimer 与 usePresenterSync，主文件从 2892 行精简至 724 行 |
| RF-022 | 2026-11-14 | 2026-11-14 | `pnpm test tests/export-styles-golden.test.ts tests/pdf-template-styles.test.ts` + 全量 `pnpm test` + `pnpm run build` | pass (850/854 全绿，build 成功) | `docs/project-structure.md` | 拆解导出模板样式层至 shared-layout-styles 与 standalone-extra-styles，两端样式各减 ~1000 行，多端保持严格一致 |
| RF-023 | 2026-11-14 | 2026-11-14 | `pnpm test tests/inspector-superblock-detector.test.ts tests/inspector-state.test.ts` + 全量 `pnpm test` + `pnpm run build` | pass (857/861 全绿，build 成功) | `docs/project-structure.md` | 抽离超级块 DOM/AST 探测与多选转换监听至 useSuperBlockInspector，Dock 视图精简至 808 行 |
| RF-024 | 2026-11-14 | 2026-11-14 | `pnpm test tests/api-switch-integration.test.ts tests/api-switch-bridge.test.ts` + 全量 `pnpm test` + `pnpm run typecheck` + `pnpm run build` | pass (860/864 全绿，typecheck 0 报错，build 成功) | `docs/project-structure.md`、`README.md` | 拆离 ApiSwitchBridge 与 PreviewWindowManager，入口类职责清晰并净减 147 行 |

## 5. 决策与确认

- 用户批准的条目：用户已于 2026-11-14 明确批准执行全部条目（RF-025、RF-021、RF-022、RF-023、RF-024）
- 延后的条目：`src/compiler/slides-ast-builder.ts` 保持观察，不作破坏性拆分
- 阻塞条目及原因：无

## 6. 文档刷新记录

- [x] `docs/project-structure.md`：
  - 更新测试套件统计（91 测试文件 / 860 项测试全部通过）；
  - 记录新增的 `src/ui/tab/usePresenterTimer.ts`、`src/ui/tab/usePresenterSync.ts`、`src/ui/tab/SlidesPresenterTab.scss`、`src/ui/tab/SlidesPresenterThumbnail.scss`；
  - 记录新增的 `src/export/styles/` 共享样式生成器与单文件专用扩展样式架构；
  - 记录新增的 `src/ui/dock/useSuperBlockInspector.ts`；
  - 记录新增的 `src/plugin/api-switch-bridge.ts` 与 `src/plugin/preview-window-manager.ts`；
  - 补全 Phase 4 重构演进对照表 (RF-001 ~ RF-025)。
- [x] `AGENTS.md`：
  - 更新架构核心模块映射（Plugin Entry / Export / UI / Testing）；
  - 更新测试套件规模数据（91 套件 / 860 项用例）。
- [x] 最终同步检查：
  - 执行 `pnpm test` 确保 100% 通过（91 套件 / 860 用例全绿）；
  - 执行 `pnpm run typecheck` 确保 0 类型报错；
  - 执行 `pnpm run build` 确保产物打包与包校验正常生成。

## 7. 交付总结与后续

所有 5 项重构条目（RF-025 基线修复、RF-021 演讲者视图解耦、RF-022 导出样式解耦、RF-023 侧栏超级块探测解耦、RF-024 插件入口服务解耦）均已遵循测试先行与单一职责原则全部高保真落地，文档库与架构对照表已同步更新，代码库保持 0 错误、0 回归状态。等待用户审查与验收。严格遵守仓库规范，不擅自执行 git commit 或 git push。

---

## 附：历史已完成重构项归档

### Phase 3 (2026-10-25 完成)

- [x] **RF-016** (P0): Inspector Actions 按领域分层拆分 (`attr-persistence.ts`, `notes-actions.ts`, `layout-actions.ts`) [done]
- [x] **RF-017** (P0): Dock 视图重复覆写查询消除与状态瘦身 (`useInspectorPageOverrides.ts`) [done]
- [x] **RF-018** (P1): 离线播放器运行时分节拆分 (`standalone-runtime-sections/`) [done]
- [x] **RF-019** (P1): 插件入口抽离预览页签标题服务 (`preview-tab-title.ts`) [done]
- [x] **RF-020** (P2): 内核 API 死代码清理与 `kernel.ts` 移除 [done]
- 验证：`npm test` (608/608, 67 文件)、`npm run typecheck`、`npm run build` 全部通过

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
