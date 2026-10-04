# SiYuan Slidev Pro 模式系统配置与用户指南

> 本文档针对 **SiYuan Slidev（思源笔记 Slidev 演示插件）** 的「官方原生 Pro 模式（Pro CLI 引擎）」提供完整的本地系统环境配置、验证诊断以及日常使用操作指南。

---

## 1. 为什么需要 Pro 模式？（双轨架构解析）

SiYuan Slidev 创新性地采用了**双轨演示渲染引擎架构**：

| 维度 | 内置高保真沙箱 (`web-sandbox`) | 官方原生 Pro 模式 (`pro-cli`) |
| :--- | :--- | :--- |
| **运行机制** | 纯前端 iframe 沙箱，零外部依赖秒启 | 桌面端拉起官方 Slidev CLI DevServer 守护进程 |
| **依赖环境** | 任何环境均可（包括纯 Web 端、移动端） | 本地宿主系统具备 Node.js 运行时与 Slidev CLI |
| **渲染能力** | Markdown-it + Shiki 代码高亮 + UnoCSS 样式 | 100% 官方 Vue 3 原生渲染、UnoCSS、Vue SFC 组件、Mermaid、Monaco 编辑器 |
| **生态扩展** | 基础布局与内置动画 | 支持完整的 npm / Slidev 主题扩展与前端生态库 |
| **演讲功能** | 基础双向跟随、全屏放映 | 演讲者视图 (`/presenter`)、总览大纲 (`/overview`)、录制与导出 (`/export`)、绘图涂鸦标注 |

在日常快速记录和轻量演示时，默认的「内置沙箱」可做到**开箱即用、零延迟**；当需要**正式大型演讲、高度定制的主题、Vue 动态交互组件**时，一键切换至「Pro 模式」即可享受完整的现代前端级演示体验。

---

## 2. 系统环境配置要求

为在本机顺利启用 Pro 模式，宿主系统需具备以下基础环境：

1. **操作系统**：Windows 10/11、macOS 或 Linux
2. **思源笔记**：桌面客户端（基于 Electron，支持拉起本地子进程）
3. **Node.js**：`>= 18.0.0`（推荐 LTS 20.x 或 22.x，本机已配置 `v22.18.0`）
4. **包管理器**：`npm` / `pnpm` / `yarn`（系统自带）
5. **核心工具包**：
   - `@slidev/cli`：Slidev 官方命令行核心工具
   - `@slidev/theme-default`：Slidev 官方默认主题包

---

## 3. 本机快速配置步骤

### 步骤 1：检查本地 Node.js 环境

打开系统的终端（Windows PowerShell / cmd，或 macOS / Linux 终端），运行以下命令检查 Node.js 与 npm 是否已安装：

```bash
node -v
npm -v
```

- 若输出版本号形如 `v22.18.0`，说明 Node.js 环境正常。
- 若提示找不到命令，请前往 [Node.js 官方网站](https://nodejs.org/) 下载并安装 LTS 版本。

### 步骤 2：全局安装 Slidev CLI 与核心主题

在终端中执行全局安装命令，将 Slidev CLI 工具及默认主题安装至系统全局环境中：

```bash
npm install -g @slidev/cli @slidev/theme-default
```

> [!TIP] 网络加速建议
> 如果在国内网络环境下安装较慢，建议配置 npm 淘宝镜像源：
> ```bash
> npm config set registry https://registry.npmmirror.com
> npm install -g @slidev/cli @slidev/theme-default
> ```

### 步骤 3：配置常用第三方主题（可选，按需扩展）

如果希望使用社区高颜值主题，可按需全局安装：

```bash
npm install -g @slidev/theme-seriph @slidev/theme-apple-basic
```

---

## 4. 验证配置是否成功

### 4.1 终端命令直接验证

在终端中执行以下命令，验证 Slidev CLI 是否可直接全局调用：

```bash
slidev --version
```

- **预期输出**：`53.0.0`（或当前最新版本号）。
- **执行耗时**：全局安装后，该命令应在 1 秒内迅速响应。

### 4.2 插件底层环境探测器验证

SiYuan Slidev 内置了跨平台环境探测器 [`NativeEnvDetector`](file:///d:/MyCodingProjects/siyuan-slidev/src/engine/env-detector.ts)。

当配置就绪后，探测器会自动检测到宿主环境状态：

```json
{
  "hasNode": true,
  "nodeVersion": "v22.18.0",
  "hasSlidevCli": true,
  "slidevVersion": "53.0.0",
  "platform": "win32",
  "isDesktop": true
}
```

通过运行项目自动化测试即可一键验证环境联通性：

```bash
npx vitest run tests/env-detector.test.ts
```

- **预期结果**：3 个测试用例全部通过，其中宿主环境检测项输出 `hasNode: true` 与 `hasSlidevCli: true`。

### 4.3 独立本地服务拉起测试

在任意临时目录下创建简单的测试演示文件 `test.md`：

```markdown
---
theme: default
---

# Hello Slidev Pro

配置成功！欢迎使用 SiYuan Slidev Pro 模式。
```

在同级目录下运行：

```bash
slidev test.md --port 3030 --no-open
```

在浏览器中打开 `http://localhost:3030/`，若能正常渲染幻灯片，则证明底层 Slidev DevServer 工作完全正常！

---

## 5. 在思源笔记中体验与使用 Pro 模式

### 5.1 打开下方分屏预览

1. 在思源笔记中打开任意需要演示的文档。
2. 点击右上角插件栏的 **「Slidev: 打开演示预览」** 图标（或在快捷命令面板中搜索执行）。
3. 编辑器下方将自动唤起分屏预览窗口，默认以**内置高保真沙箱**模式启动。

### 5.2 一键切换到 Pro 模式

1. 在预览窗口顶部的操作工具栏中，找到引擎切换按钮（默认文字为 **「沙箱」**）。
2. 单击该按钮，插件将自动执行以下全自动编排流程：
   - 自动检测本地 Node 与 Slidev CLI 环境变量；
   - 自动在思源临时存储区编排 `slides.md` 与 `package.json`；
   - 自动寻找空闲端口（默认 `3030`，若被占用则顺延尝试 `3031...`）；
   - 后台静默拉起官方 Slidev 子进程；
   - 轮询健康探活就绪后，将 iframe 切换为官方 DevServer；
   - 右上角弹出提示：`🟢 已成功接入官方原生 Slidev 服务 (端口: 3030)`，按钮状态变为 **「Pro (3030)」**。

### 5.3 享受官方 Pro 级演讲体验

切换至 Pro 模式后，可以体验以下官方完整特性：

- **极客全功能导航**：点击右下角官方操作栏，支持总览大纲、画笔涂鸦、黑屏遮罩。
- **演讲者双屏模式**：在浏览器单独打开 `http://localhost:3030/presenter/`，可在主屏幕放映幻灯片的同时，在副屏查看当前页耗时、下一页预览和思源块中记录的私密演讲者备注。
- **动态编辑即时同步**：在思源主编辑区继续修改文档时，插件会自动将变更无缝同步至底层工作空间，Slidev 自动热重载更新。
- **优雅切回沙箱**：再次单击 **「Pro (3030)」** 按钮，插件将安全销毁后台子进程，释放端口并优雅回退至轻量内置沙箱。

---

## 6. 常见问题排查与 FAQ

### Q1: 点击切换 Pro 模式时提示“当前系统未检测到 Node.js 环境”？
- **原因分析**：
  1. 思源笔记插件运行在 Electron 渲染进程中，受浏览器沙箱隔离限制，常规纯前端检测无法直接访问 Node 原生对象；
  2. 插件已内置自适应桥接器 [`runtime-node.ts`](file:///d:/MyCodingProjects/siyuan-slidev/src/engine/runtime-node.ts)，能自动穿透识别 Electron 底层 Node.js 运行时与注入系统 PATH 环境变量；
  3. 若刚更新了插件或修改了环境变量，思源笔记客户端仍缓存着旧版内存实例。
- **解决与生效办法**：
  1. **刷新或重载插件**：在思源笔记主界面按下 `Ctrl + F5`（或在「设置 -> 集市 -> 已安装插件」中将 `siyuan-slidev` 开关关闭再重新打开）；
  2. **确保运行于桌面客户端**：官方 Pro 模式依赖本地子进程，仅支持在桌面端客户端（Windows / macOS / Linux）运行，纯网页版 Web/移动端请继续使用零依赖的「内置高保真沙箱」；
  3. **重启客户端**：若系统环境变量 PATH 刚做过修改，完全退出并重启思源笔记客户端即可自动加载最新系统 PATH。

### Q2: 提示“无法启动官方 Pro 模式：Slidev DevServer 启动超时”？
- **原因**：可能由于首次运行未全局安装 `@slidev/cli` 导致 `npx` 临时下载超时，或者端口被冲突占用。
- **解决办法**：
  1. 按照本文第 3 节在终端执行 `npm install -g @slidev/cli @slidev/theme-default` 进行全局安装；
  2. 插件具备 20 个端口的自动避让重试机制，如果特定端口被占用，插件会自动顺延分配。

### Q3: Windows 系统下如何确认没有残留的后台 node 进程？
- **排查命令**：
  ```powershell
  Get-Process -Name "node" -ErrorAction SilentlyContinue
  ```
- **一键清理（若需手动释放）**：
  ```powershell
  Stop-Process -Name "node" -Force
  ```
  *(注：插件在关闭预览标签页或点击切回沙箱时，均会自动触发 `processManager.stopServer()` 级联杀死进程树，通常无需手动清理)*。

### Q4: 启动 Pro 模式后思源笔记提示“实例异常退出 / File system access failed”？
- **原因剖析**：
  1. Slidev CLI (Vite DevServer) 运行期间，其文件监听器（Chokidar）会持续持有 `slides.md` 的读句柄；
  2. 若将工作空间存放在思源数据目录（`/data/...`）并通过思源内核 API 写入，思源 Golang 内核在原子替换文件时（写 `.tmp` 后执行 `os.Rename`）会因 Windows 系统的只读锁限制抛出 `Access is denied`，触发内核致命错误退出。
- **全新安全隔离设计**：
  - 插件已重构编排机制：Pro 模式临时工作空间默认重定向至系统独立临时目录（`%TEMP%/siyuan-slidev-pro`），完全脱离思源笔记的数据监视范围；
  - 采用直接物理文件系统（`fs.writeFileSync`）写入，完全不调用思源内核文件写入接口，从底层根源彻底杜绝文件锁冲突与思源内核异常退出隐患。

### Q5: 演示第 5 页提示 `Code snippet path not found: snippets/external.ts`？
- **原因与机制**：
  - Slidev 支持代码切片语法（如 `<<< @/snippets/external.ts#snippet`），Slidev 官方 Starter 示例的第 5 页便使用了该切片语法；
  - 插件在 [`WorkspaceScaffolder`](file:///d:/MyCodingProjects/siyuan-slidev/src/engine/workspace-scaffolder.ts) 中内置了 AST 切片路径嗅探与自动占位生成机制，在启动与更新 Pro 模式时会自动在临时目录的 `snippets/` 下生成所需的示例代码切片，确保官方 Vite Markdown 插件编译平滑通过。

---

## 7. 相关代码与核心模块索引

- 双模引擎统一调度器：[`EngineManager`](file:///d:/MyCodingProjects/siyuan-slidev/src/engine/engine-manager.ts)
- 本地环境探测器：[`NativeEnvDetector`](file:///d:/MyCodingProjects/siyuan-slidev/src/engine/env-detector.ts)
- 子进程生命周期守护器：[`NativeSlidevProcessManager`](file:///d:/MyCodingProjects/siyuan-slidev/src/engine/process-manager.ts)
- 临时工程自动编排器：[`WorkspaceScaffolder`](file:///d:/MyCodingProjects/siyuan-slidev/src/engine/workspace-scaffolder.ts)
- 预览视图与模式切换按钮：[`SlidevPreviewTab.vue`](file:///d:/MyCodingProjects/siyuan-slidev/src/ui/tab/SlidevPreviewTab.vue)
- 环境探测器自动化测试套件：[`tests/env-detector.test.ts`](file:///d:/MyCodingProjects/siyuan-slidev/tests/env-detector.test.ts)
- 引擎调度器自动化测试套件：[`tests/engine.test.ts`](file:///d:/MyCodingProjects/siyuan-slidev/tests/engine.test.ts)
