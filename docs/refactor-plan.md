# 重构计划

## 1. 项目快照

- 生成日期：2026-10-06
- 范围：SiYuan Slidev 插件核心模块架构与导出/编译/UI解耦 (`d:\MyCodingProjects\siyuan-slidev`)
- 当前工程规模：43 个测试套件，343 项单元与集成测试全绿；构建打包与类型检查通过
- 目标：
  1. 剥离 PDF 导出器中近 600 行内联打印 CSS 模板，解耦样式生成与 HTML 序列化；
  2. 拆解全仓库最大单文件 `markdown-renderer.ts`（1159 行），抽离卡片/时间线/步骤等复杂视觉列表渲染器与幻灯片版式编排；
  3. 拆分 `slidev-importer.ts`（877 行），剥离独立的 YAML Frontmatter 解析器与代码切片语法展开器；
  4. 解耦 `superblock-scanner.ts`（789 行），将多栏列表超级块扫描与槽位分配独立成专用模块；
  5. 抽取 `SlidevImportDialog.vue`（875 行）中的资产上传、文档新建与属性编排业务为独立 Composable 服务。
- 文档刷新目标：`docs/project-structure.md`、`README.md`、`AGENTS.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| PDF 打印讲义导出器 | `src/export/pdf-exporter.ts` (733 行, 21.4 KB) | 生成符合 16:9/4:3/A4 等纸张比例的高保真可打印 HTML | 包含近 600 行内联 CSS 字符串与媒体查询，与核心 HTML 组装逻辑混杂，无法对打印样式进行语法检查与隔离测试 | 现有 `export.test.ts` 覆盖导出调用，但无样式生成的独立单测 |
| 演示 Markdown 块级渲染器 | `src/export/markdown-renderer.ts` (1159 行, 44.7 KB) | 将思源块与幻灯片编译为高保真 HTML，支持卡片网格、时间线、步骤、音视频等 | 全仓库最大单文件。高度混合了 4 重职责：行内标记转义、卡片/时间线/步骤等富列表渲染、各页面版式（two-cols 等）分发、通用块级派发 | 现有 `markdown-renderer.test.ts`、`list-superblock-columns.test.ts` 覆盖良好，但模块体积极度臃肿 |
| Slidev 演示导入解析器 | `src/compiler/slidev-importer.ts` (877 行, 28.4 KB) | 将外部 Slidev Markdown 转换为思源块树结构并提取统计信息 | 包含 210+ 行手写缩进状态机 YAML 解析器与代码切片展开器，与 Slidev 幻灯片 AST 组装耦合在一起 | `compiler-importer.test.ts` 覆盖，但 YAML 状态机无独立纯函数单测 |
| 超级块排版扫描器 | `src/compiler/superblock-scanner.ts` (789 行, 25.3 KB) | 扫描思源块树并自动识别图文超级块与列表分栏结构 | 将图文超级块左右排版与列表超级块分栏（2栏/3栏/嵌套）两种不同逻辑混在一个文件，函数依赖层级深 | `superblock-and-image.test.ts`、`list-superblock-columns.test.ts` 覆盖良好 |
| Slidev 导入弹窗交互 | `src/ui/components/SlidevImportDialog.vue` (875 行, 24.6 KB) | Zip 导入、Markdown 粘贴、配置预检、执行导入与属性绑定 | `<script setup>` 堆积了 300+ 行思源内核 API 异步调用（资产上传、创建文档、子块遍历、属性回填、分屏联动），交互与业务混淆 | 目前仅有依赖该对话框生成效果的间接测试，无独立 Composable 单元测试 |

## 3. 按优先级排序的重构待办

### 3.1 本期计划重构项（Phase 2）

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-011 | P0 | 剥离 PDF 导出器内联打印样式表 | `src/export/pdf-exporter.ts`<br>新建 `src/export/pdf-template-styles.ts` | 将 580+ 行打印样式表、纸张比例 (@page) 与主题变量抽离为独立样式生成器，`pdf-exporter.ts` 精简至 110 行 | 中 | - [x] 验证 `getPageSizeCss` 针对 16:9/4:3/A4 产出正确尺寸；<br>- [x] 验证包含完整主题变量与分栏打印规则；<br>- [x] 跑通 `tests/export.test.ts` (17/17) 与 `tests/pdf-template-styles.test.ts` (4/4) | `docs/project-structure.md`：新增 PDF 样式生成模块 | done |
| RF-012 | P0 | 拆解超千行 Markdown 块级渲染器 | `src/export/markdown-renderer.ts`<br>新建 `src/export/visual-list-renderer.ts`<br>新建 `src/export/slide-layout-renderer.ts` | 将卡片列表、时间线、步骤等富列表渲染逻辑（400+ 行）抽离至 `visual-list-renderer.ts`，将两栏/三栏/图片等幻灯片页面版式容器分发（180+ 行）抽离至 `slide-layout-renderer.ts`，主渲染器从 1159 行精简至 558 行 | 中 | - [x] 验证卡片网格、时间线、步骤列表渲染 HTML 与属性结构一致；<br>- [x] 验证双栏、三栏、图文版式容器渲染正确；<br>- [x] 跑通 `tests/visual-list-renderer.test.ts` (4/4)、`tests/slide-layout-renderer.test.ts` (4/4)、`tests/markdown-renderer.test.ts` (6/6) | `docs/project-structure.md`：更新导出渲染器组件架构 | done |
| RF-013 | P1 | 抽离 Slidev 导入器中的 YAML 解析器与代码切片展开器 | `src/compiler/slidev-importer.ts`<br>新建 `src/compiler/frontmatter-parser.ts` | 将 210 行 YAML 标量/多行/缩进解析器 `parseYamlFrontmatter`、代码切片展开器 `resolveCodeSnippet` 及 Slide Matter 提取纯函数抽离为专用模块，主导入器从 877 行精简至 494 行 | 低 | - [x] 补充 YAML 嵌套对象、多行文本 `\|` / `>` 及注释过滤单测；<br>- [x] 验证外部代码片段切片语法提取；<br>- [x] 跑通 `tests/frontmatter-parser.test.ts` (6/6)、`tests/compiler-importer.test.ts` (7/7) 与 `tests/starter-full-audit.test.ts` (3/3) | `docs/project-structure.md`：新增 FrontmatterParser 模块 | done |
| RF-014 | P1 | 拆解超级块扫描器，剥离多栏列表超级块扫描 | `src/compiler/superblock-scanner.ts`<br>新建 `src/compiler/list-column-scanner.ts` | 将列表超级块提取 (`extractListUnits`, `extractListSuperBlockItems`, `detectListSuperBlockColumns`, `scanAndTagListSuperBlocks`) 抽离至专用列表分栏扫描器，原模块保留图文超级块扫描与基础判定门面 | 低 | - [x] 验证 2 栏与 3 栏列表超级块提取与嵌套形态解析；<br>- [x] 验证图文超级块扫描与标签自愈不受影响；<br>- [x] 跑通 `tests/list-column-scanner.test.ts` (4/4)、`tests/superblock-and-image.test.ts` (19/19) 与 `tests/list-superblock-columns.test.ts` (34/34) | `docs/project-structure.md`：更新编译器扫描器模块划分 | done |
| RF-015 | P2 | 抽取 Slidev 导入弹窗中的导入编排业务为独立 Composable | `src/ui/components/SlidevImportDialog.vue`<br>新建 `src/ui/components/useSlidevImport.ts` | 将资产上传、创建思源文档、分割线属性注入、插槽属性回填与分屏联动等 300+ 行非视图业务抽离为 Composable，对话框组件精简聚焦 UI 交互与预检卡片 | 低 | - [x] 针对 `useSlidevImport` 抽离编写纯业务单元测试；<br>- [x] 验证 Zip 包解压与纯文本导入完整链路；<br>- [x] 跑通全量 `npm test` (374/374) 与 `npm run build` | `docs/project-structure.md`：更新导入组件架构说明 | done |

### 3.2 历史已完成重构项（Phase 1 归档）

- [x] **RF-001** (P0): 抽离文档编译编排服务 (`src/compiler/document-compiler.ts`) [done]
- [x] **RF-002** (P0): 拆解超千行 Inspector 演示配置面板 (3 个 Section 组件) [done]
- [x] **RF-003** (P1): 抽离 Slidev 导入器中的 HTML 清洗模块 (`src/compiler/html-cleaner.ts`) [done]
- [x] **RF-004** (P1): 统一并复用导出模块中的 Markdown 块级渲染器 (`src/export/markdown-renderer.ts`) [done]
- [x] **RF-005** (P2): 清理遗留模板死代码与孤立组件 [done]
- [x] **RF-006** (P0): 剥离单文件 HTML 导出器海量样式与运行时 (`standalone-template-styles.ts`, `standalone-client-runtime.ts`) [done]
- [x] **RF-007** (P0): 拆解入口类，解耦命令注册器与光标/DOM 同步协调器 (`command-registry.ts`, `inspector-sync-coordinator.ts`) [done]
- [x] **RF-008** (P1): 抽离 Inspector 面板底层 API 编排与操作 Actions (`useInspectorActions.ts`) [done]
- [x] **RF-009** (P1): 拆分 AST 构建器中的指令与动效包装工具函数 (`directive-wrapper.ts`) [done]
- [x] **RF-010** (P2): 统一跨域通用工具导出与类型规范清理 (`markdown-utils.ts`) [done]

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 ~ RF-010 | 2026-10-04 | 2026-10-06 | `npm test` + `npm run build` | pass (343/343) | `docs/project-structure.md` | Phase 1 全量 10 项重构已验证闭环 |
| RF-011 | 2026-10-06 | 2026-10-06 | `npm test -- tests/pdf-template-styles.test.ts tests/export.test.ts` | pass (21/21) | `docs/project-structure.md` | 成功将 580+ 行内联 CSS 抽离至 pdf-template-styles.ts，pdf-exporter.ts 精简至 110 行 |
| RF-012 | 2026-10-06 | 2026-10-06 | `npm test -- tests/visual-list-renderer.test.ts tests/slide-layout-renderer.test.ts tests/markdown-renderer.test.ts` | pass (14/14) | `docs/project-structure.md` | 成功将卡片/列表渲染与页面版式分发抽离至 visual-list-renderer.ts 与 slide-layout-renderer.ts，markdown-renderer.ts 从 1159 行精简至 558 行 |
| RF-013 | 2026-10-06 | 2026-10-06 | `npm test -- tests/frontmatter-parser.test.ts tests/compiler-importer.test.ts` | pass (13/13) | `docs/project-structure.md` | 成功将 YAML 标量/多行解析与代码切片语法抽离至 frontmatter-parser.ts，slidev-importer.ts 从 877 行精简至 494 行 |
| RF-014 | 2026-10-06 | 2026-10-06 | `npm test -- tests/list-column-scanner.test.ts tests/superblock-and-image.test.ts tests/list-superblock-columns.test.ts` | pass (57/57) | `docs/project-structure.md` | 成功将多栏列表超级块扫描抽离至 list-column-scanner.ts，superblock-scanner.ts 专注图文超级块扫描并保持统一门面 |
| RF-015 | 2026-10-06 | 2026-10-06 | `npm test -- tests/use-slidev-import.test.ts tests/ui-lifecycle.test.ts` + `npm run typecheck` + `npm run build` | pass (12/12) | `docs/project-structure.md` | 成功将资产上传、文档创建、分割线属性注入与插槽回填抽离至 useSlidevImport.ts，SlidevImportDialog.vue 业务层完全解耦 |

## 5. 决策与确认

- 用户批准的条目：用户已明确批准 RF-011、RF-012、RF-013、RF-014、RF-015 全部按计划实施并已全量完成
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：已同步新增的 6 个模块架构映射
- `README.md`：已同步更新架构描述与核心模块说明
- `AGENTS.md`：已同步更新模块导览与测试覆盖基线
- 最终同步检查：已执行 `npm test` (374/374 通过)、`npm run typecheck` (0 error) 与 `npm run build` (构建成功并产出 package.zip)

## 7. 下一步

1. 保持当前零警告、零回归的高品质工程状态。
2. 汇总重构成果与模块度量报告，交付用户查阅。
