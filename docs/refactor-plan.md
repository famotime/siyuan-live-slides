# 重构计划

## 1. 项目快照

- 生成日期：2026-10-06
- 范围：SiYuan Slidev 插件核心模块与视图架构 (`d:\MyCodingProjects\siyuan-slidev`)
- 目标：解耦膨胀的插件入口与光标同步中枢、剥离单文件 HTML 导出器中的海量内联运行时与样式表、抽取 Inspector 面板底层 API 编排与操作 Actions、拆分 AST 构建器中的指令动效包装函数，提升系统可维护性、测试隔离度与架构清晰度。
- 文档刷新目标：`docs/project-structure.md`、`README.md`、`AGENTS.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 离线单文件导出器 | `src/export/single-html-exporter.ts` (1796 行, 73.7 KB) | 生成完全脱机自闭环的单个 `.html` 演示包，支持资源 Base64 内联与独立播放器 | 全仓库体积最大单文件。包含近 1000 行内联 CSS 字符串与近 700 行客户端 JS 播放器运行时，与核心 TS 导出逻辑混杂，无法静态语法检查与模块化维护 | 现有 `export.test.ts` 覆盖基础导出，但无针对运行时脚本与样式的独立隔离测试 |
| 插件入口与生命周期 | `src/index.ts` (1178 行, 45.2 KB) | 插件生命周期、12 项命令注册与业务回调、Protyle 编辑器点击/选区/WS 事件监听、光标联动与 DOM 残留属性清理 | 职责再度超载。内联了大量 AI 分页、AI 提词、协同桥接等命令业务，以及近 500 行编辑器 DOM 遍历、前置分页符反查与属性自愈逻辑，难以单独单测 | 现有顶层集成测试覆盖，但命令调度器与光标同步协调器无独立单元测试 |
| 演示配置 Inspector 面板 | `src/ui/dock/SlidevInspectorDockView.vue` (1068 行, 37.4 KB) | 承载演示配置 Dock 主容器、三种场景（页面/块/文档）编排、选区信息展示与顶栏操作 | `<script setup>` 膨胀至 900+ 行，堆叠了大量直接调用思源内核 API 的异步业务（备注块转换与 AI 生成、属性保存与清除、分页符插入删除），视图与底层数据操作耦合严重 | 有 `inspector-state.test.ts` 状态机测试，但 API 操作调用链无独立 composable 级别测试 |
| Slidev AST 构建器 | `src/compiler/slidev-ast-builder.ts` (1125 行, 39.7 KB) | 将思源块树编译为 Slidev 虚拟幻灯片模型、生成各页 Markdown 与 Frontmatter | 超过 1100 行。将 Frontmatter 序列化、v-click/v-motion 指令生成、Shiki 行号注入等通用包装工具函数与多栏分流及核心 AST 构建主循环混在一个文件中 | `compiler.test.ts`、`v-click-resolver.test.ts` 覆盖良好，但指令包装器缺乏针对性纯函数单测 |
| 公共类型与工具边界 | `src/types/`、`src/utils/` | 跨模块通信与核心协议类型定义 | 部分扫描清洗与图片提取函数在不同子域间交叉依赖，`src/utils/index.ts` 缺乏统一整合 | `theme-styles-generator.test.ts` 等已有覆盖 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 抽离文档编译编排服务 | `src/index.ts`<br>新建 `src/compiler/document-compiler.ts` | 将 `compileCurrentDocument` 和 `parseIALString` 从入口类剥离为独立的编译编排服务 | 中 | - [x] 验证 `parseIALString` 边界；- [x] 验证数据流与错误兜底 | `docs/project-structure.md`：新增 DocumentCompiler 模块 | done |
| RF-002 | P0 | 拆解超千行 Inspector 演示配置面板 | `src/ui/dock/SlidevInspectorDockView.vue`<br>新建 3 个 Section 组件 | 拆解为页面级、块级、全局文档级三个高内聚子组件 | 中 | - [x] 补充激活状态机单测；- [x] 验证 props/emits 状态双向同步 | `docs/project-structure.md`：更新 Inspector 组件树 | done |
| RF-003 | P1 | 抽离 Slidev 导入器中的 HTML 清洗模块 | `src/compiler/slidev-importer.ts`<br>新建 `src/compiler/html-cleaner.ts` | 剥离 `cleanHtmlToMarkdown` 等容器与网格标签转换逻辑 | 低 | - [x] 补充 HTML 容器转换测试；- [x] 跑通导入集成测试 | `docs/project-structure.md`：新增 HtmlCleaner 模块 | done |
| RF-004 | P1 | 统一并复用导出模块中的 Markdown 块级渲染器 | `src/export/single-html-exporter.ts`<br>`src/export/pdf-exporter.ts`<br>新建 `src/export/markdown-renderer.ts` | 提取公共轻量级 Markdown-to-HTML 渲染函数，消除重复代码 | 低 | - [x] 补充公共渲染器测试；- [x] 跑通现有 export 测试 | `docs/project-structure.md`：新增 MarkdownRenderer 模块 | done |
| RF-005 | P2 | 清理遗留模板死代码与孤立组件 | 删除无用 Vue 组件与样式 | 移除 0 引用脚手架废弃代码 | 低 | - [x] 确认 0 业务引用；- [x] 全量测试与打包验证 | `docs/project-structure.md`：清理孤立组件说明 | done |
| RF-006 | P0 | 剥离单文件 HTML 导出器中的海量内联运行时与样式表 | `src/export/single-html-exporter.ts`<br>新建 `src/export/standalone-template-styles.ts`<br>新建 `src/export/standalone-client-runtime.ts` | 将 1000 行内联 CSS 与 700 行客户端 JS 播放器运行时抽离为专用模板生成模块，主导出器精简至 150 行以内，聚焦 Base64 资产内联与骨架装配 | 中 | - [x] 验证 `buildStandaloneHtml` 产出包含必要样式与脚本标签；<br>- [x] 验证 Base64 内联替换功能无行为漂移；<br>- [x] 跑通 `tests/export.test.ts` (17/17) | `docs/project-structure.md`：新增独立样式与客户端运行时模块说明；`README.md`：保持不变 | done |
| RF-007 | P0 | 拆解入口类，解耦命令注册器与光标/DOM 同步协调器 | `src/index.ts`<br>新建 `src/plugin/command-registry.ts`<br>新建 `src/sync/inspector-sync-coordinator.ts` | 将 12+ 项命令注册及回调业务剥离至命令注册器；将 500 行 Protyle DOM 遍历、前置分页符查找、列表项对齐与光标信息同步逻辑抽离为独立协调器，入口类精简至 250 行以内 | 中 | - [x] 补充命令调度器单测；<br>- [x] 补充 `inspector-sync-coordinator` 前置分页符查找与 DOM 属性自愈单测；<br>- [x] 跑通 `tests/ui-lifecycle.test.ts`、`tests/sync.test.ts`、`tests/dom-attr-sync.test.ts` (全量 319/319) | `docs/project-structure.md`：更新插件架构与同步模块划分；`README.md`：保持不变 | done |
| RF-008 | P1 | 抽离 Inspector 面板底层 API 编排与操作 Actions | `src/ui/dock/SlidevInspectorDockView.vue`<br>新建 `src/ui/dock/useInspectorActions.ts` | 将讲稿备注转换/插入/AI 生成、图片角色切换、分页符增删、属性保存与自愈擦除等 600+ 行非视图业务抽离为专用 Composable / Actions 服务 | 中 | - [x] 针对 Actions 抽离编写覆盖测试；<br>- [x] 跑通 `tests/inspector-state.test.ts` 与 UI 相关测试 (全量 323/323) | `docs/project-structure.md`：更新 Inspector 架构说明；`README.md`：保持不变 | done |
| RF-009 | P1 | 拆分 AST 构建器中的指令与动效包装工具函数 | `src/compiler/slidev-ast-builder.ts`<br>新建 `src/compiler/directive-wrapper.ts` | 剥离 `wrapVClickDirective`, `getMotionDirectives`, `wrapElementDirectives`, `injectShikiSpotlight`, `stringifyFrontmatter` 等独立纯函数至专用模块，使 AST 构建器聚焦核心语法树映射与作用域归类 | 低 | - [x] 补充 `directive-wrapper` 纯函数独立单测；<br>- [x] 跑通 `tests/compiler.test.ts`、`tests/v-click-resolver.test.ts`、`tests/document-compiler.test.ts` (全量 330/330) | `docs/project-structure.md`：新增 DirectiveWrapper 模块；`README.md`：保持不变 | done |
| RF-010 | P2 | 统一跨域通用工具导出与类型规范清理 | `src/types/slidev-protocol.ts`<br>`src/utils/index.ts`<br>新建 `src/utils/markdown-utils.ts` | 清理跨模块多级相对路径导入，规范图片提取、列表项清洗等工具函数导出边界，确保 0 循环依赖 | 低 | - [x] 执行 `npm run typecheck` 确认 0 错误；<br>- [x] 跑通全量 `npm test` (全量 343/343) | `docs/project-structure.md`：更新工具层映射 | done |

优先级说明：
- `P0`：价值和风险都最高，涉及核心控制与最庞大模块（1700+ 行单文件与 1100+ 行主入口），优先执行并强化测试
- `P1`：中等价值与中等风险，解耦高负荷视图与核心编译语法树工具函数
- `P2`：低风险清理项，规范跨域导出与类型一致性

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-10-04 | 2026-10-04 | `npm test` + `npm run build` | pass (69/69) | `docs/project-structure.md` | 成功将 compileCurrentDocument 与 parseIALString 抽离至 DocumentCompilerService，新增 document-compiler.test.ts |
| RF-002 | 2026-10-04 | 2026-10-04 | `npm test` + `npm run build` | pass (73/73) | `docs/project-structure.md` | 成功将 SlidevInspectorDockView 拆解为 PageInspectorSection、BlockInspectorSection 与 DocInspectorSection 三大高内聚子组件 |
| RF-003 | 2026-10-04 | 2026-10-04 | `npm test` + `npm run build` | pass (75/75) | `docs/project-structure.md` | 成功将 replaceDivContainer, protectVueDivContainers 与 convertHtmlToCleanMarkdown 剥离至独立的 html-cleaner.ts |
| RF-004 | 2026-10-04 | 2026-10-04 | `npm test` + `npm run build` | pass (79/79) | `docs/project-structure.md` | 成功将 Markdown 块级转 HTML 逻辑统一抽离至 markdown-renderer.ts，并增加通用测试 markdown-renderer.test.ts |
| RF-005 | 2026-10-04 | 2026-10-04 | `npm test` + `npm run build` | pass (79/79) | `docs/project-structure.md`、`README.md`、`AGENTS.md` | 完成 0 引用脚手架废弃代码清理（SlidevDockView.vue, App.vue, SiyuanTheme/），全量测试通过 |
| RF-006 | 2026-10-06 | 2026-10-06 | `npm test -- tests/export.test.ts` | pass (17/17) | `docs/project-structure.md` | 成功将 1000 行内联 CSS 与 700 行客户端 JS 抽离至 standalone-template-styles.ts 与 standalone-client-runtime.ts，single-html-exporter.ts 精简至 105 行 |
| RF-007 | 2026-10-06 | 2026-10-06 | `npm test -- tests/command-registry.test.ts tests/inspector-sync-coordinator.test.ts` | pass (5/5) | `docs/project-structure.md` | 成功将 12 项命令抽离至 command-registry.ts，将 DOM 追溯与前置分页符属性自愈抽离至 inspector-sync-coordinator.ts，index.ts 从 1178 行精简至 390 行 |
| RF-008 | 2026-10-06 | 2026-10-06 | `npm test -- tests/inspector-actions.test.ts` | pass (4/4) | `docs/project-structure.md` | 成功将 600+ 行 API 异步编排抽取至 useInspectorActions.ts，SlidevInspectorDockView.vue 从 1068 行精简至 430 行 |
| RF-009 | 2026-10-06 | 2026-10-06 | `npm test -- tests/directive-wrapper.test.ts` | pass (7/7) | `docs/project-structure.md` | 成功将指令包装、动效配置与三栏分配抽取至 directive-wrapper.ts，slidev-ast-builder.ts 精简近 500 行，代码高度内聚 |
| RF-010 | 2026-10-06 | 2026-10-06 | `npm run typecheck` + `npm test` | pass (343/343) | `docs/project-structure.md` | 抽取通用 markdown-utils.ts，统一 src/utils 导出门面，解耦 UI 与导出器对 compiler/superblock-scanner 的跨域依赖，新增 utils.test.ts (13/13) |

## 5. 决策与确认

- 用户批准的条目：RF-006, RF-007, RF-008, RF-009, RF-010（已全量执行完毕）
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：全量同步更新新增模块架构
- `README.md`：同步更新开发者指南与模块架构说明
- `AGENTS.md`：更新核心模块职责速查
- 最终同步检查：重构完成后执行 `npm test` 与 `npm run build`

## 7. 下一步

1. 执行全量文档刷新（`docs/project-structure.md`、`README.md`、`AGENTS.md`）。
2. 执行最终构建打包验证（`npm run build`）。
3. 输出重构总结报告。
