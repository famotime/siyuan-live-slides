import type { ISlidesVirtualPage } from "../types/slides-protocol"
import { requestAiChat } from "./ai-service"

export interface INotesGenerationResult {
  notes: string
  isAiGenerated: boolean
  error?: string
}

/**
 * 递归抽取块及其子树中包含的所有人类可读文本
 */
function extractDeepTextFromBlock(b: any): string {
  if (!b) return ""
  const parts: string[] = []

  // 1. 优先获取块直接内容并清洗 Kramdown IAL 标记
  const rawText = (b.content || b.rawMarkdown || b.markdown || b.rawNode?.content || b.rawNode?.markdown || "").trim()
  if (rawText && rawText !== "---") {
    const clean = rawText.replace(/\{:\s*[^}]+\s*\}\s*$/g, "").trim()
    if (clean && clean !== "---") {
      parts.push(clean)
    }
  }

  // 2. 递归抽取子节点（超级块列、列表项、引述块、表格单元格等）
  if (Array.isArray(b.children) && b.children.length > 0) {
    for (const child of b.children) {
      const childText = extractDeepTextFromBlock(child)
      if (childText) {
        parts.push(childText)
      }
    }
  }

  return parts.join("\n")
}

/**
 * 智能汇总当前幻灯片全部可供 AI 理解的正文内容
 */
export function extractSlideContentForAi(slide?: ISlidesVirtualPage | null): string {
  if (!slide) return ""

  const extractedList: string[] = []

  // 1. 深度遍历 blocks
  if (Array.isArray(slide.blocks) && slide.blocks.length > 0) {
    for (const b of slide.blocks) {
      if (b.slot === "slot-divider-right" || b.content === "::right::" || b.isNote) continue
      const text = extractDeepTextFromBlock(b)
      if (text) {
        extractedList.push(text)
      }
    }
  }

  let finalContent = extractedList.join("\n\n").trim()

  // 2. 若 blocks 遍历为空，平滑回退使用 slide.rawMarkdown
  if (!finalContent && slide.rawMarkdown) {
    finalContent = slide.rawMarkdown.replace(/^---\s*$/gm, "").trim()
  }

  // 3. 若依然为空，从 frontmatter 中聚合标题、描述、版式与配图元数据
  if (!finalContent && slide.frontmatter) {
    const metaParts: string[] = []
    if (slide.frontmatter.title) metaParts.push(`幻灯片标题: ${slide.frontmatter.title}`)
    if (slide.frontmatter.description) metaParts.push(`幻灯片描述: ${slide.frontmatter.description}`)
    if (slide.frontmatter.layout && slide.frontmatter.layout !== "default") metaParts.push(`版式布局: ${slide.frontmatter.layout}`)
    if (slide.frontmatter.image) metaParts.push(`页面配图: ${slide.frontmatter.image}`)
    if (metaParts.length > 0) {
      finalContent = metaParts.join("\n")
    }
  }

  return finalContent
}

/**
 * 依据幻灯片内容智能提炼演讲者口播提词卡 (Notes)
 */
export function generateSpeakerNotes(
  slide: ISlidesVirtualPage,
): string {
  const blocks = (slide.blocks || []).filter(b => {
    const text = (b.content || b.rawMarkdown || "").trim()
    return text && text !== "---"
  })

  if (blocks.length === 0) {
    return "本页暂无内容，建议过渡承接上下文。"
  }

  const headlines: string[] = []
  const bulletPoints: string[] = []

  for (const b of blocks) {
    const text = (b.content || b.rawMarkdown || "").trim()
    if (!text) continue

    if (b.type === "h" || text.startsWith("#")) {
      headlines.push(text.replace(/^#+\s*/, ""))
    } else {
      bulletPoints.push(text.slice(0, 50))
    }
  }

  const lines: string[] = []
  if (headlines.length > 0) {
    lines.push(`【核心重点】：${headlines.join("、")}`)
  }
  if (bulletPoints.length > 0) {
    lines.push(`【口播要点】：`)
    bulletPoints.slice(0, 3).forEach((bp, idx) => {
      lines.push(`${idx + 1}. 讲解 ${bp}`)
    })
  }

  lines.push("【过渡提示】：注意观察听众反应，适时抛出互动提问。")

  return lines.join("\n")
}

/**
 * 提炼演讲者口播提词卡，优先调用接管/本地配置的 AI 服务。未配置或异常时返回错误信息，不再静默回退规则模板
 */
export async function generateSpeakerNotesWithAIDetailed(
  slide: ISlidesVirtualPage,
  aiChatFn: (prompt: string) => Promise<string | null> = requestAiChat,
): Promise<INotesGenerationResult> {
  const slideContent = extractSlideContentForAi(slide)

  if (!slideContent) {
    return {
      notes: "",
      isAiGenerated: false,
      error: "当前幻灯片尚未填写正文内容，请先输入幻灯片标题或段落后再调用 AI 提炼",
    }
  }

  if (aiChatFn) {
    const prompt = `你是一位专业的演讲教练。请根据以下幻灯片内容，提炼出简短精炼的演讲口播提词卡（Notes），包含核心观点与口播要点，总字数在 150 字以内：\n${slideContent}`
    try {
      const aiResult = await aiChatFn(prompt)
      if (aiResult && aiResult.trim()) {
        return {
          notes: aiResult.trim(),
          isAiGenerated: true,
        }
      }
      return {
        notes: "",
        isAiGenerated: false,
        error: "AI 服务未配置或未返回可用提词内容",
      }
    } catch (err: any) {
      return {
        notes: "",
        isAiGenerated: false,
        error: err?.message || "AI 调用异常",
      }
    }
  }

  return {
    notes: "",
    isAiGenerated: false,
    error: "未配置 AI 提词服务",
  }
}

/**
 * 提炼演讲者口播提词卡，优先调用接管/本地配置的 AI 服务，若异常或未配置则抛出错误
 */
export async function generateSpeakerNotesWithAI(
  slide: ISlidesVirtualPage,
  aiChatFn: (prompt: string) => Promise<string | null> = requestAiChat,
): Promise<string> {
  const res = await generateSpeakerNotesWithAIDetailed(slide, aiChatFn)
  if (res.error) {
    throw new Error(res.error)
  }
  return res.notes
}

