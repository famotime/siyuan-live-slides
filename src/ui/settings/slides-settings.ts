/**
 * 演示设置面板 (openSetting)
 * 聚合 AI 服务配置、本地网络伺服及排版标记选项
 * 支持接收 siyuan-api-switch 广播并实时零刷新更新
 */

import { Setting } from "siyuan"
import { testAiConnection } from "@/ai/ai-service"
import {
  DEFAULT_AI_CONFIG,
  DEFAULT_GLOBAL_SETTINGS,
  getManagedAiConfig,
  getRuntimeSettings,
  isAiConfigComplete,
  normalizeAiConfig,
  setRuntimeSettings,
} from "@/settings"
import type { IAiServiceConfig, ISlidesGlobalSettings } from "@/settings"
import type { SharedConfig } from "@/types/api-switch"

export interface ISlidesSettingsHost {
  name: string
  displayName: string
  saveGlobalSettings(nextSettings?: Partial<ISlidesGlobalSettings>): Promise<ISlidesGlobalSettings>
}

export function createSlidesSettings(plugin: ISlidesSettingsHost) {
  const setting = new Setting({ width: "680px" })
  const globalSettings = getRuntimeSettings()
  let managedConfig: SharedConfig | null = getManagedAiConfig()

  // 1. AI 服务配置区域
  const aiPanel = document.createElement("div")
  aiPanel.className = "slides-settings__ai-panel"
  aiPanel.style.cssText = "display: flex; flex-direction: column; gap: 10px; width: 100%;"

  // 提示横幅容器
  const tipContainer = document.createElement("div")
  tipContainer.className = "slides-settings__tip-container"
  aiPanel.appendChild(tipContainer)

  function updateTipBanner(managed: SharedConfig | null) {
    tipContainer.innerHTML = ""
    if (managed) {
      const tip = document.createElement("div")
      tip.className = "api-switch-managed-tip"
      tip.style.cssText = `
        background-color: var(--b3-theme-primary-light, rgba(63, 81, 181, 0.08));
        border: 1px solid var(--b3-theme-primary, rgba(63, 81, 181, 0.2));
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--b3-theme-on-background);
      `
      const isEn = (window as any).siyuan?.config?.lang === "en_US"
      const profileName = managed.profileName || (isEn ? "Unnamed" : "未命名")
      tip.innerHTML = isEn
        ? `💡 General AI API is managed by <strong>API Switch (siyuan-api-switch)</strong> (Profile: ${profileName}). Related inputs are read-only. Please configure in the API Switch panel.`
        : `💡 通用 AI API 已由 <strong>API 旋钮 (siyuan-api-switch)</strong> 接管 (Profile: ${profileName})。相关输入框已置灰只读，如需修改请前往 API 旋钮面板。`
      tipContainer.appendChild(tip)
    }
  }

  updateTipBanner(managedConfig)

  // 辅助函数：创建字段行
  function createFieldRow(label: string, inputEl: HTMLElement, desc?: string): HTMLElement {
    const row = document.createElement("div")
    row.style.cssText = "display: flex; flex-direction: column; gap: 4px;"

    const top = document.createElement("div")
    top.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 12px;"

    const labelSpan = document.createElement("span")
    labelSpan.style.cssText = "font-size: 13px; font-weight: 500; min-width: 120px; color: var(--b3-theme-on-background);"
    labelSpan.textContent = label

    top.appendChild(labelSpan)
    top.appendChild(inputEl)
    row.appendChild(top)

    if (desc) {
      const descSpan = document.createElement("span")
      descSpan.style.cssText = "font-size: 11px; color: var(--b3-theme-on-surface); line-height: 1.4;"
      descSpan.textContent = desc
      row.appendChild(descSpan)
    }

    return row
  }

  // Base URL
  const baseUrlInput = document.createElement("input")
  baseUrlInput.className = "b3-text-field fn__flex-1"
  baseUrlInput.placeholder = "https://api.openai.com/v1"
  baseUrlInput.dataset.settingKey = "ai-base-url"
  baseUrlInput.value = managedConfig ? managedConfig.baseUrl : globalSettings.aiConfig.baseUrl
  baseUrlInput.disabled = Boolean(managedConfig)
  baseUrlInput.addEventListener("change", async () => {
    const val = baseUrlInput.value.trim()
    await saveAiField({ baseUrl: val })
  })

  // API Key (带显示/隐藏眼睛按钮)
  const apiKeyInputWrap = document.createElement("div")
  apiKeyInputWrap.style.cssText = "display: flex; align-items: center; gap: 6px; flex: 1;"

  const apiKeyInput = document.createElement("input")
  apiKeyInput.className = "b3-text-field fn__flex-1"
  apiKeyInput.type = "password"
  apiKeyInput.placeholder = "sk-..."
  apiKeyInput.dataset.settingKey = "ai-api-key"
  apiKeyInput.value = managedConfig ? managedConfig.apiKey : globalSettings.aiConfig.apiKey
  apiKeyInput.disabled = Boolean(managedConfig)
  apiKeyInput.addEventListener("change", async () => {
    const val = apiKeyInput.value.trim()
    await saveAiField({ apiKey: val })
  })

  let isKeyVisible = false
  const keyToggleBtn = document.createElement("button")
  keyToggleBtn.className = "b3-button b3-button--text"
  keyToggleBtn.type = "button"
  keyToggleBtn.style.cssText = "padding: 4px 8px; font-size: 12px; cursor: pointer;"
  keyToggleBtn.textContent = "显示"
  keyToggleBtn.addEventListener("click", () => {
    isKeyVisible = !isKeyVisible
    apiKeyInput.type = isKeyVisible ? "text" : "password"
    keyToggleBtn.textContent = isKeyVisible ? "隐藏" : "显示"
  })

  apiKeyInputWrap.appendChild(apiKeyInput)
  apiKeyInputWrap.appendChild(keyToggleBtn)

  // Model
  const modelInput = document.createElement("input")
  modelInput.className = "b3-text-field fn__flex-1"
  modelInput.placeholder = "gpt-4o-mini / deepseek-chat"
  modelInput.dataset.settingKey = "ai-model"
  modelInput.value = managedConfig ? managedConfig.model : globalSettings.aiConfig.model
  modelInput.disabled = Boolean(managedConfig)
  modelInput.addEventListener("change", async () => {
    const val = modelInput.value.trim()
    await saveAiField({ model: val })
  })

  // 高级参数折叠容器
  const advancedParamsWrap = document.createElement("details")
  advancedParamsWrap.style.cssText = "margin-top: 4px; font-size: 12px;"
  const summary = document.createElement("summary")
  summary.style.cssText = "cursor: pointer; color: var(--b3-theme-primary); font-weight: 500; padding: 4px 0;"
  summary.textContent = "高级模型参数 (超时/采样温度/Token)"
  advancedParamsWrap.appendChild(summary)

  const advancedBody = document.createElement("div")
  advancedBody.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding-top: 8px;"

  // Timeout
  const timeoutInput = document.createElement("input")
  timeoutInput.className = "b3-text-field fn__flex-1"
  timeoutInput.type = "number"
  timeoutInput.dataset.settingKey = "ai-timeout"
  timeoutInput.value = String(
    managedConfig?.requestTimeoutSeconds ?? globalSettings.aiConfig.requestTimeoutSeconds ?? DEFAULT_AI_CONFIG.requestTimeoutSeconds
  )
  timeoutInput.disabled = Boolean(managedConfig)
  timeoutInput.addEventListener("change", async () => {
    const val = Number.parseInt(timeoutInput.value, 10) || DEFAULT_AI_CONFIG.requestTimeoutSeconds
    await saveAiField({ requestTimeoutSeconds: val })
  })

  // Temperature
  const tempInput = document.createElement("input")
  tempInput.className = "b3-text-field fn__flex-1"
  tempInput.type = "number"
  tempInput.step = "0.1"
  tempInput.dataset.settingKey = "ai-temperature"
  tempInput.value = String(
    managedConfig?.temperature ?? globalSettings.aiConfig.temperature ?? DEFAULT_AI_CONFIG.temperature
  )
  tempInput.disabled = Boolean(managedConfig)
  tempInput.addEventListener("change", async () => {
    const val = Number.parseFloat(tempInput.value) || DEFAULT_AI_CONFIG.temperature
    await saveAiField({ temperature: val })
  })

  // Max Tokens
  const maxTokensInput = document.createElement("input")
  maxTokensInput.className = "b3-text-field fn__flex-1"
  maxTokensInput.type = "number"
  maxTokensInput.dataset.settingKey = "ai-max-tokens"
  maxTokensInput.value = String(
    managedConfig?.maxTokens ?? globalSettings.aiConfig.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens
  )
  maxTokensInput.disabled = Boolean(managedConfig)
  maxTokensInput.addEventListener("change", async () => {
    const val = Number.parseInt(maxTokensInput.value, 10) || DEFAULT_AI_CONFIG.maxTokens
    await saveAiField({ maxTokens: val })
  })

  advancedBody.appendChild(createFieldRow("请求超时时间 (秒)", timeoutInput))
  advancedBody.appendChild(createFieldRow("采样温度 (Temperature)", tempInput, "范围 0.0 - 2.0，数值越高越富有创意"))
  advancedBody.appendChild(createFieldRow("单次最大输出 Token", maxTokensInput))
  advancedParamsWrap.appendChild(advancedBody)

  // 测试连接行
  const testRow = document.createElement("div")
  testRow.style.cssText = "display: flex; align-items: center; gap: 10px; margin-top: 6px;"

  const btnTest = document.createElement("button")
  btnTest.className = "b3-button b3-button--outline"
  btnTest.type = "button"
  btnTest.textContent = "测试连接"

  const testStatus = document.createElement("span")
  testStatus.style.cssText = "font-size: 12px; color: var(--b3-theme-on-surface); flex: 1; word-break: break-all;"

  btnTest.addEventListener("click", async () => {
    const active = managedConfig || {
      baseUrl: baseUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim(),
      requestTimeoutSeconds: Number.parseInt(timeoutInput.value, 10) || 15,
      temperature: Number.parseFloat(tempInput.value) || 0.7,
      maxTokens: 10,
    }

    if (!isAiConfigComplete(active)) {
      testStatus.style.color = "var(--b3-theme-error, #f44336)"
      testStatus.textContent = "请先填写完整的 Base URL、API Key 与 Model"
      return
    }

    btnTest.disabled = true
    testStatus.style.color = "var(--b3-theme-primary)"
    testStatus.textContent = "正在发起测试请求..."

    const res = await testAiConnection(active)
    btnTest.disabled = false
    if (res.success) {
      testStatus.style.color = "var(--b3-theme-primary, #4caf50)"
      testStatus.textContent = res.message
    } else {
      testStatus.style.color = "var(--b3-theme-error, #f44336)"
      testStatus.textContent = res.message
    }
  })

  testRow.appendChild(btnTest)
  testRow.appendChild(testStatus)

  // 组装 AI 服务表单
  aiPanel.appendChild(createFieldRow("API 基础地址 (Base URL)", baseUrlInput, "兼容 OpenAI 规范的 API 根路径，如 https://api.deepseek.com/v1"))
  aiPanel.appendChild(createFieldRow("API 鉴权密钥 (API Key)", apiKeyInputWrap))
  aiPanel.appendChild(createFieldRow("模型名称 (Model)", modelInput, "例如 deepseek-chat, gpt-4o-mini 等"))
  aiPanel.appendChild(advancedParamsWrap)
  aiPanel.appendChild(testRow)

  setting.addItem({
    title: "AI 演讲提词服务",
    direction: "column",
    description: "配置兼容 OpenAI API 的大模型服务，用于提炼演讲口播提词卡 (Notes)。支持被「API 旋钮」集中调度接管。",
    actionElement: aiPanel,
  })

  // 2. 本地网络伺服预览设置
  const webServePanel = document.createElement("div")
  webServePanel.style.cssText = "display: flex; flex-direction: column; gap: 8px; width: 100%;"

  const webServeToggle = document.createElement("input")
  webServeToggle.className = "b3-switch fn__flex-center"
  webServeToggle.type = "checkbox"
  webServeToggle.checked = globalSettings.enableWebServeJump
  webServeToggle.addEventListener("change", async () => {
    const enabled = webServeToggle.checked
    webServeUrlInput.disabled = !enabled
    setRuntimeSettings({ enableWebServeJump: enabled })
    await plugin.saveGlobalSettings({ enableWebServeJump: enabled })
  })

  const webServeUrlInput = document.createElement("input")
  webServeUrlInput.className = "b3-text-field fn__flex-1"
  webServeUrlInput.value = globalSettings.webServeUrl
  webServeUrlInput.placeholder = "http://127.0.0.1:6806"
  webServeUrlInput.disabled = !globalSettings.enableWebServeJump
  webServeUrlInput.addEventListener("change", async () => {
    const val = webServeUrlInput.value.trim() || DEFAULT_GLOBAL_SETTINGS.webServeUrl
    setRuntimeSettings({ webServeUrl: val })
    await plugin.saveGlobalSettings({ webServeUrl: val })
  })

  webServePanel.appendChild(createFieldRow("启用网络伺服链接外跳", webServeToggle, "开启后，幻灯片中的思源块引用链接可以点击以外部网络伺服抽屉呈现"))
  webServePanel.appendChild(createFieldRow("伺服主机地址", webServeUrlInput))

  setting.addItem({
    title: "网络伺服与文档外跳",
    direction: "column",
    description: "配置思源笔记桌面端 WebServe 伺服地址及幻灯片交互行为",
    actionElement: webServePanel,
  })

  // 3. 视觉排版与列表标记
  const typographyPanel = document.createElement("div")
  typographyPanel.style.cssText = "display: flex; flex-direction: column; gap: 8px; width: 100%;"

  const headingSizeToggle = document.createElement("input")
  headingSizeToggle.className = "b3-switch fn__flex-center"
  headingSizeToggle.type = "checkbox"
  headingSizeToggle.checked = globalSettings.normalizeHeadingSizes
  headingSizeToggle.addEventListener("change", async () => {
    const val = headingSizeToggle.checked
    setRuntimeSettings({ normalizeHeadingSizes: val })
    await plugin.saveGlobalSettings({ normalizeHeadingSizes: val })
  })

  const ulMarkerToggle = document.createElement("input")
  ulMarkerToggle.className = "b3-switch fn__flex-center"
  ulMarkerToggle.type = "checkbox"
  ulMarkerToggle.checked = globalSettings.showUnorderedListMarkers
  ulMarkerToggle.addEventListener("change", async () => {
    const val = ulMarkerToggle.checked
    setRuntimeSettings({ showUnorderedListMarkers: val })
    await plugin.saveGlobalSettings({ showUnorderedListMarkers: val })
  })

  const olMarkerToggle = document.createElement("input")
  olMarkerToggle.className = "b3-switch fn__flex-center"
  olMarkerToggle.type = "checkbox"
  olMarkerToggle.checked = globalSettings.showOrderedListMarkers
  olMarkerToggle.addEventListener("change", async () => {
    const val = olMarkerToggle.checked
    setRuntimeSettings({ showOrderedListMarkers: val })
    await plugin.saveGlobalSettings({ showOrderedListMarkers: val })
  })

  typographyPanel.appendChild(createFieldRow("固定特定标题大小", headingSizeToggle, "开启后限制正文大标题在幻灯片中不超出安全展示画幅"))
  typographyPanel.appendChild(createFieldRow("无序列表圆点前缀标记", ulMarkerToggle))
  typographyPanel.appendChild(createFieldRow("有序列表数字序号标记", olMarkerToggle))

  setting.addItem({
    title: "排版与标记",
    direction: "column",
    description: "全局幻灯片文字大小保护与列表视觉前缀配置",
    actionElement: typographyPanel,
  })

  // 保存本地 AI 配置变更
  async function saveAiField(partial: Partial<IAiServiceConfig>) {
    const current = getRuntimeSettings().aiConfig
    const updated = normalizeAiConfig({
      ...current,
      ...partial,
    })
    setRuntimeSettings({ aiConfig: updated })
    await plugin.saveGlobalSettings({ aiConfig: updated })

    // 若 API 旋钮在线，上报最新本地配置快照
    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.updateLocalConfig(plugin.name, {
        provider: "custom",
        baseUrl: updated.baseUrl,
        apiKey: updated.apiKey,
        model: updated.model,
        requestTimeoutSeconds: updated.requestTimeoutSeconds,
        temperature: updated.temperature,
        maxTokens: updated.maxTokens,
      })
    }
  }

  // 注入 updateManagedConfig 方法供外部实时零刷新调用
  ;(setting as any).updateManagedConfig = (managed: SharedConfig | null) => {
    managedConfig = managed
    updateTipBanner(managed)

    const isManaged = Boolean(managed)
    const local = getRuntimeSettings().aiConfig

    baseUrlInput.disabled = isManaged
    apiKeyInput.disabled = isManaged
    modelInput.disabled = isManaged
    timeoutInput.disabled = isManaged
    tempInput.disabled = isManaged
    maxTokensInput.disabled = isManaged

    baseUrlInput.value = managed ? managed.baseUrl : local.baseUrl
    apiKeyInput.value = managed ? managed.apiKey : local.apiKey
    modelInput.value = managed ? managed.model : local.model
    timeoutInput.value = String(managed?.requestTimeoutSeconds ?? local.requestTimeoutSeconds)
    tempInput.value = String(managed?.temperature ?? local.temperature)
    maxTokensInput.value = String(managed?.maxTokens ?? local.maxTokens)

    testStatus.textContent = ""
  }

  return setting
}
