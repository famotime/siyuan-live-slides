#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

function run(cmd, options = {}) {
  return execSync(cmd, {
    cwd: ROOT_DIR,
    encoding: 'utf-8',
    stdio: options.stdio || 'pipe',
    ...options,
  })
}

function printUsage() {
  console.log(`
\x1b[36m🔧 SiYuan Live Slides - Git Worktree 管理助手\x1b[0m

\x1b[33m用法:\x1b[0m
  pnpm run worktree:add <branch-name> [base-branch] [--skip-install]
      创建新的 worktree 工作区并自动配置 .env 与依赖

  pnpm run worktree:list
      列出当前所有绑定的 worktree 工作区

  pnpm run worktree:remove <branch-name-or-path> [--force]
      安全移除指定的 worktree 并清理 Git 元数据

\x1b[33m示例:\x1b[0m
  pnpm run worktree:add feat/slides-importer main
  pnpm run worktree:list
  pnpm run worktree:remove feat/slides-importer
`)
}

function getWorktreeList() {
  const output = run('git worktree list --porcelain')
  const worktrees = []
  const blocks = output.trim().split(/\r?\n\r?\n/)

  for (const block of blocks) {
    if (!block.trim()) continue
    const lines = block.split(/\r?\n/)
    const item = {}
    for (const line of lines) {
      if (line.startsWith('worktree ')) item.path = line.slice(9)
      else if (line.startsWith('HEAD ')) item.head = line.slice(5)
      else if (line.startsWith('branch ')) item.branch = line.slice(7).replace('refs/heads/', '')
      else if (line === 'bare') item.bare = true
      else if (line === 'detached') item.detached = true
    }
    if (item.path) worktrees.push(item)
  }
  return worktrees
}

function handleList() {
  console.log('\n\x1b[36m📋 当前活跃的 Git Worktrees 列表:\x1b[0m\n')
  const worktrees = getWorktreeList()
  const cwd = process.cwd().replace(/\\/g, '/').toLowerCase()

  for (const wt of worktrees) {
    const isCurrent = wt.path.replace(/\\/g, '/').toLowerCase() === cwd
    const branchLabel = wt.branch ? `\x1b[32m[${wt.branch}]\x1b[0m` : (wt.detached ? '\x1b[33m(detached)\x1b[0m' : '')
    const currentTag = isCurrent ? ' \x1b[35m(当前目录)\x1b[0m' : ''
    console.log(`  ${isCurrent ? '👉' : '  '} ${wt.path} ${branchLabel} ${currentTag}`)
    console.log(`     commit: \x1b[90m${wt.head?.slice(0, 8) || 'unknown'}\x1b[0m\n`)
  }
}

function handleAdd(args) {
  const skipInstall = args.includes('--skip-install')
  const positionalArgs = args.filter(a => !a.startsWith('--'))
  const branchName = positionalArgs[0]
  const baseBranch = positionalArgs[1] || 'HEAD'

  if (!branchName) {
    console.error('\x1b[31m❌ 错误: 请指定分支名称！\x1b[0m')
    printUsage()
    process.exit(1)
  }

  // 计算目标目录 (统一存放在 .worktrees/ 下)
  const sanitizedFolderName = branchName.replace(/[/\\:]/g, '-')
  const targetDir = path.resolve(ROOT_DIR, '.worktrees', sanitizedFolderName)

  if (existsSync(targetDir)) {
    console.error(`\x1b[31m❌ 错误: 目标目录已存在: ${targetDir}\x1b[0m`)
    process.exit(1)
  }

  // 检查分支是否已存在
  let branchExists = false
  try {
    run(`git show-ref --verify --quiet refs/heads/${branchName}`)
    branchExists = true
  } catch {
    branchExists = false
  }

  console.log(`\n\x1b[36m🚀 正在创建 Worktree: \x1b[32m${branchName}\x1b[36m -> \x1b[33m${targetDir}\x1b[0m...`)

  try {
    if (branchExists) {
      run(`git worktree add "${targetDir}" "${branchName}"`, { stdio: 'inherit' })
    } else {
      run(`git worktree add -b "${branchName}" "${targetDir}" "${baseBranch}"`, { stdio: 'inherit' })
    }
  } catch (err) {
    console.error('\x1b[31m❌ 创建 worktree 失败\x1b[0m', err)
    process.exit(1)
  }

  // 复制 .env 配置
  const rootEnvPath = path.join(ROOT_DIR, '.env')
  const targetEnvPath = path.join(targetDir, '.env')
  if (existsSync(rootEnvPath)) {
    console.log('\x1b[36m📄 正在同步 .env 环境变量到新工作区...\x1b[0m')
    copyFileSync(rootEnvPath, targetEnvPath)
  }

  // 安装依赖
  if (!skipInstall) {
    console.log('\x1b[36m📦 正在执行 pnpm install 准备依赖环境...\x1b[0m')
    try {
      execSync('pnpm install', { cwd: targetDir, stdio: 'inherit' })
    } catch (e) {
      console.warn('\x1b[33m⚠️ pnpm install 遇到警告或失败，请稍后在新目录内手动执行\x1b[0m')
    }
  }

  console.log(`\n\x1b[32m✅ Worktree [${branchName}] 已准备就绪！\x1b[0m\n`)
  console.log('\x1b[33m快速开始开发:\x1b[0m')
  console.log(`  \x1b[36mcd "${targetDir}"\x1b[0m`)
  console.log('  \x1b[36mpnpm dev\x1b[0m    # 启动开发监听构建')
  console.log('  \x1b[36mpnpm test\x1b[0m   # 运行测试\n')
}

function handleRemove(args) {
  const force = args.includes('--force')
  const positionalArgs = args.filter(a => !a.startsWith('--'))
  const target = positionalArgs[0]

  if (!target) {
    console.error('\x1b[31m❌ 错误: 请指定要移除的分支名或工作树路径！\x1b[0m')
    printUsage()
    process.exit(1)
  }

  const worktrees = getWorktreeList()
  const sanitizedFolderName = target.replace(/[/\\:]/g, '-')
  const expectedPath = path.resolve(ROOT_DIR, '.worktrees', sanitizedFolderName)

  const matched = worktrees.find(wt => {
    return wt.branch === target ||
      path.resolve(wt.path) === path.resolve(target) ||
      path.resolve(wt.path) === expectedPath
  })

  if (!matched) {
    console.error(`\x1b[31m❌ 未找到与 [${target}] 匹配的 active worktree。\x1b[0m`)
    handleList()
    process.exit(1)
  }

  console.log(`\x1b[33m🗑️ 正在移除 Worktree: ${matched.path} [${matched.branch || 'detached'}]...\x1b[0m`)
  const forceFlag = force ? '--force ' : ''
  try {
    run(`git worktree remove ${forceFlag}"${matched.path}"`, { stdio: 'inherit' })
    run('git worktree prune')
    console.log('\x1b[32m✅ Worktree 移除并清理完成！\x1b[0m\n')
  } catch (err) {
    console.error('\x1b[31m❌ 移除 worktree 失败。如果有未提交的更改，可使用 --force 参数强制删除。\x1b[0m')
    process.exit(1)
  }
}

// 主入口分发
const [action, ...restArgs] = process.argv.slice(2)

switch (action) {
  case 'add':
    handleAdd(restArgs)
    break
  case 'list':
  case 'ls':
    handleList()
    break
  case 'remove':
  case 'rm':
    handleRemove(restArgs)
    break
  case 'help':
  case '--help':
  case '-h':
    printUsage()
    break
  default:
    if (!action) {
      handleList()
    } else {
      console.error(`\x1b[31m未知命令: ${action}\x1b[0m`)
      printUsage()
      process.exit(1)
    }
}
