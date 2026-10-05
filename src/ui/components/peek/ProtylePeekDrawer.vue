<template>
  <div class="spm-protyle-drawer">
    <!-- 顶部状态与操作条 -->
    <div class="spm-protyle-drawer__subbar">
      <div class="spm-protyle-drawer__nav">
        <!-- 历史回退按钮 -->
        <button
          v-if="historyStack.length > 0"
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="返回上层引用文档或块"
          @click="goBack"
        >
          <SlidevIcon name="arrow-left" />
          <span>返回</span>
        </button>

        <span
          class="spm-protyle-badge"
          :class="{ 'is-focus': isFocusMode && !isDoc }"
        >
          {{ isFocusMode && !isDoc ? '思源块聚焦' : '思源文档速览' }}
        </span>
        <span class="spm-protyle-id" :title="currentTitle || currentBlockId">
          {{ currentTitle || currentBlockId }}
        </span>
      </div>

      <div class="spm-protyle-drawer__actions">
        <!-- 块链接专属：聚焦显示当前块 / 查看所属文档上下文全文切换 -->
        <button
          v-if="!isDoc"
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :class="{ 'is-primary': isFocusMode }"
          :aria-label="isFocusMode ? '当前为块聚焦模式（点击展开所属文档全文）' : '当前为文档全文模式（点击切回仅聚焦当前块）'"
          @click="toggleFocusMode"
        >
          <SlidevIcon :name="isFocusMode ? 'focus' : 'file-text'" />
          <span>{{ isFocusMode ? '块聚焦' : '展开全文' }}</span>
        </button>

        <!-- 只读 / 即时编辑切换 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          :class="{ 'is-primary': isEditable }"
          :aria-label="isEditable ? '当前为即时编辑模式（点击切回只读）' : '当前为只读速览模式（点击解锁即时编辑）'"
          @click="toggleEditable"
        >
          <SlidevIcon :name="isEditable ? 'edit' : 'eye'" />
          <span>{{ isEditable ? '编辑中' : '只读' }}</span>
        </button>

        <!-- 置顶独立窗口打开 -->
        <button
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="在置顶独立窗口中打开 (保留完整侧边栏与插件)"
          @click="openInStandaloneWindow"
        >
          <SlidevIcon name="window" />
          <span>独立窗口</span>
        </button>

        <!-- 外跳至外部浏览器 (本地网络伺服开启时) -->
        <button
          v-if="globalSettings.enableWebServeJump"
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="在系统默认浏览器中打开 (外跳)"
          @click="openInSystemBrowser"
        >
          <SlidevIcon name="external-link" />
          <span>外跳</span>
        </button>
      </div>
    </div>

    <!-- Protyle 原生编辑器挂载宿主 -->
    <div
      ref="mountEl"
      class="spm-protyle-mount"
      :class="{ 'is-focus-mode': isFocusMode && !isDoc }"
      @click="handleProtyleClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { Plugin } from 'siyuan'
import { Protyle, openWindow } from 'siyuan'
import { sql } from '@/api'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'
import { globalSettingsState, buildSiYuanWebUrl, getRuntimeSettings } from '@/settings'
import { getRuntimeModule } from '@/engine/runtime-node'

const emit = defineEmits<{
  (e: 'external-jump', url: string): void
}>()

const props = defineProps<{
  blockId: string
  title?: string
  plugin: Plugin
}>()

const currentBlockId = ref(props.blockId)
const currentTitle = ref(props.title || '')
const isEditable = ref(false)
const isFocusMode = ref(true)
const isDoc = ref(false)
const rootDocId = ref('')
const globalSettings = globalSettingsState

const historyStack = ref<Array<{
  blockId: string
  title: string
  isFocusMode: boolean
  isDoc: boolean
}>>([])

const mountEl = ref<HTMLElement | null>(null)
let protyleInstance: any = null

watch(
  () => props.blockId,
  (newId) => {
    if (newId && newId !== currentBlockId.value) {
      currentBlockId.value = newId
      currentTitle.value = props.title || ''
      historyStack.value = []
      loadProtyle(newId)
    }
  }
)

onMounted(() => {
  if (currentBlockId.value) {
    loadProtyle(currentBlockId.value)
  }
})

onBeforeUnmount(() => {
  destroyProtyle()
})

async function detectBlockType(id: string) {
  try {
    const rows = await sql(`SELECT id, root_id, type, content FROM blocks WHERE id = '${id}' LIMIT 1`)
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0]
      rootDocId.value = row.root_id || ''
      const isDocument = row.id === row.root_id || row.type === 'd'
      isDoc.value = isDocument
      // 如果目标是文档，则为文档模式；如果是块，默认开启块聚焦模式！
      isFocusMode.value = !isDocument
      if (!currentTitle.value && row.content) {
        currentTitle.value = row.content.trim().slice(0, 30)
      }
      return
    }
  } catch (e) {
    console.warn('[ProtylePeekDrawer] detectBlockType query failed:', e)
  }
  // 兜底策略：如果无法识别或单测未挂载真实数据库，默认按块聚焦处理
  isDoc.value = false
  isFocusMode.value = true
}

async function loadProtyle(id: string, forceFocus?: boolean) {
  if (!mountEl.value || !id) return
  destroyProtyle()

  await detectBlockType(id)

  if (typeof forceFocus === 'boolean') {
    isFocusMode.value = !isDoc.value && forceFocus
  }

  // 区分“块聚焦”与“文档全文”模式
  let action: string[]
  let renderOpts: any

  if (isFocusMode.value && !isDoc.value) {
    // 🎯 块链接：聚焦模式，只加载当前块内容，不含上下文全文，不渲染文档大标题与封面背景
    action = ['cb-get-all', 'cb-get-hl', 'cb-get-focus']
    renderOpts = {
      background: false,
      title: false,
      gutter: true,
      breadcrumbDocName: true,
      scroll: true,
    }
  } else {
    // 📄 文档链接或展开全文模式：加载整篇文档上下文与大标题
    action = ['cb-get-context', 'cb-get-hl']
    renderOpts = {
      background: true,
      title: true,
      gutter: true,
      breadcrumbDocName: true,
      scroll: true,
    }
  }

  try {
    protyleInstance = new Protyle(props.plugin.app, mountEl.value, {
      blockId: id,
      action,
      render: renderOpts,
    })

    // 默认以只读模式载入，防止演讲现场误触
    if (!isEditable.value && protyleInstance && typeof protyleInstance.disable === 'function') {
      protyleInstance.disable()
    }
  } catch (e) {
    console.error('[ProtylePeekDrawer] Failed to instantiate Protyle:', e)
  }
}

function destroyProtyle() {
  if (protyleInstance) {
    try {
      if (typeof protyleInstance.destroy === 'function') {
        protyleInstance.destroy()
      }
    } catch (e) {
      console.warn('[ProtylePeekDrawer] Error destroying protyle:', e)
    }
    protyleInstance = null
  }
  if (mountEl.value) {
    mountEl.value.innerHTML = ''
  }
}

function toggleFocusMode() {
  if (isDoc.value) return
  isFocusMode.value = !isFocusMode.value
  loadProtyle(currentBlockId.value, isFocusMode.value)
}

function toggleEditable() {
  isEditable.value = !isEditable.value
  if (!protyleInstance) return

  if (isEditable.value) {
    if (typeof protyleInstance.enable === 'function') {
      protyleInstance.enable()
    }
    if (typeof protyleInstance.focus === 'function') {
      protyleInstance.focus()
    }
  } else {
    if (typeof protyleInstance.disable === 'function') {
      protyleInstance.disable()
    }
  }
}

function openInStandaloneWindow() {
  if (!currentBlockId.value) return
  try {
    openWindow({
      doc: { id: currentBlockId.value },
      alwaysOnTop: true,
    })
  } catch (e) {
    console.warn('[ProtylePeekDrawer] openWindow failed:', e)
  }
}

function openInSystemBrowser() {
  if (!currentBlockId.value) return
  const settings = getRuntimeSettings()
  const targetUrl = buildSiYuanWebUrl(settings.webServeUrl, currentBlockId.value, {
    focus: !isDoc.value,
  })
  if (typeof window !== 'undefined') {
    const electron = getRuntimeModule('electron')
    if (electron?.shell?.openExternal) {
      electron.shell.openExternal(targetUrl).catch(() => {
        window.open(targetUrl, '_blank')
      })
    } else {
      window.open(targetUrl, '_blank')
    }
  }
  emit('external-jump', targetUrl)
}

function goBack() {
  if (historyStack.value.length > 0) {
    const prev = historyStack.value.pop()
    if (prev) {
      currentBlockId.value = prev.blockId
      currentTitle.value = prev.title
      isFocusMode.value = prev.isFocusMode
      isDoc.value = prev.isDoc
      loadProtyle(prev.blockId, prev.isFocusMode)
    }
  }
}

function handleProtyleClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target) return

  // 捕获块引用点击
  const refEl = target.closest('[data-type="block-ref"]') as HTMLElement | null
  if (refEl) {
    const nextId = refEl.getAttribute('data-id')
    if (nextId && nextId !== currentBlockId.value) {
      e.preventDefault()
      e.stopPropagation()
      historyStack.value.push({
        blockId: currentBlockId.value,
        title: currentTitle.value || currentBlockId.value,
        isFocusMode: isFocusMode.value,
        isDoc: isDoc.value,
      })
      currentBlockId.value = nextId
      currentTitle.value = refEl.innerText.trim() || nextId
      loadProtyle(nextId)
      return
    }
  }

  // 捕获 a 链接点击形式的 siyuan://blocks/
  const linkEl = target.closest('a') as HTMLAnchorElement | null
  if (linkEl && linkEl.href && linkEl.href.startsWith('siyuan://blocks/')) {
    e.preventDefault()
    e.stopPropagation()
    const nextId = linkEl.href.replace('siyuan://blocks/', '').split('?')[0]
    if (nextId && nextId !== currentBlockId.value) {
      historyStack.value.push({
        blockId: currentBlockId.value,
        title: currentTitle.value || currentBlockId.value,
        isFocusMode: isFocusMode.value,
        isDoc: isDoc.value,
      })
      currentBlockId.value = nextId
      currentTitle.value = linkEl.innerText.trim() || nextId
      loadProtyle(nextId)
    }
  }
}
</script>

<style lang="scss" scoped>
.spm-protyle-drawer {
  width: 100%;
  height: 100%;
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--b3-theme-background, #ffffff);
}

.spm-protyle-drawer__subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--b3-theme-surface, #f8fafc);
  border-bottom: 1px solid var(--b3-border-color, #e2e8f0);
  flex-shrink: 0;
  gap: 8px;
}

.spm-protyle-drawer__nav {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.spm-protyle-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: var(--b3-theme-primary-light, rgba(59, 130, 246, 0.1));
  color: var(--b3-theme-primary, #3b82f6);
  flex-shrink: 0;
  transition: all 0.2s ease;

  &.is-focus {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
}

.spm-protyle-id {
  font-size: 12px;
  color: var(--b3-theme-on-surface, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spm-protyle-drawer__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.spm-protyle-mount {
  flex: 1;
  width: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;

  :deep(.protyle) {
    height: 100%;
    width: 100%;
  }

  :deep(.protyle-content) {
    padding: 16px 24px;
  }

  &.is-focus-mode {
    :deep(.protyle-content) {
      padding: 20px 24px;
    }
  }
}
</style>
