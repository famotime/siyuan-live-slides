<template>
  <div class="spm-modal-overlay" @click.self="onClose">
    <div class="spm-import-dialog">
      <!-- 弹窗顶栏 -->
      <div class="spm-dialog-header">
        <div class="spm-dialog-title">
          <svg class="spm-dialog-icon" aria-hidden="true">
            <use xlink:href="#iconSlidev"></use>
          </svg>
          <span>导入 Slidev 演示文档</span>
        </div>
        <button class="spm-close-btn" title="关闭" @click="onClose">✕</button>
      </div>

      <!-- 模式切换 Tabs -->
      <div class="spm-tabs-header">
        <button
          class="spm-tab-btn"
          :class="{ active: inputMode === 'file' }"
          @click="inputMode = 'file'"
        >
          📦 文件 / 压缩包导入 (.zip / .md)
        </button>
        <button
          class="spm-tab-btn"
          :class="{ active: inputMode === 'text' }"
          @click="inputMode = 'text'"
        >
          📝 粘贴 Markdown 源码
        </button>
      </div>

      <div class="spm-dialog-body">
        <!-- 模式 1: 文件拖拽与选择 -->
        <div v-if="inputMode === 'file'" class="spm-file-section">
          <div
            class="spm-dropzone"
            :class="{ dragover: isDragging, 'has-file': !!selectedFileName }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onFileDrop"
            @click="triggerFileInput"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept=".zip,.md"
              class="spm-hidden-input"
              @change="onFileSelected"
            />
            <div v-if="!selectedFileName" class="spm-dropzone-prompt">
              <span class="spm-dropzone-icon">📁</span>
              <p class="spm-dropzone-text">点击选择文件，或直接拖拽文件至此处</p>
              <p class="spm-dropzone-hint">
                支持 Slidev 完整工程 <strong>.zip</strong>（自动解包 public/ 静态素材）或单文件 <strong>.md</strong>
              </p>
            </div>
            <div v-else class="spm-dropzone-active">
              <span class="spm-file-badge">📄 {{ selectedFileName }}</span>
              <span class="spm-file-size">({{ formattedFileSize }})</span>
              <button class="spm-btn-text" @click.stop="clearFile">更换文件</button>
            </div>
          </div>
        </div>

        <!-- 模式 2: 源码粘贴输入 -->
        <div v-else class="spm-text-section">
          <textarea
            v-model="rawMarkdownText"
            class="spm-textarea spm-source-editor"
            rows="8"
            placeholder="在此直接粘贴包含 Frontmatter 的 Slidev slides.md 源码..."
            @input="onTextChange"
          ></textarea>
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="spm-error-banner">
          ⚠️ {{ errorMessage }}
        </div>

        <!-- 解析预检摘要卡片 -->
        <div v-if="parsedPresentation" class="spm-preview-card">
          <div class="spm-preview-card__header">
            <span>✨ 演示解析摘要</span>
            <span class="spm-badge-success">预检就绪</span>
          </div>

          <!-- 文档标题与存放笔记本配置 -->
          <div class="spm-config-grid">
            <div class="spm-form-item">
              <label class="spm-form-label">笔记文档标题</label>
              <input
                v-model="customDocTitle"
                class="spm-input"
                placeholder="思源新文档标题"
              />
            </div>

            <div class="spm-form-item">
              <label class="spm-form-label">存放目标笔记本</label>
              <select v-model="selectedNotebookId" class="spm-select">
                <option v-for="nb in notebooks" :key="nb.id" :value="nb.id">
                  {{ nb.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- 统计指标网格 -->
          <div class="spm-stats-grid">
            <div class="spm-stat-box">
              <span class="spm-stat-value">{{ parsedPresentation.totalSlides }}</span>
              <span class="spm-stat-label">幻灯片页数</span>
            </div>
            <div class="spm-stat-box">
              <span class="spm-stat-value">{{ currentTheme }}</span>
              <span class="spm-stat-label">演示主题</span>
            </div>
            <div class="spm-stat-box">
              <span class="spm-stat-value">{{ parsedPresentation.stats.totalNotes }}</span>
              <span class="spm-stat-label">演讲者提词</span>
            </div>
            <div class="spm-stat-box">
              <span class="spm-stat-value">{{ extractedAssetsCount }}</span>
              <span class="spm-stat-label">关联本地素材</span>
            </div>
          </div>

          <!-- 版式分布 -->
          <div v-if="layoutChips.length > 0" class="spm-chips-row">
            <span class="spm-chips-label">页面版式分布：</span>
            <span v-for="c in layoutChips" :key="c.name" class="spm-chip-badge">
              {{ c.name }}: {{ c.count }}
            </span>
          </div>

          <!-- 导入配置选项 -->
          <div class="spm-options-group">
            <label class="spm-checkbox-label">
              <input v-model="optCleanHtml" type="checkbox" @change="reprocessCurrentInput" />
              <span>智能剥离展示型 HTML 容器为干净原生的 Markdown 笔记块</span>
            </label>
            <label class="spm-checkbox-label">
              <input v-model="optStripNotes" type="checkbox" @change="reprocessCurrentInput" />
              <span>提取演讲者提词到块属性并保持正文笔记清爽</span>
            </label>
            <label class="spm-checkbox-label">
              <input v-model="optUploadAssets" type="checkbox" />
              <span>自动上传关联素材至思源资产库并重写路径 (assets/...)</span>
            </label>
            <label class="spm-checkbox-label">
              <input v-model="optAutoPreview" type="checkbox" />
              <span>导入后自动打开新文档并开启下方分屏放映预览</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 弹窗底栏 -->
      <div class="spm-dialog-footer">
        <button class="spm-btn-secondary" :disabled="isImporting" @click="onClose">
          取消
        </button>
        <button
          class="spm-btn-primary"
          :disabled="!parsedPresentation || isImporting"
          @click="onConfirmImport"
        >
          <span v-if="isImporting">⏳ 正在导入生成中...</span>
          <span v-else>🚀 确认导入思源笔记</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, onMounted } from 'vue'
import { useSlidevImport } from './useSlidevImport'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', data: { docId: string }): void
}>()

const plugin = inject<any>('plugin')

const {
  inputMode,
  isDragging,
  isImporting,
  errorMessage,
  fileInputRef,
  selectedFileName,
  rawMarkdownText,
  extractedAssetsCount,
  parsedPresentation,
  customDocTitle,
  notebooks,
  selectedNotebookId,
  optCleanHtml,
  optStripNotes,
  optUploadAssets,
  optAutoPreview,
  formattedFileSize,
  currentTheme,
  layoutChips,
  fetchNotebooks,
  triggerFileInput,
  clearFile,
  onFileSelected,
  onFileDrop,
  onTextChange,
  reprocessCurrentInput,
  handleConfirmImport,
} = useSlidevImport(plugin)

onMounted(async () => {
  await fetchNotebooks()
})

async function onConfirmImport() {
  const docId = await handleConfirmImport()
  if (docId) {
    emit('success', { docId })
    emit('close')
  }
}

function onClose() {
  emit('close')
}
</script>

<style scoped lang="scss">
.spm-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: spmFadeIn 0.2s ease-out;
}

.spm-import-dialog {
  width: 580px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--b3-theme-surface, #ffffff);
  border: 1px solid var(--b3-border-color, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--b3-theme-on-surface, #1f2937);
  font-family: inherit;
}

.spm-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-border-color, #e5e7eb);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.spm-dialog-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.spm-dialog-icon {
  width: 22px;
  height: 22px;
  color: var(--b3-theme-primary, #3b82f6);
}

.spm-close-btn {
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--b3-theme-on-surface-light, #6b7280);
  border-radius: 6px;
  padding: 4px 8px;
  &:hover {
    background: var(--b3-theme-surface-hover, rgba(0, 0, 0, 0.05));
    color: var(--b3-theme-on-surface, #111827);
  }
}

.spm-tabs-header {
  display: flex;
  border-bottom: 1px solid var(--b3-border-color, #e5e7eb);
  background: var(--b3-theme-background, #f9fafb);
}

.spm-tab-btn {
  flex: 1;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface-light, #6b7280);
  transition: all 0.2s;

  &.active {
    color: var(--b3-theme-primary, #3b82f6);
    border-bottom-color: var(--b3-theme-primary, #3b82f6);
    background: var(--b3-theme-surface, #ffffff);
  }
}

.spm-dialog-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.spm-dropzone {
  border: 2px dashed var(--b3-border-color, #d1d5db);
  border-radius: 10px;
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  background: var(--b3-theme-background, #f9fafb);
  transition: all 0.2s;

  &:hover,
  &.dragover {
    border-color: var(--b3-theme-primary, #3b82f6);
    background: var(--b3-theme-primary-lightest, rgba(59, 130, 246, 0.05));
  }

  &.has-file {
    border-style: solid;
    padding: 18px 20px;
  }
}

.spm-hidden-input {
  display: none;
}

.spm-dropzone-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 8px;
}

.spm-dropzone-text {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.spm-dropzone-hint {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light, #6b7280);
}

.spm-dropzone-active {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.spm-file-badge {
  font-weight: 600;
  font-size: 14px;
}

.spm-file-size {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light, #6b7280);
}

.spm-source-editor {
  width: 100%;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
}

.spm-error-banner {
  padding: 10px 14px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: 13px;
}

.spm-preview-card {
  border: 1px solid var(--b3-border-color, #e5e7eb);
  border-radius: 8px;
  padding: 14px;
  background: var(--b3-theme-background, #f9fafb);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spm-preview-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
}

.spm-badge-success {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
}

.spm-config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.spm-form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spm-form-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light, #6b7280);
  font-weight: 500;
}

.spm-input,
.spm-select,
.spm-textarea {
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid var(--b3-border-color, #d1d5db);
  background: var(--b3-theme-surface, #ffffff);
  color: var(--b3-theme-on-surface, #1f2937);
  font-size: 13px;
  box-sizing: border-box;

  &:focus {
    border-color: var(--b3-theme-primary, #3b82f6);
    outline: none;
  }
}

.spm-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.spm-stat-box {
  background: var(--b3-theme-surface, #ffffff);
  border: 1px solid var(--b3-border-color, #e5e7eb);
  border-radius: 6px;
  padding: 8px 6px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spm-stat-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--b3-theme-primary, #3b82f6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spm-stat-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light, #6b7280);
}

.spm-chips-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
}

.spm-chips-label {
  color: var(--b3-theme-on-surface-light, #6b7280);
}

.spm-chip-badge {
  background: var(--b3-theme-surface, #ffffff);
  border: 1px solid var(--b3-border-color, #e5e7eb);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
}

.spm-options-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px dashed var(--b3-border-color, #e5e7eb);
}

.spm-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.spm-dialog-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--b3-border-color, #e5e7eb);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: var(--b3-theme-surface, #ffffff);
}

.spm-btn-primary,
.spm-btn-secondary,
.spm-btn-text {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.spm-btn-primary {
  background: var(--b3-theme-primary, #3b82f6);
  color: #ffffff;
  &:hover:not(:disabled) {
    background: #2563eb;
  }
}

.spm-btn-secondary {
  background: var(--b3-theme-surface, #ffffff);
  border: 1px solid var(--b3-border-color, #d1d5db);
  color: var(--b3-theme-on-surface, #374151);
  &:hover:not(:disabled) {
    background: var(--b3-theme-surface-hover, #f3f4f6);
  }
}

.spm-btn-text {
  background: transparent;
  color: var(--b3-theme-primary, #3b82f6);
  padding: 2px 6px;
  &:hover {
    text-decoration: underline;
  }
}

@keyframes spmFadeIn {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
