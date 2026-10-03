import { describe, expect, it, vi } from "vitest"
import { NativeEnvDetector } from "../src/engine/env-detector"

describe("NativeEnvDetector (本地环境探测器)", () => {
  it("在已安装 Node 与 Slidev 的环境下应正确检测并返回版本号", async () => {
    const mockRunner = vi.fn().mockImplementation((cmd: string, args: string[]) => {
      if (cmd === "node" && args[0] === "-v") {
        return Promise.resolve({ code: 0, stdout: "v20.10.0", stderr: "" })
      }
      if (args[0] === "@slidev/cli") {
        return Promise.resolve({ code: 0, stdout: "53.0.0", stderr: "" })
      }
      return Promise.resolve({ code: 1, stdout: "", stderr: "command not found" })
    })

    const detector = new NativeEnvDetector(mockRunner)
    const status = await detector.detect()

    expect(status.hasNode).toBe(true)
    expect(status.nodeVersion).toBe("v20.10.0")
    expect(status.hasSlidevCli).toBe(true)
    expect(status.slidevVersion).toBe("53.0.0")
    expect(status.isDesktop).toBe(true)
  })

  it("在未安装 Slidev CLI 时应正确标记 hasSlidevCli 为 false", async () => {
    const mockRunner = vi.fn().mockImplementation((cmd: string, args: string[]) => {
      if (cmd === "node") {
        return Promise.resolve({ code: 0, stdout: "v18.17.0", stderr: "" })
      }
      return Promise.resolve({ code: 1, stdout: "", stderr: "package not found" })
    })

    const detector = new NativeEnvDetector(mockRunner)
    const status = await detector.detect()

    expect(status.hasNode).toBe(true)
    expect(status.hasSlidevCli).toBe(false)
  })
})
