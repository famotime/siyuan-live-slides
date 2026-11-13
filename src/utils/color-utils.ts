const LIGHT_NAMED_COLORS = [
  "white", "snow", "ivory", "ghostwhite", "floralwhite", "aliceblue",
  "whitesmoke", "seashell", "beige", "oldlace", "linen", "antiquewhite",
  "lightyellow", "lightcyan", "papayawhip", "blanchedalmond", "cornsilk",
  "lavender", "lavenderblush", "lemonchiffon", "honeydew", "mintcream",
  "azure", "mistyrose", "wheat", "lightgoldenrodyellow", "palegoldenrod",
  "gainsboro", "lightgrey", "lightgray", "silver", "pink", "lightpink",
  "peachpuff", "navajowhite", "moccasin", "bisque", "khaki", "palegreen",
  "lightgreen", "lightblue", "powderblue", "paleturquoise", "lightsteelblue",
  "thistle", "yellow", "cyan", "aqua",
]

const DARK_NAMED_COLORS = [
  "black", "transparent", "navy", "darkblue", "midnightblue",
  "darkslategray", "darkslategrey", "maroon", "darkred", "darkgreen",
  "indigo", "darkslateblue", "dimgray", "dimgrey", "purple", "brown",
  "olive", "teal", "blue", "darkviolet", "darkmagenta", "darkcyan",
  "darkolivegreen", "saddlebrown", "sienna", "firebrick", "crimson",
  "mediumblue", "rebeccapurple",
]

function calcPerceivedLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function parseHexLuminance(hexRaw: string): number | null {
  let hex = hexRaw.startsWith("#") ? hexRaw.slice(1) : hexRaw
  if (hex.length === 3 || hex.length === 4) {
    hex = hex.slice(0, 3).split("").map((c) => c + c).join("")
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return calcPerceivedLuminance(r, g, b)
    }
  }
  return null
}

function parseRgbLuminance(rgbStr: string): number | null {
  const m = rgbStr.match(
    /rgba?\s*\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*([0-9.]+%?))?/i,
  )
  if (!m) return null
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null
  if (m[4] !== undefined) {
    const a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    if (!isNaN(a) && a <= 0.05) return null
  }
  return calcPerceivedLuminance(r, g, b)
}

function parseHslLuminance(hslStr: string): number | null {
  const m = hslStr.match(
    /hsla?\s*\(\s*([0-9.]+)(?:deg)?\s*[,\s]\s*([0-9.]+)%\s*[,\s]\s*([0-9.]+)%(?:\s*[,/]\s*([0-9.]+%?))?/i,
  )
  if (!m) return null
  if (m[4] !== undefined) {
    const a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    if (!isNaN(a) && a <= 0.05) return null
  }
  const h = (((Number(m[1]) % 360) + 360) % 360) / 360
  const sat = Math.max(0, Math.min(1, Number(m[2]) / 100))
  const lig = Math.max(0, Math.min(1, Number(m[3]) / 100))
  let r: number
  let g: number
  let b: number
  if (sat === 0) {
    r = g = b = lig * 255
  } else {
    const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat
    const p = 2 * lig - q
    const hue2rgb = (t: number) => {
      let tt = t
      if (tt < 0) tt += 1
      if (tt > 1) tt -= 1
      if (tt < 1 / 6) return p + (q - p) * 6 * tt
      if (tt < 1 / 2) return q
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
      return p
    }
    r = hue2rgb(h + 1 / 3) * 255
    g = hue2rgb(h) * 255
    b = hue2rgb(h - 1 / 3) * 255
  }
  return calcPerceivedLuminance(r, g, b)
}

/**
 * 启发式计算背景色（含纯色与 CSS 渐变）的相对感知亮度 (Perceived Luminance)
 * 返回 true（亮底，应使用暗色文字）/ false（暗底，应使用亮色文字）/ null（图片背景或无法计算）
 */
export function isLightColor(colorStr?: string): boolean | null {
  if (!colorStr || typeof colorStr !== "string") return null
  const s = colorStr.trim().toLowerCase()
  if (!s) return null

  // 图片 URL / url(...) 背景不作为纯色或渐变计算亮度
  if (/^(?:https?:\/\/|\/|data:|assets\/|\.\/assets\/|url\s*\()/i.test(s)) {
    return null
  }

  if (LIGHT_NAMED_COLORS.includes(s)) return true
  if (DARK_NAMED_COLORS.includes(s)) return false

  if (s.startsWith("#")) {
    const lum = parseHexLuminance(s)
    return lum === null ? null : lum > 140
  }
  if (/^rgba?\s*\(/i.test(s)) {
    const lum = parseRgbLuminance(s)
    return lum === null ? null : lum > 140
  }
  if (/^hsla?\s*\(/i.test(s)) {
    const lum = parseHslLuminance(s)
    return lum === null ? null : lum > 140
  }

  // CSS 渐变背景（如 linear-gradient / radial-gradient / conic-gradient）：提取全部色标计算平均亮度
  if (/(?:linear|radial|conic)-gradient\s*\(/i.test(s)) {
    const luminances: number[] = []
    const hexMatches = s.match(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi)
    if (hexMatches) {
      for (const h of hexMatches) {
        const lum = parseHexLuminance(h)
        if (lum !== null) luminances.push(lum)
      }
    }
    const rgbMatches = s.match(/rgba?\s*\([^)]+\)/gi)
    if (rgbMatches) {
      for (const r of rgbMatches) {
        const lum = parseRgbLuminance(r)
        if (lum !== null) luminances.push(lum)
      }
    }
    const hslMatches = s.match(/hsla?\s*\([^)]+\)/gi)
    if (hslMatches) {
      for (const h of hslMatches) {
        const lum = parseHslLuminance(h)
        if (lum !== null) luminances.push(lum)
      }
    }
    const stripped = s.replace(/#[0-9a-f]+|rgba?\([^)]+\)|hsla?\([^)]+\)/gi, " ")
    const wordMatches = stripped.match(/\b[a-z]+\b/gi)
    if (wordMatches) {
      for (const w of wordMatches) {
        if (w === "transparent") continue
        if (LIGHT_NAMED_COLORS.includes(w)) luminances.push(240)
        else if (DARK_NAMED_COLORS.includes(w)) luminances.push(20)
      }
    }
    if (luminances.length > 0) {
      const avg = luminances.reduce((acc, v) => acc + v, 0) / luminances.length
      return avg > 140
    }
    if (/\btransparent\b/.test(s)) return false
  }

  return null
}

/**
 * 探测当前思源笔记宿主的明暗主题模式
 */
export function detectSiYuanThemeMode(): "light" | "dark" {
  if (typeof window !== "undefined") {
    const appearanceMode = (window as any).siyuan?.config?.appearance?.mode
    if (appearanceMode === 0) return "light"
    if (appearanceMode === 1) return "dark"
  }
  if (typeof document !== "undefined") {
    const htmlMode = document.documentElement?.getAttribute("data-theme-mode")
    if (htmlMode === "light" || htmlMode === "dark") return htmlMode
    const bodyMode = document.body?.getAttribute("data-theme-mode")
    if (bodyMode === "light" || bodyMode === "dark") return bodyMode
    if (
      document.documentElement?.classList?.contains("theme--dark")
      || document.body?.classList?.contains("theme--dark")
    ) {
      return "dark"
    }
    if (
      document.documentElement?.classList?.contains("theme--light")
      || document.body?.classList?.contains("theme--light")
    ) {
      return "light"
    }
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light"
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark"
  }
  return "light"
}

/**
 * 解析文档最终生效的明暗配色模式：显式 light/dark 优先，auto 时跟随思源宿主主题
 */
export function resolveEffectiveColorSchema(colorSchema?: string, hostMode?: "light" | "dark"): "light" | "dark" {
  if (colorSchema === "light") return "light"
  if (colorSchema === "dark") return "dark"
  if (hostMode === "light" || hostMode === "dark") return hostMode
  return detectSiYuanThemeMode()
}

/**
 * 监听思源宿主明暗主题变化（data-theme-mode / class 变更），返回清理函数
 */
export function observeSiYuanThemeMode(onChange: (mode: "light" | "dark") => void): () => void {
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
    return () => {}
  }
  let lastMode = detectSiYuanThemeMode()
  const notifyIfChanged = () => {
    const nextMode = detectSiYuanThemeMode()
    if (nextMode !== lastMode) {
      lastMode = nextMode
      onChange(nextMode)
    }
  }
  const observer = new MutationObserver(notifyIfChanged)
  if (document.documentElement) {
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode", "class"] })
  }
  if (document.body) {
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme-mode", "class"] })
  }
  return () => observer.disconnect()
}
