# 思源笔记 Slidev 演示插件（SiYuan Slidev）规划方案文档库

本文档库收录了**基于开源 Slidev 打造的思源笔记一体化演示插件（SiYuan Slidev）**的可行性分析、同类竞品调研、系统架构方案、特性规划与技术实施路线。

---

## 目录索引

| 文档名称 | 核心主题 | 说明 |
| :--- | :--- | :--- |
| [1. 同类插件竞品深度分析与参考](file:///d:/MyCodingProjects/siyuan-slidev/docs/competitive-analysis-joplin-obsidian.md) | 横向对比与痛点提炼 | 深入对比 Obsidian 与 Joplin 生态中的同类插件（Advanced Slides, Marp, Reveal.js 等），剖析优缺点，提炼核心差异化策略。 |
| [2. 可行性分析与系统架构设计](file:///d:/MyCodingProjects/siyuan-slidev/docs/slidev-plugin-feasibility-and-architecture.md) | 技术可行性与架构落地 | 深入推演在思源环境下集成 Slidev 的运行瓶颈与解决方案，提出**双模渲染引擎架构**、**基于块属性的零污染元数据方案**以及**毫秒级双向光标联动机制**。 |
| [3. 关键特性规划与用户场景矩阵](file:///d:/MyCodingProjects/siyuan-slidev/docs/features-and-use-cases.md) | 功能规划与价值分析 | 结合思源笔记独特优势（块级细粒度、本地优先、开放 API、预置 AI Agent），梳理 5 大核心使用场景、用户价值模型及功能规格。 |
| [4. 技术规格定义与实施路线图](file:///d:/MyCodingProjects/siyuan-slidev/docs/technical-specification-and-roadmap.md) | 数据协议与工程落地 | 详细定义 `custom-slidev-*` 块属性字典规范、AST 编译器管道、内部通信事件与四阶段研发里程碑（Roadmap）。 |
| [5. 详细方案与开发实施计划](file:///d:/MyCodingProjects/siyuan-slidev/docs/implementation-plan-and-development-schedule.md) | 模块拆解与敏捷排期 | 详细规划代码工程目录结构、各模块实现细节、与「属性管家」协同落地机制、8 周甘特排期与质量风控策略。 |

---

## 项目核心愿景

> **“让笔记即是演示，让演讲回归内容；零污染元数据沉淀，现代前端级酷炫视觉呈现。”**

传统笔记做演示往往面临**“要么排版极简丑陋、要么正文被大量宏与注释严重污染、离开插件无法阅读”**的尴尬境地。
**SiYuan Slidev** 深度依托思源笔记底层的**块级架构（Block Architecture）**与**块属性系统（Block Attributes）**，将现代前端最先进的组件化演示框架 **Slidev** 引入思源生态：
- **正文纯净可读**：所有版式、动画、高亮、演讲备注完全存储于思源块属性中，Markdown 正文 0 污染；
- **现代前端动效**：原生继承 Slidev 的 UnoCSS、Vue SFC 组件、Shiki 逐行代码高亮与动态 `v-click` / `v-motion` 动效；
- **丝滑双向联动**：左侧编辑笔记，右侧毫秒级响应式预览，光标所至即为所讲；
- **AI 智能加速**：结合思源预置 AI Agent，一键实现长文智能分页、演讲词提炼与动效智能填充。

## 附录：相关项目源码

Slidev: D:\MyCodingProjects\slidev

siyuan-property-manager: D:\MyCodingProjects\siyuan-property-manager
