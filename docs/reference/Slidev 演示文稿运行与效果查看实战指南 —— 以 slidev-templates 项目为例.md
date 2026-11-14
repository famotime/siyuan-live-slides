# Slidev 演示文稿运行与效果查看实战指南 —— 以 slidev-templates 项目为例

本文档以 `D:\GitHub\slidev-templates` 仓库中的模板项目为实际范例，系统介绍如何运行、调试、交互查看以及导出 Slidev 制作的演示文稿。

---

## 1. 概述与仓库模板结构

[Slidev](https://sli.dev/) 是基于 Web 技术的现代开发者演示文稿工具，核心采用 **Markdown + Vue 组件 + UnoCSS/Tailwind** 构建，拥有代码高亮、交互组件、实时热重载（HMR）、演讲者双屏视图和静态导出等能力。

在 `D:\GitHub\slidev-templates` 仓库中，主要包含以下两类模板：

### 1.1 托管型独立 Starter 模板（`templates/`）
每个 starter 都是一个完全自包含（Self-contained）的 Slidev 项目，拥有独立的 `package.json`、`slides.md` 和资源文件：
- **`templates/paper-lab/starter`**（Paper Lab）：面向学术研究、论文答辩、实验数据叙事的浅色衬线风格模板。
- **`templates/terminal-ink/starter`**（Terminal Ink）：面向系统工程、故障复盘（Incident Review）、终端运维演示的深色终端风格模板。
- **`templates/editorial-grid/starter`**（Editorial Grid）：面向产品发布、战略宣讲、模块网格叙事的杂志排版风格模板。

### 1.2 综合型演讲系统模板（`neko-style/`）
- 位于 `neko-style/` 目录，包含完整的主题包 `theme/` 和开箱即用的启动模板 `starter/`，支持动态多边形渐变光晕背景（Glow Background）与丰富的语义化卡片组件。

---

## 2. 前置环境要求

在运行前，请确保本地开发环境满足以下要求：

| 工具 | 推荐版本 | 说明 |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.12.0`（建议 Node 20 LTS 或 Node 22） | 模板及 Slidev CLI 采用现代 ESM 模块系统 |
| **包管理器** | `npm` (>= 10.x) 或 `pnpm` | 仓库各 starter 原生支持 `npm` |
| **现代浏览器** | Chrome / Edge / Firefox 最新稳定版 | 用于呈现 Web 动效、UnoCSS 样式与演讲者视图 |

可在终端中执行以下命令验证环境：
```bash
node -v
npm -v
```

---

## 3. 本地运行查看效果（以 Paper Lab 模板为例）

这是**最常用、体验最好**的查看方式。Slidev 内置 Vite 开发服务器，支持**毫秒级热更新**，修改 Markdown 内容或 Vue 组件时无需手动刷新页面。

### 步骤 1：定位到目标模板目录
打开终端（Windows PowerShell 或命令行），进入目标 starter 所在的文件夹：
```bash
cd D:\GitHub\slidev-templates\templates\paper-lab\starter
```

### 步骤 2：安装依赖
执行以下命令安装项目所需的依赖包（包括 `@slidev/cli`、主题与 Vue）：

```bash
npm install
```

> [!TIP]
> **跳过 Playwright 浏览器自动下载（可选加速技巧）**：
> `devDependencies` 中包含了用于导出 PDF 的 `playwright-chromium`。如果本地网络下载 Chromium 较慢，且你暂时只需要在浏览器中查看演示效果，可在安装时临时跳过浏览器二进制下载：
> ```powershell
> # Windows PowerShell
> $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="1"
> npm install
> ```

### 步骤 3：启动开发服务器
依赖安装完成后，执行开发启动命令：
```bash
npm run dev
```

其底层调用了 `slidev --open`。终端输出类似如下内容：

```text
  slidev v52.19.1

  theme   @slidev/theme-default
  entry   D:\GitHub\slidev-templates\templates\paper-lab\starter\slides.md

  slide show    http://localhost:3030/
  presenter     http://localhost:3030/presenter/
```

同时，系统默认浏览器会**自动打开** `http://localhost:3030/`，你即可立刻看到精美的演示文稿效果！

---

## 4. 运行其他模板的方式

### 4.1 运行 Terminal Ink 模板
```bash
cd D:\GitHub\slidev-templates\templates\terminal-ink\starter
npm install
npm run dev
```

### 4.2 运行 Editorial Grid 模板
```bash
cd D:\GitHub\slidev-templates\templates\editorial-grid\starter
npm install
npm run dev
```

### 4.3 运行 Neko Style 技术大会模板
Neko Style 已经配置在仓库根目录的 npm workspace 中：
- **方式 A（在仓库根目录直接运行）**：
  ```bash
  cd D:\GitHub\slidev-templates
  npm install
  npm run dev:neko
  ```
- **方式 B（进入子目录运行）**：
  ```bash
  cd D:\GitHub\slidev-templates\neko-style\starter
  npm install
  npm run dev
  ```

---

## 5. Slidev 多维度查看与交互功能

Slidev 不仅仅是把幻灯片画在网页上，它提供了专业级别的交互、排练与标注工具：

```
+---------------------------------------------------------------+
|                    Slidev 浏览器展示矩阵                      |
+-------------------------------+-------------------------------+
| 1. 普通放映视图 (主屏呈现)    | 2. 演讲者视图 (/presenter)    |
| - 全屏放映 (F)                | - 当前页 + 下一页预告         |
| - 深色/浅色模式 (D)           | - 演讲者备注 (Speaker Notes)  |
| - 页面平滑过渡与动画          | - 计时器 / 倒计时表           |
+-------------------------------+-------------------------------+
| 3. 大纲总览视图 (O)           | 4. 实时交互辅助工具           |
| - 网格平铺所有幻灯片卡片      | - 荧光笔/画笔批注涂鸦         |
| - 快速跳页与逻辑脉络审查      | - 摄像头人像画中画 / 录制     |
+-------------------------------+-------------------------------+
```

### 5.1 普通演示放映视图（Presentation Mode）
- **访问地址**：`http://localhost:3030/`
- **常用快捷键**：
  - `Space` / `→` / `PageDown`：下一页（或触发页面内的 `v-click` 渐进式动画）。
  - `Backspace` / `←` / `PageUp`：上一页。
  - `F`：切换**全屏**展示模式。
  - `D`：切换深色模式（Dark）与浅色模式（Light）。
  - `C`：展开/折叠左侧幻灯片缩略图抽屉（Navigation Bar）。

### 5.2 演讲者双屏视图（Presenter Mode）
- **访问地址**：`http://localhost:3030/presenter`，或在普通视图按键盘快捷键 **`P`**。
- **核心特色**：
  - 完美契合双屏幕/投影仪演讲：投影仪全屏展示普通视图，笔记本屏幕打开演讲者视图。
  - 同时展示**当前幻灯片画面**和**下一张幻灯片画面预告**。
  - 实时显示 Markdown 中通过 `<!-- 演讲备注 -->` 编写的演讲者提词备注。
  - 提供计时器、秒表、当前页码进度等把控节奏。

### 5.3 网格总览大纲模式（Overview Mode）
- **操作方式**：在演示界面按下快捷键 **`O`**。
- **核心特色**：
  - 将整场演示的所有幻灯片以网格缩略图的形式全局平铺在屏幕上。
  - 方便宏观检查视觉一致性、页面衔接节奏，点击任意一张卡片可秒级跳转到指定幻灯片。

### 5.4 实时批注与录屏（Drawing & Recording）
- 鼠标移动到底部工具栏（控制条），点击**画笔图标**可以启用在线涂鸦功能，提供画笔、马克笔、橡皮擦，用于即时圈画重点。
- 点击**录像图标**可开启摄像头画中画（Webcam），或录制整场演讲视频。

---

## 6. 其他查看与交付方式

除了本地实时开发预览外，针对分享、部署和归档场景，还支持以下几种查看方式：

### 6.1 提取模板创建全新的独立演示项目（基于 degit）
如果你希望以某个模板为起点制作自己的演示文稿，无需拷贝整个仓库，可通过 `npx degit` 提取纯净的 starter：
```bash
# 提取 Paper Lab 模板到新文件夹 my-research-presentation
npx degit iridite/slidev-templates/templates/paper-lab/starter my-research-presentation

cd my-research-presentation
npm install
npm run dev
```

### 6.2 构建为静态网页并离线托管（Static Build）
用于部署到 GitHub Pages、Vercel、Netlify 或团队内部 Web 服务器：
```bash
cd D:\GitHub\slidev-templates\templates\paper-lab\starter
npm run build
```
- 构建产物将生成在 `dist/` 文件夹中。
- 本地检验打包产物：
  ```bash
  npx serve dist
  ```
  在浏览器中打开提示的端口（如 `http://localhost:3000`），即可检验脱离开发环境下的静态单页应用效果。

### 6.3 导出为 PDF / PPTX / 图片序列（Export）
用于发送给不便运行 Web 服务的受众或打印讲义：
- **前置准备**：确保安装了 Playwright Chromium 驱动：
  ```bash
  npx playwright install chromium
  ```
- **导出命令**：
  - **导出为高保真 PDF**：
    ```bash
    npm run export
    # 或者手动指定：
    npx slidev export --format pdf
    ```
  - **导出为 PowerPoint 兼容文件（PPTX）**：
    ```bash
    npx slidev export --format pptx
    ```
  - **导出为逐页 PNG 图片**：
    ```bash
    npx slidev export --format png
    ```
导出完成后，将在项目目录下生成 `slides-export.pdf` 或对应的 PPTX 文件，使用本地阅读器或 Microsoft PowerPoint 即可查看。

### 6.4 启动项目自带的模板画廊系统（Template Gallery）
在 `D:\GitHub\slidev-templates` 根目录下，内置了一个元数据画廊展示服务：
```bash
cd D:\GitHub\slidev-templates
npm run gallery:serve
```
在浏览器访问 `http://127.0.0.1:4173/gallery/`，即可集中浏览所有模板的分类卡片、设计说明、规范契约和预览图。

---

## 7. 常见问题排查（Windows 环境）

| 异常现象 | 可能原因 | 解决办法 |
| :--- | :--- | :--- |
| `Port 3030 is already in use` | 本地已有其他进程占用了 3030 端口 | 1. Slidev 通常会自动尝试 3031 端口；<br>2. 也可手动指定端口：`npx slidev --port 3080 --open` |
| `npm install` 卡在 Playwright 下载 | 国内网络访问国外 CDN 缓慢 | 在 PowerShell 中运行：<br>`$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="1"; npm install` |
| 图片无法加载（显示破图） | 路径引用方式有误 | 确保图片存放在 `public/` 目录下（如 `public/diagram.png`），在 Markdown 中以绝对路径引用：`![](/diagram.png)` |
| PowerShell 提示无法加载脚本（策略受限） | 系统默认 ExecutionPolicy 限制执行 ps1 | 使用 `npm run dev` 运行，或在 PowerShell 执行：<br>`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |
| 无法使用 `npm run export` 导出 PDF | 缺少 Chromium 浏览器内核 | 运行 `npx playwright install chromium` 安装必要内核 |
