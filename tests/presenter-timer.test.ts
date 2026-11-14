import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { usePresenterTimer } from "../src/ui/tab/usePresenterTimer"

describe("usePresenterTimer (演讲者视图计时器与挂钟 FSM)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("初始状态下计时器运行，耗时为 0，格式化输出为 00:00", () => {
    const { elapsedSeconds, isTimerRunning, formattedTime } = usePresenterTimer()
    expect(elapsedSeconds.value).toBe(0)
    expect(isTimerRunning.value).toBe(true)
    expect(formattedTime.value).toBe("00:00")
  })

  it("时间推移后 updateTimerTick 能正确累加并更新 formattedTime", () => {
    const { elapsedSeconds, formattedTime, updateTimerTick } = usePresenterTimer()
    
    vi.advanceTimersByTime(3500)
    updateTimerTick()
    expect(elapsedSeconds.value).toBe(3)
    expect(formattedTime.value).toBe("00:03")

    vi.advanceTimersByTime(65000)
    updateTimerTick()
    expect(elapsedSeconds.value).toBe(68)
    expect(formattedTime.value).toBe("01:08")
  })

  it("toggleTimer 能正确暂停与恢复计时，暂停期间时间不累加", () => {
    const { elapsedSeconds, isTimerRunning, toggleTimer, updateTimerTick } = usePresenterTimer()
    
    vi.advanceTimersByTime(2000)
    updateTimerTick()
    expect(elapsedSeconds.value).toBe(2)

    // 暂停计时
    toggleTimer()
    expect(isTimerRunning.value).toBe(false)

    // 暂停中快进 5 秒
    vi.advanceTimersByTime(5000)
    updateTimerTick()
    expect(elapsedSeconds.value).toBe(2)

    // 恢复计时
    toggleTimer()
    expect(isTimerRunning.value).toBe(true)

    // 恢复后再跑 3 秒
    vi.advanceTimersByTime(3000)
    updateTimerTick()
    expect(elapsedSeconds.value).toBe(5)
  })

  it("resetTimer 能将累计时间重置为 0", () => {
    const { elapsedSeconds, resetTimer, updateTimerTick } = usePresenterTimer()
    
    vi.advanceTimersByTime(10000)
    updateTimerTick()
    expect(elapsedSeconds.value).toBe(10)

    resetTimer()
    expect(elapsedSeconds.value).toBe(0)
  })

  it("updateWallClock 能根据现实时间正确格式化 HH:mm", () => {
    const { wallClockTime, updateWallClock } = usePresenterTimer()
    vi.setSystemTime(new Date(2026, 10, 14, 15, 30, 0))
    updateWallClock()
    expect(wallClockTime.value).toBe("15:30")

    vi.setSystemTime(new Date(2026, 10, 14, 9, 5, 0))
    updateWallClock()
    expect(wallClockTime.value).toBe("09:05")
  })
})
