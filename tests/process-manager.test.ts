import { describe, expect, it, vi } from "vitest"
import { NativeSlidevProcessManager } from "../src/engine/process-manager"

describe("NativeSlidevProcessManager (官方进程生命周期与探活管理)", () => {
  it("allocPort 应能动态避开已占用端口", async () => {
    // 模拟 3030 被占用，3031 可用
    const customPortChecker = vi.fn().mockImplementation((port: number) => {
      return Promise.resolve(port !== 3030)
    })

    const manager = new NativeSlidevProcessManager({
      defaultPort: 3030,
      customPortChecker,
    })

    const port = await manager.allocPort()
    expect(port).toBe(3031)
    expect(customPortChecker).toHaveBeenCalledWith(3030)
    expect(customPortChecker).toHaveBeenCalledWith(3031)
  })

  it("startServer 应使用 mock spawner 成功启动并记录活动端口与状态", async () => {
    const mockKill = vi.fn()
    const mockProcess = {
      pid: 12345,
      kill: mockKill,
      on: vi.fn(),
    }
    const customSpawner = vi.fn().mockReturnValue(mockProcess)

    const manager = new NativeSlidevProcessManager({
      defaultPort: 3030,
      customSpawner,
      customPortChecker: () => Promise.resolve(true),
    })

    const res = await manager.startServer("/path/to/slides.md")

    expect(res.success).toBe(true)
    expect(res.port).toBe(3030)
    expect(res.url).toContain("http://localhost:3030?embedded=true")
    expect(manager.getActivePort()).toBe(3030)
    expect(manager.getIsRunning()).toBe(true)

    // 终止进程
    manager.stopServer()
    expect(manager.getIsRunning()).toBe(false)
    expect(manager.getActivePort()).toBeNull()
    expect(mockKill).toHaveBeenCalled()
  })
})
