/**
 * 轻量动画调度器运行时（CountUp 数字翻滚与 Typewriter 打字机）
 * 专为沙箱放映与离线单文件 HTML 设计，零外部依赖，使用 requestAnimationFrame 调度
 */

export interface ICountUpOptions {
  from?: number
  to: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
}

export interface ITypewriterOptions {
  duration?: number
  speed?: number
}

/**
 * 启动数字翻滚递增调度器
 */
export function startCountUp(el: HTMLElement, options: ICountUpOptions): () => void {
  const from = typeof options.from === "number" ? options.from : 0
  const to = typeof options.to === "number" ? options.to : 0
  const duration = options.duration || 1500
  const decimals = options.decimals ?? 0
  const prefix = options.prefix || ""
  const suffix = options.suffix || ""
  const startTime = performance.now()
  let rafId: number | null = null

  // 经典三次 Ease-Out 指数曲线
  const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

  function update(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(1, Math.max(0, elapsed / duration))
    const current = from + (to - from) * easeOutExpo(progress)
    el.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`
    if (progress < 1) {
      rafId = requestAnimationFrame(update)
    } else {
      rafId = null
    }
  }

  el.textContent = `${prefix}${from.toFixed(decimals)}${suffix}`
  rafId = requestAnimationFrame(update)

  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }
}

/**
 * 启动终端打字机效果
 */
export function startTypewriter(
  el: HTMLElement,
  fullText: string,
  options: ITypewriterOptions = {},
): () => void {
  const len = fullText.length
  if (len === 0) return () => {}
  const duration = options.duration || Math.max(500, Math.min(len * 50, 3000))
  const stepMs = duration / len
  let index = 0
  let timerId: any = null

  el.textContent = ""

  function step() {
    index++
    el.textContent = fullText.slice(0, index)
    if (index < len) {
      timerId = setTimeout(step, stepMs)
    } else {
      timerId = null
    }
  }

  timerId = setTimeout(step, stepMs)

  return () => {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
  }
}

/**
 * 扫描并触发容器内的所有微动效（数字翻滚、打字机）
 */
export function runSlideAnimations(container: HTMLElement): () => void {
  if (!container) return () => {}
  const cleanups: Array<() => void> = []

  const animNodes = container.querySelectorAll<HTMLElement>("[data-slides-anim]")
  animNodes.forEach((node) => {
    // 若配置了 v-click 且当前步处于隐藏状态，跳过播放
    if (node.classList.contains("v-click-hidden")) {
      return
    }

    const animType = node.getAttribute("data-slides-anim")
    if (animType === "countup") {
      const targetEl = node.querySelector<HTMLElement>(".slides-countup-target") || node
      if (!targetEl.getAttribute("data-anim-original")) {
        targetEl.setAttribute("data-anim-original", targetEl.textContent || "")
      }
      const toVal = parseFloat(node.getAttribute("data-countup-to") || "0")
      const fromVal = parseFloat(node.getAttribute("data-countup-from") || "0")
      const durationVal = parseInt(node.getAttribute("data-anim-duration") || "1500", 10)
      const decimalsVal = parseInt(node.getAttribute("data-countup-decimals") || "0", 10)
      const prefixVal = node.getAttribute("data-countup-prefix") || ""
      const suffixVal = node.getAttribute("data-countup-suffix") || ""

      const cancel = startCountUp(targetEl, {
        from: fromVal,
        to: toVal,
        duration: durationVal,
        decimals: decimalsVal,
        prefix: prefixVal,
        suffix: suffixVal,
      })
      cleanups.push(cancel)
    } else if (animType === "typewriter") {
      const targetEl = node.querySelector<HTMLElement>("p, h1, h2, h3, h4, h5, h6, span, code") || node
      if (!targetEl.getAttribute("data-anim-original")) {
        targetEl.setAttribute("data-anim-original", targetEl.textContent || "")
      }
      const fullText = targetEl.getAttribute("data-anim-original") || targetEl.textContent || ""
      const durationVal = parseInt(node.getAttribute("data-anim-duration") || "1500", 10)
      const cancel = startTypewriter(targetEl, fullText, { duration: durationVal })
      cleanups.push(cancel)
    }
  })

  return () => {
    cleanups.forEach((c) => c())
  }
}

/**
 * 重置容器内的微动效为初始/就绪状态
 */
export function resetSlideAnimations(container: HTMLElement): void {
  if (!container) return
  const animNodes = container.querySelectorAll<HTMLElement>("[data-slides-anim]")
  animNodes.forEach((node) => {
    const targetEl = node.querySelector<HTMLElement>(".slides-countup-target") || node
    const original = targetEl.getAttribute("data-anim-original")
    if (original !== null) {
      targetEl.textContent = original
    }
  })
}
