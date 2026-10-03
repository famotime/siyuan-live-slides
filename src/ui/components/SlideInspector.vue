<template>
  <div class="spm-slide-inspector">
    <div class="spm-inspector-header">
      <span>幻灯片大纲 ({{ slides.length }} 页)</span>
    </div>

    <div class="spm-inspector-list">
      <div
        v-for="slide in slides"
        :key="slide.pageIndex"
        class="spm-card"
        :class="{ active: currentActivePage === slide.pageIndex }"
        @click="selectSlide(slide.pageIndex)"
      >
        <div class="spm-card-top">
          <span class="spm-card-badge">P{{ slide.pageIndex }}</span>
          <span class="spm-card-layout">{{ slide.frontmatter.layout || 'default' }}</span>
        </div>
        <div class="spm-card-preview">
          {{ getSlideSummary(slide) }}
        </div>
        <div v-if="slide.notes" class="spm-card-notes" title="演讲备忘录">
          📝 {{ slide.notes }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import type { ISlidevVirtualPage } from '@/types/slidev-protocol'

const props = defineProps<{
  slides: ISlidevVirtualPage[]
  currentActivePage?: number
}>()

const emit = defineEmits<{
  (e: 'navigate', pageIndex: number): void
}>()

function selectSlide(pageIndex: number) {
  emit('navigate', pageIndex)
}

function getSlideSummary(slide: ISlidevVirtualPage): string {
  if (!slide.blocks || slide.blocks.length === 0) return '(空白页)'
  const firstBlock = slide.blocks[0]
  const text = firstBlock.content || firstBlock.rawMarkdown || ''
  return text.slice(0, 40) + (text.length > 40 ? '...' : '')
}
</script>

<style scoped>
.spm-slide-inspector {
  padding: 8px;
  background: var(--b3-theme-surface, #f8fafc);
  border-top: 1px solid var(--b3-border-color, #e2e8f0);
  max-height: 220px;
  overflow-y: auto;
}

.spm-inspector-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #64748b);
  margin-bottom: 6px;
}

.spm-inspector-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.spm-card {
  flex: 0 0 110px;
  background: var(--b3-theme-background, #ffffff);
  border: 1px solid var(--b3-border-color, #e2e8f0);
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
}

.spm-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.spm-card.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
  box-shadow: 0 0 0 1px #3b82f6;
}

.spm-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.spm-card-badge {
  font-size: 10px;
  font-weight: 700;
  color: #3b82f6;
}

.spm-card-layout {
  font-size: 9px;
  color: #64748b;
  text-transform: uppercase;
}

.spm-card-preview {
  font-size: 11px;
  line-height: 1.3;
  color: var(--b3-theme-on-background, #334155);
  height: 30px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.spm-card-notes {
  margin-top: 4px;
  font-size: 9px;
  color: #059669;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
