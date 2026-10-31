import { sql } from "@/api"
import { getPreviewTabInstance } from "@/main"
import type { ISlidesDocument } from "@/types/slides-protocol"

/**
 * 预览页签标题服务宿主契约：插件主类天然实现该接口，
 * 使标题解析与更新逻辑可在脱离插件实例的情况下独立测试。
 */
export interface IPreviewTabTitleHost {
  currentDocId: string
  latestCompiledDoc: ISlidesDocument | null
  previewTab: any
  getActiveDocumentId(): string
  /** 标题解析钩子：插件实例提供同名方法（可被测试打桩）；缺省时回退到模块内三级降级解析 */
  fetchDocumentTitle?(docId: string): Promise<string>
}

/**
 * 构造预览页签标题
 * 规范：即现（当前文档名称）；文档名称为空时显示“即现”
 */
export function buildPreviewTabTitle(docTitle?: string): string {
  const trimmed = (docTitle || "").trim()
  return trimmed ? `即现（${trimmed}）` : "即现"
}

/**
 * 获取指定文档的标题内容（DOM 活跃编辑区 → 已编译模型 → 内核 SQL 三级降级）
 */
export async function fetchDocumentTitle(host: IPreviewTabTitleHost, docId: string): Promise<string> {
  if (!docId) return ""

  // 1. 优先从 DOM 活跃编辑区或特定文档标题容器提取
  if (typeof document !== "undefined") {
    const titleInput = (
      document.querySelector(`.protyle-title[data-node-id="${docId}"] .protyle-title__input`) ||
      document.querySelector(`.protyle[data-doc-id="${docId}"] .protyle-title__input`) ||
      (host.getActiveDocumentId() === docId ? document.querySelector(".layout__wnd--active .protyle-title__input") : null) ||
      document.querySelector(".protyle-title__input")
    ) as HTMLElement | null
    const domTitle = (titleInput?.innerText || titleInput?.textContent || "").trim()
    if (domTitle) {
      return domTitle
    }
  }

  // 2. 从已编译的当前文档模型提取（若匹配）
  if (host.latestCompiledDoc && host.latestCompiledDoc.docId === docId) {
    const firstSlide = host.latestCompiledDoc.slides?.[0]
    const firstH1 = firstSlide?.blocks?.find((b: any) => b.type === "h" || b.type === "NodeHeading")
    if (firstH1?.content) {
      return firstH1.content.trim()
    }
  }

  // 3. 降级通过内核 SQL 查询 blocks 表文档根块 content
  try {
    const rows = await sql(`SELECT content FROM blocks WHERE id = '${docId}' AND type = 'd' LIMIT 1`).catch(() => [])
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.content) {
      return String(rows[0].content).trim()
    }
  } catch {}

  return ""
}

/**
 * 动态更新预览窗口思源 Tab 页签标题
 * Pin 锁定状态下非锁定文档的切换不会修改标题
 */
export async function updatePreviewTabHeader(
  host: IPreviewTabTitleHost,
  docTitle?: string,
  targetDocId?: string,
): Promise<void> {
  // 若预览窗口处于 Pin 锁定状态，非锁定文档的切换不应修改 Tab 标题
  const previewInstance = getPreviewTabInstance()
  const isPinned = Boolean(previewInstance?.isPinned?.value)
  const pinnedId = String(previewInstance?.pinnedDocId?.value || "")
  if (isPinned && pinnedId && targetDocId && targetDocId !== pinnedId) {
    return
  }

  const docId = targetDocId || (isPinned && pinnedId ? pinnedId : host.currentDocId || host.getActiveDocumentId())
  let titleText = (docTitle || "").trim()
  if (!titleText && docId) {
    titleText = typeof host.fetchDocumentTitle === "function"
      ? await host.fetchDocumentTitle(docId)
      : await fetchDocumentTitle(host, docId)
  }
  const tabTitle = buildPreviewTabTitle(titleText)

  // 1. 调用思源 Tab 官方 API 更新标题
  if (host.previewTab && typeof host.previewTab.updateTitle === "function") {
    host.previewTab.updateTitle(tabTitle)
    if (host.previewTab.headElement) {
      host.previewTab.headElement.setAttribute("title", tabTitle)
    }
    return
  }

  // 2. DOM 兜底更新（遍历思源页签栏）
  if (typeof document !== "undefined") {
    const tabHeaders = Array.from(document.querySelectorAll('.layout-tab-bar .item[data-type="tab-header"]'))
    for (const header of tabHeaders) {
      const textEl = header.querySelector(".item__text")
      const currentText = textEl?.textContent?.trim() || ""
      if (
        currentText.includes("Slidev 演示预览") ||
        currentText.startsWith("即现")
      ) {
        if (textEl) {
          textEl.textContent = tabTitle
        }
        header.setAttribute("title", tabTitle)
        break
      }
    }
  }
}

/**
 * 净化文件名中的非法字符
 */
export function sanitizeFileName(name: string): string {
  const cleaned = (name || "")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/_+/g, "_")
    .trim()
    .replace(/^_+|_+$/g, "")
  return cleaned || "presentation"
}

/**
 * 统一多级解析当前演示文稿的文档真实标题
 * 优先顺序：
 * 1. 宿主/插件提供的 fetchDocumentTitle(docId)
 * 2. 活跃 Protyle 编辑区 DOM (.protyle-title__input)
 * 3. doc.config.title (若非默认 presentation 占位符)
 * 4. 第一张幻灯片的首个一级标题 (H1)
 * 5. 降级为 "presentation"
 */
export async function resolveDocumentTitle(
  doc?: ISlidesDocument | null,
  docId?: string,
  hostOrPlugin?: any,
): Promise<string> {
  const targetDocId = docId || doc?.docId || ""

  // 1. 尝试通过插件宿主解析真实文档标题
  if (hostOrPlugin && typeof hostOrPlugin.fetchDocumentTitle === "function" && targetDocId) {
    try {
      const title = await hostOrPlugin.fetchDocumentTitle(targetDocId)
      if (title && title.trim()) {
        return sanitizeFileName(title)
      }
    } catch {}
  }

  // 2. 尝试从 DOM 活跃编辑区提取
  if (typeof document !== "undefined") {
    try {
      const activeTitleEl = (
        (targetDocId ? document.querySelector(`.protyle-title[data-node-id="${targetDocId}"] .protyle-title__input`) : null) ||
        (targetDocId ? document.querySelector(`.protyle[data-doc-id="${targetDocId}"] .protyle-title__input`) : null) ||
        document.querySelector(".layout__wnd--active .protyle-title__input") ||
        document.querySelector(".protyle-title__input")
      ) as HTMLElement | null
      const domTitle = (activeTitleEl?.innerText || activeTitleEl?.textContent || "").trim()
      if (domTitle) {
        return sanitizeFileName(domTitle)
      }
    } catch {}
  }

  // 3. 从文档配置提取
  if (doc?.config?.title && doc.config.title.trim() && doc.config.title.trim().toLowerCase() !== "presentation") {
    return sanitizeFileName(doc.config.title)
  }

  // 4. 从第一页幻灯片 H1 提取
  if (doc?.slides && doc.slides.length > 0) {
    const firstSlide = doc.slides[0]
    const h1Block = firstSlide.blocks?.find((b: any) => b.type === "h" || b.type === "NodeHeading")
    const h1Text = (h1Block?.content || "").replace(/^#+\s*/, "").trim()
    if (h1Text) {
      return sanitizeFileName(h1Text)
    }
  }

  return "presentation"
}
