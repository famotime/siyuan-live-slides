# 项目架构与目录结构 (Project Structure)

> 最近刷新：2026-11-20（Phase 5 重构 RF-026 ~ RF-030 完成后，随代码模块解耦同步核对）

## 1. 架构概览

`siyuan-live-slides` 是专为思源笔记 (SiYuan Note) 打造的现代化幻灯片演示插件。
项目核心架构遵循"**数据单向编排、业务高度解耦、视图轻量装配、测试优先保障**"的设计哲学：
- **插件入口与命令调度层 (`src/index.ts`, `src/plugin/`)**：轻量生命周期管理，解耦 12+ 项命令注册、Protyle 事件分发与预览页签标题服务。
- **编译器管线 (`src/compiler/`)**：负责思源块 AST、IAL 自定义属性字典、双向块引用与 Slidev Markdown 规范之间的双向转换与编排。
- **双向联动与状态同步中枢 (`src/sync/`)**：高内聚协调 Protyle DOM 选区跟踪、前置分页符反查、列表属性自愈、双向毫秒级光标定位与编译消费者门闩（预览页签与 Dock 面板全部不可见时自动暂停编译请求）。
- **双模渲染引擎 (`src/engine/`)**：封装内置纯前端 Web 沙箱（零依赖开箱即用）与本地 Slidev Pro CLI 桥接引擎。
- **导出管线 (`src/export/`)**：模板样式生成器、按功能分节的离线播放器客户端运行时与轻量 Markdown 块级渲染器高度模块化解耦，支持单文件离线 HTML 与 16:9 PDF 演示讲义导出。
- **视图展示层 (`src/ui/`)**：采用组合式架构，演示配置面板拆解为页面、块、全局三大高内聚子组件；Actions 业务按领域（属性持久化 / 备注与 AI / 版式与元素指令）分层装配；并包含沉浸速览 (peek) 子系统的 Webview / Protyle 双抽屉组件。
- **通用工具层 (`src/utils/`)**：规范统一导出 Markdown 提取、列表项清洗、类型判定与 peek URL 解析纯函数，杜绝跨子系统深层侵入式依赖。

---

## 2. 核心模块与文件清单

```text
d:\MyCodingProjects\siyuan-live-slides
├── docs/                                   # 项目文档库（三类：现行文档 / 设计存档 / 规划期存档，索引见 docs/README.md）
│   ├── project-structure.md                # 项目最新架构与模块映射（本文件）
│   ├── 技术规格定义.md                      # custom-slides-* 块属性协议字典（与 types/slides-protocol.ts 对齐）
│   ├── 思源笔记即现插件详细方案、实施进展与下一步研发计划.md   # 交付进展总览与研发排期
│   ├── refactor-plan.md                    # 重构计划与执行日志 (RF-001 ~ RF-030)
│   ├── USER-GUIDE.zh-CN.md / USER-GUIDE.md # 中英文用户使用指南
│   └── ...                                 # 其余设计存档与规划期存档（完整索引见 docs/README.md）
├── src/                                    # 插件源码目录
│   ├── index.ts                            # [RF-007, RF-019, RF-024] 插件入口主类（聚焦生命周期、编译调度与顶层协调，682 行）
│   ├── main.ts                             # 前端挂载辅助入口（预览页签与 Dock 面板实例管理、编译消费者注册）
│   ├── api.ts                              # [RF-020] 思源内核 API 精简封装（仅保留 16 个在用接口，215 行）
│   ├── settings.ts                         # 全局设置读写与运行时配置
│   ├── index.scss                          # 全局样式（含 spm 与 slidev 视觉变量）
│   │
│   ├── plugin/                             # 插件扩展服务层
│   │   ├── command-registry.ts             # [RF-007] 插件命令注册表（集中调度 12+ 项指令与快捷操作回调）
│   │   ├── preview-tab-title.ts            # [RF-019] 预览页签标题服务（即现标题构造、文档标题三级解析、Pin 联动更新）
│   │   ├── api-switch-bridge.ts            # [RF-024] 外部 API 切换器桥接服务（siyuan-api-switch 全局事件监听与双向同步）
│   │   └── preview-window-manager.ts       # [RF-024] 预览页签、演讲者双屏与独立窗口拉起管理服务
│   │
│   ├── compiler/                           # 编译与导入管线
│   │   ├── document-compiler.ts            # [RF-001] 文档编译编排服务（AST 获取、IAL 解析、块引解析、沙箱推送）
│   │   ├── directive-wrapper.ts            # [RF-009] 指令包装器（Frontmatter 序列化、v-click/v-motion 生成、Shiki 聚光注入、三栏分配）
│   │   ├── slides-ast-builder.ts           # [RF-009] 思源块 AST 到 Slidev 幻灯片数据模型构建器
│   │   ├── slides-importer.ts              # [RF-003, RF-013] Slidev 导入器主服务（幻灯片切片与思源 AST 映射）
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
│   │   ├── inspector-sync-cache.ts         # Inspector 同步节流缓存
│   │   ├── compile-scheduler.ts            # 编译排程器（单飞合并与过期结果丢弃）
│   │   ├── compile-consumer-gate.ts        # 编译消费者门闩（预览页签/Dock 可见性决定是否发起编译请求）
│   │   ├── cursor-tracker.ts               # 编辑器光标定位跟踪与幻灯片翻页联动
│   │   ├── selection-mirror.ts             # 幻灯片点击反向高亮笔记块
│   │   ├── dom-attr-sync.ts                # Protyle 编辑器 DOM 自定义属性轻量同步
│   │   └── debounce-controller.ts          # 输入防抖与频繁触发节流控制器
│   │
│   ├── engine/                             # 双模渲染引擎
│   │   ├── engine-manager.ts               # 双模引擎统一调度中枢（高保真沙箱 vs. 原生 Pro CLI）
│   │   ├── env-detector.ts                 # 跨平台环境探测器（检测 Node.js 与全局 Slidev CLI）
│   │   ├── process-manager.ts              # 桌面端 Node 子进程生命周期守护、端口分配与健康探活
│   │   ├── runtime-node.ts                 # 宿主 Node 运行时探测与桥接
│   │   ├── workspace-scaffolder.ts         # 官方 Slidev 临时工程脚手架自动编排器
│   │   ├── native-slides-bridge.ts         # 官方 Slidev 原生通信适配桥接器（基于 ?embedded=true 规范）
│   │   ├── web-sandbox-bridge.ts           # 内置 Web 沙箱通信桥接器（postMessage 双向通信）
│   │   ├── cli-devserver-bridge.ts         # 本地 Slidev CLI 基础开发服务器桥接（默认端口 3030）
│   │   └── v-click-resolver.ts             # 页面级与块级 v-click 步数聚合计算器
│   │
│   ├── export/                             # 导出与打印管线
│   │   ├── markdown-renderer.ts            # [RF-004, RF-012] 通用轻量级 Markdown 块级转 HTML 渲染器门面
│   │   ├── visual-list-renderer.ts         # [RF-012] 卡片网格、时间线、步骤等富列表渲染器
│   │   ├── slide-layout-renderer.ts        # [RF-012] 幻灯片页面版式容器分发器（两栏/三栏/图文/全屏等）
│   │   ├── single-html-exporter.ts         # [RF-006] 离线单文件 HTML 打包导出中枢（专注于 Base64 资产内联与骨架装配）
│   │   ├── standalone-template-styles.ts   # [RF-006, RF-022] 独立单文件 HTML 样式生成器（1292 行，复用 shared-layout 与 extra 样式）
│   │   ├── standalone-client-runtime.ts    # [RF-006, RF-018] 离线播放器运行时拼装入口（29 行，按分节拼装）
│   │   ├── styles/                         # [RF-022] 导出样式公共与扩展模块
│   │   │   ├── shared-layout-styles.ts     # Fact、Timeline/Steps、Quote、Intro 共享版式 CSS 生成器
│   │   │   └── standalone-extra-styles.ts  # 灯箱、动态蒙版、微动效与控制按钮等单文件专用 CSS 生成器
│   │   ├── standalone-runtime-sections/    # [RF-018] 播放器运行时功能分节（输出与拆分前字节级一致，快照基线保障）
│   │   │   ├── core-state.ts               # IIFE 开启、播放数据与核心 DOM 引用、跳页角标样式注入
│   │   │   ├── overview-dom.ts             # 缩略图总览层 DOM 骨架与常量
│   │   │   ├── navigation-helpers.ts       # 缩放适配、遮罩比例解析与翻页导航助手
│   │   │   ├── block-rendering.ts          # 块级 Markdown 清洗与单块 HTML 渲染
│   │   │   ├── slide-rendering.ts          # 整页幻灯片装配渲染与版式容器分发
│   │   │   ├── lightbox.ts                 # 图片/视频灯箱放大与关闭
│   │   │   ├── jump-badge.ts               # 「数字+回车」跳页角标状态机
│   │   │   ├── overview-layer.ts           # 缩略图总览层构建、焦点导航与键盘交互
│   │   │   └── keyboard-scroll-init.ts     # 滚轮/键盘事件处理与启动初始化
│   │   ├── pdf-exporter.ts                 # [RF-004, RF-011] 16:9 横版高分辨率打印与 PDF 导出器
│   │   └── pdf-template-styles.ts          # [RF-011, RF-022] 独立 PDF 打印样式表生成器（1288 行，复用 shared-layout 样式）
│   │
│   ├── ui/                                 # 用户界面组件层 (Vue 3)
│   │   ├── dock/
│   │   │   ├── SlidesInspectorDockView.vue # [RF-002, RF-008, RF-017, RF-023, RF-027] 演示配置主容器 Dock 视图（812 行，活动块查找收敛至 Composable）
│   │   │   ├── useInspectorActions.ts      # [RF-008, RF-016] Actions 统一门面（装配三领域模块，86 行）
│   │   │   ├── useInspectorPageOverrides.ts # [RF-017] 分页符页面属性三级查找工厂（直接属性 → 覆写层 → frontmatter）
│   │   │   ├── useSuperBlockInspector.ts   # [RF-023] 超级块 DOM 几何列宽与 AST 兜底推断、当前页超级块扫描与块多选监听
│   │   │   ├── useActiveBlockState.ts      # [RF-027] 活动块单点查找与六类属性派生（click/motion/anim/animProps/content/slot，IAL > 容器回退 > 编译模型）
│   │   │   └── actions/                    # [RF-016] Inspector Actions 领域模块
│   │   │       ├── attr-persistence.ts     # 属性持久化（saveAttrs/savePageAttr/saveDocAttr + 父容器联动 + frontmatter 即时更新）
│   │   │       ├── notes-actions.ts        # 备注与 AI（讲稿块创建/转换/定位、AI 提词、批量追加/删除）
│   │   │       └── layout-actions.ts       # 版式与元素指令（视频开关、图片角色、slot/Shiki、分割线、四叶草）
│   │   ├── components/
│   │   │   ├── PageInspectorSection.vue    # [RF-002, RF-029] 页面级配置子面板（831 行，蒙版与分栏比例领域抽离至 Composable）
│   │   │   ├── BlockInspectorSection.vue   # [RF-002, RF-026] 块级配置子面板（810 行，动效与插槽领域抽离至 Composable）
│   │   │   ├── DocInspectorSection.vue     # [RF-002] 全局文档级配置子面板（主题、画幅比例、AI 工具箱、快速操作）
│   │   │   ├── useBlockMotionSection.ts    # [RF-026] 块级动效领域 Composable（入场/强调/文本动效解析变更、CountUp 推导、试播舞台）
│   │   │   ├── useBlockSlotSection.ts      # [RF-026] 块级多栏插槽领域 Composable（版式判定、分栏数三来源探测、插槽清单与激活互认）
│   │   │   ├── usePageMaskControls.ts      # [RF-029] 页面蒙版领域 Composable（时钟/线性形态判定、比例升降级联动）
│   │   │   ├── usePageColumnRatio.ts       # [RF-029] 页面分栏比例领域 Composable（栏数五来源探测、手工指定、预设矩阵、等分重置）
│   │   │   ├── column-ratio.ts             # [RF-029] 分栏比例共享解析工具（段数解析 2~6、等分比例生成，块级与页面级复用）
│   │   │   ├── SlideInspector.vue          # 幻灯片大纲导航微调器
│   │   │   ├── LayoutPicker.vue            # 布局版式选择器组件
│   │   │   ├── TransitionSelector.vue      # 转场过渡动效选择器组件
│   │   │   ├── MotionSelector.vue          # 入场微动效可视化选择器组件（即时试播舞台 + 动效轨迹卡片网格 + 时长延迟参数）
│   │   │   ├── motion-presets.ts           # 入场微动效（v-motion）预设定义与时长延迟选项
│   │   │   ├── ElementAnimBar.vue          # 元素级动画快捷操作条
│   │   │   ├── QuickDividerPopover.vue     # 原生分割线悬浮快捷菜单
│   │   │   ├── SlidesImportDialog.vue      # [RF-015] Slidev 项目导入对话框（精简聚焦 UI 交互与预检卡片）
│   │   │   ├── useSlidesImport.ts          # [RF-015] 导入编排 Composable（资产上传、新建文档、属性注入与分屏联动）
│   │   │   ├── SlidesIcon.vue              # 幻灯片 SVG 图标组件
│   │   │   └── peek/                       # 沉浸速览子系统（外链/文档原位速览）
│   │   │       ├── WebviewPeekDrawer.vue   # [RF-030] 网页 Webview 速览抽屉（852 行，缩放/导航/持久化抽离至领域模块）
│   │   │       ├── peek-webview-utils.ts   # [RF-030] 微型浏览器纯函数工具（视图模式持久化、Chromium 网络错误中文文案映射）
│   │   │       ├── useWebviewPeekControls.ts # [RF-030] 微型浏览器控制 Composable（缩放状态机 0.5~2.5、导航委托）
│   │   │       ├── ProtylePeekDrawer.vue   # 思源文档 Protyle 原位速览抽屉
│   │   │       └── ImmersionDrawerContainer.vue # 沉浸抽屉容器（遮罩与滚动锁定）
│   │   ├── tab/
│   │   │   ├── SlidesPreviewTab.vue        # [RF-028] 下方分屏实时演示放映页签（759 行，导出编排与速览抽屉状态抽离至 Composable）
│   │   │   ├── usePreviewExport.ts         # [RF-028] 导出编排 Composable（HTML/PDF/图片 ZIP/当前页/剪贴板五类动作，服务注入可测）
│   │   │   ├── usePeekDrawerState.ts       # [RF-028] 速览抽屉状态机 Composable（双通道状态迁移、文档块 SQL 探测注入化）
│   │   │   ├── SlidesPresenterTab.vue      # [RF-021] 演讲者双屏控制台主视图（724 行，主控界面与缩略图渲染）
│   │   │   ├── SlidesPresenterTab.scss     # [RF-021] 演讲者控制台 SCSS 样式（1292 行）
│   │   │   ├── SlidesPresenterThumbnail.scss # [RF-021] 演讲者幻灯片缩略图 SCSS 样式（825 行）
│   │   │   ├── usePresenterTimer.ts        # [RF-021] FSM-8 绝对时间戳防漂移计时器与时钟逻辑 Composable
│   │   │   ├── usePresenterSync.ts         # [RF-021] 跨窗口 BroadcastChannel 广播与 WebSandboxBridge 页面同步 Composable
│   │   │   └── page-jump-input.ts          # 「数字+回车」跳页输入状态机
│   │   └── popover-manager.ts              # 悬浮弹层与气泡位置计算管理
│   │
│   ├── utils/                              # [RF-010] 通用跨域工具函数层
│   │   ├── index.ts                        # 工具层统一出口门面
│   │   ├── markdown-utils.ts               # Markdown 纯文本提取（图片 URL、列表项前缀清洗、列表节点类型判定）
│   │   └── peek-url.ts                     # peek 速览 URL 解析、本地 HTML 与代理会话判定
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
│       ├── slides-protocol.ts              # 块属性常量 (custom-slides-*)、AST 契约及前端协议
│       ├── ipc-messages.ts                 # 沙箱与宿主之间 IPC 消息通道格式定义
│       ├── api.d.ts                        # 思源内核响应数据类型
│       └── index.d.ts                      # 全局环境与插件对象类型
│
├── tests/                                  # 自动化测试套件 (Vitest, 106 个测试文件，1047 项用例全绿)
│   ├── mocks/
│   │   └── siyuan.ts                       # 思源插件宿主环境轻量 Mock（支持纯 Node 离线测试）
│   ├── __fixtures__/
│   │   └── standalone-runtime-baseline.txt # [RF-018] 离线播放器运行时字节级快照基线
│   ├── command-registry.test.ts            # [RF-007] 插件命令注册表独立单测
│   ├── inspector-sync-coordinator.test.ts  # [RF-007] 前置分页符反查与属性自愈独立单测
│   ├── inspector-actions.test.ts           # [RF-008] Inspector Actions 门面级回归
│   ├── inspector-actions-domains.test.ts   # [RF-016] 三大领域模块（属性持久化/备注/版式）直接单测
│   ├── inspector-page-overrides.test.ts    # [RF-017] 分页符属性三级查找工厂单测
│   ├── inspector-superblock-detector.test.ts # [RF-023] 超级块 DOM 列宽解析与 AST 回退单测
│   ├── standalone-runtime-sections.test.ts # [RF-018] 运行时分节快照基线与拼装一致性测试
│   ├── preview-tab-title.test.ts           # [RF-019] 预览页签标题服务（门面委托 + 模块直测）
│   ├── presenter-timer.test.ts             # [RF-021] 演讲者计时器状态机与防休眠漂移单测
│   ├── presenter-sync.test.ts              # [RF-021] 演讲者跨窗口广播同步单测
│   ├── export-styles-golden.test.ts        # [RF-022] 导出样式规则快照与共享版式金样测试
│   ├── api-switch-bridge.test.ts           # [RF-024] 外部 API 切换器桥接单测
│   ├── feature-flags.test.ts               # [RF-025] 构建期细粒度版式与功能开关单测
│   ├── use-block-motion-section.test.ts    # [RF-026] 块级动效领域单测（解析/乐观更新/试播舞台）
│   ├── use-block-slot-section.test.ts      # [RF-026] 块级多栏插槽领域单测（栏数探测/插槽互认）
│   ├── use-active-block-state.test.ts      # [RF-027] 活动块单点查找与六类属性派生单测
│   ├── use-preview-export.test.ts          # [RF-028] 预览页签导出编排单测（防重入/文件名派生/剪贴板回退）
│   ├── use-peek-drawer-state.test.ts       # [RF-028] 速览抽屉状态机单测（双通道迁移/SQL 探测回退）
│   ├── use-page-mask-controls.test.ts      # [RF-029] 页面蒙版领域单测（时钟/线性联动）
│   ├── use-page-column-ratio.test.ts       # [RF-029] 页面分栏比例领域单测（五来源探测/预设矩阵）
│   ├── webview-peek-controls.test.ts       # [RF-030] 微型浏览器缩放导航与持久化单测
│   ├── peek-proxy-session.test.ts / peek-local-html.test.ts / immersion-peek.test.ts # peek 速览子系统
│   ├── export.test.ts / pdf-template-styles.test.ts # 导出管线
│   ├── compiler*.test.ts / list-*.test.ts / superblock-*.test.ts # 编译器管线
│   ├── engine.test.ts / process-manager.test.ts / native-slides-bridge.test.ts # 双模引擎
│   └── ...                                 # 其余 50+ 个专项领域回归测试用例
│
├── package.json                            # 项目配置与 npm scripts
├── vite.config.ts                          # Vite 打包配置（单入口构建并打包 zip）
├── vitest.config.ts                        # Vitest 测试配置（集成 siyuan mock 别名）
├── tsconfig.json                           # TypeScript 配置
└── release.js                              # 插件发版辅助脚本
```

---

## 3. 重构演进对照表 (RF-001 ~ RF-030)

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
| **YAML 解析与代码切片展开 (RF-013)** | `slides-importer.ts` (877 行) 混杂 210 行 YAML 状态机与切片展开器 | 抽离 `src/compiler/frontmatter-parser.ts`，主导入器精简至 494 行 | YAML 状态机纯函数隔离并具备全方位边界测试，代码切片提取解耦 |
| **多栏列表超级块扫描解耦 (RF-014)** | `superblock-scanner.ts` (789 行) 混杂图文扫描与复杂列表分栏状态机 | 抽离 `src/compiler/list-column-scanner.ts`，原文件保留图文扫描与门面 | 列表超级块槽位分配与图文角色推断独立解耦，单向依赖清晰 |
| **Slidev 导入弹窗业务解耦 (RF-015)** | `SlidesImportDialog.vue` (875 行) `<script setup>` 堆叠 300+ 行内核调用 | 抽取 `src/ui/components/useSlidesImport.ts`，对话框精简至仅负责 UI | 业务编排与 Vue 视图完全解耦，支持 Composable 级与端到端自动化测试 |
| **Inspector Actions 领域分层 (RF-016)** | `useInspectorActions.ts` (1170 行) 三大领域 30 个函数挤在单一作用域 | 拆分为 `actions/attr-persistence.ts`、`actions/notes-actions.ts`、`actions/layout-actions.ts` + 86 行统一门面 | 各领域可独立演进与单测；saveAttr/saveAttrs 逐行等价逻辑合并为薄包装 |
| **Dock 视图覆写查询收敛 (RF-017)** | `SlidesInspectorDockView.vue` 中三级属性查找模式重复 7 处（5 个 computed 各 ~20 行） | 抽取 `useInspectorPageOverrides.ts` computed 工厂，视图精简至 903 行 | 查找优先级（defined/truthy 两模式）单点维护，新增页面属性只需 4 行声明 |
| **离线播放器运行时分节 (RF-018)** | `standalone-client-runtime.ts` (1434 行) 单模板字符串内嵌 35 个 JS 函数，不可测 | 拆分为 9 个功能分节模块 + 29 行拼装入口，快照基线证明输出字节级一致 | 运行时功能（总览/跳页/灯箱/渲染）可独立维护，回归有 golden master 保障 |
| **预览页签标题服务 (RF-019)** | 标题构造/解析/更新 ~110 行内联在插件入口类中 | 抽离 `src/plugin/preview-tab-title.ts`（宿主接口 + 纯函数），入口精简至 624 行 | 标题三级解析（DOM → 编译模型 → SQL）独立可测，入口回归生命周期编排 |
| **内核 API 死代码清理 (RF-020)** | `api.ts` (622 行) 含 46 个官方模板残留零引用导出；`kernel.ts` (221 行) echo 示例挂在构建入口 | 精简至 215 行 / 16 个在用接口；删除 `kernel.ts` 并清理 vite 入口 | API 门面检索零噪音，构建产物仅 index.js，消除示例代码误用风险 |
| **演讲者视图巨石解耦 (RF-021)** | `SlidesPresenterTab.vue` (2892 行) 内嵌 2073 行 SCSS 与混杂计时器、广播同步、缩略图多重逻辑 | 抽离外部样式 `SlidesPresenterTab.scss` 与 `SlidesPresenterThumbnail.scss`；抽离 `usePresenterTimer.ts` 与 `usePresenterSync.ts`，主组件精简至 724 行 | 界面样式独立维护，防休眠漂移计时器与跨窗口广播具备领域单测保障 |
| **导出模板样式去重与模块化 (RF-022)** | `standalone-template-styles.ts` (2242 行) 与 `pdf-template-styles.ts` (1484 行) 高度重复 | 抽取 `src/export/styles/shared-layout-styles.ts` 与 `standalone-extra-styles.ts`，两端分别精简至 ~1290 行 | 消除 ~1200+ 行重复 CSS 规则，新增版式零分叉，新增 golden master 快照测试 |
| **侧栏超级块探测与多选解耦 (RF-023)** | `SlidesInspectorDockView.vue` lines 450~609 混杂 DOM 几何列宽与 AST 回退计算 | 抽取 `src/ui/dock/useSuperBlockInspector.ts`，主视图精简至 808 行（净减 181 行） | 几何列宽比例计算逻辑独立纯粹并具备 7 项专项单测，Dock 视图专注交互装配 |
| **插件入口服务桥接解耦 (RF-024)** | `src/index.ts` 混杂 70 行 `siyuan-api-switch` 事件同步与 100 行页签窗口管理 | 抽离 `src/plugin/api-switch-bridge.ts` 与 `preview-window-manager.ts`，入口精简至 682 行（净减 147 行） | 外部插件桥接与窗口管理解耦，生命周期调度更清晰，新增独立单测 |
| **特性开关与测试基线修复 (RF-025)** | `src/feature-flags/feature-flags.ts` 未导出常量，单测硬编码断言全 true 与配置冲突 | 规范导出 `FEATURE_FLAGS` 常量，修正 `tests/feature-flags.test.ts` 断言逻辑 | 消除基线唯一红灯，测试套件恢复 100% 全绿基准 |
| **块级动效 Inspector 领域解耦 (RF-026)** | `BlockInspectorSection.vue` (1245 行) 脚本混杂分栏 slot、入场/强调/文本动效、试播舞台四类职责，且内置与 `motion-presets.ts` 完全重复的本地预设死代码数组 | 抽离 `useBlockMotionSection.ts`（动效解析/变更/试播舞台）与 `useBlockSlotSection.ts`（插槽领域），删除重复预设数组，主组件精简至 810 行（净减 435 行） | 动效解析与乐观试播具备 46 项领域单测；新增预设只需维护 motion-presets 单一来源 |
| **Dock 主视图重复块查找收敛 (RF-027)** | `SlidesInspectorDockView.vue` 中 6 处 computed 各自重复 `blocks.find(b => b.id === ...)` 查找与 IAL/编译模型回退语义 | 抽取 `useActiveBlockState.ts` 单点查找（matchedBlock）与六类属性派生，视图精简至 812 行 | 属性读取优先级（IAL > 容器回退 > 编译模型）单点维护，具备 15 项专项单测 |
| **预览页签导出与抽屉解耦 (RF-028)** | `SlidesPreviewTab.vue` (883 行) 脚本混杂五类导出编排与速览抽屉双通道状态机 | 抽离 `usePreviewExport.ts`（服务注入可测）与 `usePeekDrawerState.ts`（SQL 文档块探测注入化），页签精简至 759 行 | 导出防重入/文件名派生/剪贴板回退与抽屉状态迁移均具备领域单测 |
| **页面 Inspector 蒙版与比例抽离 (RF-029)** | `PageInspectorSection.vue` (949 行) 蒙版方向联动与分栏比例五来源探测内嵌视图，与块级插槽存在相似 ratio 解析 | 抽离 `usePageMaskControls.ts` 与 `usePageColumnRatio.ts`，新建 `column-ratio.ts` 共享解析工具并复用至 `useBlockSlotSection`，视图精简至 831 行 | 比例段数解析单一实现跨块级/页面级复用，蒙版与比例领域各具备专项单测 |
| **Peek 微型浏览器控制解耦 (RF-030)** | `WebviewPeekDrawer.vue` (961 行) 视图模式持久化、网络错误文案、缩放状态机与导航委托内嵌组件 | 抽离 `peek-webview-utils.ts` 纯函数模块与 `useWebviewPeekControls.ts`（缩放 0.5~2.5 + 导航委托），组件 re-export 保持 import 兼容，精简至 852 行 | 纯函数可在纯 Node 环境直测，缩放边界与导航委托具备 12 项专项单测 |
