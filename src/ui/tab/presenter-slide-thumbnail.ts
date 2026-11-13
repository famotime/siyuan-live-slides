import type { ISlidesPluginConfig, ISlidesVirtualPage } from "@/types/slides-protocol"
import { parseMaskRatio } from "@/types/slides-protocol"
import { computeSlideClicksPlan, getBlockClickStatus } from "@/engine/v-click-resolver"
import { escapeHtml, renderSlideBlocksToHtml } from "@/export/markdown-renderer"

export const PRESENTER_THUMB_BASE_WIDTH = 980

export interface ISlideAspectMetrics {
  baseWidth: number
  baseHeight: number
  ratio: number
}

export interface IThumbnailScaleMetrics {
  scale: number
  boxWidth: number
  boxHeight: number
}

export interface IRenderPresenterThumbOptions {
  config?: (Partial<ISlidesPluginConfig> & { image?: string }) | null
  allSlides?: ISlidesVirtualPage[]
  pageIndex?: number
  /**
   * 当前已触发的页内步进数 (0-based)。
   * - 传入数字时（如「当前大屏放映」缩略图）：已触发块正常显示，尚未触发的 v-click 块附加 `presenter-v-click-pending` 半透明剧透类；
   * - 不传或 undefined 时（如「下一页预告」缩略图）：整页全部内容 100% 完整可见。
   */
  currentStep?: number
}

/**
 * 计算单页幻灯片的最大步进数（综合 v-click 步进计划与页面动态蒙版步数）
 */
export function computeSlideMaxStep(slide: ISlidesVirtualPage | null | undefined): number {
  if (!slide) return 0
  const clicksPlan = computeSlideClicksPlan((slide.blocks || []) as any)
  const clicksMax = clicksPlan.maxStep || 0
  const fm = slide.frontmatter || {}
  const maskDir = fm.mask
  if (maskDir !== "down" && maskDir !== "right") {
    return clicksMax
  }
  const ratioInfo = parseMaskRatio(fm.maskRatio)
  const isInitialRevealed = fm.maskInitial === "revealed"
  const maskSteps = isInitialRevealed ? Math.max(0, ratioInfo.steps - 1) : ratioInfo.steps
  return Math.max(clicksMax, maskSteps)
}

/**
 * 解析幻灯片宽高比配置，返回基准画布宽高（默认 16/9 -> 980x552）
 */
export function parseSlideAspectRatio(
  aspectRatio?: string,
  baseWidth: number = PRESENTER_THUMB_BASE_WIDTH,
): ISlideAspectMetrics {
  const raw = (aspectRatio || "16/9").trim()
  let ratio = 16 / 9

  if (raw === "4/3" || raw === "4:3") {
    ratio = 4 / 3
  } else if (raw === "16/10" || raw === "16:10") {
    ratio = 16 / 10
  } else if (raw.includes("/") || raw.includes(":")) {
    const sep = raw.includes("/") ? "/" : ":"
    const parts = raw.split(sep).map(p => parseFloat(p.trim()))
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      ratio = parts[0] / parts[1]
    }
  } else {
    const num = parseFloat(raw)
    if (!isNaN(num) && num > 0.2 && num < 5) {
      ratio = num
    }
  }

  const baseHeight = Math.ceil(baseWidth / ratio)
  return {
    baseWidth,
    baseHeight,
    ratio,
  }
}

/**
 * 根据预览容器可用像素宽高，计算缩略图等比缩放系数与外框像素宽高
 */
export function computeThumbnailScale(
  containerWidth: number,
  containerHeight: number,
  baseWidth: number = PRESENTER_THUMB_BASE_WIDTH,
  baseHeight: number = 552,
  padding: number = 16,
): IThumbnailScaleMetrics {
  const safeBaseW = baseWidth > 0 ? baseWidth : PRESENTER_THUMB_BASE_WIDTH
  const safeBaseH = baseHeight > 0 ? baseHeight : 552
  const availW = Math.max(0, containerWidth - padding)
  const availH = Math.max(0, containerHeight - padding)

  if (availW <= 0 || availH <= 0) {
    const fallbackScale = 0.36
    return {
      scale: fallbackScale,
      boxWidth: Math.round(safeBaseW * fallbackScale),
      boxHeight: Math.round(safeBaseH * fallbackScale),
    }
  }

  const rawScale = Math.min(availW / safeBaseW, availH / safeBaseH)
  const scale = Math.max(0.08, Math.min(1.5, Number(rawScale.toFixed(4))))
  return {
    scale,
    boxWidth: Math.max(1, Math.round(safeBaseW * scale)),
    boxHeight: Math.max(1, Math.round(safeBaseH * scale)),
  }
}

/**
 * 克隆幻灯片页对象，防止布局渲染器原地改写响应式块的 rawMarkdown / isColFirst
 */
function cloneSlidePage(slide: ISlidesVirtualPage): ISlidesVirtualPage {
  return {
    ...slide,
    frontmatter: { ...(slide.frontmatter || {}) },
    blocks: Array.isArray(slide.blocks)
      ? slide.blocks.map(b => ({
          ...b,
          attrs: b.attrs ? { ...b.attrs } : undefined,
          attributes: b.attributes ? { ...b.attributes } : undefined,
          motion: b.motion ? { ...b.motion } : undefined,
          children: Array.isArray(b.children)
            ? b.children.map(c => ({
                ...c,
                attrs: c.attrs ? { ...c.attrs } : undefined,
                attributes: c.attributes ? { ...c.attributes } : undefined,
              }))
            : undefined,
        }))
      : [],
  }
}

/**
 * 将单页幻灯片渲染为供演讲者视图缩略图画布挂载的完整 HTML 结构
 */
export function renderPresenterSlideThumbnailHtml(
  slide: ISlidesVirtualPage | null | undefined,
  options?: IRenderPresenterThumbOptions,
): string {
  if (!slide) return ""

  const slideClone = cloneSlidePage(slide)
  const fm = slideClone.frontmatter || {}
  const layout = fm.layout || "default"
  const config = options?.config || {}

  // 图左/图右版式若单页未显式指定配图，继承文档全局封面图
  if ((layout === "image-right" || layout === "image-left") && !fm.image && !fm.background && config.image) {
    fm.image = config.image
  }

  const hasStepTracking = typeof options?.currentStep === "number"
  const stepValue = hasStepTracking ? Math.max(0, options!.currentStep!) : 0
  const clicksPlan = hasStepTracking ? computeSlideClicksPlan((slideClone.blocks || []) as any) : null

  const rawBlocksHtml = renderSlideBlocksToHtml(slideClone, {
    containerClassName: "slide-block",
    leftColClass: "pdf-col pdf-col--left two-cols-left",
    rightColClass: "pdf-col pdf-col--right two-cols-right",
    allSlides: options?.allSlides || [],
    currentPageIndex: options?.pageIndex || slideClone.pageIndex || 1,
    highlight: true,
    blockClassResolver: clicksPlan
      ? (block) => {
          const status = getBlockClickStatus(block as any, stepValue, clicksPlan)
          if (status === "v-click-hidden") {
            return "presenter-v-click-pending"
          }
          if (stepValue > 0) {
            const bid = block.id || (block as any).blockId
            const rule = clicksPlan.blockMap.get(block as any) || (bid ? clicksPlan.idMap.get(bid) : undefined)
            if (
              (rule?.type === "step" && rule.step === stepValue) ||
              (rule?.type === "range" && rule.min === stepValue)
            ) {
              return "presenter-v-click-active"
            }
          }
          return ""
        }
      : undefined,
  })

  // 缩略图内的视频统一强制静音并移除原生控制条干扰，避免与主放映端产生双重音轨
  const safeBlocksHtml = rawBlocksHtml.replace(/<video\b([^>]*)>/gi, (_match, attrs: string) => {
    let nextAttrs = attrs.replace(/\bcontrols\b/gi, "").trim()
    if (!/\bmuted\b/i.test(nextAttrs)) {
      nextAttrs += " muted"
    }
    return `<video ${nextAttrs.trim()}>`
  })

  const pageSp = fm.spacing
  const spacing = pageSp && pageSp !== "inherit" ? pageSp : (config.spacing || "normal")

  const contentClasses = [
    "slide-content",
    `layout-${layout}`,
    `spacing-${spacing}`,
    fm.class || "",
    fm.layoutClass || "",
  ]
    .filter(Boolean)
    .join(" ")

  const styleParts: string[] = []
  const bg = (fm.background || config.background || "").trim()
  if (bg) {
    if (/^(?:https?:\/\/|\/|data:|assets\/|\.\/assets\/)/i.test(bg)) {
      const normalizedBg = bg.startsWith("assets/")
        ? `/${bg}`
        : bg.startsWith("./assets/")
          ? bg.slice(1)
          : bg
      styleParts.push(
        `background-image:url('${escapeHtml(normalizedBg)}');background-size:cover;background-position:center;background-repeat:no-repeat;`,
      )
    } else {
      styleParts.push(`background:${escapeHtml(bg)};`)
    }
  }

  const rawZoom = typeof fm.zoom === "number" ? fm.zoom : typeof fm.zoom === "string" ? parseFloat(fm.zoom) : 1
  const zoom = !isNaN(rawZoom) && rawZoom > 0 ? rawZoom : 1
  if (zoom !== 1) {
    styleParts.push(
      `width:${(100 / zoom).toFixed(2)}%;height:${(100 / zoom).toFixed(2)}%;transform-origin:top left;transform:scale(${zoom});`,
    )
  }

  const styleAttr = styleParts.length > 0 ? ` style="${styleParts.join("")}"` : ""

  return `<div class="${escapeHtml(contentClasses)}"${styleAttr}>${safeBlocksHtml}</div>`
}
