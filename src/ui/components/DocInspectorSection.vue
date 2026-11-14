<template>
  <div class="spm-section spm-section--doc">
    <div class="spm-section-header">
      <span>全局演示配置</span>
    </div>

    <!-- 主题切换 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="全局幻灯片视觉设计范式"
          >
            <SlidesIcon name="palette" />
            <span>幻灯片主题</span>
          </div>
        </div>
      </div>
      <div class="spm-theme-card-grid">
        <button
          v-for="(item, idx) in themeOptions"
          :key="item.value"
          type="button"
          class="spm-theme-card b3-tooltips"
          :class="[
            'is-' + item.value,
            idx === 0 ? 'b3-tooltips__ne' : idx === themeOptions.length - 1 ? 'b3-tooltips__nw' : 'b3-tooltips__n',
            { active: docTheme === item.value },
          ]"
          :aria-label="item.desc"
          @click="$emit('update:docTheme', item.value)"
        >
          <span class="spm-theme-card-preview" :class="'theme-preview--' + item.value" aria-hidden="true">
            <span class="spm-theme-card-canvas">
              <span class="spm-theme-card-title">Aa</span>
              <span class="spm-theme-card-lines">
                <span class="spm-theme-card-line is-primary"></span>
                <span class="spm-theme-card-line is-secondary"></span>
              </span>
            </span>
            <span v-if="docTheme === item.value" class="spm-bg-swatch-check">✓</span>
          </span>
          <span class="spm-theme-card-label">{{ item.label }}</span>
        </button>
      </div>
    </div>

    <!-- 演示背景 (Presentation Background) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="全篇幻灯片统一底色、微渐变或壁纸"
          >
            <SlidesIcon name="palette" />
            <span>演示背景</span>
          </div>
        </div>
      </div>
      <div class="spm-bg-swatch-grid">
        <button
          v-for="bg in presetBackgrounds"
          :key="bg.value || '__default__'"
          type="button"
          class="spm-bg-swatch b3-tooltips b3-tooltips__n"
          :class="{ active: (docBackground || '') === bg.value, 'is-default': !bg.value }"
          :aria-label="bg.desc"
          @click="$emit('update:docBackground', bg.value)"
        >
          <span class="spm-bg-swatch-preview" :style="getBgPreviewStyle(bg.value)">
            <span class="spm-bg-swatch-aa" :class="'is-' + bg.mode">Aa</span>
            <span v-if="(docBackground || '') === bg.value" class="spm-bg-swatch-check">✓</span>
          </span>
          <span class="spm-bg-swatch-label">{{ bg.label }}</span>
        </button>
      </div>
      <div class="spm-bg-input-row">
        <span
          class="spm-bg-input-preview"
          :style="getBgPreviewStyle(docBackground || '')"
          aria-hidden="true"
        ></span>
        <input
          :value="docBackground || ''"
          class="spm-input spm-bg-input"
          placeholder="自定义：#hex / gradient / assets/..."
          @input="$emit('update:docBackground', ($event.target as HTMLInputElement).value)"
          @change="$emit('update:docBackground', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="docBackground"
          type="button"
          class="spm-bg-input-clear b3-tooltips b3-tooltips__nw"
          aria-label="清除并恢复默认背景"
          @click="$emit('update:docBackground', '')"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- 画幅比例 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="演讲屏幕投影宽高比"
          >
            <SlidesIcon name="ratio" />
            <span>画幅比例</span>
          </div>
        </div>
      </div>
      <div class="spm-segmented-group">
        <button
          class="spm-segmented-item"
          :class="{ active: docAspectRatio === '16/9' }"
          @click="$emit('update:docAspectRatio', '16/9')"
        >
          16 : 9 (宽屏)
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: docAspectRatio === '4/3' }"
          @click="$emit('update:docAspectRatio', '4/3')"
        >
          4 : 3 (标屏)
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: docAspectRatio === '16/10' }"
          @click="$emit('update:docAspectRatio', '16/10')"
        >
          16 : 10
        </button>
      </div>
    </div>

    <!-- 间距风格 (Spacing) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="内衬、内容间隙与正文行距预设"
          >
            <SlidesIcon name="ratio" />
            <span>间距风格</span>
          </div>
        </div>
      </div>
      <div class="spm-segmented-group">
        <button
          class="spm-segmented-item b3-tooltips b3-tooltips__se"
          :class="{ active: (docSpacing || 'normal') === 'compact' }"
          aria-label="紧凑排版：外衬 16/28px，块距 8px，行高 1.45"
          @click="$emit('update:docSpacing', 'compact')"
        >
          紧凑
        </button>
        <button
          class="spm-segmented-item b3-tooltips b3-tooltips__s"
          :class="{ active: (docSpacing || 'normal') === 'normal' }"
          aria-label="标准排版：外衬 32/48px，块距 14px，行高 1.60（推荐默认）"
          @click="$emit('update:docSpacing', 'normal')"
        >
          标准
        </button>
        <button
          class="spm-segmented-item b3-tooltips b3-tooltips__sw"
          :class="{ active: (docSpacing || 'normal') === 'loose' }"
          aria-label="宽松排版：外衬 52/72px，块距 22px，行高 1.75"
          @click="$emit('update:docSpacing', 'loose')"
        >
          宽松
        </button>
      </div>
    </div>

    <!-- 全局默认转场 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="页面切换过渡动效（未单设转场的页面将继承此动效）"
          >
            <SlidesIcon name="transition" />
            <span>全局默认转场</span>
          </div>
        </div>
      </div>
      <TransitionSelector
        :model-value="docDefaultTransition"
        :hide-header="true"
        @change="$emit('update:docDefaultTransition', $event)"
      />
    </div>

    <!-- 演示全局核心动作组 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <span class="spm-control-title">演示全局操作</span>
        </div>
      </div>
      <div class="spm-action-grid">
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          aria-label="在当前文档下方开启分屏同步预览 (Alt+P)"
          @click="$emit('openBottomPreview')"
        >
          <SlidesIcon name="split-preview" />
          <span>分屏预览</span>
        </button>

        <!-- 演讲者视图（presenterMode 开关关闭时隐藏入口） -->
        <button
          v-if="isFeatureEnabled('presenterMode')"
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="打开双屏演讲者控制台视窗 (Alt+M)"
          @click="$emit('openPresenter')"
        >
          <SlidesIcon name="presenter" />
          <span>演讲者视图</span>
        </button>

        <!-- 智能分页（分析长文本大纲与篇幅，自动插入分页线） -->
        <button
          v-if="isFeatureEnabled('aiScript')"
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          aria-label="智能分析长文本大纲与篇幅，自动插入分页线"
          @click="$emit('aiAutoSplit')"
        >
          <SlidesIcon name="sparkles" />
          <span>智能分页</span>
        </button>

        <!-- 清除分页 -->
        <button
          v-if="isFeatureEnabled('aiScript')"
          class="spm-btn-action spm-btn-danger b3-tooltips b3-tooltips__sw"
          aria-label="一键清除当前文档中的所有幻灯片分页线（需二次确认）"
          :disabled="isBatchProcessing"
          @click="$emit('clearDividers')"
        >
          <SlidesIcon name="trash" />
          <span>清除分页</span>
        </button>

        <!-- 智能设置动效 -->
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          aria-label="自动为正文各页标题及首块之外的后续内容块配置顺延 (+1) 逐步呈现动效"
          :disabled="isBatchProcessing"
          @click="$emit('autoAnimate')"
        >
          <SlidesIcon name="step" />
          <span>智能动效</span>
        </button>

        <!-- 清除动效 -->
        <button
          class="spm-btn-action spm-btn-danger b3-tooltips b3-tooltips__sw"
          aria-label="清除所有页面内容块的逐步显现与入场微动效配置（需二次确认）"
          :disabled="isBatchProcessing"
          @click="$emit('clearAnimations')"
        >
          <SlidesIcon name="trash" />
          <span>清除动效</span>
        </button>

        <!-- 增加讲稿块（识别规范化已有候选块 + 为缺少讲稿页新增默认块） -->
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          aria-label="识别已有候选讲稿并为空白页新增默认讲稿块（不会重复添加）"
          :disabled="isBatchProcessing"
          @click="$emit('addOrIdentifyNotes')"
        >
          <SlidesIcon name="notes" />
          <span>增加讲稿块</span>
        </button>

        <!-- 清除讲稿块 -->
        <button
          class="spm-btn-action spm-btn-danger b3-tooltips b3-tooltips__sw"
          aria-label="物理删除文档中所有页面的全部讲稿备注块（需二次确认）"
          :disabled="isBatchProcessing"
          @click="$emit('clearNotes')"
        >
          <SlidesIcon name="trash" />
          <span>清除讲稿块</span>
        </button>

        <button
          v-if="isFeatureEnabled('exportHtml')"
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          aria-label="打包导出离线单文件 HTML 幻灯片"
          @click="$emit('exportHtml')"
        >
          <SlidesIcon name="export-html" />
          <span>导出 HTML</span>
        </button>

        <button
          v-if="isFeatureEnabled('exportPdf')"
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="打印生成 16:9 高清演示 PDF 讲义"
          @click="$emit('exportPdf')"
        >
          <SlidesIcon name="export-pdf" />
          <span>导出 PDF</span>
        </button>
      </div>
    </div>

    <!-- 高级设置（默认折叠，需手动点击展开） -->
    <div class="spm-advanced-menu" :class="{ 'is-expanded': isAdvancedExpanded }">
      <button
        type="button"
        class="spm-advanced-toggle"
        :aria-expanded="isAdvancedExpanded"
        @click="isAdvancedExpanded = !isAdvancedExpanded"
      >
        <span class="spm-advanced-toggle-label">
          <SlidesIcon name="settings" />
          <span>高级设置</span>
        </span>
        <SlidesIcon name="chevron-right" class="spm-advanced-chevron" />
      </button>

      <div v-if="isAdvancedExpanded" class="spm-advanced-content">
        <!-- 本地网络伺服预览 (Web Serve) -->
        <div class="spm-card-control">
          <div class="spm-control-header">
            <div class="spm-control-title-group">
              <div
                class="spm-control-title b3-tooltips b3-tooltips__se"
                aria-label="点击文档/块链接以 Webview 抽屉呈现，支持外跳"
              >
                <SlidesIcon name="external-link" />
                <span>本地网络伺服预览</span>
              </div>
            </div>
            <label
              class="spm-switch b3-tooltips b3-tooltips__w"
              :aria-label="globalSettings.enableWebServeJump ? '关闭本地网络伺服预览' : '开启本地网络伺服预览'"
            >
              <input
                type="checkbox"
                :checked="globalSettings.enableWebServeJump"
                @change="onToggleWebServe(($event.target as HTMLInputElement).checked)"
              />
              <span class="spm-switch-slider"></span>
            </label>
          </div>
          <div v-if="globalSettings.enableWebServeJump" class="spm-control-body" style="margin-top: 8px;">
            <input
              :value="globalSettings.webServeUrl"
              class="spm-input"
              placeholder="http://127.0.0.1:6806"
              spellcheck="false"
              @keydown.stop
              @keyup.stop
              @input="onWebServeUrlInput(($event.target as HTMLInputElement).value)"
              @change="onWebServeUrlChange(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <!-- 规范化特定标题大小 (Normalize Heading Sizes) -->
        <div class="spm-card-control">
          <div class="spm-control-header">
            <div class="spm-control-title-group">
              <div
                class="spm-control-title b3-tooltips b3-tooltips__se"
                aria-label="除封面外页首标题按 H2、多栏内首标题按 H3 大小展示"
              >
                <SlidesIcon name="type" />
                <span>固定特定标题大小</span>
              </div>
            </div>
            <label
              class="spm-switch b3-tooltips b3-tooltips__w"
              :aria-label="globalSettings.normalizeHeadingSizes ? '关闭固定特定标题大小' : '开启固定特定标题大小'"
            >
              <input
                type="checkbox"
                :checked="globalSettings.normalizeHeadingSizes"
                @change="onToggleNormalizeHeadings(($event.target as HTMLInputElement).checked)"
              />
              <span class="spm-switch-slider"></span>
            </label>
          </div>
        </div>

        <!-- 列表前缀标记 (List Markers) -->
        <div class="spm-card-control">
          <div class="spm-control-header">
            <div class="spm-control-title-group">
              <div
                class="spm-control-title b3-tooltips b3-tooltips__se"
                aria-label="分别控制正文中无序列表圆点与有序列表数字序号的呈现"
              >
                <SlidesIcon name="list" />
                <span>列表前缀标记</span>
              </div>
            </div>
          </div>
          <div class="spm-list-markers-toggles" style="display: flex; gap: 8px; margin-top: 8px;">
            <div
              class="spm-marker-toggle-item"
              style="flex: 1; display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--b3-theme-surface); border: 1px solid var(--b3-border-color); border-radius: 4px;"
            >
              <span style="font-size: 12px; color: var(--b3-theme-on-surface);">无序圆点</span>
              <label
                class="spm-switch b3-tooltips b3-tooltips__w"
                :aria-label="globalSettings.showUnorderedListMarkers ? '关闭无序列表圆点显示' : '开启无序列表圆点显示'"
              >
                <input
                  type="checkbox"
                  :checked="globalSettings.showUnorderedListMarkers"
                  @change="onToggleUnorderedMarkers(($event.target as HTMLInputElement).checked)"
                />
                <span class="spm-switch-slider"></span>
              </label>
            </div>
            <div
              class="spm-marker-toggle-item"
              style="flex: 1; display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--b3-theme-surface); border: 1px solid var(--b3-border-color); border-radius: 4px;"
            >
              <span style="font-size: 12px; color: var(--b3-theme-on-surface);">有序序号</span>
              <label
                class="spm-switch b3-tooltips b3-tooltips__w"
                :aria-label="globalSettings.showOrderedListMarkers ? '关闭有序列表序号显示' : '开启有序列表序号显示'"
              >
                <input
                  type="checkbox"
                  :checked="globalSettings.showOrderedListMarkers"
                  @change="onToggleOrderedMarkers(($event.target as HTMLInputElement).checked)"
                />
                <span class="spm-switch-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- AI 演讲提词服务配置 (AI Service Config) -->
        <div class="spm-card-control">
          <div class="spm-control-header">
            <div class="spm-control-title-group">
              <div
                class="spm-control-title b3-tooltips b3-tooltips__se"
                aria-label="提炼演讲口播提词卡，支持 API 旋钮接管调度"
              >
                <SlidesIcon name="sparkles" />
                <span>AI 演讲提词服务</span>
              </div>
            </div>
            <button
              type="button"
              class="spm-btn-icon b3-tooltips b3-tooltips__w"
              aria-label="打开完整设置弹窗"
              @click="openSettingsDialog"
            >
              <SlidesIcon name="settings" />
            </button>
          </div>

          <!-- 接管状态横幅 -->
          <div
            v-if="managedAiConfig"
            class="api-switch-managed-tip"
            style="margin-top: 8px; background-color: var(--b3-theme-primary-light, rgba(63, 81, 181, 0.08)); border: 1px solid var(--b3-theme-primary, rgba(63, 81, 181, 0.2)); border-radius: 6px; padding: 8px 10px; font-size: 11px; line-height: 1.4; color: var(--b3-theme-on-background);"
          >
            💡 通用 AI API 已由 <strong>API 旋钮 (siyuan-api-switch)</strong> 接管 (Profile: {{ managedAiConfig.profileName || '未命名' }})。相关输入框已置灰只读。
          </div>

          <!-- 紧凑表单 -->
          <div class="spm-control-body" style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span style="font-size: 12px; min-width: 60px; color: var(--b3-theme-on-surface);">模型:</span>
              <input
                :value="managedAiConfig ? managedAiConfig.model : globalSettings.aiConfig.model"
                class="spm-input"
                :disabled="Boolean(managedAiConfig)"
                placeholder="例如 deepseek-chat"
                @change="onAiModelChange(($event.target as HTMLInputElement).value)"
              />
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span style="font-size: 12px; min-width: 60px; color: var(--b3-theme-on-surface);">Base URL:</span>
              <input
                :value="managedAiConfig ? managedAiConfig.baseUrl : globalSettings.aiConfig.baseUrl"
                class="spm-input"
                :disabled="Boolean(managedAiConfig)"
                placeholder="https://api.openai.com/v1"
                @change="onAiBaseUrlChange(($event.target as HTMLInputElement).value)"
              />
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span style="font-size: 12px; min-width: 60px; color: var(--b3-theme-on-surface);">API Key:</span>
              <input
                :value="managedAiConfig ? managedAiConfig.apiKey : globalSettings.aiConfig.apiKey"
                type="password"
                class="spm-input"
                :disabled="Boolean(managedAiConfig)"
                placeholder="sk-..."
                @change="onAiApiKeyChange(($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import TransitionSelector from '@/ui/components/TransitionSelector.vue'
import {
  globalSettingsState,
  managedAiConfigState,
  normalizeAiConfig,
  setRuntimeSettings,
} from '@/settings'
import { isFeatureEnabled } from '@/feature-flags/feature-flags'

const plugin = inject<any>('plugin')
const globalSettings = globalSettingsState
const managedAiConfig = managedAiConfigState
const isAdvancedExpanded = ref(false)

function openSettingsDialog() {
  emit('openSetting')
  if (plugin && typeof plugin.openSetting === 'function') {
    plugin.openSetting()
  } else if (plugin && plugin.setting && typeof plugin.setting.open === 'function') {
    plugin.setting.open(plugin.name || 'siyuan-live-slides')
  }
}

async function onAiModelChange(val: string) {
  const current = globalSettings.aiConfig
  const updated = normalizeAiConfig({ ...current, model: val })
  setRuntimeSettings({ aiConfig: updated })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    await plugin.saveGlobalSettings({ aiConfig: updated })
  }
  reportLocalAiConfig(updated)
}

async function onAiBaseUrlChange(val: string) {
  const current = globalSettings.aiConfig
  const updated = normalizeAiConfig({ ...current, baseUrl: val })
  setRuntimeSettings({ aiConfig: updated })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    await plugin.saveGlobalSettings({ aiConfig: updated })
  }
  reportLocalAiConfig(updated)
}

async function onAiApiKeyChange(val: string) {
  const current = globalSettings.aiConfig
  const updated = normalizeAiConfig({ ...current, apiKey: val })
  setRuntimeSettings({ aiConfig: updated })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    await plugin.saveGlobalSettings({ aiConfig: updated })
  }
  reportLocalAiConfig(updated)
}

function reportLocalAiConfig(cfg: any) {
  if (typeof window !== 'undefined' && window.siyuanApiSwitch && plugin?.name) {
    window.siyuanApiSwitch.updateLocalConfig(plugin.name, {
      provider: 'custom',
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      requestTimeoutSeconds: cfg.requestTimeoutSeconds,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
    })
  }
}

const themeOptions = [
  {
    value: 'apple-basic',
    label: '极简 apple',
    desc: '苹果发布会极简风：大字号、高对比度与极致留白，适合产品发布、方案演讲与纯粹视觉呈现',
  },
  {
    value: 'tech',
    label: '科技 tech',
    desc: '科技风：现代无衬线排版、Emerald 绿青双色指示与清新代码语法高亮，通用汇报与技术分享首选',
  },
  {
    value: 'seriph',
    label: '优雅 seriph',
    desc: '典雅学术衬线风：书卷学术质感、衬线字体典雅庄重，适合学术论文、人文讲座与深度阅读',
  },
]

function onToggleWebServe(enabled: boolean) {
  setRuntimeSettings({ enableWebServeJump: enabled })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    plugin.saveGlobalSettings({ enableWebServeJump: enabled })
  }
}

async function onToggleNormalizeHeadings(enabled: boolean) {
  setRuntimeSettings({ normalizeHeadingSizes: enabled })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    await plugin.saveGlobalSettings({ normalizeHeadingSizes: enabled })
  }
  if (plugin && typeof plugin.compileCurrentDocument === 'function') {
    plugin.compileCurrentDocument(plugin.currentDocId || plugin.getActiveDocumentId?.())
  }
}

async function onToggleUnorderedMarkers(enabled: boolean) {
  setRuntimeSettings({ showUnorderedListMarkers: enabled })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    await plugin.saveGlobalSettings({ showUnorderedListMarkers: enabled })
  }
  if (plugin && typeof plugin.compileCurrentDocument === 'function') {
    plugin.compileCurrentDocument(plugin.currentDocId || plugin.getActiveDocumentId?.())
  }
}

async function onToggleOrderedMarkers(enabled: boolean) {
  setRuntimeSettings({ showOrderedListMarkers: enabled })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    await plugin.saveGlobalSettings({ showOrderedListMarkers: enabled })
  }
  if (plugin && typeof plugin.compileCurrentDocument === 'function') {
    plugin.compileCurrentDocument(plugin.currentDocId || plugin.getActiveDocumentId?.())
  }
}

function onWebServeUrlInput(val: string) {
  setRuntimeSettings({ webServeUrl: val })
}

function onWebServeUrlChange(val: string) {
  setRuntimeSettings({ webServeUrl: val })
  if (plugin && typeof plugin.saveGlobalSettings === 'function') {
    plugin.saveGlobalSettings({ webServeUrl: val })
  }
}

const presetBackgrounds = [
  {
    label: '默认',
    value: '',
    mode: 'auto',
    desc: '跟随当前幻灯片主题与明暗模式自适应底色',
  },
  {
    label: '极简白',
    value: '#ffffff',
    mode: 'light',
    desc: '纯净高对比白底 (#ffffff)，自动切换深色文字',
  },
  {
    label: '暖羊皮',
    value: '#f5efe6',
    mode: 'light',
    desc: '温润护眼米棕纸张底 (#f5efe6)，自动切换深色文字',
  },
  {
    label: '晴空薄荷',
    value: 'linear-gradient(135deg, #e0f2fe 0%, #dcfce7 100%)',
    mode: 'light',
    desc: '清透天蓝至薄荷微渐变，自动切换深色文字',
  },
  {
    label: '晨曦微光',
    value: 'linear-gradient(135deg, #fef3c7 0%, #fce7f3 100%)',
    mode: 'light',
    desc: '柔和暖金至淡樱微渐变，自动切换深色文字',
  },
  {
    label: '曜石炭黑',
    value: '#18181b',
    mode: 'dark',
    desc: '中性深炭黑 (#18181b)，区别于默认深海蓝底',
  },
  {
    label: '松墨深绿',
    value: '#0d2621',
    mode: 'dark',
    desc: '沉稳森林墨绿 (#0d2621)，自动切换浅色文字',
  },
  {
    label: '极光紫青',
    value: 'linear-gradient(135deg, #1e1b4b 0%, #0f3d4c 100%)',
    mode: 'dark',
    desc: '深邃靛紫至极光青渐变，自动切换浅色文字',
  },
  {
    label: '深空靛蓝',
    value: 'linear-gradient(135deg, #172554 0%, #312e81 100%)',
    mode: 'dark',
    desc: '科技深空蓝至暮色紫渐变，自动切换浅色文字',
  },
] as const

function getBgPreviewStyle(bgValue: string): Record<string, string> {
  const bg = (bgValue || '').trim()
  if (!bg) {
    return {
      background: 'linear-gradient(135deg, #f8fafc 50%, #090d16 50%)',
    }
  }
  if (/^(?:https?:\/\/|\/|data:|assets\/|\.\/assets\/)/i.test(bg)) {
    const normalized = bg.startsWith('assets/')
      ? `/${bg}`
      : bg.startsWith('./assets/')
        ? bg.slice(1)
        : bg
    return {
      backgroundImage: `url("${normalized}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return { background: bg }
}

defineProps<{
  docTheme: string
  docBackground?: string
  docAspectRatio: string
  docDefaultTransition: string
  docSpacing?: string
  isBatchProcessing?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:docTheme', val: string): void
  (e: 'update:docBackground', val: string): void
  (e: 'update:docAspectRatio', val: string): void
  (e: 'update:docDefaultTransition', val: string): void
  (e: 'update:docSpacing', val: string): void
  (e: 'openBottomPreview'): void
  (e: 'openPresenter'): void
  (e: 'addOrIdentifyNotes'): void
  (e: 'clearNotes'): void
  (e: 'autoAnimate'): void
  (e: 'clearAnimations'): void
  (e: 'aiAutoSplit'): void
  (e: 'clearDividers'): void
  (e: 'exportHtml'): void
  (e: 'exportPdf'): void
  (e: 'openSetting'): void
}>()
</script>
