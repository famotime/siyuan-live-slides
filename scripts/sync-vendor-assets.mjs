/**
 * vendored 静态资产同步脚本
 *
 * public/slides-client/assets/ 内的第三方库副本（vendored copies）随离线单文件
 * 演示包分发。本脚本将「node_modules 中仍存在对应分发文件」的依赖同步为当前
 * 锁定版本，防止 vendored 副本悄悄落后于 package.json 依赖版本。
 *
 * 同步矩阵：
 *   - html-to-image            → node_modules/html-to-image/dist/html-to-image.js（可自动同步）
 *   - @unocss/runtime          → 自 v66 起 npm 包不再分发 attributify.global 独立构建，
 *                                vendored unocss.attributify.global.js 无包内对应物，
 *                                仅做存在性提醒，需人工经 UnoCSS 构建或 CDN 重新生成
 *
 * 用法：pnpm run sync:vendor
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const assetsDir = path.join(projectRoot, "public/slides-client/assets")

let hasChange = false
let hasWarning = false

function readPackageVersion(pkgName) {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, "node_modules", pkgName, "package.json"), "utf-8")).version
  } catch {
    return null
  }
}

function readVendoredVersionComment(fileName) {
  const head = fs.readFileSync(path.join(assetsDir, fileName), "utf-8").slice(0, 400)
  const match = head.match(/version["']?\s*[:=]\s*["']?([\w.\-]+)/i)
  return match ? match[1] : null
}

// 1. html-to-image：npm 包内即分发构建产物，直接对拷
{
  const pkgVersion = readPackageVersion("html-to-image")
  const source = path.join(projectRoot, "node_modules/html-to-image/dist/html-to-image.js")
  const target = path.join(assetsDir, "html-to-image.js")

  if (!pkgVersion || !fs.existsSync(source)) {
    console.warn("⚠ html-to-image 未安装或缺少 dist 构建产物，跳过同步（请先 pnpm install）")
    hasWarning = true
  } else {
    fs.mkdirSync(assetsDir, { recursive: true })
    const before = fs.existsSync(target) ? fs.readFileSync(target) : null
    const after = fs.readFileSync(source)
    if (before && before.equals(after)) {
      console.log(`✓ html-to-image vendored 副本已是最新（${pkgVersion}）`)
    } else {
      fs.writeFileSync(target, after)
      console.log(`✓ html-to-image vendored 副本已同步至 ${pkgVersion}`)
      hasChange = true
    }
  }
}

// 2. @unocss/runtime：npm 包已无 attributify.global 独立构建，仅提醒
{
  const pkgVersion = readPackageVersion("@unocss/runtime")
  const target = path.join(assetsDir, "unocss.attributify.global.js")
  if (!fs.existsSync(target)) {
    console.warn("⚠ public/slides-client/assets/unocss.attributify.global.js 缺失，离线沙箱 UnoCSS 运行时将不可用")
    hasWarning = true
  } else {
    const distDir = path.join(projectRoot, "node_modules/@unocss/runtime/dist")
    const hasAttributifyBuild = fs.existsSync(distDir)
      && fs.readdirSync(distDir).some(f => /attributify/i.test(f))
    if (!hasAttributifyBuild) {
      console.log(`ℹ @unocss/runtime（${pkgVersion ?? "未安装"}）npm 包自 v66 起不再分发 attributify.global 独立构建；`)
      console.log("  vendored unocss.attributify.global.js 需人工重新生成（UnoCSS 构建或官方 CDN），本次保持原样")
    } else {
      console.log("ℹ 检测到包内 attributify 构建，请人工确认后替换 vendored 副本（不同构建入口可能内联插件集）")
    }
  }
}

if (hasChange) {
  console.log("\n已完成同步，请重新 pnpm run build 使 dist/package.zip 携带最新资产")
} else if (hasWarning) {
  process.exitCode = 1
} else {
  console.log("\n所有可自动同步的 vendored 资产均已一致")
}
