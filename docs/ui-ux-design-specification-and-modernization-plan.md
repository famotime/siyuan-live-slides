# 思源笔记 Slidev 演示插件 UI/UX 体验评审与现代化设计系统重构方案

> **文档定位**：面向 SiYuan Slidev 插件全栈与前端开发团队的专业交互设计（UX）与视觉系统（UI）重构指导规范。  
> **设计视角**：资深互联网应用 UX/UI 设计师（10+ 年专业桌面生产力与创作工具领域经验）。  
> **目标**：彻底根除平庸粗糙的 **“AI Slop（劣质拼接）”** 风格，构建具备 Studio 工业级质感、严谨无障碍合规、无缝契合思源笔记（SiYuan Note）生态的专业级侧边配置坞（Inspector Dock）与预览工作台。

---

## 目录（Table of Contents）

1. [现状深度体检与“AI Slop”痛点穿透分析](#1-现状深度体检与ai-slop痛点穿透分析)
   - 1.1 灾难现场剖析（基于实机截图与代码走查）
   - 1.2 为什么当前的实现是典型的“AI Slop”？
   - 1.3 根因级技术与交互缺陷清单
2. [重构设计原则与美学哲学（Design Philosophy）](#2-重构设计原则与美学哲学design-philosophy)
   - 2.1 拒绝 AI Slop：克制、一致、精确、高密度
   - 2.2 思源原生融合契约（Native Integration Contract）
   - 2.3 工具栏密集化与情境感知（Ergonomic Toolbars & Progressive Disclosure）
3. [设计系统基础代币规范（Design Tokens Specification）](#3-设计系统基础代币规范design-tokens-specification)
   - 3.1 亮色与暗色模式色彩语义矩阵（Dark/Light Theme Matrix）
   - 3.2 字体排版与阶梯标度（Typography & Hierarchy）
   - 3.3 间距与网格规范（Spacing & Layout Rhythm）
   - 3.4 圆角与立面阴影（Radius & Elevation）
4. [显式线框图标体系与思源防覆盖规范（The Line-Art Icon System）](#4-显式线框图标体系与思源防覆盖规范the-line-art-icon-system)
   - 4.1 纯线框设计哲学与规约
   - 4.2 终结 CSS 污染：`fill:none!important` 钢印防御方案
   - 4.3 核心功能线框图标库 SVG 规范清单
5. [交互模式与组件库重构（Interaction & Components）](#5-交互模式与组件库重构interaction--components)
   - 5.1 彻底解决双重 Tooltip 幽灵冲突（Dual Tooltip Ghosting Resolution）
   - 5.2 紧凑型图标操作按钮（Icon Action Button）
   - 5.3 现代微型分段滑块（Segmented Control）
   - 5.4 渐进式动画开关（Micro Toggle Switch）
   - 5.5 上下文状态胶囊（Context Status Badge）与代码预览净化
   - 5.6 可视化版式与转场选择器（Visual Grid Pickers）
6. [界面布局演进与组件架构重组（Information Architecture）](#6-界面布局演进与组件架构重组information-architecture)
   - 6.1 顶栏（Header & Global Actions）
   - 6.2 焦点上下文条（Target Banner）
   - 6.3 属性卡片（Inspector Cards）与块快捷操作组
7. [技术实现指引与代码示例（Engineering Implementation）](#7-技术实现指引与代码示例engineering-implementation)
   - 7.1 全局 SCSS 架构（`src/index.scss`）
   - 7.2 净化防泄露的 BlockInspectorSection 重构示例
8. [验收基准与迭代检查清单（Checklist）](#8-验收基准与迭代检查清单checklist)

---

## 1. 现状深度体检与“AI Slop”痛点穿透分析

### 1.1 灾难现场剖析（基于实机截图与代码走查）

在最新实机界面截图中（聚焦普通段落块时的 Dock 侧边栏），呈现了多处严重违背现代人机交互（HCI）与专业设计原则的缺陷：

```
+-------------------------------------------------------+
| [图标] 演示配置                         [导入] [分屏预览] | <-- 按钮圆角硬套胶囊，缺乏统一网格
+-------------------------------------------------------+
|  段落块   ID: -y2zn6um                                  | <-- 信息密度极低，单薄的浅紫贴条
+-------------------------------------------------------+
| 元素动效与排版<button @click="$slidev.nav.openInEd...   | <-- 💥 严重事故：代码模板裸露与文字粘连
|                                                       |
| ✨ 逐步出现 (v-click)翻页时按步长逐个呈现                 | <-- 滥用Emoji，标题与副标题无层级换行
| [ 关闭 ]                                              | <-- 💥 降级为 Windows 95 原生凸起灰色按钮！
|                                                       |
| ▥ 双栏插槽 (Slot)在 two-cols 等分栏布局中的归属           |
| [ 默认 ] [ 左栏 (left) ] [ 右栏 (right) ]               | <-- 粗糙单薄原生边框按钮
|                                                       |
| 块快捷操作                                             |
| [ + 在上方插入分页符 (---) ]                            | <-- 纵向占满的大条文字按钮，
| [ + 在下方插入分页符 (---) ]                            |     浪费 Dock 宝贵高度，极其臃肿
| [ ▥ 设为双栏对比 ]                                      |
+-------------------------------------------------------+
```

### 1.2 为什么当前的实现是典型的“AI Slop”？

所谓 **“AI Slop（AI 产生的粗制滥造平庸设计）”**，具有以下典型特征，而在本项目当前代码中不幸几乎全部命中：

1. **廉价的 Emoji 拼凑**：用随意的系统 Emoji（`✨`、`▥`、`➕`、`🧹`、`🎯`、`🤖`、`📌`、`🚀` 等）充当功能图标。Emoji 在 Windows、macOS 和 Linux 上色系和粗细千差万别，在暗色背景下花哨刺眼，产生极度廉价的“外包原型”感。
2. **样式隔离失效导致系统默认 User-Agent 回退**：父组件使用 `<style scoped>` 声明样式类，却妄图在子组件生效；全局 SCSS（`src/index.scss`）居然是空文件（0 字节）。结果子组件的所有自定义按钮完全失去 CSS，回退到浏览器默认的原生立体灰框。
3. **数据泄露与字符串破损**：直接将未净化的源码截取放入界面：`blockContentSnippet.value = (info.content || info.markdown || '').slice(0, 50)`，当正文包含 HTML/Vue 标签时，不仅破坏了外层 DOM 解析，还在界面上直接吐出 `<button @click=...`，让用户误以为软件发生脚本注入崩溃。
4. **低信息密度的纵向大按钮堆砌**：在宽度通常只有 260px~320px 的 Dock 狭长空间内，用大号全宽文本按钮纵向堆叠，缺乏快捷操作工具栏设计意识。
5. **对暗黑模式（Dark Mode）的漠视与无障碍失明**：直接硬编码浅色背景色块（如 `#fef3c7` 浅黄、`#e0e7ff` 浅紫、`#f8fafc` 浅灰），在思源暗色主题下如同白斑刺眼，对比度严重不达标（违反 WCAG 2.1 AA）。
6. **双重 Tooltip 幽灵重叠**：同时存在 HTML 原生 `title="..."` 属性与可能引入的浮层提示，在悬停时出现系统丑陋黄色浮窗遮挡现代 UI 的现象。

---

## 2. 重构设计原则与美学哲学（Design Philosophy）

我们要将 SiYuan Slidev 从“粗糙的原型工具”提升为媲美 **Figma、Linear、VS Code、Slidev 官方 Inspector** 级别的**现代桌面级专业生产力工坊（Studio-Grade Workstation）**。

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    Studio-Grade Design                      │
  ├──────────────────┬───────────────────┬──────────────────────┤
  │    克制与专注    │    思源原生共生   │    空间高密度工效    │
  │ (Low Visual Noise│ (Native Theme Fit │ (Compact Ergonomics  │
  │  & Line-Art SVG) │  & CSS Variables) │  & Icon + Tooltips)  │
  └──────────────────┴───────────────────┴──────────────────────┘
```

### 2.1 克制与专注（Restraint & Low Visual Noise）
- **禁止在核心工作区滥用彩色 Emoji**。所有功能符号统一使用 **显式线框矢量 SVG 图标（Line-Art SVG）**。
- 界面主体色彩保持克制：默认态为沉稳的中性色，仅在聚焦（Active/Hover）或关键操作触发时使用品牌主色点缀。

### 2.2 思源原生共生（100% Native Theme Fit）
- **严禁任何硬编码的 RGB / HEX 颜色**。
- 全量绑定思源笔记官方 Design Token 变量（`--b3-theme-*`, `--b3-border-color`, `--b3-list-*`），保证亮色模式温润雅致、暗色模式深邃护眼，自动跟随用户的任何第三方主题。

### 2.3 空间高密度与工效学（Ergonomic Toolbars & Progressive Disclosure）
- Dock 侧边栏的每一像素都极度宝贵。将常用的单步操作（插入上下分页、设为双栏、清除属性）从**“单列大文本长按钮”**重构为**“水平图标工具组（Icon Action Group）+ 精确 Tooltip”**。
- 释放 60% 以上的无效纵向空间，使演示文稿的核心参数无需频繁滚动即可一览无余。

---

## 3. 设计系统基础代币规范（Design Tokens Specification）

### 3.1 亮色与暗色模式色彩语义矩阵（Dark/Light Theme Matrix）

所有颜色必须映射至思源核心 CSS 变量系统，并具备自动暗色自适应能力：

| 语义角色 (Semantic Token) | 思源原生变量 (SiYuan Variable) | 亮色模式预期表现 (Light Fallback) | 暗色模式预期表现 (Dark Fallback) | 适用场景说明 |
| :--- | :--- | :--- | :--- | :--- |
| **主画布背景** | `var(--b3-theme-background)` | `#ffffff` | `#1e1e1e` | Dock 整体容器与主面板底色 |
| **二级卡片表面** | `var(--b3-theme-surface)` | `#f8fafc` / `#f5f6f8` | `#252526` | 属性分组卡片、分段控制器底槽 |
| **悬浮反馈表面** | `var(--b3-theme-surface-hover)` | `#f1f5f9` / `#ebedf0` | `#2d2d30` | 按钮 Hover、列表项悬停 |
| **激活/选中表面** | `var(--b3-list-hover)` | `rgba(0, 0, 0, 0.05)` | `rgba(255, 255, 255, 0.08)` | 菜单项、常规项 Active |
| **边界与分割线** | `var(--b3-border-color)` | `#e2e8f0` / `#dcdcde` | `#3c3c3c` | 卡片外框、工具栏下划线 |
| **主文字（高对比）** | `var(--b3-theme-on-background)`| `#1e293b` / `#2c3e50` | `#cccccc` / `#d4d4d4` | 标题、主要标签、高亮参数 |
| **副文字（中对比）** | `var(--b3-theme-on-surface)` | `#64748b` | `#858585` | 说明文字、字段描述、占位符 |
| **弱化/失效文字** | `var(--b3-theme-on-surface-light)`| `#94a3b8` | `#5c5c5c` | 短 ID 标识、快捷键提示 |
| **品牌主强调色** | `var(--b3-theme-primary)` | `#4285f4` / 品牌主题色 | `#4285f4` / 品牌主题色 | 选中高亮、主操作按钮、Active 描边 |
| **强调色柔和浅底** | `var(--b3-theme-primary-light)` | `rgba(66, 133, 244, 0.12)` | `rgba(66, 133, 244, 0.2)` | 激活标签背景、Chip 选中态 |
| **危险/警告色** | `var(--b3-theme-error)` | `#ef4444` | `#f87171` | 清除属性、删除分页符 |

> [!IMPORTANT]
> **对比度底线保证**：必须确保所有正文字符与表面色对比度不低于 **4.5:1**（WCAG AA 级要求），大字标题不低于 **3:1**。坚决废弃 `#fef3c7` / `#e0e7ff` 这类硬编码在暗黑模式下刺眼失明的浅底色。

### 3.2 字体排版与阶梯标度（Typography & Hierarchy）

采用思源笔记全局字体栈，严禁在组件内写死特定英文字体或无衬线声明：

```scss
font-family: var(--b3-font-family);
```

| 层级名称 (Level) | 字号 (Font Size) | 字重 (Weight) | 行高 (Line Height) | 文本色彩 (Color) | 典型应用组件 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Panel Title** | 13px | 600 (Semibold) | 18px | `--b3-theme-on-surface` | 面板顶部导航栏主标题 |
| **Section Header**| 12px | 600 (Semibold) | 16px | `--b3-theme-on-surface` | 属性卡片分区大标题 |
| **Label / Body** | 12px | 500 (Medium) | 16px | `--b3-theme-on-surface` | 控制项名称、分段选项标签 |
| **Caption / Desc**| 11px | 400 (Regular) | 14px | `--b3-theme-on-surface-light` | 辅助功能说明、状态描述 |
| **Mono Badge** | 11px | 400 (Regular) | 14px | `--b3-theme-on-surface-light` | 块 ID 显示、快捷键、语法指示 |

### 3.3 间距与网格规范（Spacing & Layout Rhythm）

基于 **4px 基础网格系统**，统一组件内外边距：

- **4px (`--spm-space-xs`)**：图标与文字间隙、组合按钮内嵌间隙、Chip 内外边距；
- **8px (`--spm-space-sm`)**：卡片内部控件间距、分段控制器外框填充；
- **12px (`--spm-space-md`)**：卡片外层 Padding、不同卡片之间的纵向间距；
- **16px (`--spm-space-lg`)**：主分区（Section）之间的视觉隔断。

---

## 4. 显式线框图标体系与思源防覆盖规范（The Line-Art Icon System）

### 4.1 纯线框设计哲学与规约

全面引入专业线框风格（类似 **Lucide Icons / Feather Icons** 体系）：
- **网格栅格**：基准基于 `24 × 24`（渲染时按需缩放至 14px / 16px / 18px）；
- **线条粗细**：统一 `stroke-width="1.75"` 或 `2`；
- **线条收口**：强制 `stroke-linecap="round"` 与 `stroke-linejoin="round"`，杜绝尖锐毛刺；
- **色彩继承**：强制 `stroke="currentColor"`，随按钮文本或主色自动变色。

### 4.2 终结 CSS 污染：`fill:none!important` 钢印防御方案

#### 痛点根因：
思源笔记核心样式库中包含很多激进的全局重置选择器，例如：
```css
svg {
  fill: currentColor; /* 这会导致所有精细线框图标全部被涂黑/涂实成难看的色块 */
}
```

#### 铁律防御准则（不可妥协）：
1. 在组件内每一个 `<svg>` 标签上，**显式添加行内样式**：
   ```html
   <svg style="fill:none!important;" ...>
   ```
2. 在全局样式文件 `src/index.scss` 中加入**顶级权重全局防御规则**：

```scss
/* ==========================================================================
   全局线框图标防御体系（防止思源 host CSS 破坏 SVG 线框展现）
   ========================================================================== */
svg.slidev-icon,
.slidev-icon svg,
.spm-slidev-inspector svg {
  fill: none !important;
  stroke: currentColor !important;
  stroke-width: 1.75 !important;
  stroke-linecap: round !important;
  stroke-linejoin: round !important;
  box-sizing: border-box;
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
```

### 4.3 核心功能线框图标库 SVG 规范清单

以下为常用交互按钮的标准线框图标代码（开发时可封装为 `<SlidevIcon name="..." />` 通用组件或行内内联）：

| 功能说明 (Action) | 线框形态设计说明 | 推荐内联 SVG 模板 |
| :--- | :--- | :--- |
| **分屏预览**<br>(Split Preview) | 双分屏画板线框 | `<svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/></svg>` |
| **导入演示**<br>(Import) | 文件箭头滑入 | `<svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><polyline points="7 9 12 14 17 9"/><line x1="12" y1="14" x2="12" y2="3"/></svg>` |
| **双屏演讲**<br>(Presenter) | 讲台/荧幕与投影 | `<svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24"><path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></svg>` |
| **上方插入页**<br>(Insert Above) | 虚线上方添加折叠页 | `<svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="13"/><line x1="8" y1="9" x2="16" y2="9"/><path d="M4 19h16" stroke-dasharray="2 2"/></svg>` |
| **下方插入页**<br>(Insert Below) | 虚线下方添加折叠页 | `<svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24"><path d="M4 5h16" stroke-dasharray="2 2"/><line x1="12" y1="11" x2="12" y2="19"/><line x1="8" y1="15" x2="16" y2="15"/></svg>` |
| **逐步出现 (v-click)**<br>(Step Animation) | 闪烁光芒或步进指针 | `<svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>` |
| **双栏对比**<br>(Two Columns) | 左右对等列线框 | `<svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>` |
| **代码聚光灯**<br>(Shiki Spotlight) | 代码括号与探照透镜 | `<svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>` |
| **清除演示属性**<br>(Clean Attrs) | 扫帚/擦除橡皮 | `<svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24"><path d="m18 15-6-6"/><path d="M4 20h16"/><path d="M6 14l8-8a2.8 2.8 0 0 1 4 4l-8 8H6v-4z"/></svg>` |
| **AI 智能建议**<br>(AI Split / Notes)| 灵感火花线框 | `<svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg>` |

---

## 5. 交互模式与组件库重构（Interaction & Components）

### 5.1 彻底解决双重 Tooltip 幽灵冲突（Dual Tooltip Ghosting Resolution）

#### 冲突病因：
当我们在 HTML 元素上写了 `title="分屏预览 (Alt+P)"`，现代浏览器会在鼠标悬停 500ms 后自动弹出浏览器底层的原生小黄框/小白框。如果组件又用了 Tippy.js 或思源自己的 `aria-label` / `b3-tooltips`，两个气泡会产生重叠遮挡，严重影响体验。

#### 规范治理方案：
1. **全面禁止在所有按钮上直接编写 `title="..."` 属性**！
2. **统一采用思源笔记原生提供的 `aria-label` 气泡提示引擎**：
   - 思源为插件开发者提供了免依赖、跟随主题的 tooltip 类名：
     - `aria-label="提示文本"`
     - `class="b3-tooltips b3-tooltips__s"`（南向/下方弹出）
     - `class="b3-tooltips b3-tooltips__n"`（北向/上方弹出）
     - `class="b3-tooltips b3-tooltips__w"`（西向/左侧弹出）
3. 示例规范代码：
   ```html
   <!-- 正确：完美融合思源原生，无任何原生幽灵弹窗 -->
   <button
     class="spm-icon-btn b3-tooltips b3-tooltips__s"
     aria-label="在下方分屏打开幻灯片预览 (Alt+P)"
     @click="onOpenBottomPreview"
   >
     <svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24">...</svg>
   </button>
   ```

### 5.2 紧凑型图标操作按钮（Icon Action Button）

替代过去“大行文字占据满屏”的笨拙做法，采用标准的 `28px × 28px` 微型工具按钮，支持组合拼排（Button Group）：

```
[ + 插入上方页 ] [ + 插入下方页 ] [ ▥ 设为双栏 ] [ 🧹 清除属性 ]
```

- 默认态：透明背景，边框为 1px 微弱轮廓（`--b3-border-color`）或无边框，文本色彩为中性副色；
- 悬停态（Hover）：背景变为 `--b3-theme-surface-hover`，线条与图标色彩高亮为 `--b3-theme-primary`；
- 尺寸：宽高 `28px`，圆角 `4px`，图标居中 `16px`。

### 5.3 现代微型分段滑块（Segmented Control）

现有的分段选项（如双栏插槽：默认 / 左栏 / 右栏）边界生硬，缺乏整体感。
重构为 iOS / macOS 风格的内嵌分段槽：
- 外容器：背景为 `--b3-theme-surface`，高度 `28px`，内边距 `2px`，圆角 `6px`，flex 均分；
- 滑块选项（Item）：无边框，圆角 `4px`，文字 11px；
- 选中态（Active）：背景采用 `--b3-theme-background`（形成浮起卡片感），带有微妙的 `box-shadow: 0 1px 2px rgba(0,0,0,0.08)`，文字变为主色加粗。

### 5.4 渐进式动画开关（Micro Toggle Switch）

将粗糙的“文字按钮：已开启 / 关闭”升级为标准的 **微型滑动开关（Toggle Switch）**：
- 尺寸：宽度 `32px`，高度 `18px`，胶囊圆角 `9px`；
- 关闭态：背景 `--b3-border-color`，内嵌滑块位于左侧；
- 开启态：背景渐变为 `--b3-theme-primary`，滑块滑动至右侧；
- 动效过渡：`transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`。

### 5.5 上下文状态胶囊（Context Status Badge）与代码预览净化

#### 修复代码泄露严重 Bug：
在段落块包含 Markdown / HTML 标签时，原逻辑导致 `<button...` 贴着标题显示。
必须采取**“标题归标题，内容归引述”**的彻底解耦架构：
1. **标题区独立**：左侧展示固定区块标题（如“元素动效与排版”），禁止向内拼接字符串；
2. **纯文本净化器**：对 `blockContentSnippet` 执行严格的 HTML 标签滤除与转义：
   ```ts
   // 安全清洗，避免 HTML 代码打碎 UI
   function sanitizeSnippet(raw: string): string {
     return raw
       .replace(/<[^>]+>/g, '') // 剥离 HTML 标签
       .replace(/[\r\n]+/g, ' ') // 换行归一为单空格
       .trim()
       .slice(0, 40)
   }
   ```
3. **独立引用条呈现**：将清洗后的内容以专门的 `spm-context-quote` 单行弱化展示（带有 `overflow: hidden; text-overflow: ellipsis;`），若为空则直接隐藏，不污染视觉主干。

---

## 6. 界面布局演进与组件架构重组（Information Architecture）

重构后的 Dock 层次应当极度分明、节奏有序：

```
┌────────────────────────────────────────────────────────┐
│  [SlidevIcon] 演示配置 (Doc)             [📥]  [🖥️]  [🎤]│  <-- 紧凑顶栏：全局图标动作组
├────────────────────────────────────────────────────────┤
│  [段落块] #y2zn6um                ● 更改已同步 (120ms) │  <-- 状态胶囊：ID一键复制 + 微状态指示
├────────────────────────────────────────────────────────┤
│  "这是一个段落示例文本..."                             │  <-- 安全清洗后的单行弱化引用
├────────────────────────────────────────────────────────┤
│  ┌─ [⚡] 元素动效 (v-click) ─────────────────────────┐  │
│  │  翻页时按步长逐个呈现                     [ ○── ] │  │  <-- 微型开关 Toggle
│  │  步长选择: [顺延(+1)] [第1步] [第2步] [隐藏(hide)]  │  │  <-- 紧凑 Pill Chips
│  └───────────────────────────────────────────────────┘  │
│  ┌─ [▥] 双栏布局插槽 (Slot) ─────────────────────────┐  │
│  │  [  默认 (Default)  |  左栏 (Left)  |  右栏 (Right) ] │  │  <-- 现代分段滑动槽
│  └───────────────────────────────────────────────────┘  │
│  ┌─ 快捷操作 (Quick Actions) ────────────────────────┐  │
│  │  [ + 插入上方页 ]  [ + 插入下方页 ]                │  │  <-- 2x2 紧凑网格工具组，
│  │  [ ▥ 设为双栏  ]  [ 🧹 清除本块属性 ]              │  │      彻底取代单列大条按钮！
│  └───────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 6.1 顶栏（Header & Global Actions）
- **左侧**：线框 Slidev 徽标 + “演示配置”文本（`font-size: 13px; font-weight: 600;`）；
- **右侧**：一字排开的纯线框操作按钮组（导入、下方分屏预览、双屏演讲控制台），统一附加思源原生 Tooltip，彻底释放垂直空间。

### 6.2 焦点上下文条（Target Banner）
- 左侧为小巧的语义 Badge（根据聚焦类型自动赋予语义色：分页符赋予柔和琥珀、内容块赋予柔和中性蓝、全局文档赋予优雅灰）；
- 右侧为 monospace 短 ID，鼠标点击时提示“已复制块 ID”，提升高级生产力工具属性；
- 右上角为极简绿点呼吸灯（`● 已同步`），微动效淡出，绝不抢占视觉焦点。

### 6.3 属性卡片（Inspector Cards）与块快捷操作组
- 取消单一纵向文本按钮，快捷操作组重构为 **2 列对称网格（2-Column Grid）** 或 **横向工具排**，空间占用直接减少 **50%**。

---

## 7. 技术实现指引与代码示例（Engineering Implementation）

### 7.1 全局 SCSS 架构（`src/index.scss`）

必须激活并填充 `src/index.scss`，由 Vite 打包注入宿主，确保无论组件是否 scoped，核心基础组件样式全量生效：

```scss
/* ==========================================================================
   SiYuan Slidev Studio Design System - Global Styles
   ========================================================================== */

/* 1. 图标绝对防御（杜绝思源全局 fill 覆盖线框图标） */
svg.slidev-icon,
.slidev-icon svg,
.spm-slidev-inspector svg {
  fill: none !important;
  stroke: currentColor !important;
  stroke-width: 1.75 !important;
  stroke-linecap: round !important;
  stroke-linejoin: round !important;
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}

/* 2. 主容器与整体环境 */
.spm-slidev-inspector {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-family: var(--b3-font-family);
  font-size: 12px;
  overflow: hidden;
  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
}

/* 3. 紧凑型顶栏 */
.spm-inspector-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;

  .spm-inspector-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);

    .slidev-icon {
      width: 16px;
      height: 16px;
      color: var(--b3-theme-primary);
    }
  }

  .spm-inspector-topbar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

/* 4. 紧凑型图标工具按钮 */
.spm-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.15s ease;

  .slidev-icon {
    width: 15px;
    height: 15px;
  }

  &:hover {
    background: var(--b3-theme-surface-hover);
    color: var(--b3-theme-primary);
    border-color: var(--b3-border-color);
  }

  &:active {
    background: var(--b3-list-hover);
    transform: scale(0.96);
  }

  &.is-primary {
    background: var(--b3-theme-primary);
    color: #ffffff;
    &:hover {
      opacity: 0.9;
    }
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
}

/* 5. 目标状态指示横条 */
.spm-target-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  font-size: 11px;
  flex-shrink: 0;

  .spm-target-info {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }

  .spm-target-tag {
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 11px;
    background: var(--b3-theme-surface-hover);
    color: var(--b3-theme-on-surface);

    &.tag-divider {
      background: rgba(245, 158, 11, 0.12);
      color: #d97706;
    }
    &.tag-block {
      background: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.12));
      color: var(--b3-theme-primary);
    }
    &.tag-doc {
      background: var(--b3-theme-surface-hover);
      color: var(--b3-theme-on-surface-light);
    }
  }

  .spm-target-id {
    font-family: var(--b3-font-family-code, monospace);
    color: var(--b3-theme-on-surface-light);
    cursor: pointer;
    &:hover {
      text-decoration: underline;
    }
  }

  .spm-save-status {
    color: #10b981;
    font-weight: 500;
    font-size: 11px;
  }
}

/* 6. 单行净化引述条 */
.spm-context-quote {
  padding: 4px 12px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  background: var(--b3-theme-background);
  border-bottom: 1px solid var(--b3-border-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--b3-font-family-code, monospace);
}

/* 7. 主体滚动区与卡片系统 */
.spm-inspector-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spm-card-control {
  padding: 10px 12px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .spm-control-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .spm-control-title-group {
      display: flex;
      flex-direction: column;

      .spm-control-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);

        .slidev-icon {
          width: 14px;
          height: 14px;
          color: var(--b3-theme-primary);
        }
      }

      .spm-control-desc {
        font-size: 11px;
        color: var(--b3-theme-on-surface-light);
        margin-top: 1px;
      }
    }
  }
}

/* 8. 现代化滑动分段控制器 (Segmented Group) */
.spm-segmented-group {
  display: flex;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;

  .spm-segmented-item {
    flex: 1;
    padding: 4px 6px;
    font-size: 11px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    color: var(--b3-theme-on-surface-light);
    transition: all 0.15s ease;
    text-align: center;
    white-space: nowrap;

    &:hover {
      color: var(--b3-theme-on-surface);
    }

    &.active {
      background: var(--b3-theme-surface);
      color: var(--b3-theme-primary);
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
  }
}

/* 9. 现代微型开关 (Micro Switch) */
.spm-switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  flex-shrink: 0;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .spm-switch-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: var(--b3-border-color);
    transition: .2s;
    border-radius: 18px;

    &:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 2px;
      bottom: 2px;
      background-color: #ffffff;
      transition: .2s;
      border-radius: 50%;
    }
  }

  input:checked + .spm-switch-slider {
    background-color: var(--b3-theme-primary);
  }

  input:checked + .spm-switch-slider:before {
    transform: translateX(14px);
  }
}

/* 10. 紧凑快捷操作网格 (Quick Actions Grid) */
.spm-action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;

  .spm-btn-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 8px;
    font-size: 11px;
    border-radius: 4px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;

    .slidev-icon {
      width: 13px;
      height: 13px;
    }

    &:hover {
      background: var(--b3-theme-surface-hover);
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-primary);
    }

    &.spm-btn-danger {
      color: var(--b3-theme-error);
      &:hover {
        background: rgba(239, 68, 68, 0.08);
        border-color: var(--b3-theme-error);
      }
    }
  }
}
```

### 7.2 净化防泄露的 BlockInspectorSection 重构示例

```vue
<template>
  <div class="spm-section spm-section--block">
    <!-- 1. 逐步出现 (v-click) 动效卡片 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span>逐步呈现 (v-click)</span>
          </div>
          <span class="spm-control-desc">放映时按步长渐进显现</span>
        </div>
        <label class="spm-switch">
          <input
            type="checkbox"
            :checked="Boolean(elemClick)"
            @change="$emit('toggleElemClick')"
          />
          <span class="spm-switch-slider"></span>
        </label>
      </div>

      <!-- 步长细化选择器 -->
      <div v-if="elemClick" class="spm-quick-chips">
        <button
          v-for="step in ['+1', '1', '2', 'hide']"
          :key="step"
          class="spm-chip"
          :class="{ active: elemClick === step }"
          @click="$emit('update:elemClick', step)"
        >
          {{ step === '+1' ? '顺延 (+1)' : step === 'hide' ? '隐藏 (hide)' : '第 ' + step + ' 步' }}
        </button>
      </div>
    </div>

    <!-- 2. 多栏插槽分配器 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="18" rx="1"/>
              <rect x="14" y="3" width="7" height="18" rx="1"/>
            </svg>
            <span>双栏插槽归属 (Slot)</span>
          </div>
          <span class="spm-control-desc">在 two-cols 等多栏版式中的布局位置</span>
        </div>
      </div>
      <div class="spm-segmented-group">
        <button
          class="spm-segmented-item"
          :class="{ active: !elemSlot || elemSlot === 'default' }"
          @click="$emit('update:elemSlot', '')"
        >
          默认
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: elemSlot === 'left' }"
          @click="$emit('update:elemSlot', 'left')"
        >
          左栏 (left)
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: elemSlot === 'right' }"
          @click="$emit('update:elemSlot', 'right')"
        >
          右栏 (right)
        </button>
      </div>
    </div>

    <!-- 3. 代码逐行聚光高亮 (仅代码块激活时可见) -->
    <div v-if="isCodeBlock" class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            <span>代码逐行聚光 (Shiki)</span>
          </div>
          <span class="spm-control-desc">聚焦高亮代码关键行</span>
        </div>
      </div>
      <div class="spm-quick-chips">
        <button
          v-for="shiki in ['1-3', 'all', '1|2|3', '2-5']"
          :key="shiki"
          class="spm-chip"
          :class="{ active: elemShikiLines === shiki }"
          @click="$emit('update:elemShikiLines', shiki)"
        >
          {{ shiki }}
        </button>
        <button
          v-if="elemShikiLines"
          class="spm-chip spm-chip-clear"
          @click="$emit('update:elemShikiLines', '')"
        >
          清空
        </button>
      </div>
      <input
        :value="elemShikiLines"
        class="spm-input"
        placeholder="如: 1-3|5|all"
        @input="$emit('update:elemShikiLines', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 4. 块级快捷操作组（紧凑 2x2 网格） -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <span class="spm-control-title">快捷操作</span>
        </div>
      </div>
      <div class="spm-action-grid">
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="在当前块上方插入幻灯片分页线 (---)"
          @click="$emit('insertDividerBefore')"
        >
          <svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="13"/>
            <line x1="8" y1="9" x2="16" y2="9"/>
            <path d="M4 19h16" stroke-dasharray="2 2"/>
          </svg>
          <span>上方分页</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="在当前块下方插入幻灯片分页线 (---)"
          @click="$emit('insertDividerAfter')"
        >
          <svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24">
            <path d="M4 5h16" stroke-dasharray="2 2"/>
            <line x1="12" y1="11" x2="12" y2="19"/>
            <line x1="8" y1="15" x2="16" y2="15"/>
          </svg>
          <span>下方分页</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="将当前块属性设为双栏左侧归属 (slot: left)"
          @click="$emit('setTwoColsContrast')"
        >
          <svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="18" rx="1"/>
            <rect x="14" y="3" width="7" height="18" rx="1"/>
          </svg>
          <span>设为双栏</span>
        </button>

        <button
          v-if="hasBlockAttrs"
          class="spm-btn-action spm-btn-danger b3-tooltips b3-tooltips__s"
          aria-label="一键移除本块所有 custom-slidev 属性"
          @click="$emit('clearBlockAttrs')"
        >
          <svg class="slidev-icon" style="fill:none!important;" viewBox="0 0 24 24">
            <path d="m18 15-6-6"/>
            <path d="M4 20h16"/>
            <path d="M6 14l8-8a2.8 2.8 0 0 1 4 4l-8 8H6v-4z"/>
          </svg>
          <span>清除属性</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  elemClick: string
  elemSlot: string
  elemShikiLines: string
  isCodeBlock: boolean
  hasBlockAttrs: boolean
}>()

defineEmits<{
  (e: 'toggleElemClick'): void
  (e: 'update:elemClick', val: string): void
  (e: 'update:elemSlot', val: string): void
  (e: 'update:elemShikiLines', val: string): void
  (e: 'insertDividerBefore'): void
  (e: 'insertDividerAfter'): void
  (e: 'setTwoColsContrast'): void
  (e: 'clearBlockAttrs'): void
}>()
</script>
```

---

## 8. 验收基准与迭代检查清单（Checklist）

在完成上述代码改造后，UI/UX 验收必须通过以下 8 项严格检验：

- [ ] **1. 零原生降级 (Zero Fallback)**：所有按钮必须具备统一的内边距、圆角与边框，在任何宿主环境中绝不回退至系统默认灰色凸起框；
- [ ] **2. 零 Emoji 依赖 (Zero AI-Slop Emojis)**：核心功能操作区无任何杂乱 Emoji，统一采用 16×16 / 20×20 线框矢量 SVG；
- [ ] **3. 图标钢印防御 (SVG Fill Defense)**：在思源官方默认亮色、暗色以及高对比度第三方主题下，所有 SVG 图标必须保持空心线框（`fill:none` 且有清晰 `stroke`），不可被外部 CSS 糊成黑斑；
- [ ] **4. 零 Tooltip 冲突 (Zero Ghosting Tooltip)**：所有操作按钮均无 HTML 原生 `title` 属性，且悬停超过 2 秒也不会出现浏览器原生浮窗；
- [ ] **5. 暗色模式完美融合 (Dark Theme Harmony)**：切换至思源暗黑模式时，卡片背景、边框、字体、Badge 完全融入深灰环境，对比度达到 WCAG 2.1 AA 级（>= 4.5:1）；
- [ ] **6. 零源码/模板泄露 (Zero Template Leakage)**：无论是代码块、含 HTML 的段落块还是公式块，Dock 标题行绝不粘连任何未清洗的代码片段；
- [ ] **7. 垂直空间紧凑释放 (Compact Vertical Ergonomics)**：快捷操作区高度压缩 50% 以上，在 800px 屏幕高度下完整展示无需滚动；
- [ ] **8. 状态交互即时反馈 (Tactile Feedback)**：任何点击均具备微弱的 Active 按压反馈，属性同步指示灯具备自然的 1.2s 淡出动画。
