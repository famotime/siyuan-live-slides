# 思源笔记即现插件（SiYuan Live Slides）文档库

本文档库收录**基于开源 Slidev 打造的思源笔记一体化演示插件（SiYuan Live Slides）**的架构说明、属性协议规格、用户指南、方案设计与研发存档。

> 文档分为三类：**现行文档**（与代码同步刷新，作为开发与使用的权威依据）、**设计存档**（记录已交付特性的方案设计动机与技术决策，实现细节以代码与 project-structure 为准）、**规划提案**（尚未实施或已随架构演进调整的设计推演，保留决策脉络）。

---

## 目录索引

### 现行文档（随代码同步刷新）

| 文档名称 | 核心主题 | 说明 |
| :--- | :--- | :--- |
| [项目架构与目录结构说明](./project-structure.md) | 模块分层与工程目录 | 详细介绍 siyuan-live-slides 项目的代码组织架构、核心模块职责分工、重构演进对照表 (RF-001 ~ RF-020) 与测试基线。 |
| [技术规格定义：块属性协议字典](./技术规格定义.md) | 数据协议与契约 | 与 `src/types/slides-protocol.ts` 对齐的 `custom-slides-*` 属性字典（文档 / 页面 / 元素三层）、版式枚举体系、动态蒙版分段解析规则与编译运行时契约速查。 |
| [同步链路状态机审计](./state-machine-audit.md) | 状态机与生命周期审计 | 预览/演讲者/Dock 消费者、编译调度与异步代际卫的状态机治理审计与修复记录。 |
| [重构计划与执行日志](./refactor-plan.md) | 重构决策与验证记录 | RF-001 ~ RF-020 三阶段模块解耦的完整决策、执行与验证日志（已全部闭环）。 |
| [用户使用指南 (中文)](./USER-GUIDE.zh-CN.md) | 终端用户操作手册 | 分屏预览、放映交互（滚轮 / 数字跳页 / 缩略图总览）、沉浸速览、动态蒙版、多栏与四叶草版式、演讲者视图与离线导出说明。 |
| [User Guide (English)](./USER-GUIDE.md) | User Guide | English mirror of the user guide: split-screen preview, playback shortcuts, immersive peek, page masks, layouts and exports. |
| [幻灯片页面版式使用指南](./幻灯片页面版式使用指南.md) | 页面版式速查 | 各页面版式（封面、图文、多栏、四叶草、时间轴等）的适用场景与 IAL 配置写法。 |
| [思源笔记即现演示插件能力差距分析与演进规划](./思源笔记即现演示插件能力差距分析与演进规划.md) | 差距分析与演进路线 | 对标 Slidev 能力集的差距盘点与演进规划；条目落地状态以 CHANGELOG 与代码为准。 |

### 设计存档（已交付特性的方案设计）

| 文档名称 | 对应交付 | 说明 |
| :--- | :--- | :--- |
| [灵活演示动效与微动画系统设计方案](./灵活演示动效与微动画系统设计方案.md) | 微动效体系（已交付） | CountUp 数字翻滚、打字机、脉冲/悬浮/流光等微动效的设计推演与 IAL 属性约定。 |
| [沉浸式演示外链与思源文档原位速览方案设计](./reference/沉浸式演示外链与思源文档原位速览方案设计.md) | peek 子系统（已交付） | 沉浸速览抽屉的架构设计：Webview / Protyle 双抽屉、遮罩与滚动锁定、链接解析分流。实现演进（本地 HTML 原位渲染、代理适配、SPA 免重载）见速览 404 案例文档。 |
| [表头多栏内组件级逐步呈现与级联调度方案设计](./reference/表头多栏内组件级逐步呈现与级联调度方案设计.md) | `cols-header` 动效体系（已交付） | 表头多栏版式内组件级 `v-click` 逐步呈现与主容器级联防倒置调度的设计推演。 |
| [Slidev 演示文档导入方案与架构设计规范](./reference/Slidev%20演示文档导入方案与架构设计规范.md) | 导入管线（已交付） | 外部 Slidev Markdown 解析、YAML Frontmatter 状态机、HTML 容器清洗转换与资产重写的架构规范（实现随 RF-013/RF-015 进一步解耦）。 |

### 规划提案（未实施或设计推演）

| 文档名称 | 状态 | 说明 |
| :--- | :--- | :--- |
| [演示交互组件系统设计方案](./演示交互组件系统设计方案.md) | 未实施 | `<FlipCard>`、`<SlideTabs>` 等组件级交互组件的设计提案，代码中尚无对应实现。 |

### 历史存档（docs/reference/，立项调研与复盘）

| 文档名称 | 核心主题 | 说明 |
| :--- | :--- | :--- |
| [速览微浏览器 SPA 跳页 404 案例分析与 Webview src 绑定避坑指南](./reference/速览微浏览器%20SPA%20跳页%20404%20案例分析与%20Webview%20src%20绑定避坑指南.md) | 隐藏 bug 复盘与契约速查 | 复盘"SPA 站点次级页短暂显示后变 404"的三重根因（响应式 src 绑定 × Electron src 属性契约 × 站点无 SPA fallback），沉淀 webview 导航契约速查表。 |
| [同类插件竞品深度分析与参考](./reference/Joplin%20与%20Obsidian%20同类演示插件深度调研与参考.md) | 横向对比与痛点提炼 | 深入对比 Obsidian 与 Joplin 生态中的同类插件（Advanced Slides, Marp, Reveal.js 等），剖析优缺点，提炼核心差异化策略。 |
| [Slidev 演示文稿运行与效果查看实战指南](./reference/Slidev%20演示文稿运行与效果查看实战指南%20——%20以%20slidev-templates%20项目为例.md) | 外部参考手册 | 以 `slidev-templates` 模板为例的本地热重载预览、演讲者视图、总览大纲与导出全流程参考。 |
| [Slidev项目文件结构](./reference/Slidev项目文件结构.md) | 外部参考手册 | 官方 Slidev 工程的目录与文件结构速查，服务导入功能开发对照。 |
| [即现插件介绍样例文档](./reference/即现插件介绍样例文档.md) | 自我演示文稿 | 用即现自身语法撰写的插件介绍演示文档（含 assets/ 配图）。 |

---

## 项目核心愿景

> **"让笔记即是演示，让演讲回归内容；零污染元数据沉淀，现代前端级酷炫视觉呈现。"**

传统笔记做演示往往面临**"要么排版极简丑陋、要么正文被大量宏与注释严重污染、离开插件无法阅读"**的尴尬境地。
**SiYuan Live Slides** 深度依托思源笔记底层的**块级架构（Block Architecture）**与**块属性系统（Block Attributes）**，将现代前端最先进的组件化演示框架 **Slidev** 引入思源生态：
- **正文纯净可读**：所有版式、动画、高亮、演讲备注完全存储于思源块属性中，Markdown 正文 0 污染；
- **现代前端动效**：原生继承 Slidev 的 UnoCSS、Vue SFC 组件、Shiki 逐行代码高亮与动态 `v-click` / `v-motion` 动效；
- **丝滑双向联动**：上方编辑笔记，下方宽屏分屏即时预览与右侧情境配置，光标所至即为所讲；
- **AI 智能加速**：结合思源预置 AI Agent，一键实现长文智能分页、演讲词提炼与动效智能填充。

## 附录：相关项目源码

参考工程按开发机器取用其一（两套路径指向同一批参考工程），详见仓库根目录 `AGENTS.md`：

| 参考工程 | Windows 开发机 | Linux 开发机 |
| :--- | :--- | :--- |
| siyuan-note（思源笔记本体） | `D:\MyCodingProjects\siyuan-note` | `../siyuan` |
| siyuan-property-manager | `D:\MyCodingProjects\siyuan-property-manager` | — |
| Slidev | `D:\GitHub\slidev` | — |
| Slidev Templates | `D:\GitHub\slidev-templates` | — |
