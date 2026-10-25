# 思源笔记 Slidev 演示插件（SiYuan Slidev）规划方案文档库

本文档库收录了**基于开源 Slidev 打造的思源笔记一体化演示插件（SiYuan Slidev）**的可行性分析、同类竞品调研、系统架构方案、特性规划与技术实施路线。

---

## 目录索引

| 文档名称 | 核心主题 | 说明 |
| :--- | :--- | :--- |
| [1. 同类插件竞品深度分析与参考](./Joplin%20与%20Obsidian%20同类演示插件深度调研与参考.md) | 横向对比与痛点提炼 | 深入对比 Obsidian 与 Joplin 生态中的同类插件（Advanced Slides, Marp, Reveal.js 等），剖析优缺点，提炼核心差异化策略。 |
| [2. 可行性分析与系统架构设计](./思源笔记%20Slidev%20插件核心可行性分析与总体架构方案.md) | 技术可行性与架构落地 | 深入推演在思源环境下集成 Slidev 的运行瓶颈与解决方案，提出**双模渲染引擎架构**、**基于块属性的零污染元数据方案**以及**毫秒级双向光标联动机制**。 |
| [3. 关键特性规划与用户场景矩阵](./关键特性规划、使用场景与用户价值深度设计.md) | 功能规划与价值分析 | 结合思源笔记独特优势（块级细粒度、本地优先、开放 API、预置 AI Agent），梳理 5 大核心使用场景、用户价值模型及功能规格。 |
| [4. 技术规格定义与实施路线图](./技术规格定义、属性协议与实施路线图.md) | 数据协议与工程落地 | 详细定义 `custom-slidev-*` 块属性字典规范、AST 编译器管道、内部通信事件与四阶段研发里程碑（Roadmap）。 |
| [5. 详细方案与开发实施计划](./思源笔记%20Slidev%20演示插件详细方案、实施进展与下一步研发计划.md) | 模块拆解与敏捷排期 | 详细规划代码工程目录结构、各模块实现细节、与「属性管家」协同落地机制、8 周甘特排期与质量风控策略。 |
| [6. 用户使用指南 (中文)](./USER-GUIDE.zh-CN.md) | 终端用户操作手册 | 包含下方分屏预览页签、📌 Pin 图钉锁定、右侧动态配置面板、快捷键与离线导出全方位说明。 |
| [7. User Guide (English)](./USER-GUIDE.md) | User Guide | English user guide for split-screen presentation preview, right inspector dock, and exports. |
| [8. 演示能力差距分析与高频特性集成演进指南](./基于%20Slidev%20与%20Slidev-Templates%20源码生态的演示能力差距分析与高频特性集成演进指南.md) | 深度差距分析与演进规划 | 深度对比 Slidev 核心源码与 Slidev-Templates 生产级模版生态（Neko Style 等），全面剖析高频动效、版式、业务表达组件与播控差距，提供详细使用场景与工程级落地指南。 |
| [9. Slidev 演示文稿运行与效果查看实战指南](./Slidev%20演示文稿运行与效果查看实战指南%20——%20以%20slidev-templates%20项目为例.md) | 运行调试与效果查看手册 | 以 `slidev-templates` 模板为例，系统详解本地热重载预览、演讲者视图、总览大纲、离线打包与 PDF/PPTX 导出全流程。 |
| [10. 渲染引擎高保真重构与官方原版深度集成详细方案](./思源笔记%20Slidev%20插件：渲染引擎高保真重构与官方原版深度集成详细方案及开发计划.md) | 核心渲染升级与全阶段计划 | 针对内置渲染效果不足与官方原版集成可行性，规划“内置高保真沙箱 (Markdown-it + Shiki) + 桌面端官方原版 Pro 进程托管”双轨架构、技术规范与 6.5 周实施排期。 |
| [11. Pro 模式系统配置与环境搭建指导手册](./SiYuan%20Slidev%20Pro%20模式系统配置与用户指南.md) | 原生 Pro 极客引擎配置 | 详细指导本机本地环境（Node.js、Slidev CLI、全局依赖）快速配置与健康校验，剖析沙箱模式与 Pro 原生模式的无缝切换与高阶玩法。 |
| [12. Git Worktree 并发开发规范与操作指南](./Git%20Worktree%20并发开发规范与操作指南.md) | 并发开发与分支隔离 | 详细指导如何利用 Git Worktree 实现多功能分支并发开发与独立调试，保障代码质量与规范。 |
| [13. Slidev 演示文档导入方案与架构设计规范](./Slidev%20演示文档导入方案与架构设计规范.md) | 外部 Markdown 导入与清洗 | 系统详解解析外部 Slidev Markdown 并清洗、转换 HTML 容器与网格版式导入思源的规范与架构实现。 |
| [14. 项目架构与目录结构说明](./project-structure.md) | 模块分层与工程目录 | 详细介绍 siyuan-slidev 项目的代码组织架构、核心模块职责分工与底层管道通信设计。 |
| [15. 速览微浏览器 SPA 跳页 404 案例分析与 Webview src 绑定避坑指南](./速览微浏览器%20SPA%20跳页%20404%20案例分析与%20Webview%20src%20绑定避坑指南.md) | 隐藏 bug 复盘与契约速查 | 复盘"SPA 站点次级页短暂显示后变 Netlify 404"的三重根因（响应式 src 绑定 × Electron src 属性契约 × 站点无 SPA fallback），沉淀 webview 导航契约速查表。 |

---

## 项目核心愿景

> **“让笔记即是演示，让演讲回归内容；零污染元数据沉淀，现代前端级酷炫视觉呈现。”**

传统笔记做演示往往面临**“要么排版极简丑陋、要么正文被大量宏与注释严重污染、离开插件无法阅读”**的尴尬境地。
**SiYuan Slidev** 深度依托思源笔记底层的**块级架构（Block Architecture）**与**块属性系统（Block Attributes）**，将现代前端最先进的组件化演示框架 **Slidev** 引入思源生态：
- **正文纯净可读**：所有版式、动画、高亮、演讲备注完全存储于思源块属性中，Markdown 正文 0 污染；
- **现代前端动效**：原生继承 Slidev 的 UnoCSS、Vue SFC 组件、Shiki 逐行代码高亮与动态 `v-click` / `v-motion` 动效；
- **丝滑双向联动**：上方编辑笔记，下方宽屏分屏即时预览与右侧情境配置，光标所至即为所讲；
- **AI 智能加速**：结合思源预置 AI Agent，一键实现长文智能分页、演讲词提炼与动效智能填充。

## 附录：相关项目源码

Slidev: D:\MyCodingProjects\slidev

Slidev Templates: D:\MyCodingProjects\slidev-templates

siyuan-property-manager: D:\MyCodingProjects\siyuan-property-manager

siyuan-note: D:\MyCodingProjects\siyuan-note
