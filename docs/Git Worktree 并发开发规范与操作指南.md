# Git Worktree 并发开发规范与操作指南

## 1. 为什么使用 Worktree 进行插件开发

在 `siyuan-slidev` 的持续迭代中，我们经常遇到以下场景：
1. **大型新特性开发周期长**：例如 Slidev 导入引擎与多格式解包，在未完全稳定前不宜污染 `main` 分支；
2. **紧急 Bugfix 与版本发布**：开发进行到一半时，需要基于 `main` 快速切出补丁分支打 Tag 发布，传统 `git stash` 容易导致未完成代码混乱或本地构建产物污染；
3. **思源测试环境联调隔离**：可在独立目录中运行单元测试与类型检查，保持主工作区整洁。

Git Worktree 允许同一个 Git 仓库在不同目录中同时检出多个不同分支，各目录共享底层的 `.git` 对象和提交历史，实现真正的「多工作区物理隔离并行开发」。

---

## 2. 工程化配置与痛点解决

针对思源笔记插件项目的开发特点，本项目已完成以下基础设施准备：

### 2.1 目录规划与 Git 忽略规则
- 统一将项目内创建的工作树存放在根目录的 `.worktrees/<branch-name>/` 下；
- `.gitignore` 中已预先配置忽略 `.worktrees/` 与 `worktrees/`，杜绝子工作区被 Git 识别为嵌套 submodule 或 untracked 文件。

### 2.2 `.env` 私有环境变量自动流转
- 思源插件开发强依赖 `.env` 中的 `VITE_SIYUAN_WORKSPACE_PATH`（指向思源测试笔记本工作空间，如 `D:/siyuan-plugin-test`）；
- 使用原生 `git worktree add` 时，新工作区由于 Git 忽略不会包含 `.env`，导致新目录无法正常构建和推送插件；
- 本项目内置的 `worktree:add` 脚本会在检出新工作树后**自动将主工作区的 `.env` 复制到新工作区**，开箱即用。

### 2.3 依赖安装与磁盘优化
- 本项目使用 `pnpm` 作为包管理器；
- `pnpm` 的全局硬链接（Content-Addressable Store）机制天然与 Worktree 完美配合：即便每个 Worktree 都有独立的 `node_modules`，相同版本的依赖包也只占用一份全局磁盘空间。

---

## 3. 常用命令与操作示例

本项目在 `package.json` 中预置了便捷的 Worktree 管理脚本：

### 3.1 创建新工作区（一键自动化）
```bash
# 语法：pnpm run worktree:add <分支名> [基础分支] [--skip-install]

# 示例 1：基于 main 分支创建并检出特性分支
pnpm run worktree:add feat/slidev-importer main

# 示例 2：快速检出热修复分支（跳过自动依赖安装）
pnpm run worktree:add fix/ui-layout-jump main --skip-install
```
**脚本执行动作：**
1. 校验分支，自动调用 `git worktree add` 检出至 `.worktrees/<branch-name>`；
2. 自动同步主工程的 `.env` 配置文件；
3. 自动在新目录中执行 `pnpm install` 安装依赖；
4. 输出快捷进入与启动命令指引。

---

### 3.2 查看所有活跃工作区
```bash
pnpm run worktree:list
```
**输出示例：**
```text
📋 当前活跃的 Git Worktrees 列表:

  👉 D:/MyCodingProjects/siyuan-slidev [main] (当前目录)
     commit: 6f4d561a

     D:/MyCodingProjects/siyuan-slidev/.worktrees/feat-slidev-importer [feat/slidev-importer]
     commit: 6f4d561a
```

---

### 3.3 移除工作区（清理与回收）
在特性分支开发完成并合并（或放弃）后，执行清理：
```bash
# 语法：pnpm run worktree:remove <分支名或路径> [--force]
pnpm run worktree:remove feat/slidev-importer
```
**脚本执行动作：**
1. 查找并验证对应的工作树目录；
2. 执行 `git worktree remove` 安全解绑与删除目录；
3. 自动执行 `git worktree prune` 清理 Git 内部缓存的失效引用。

---

## 4. 与思源笔记联调的注意事项

1. **Vite 监听构建争用防护**：
   - 主工作区和各子工作区共享同一个思源测试库输出目录（`VITE_SIYUAN_WORKSPACE_PATH/data/plugins/siyuan-slidev`）；
   - **强烈建议：** 同一时间只在某一个工作区内运行 `pnpm dev`（监听构建），避免双进程同时写盘引起构建冲突；
   - 如需同时调试两个分支的版本，可临时在其中一个工作区的 `.env` 中调整 `VITE_DEV_DIST_DIR` 或使用不同的测试空间。

2. **单元测试与类型检查并行化**：
   - `pnpm test` (Vitest) 与 `pnpm run typecheck` (tsc) 在各自工作区内完全独立运行，互不干扰，支持全并行验证。

3. **代码提交规范**：
   - 无论在主工作区还是在子 Worktree 中，所有提交均须严格遵循项目约定式提交规范：
     `<type>(<scope>): <简要说明增加的特性或解决的具体问题>`
