import { describe, expect, it } from "vitest"
import {
  getPlatform,
  getRuntimeModule,
  getRuntimeProcess,
  getRuntimeRequire,
  isDesktopEnvironment,
  resolvePhysicalPath,
} from "../src/engine/runtime-node"

describe("runtime-node (跨端 Node/Electron 自适应适配器)", () => {
  it("在当前 Node 测试环境下应能检测为桌面环境", () => {
    expect(isDesktopEnvironment()).toBe(true)
  })

  it("应能获取正确的平台标识", () => {
    const platform = getPlatform()
    expect(["win32", "darwin", "linux"]).toContain(platform)
  })

  it("应能安全获取 process 对象", () => {
    const proc = getRuntimeProcess()
    expect(proc).toBeDefined()
    expect(proc?.versions?.node).toBeDefined()
  })

  it("应能安全加载原生模块", () => {
    const cp = getRuntimeModule("child_process")
    expect(cp).toBeDefined()
    expect(typeof cp?.spawn).toBe("function")
    expect(typeof cp?.execFile).toBe("function")

    const net = getRuntimeModule("net")
    expect(net).toBeDefined()
    expect(typeof net?.createServer).toBe("function")
  })

  it("resolvePhysicalPath 应正确转换虚拟与物理路径", () => {
    // 绝对路径原样返回
    expect(resolvePhysicalPath("C:/test/path.md")).toBe("C:/test/path.md")
    expect(resolvePhysicalPath("D:\\test\\path.md")).toBe("D:/test/path.md")

    // 虚拟路径无 window.siyuan 时保持原样
    expect(resolvePhysicalPath("/data/storage/petal/slides.md")).toBe("/data/storage/petal/slides.md")

    // 模拟 window.siyuan.config.system.dataDir
    ;(globalThis as any).window = {
      siyuan: {
        config: {
          system: {
            dataDir: "D:/siyuan-plugin-test/data",
          },
        },
      },
    }

    expect(resolvePhysicalPath("/data/storage/petal/slides.md")).toBe(
      "D:/siyuan-plugin-test/data/storage/petal/slides.md",
    )

    delete (globalThis as any).window
  })
})
