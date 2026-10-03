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
