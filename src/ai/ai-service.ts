/**
 * AI 服务核心通信模块
 * 统一调度接管配置 (siyuan-api-switch) 与本地自定义 OpenAI 兼容 API
 * 底层使用思源内核 /api/network/forwardProxy 代理转发并合并 headers
 */

import { forwardProxy } from '../api'
import { getEffectiveAiConfig, isAiConfigComplete } from '../settings'
import type { IAiServiceConfig } from '../settings'

export interface IChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function buildAiForwardProxyHeaders(config: {
  apiKey: string
  headers?: Record<string, string>
}): Array<Record<string, string>> {
  const headers: Array<Record<string, string>> = [
    { Authorization: `Bearer ${config.apiKey.trim()}` },
    { Accept: 'application/json' },
  ]
  if (config.headers && typeof config.headers === 'object') {
    for (const [key, value] of Object.entries(config.headers)) {
      if (key && value !== undefined && value !== null) {
        headers.push({ [key]: String(value) })
      }
    }
  }
  return headers
}

/**
 * 抽取 OpenAI 兼容响应正文
 */
export function extractOpenAiTextContent(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null
  const choice = payload.choices?.[0]
  if (!choice) return null

  const content = choice.message?.content ?? choice.text
  if (typeof content === 'string' && content.trim().length > 0) {
    return content.trim()
  }
  return null
}

/**
 * 底层调用 OpenAI 兼容的 /chat/completions 接口
 */
export async function callOpenAiChatCompletion(
  messages: IChatMessage[],
  config: IAiServiceConfig & { headers?: Record<string, string> },
  overrideMaxTokens?: number
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')
  const endpoint = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/chat/completions`

  const payload = {
    model: config.model,
    messages,
    max_tokens: overrideMaxTokens ?? config.maxTokens ?? 4096,
    temperature: config.temperature ?? 0.7,
  }

  const timeoutMs = Math.max(1, config.requestTimeoutSeconds || 60) * 1000
  const headers = buildAiForwardProxyHeaders(config)

  const res = await forwardProxy(
    endpoint,
    'POST',
    JSON.stringify(payload),
    headers,
    timeoutMs,
    'application/json'
  )

  if (!res || res.status < 200 || res.status >= 300) {
    const errorBody = typeof res?.body === 'string' ? res.body.slice(0, 200) : ''
    throw new Error(`AI 请求失败 (HTTP ${res?.status ?? '未知'})${errorBody ? `: ${errorBody}` : ''}`)
  }

  let parsed: any
  try {
    parsed = JSON.parse(res.body || '{}')
  } catch {
    throw new Error('AI 接口返回了非法的 JSON 响应')
  }

  const text = extractOpenAiTextContent(parsed)
  if (!text) {
    throw new Error('AI 接口未返回有效的文本内容')
  }

  return text
}

/**
 * 幻灯片提词与 AI 任务通用入口
 * 严格执行优先级：接管配置 > 本地自定义配置 > null（不调用思源内核 AI，直接回退规则模板）
 */
export async function requestAiChat(prompt: string): Promise<string | null> {
  const effective = getEffectiveAiConfig()
  if (!effective) {
    return null
  }

  try {
    const messages: IChatMessage[] = [
      {
        role: 'system',
        content: '你是一位专业的幻灯片演讲教练与内容设计专家。请根据用户提供的幻灯片内容提供精炼、准确的输出。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]

    return await callOpenAiChatCompletion(messages, effective.config)
  } catch (err: any) {
    console.warn('[LiveSlides AI] request failed:', err?.message || err)
    throw err
  }
}

/**
 * 测试 AI 接口连通性（用于设置面板的「测试连接」按钮）
 */
export async function testAiConnection(
  config: Partial<IAiServiceConfig> & { headers?: Record<string, string> }
): Promise<{ success: boolean; message: string; elapsed?: number }> {
  if (!isAiConfigComplete(config)) {
    return {
      success: false,
      message: '配置不完整：请先补充 Base URL、API Key 和 Model',
    }
  }

  const fullConfig: IAiServiceConfig & { headers?: Record<string, string> } = {
    baseUrl: config.baseUrl!.trim(),
    apiKey: config.apiKey!.trim(),
    model: config.model!.trim(),
    requestTimeoutSeconds: config.requestTimeoutSeconds || 15,
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens || 10,
    headers: config.headers,
  }

  const startTime = Date.now()
  try {
    const testMessages: IChatMessage[] = [
      { role: 'user', content: 'Say "OK"' },
    ]
    const reply = await callOpenAiChatCompletion(testMessages, fullConfig, 10)
    const elapsed = Date.now() - startTime
    return {
      success: true,
      message: `连接成功！模型响应：${reply.slice(0, 50)} (${elapsed}ms)`,
      elapsed,
    }
  } catch (err: any) {
    const elapsed = Date.now() - startTime
    return {
      success: false,
      message: err?.message || '连接失败，请检查 Base URL、API Key 与网络连通性',
      elapsed,
    }
  }
}
