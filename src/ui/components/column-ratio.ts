/**
 * 分栏比例通用解析工具（供块级插槽与页面级比例领域共享）
 *
 * 统一 `a:b:c` 权重比例的段数解析与等分比例生成，
 * 消除 BlockInspectorSection / PageInspectorSection 两处相似的 split(':') 逻辑。
 */

/** 比例段数合法上下界 */
export const MIN_RATIO_COLUMNS = 2
export const MAX_RATIO_COLUMNS = 6

/**
 * 解析比例字符串的栏数（段数）
 * @returns 合法段数（2~6）；空串、无冒号或段数越界时返回 0
 */
export function countRatioColumns(ratio: string | undefined | null): number {
  const r = (ratio || '').trim()
  if (!r.includes(':')) return 0
  const count = r.split(':').filter(Boolean).length
  if (count < MIN_RATIO_COLUMNS || count > MAX_RATIO_COLUMNS) return 0
  return count
}

/** 生成 cols 栏的均分比例（如 3 栏 → '1:1:1'） */
export function buildEqualRatio(cols: number): string {
  return Array(Math.max(cols, MIN_RATIO_COLUMNS)).fill('1').join(':')
}
