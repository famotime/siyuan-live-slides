import type { ISlidesVirtualPage } from "../types/slides-protocol"

export interface INotesGenerationResult {
  notes: string
  isAiGenerated: boolean
  error?: string
}

/**
 * 依据幻灯片内容智能提炼演讲者口播提词卡 (Notes)
 */
export function generateSpeakerNotes(
  slide: ISlidesVirtualPage,
  customPromptFn?: (pageContent: string) => Promise<string>,
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
 * 优先调用思源内核 AI 提炼演讲者口播提词卡，附带生成元信息（区分真实 AI 结果与预设降级模板）
 */
export async function generateSpeakerNotesWithAIDetailed(
  slide: ISlidesVirtualPage,
  aiChatFn?: (prompt: string) => Promise<string | null>,
): Promise<INotesGenerationResult> {
  const slideContent = (slide.blocks && slide.blocks.length > 0)
    ? slide.blocks
        .map(b => (b.content || b.rawMarkdown || "").trim())
        .filter(t => t && t !== "---")
        .join("\n")
    : (slide.rawMarkdown || "").replace(/^---\s*$/gm, "").trim()

  if (aiChatFn && slideContent) {
    const prompt = `你是一位专业的演讲教练。请根据以下幻灯片内容，提炼出简短精炼的演讲口播提词卡（Notes），包含核心观点与口播要点，总字数在 150 字以内：\n${slideContent}`
    try {
      const aiResult = await aiChatFn(prompt)
      if (aiResult && aiResult.trim()) {
        return {
          notes: aiResult.trim(),
          isAiGenerated: true,
        }
      }
    } catch (err: any) {
      return {
        notes: generateSpeakerNotes(slide),
        isAiGenerated: false,
        error: err?.message || "AI 调用异常",
      }
    }
  }

  return {
    notes: generateSpeakerNotes(slide),
    isAiGenerated: false,
  }
}

/**
 * 优先调用思源内核 AI 提炼演讲者口播提词卡，若 AI 未配置或异常自动回退到规则生成
 */
export async function generateSpeakerNotesWithAI(
  slide: ISlidesVirtualPage,
  aiChatFn?: (prompt: string) => Promise<string | null>,
): Promise<string> {
  const res = await generateSpeakerNotesWithAIDetailed(slide, aiChatFn)
  return res.notes
}

