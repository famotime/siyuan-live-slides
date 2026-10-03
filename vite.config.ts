/* eslint-disable node/prefer-global/process */
import fs from "node:fs"
import path, { resolve } from "node:path"
import vue from "@vitejs/plugin-vue"
import fg from "fast-glob"
import minimist from "minimist"
import livereload from "rollup-plugin-livereload"
import {
  defineConfig,
  loadEnv,
} from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"
import zipPack from "vite-plugin-zip-pack"

const pluginInfo = require("./plugin.json")

function syncToSiyuanPlugin(targetDir: string) {
  return {
    name: "sync-to-siyuan",
    closeBundle() {
      if (!targetDir || !fs.existsSync(path.dirname(targetDir))) {
        return
      }
      try {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
        }
        // 清理目标目录中的所有遗留 .cjs 文件
        const files = fs.readdirSync(targetDir)
        for (const file of files) {
          if (file.endsWith(".cjs")) {
            fs.unlinkSync(path.join(targetDir, file))
          }
        }
        // 复制 dist 下所有最新产物至思源工作空间插件目录
        if (fs.existsSync("./dist")) {
          const distFiles = fs.readdirSync("./dist")
          for (const file of distFiles) {
            const srcPath = path.join("./dist", file)
            const destPath = path.join(targetDir, file)
            fs.cpSync(srcPath, destPath, {
              recursive: true,
              force: true,
            })
          }
          console.log(`\n[Sync] 成功将最新单文件插件同步至思源插件目录:\n${targetDir}`)
        }
      } catch (err) {
        console.warn("\n[Sync] 同步插件至思源目录时出现警告:", err)
      }
    },
  }
}

export default defineConfig(({
  mode,
}) => {

  console.log('mode=>', mode)
  const env = loadEnv(mode, process.cwd())
  const {
    VITE_SIYUAN_WORKSPACE_PATH,
  } = env
  console.log('env=>', env)


  const siyuanWorkspacePath = VITE_SIYUAN_WORKSPACE_PATH
  let devDistDir = './dev'
  if (!siyuanWorkspacePath) {
    console.log("\nSiyuan workspace path is not set.")
  } else {
    console.log(`\nSiyuan workspace path is set:\n${siyuanWorkspacePath}`)
    devDistDir = `${siyuanWorkspacePath}/data/plugins/${pluginInfo.name}`
  }
  console.log(`\nPlugin will build to:\n${devDistDir}`)

  const args = minimist(process.argv.slice(2))
  const isWatch = args.watch || args.w || false
  const distDir = isWatch ? devDistDir : "./dist"

  console.log()
  console.log("isWatch=>", isWatch)
  console.log("distDir=>", distDir)

  return {
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },

    plugins: [
      vue(),
      viteStaticCopy({
        targets: [
          {
            src: "./README*.md",
            dest: "./",
          },
          {
            src: "./icon.*",
            dest: "./",
          },
          {
            src: "./preview.*",
            dest: "./",
          },
          {
            src: "./plugin.json",
            dest: "./",
          },
          {
            src: "./src/i18n/**",
            dest: "./i18n/",
          },
          {
            src: "./public/slidev-client/**",
            dest: "./slidev-client/",
          },
        ],
      }),
      syncToSiyuanPlugin(devDistDir),
    ],

    // https://github.com/vitejs/vite/issues/1930
    // https://vitejs.dev/guide/env-and-mode.html#env-files
    // https://github.com/vitejs/vite/discussions/3058#discussioncomment-2115319
    // 在这里自定义变量
    define: {
      "process.env.DEV_MODE": `"${isWatch}"`,
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    },

    build: {
      // 输出路径
      outDir: distDir,
      emptyOutDir: !isWatch,

      // 构建后是否生成 source map 文件
      sourcemap: false,

      // 设置为 false 可以禁用最小化混淆
      // 或是用来指定是应用哪种混淆器
      // boolean | 'terser' | 'esbuild'
      // 不压缩，用于调试
      minify: !isWatch,

      lib: {
        // Could also be a dictionary or array of multiple entry points
        entry: {
          index: resolve(__dirname, "src/index.ts"),
          kernel: resolve(__dirname, "src/kernel.ts"),
        },
        formats: ["cjs"],
      },
      rollupOptions: {
        plugins: [
          ...(isWatch
            ? [
                livereload(devDistDir),
                {
                  // 监听静态资源文件
                  name: "watch-external",
                  async buildStart() {
                    const files = await fg([
                      "src/i18n/*.json",
                      "./README*.md",
                      "./plugin.json",
                    ])
                    for (const file of files) {
                      this.addWatchFile(file)
                    }
                  },
                },
              ]
            : [
                zipPack({
                  inDir: "./dist",
                  outDir: "./",
                  outFileName: "package.zip",
                }),
              ]),
        ],

        // make sure to externalize deps that shouldn't be bundled
        // into your library
        external: ["siyuan", "process"],

        output: {
          entryFileNames: "[name].js",
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith(".css")) {
              return "index.css"
            }
            return assetInfo.name || "index.css"
          },
        },
      },
    },
  }
})
