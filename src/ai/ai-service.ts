/**
 * AI 服务核心通信模块
 * 统一调度接管配置 (siyuan-api-switch) 与本地自定义 OpenAI 兼容 API
 * 底层使用思源内核 /api/network/forwardProxy 代理转发并合并 headers
 */

import { fetchSyncPost } from 'siyuan'
import { forwardProxy } from '../api'
import { getEffectiveAiConfig, isAiConfigComplete } from '../settings'
import type { IAiServiceConfig } from '../settings'

export interface IChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ITestAiConnectionResult {
  success: boolean
  message: string
  elapsed?: number
}

/**
 * 协议值域归一化，与思源内核及 siyuan-api-switch 对齐
 * 思源内核原生识别 openai / openai-responses / anthropic-messages / systemone
 */
function normalizeAiProtocol(raw?: string | null): string {
  const val = (raw || '').trim().toLowerCase()
  if (val === 'anthropic' || val === 'anthropic-messages') return 'anthropic-messages'
  if (val === 'openai-responses') return 'openai-responses'
  if (val === 'systemone' || val === 'system-one' || val === 'jev' || val === 'typesafe') return 'systemone'
  return 'openai'
}

export function buildAiForwardProxyHeaders(config: {
  apiKey: string
  headers?: Record<string, string>
}): Array<Record<string, string>> {
  const headers: Array<Record<string, string>> = [
    { 'content-type': 'application/json' },
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
  config: IAiServiceConfig & { headers?: Record<string, string>; protocol?: string },
  overrideMaxTokens?: number
): Promise<string> {
  const cleanBaseUrl = config.baseUrl.replace(/\/+$/, '')
  const endpoint = cleanBaseUrl.endsWith('/chat/completions')
    ? cleanBaseUrl
    : `${cleanBaseUrl}/chat/completions`

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
    payload,
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
    parsed = typeof res.body === 'string' ? JSON.parse(res.body || '{}') : res.body
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
 * 对照 siyuan-api-switch 供应商探测设计：
 * 1. 梯队 1：优先尝试思源内核原生 /api/ai/testModel（v3.7.0+ 原生直测，零 CORS 与代理干扰）；
 * 2. 梯队 2：若内核端点不支持或模型不在预设列表中，自动平滑降级为 /api/network/forwardProxy 发送极简探针 (max_tokens: 1)；
 * 3. 精准解析 HTTP 401/403/404/429/400 及服务商错误详情，给出友好的中文诊断指导。
 */
export async function testAiConnection(
  config: Partial<IAiServiceConfig> & { headers?: Record<string, string>; protocol?: string }
): Promise<ITestAiConnectionResult> {
  if (!isAiConfigComplete(config)) {
    return {
      success: false,
      message: '配置不完整：请先补充 Base URL、API Key 和 Model',
    }
  }

  const startTime = Date.now()
  const cleanBaseUrl = config.baseUrl!.trim().replace(/\/+$/, '')
  const apiKey = config.apiKey!.trim()
  const model = config.model!.trim()
  const protocol = normalizeAiProtocol(config.protocol)
  const timeoutSeconds = Math.max(5, config.requestTimeoutSeconds || 15)

  // 1. 梯队 1：优先尝试思源内核原生 /api/ai/testModel
  try {
    const providerConfig = {
      displayName: 'Live Slides AI',
      apiKey,
      baseURL: cleanBaseUrl,
      protocol,
      requestTimeout: timeoutSeconds,
      headers: config.headers || {},
      models: [],
    }

    const kernelRes: any = await fetchSyncPost('/api/ai/testModel', {
      providerConfig,
      model,
    })

    if (kernelRes && kernelRes.code === 0 && kernelRes.data?.matched && !kernelRes.data?.msg) {
      const elapsed = Date.now() - startTime
      return {
        success: true,
        message: `测试成功（耗时 ${elapsed}ms）：已通过思源内核验证模型并完成对话测试`,
        elapsed,
      }
    }
  } catch {
    // 内核端点不存在或抛错时，静默进入梯队 2 降级探针
  }

  // 2. 梯队 2：通用降级探针（通过 /api/network/forwardProxy 发送极简探针，对照 siyuan-api-switch sendProbeRequest）
  try {
    let url: string
    let headers: Array<Record<string, string>>
    let payload: Record<string, unknown>

    if (protocol === 'anthropic-messages') {
      url = /\/v1$/i.test(cleanBaseUrl) ? `${cleanBaseUrl}/messages` : `${cleanBaseUrl}/v1/messages`
      headers = [
        { 'content-type': 'application/json' },
        { 'anthropic-version': '2023-06-01' },
      ]
      if (apiKey) {
        headers.push({ 'x-api-key': apiKey })
      }
      payload = {
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }
    } else if (protocol === 'openai-responses') {
      url = /\/responses$/i.test(cleanBaseUrl) ? cleanBaseUrl : `${cleanBaseUrl}/responses`
      headers = [
        { 'content-type': 'application/json' },
      ]
      if (apiKey) {
        headers.push({ Authorization: `Bearer ${apiKey}` })
      }
      payload = {
        model,
        max_output_tokens: 16,
        stream: false,
        input: 'hi',
      }
    } else {
      url = /\/chat\/completions$/i.test(cleanBaseUrl)
        ? cleanBaseUrl
        : `${cleanBaseUrl}/chat/completions`
      headers = [
        { 'content-type': 'application/json' },
      ]
      if (apiKey) {
        headers.push({ Authorization: `Bearer ${apiKey}` })
      }
      payload = {
        model,
        max_tokens: 1,
        stream: false,
        messages: [{ role: 'user', content: 'hi' }],
      }
    }

    if (config.headers && typeof config.headers === 'object') {
      for (const [key, value] of Object.entries(config.headers)) {
        if (key && value !== undefined && value !== null) {
          headers.push({ [key]: String(value) })
        }
      }
    }

    const proxyRes = await forwardProxy(
      url,
      'POST',
      payload,
      headers,
      timeoutSeconds * 1000,
      'application/json'
    )

    const elapsed = Date.now() - startTime
    const status = proxyRes?.status ?? 0
    const body = typeof proxyRes?.body === 'string' ? proxyRes.body : ''

    if (status >= 200 && status < 300) {
      return {
        success: true,
        message: `连接成功（耗时 ${elapsed}ms），服务商响应正常`,
        elapsed,
      }
    }

    const brief = body.slice(0, 160)
    if (status === 401 || status === 403) {
      return {
        success: false,
        message: `鉴权失败 (HTTP ${status})：请检查 API Key 是否有效${brief ? ` (${brief})` : ''}`,
        elapsed,
      }
    }

    if (status === 404) {
      return {
        success: false,
        message: `端点未找到 (HTTP 404)：请检查 API 基础地址 (Base URL) 是否正确（OpenAI 兼容地址通常需以 /v1 结尾）`,
        elapsed,
      }
    }

    if (status === 429) {
      return {
        success: false,
        message: `请求被限流或余额不足 (HTTP 429)：请检查服务商账户额度与频率限制`,
        elapsed,
      }
    }

    if (status === 400) {
      return {
        success: false,
        message: `请求参数错误 (HTTP 400)：模型「${model}」可能不存在或不可用 (${brief})`,
        elapsed,
      }
    }

    if (status >= 500) {
      return {
        success: false,
        message: `服务商服务器错误 (HTTP ${status})：${brief}`,
        elapsed,
      }
    }

    return {
      success: false,
      message: `服务响应异常 (HTTP ${status})：${brief || '请检查配置或网络'}`,
      elapsed,
    }
  } catch (err: any) {
    const elapsed = Date.now() - startTime
    return {
      success: false,
      message: `网络或思源内核代理请求失败: ${err?.message || err}`,
      elapsed,
    }
  }
}
