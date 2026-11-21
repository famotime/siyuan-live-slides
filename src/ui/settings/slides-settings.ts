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

/**
 * 宿主面板 Normalizer：确保复合面板 100% 全宽展开，消除思源内置的 fn__size200 与居中右偏副作用
 */
function normalizeSettingPanelHost(panel: HTMLElement | null): void {
  if (!panel || typeof panel.closest !== "function") return

  panel.classList.remove("fn__flex-center", "fn__size200")
  panel.style.width = "100%"
  panel.style.height = "auto"
  panel.style.minHeight = "0"
  panel.style.flex = "none"
  panel.style.alignSelf = "stretch"

  const parent = panel.parentElement
  const itemWrap = panel.closest(".config-item, .config__item, .b3-label") || parent
  const titleWrap =
    itemWrap?.querySelector(":scope > .fn__flex-1, :scope > .fn__block, :scope .config-name, :scope .fn__flex-1") ||
    itemWrap?.querySelector(".config-name, .fn__flex-1")
  const spacer = itemWrap?.querySelector(".fn__space")

  if (itemWrap instanceof HTMLElement) {
    itemWrap.classList.add("slides-settings__host-item")
    itemWrap.style.height = "auto"
    itemWrap.style.minHeight = "0"
    itemWrap.style.alignItems = "stretch"
    itemWrap.style.flexDirection = "column"
  }

  if (parent instanceof HTMLElement && parent !== itemWrap) {
    parent.classList.add("slides-settings__host-block")
    parent.style.width = "100%"
    parent.style.height = "auto"
    parent.style.minHeight = "0"
  }

  if (titleWrap instanceof HTMLElement) {
    titleWrap.classList.add("slides-settings__host-title")
    titleWrap.style.overflow = "visible"
    titleWrap.style.minHeight = "0"
    titleWrap.style.textAlign = "left"
  }

  if (spacer instanceof HTMLElement) {
    spacer.style.display = "none"
  }
}

/**
 * 宿主单项行 Normalizer：清除开关控件上的 fn__size200 限制，标题靠左对齐，开关靠右齐平
 */
function normalizeSettingRowHost(control: HTMLElement | null): void {
  if (!control || typeof control.closest !== "function") return

  control.classList.remove("fn__flex-center", "fn__size200", "fn__block")
  const sw = control.matches(".b3-switch") ? control : control.querySelector(".b3-switch")
  if (sw) {
    sw.classList.remove("fn__flex-center", "fn__size200", "fn__block")
  }

  const itemWrap = control.closest(".config-item, .config__item, .b3-label") || control.parentElement
  const titleWrap = itemWrap?.querySelector(":scope > .fn__flex-1, .config-name")

  if (itemWrap instanceof HTMLElement) {
    itemWrap.classList.add("slides-settings__host-row")
    itemWrap.style.height = "auto"
    itemWrap.style.minHeight = "0"
    itemWrap.style.alignItems = "center"
  }

  if (titleWrap instanceof HTMLElement) {
    titleWrap.classList.add("slides-settings__host-title")
    titleWrap.style.overflow = "visible"
    titleWrap.style.minHeight = "0"
    titleWrap.style.textAlign = "left"
  }
}

function installSettingHostNormalizer(
  setting: any,
  panels: Array<HTMLElement | null>,
  rows: Array<HTMLElement | null>
): void {
  if (!setting || typeof setting.open !== "function") return
  const originalOpen = setting.open.bind(setting)

  const normalizeAll = () => {
    panels.forEach((p) => normalizeSettingPanelHost(p))
    rows.forEach((r) => normalizeSettingRowHost(r))
  }

  setting.open = ((name: string) => {
    originalOpen(name)
    normalizeAll()
    if (typeof setTimeout === "function") {
      setTimeout(() => {
        normalizeAll()
      }, 0)
    }
  })
}

function createSwitchWrap(switchEl: HTMLInputElement): HTMLElement {
  const wrap = document.createElement("div")
  wrap.className = "slides-settings__switch-wrap"
  wrap.style.cssText = "display: inline-flex; align-items: center; justify-content: flex-end;"
  wrap.appendChild(switchEl)
  return wrap
}

// 眼睛图标 SVG 定义 (开启/关闭切换)
const eyeOpenSvg = `<svg class="slides-settings__api-key-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12Z"/><circle cx="12" cy="12" r="3.25"/></svg>`
const eyeOffSvg = `<svg class="slides-settings__api-key-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.7 5.52A10.56 10.56 0 0 1 12 5.25c6 0 9.75 6.75 9.75 6.75a18.78 18.78 0 0 1-4.02 4.85M6.68 6.69C4.04 8.42 2.25 12 2.25 12s3.75 6.75 9.75 6.75c1.85 0 3.47-.64 4.85-1.55M9.88 9.88A3 3 0 0 0 9 12a3 3 0 0 0 3 3c.8 0 1.53-.31 2.07-.82"/></svg>`

export function createSlidesSettings(plugin: ISlidesSettingsHost) {
  const setting = new Setting({ width: "680px" })
  const globalSettings = getRuntimeSettings()
  let managedConfig: SharedConfig | null = getManagedAiConfig()

  // 1. AI 服务配置区域
  const aiPanel = document.createElement("div")
  aiPanel.className = "slides-settings__ai-panel"
  aiPanel.style.cssText = "display: flex; flex-direction: column; gap: 12px; width: 100%; text-align: left; box-sizing: border-box;"

  // 提示横幅容器
  const tipContainer = document.createElement("div")
  tipContainer.className = "slides-settings__tip-container"
  tipContainer.style.cssText = "width: 100%; text-align: left;"
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
        text-align: left;
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

  // 辅助函数：创建字段行 (全宽两列网格/弹性靠左对齐)
  function createFieldRow(label: string, inputEl: HTMLElement, desc?: string): HTMLElement {
    const row = document.createElement("div")
    row.className = "slides-settings__field-row"
    row.style.cssText = "display: flex; flex-direction: column; gap: 4px; width: 100%; text-align: left;"

    const top = document.createElement("div")
    top.className = "slides-settings__field-main"
    top.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%;"

    const labelSpan = document.createElement("span")
    labelSpan.className = "slides-settings__field-label"
    labelSpan.style.cssText = "font-size: 13px; font-weight: 500; min-width: 160px; color: var(--b3-theme-on-background); text-align: left; flex-shrink: 0;"
    labelSpan.textContent = label

    top.appendChild(labelSpan)
    top.appendChild(inputEl)
    row.appendChild(top)

    if (desc) {
      const descSpan = document.createElement("span")
      descSpan.className = "slides-settings__field-desc"
      descSpan.style.cssText = "font-size: 11px; color: var(--b3-theme-on-surface); line-height: 1.4; text-align: left;"
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

  // API Key (内嵌显示/隐藏眼睛图标)
  const apiKeyInputWrap = document.createElement("div")
  apiKeyInputWrap.className = "slides-settings__api-key-wrap"
  apiKeyInputWrap.style.cssText = "position: relative; display: flex; align-items: center; width: 100%; flex: 1;"

  const apiKeyInput = document.createElement("input")
  apiKeyInput.className = "b3-text-field slides-settings__api-key-input fn__flex-1"
  apiKeyInput.type = "password"
  apiKeyInput.placeholder = "sk-..."
  apiKeyInput.dataset.settingKey = "ai-api-key"
  apiKeyInput.style.cssText = "width: 100%; padding-right: 36px; box-sizing: border-box;"
  apiKeyInput.value = managedConfig ? managedConfig.apiKey : globalSettings.aiConfig.apiKey
  apiKeyInput.disabled = Boolean(managedConfig)
  apiKeyInput.addEventListener("change", async () => {
    const val = apiKeyInput.value.trim()
    await saveAiField({ apiKey: val })
  })

  let isKeyVisible = false
  const keyToggleBtn = document.createElement("button")
  keyToggleBtn.className = "slides-settings__api-key-toggle"
  keyToggleBtn.type = "button"
  keyToggleBtn.innerHTML = eyeOpenSvg
  keyToggleBtn.title = "显示 API Key"
  if (typeof keyToggleBtn.setAttribute === "function") {
    keyToggleBtn.setAttribute("aria-label", "显示 API Key")
  }
  keyToggleBtn.disabled = Boolean(managedConfig)
  keyToggleBtn.addEventListener("click", () => {
    isKeyVisible = !isKeyVisible
    apiKeyInput.type = isKeyVisible ? "text" : "password"
    keyToggleBtn.innerHTML = isKeyVisible ? eyeOffSvg : eyeOpenSvg
    keyToggleBtn.title = isKeyVisible ? "隐藏 API Key" : "显示 API Key"
    if (typeof keyToggleBtn.setAttribute === "function") {
      keyToggleBtn.setAttribute("aria-label", isKeyVisible ? "隐藏 API Key" : "显示 API Key")
    }
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
  advancedBody.className = "slides-settings__advanced-body"
  advancedBody.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding-top: 8px; text-align: left; width: 100%;"

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

  // 测试连接行 (靠左对齐)
  const testRow = document.createElement("div")
  testRow.className = "slides-settings__test-row"
  testRow.style.cssText = "display: flex; align-items: center; gap: 12px; margin-top: 8px; text-align: left; width: 100%;"

  const btnTest = document.createElement("button")
  btnTest.className = "b3-button b3-button--outline"
  btnTest.type = "button"
  btnTest.textContent = "测试连接"

  const testStatus = document.createElement("span")
  testStatus.className = "slides-settings__test-status"
  testStatus.style.cssText = "font-size: 12px; color: var(--b3-theme-on-surface); flex: 1; word-break: break-all; text-align: left;"

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
  aiPanel.appendChild(createFieldRow("API 基础地址 (Base URL)", baseUrlInput))
  aiPanel.appendChild(createFieldRow("API 鉴权密钥 (API Key)", apiKeyInputWrap))
  aiPanel.appendChild(createFieldRow("模型名称 (Model)", modelInput))
  aiPanel.appendChild(advancedParamsWrap)
  aiPanel.appendChild(testRow)

  // 1. AI 演讲提词服务卡片 (上下纵向布局，全宽居左展开)
  setting.addItem({
    title: "AI 演讲提词服务",
    direction: "row",
    description: "配置兼容 OpenAI API 的大模型服务，用于提炼演讲口播提词卡 (Notes)。支持被「API 旋钮」集中调度接管。",
    actionElement: aiPanel,
  })

  // 2. 本地网络伺服预览设置 (思源标准独立项)
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
  webServeUrlInput.className = "b3-text-field fn__size200"
  webServeUrlInput.value = globalSettings.webServeUrl
  webServeUrlInput.placeholder = "http://127.0.0.1:6806"
  webServeUrlInput.disabled = !globalSettings.enableWebServeJump
  webServeUrlInput.addEventListener("change", async () => {
    const val = webServeUrlInput.value.trim() || DEFAULT_GLOBAL_SETTINGS.webServeUrl
    setRuntimeSettings({ webServeUrl: val })
    await plugin.saveGlobalSettings({ webServeUrl: val })
  })

  const webServeToggleWrap = createSwitchWrap(webServeToggle)

  setting.addItem({
    title: "启用网络伺服链接外跳",
    description: "开启后，幻灯片中的思源块引用链接可以点击以外部网络伺服抽屉呈现",
    actionElement: webServeToggleWrap,
  })

  setting.addItem({
    title: "伺服主机地址",
    description: "思源笔记桌面端 WebServe 伺服地址 (如 http://127.0.0.1:6806)",
    actionElement: webServeUrlInput,
  })

  // 3. 视觉排版与列表标记 (思源标准独立项)
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

  const headingSizeToggleWrap = createSwitchWrap(headingSizeToggle)
  const ulMarkerToggleWrap = createSwitchWrap(ulMarkerToggle)
  const olMarkerToggleWrap = createSwitchWrap(olMarkerToggle)

  setting.addItem({
    title: "固定页面标题大小",
    description: "开启后限制正文大标题在幻灯片中不超出安全展示画幅",
    actionElement: headingSizeToggleWrap,
  })

  setting.addItem({
    title: "无序列表圆点前缀标记",
    description: "开启后在无序列表项前展示圆点前缀标记",
    actionElement: ulMarkerToggleWrap,
  })

  setting.addItem({
    title: "有序列表数字序号标记",
    description: "开启后在有序列表项前展示数字序号标记",
    actionElement: olMarkerToggleWrap,
  })

  // 安装 Host Normalizer，确保 setting.open 时彻底清除思源副作用并稳定对齐
  installSettingHostNormalizer(
    setting,
    [aiPanel],
    [
      webServeToggleWrap,
      webServeUrlInput,
      headingSizeToggleWrap,
      ulMarkerToggleWrap,
      olMarkerToggleWrap,
    ]
  )

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
    keyToggleBtn.disabled = isManaged
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
