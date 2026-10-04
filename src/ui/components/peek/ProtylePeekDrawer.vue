<template>
  <div class="spm-protyle-drawer">
    <!-- 顶部状态与操作条 -->
    <div class="spm-protyle-drawer__subbar">
      <div class="spm-protyle-drawer__nav">
        <!-- 历史回退按钮 -->
        <button
          v-if="historyStack.length > 0"
          class="spm-icon-btn b3-tooltips b3-tooltips__s"
          aria-label="返回上层引用文档"
          @click="goBack"
        >
          <SlidevIcon name="arrow-left" />
          <span>返回</span>
        </button>

        <span class="spm-protyle-badge">思源文档速览</span>
        <span class="spm-protyle-id">{{ currentTitle || currentBlockId }}</span>
      </div>

      <div class="spm-protyle-drawer__actions">
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
      </div>
    </div>

    <!-- Protyle 原生编辑器挂载宿主 -->
    <div
      ref="mountEl"
      class="spm-protyle-mount"
      @click="handleProtyleClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { Plugin } from 'siyuan'
import { Protyle, openWindow } from 'siyuan'
import SlidevIcon from '@/ui/components/SlidevIcon.vue'

const props = defineProps<{
  blockId: string
  title?: string
  plugin: Plugin
}>()

const currentBlockId = ref(props.blockId)
const currentTitle = ref(props.title || '')
const isEditable = ref(false)
const historyStack = ref<Array<{ blockId: string; title: string }>>([])

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

function loadProtyle(id: string) {
  if (!mountEl.value || !id) return
  destroyProtyle()

  try {
    protyleInstance = new Protyle(props.plugin.app, mountEl.value, {
      blockId: id,
      action: ['cb-get-hl', 'cb-get-context'],
      render: {
        background: true,
        title: true,
        gutter: true,
        breadcrumbDocName: true,
      },
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

function goBack() {
  if (historyStack.value.length > 0) {
    const prev = historyStack.value.pop()
    if (prev) {
      currentBlockId.value = prev.blockId
      currentTitle.value = prev.title
      loadProtyle(prev.blockId)
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
}
</style>
