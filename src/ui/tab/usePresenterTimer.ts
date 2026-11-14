import { ref, computed } from 'vue'

/**
 * 演讲者控制台时长计时器与挂钟服务 (FSM-8 绝对时间戳防漂移体系)
 */
export function usePresenterTimer() {
  const elapsedSeconds = ref(0)
  const isTimerRunning = ref(true)
  let timerInterval: number | null = null
  let timerStartedAt = Date.now()
  let accumulatedElapsedMs = 0

  const formattedTime = computed(() => {
    const m = String(Math.floor(elapsedSeconds.value / 60)).padStart(2, '0')
    const s = String(elapsedSeconds.value % 60).padStart(2, '0')
    return `${m}:${s}`
  })

  function updateTimerTick() {
    if (isTimerRunning.value) {
      const totalMs = accumulatedElapsedMs + (Date.now() - timerStartedAt)
      elapsedSeconds.value = Math.floor(totalMs / 1000)
    }
  }

  function toggleTimer() {
    if (isTimerRunning.value) {
      accumulatedElapsedMs += Date.now() - timerStartedAt
      isTimerRunning.value = false
    } else {
      timerStartedAt = Date.now()
      isTimerRunning.value = true
      updateTimerTick()
    }
  }

  function resetTimer() {
    timerStartedAt = Date.now()
    accumulatedElapsedMs = 0
    elapsedSeconds.value = 0
  }

  // 现实时间时钟 (Wall Clock)
  const wallClockTime = ref('')
  let clockInterval: number | null = null

  function updateWallClock() {
    const now = new Date()
    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    wallClockTime.value = `${h}:${m}`
  }

  function startTimers() {
    timerStartedAt = Date.now()
    accumulatedElapsedMs = 0
    if (typeof window !== 'undefined') {
      timerInterval = window.setInterval(updateTimerTick, 500)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', updateTimerTick)
    }

    updateWallClock()
    if (typeof window !== 'undefined') {
      clockInterval = window.setInterval(updateWallClock, 1000)
    }
  }

  function stopTimers() {
    if (timerInterval && typeof window !== 'undefined') {
      window.clearInterval(timerInterval)
      timerInterval = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', updateTimerTick)
    }
    if (clockInterval && typeof window !== 'undefined') {
      window.clearInterval(clockInterval)
      clockInterval = null
    }
  }

  return {
    elapsedSeconds,
    isTimerRunning,
    formattedTime,
    wallClockTime,
    toggleTimer,
    resetTimer,
    updateTimerTick,
    updateWallClock,
    startTimers,
    stopTimers,
  }
}
