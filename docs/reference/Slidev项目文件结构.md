可编辑的 Slidev 演示源码应按**一个 Git 仓库 / 一个项目目录**分享：核心是 `slides.md`，再附带 `package.json`、主题、组件、布局和静态资源。官方没有规定一份“强制完整目录清单”，但明确约定了入口文件、`components/`、`layouts/`、`public/` 等关键目录和 Markdown 语法。 [sli](https://sli.dev/guide/)

## 官方约定的核心格式

Slidev 的可编辑源文件就是 **Slidev Markdown**，默认入口为 `./slides.md`；也可把文件路径传给 CLI 使用其他入口。 [cn.sli](https://cn.sli.dev/guide/syntax.html)

- 幻灯片用 `---` 分隔。
- 第一块 frontmatter 是 `headmatter`，配置整份演示；后续 frontmatter 配置单页。
- frontmatter 使用 YAML，例如 `layout`、`background`、`class`。
- 可在幻灯片末尾用注释块写演讲者备注。 [cn.sli](https://cn.sli.dev/guide/syntax.html)
- 也可以用 `src: ./pages/4.md` 将某一页拆分到独立 Markdown 文件。 [cn.sli](https://cn.sli.dev/guide/syntax.html)

示例：

```md
---
# headmatter：整份演示的全局配置
theme: seriph
title: Slidev 源码分享
---

---
layout: cover
---

# Slidev 源码分享

Markdown + Vue 组件

---
layout: center
background: /architecture.png
---

## 架构

- Markdown 内容
- Vue 组件
- 静态资源

<!--
演讲备注：强调源码可复用、可版本控制。
-->
```

## 推荐分享结构

官方示例中，自定义组件放在 `components/`，自定义布局放在 `layouts/`；本地静态资源放在 `public/`，并以 `/xxx` 绝对路径引用。 [sli](https://sli.dev/guide/component)

```text
my-slidev-talk/
├─ slides.md                 # 官方默认入口：所有或主要幻灯片内容
├─ package.json              # 依赖、Slidev CLI 与构建/导出脚本
├─ pnpm-lock.yaml            # 锁定依赖，保证可复现
├─ .gitignore                # 忽略 node_modules、dist 等
├─ README.md                 # 在线地址、PDF 地址、运行说明
│
├─ components/               # 自定义 Vue 组件
│  ├─ ArchitectureDiagram.vue
│  └─ ToolComparison.vue
│
├─ layouts/                  # 自定义页面布局
│  ├─ Comparison.vue
│  └─ CodeDemo.vue
│
├─ pages/                    # 可选：把长演示按章节拆分
│  ├─ 01-intro.md
│  ├─ 02-architecture.md
│  └─ 03-demo.md
│
├─ public/                   # 图片、视频、字体、可下载文件
│  ├─ architecture.png
│  └─ resources.pdf
│
├─ styles/                   # 可选：全局样式、UnoCSS 配置
│  └─ custom.css
│
└─ slides-export.pdf         # 可选：只作为发布产物，不必纳入源码
```

## `package.json` 建议内容

官方推荐把常用 CLI 命令写进 `package.json` 的 `scripts`，这样接收者可以统一使用 `pnpm dev`、`pnpm build`、`pnpm export`。 

```json
{
  "name": "my-slidev-talk",
  "private": true,
  "scripts": {
    "dev": "slidev --open",
    "build": "slidev build",
    "export": "slidev export",
    "export:pdf": "slidev export --format pdf",
    "export:pptx": "slidev export --format pptx"
  },
  "dependencies": {
    "@slidev/cli": "^53.0.0",
    "@slidev/theme-seriph": "^0.30.0"
  }
}
```

接收者的使用流程应写进 `README.md`：

```bash
pnpm install
pnpm dev        # 本地编辑与预览
pnpm build      # 生成可部署静态网页
pnpm export     # 导出 PDF/PPTX/PNG
```

官方文档也说明 `slidev` 启动开发服务器，`slidev build` 构建静态网页，`slidev export` 导出 PDF、PPTX 或 PNG。 

## 分享方式

| 场景 | 推荐交付物 |
|---|---|
| 开源演讲、模板复用 | GitHub/GitLab 仓库，附 README、许可证和在线演示链接 |
| 团队协作 | Git 仓库 + 分支/PR 流程；敏感内容用私有仓库 |
| 一次性交付 | `zip` 压缩包，排除 `node_modules/` 与 `dist/` |
| 代码评审 | Git 分支或 PR，Markdown diff 很容易审阅 |
| AI 辅助修改 | 分享整个项目源码，尤其是 `slides.md`、`components/` 和 `styles/` |

## 需要避免的做法

- **不要只发 `slides.md`**：如果使用了自定义组件、布局、主题、图片或字体，对方无法完整运行。
- **不要提交 `node_modules/` 和 `dist/`**：前者体积大且可由 lockfile 恢复；后者是构建产物。
- **不要只发 PPTX 当作源码**：Slidev 的 PPTX 导出主要用于兼容 PowerPoint，不是可继续以 Slidev 方式编辑的源文件。官方将导出定位为 PDF、PPTX、PNG 或 Markdown 的分享/打印选项，而网页是 Slidev 的主要呈现形式。 
- **不要把本地资源散落在系统路径**：图片、视频、字体等应放入 `public/`，并用 `/file.png` 这类绝对路径引用。 [sli](https://sli.dev/guide/faq)

## 一个适合复用的 README 模板

```md
# Talk Title

基于 Slidev 的技术演示。

- 在线演示：https://your-domain.example/
- PDF：https://your-domain.example/slides.pdf
- 源码：本仓库

## 本地运行

pnpm install
pnpm dev

## 构建

pnpm build

## 导出

pnpm export:pdf
pnpm export:pptx

## 结构

- `slides.md`：演示入口
- `components/`：自定义 Vue 组件
- `layouts/`：自定义布局
- `public/`：静态资源
```

这样分享后，别人既能**直接打开在线版**，也能**本地修改 Markdown**，还能复用你的组件、布局与主题配置；这正是 Slidev 相比 PDF 或 PPTX 更适合开发者协作的地方。 [sli](https://sli.dev/guide/component)