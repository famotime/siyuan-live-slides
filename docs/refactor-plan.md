# 重构计划

## 1. 项目快照

- 生成日期：2026-10-25（Phase 3）
- 范围：SiYuan Slidev 插件 UI 编排层、导出运行时与插件入口 (`D:\MyCodingProjects\siyuan-slidev`)
- 当前工程规模：64 个测试文件，581 项测试全绿（`npm test` 基线已于 2026-10-25 确认通过）；`npm run typecheck` 与 `npm run build` 待每项执行前复核
- 背景：Phase 1 (RF-001~RF-010) 与 Phase 2 (RF-011~RF-015) 已于 2026-10-06 完成闭环；此后约 3 周 21 个功能提交（沉浸速览 peek、缩略图总览、数字跳页、预览页签标题联动等）使多个模块重新膨胀，并新增了尚未归档的 peek / compile-consumer-gate / page-jump-input / runtime-node 子系统
- 目标：
  1. 拆分重新膨胀至 1170 行的 `useInspectorActions.ts`，按领域（属性持久化 / 备注与 AI / 分割线与版式）分层解耦；
  2. 消除 `SlidevInspectorDockView.vue` (940 行) 中 7 处重复的分割线属性覆写查询模式并瘦身视图状态；
  3. 将全仓库最大文件 `standalone-client-runtime.ts` (1434 行) 的巨型模板字符串按功能分节拆分为可独立测试的生成器，保证输出字节级一致；
  4. 从插件入口 `src/index.ts` (771 行) 抽离预览页签标题管理服务；
  5. 清理 `src/api.ts` (622 行) 中约 46 个从未被引用的模板死代码导出，并确认 `kernel.ts` 示例模块去留。
- 文档刷新目标：`docs/project-structure.md`（测试基线 49/374 → 64/581、新增 peek 等子系统、本次新模块）、`README.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| Inspector Actions 业务编排 | `src/ui/dock/useInspectorActions.ts` (1170 行) | 属性持久化核心 (saveAttrs/saveAttr/savePageAttr/saveDocAttr)、备注块 CRUD 与 AI 批量操作、分割线插入/删除、超级块宽度与四叶草版式等全部内核 API 编排 | 自 RF-008 (~600 行) 翻倍，单一 Composable 混杂三大领域约 30 个函数，任何一处改动都在同一作用域内 | `tests/inspector-actions.test.ts` 覆盖核心路径，但按领域无隔离单测 |
| Inspector Dock 主视图 | `src/ui/dock/SlidevInspectorDockView.vue` (940 行) | 约 25 个响应式状态、约 20 个 computed、约 30 个事件转发 | `getBlockAttrOverride` 分割线覆写查询模式重复 7 处（pageLayout/pageLayoutRatio/pageMask/pageMaskRatio/pageMaskStyle/pageMaskInitial 等），修改查找逻辑需同步 7 处，缺陷风险高；视图与状态推导混杂 | `tests/inspector-state.test.ts` (316 行) 覆盖三态切换 |
| 单文件离线播放器运行时 | `src/export/standalone-client-runtime.ts` (1434 行) | 导出 HTML 内嵌的原生 JS 播放器（导航、缩放、数字跳页角标、缩略图总览层、键盘与 IPC） | 全仓库最大文件；单个模板字符串内嵌 35 个 JS 函数，无法被 lint/类型检查/单独测试；自 RF-006 (~700 行) 翻倍 | `tests/export.test.ts` 仅断言整体输出包含关键片段，无分节结构与快照保障 |
| 插件入口主类 | `src/index.ts` (771 行) | 生命周期、Protyle 事件、编译调度、Inspector 同步 | 自 RF-007 (390 行) 翻倍；预览页签标题管理 (buildPreviewTabTitle/fetchDocumentTitle/updatePreviewTabHeader，约 90 行) 与入口生命周期耦合 | `tests/preview-tab-title.test.ts` (9 项) 直接实例化入口类测试标题逻辑 |
| 内核 API 门面 | `src/api.ts` (622 行) | 思源内核 HTTP API 封装 | 62 个导出中仅约 16 个被实际引用（lsNotebooks/createDocWithMd/upload/insertBlock 等），其余为官方模板复制死代码，干扰检索与维护 | 无独立单测（作为薄封装可接受），全量测试与 typecheck 可保障 |
| 内核插件示例 | `src/kernel.ts` (221 行) | Go 内核 Goja 运行时的 echo RPC/Agent 示例 | 疑似脚手架示例代码（echo 演示），作为 vite 独立构建产物存在；是否保留待用户确认 | 无测试 |
| Peek 沉浸速览子系统（新增，未归档） | `src/ui/components/peek/` (3 个组件 1607 行)、`src/utils/peek-url.ts` (204 行) | Webview 网页速览、Protyle 文档速览、沉浸抽屉容器 | `WebviewPeekDrawer.vue` (952 行) 体量大但内聚（纯函数已前置抽取），主要缺口是文档未归档 | `tests/immersion-peek.test.ts` (449 行)、`peek-local-html.test.ts`、`peek-proxy-session.test.ts` 覆盖良好 |
| 预览页签 | `src/ui/tab/SlidevPreviewTab.vue` (820 行) | 分屏放映、引擎切换、总览、全屏、导出入口 | 体量偏大但 `page-jump-input.ts` 等已前置抽离，本期不列入重构，仅文档归档 | `tests/page-jump-*.test.ts`、`overview-grid.test.ts`、`wheel-nav-and-controls-sync.test.ts` 覆盖 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-016 | P0 | Inspector Actions 按领域分层拆分 | `src/ui/dock/useInspectorActions.ts`<br>新建 `src/ui/dock/actions/attr-persistence.ts`、`notes-actions.ts`、`layout-actions.ts` | 属性持久化核心（saveAttrs/saveAttr/savePageAttr/saveDocAttr + 防抖 DOM 同步）、备注与 AI 操作（创建/切换/追加/批量删除/AI 生成）、分割线与版式操作（插入/删除分割线、双栏对比、超级块宽度、四叶草、图片角色、视频开关）分别抽为独立模块，`useInspectorActions.ts` 保留统一门面与上下文装配，预计精简至 ~300 行 | 中 | - [x] 现有 `inspector-actions.test.ts` 全绿基线；<br>- [x] 为备注批量操作与属性覆写优先级补充领域级用例（新增 `tests/inspector-actions-domains.test.ts` 14 项）；<br>- [x] 重构后跑 `inspector-actions.test.ts` + `inspector-state.test.ts` + 全量 `npm test` | `docs/project-structure.md`：新增 actions 子模块说明 | done |
| RF-017 | P0 | Dock 视图重复覆写查询消除与状态瘦身 | `src/ui/dock/SlidevInspectorDockView.vue`<br>新建 `src/ui/dock/useInspectorPageOverrides.ts` | 将 7 处重复的 `currentPageDividerId \|\| activeBlockId` + `getBlockAttrOverride` + 文档属性回退三级查找模式抽取为 `useDividerAttrOverride(key)` computed 工厂与页面覆写状态组合式函数，视图 computed 区域预计净减 150+ 行 | 中 | - [x] 为覆写优先级（直接属性 > 覆写层 > frontmatter 回退，defined/truthy 两模式）补齐用例（新增 `tests/inspector-page-overrides.test.ts` 7 项）；<br>- [x] 重构后跑 `inspector-state.test.ts` + `dom-attr-sync.test.ts` + 全量 `npm test` | `docs/project-structure.md`：更新 Dock 视图架构 | done |
| RF-018 | P1 | 离线播放器运行时分节拆分 | `src/export/standalone-client-runtime.ts`<br>新建 `src/export/standalone-runtime-sections/`（core-nav、jump-badge、overview-layer、keyboard-ipc） | 巨型模板字符串拆为按功能分节的生成器函数，主函数仅负责拼接；重构前先固化输出全文快照基线测试，保证重构后输出与基线完全一致（字节级） | 中 | - [x] 重构前新增输出全文快照基线用例（golden master，`tests/__fixtures__/standalone-runtime-baseline.txt` 68693 字符）；<br>- [x] 重构后跑该快照用例 + `export.test.ts` + 全量 `npm test` | `docs/project-structure.md`：新增运行时分节模块 | done |
| RF-019 | P1 | 插件入口抽离预览页签标题服务 | `src/index.ts`<br>新建 `src/plugin/preview-tab-title.ts` | `buildPreviewTabTitle`/`fetchDocumentTitle`/`updatePreviewTabHeader` 及关联 DOM 更新逻辑抽为独立服务模块，入口类回归生命周期与事件编排，预计精简 ~90 行 | 低 | - [x] 现有 `preview-tab-title.test.ts` (9 项) 保持通过 + 新增 3 项模块直测；<br>- [x] 重构后跑 `preview-tab-title.test.ts` + `ui-lifecycle.test.ts` + 全量 `npm test` | `docs/project-structure.md`：plugin 目录新增模块 | done |
| RF-020 | P2 | 内核 API 死代码清理与 kernel.ts 去留 | `src/api.ts`（可选：`src/kernel.ts`） | 删除约 46 个零引用导出（notebook 管理、pandoc、criterion 等官方模板残留），仅保留实际使用的 ~16 个；`kernel.ts` 若用户确认无内核插件规划则一并移除并清理 vite 入口 | 低 | - [x] 删除前逐一 grep 确认零引用并记录清单（46 项：openNotebook/closeNotebook/renameNotebook/createNotebook/removeNotebook/getNotebookConf/setNotebookConf/renameDoc/removeDoc/moveDocs/getHPathByPath/getHPathByID/getIDsByHPath/prependBlock/moveBlock/transferBlockRef/getBlockByID/render/renderSprig/getFile/removeFile/readDir/exportMdContent/exportResources/pandoc/pushMsg/pushErrMsg/forwardProxy/bootProgress/version/currentTime/getCriteria/setCriterion/removeCriterion/reorderNotebooks/setFiletreeSort/setDocSortMode/reorderDocs/setAttrViewContextFilter/getAttributeViewRelationCandidates/duplicateDocTree/replaceAssetRef/getPluginPublishInfo/setPluginPublishDataGrant/savePluginPublishData/loadPluginPublishData）；<br>- [x] 移除 `kernel.ts`（用户已确认）并清理 vite 构建入口；<br>- [x] 跑 `npm run typecheck` + 全量 `npm test` + `npm run build` | `docs/project-structure.md`：更新 API 层描述 | done |

优先级说明：
- `P0`：价值和风险都最高，优先执行
- `P1`：价值或风险中等，放在 `P0` 之后
- `P2`：低风险清理项，最后执行

状态说明：`pending` / `in_progress` / `done` / `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 基线 | 2026-10-25 | 2026-10-25 | `npm test` | pass (581/581, 64 文件) | — | Phase 3 重构前基线已固化 |
| RF-016 | 2026-10-25 | 2026-10-25 | `npm test -- tests/inspector-actions-domains.test.ts tests/inspector-actions.test.ts tests/clover-layout.test.ts` + 全量 `npm test` + `npm run typecheck` | pass (595/595, 65 文件) | 待最终统一刷新 | 门面从 1170 行精简至 97 行；saveAttr 与 saveAttrs 逻辑逐行等价，合并为薄包装；三领域模块均具备直接单测 |
| RF-017 | 2026-10-25 | 2026-10-25 | `npm test -- tests/inspector-page-overrides.test.ts tests/inspector-state.test.ts tests/dom-attr-sync.test.ts` + 全量 `npm test` + `npm run typecheck` + `npm run build` | pass (602/602, 66 文件) | 待最终统一刷新 | 新增 `useInspectorPageOverrides.ts` 三级查找工厂；视图中 5 处重复 computed（~110 行）收敛为工厂调用；保留 currentSlideLayout 的长链回退不动以避免行为漂移 |
| RF-018 | 2026-10-25 | 2026-10-25 | `npm test -- tests/standalone-runtime-sections.test.ts tests/export.test.ts` + 全量 `npm test` + `npm run typecheck` | pass (605/605, 67 文件) | 待最终统一刷新 | 主文件 1434 → 29 行；9 个功能分节模块（core-state/overview-dom/navigation-helpers/block-rendering/slide-rendering/lightbox/jump-badge/overview-layer/keyboard-scroll-init），输出字节级一致由快照基线证明 |
| RF-019 | 2026-10-25 | 2026-10-25 | `npm test -- tests/preview-tab-title.test.ts tests/ui-lifecycle.test.ts` + 全量 `npm test` + `npm run typecheck` | pass (608/608, 67 文件) | 待最终统一刷新 | 入口 771 → 624 行；新增 `plugin/preview-tab-title.ts`（宿主接口 + 3 项模块直测）；插件类保留薄委托维护对外 API 兼容 |
| RF-020 | 2026-10-25 | 2026-10-25 | `npm run typecheck` + 全量 `npm test` + `npm run build` | pass (608/608, 67 文件；dist 仅 index.js 无 kernel 残留) | 待最终统一刷新 | `api.ts` 622 → 230 行（62 导出精简至 16 个在用）；`kernel.ts` 已删除并清理 vite 入口 |

## 5. 决策与确认

- 用户批准的条目：用户已于 2026-10-25 明确批准全部条目 RF-016、RF-017、RF-018、RF-019、RF-020，按序执行
- 延后的条目：无
- 阻塞条目及原因：无
- `kernel.ts` 决定：用户已确认移除（仅模板残留示例），RF-020 将删除文件并清理 vite 构建入口

## 6. 文档刷新

- `docs/project-structure.md`：已于 2026-10-25 全面刷新——测试基线更新为 67 文件 / 608 项；归档此前未记录的 peek 子系统、compile-consumer-gate、compile-scheduler、inspector-sync-cache、page-jump-input、runtime-node、peek-url、settings 等模块；新增 RF-016 ~ RF-020 产生的 actions/ 领域模块、useInspectorPageOverrides、preview-tab-title、standalone-runtime-sections/ 分节映射；移除已删除的 kernel.ts；重构演进对照表补齐 5 行
- `README.md`：已同步开发者指南中的测试基线（67 文件 / 608 项）
- `AGENTS.md`：已同步测试覆盖基线描述（67 套件 / 608 项，含领域模块、运行时分节与 peek 覆盖说明）
- 最终同步检查：已执行 `npm test` (608/608)、`npm run typecheck` (0 error) 与 `npm run build`（构建成功，dist 仅 index.js）

## 7. 下一步

1. 保持当前零回归、零类型错误、构建全绿的工程状态。
2. 本期未列入的观察项（后续可选）：`SlidevPreviewTab.vue` (820 行) 与 `WebviewPeekDrawer.vue` (952 行) 体量偏大但内聚良好，待功能稳定后再评估是否进一步拆分。

---

## 附：历史已完成重构项归档

### Phase 2 (2026-10-06 完成)

- [x] **RF-011** (P0): 剥离 PDF 导出器内联打印样式表 (`pdf-template-styles.ts`) [done]
- [x] **RF-012** (P0): 拆解超千行 Markdown 块级渲染器 (`visual-list-renderer.ts`, `slide-layout-renderer.ts`) [done]
- [x] **RF-013** (P1): 抽离 YAML 解析器与代码切片展开器 (`frontmatter-parser.ts`) [done]
- [x] **RF-014** (P1): 拆解超级块扫描器，剥离多栏列表扫描 (`list-column-scanner.ts`) [done]
- [x] **RF-015** (P2): 抽取 Slidev 导入弹窗业务为 Composable (`useSlidevImport.ts`) [done]
- 验证：`npm test` (374/374)、`npm run typecheck`、`npm run build` 全部通过，`docs/project-structure.md`、`README.md`、`AGENTS.md` 已同步

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
- 验证：`npm test` (343/343) 与 `npm run build` 全部通过，`docs/project-structure.md` 已同步
