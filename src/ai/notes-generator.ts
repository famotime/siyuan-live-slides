import type { ISlidevVirtualPage } from "../types/slidev-protocol"

/**
 * 依据幻灯片内容智能提炼演讲者口播提词卡 (Notes)
 */
export function generateSpeakerNotes(
  slide: ISlidevVirtualPage,
  customPromptFn?: (pageContent: string) => Promise<string>,
): string {
  if (!slide.blocks || slide.blocks.length === 0) {
    return "本页暂无内容，建议过渡承接上下文。"
  }

  const headlines: string[] = []
  const bulletPoints: string[] = []

  for (const b of slide.blocks) {
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
 * 优先调用思源内核 AI 提炼演讲者口播提词卡，若 AI 未配置或异常自动回退到规则生成
 */
export async function generateSpeakerNotesWithAI(
  slide: ISlidevVirtualPage,
  aiChatFn?: (prompt: string) => Promise<string | null>,
): Promise<string> {
  if (aiChatFn) {
    const slideContent = slide.blocks.map(b => b.content || b.rawMarkdown || "").join("\n")
    const prompt = `你是一位专业的演讲教练。请根据以下幻灯片内容，提炼出简短精炼的演讲口播提词卡（Notes），包含核心观点与口播要点，总字数在 150 字以内：\n${slideContent}`
    try {
      const aiResult = await aiChatFn(prompt)
      if (aiResult && aiResult.trim()) {
        return aiResult.trim()
      }
    } catch {
      // 优雅降级
    }
  }

  return generateSpeakerNotes(slide)
}

