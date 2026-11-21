/**
 * 插件 i18n 轻量读取层
 *
 * 思源内核在插件加载时自动把 dist/i18n/*.json 注入 plugin.i18n，
 * 宿主在 onload 阶段调用 setI18nMessages 完成注册；此后任意模块可通过
 * t(key, fallback) 读取当前界面语言的文案。
 *
 * 设计要点：
 * - 未注册（如纯 Node 测试环境）或键缺失时回退 fallback，fallback 与命令注册中的
 *   中文默认文案保持一致，保证 English 资源缺失时行为与历史版本完全一致；
 * - 注意：本模块必须位于 src/utils/ 而非 src/i18n/ 目录——后者会被 viteStaticCopy
 *   原样拷贝进 dist/i18n/，只允许存放内核 i18n JSON 资源。
 */

let messages: Record<string, string> = {}

/** 注册内核注入的 i18n 文案表（onload 时调用一次；传 null/undefined 视为未配置） */
export function setI18nMessages(msgs: Record<string, string> | undefined | null): void {
  messages = msgs && typeof msgs === "object" ? msgs : {}
}

/** 读取当前语言文案：键存在且为非空字符串时返回译文，否则回退 fallback */
export function t(key: string, fallback: string): string {
  const value = messages[key]
  return typeof value === "string" && value.length > 0 ? value : fallback
}
