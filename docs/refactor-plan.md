# 重构计划

## 1. 项目快照

- 生成日期：2026-10-04
- 范围：SiYuan Slidev 插件核心模块与视图架构 (`d:\MyCodingProjects\siyuan-slidev`)
- 目标：解耦入口编排逻辑、拆解超千行单文件组件、提取公共 HTML 清洗与导出渲染模块、清理废弃样板，提升核心管线可测性与可维护性。
- 文档刷新目标：`docs/project-structure.md`、`README.md`、`README_zh_CN.md`、`AGENTS.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 插件入口与生命周期 | `src/index.ts` (724 行) | 插件生命周期、12 项命令注册、UI 挂载、编辑器选区与点击监听、文档编译编排（获取块、查询 IAL、块引用解析、AST 构建、沙箱推送） | 职责严重超载，核心编译编排逻辑嵌入类内部，无法进行隔离单测 | 仅有顶层指令生命周期冒烟测试，核心编排流程无独立单元测试 |
| 演示配置 Inspector 面板 | `src/ui/dock/SlidevInspectorDockView.vue` (1078 行) | 承载页面级（分页符）、块级（元素渐进动画/分栏/高亮）以及全局文档级（主题/画幅/操作）全部配置交互与样式 | 单文件超千行，三类完全不同生命周期的上下文表单混杂，拓展新配置项极其困难 | 视图无单元测试，仅间接依赖协议类型 |
| Slidev 导入器 | `src/compiler/slidev-importer.ts` (1107 行) | Frontmatter 解析、Markdown 切片、HTML 容器与网格标签清洗、资产提取、思源块 AST 映射 | 职责过宽，近 400 行 HTML 标签清洗转换逻辑与导入核心 AST 映射混杂在一起 | 有集成测试 (`compiler-importer.test.ts`)，但清洗函数边界未独立隔离 |
| 离线与打印导出模块 | `src/export/single-html-exporter.ts` (221 行)<br>`src/export/pdf-exporter.ts` (390 行) | 分别生成离线单文件 HTML SPA 和可打印的高清横版 PDF 页面 | 内部各自维护一套轻量级 Markdown 块到 HTML 的渲染逻辑，存在重复代码且渲染规则可能漂移 | 仅测试导出的 HTML 包装函数 (`export.test.ts`)，块级渲染规则无共享单元测试 |
| 遗留模板与死代码 | `src/ui/dock/SlidevDockView.vue` (219 行)<br>`src/App.vue` (233 行)<br>`src/components/SiyuanTheme/*` (6 个组件) | 早期脚手架遗留的示例代码与已被 `SlidevInspectorDockView` 完全替代的原型视图 | 0 引用孤立代码，干扰工程心智模型与静态分析 | 无测试，纯死代码 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 抽离文档编译编排服务 | `src/index.ts`<br>新建 `src/compiler/document-compiler.ts` | 将 `compileCurrentDocument` 和 `parseIALString` 从入口类剥离为独立的编译编排服务，纯化插件入口 | 中 | - [x] 验证 `parseIALString` 键值提取的边界与转义；<br>- [x] 模拟思源 API 交互，验证编译编排全链路数据流输出与错误兜底 | `docs/project-structure.md`：新增 DocumentCompiler 模块；`README.md`：保持不变 | done |
| RF-002 | P0 | 拆解超千行 Inspector 演示配置面板 | `src/ui/dock/SlidevInspectorDockView.vue`<br>新建 `src/ui/components/PageInspectorSection.vue`<br>新建 `src/ui/components/BlockInspectorSection.vue`<br>新建 `src/ui/components/DocInspectorSection.vue` | 拆解为页面级、块级、全局文档级三个高内聚子组件，主面板精简为编排容器 | 中 | - [x] 补充 Inspector 激活状态机判断逻辑单元测试；<br>- [x] 验证 props/emits 状态双向同步与防抖保存逻辑 | `docs/project-structure.md`：更新 Inspector 组件树结构；`README.md`：保持不变 | done |
| RF-003 | P1 | 抽离 Slidev 导入器中的 HTML 清洗模块 | `src/compiler/slidev-importer.ts`<br>新建 `src/compiler/html-cleaner.ts` | 剥离 `cleanHtmlToMarkdown`、容器与网格标签转换逻辑至独立模块，使导入器聚焦 AST 映射 | 低 | - [x] 补充 HTML 容器转换、网格布局剥离、图片转换针对性测试；<br>- [x] 跑通现有 `clean-markdown.test.ts` 与 `compiler-importer.test.ts` | `docs/project-structure.md`：新增 HtmlCleaner 模块；`README.md`：保持不变 | done |
| RF-004 | P1 | 统一并复用导出模块中的 Markdown 块级渲染器 | `src/export/single-html-exporter.ts`<br>`src/export/pdf-exporter.ts`<br>新建 `src/export/markdown-renderer.ts` | 提取公共轻量级 Markdown-to-HTML 渲染函数，消除重复代码，统一导出排版规则 | 低 | - [x] 补充公共 Markdown 块级渲染器覆盖率测试（标题、列表、代码、引用、双栏 slot）；<br>- [x] 跑通现有 `export.test.ts` | `docs/project-structure.md`：新增 MarkdownRenderer 模块；`README.md`：保持不变 | done |
| RF-005 | P2 | 清理遗留模板死代码与孤立组件 | 删除 `src/ui/dock/SlidevDockView.vue`<br>删除 `src/App.vue`<br>删除 `src/components/SiyuanTheme/` | 移除 0 引用脚手架废弃代码，减轻维护与打包负担 | 低 | - [x] 全局搜索确认 0 业务引用；<br>- [x] 执行 `npm test` 与 `npm run build` 确保无构建断裂 | `docs/project-structure.md`：移除已删除组件说明；`README.md`：保持不变 | done |

优先级说明：
- `P0`：价值和风险都最高，涉及核心控制与最庞大模块，优先执行并强化测试
- `P1`：中等价值与中等风险，解耦重要管线，消除重复
- `P2`：低风险清理项，最后执行

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
| RF-005 | 2026-10-04 | 2026-10-04 | `npm test` + `npm run build` | pass (79/79) | `docs/project-structure.md`、`README.md`、`README_zh_CN.md`、`AGENTS.md`、`CLAUDE.md` | 完成 0 引用脚手架废弃代码清理（SlidevDockView.vue, App.vue, SiyuanTheme/），全量测试 79/79 通过，打包顺利 |

## 5. 决策与确认

- 用户批准的条目：RF-001, RF-002, RF-003, RF-004, RF-005 全量批准
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：[已完成] 全新梳理并描摹重构后的目录架构，包含重构后抽离的各核心模块职责映射与已删除的孤立组件清单。
- `README.md` / `README_zh_CN.md`：[已完成] 增加项目架构文档导航链接与开发者指南（含常用命令与架构入口）。
- `AGENTS.md` / `CLAUDE.md`：[已完成] 新建精炼的项目速查指南，供后续编程 Agent 快速获取技术栈、常用命令、架构分层与不可破规则。
- 最终同步检查：[已完成] 全套 14 个测试套件（79/79 项测试）全部通过，`npm run build` 成功打包生成 `dist/` 与 `package.zip`。

## 7. 下一步

1. 已全部完成重构计划 RF-001 ~ RF-005 的代码实施、自动化测试验证与全套文档刷新。
2. 按照代码重构技能规范向用户交付最终结构化汇报。
