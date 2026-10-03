# 项目架构与目录结构 (Project Structure)

## 1. 架构概览

`siyuan-slidev` 是专为思源笔记 (SiYuan Note) 打造的现代化幻灯片演示插件。
项目核心架构遵循“**数据单向编排、视图高内聚拆解、测试驱动解耦**”设计哲学：
- **入口层**：精炼插件生命周期、命令注册与视图装配，不承担复杂数据运算。
- **编译器管线 (`src/compiler/`)**：负责思源块 AST、IAL 自定义属性字典、双向块引用与 Slidev Markdown 规范之间的双向转换与编排。
- **双模渲染引擎 (`src/engine/`)**：封装内置纯前端 Web 沙箱（零依赖开箱即用）与本地 Slidev Pro CLI 桥接引擎。
- **导出管线 (`src/export/`)**：复用轻量 Markdown 块级渲染器，支持单文件离线 HTML 与高清 16:9 PDF 讲义导出。
- **视图展示层 (`src/ui/`)**：采用分层组合模式，将超大 Inspector 配置面板拆解为页面、块、全局三大高内聚子组件。

---

## 2. 核心模块与文件清单

```text
d:\MyCodingProjects\siyuan-slidev
├── docs/                               # 项目文档与技术规格书
│   ├── project-structure.md            # 项目最新架构与模块映射（本文件）
│   ├── refactor-plan.md                # 重构计划与执行日志
│   ├── USER-GUIDE.zh-CN.md             # 详细中文使用指南
│   └── USER-GUIDE.md                   # 详细英文使用指南
├── src/                                # 插件源码目录
│   ├── index.ts                        # 插件入口类（生命周期、命令注册、Dock/Tab 挂载）
│   ├── main.ts                         # 前端挂载辅助入口
│   ├── api.ts                          # 思源内核 API 封装调用
│   ├── kernel.ts                       # 插件内核通信与服务桥接
│   ├── index.scss                      # 全局样式（含 spm 与 slidev 视觉变量）
│   │
│   ├── compiler/                       # 编译与导入管线
│   │   ├── document-compiler.ts        # [RF-001] 文档编译编排服务（AST 获取、IAL 解析、块引解析、沙箱推送）
│   │   ├── slidev-importer.ts          # [RF-003] Slidev 导入器（Frontmatter 解析、Markdown 切片、思源 AST 映射）
│   │   ├── html-cleaner.ts             # [RF-003] HTML 标签清洗转换模块（网格容器剥离、Vue 标签保护、Markdown 清洗）
│   │   ├── slidev-ast-builder.ts       # 思源块 AST 到 Slidev 幻灯片数据模型构建器
│   │   ├── ast-crawler.ts              # 思源块级树状深度优先遍历器
│   │   ├── block-ref-resolver.ts       # 思源动态块引用 ((id)) 内容拉取与递归解析
│   │   ├── scope-mapper.ts             # 思源 IAL 自定义属性到 Slidev 作用域与字段映射
│   │   ├── assets-rewriter.ts          # 思源内部资源路径 (assets/...) 规范化重写
│   │   └── asset-importer.ts           # 外部导入 Slidev 演示时的资源解压与写入
│   │
│   ├── engine/                         # 双模渲染引擎
│   │   ├── engine-manager.ts           # 双引擎切换控制器（Sandbox vs. CLI DevServer）
│   │   ├── web-sandbox-bridge.ts       # 内置 Web 沙箱通信桥接器（postMessage 双向通信）
│   │   └── cli-devserver-bridge.ts     # 本地 Slidev CLI 开发服务器桥接（默认端口 3030）
│   │
│   ├── export/                         # 导出与打印管线
│   │   ├── markdown-renderer.ts        # [RF-004] 通用轻量级 Markdown 块级转 HTML 渲染器
│   │   ├── single-html-exporter.ts     # [RF-004] 离线单文件独立 HTML 打包导出器
│   │   └── pdf-exporter.ts             # [RF-004] 16:9 横版高分辨率打印与 PDF 导出器
│   │
│   ├── ui/                             # 用户界面组件层 (Vue 3)
│   │   ├── dock/
│   │   │   └── SlidevInspectorDockView.vue # [RF-002] 演示配置主容器 Dock 视图（协调子面板与状态同步）
│   │   ├── components/
│   │   │   ├── PageInspectorSection.vue    # [RF-002] 页面级配置子面板（版式九宫格、转场效果、演讲备注、背景图）
│   │   │   ├── BlockInspectorSection.vue   # [RF-002] 块级配置子面板（v-click 渐进动效、双栏 slot、代码逐行聚光）
│   │   │   ├── DocInspectorSection.vue     # [RF-002] 全局文档级配置子面板（主题、画幅比例、AI 工具箱、快速操作）
│   │   │   ├── SlideInspector.vue          # 幻灯片大纲导航微调器
│   │   │   ├── LayoutPicker.vue            # 布局版式选择器组件
│   │   │   ├── TransitionSelector.vue      # 转场过渡动效选择器组件
│   │   │   ├── ElementAnimBar.vue          # 元素级动画快捷操作条
│   │   │   ├── QuickDividerPopover.vue     # 原生分割线悬浮快捷菜单
│   │   │   └── SlidevImportDialog.vue      # Slidev 项目导入对话框
│   │   ├── tab/
│   │   │   └── SlidevPreviewTab.vue        # 下方分屏实时演示放映页签
│   │   └── popover-manager.ts              # 悬浮弹层与气泡位置计算管理
│   │
│   ├── sync/                           # 双向毫秒级联动
│   │   ├── cursor-tracker.ts           # 编辑器光标定位跟踪与幻灯片翻页联动
│   │   ├── selection-mirror.ts         # 幻灯片点击反向高亮笔记块
│   │   └── debounce-controller.ts      # 输入防抖与频繁触发节流控制器
│   │
│   ├── ai/                             # AI 智能演示增强
│   │   ├── auto-splitter.ts            # AI 智能长文档分页切片建议
│   │   ├── auto-animator.ts            # AI 列表递进与动效智能推断
│   │   └── notes-generator.ts          # AI 演讲者口播提词卡生成
│   │
│   ├── synergy/                        # 外部插件协同
│   │   ├── property-manager-bridge.ts  # 与 siyuan-property-manager 属性管家桥接
│   │   └── preset-templates.ts         # 预设 Slidev 属性模板字典
│   │
│   └── types/                          # TypeScript 类型声明与协议规范
│       ├── slidev-protocol.ts          # 块属性常量 (custom-slidev-*)、AST 契约及前端协议
│       ├── ipc-messages.ts             # 沙箱与宿主之间 IPC 消息通道格式定义
│       ├── api.d.ts                    # 思源内核响应数据类型
│       └── index.d.ts                  # 全局环境与插件对象类型
│
├── tests/                              # 自动化测试套件 (Vitest)
│   ├── mocks/
│   │   └── siyuan.ts                   # 思源插件宿主环境轻量 Mock（支持纯 Node 离线测试）
│   ├── document-compiler.test.ts       # [RF-001] 文档编译编排与 IAL 解析独立单测
│   ├── inspector-state.test.ts         # [RF-002] Inspector 三态切换与数据模型单测
│   ├── clean-markdown.test.ts          # [RF-003] HTML 容器转换与标签清洗边界单测
│   ├── markdown-renderer.test.ts       # [RF-004] 导出 Markdown 块级渲染器通用单测
│   ├── compiler.test.ts                # AST 构建器与 IAL 解析单测
│   ├── compiler-importer.test.ts       # Slidev Markdown 导入综合集成测试
│   ├── asset-importer.test.ts          # 外部资源提取与解压测试
│   ├── export.test.ts                  # 离线单文件与 PDF 导出测试
│   ├── engine.test.ts                  # 双模渲染引擎切换与通信测试
│   ├── sync.test.ts                    # 光标联动与防抖控制测试
│   ├── synergy.test.ts                 # 属性管家桥接测试
│   ├── ai.test.ts                      # AI 分页与提词生成逻辑测试
│   ├── ui-lifecycle.test.ts            # 顶层生命周期冒烟测试
│   └── starter-demo-verify.test.ts     # 基础演示数据结构校验
│
├── package.json                        # 项目配置与 npm scripts
├── vite.config.ts                      # Vite 打包配置（构建多产物并打包 zip）
├── vitest.config.ts                    # Vitest 测试配置（集成 siyuan mock 别名）
├── tsconfig.json                       # TypeScript 配置
└── release.js                          # 插件发版辅助脚本
```

---

## 3. 重构前后职责边界演进

| 模块 | 重构前状况 | 重构后演进 | 收益 |
| :--- | :--- | :--- | :--- |
| **插件入口 (`src/index.ts`)** | 724 行，堆叠生命周期、命令注册、事件监听与编译编排 | 精简至 ~570 行，文档编译编排抽离至 `DocumentCompilerService` | 入口职责聚焦生命周期与事件分发，编译流程支持独立自动化单测 |
| **演示面板 (`src/ui/dock/`)** | 1078 行单文件，页面、块、全局三类配置交互强耦合 | 拆分为主容器 + 3 个子组件 (`PageInspectorSection`, `BlockInspectorSection`, `DocInspectorSection`) | 组件各司其职，状态流清晰，后续扩展新配置无需改动超长代码 |
| **Slidev 导入器 (`src/compiler/`)** | 1107 行单文件，包含近 400 行 HTML 标签清洗转换逻辑 | 抽离出 `src/compiler/html-cleaner.ts`，导入器聚焦 AST 映射 | 纯函数无状态模块，便于针对各种极端 HTML 标签增加覆盖测试 |
| **导出模块 (`src/export/`)** | HTML 与 PDF 导出器各自内联一套简易 Markdown 渲染逻辑 | 统一提取 `src/export/markdown-renderer.ts` 共享块级渲染模块 | 彻底消除重复渲染逻辑，保证离线 HTML 与 PDF 导出格式排版一致性 |
| **废弃样板与死代码** | 包含 0 引用的 `SlidevDockView.vue`、`App.vue` 及 `SiyuanTheme/` | 彻底清理删除 | 减少约 500 行废弃代码，降低认知负担与静态分析干扰 |
