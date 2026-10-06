# 项目架构与目录结构 (Project Structure)

## 1. 架构概览

`siyuan-slidev` 是专为思源笔记 (SiYuan Note) 打造的现代化幻灯片演示插件。
项目核心架构遵循“**数据单向编排、业务高度解耦、视图轻量装配、测试优先保障**”的设计哲学：
- **插件入口与命令调度层 (`src/index.ts`, `src/plugin/`)**：轻量生命周期管理，解耦 12 项命令注册与 Protyle 事件分发。
- **编译器管线 (`src/compiler/`)**：负责思源块 AST、IAL 自定义属性字典、双向块引用与 Slidev Markdown 规范之间的双向转换与编排。
- **双向联动与状态同步中枢 (`src/sync/`)**：高内聚协调 Protyle DOM 选区跟踪、前置分页符反查、列表属性自愈与双向毫秒级光标定位。
- **双模渲染引擎 (`src/engine/`)**：封装内置纯前端 Web 沙箱（零依赖开箱即用）与本地 Slidev Pro CLI 桥接引擎。
- **导出管线 (`src/export/`)**：模板样式生成器、离线播放器客户端运行时与轻量 Markdown 块级渲染器高度模块化解耦，支持单文件离线 HTML 与 16:9 PDF 演示讲义导出。
- **视图展示层 (`src/ui/`)**：采用组合式架构，将演示配置面板拆解为页面、块、全局三大高内聚子组件，并通过 `useInspectorActions` 统一沉淀异步内核操作。
- **通用工具层 (`src/utils/`)**：规范统一导出 Markdown 提取、列表项清洗与类型判定纯函数，杜绝跨子系统深层侵入式依赖。

---

## 2. 核心模块与文件清单

```text
d:\MyCodingProjects\siyuan-slidev
├── docs/                                   # 项目文档与技术规格书
│   ├── project-structure.md                # 项目最新架构与模块映射（本文件）
│   ├── refactor-plan.md                    # 重构计划与执行日志 (RF-001 ~ RF-010)
│   ├── USER-GUIDE.zh-CN.md                 # 详细中文使用指南
│   └── USER-GUIDE.md                       # 详细英文使用指南
├── src/                                    # 插件源码目录
│   ├── index.ts                            # [RF-007] 插件入口主类（聚焦生命周期、Dock/Tab 挂载与顶层协调）
│   ├── main.ts                             # 前端挂载辅助入口
│   ├── api.ts                              # 思源内核 API 封装调用
│   ├── kernel.ts                           # 插件内核通信与服务桥接
│   ├── index.scss                          # 全局样式（含 spm 与 slidev 视觉变量）
│   │
│   ├── plugin/                             # 插件扩展服务层
│   │   └── command-registry.ts             # [RF-007] 插件命令注册表（集中调度 12+ 项指令与快捷操作回调）
│   │
│   ├── compiler/                           # 编译与导入管线
│   │   ├── document-compiler.ts            # [RF-001] 文档编译编排服务（AST 获取、IAL 解析、块引解析、沙箱推送）
│   │   ├── directive-wrapper.ts            # [RF-009] 指令包装器（Frontmatter 序列化、v-click/v-motion 生成、Shiki 聚光注入、三栏分配）
│   │   ├── slidev-ast-builder.ts           # [RF-009] 思源块 AST 到 Slidev 幻灯片数据模型构建器
│   │   ├── slidev-importer.ts              # [RF-003, RF-013] Slidev 导入器主服务（幻灯片切片与思源 AST 映射）
│   │   ├── frontmatter-parser.ts           # [RF-013] 独立 YAML Frontmatter 解析器与代码切片展开器
│   │   ├── html-cleaner.ts                 # [RF-003] HTML 标签清洗转换模块（网格容器剥离、Vue 标签保护、Markdown 清洗）
│   │   ├── superblock-scanner.ts           # [RF-014] 图文超级块分栏布局扫描与图片角色推断门面
│   │   ├── list-column-scanner.ts          # [RF-014] 专用多栏列表超级块扫描与槽位分配器
│   │   ├── ast-crawler.ts                  # 思源块级树状深度优先遍历器
│   │   ├── block-ref-resolver.ts           # 思源动态块引用 ((id)) 内容拉取与递归解析
│   │   ├── scope-mapper.ts                 # 思源 IAL 自定义属性到 Slidev 作用域与字段映射
│   │   ├── theme-styles-generator.ts       # 幻灯片主题 CSS 变量与调色板生成器
│   │   ├── assets-rewriter.ts              # 思源内部资源路径 (assets/...) 规范化重写
│   │   └── asset-importer.ts               # 外部导入 Slidev 演示时的资源解压与写入
│   │
│   ├── sync/                               # 双向毫秒级联动与 DOM 协调
│   │   ├── inspector-sync-coordinator.ts   # [RF-007] 编辑器选区探测、前置分页符反查、属性自愈与 Inspector 同步协调器
│   │   ├── inspector-slide-resolver.ts     # 当前激活块所属幻灯片页码与父级容器推断
│   │   ├── cursor-tracker.ts               # 编辑器光标定位跟踪与幻灯片翻页联动
│   │   ├── selection-mirror.ts             # 幻灯片点击反向高亮笔记块
│   │   ├── dom-attr-sync.ts                # Protyle 编辑器 DOM 自定义属性轻量同步
│   │   └── debounce-controller.ts          # 输入防抖与频繁触发节流控制器
│   │
│   ├── engine/                             # 双模渲染引擎
│   │   ├── engine-manager.ts               # 双模引擎统一调度中枢（高保真沙箱 vs. 原生 Pro CLI）
│   │   ├── env-detector.ts                 # 跨平台环境探测器（检测 Node.js 与全局 Slidev CLI）
│   │   ├── process-manager.ts              # 桌面端 Node 子进程生命周期守护、端口分配与健康探活
│   │   ├── workspace-scaffolder.ts         # 官方 Slidev 临时工程脚手架自动编排器
│   │   ├── native-slidev-bridge.ts         # 官方 Slidev 原生通信适配桥接器（基于 ?embedded=true 规范）
│   │   ├── web-sandbox-bridge.ts           # 内置 Web 沙箱通信桥接器（postMessage 双向通信）
│   │   ├── cli-devserver-bridge.ts         # 本地 Slidev CLI 基础开发服务器桥接（默认端口 3030）
│   │   └── v-click-resolver.ts             # 页面级与块级 v-click 步数聚合计算器
│   │
│   ├── export/                             # 导出与打印管线
│   │   ├── markdown-renderer.ts            # [RF-004, RF-012] 通用轻量级 Markdown 块级转 HTML 渲染器门面
│   │   ├── visual-list-renderer.ts         # [RF-012] 卡片网格、时间线、步骤等富列表渲染器
│   │   ├── slide-layout-renderer.ts        # [RF-012] 幻灯片页面版式容器分发器（两栏/三栏/图文/全屏等）
│   │   ├── single-html-exporter.ts         # [RF-006] 离线单文件 HTML 打包导出中枢（专注于 Base64 资产内联与骨架装配）
│   │   ├── standalone-template-styles.ts   # [RF-006] 独立单文件 HTML 样式生成器（~1000 行内联 CSS 与主题样式封装）
│   │   ├── standalone-client-runtime.ts    # [RF-006] 离线播放器客户端 JavaScript 运行时脚本模板（~700 行）
│   │   ├── pdf-exporter.ts                 # [RF-004, RF-011] 16:9 横版高分辨率打印与 PDF 导出器
│   │   └── pdf-template-styles.ts          # [RF-011] 独立 PDF 打印样式表与 @page 纸张规则生成器
│   │
│   ├── ui/                                 # 用户界面组件层 (Vue 3)
│   │   ├── dock/
│   │   │   ├── SlidevInspectorDockView.vue # [RF-002, RF-008] 演示配置主容器 Dock 视图（精炼至 ~430 行视图编排）
│   │   │   └── useInspectorActions.ts      # [RF-008] 演示配置 Actions 业务编排 Composable（600+ 行 API 异步操作）
│   │   ├── components/
│   │   │   ├── PageInspectorSection.vue    # [RF-002] 页面级配置子面板（版式九宫格、转场效果、演讲备注、背景图）
│   │   │   ├── BlockInspectorSection.vue   # [RF-002] 块级配置子面板（v-click 渐进动效、双栏 slot、代码逐行聚光）
│   │   │   ├── DocInspectorSection.vue     # [RF-002] 全局文档级配置子面板（主题、画幅比例、AI 工具箱、快速操作）
│   │   │   ├── SlideInspector.vue          # 幻灯片大纲导航微调器
│   │   │   ├── LayoutPicker.vue            # 布局版式选择器组件
│   │   │   ├── TransitionSelector.vue      # 转场过渡动效选择器组件
│   │   │   ├── ElementAnimBar.vue          # 元素级动画快捷操作条
│   │   │   ├── QuickDividerPopover.vue     # 原生分割线悬浮快捷菜单
│   │   │   ├── SlidevImportDialog.vue      # [RF-015] Slidev 项目导入对话框（精简聚焦 UI 交互与预检卡片）
│   │   │   └── useSlidevImport.ts          # [RF-015] 导入编排 Composable（资产上传、新建文档、属性注入与分屏联动）
│   │   ├── tab/
│   │   │   └── SlidevPreviewTab.vue        # 下方分屏实时演示放映页签
│   │   └── popover-manager.ts              # 悬浮弹层与气泡位置计算管理
│   │
│   ├── utils/                              # [RF-010] 通用跨域工具函数层
│   │   ├── index.ts                        # [RF-010] 工具层统一出口门面
│   │   └── markdown-utils.ts               # [RF-010] Markdown 纯文本提取（图片 URL、列表项前缀清洗、列表节点类型判定）
│   │
│   ├── ai/                                 # AI 智能演示增强
│   │   ├── auto-splitter.ts                # AI 智能长文档分页切片建议
│   │   ├── auto-animator.ts                # AI 列表递进与动效智能推断
│   │   └── notes-generator.ts              # AI 演讲者口播提词卡生成
│   │
│   ├── synergy/                            # 外部插件协同
│   │   ├── property-manager-bridge.ts      # 与 siyuan-property-manager 属性管家桥接
│   │   └── preset-templates.ts             # 预设 Slidev 属性模板字典
│   │
│   └── types/                              # TypeScript 类型声明与协议规范
│       ├── slidev-protocol.ts              # 块属性常量 (custom-slidev-*)、AST 契约及前端协议
│       ├── ipc-messages.ts                 # 沙箱与宿主之间 IPC 消息通道格式定义
│       ├── api.d.ts                        # 思源内核响应数据类型
│       └── index.d.ts                      # 全局环境与插件对象类型
│
├── tests/                                  # 自动化测试套件 (Vitest, 49 个测试文件，374 项用例全绿)
│   ├── mocks/
│   │   └── siyuan.ts                       # 思源插件宿主环境轻量 Mock（支持纯 Node 离线测试）
│   ├── command-registry.test.ts            # [RF-007] 插件命令注册表独立单测
│   ├── inspector-sync-coordinator.test.ts  # [RF-007] 前置分页符反查与属性自愈独立单测
│   ├── inspector-actions.test.ts           # [RF-008] Inspector Actions 异步业务编排单测
│   ├── directive-wrapper.test.ts           # [RF-009] Frontmatter 与动画指令包装纯函数单测
│   ├── utils.test.ts                       # [RF-010] 通用 Markdown 与工具函数单测
│   ├── export.test.ts                      # [RF-006] 离线单文件导出、样式与客户端运行时隔离测试
│   ├── pdf-template-styles.test.ts         # [RF-011] PDF 打印样式表与 @page 纸张尺寸单测
│   ├── visual-list-renderer.test.ts        # [RF-012] 卡片、时间线、步骤等富列表渲染单测
│   ├── slide-layout-renderer.test.ts       # [RF-012] 双栏、三栏、图文等版式容器分发单测
│   ├── markdown-renderer.test.ts           # [RF-004, RF-012] 导出 Markdown 块级渲染器通用单测
│   ├── frontmatter-parser.test.ts          # [RF-013] YAML Frontmatter 状态机与代码切片单测
│   ├── list-column-scanner.test.ts         # [RF-014] 多栏列表超级块扫描与分栏解析单测
│   ├── use-slidev-import.test.ts           # [RF-015] Slidev 导入 Composable 业务与回填逻辑单测
│   ├── document-compiler.test.ts           # [RF-001] 文档编译编排与 IAL 解析独立单测
│   ├── inspector-state.test.ts             # [RF-002] Inspector 三态切换与数据模型单测
│   ├── clean-markdown.test.ts              # [RF-003] HTML 容器转换与标签清洗边界单测
│   ├── compiler.test.ts                    # AST 构建器与 IAL 解析单测
│   ├── compiler-importer.test.ts           # Slidev Markdown 导入综合集成测试
│   ├── asset-importer.test.ts              # 外部资源提取与解压测试
│   ├── engine.test.ts                      # 双模渲染引擎调度与模式切换测试
│   ├── env-detector.test.ts                # Node.js 与 Slidev CLI 环境探测测试
│   ├── process-manager.test.ts             # 官方 Slidev 子进程守护与端口分配测试
│   ├── workspace-scaffolder.test.ts        # 官方 Pro 临时工程自动编排测试
│   ├── native-slidev-bridge.test.ts        # 官方 Slidev 协议 postMessage 桥接测试
│   ├── sync.test.ts                        # 光标联动与防抖控制测试
│   ├── synergy.test.ts                     # 属性管家桥接测试
│   ├── ai.test.ts                          # AI 分页与提词生成逻辑测试
│   ├── ui-lifecycle.test.ts                # 顶层生命周期冒烟测试
│   └── ...                                 # 其余 20+ 个专项领域回归测试用例
│
├── package.json                            # 项目配置与 npm scripts
├── vite.config.ts                          # Vite 打包配置（构建多产物并打包 zip）
├── vitest.config.ts                        # Vitest 测试配置（集成 siyuan mock 别名）
├── tsconfig.json                           # TypeScript 配置
└── release.js                              # 插件发版辅助脚本
```

---

## 3. 重构演进对照表 (RF-001 ~ RF-015)

| 模块 | 重构前状况 | 重构后演进 | 收益 |
| :--- | :--- | :--- | :--- |
| **单文件 HTML 导出器 (`src/export/`)** | 1796 行，混杂近 1000 行内联 CSS 与 700 行客户端 JS 播放器 | 抽离 `standalone-template-styles.ts` 与 `standalone-client-runtime.ts`，主文件精简至 105 行 | 导出骨架清晰，样式与客户端运行时完全模块化且可独立进行单测 |
| **插件主入口 (`src/index.ts`)** | 1178 行，混杂生命周期、12 项命令注册、DOM 树遍历及前置分页符追溯 | 抽离 `src/plugin/command-registry.ts` 与 `src/sync/inspector-sync-coordinator.ts`，入口精简至 390 行 | 职责彻底解耦，编辑器 DOM 追溯与自愈逻辑具备独立自动化测试保障 |
| **Inspector 配置面板 (`src/ui/dock/`)** | 1068 行，`<script setup>` 堆叠大量直接调用思源内核的异步操作 | 抽取 `src/ui/dock/useInspectorActions.ts` (600+ 行)，视图精简至 430 行 | 视图专注组件布局与用户交互，API 编排逻辑支持 Composable 级单测 |
| **Slidev AST 构建器 (`src/compiler/`)** | 1125 行，Frontmatter 序列化、Shiki 聚光注入、动效包装与主循环混杂 | 抽离 `src/compiler/directive-wrapper.ts`，构建器精简近 500 行 | 工具函数转为无副作用纯函数，AST 构建主逻辑清晰，扩展更安全 |
| **跨域工具与类型出口 (`src/utils/`)** | 仅含无类型的未引用废弃函数，UI 与导出器反向依赖编译内部扫描器 | 建立 `src/utils/markdown-utils.ts` 与规范门面导出，清除深层跨域依赖 | 依赖关系单向清晰，消除潜在循环引用，工具函数纯度与复用性极大提升 |
| **文档编译编排 (`src/compiler/`)** | 编排与 IAL 解析内联在入口中 | 独立为 `DocumentCompilerService` (`document-compiler.ts`) | 编译管线独立可测，支持沙箱与 Pro CLI 的统一驱动 |
| **演示面板组件拆分 (`src/ui/components/`)** | 超大单文件试图管理所有三态场景 | 拆分为页面、块、全局三大高内聚子面板组件 | 视图结构扁平高内聚，状态流向清晰明了 |
| **Slidev 导入清洗 (`src/compiler/`)** | 导入器内联 400 行 HTML 标签清洗转换代码 | 抽离为 `html-cleaner.ts` | 导入器专注 AST 映射，清洗转换可独立进行边界单测 |
| **导出 Markdown 渲染器 (`src/export/`)** | 离线 HTML 与 PDF 导出器各自内联独立渲染逻辑 | 统一提取 `markdown-renderer.ts` 共享渲染模块 | 彻底消除重复渲染逻辑，保证各导出渠道排版 100% 一致 |
| **废弃模板与死代码** | 包含 0 引用的 `SlidevDockView.vue`、`App.vue` 及 `SiyuanTheme/` | 彻底清理删除 | 减少约 500 行无用代码，降低静态分析与包体积负担 |
| **PDF 打印导出样式解耦 (RF-011)** | `pdf-exporter.ts` (733 行) 混杂近 600 行内联打印 CSS 字符串 | 抽离 `src/export/pdf-template-styles.ts`，主文件精简至 110 行 | 打印样式生成器支持独立测试与纸张尺寸覆盖，排版规则更清晰 |
| **富列表渲染与版式分发 (RF-012)** | `markdown-renderer.ts` (1159 行) 混合行内标记、视觉列表与版式容器 | 抽离 `visual-list-renderer.ts` 与 `slide-layout-renderer.ts`，主文件精简至 558 行 | 消除全仓库最大单文件，卡片网格与幻灯片多栏容器独立可维护 |
| **YAML 解析与代码切片展开 (RF-013)** | `slidev-importer.ts` (877 行) 混杂 210 行 YAML 状态机与切片展开器 | 抽离 `src/compiler/frontmatter-parser.ts`，主导入器精简至 494 行 | YAML 状态机纯函数隔离并具备全方位边界测试，代码切片提取解耦 |
| **多栏列表超级块扫描解耦 (RF-014)** | `superblock-scanner.ts` (789 行) 混杂图文扫描与复杂列表分栏状态机 | 抽离 `src/compiler/list-column-scanner.ts`，原文件保留图文扫描与门面 | 列表超级块槽位分配与图文角色推断独立解耦，单向依赖清晰 |
| **Slidev 导入弹窗业务解耦 (RF-015)** | `SlidevImportDialog.vue` (875 行) `<script setup>` 堆叠 300+ 行内核调用 | 抽取 `src/ui/components/useSlidevImport.ts`，对话框精简至仅负责 UI | 业务编排与 Vue 视图完全解耦，支持 Composable 级与端到端自动化测试 |
