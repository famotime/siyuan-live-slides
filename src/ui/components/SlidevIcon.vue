<template>
  <svg
    class="slidev-icon"
    style="fill: none !important"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 分屏预览 -->
    <g v-if="name === 'split-preview'">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18" />
    </g>

    <!-- 导入演示 -->
    <g v-else-if="name === 'import'">
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <polyline points="7 9 12 14 17 9" />
      <line x1="12" y1="14" x2="12" y2="3" />
    </g>

    <!-- 双屏演讲者视图 -->
    <g v-else-if="name === 'presenter'">
      <path d="M2 3h20" />
      <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
      <path d="m7 21 5-5 5 5" />
    </g>

    <!-- 逐步出现 (v-click / 闪烁) -->
    <g v-else-if="name === 'step'">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </g>

    <!-- 双栏 / 分栏布局 (Slot / Columns) -->
    <g v-else-if="name === 'columns'">
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="18" rx="1" />
    </g>

    <!-- 代码逐行聚光 (Shiki / Code) -->
    <g v-else-if="name === 'code'">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </g>

    <!-- 在上方插入分页符 -->
    <g v-else-if="name === 'insert-above'">
      <line x1="12" y1="5" x2="12" y2="13" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <path d="M4 19h16" stroke-dasharray="2 2" />
    </g>

    <!-- 在下方插入分页符 -->
    <g v-else-if="name === 'insert-below'">
      <path d="M4 5h16" stroke-dasharray="2 2" />
      <line x1="12" y1="11" x2="12" y2="19" />
      <line x1="8" y1="15" x2="16" y2="15" />
    </g>

    <!-- 清除演示属性 / 扫帚 -->
    <g v-else-if="name === 'broom'">
      <path d="m18 15-6-6" />
      <path d="M4 20h16" />
      <path d="M6 14l8-8a2.8 2.8 0 0 1 4 4l-8 8H6v-4z" />
    </g>

    <!-- 删除 / 垃圾桶 -->
    <g v-else-if="name === 'trash'">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </g>

    <!-- AI 智能灵感 (Sparkles) -->
    <g v-else-if="name === 'ai' || name === 'sparkles'">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
    </g>

    <!-- 主题调色板 -->
    <g v-else-if="name === 'palette'">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.4-.4-.8-.4-1.4 0-1.1.9-2 2-2h2.3c3.9 0 7-3.1 7-7 0-5-4.5-9-10-9z" />
    </g>

    <!-- 画幅比例 -->
    <g v-else-if="name === 'ratio'">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" stroke-dasharray="2 2" />
    </g>

    <!-- 转场动效 -->
    <g v-else-if="name === 'transition'">
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </g>

    <!-- 单文件 HTML 导出 -->
    <g v-else-if="name === 'export-html'">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.4 16.3A5 5 0 0 0 18 7h-1.3A8 8 0 0 0 4 12.8a5 5 0 0 0 1.5 9.2" />
    </g>

    <!-- PDF 导出 / 打印 -->
    <g v-else-if="name === 'export-pdf'">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </g>

    <!-- 图钉锁定 (Pin) -->
    <g v-else-if="name === 'pin'">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-2l-2-2V5l1-1V2H6v2l1 1v8l-2 2v2z" />
    </g>

    <!-- 刷新 -->
    <g v-else-if="name === 'refresh'">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </g>

    <!-- 大纲缩略抽屉 (Outline) -->
    <g v-else-if="name === 'outline'">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </g>

    <!-- 前后箭头 -->
    <g v-else-if="name === 'chevron-left'">
      <polyline points="15 18 9 12 15 6" />
    </g>
    <g v-else-if="name === 'chevron-right'">
      <polyline points="9 18 15 12 9 6" />
    </g>

    <!-- 复制 ID -->
    <g v-else-if="name === 'copy'">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </g>

    <!-- 默认兜底图标 (幻灯片画板) -->
    <g v-else>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </g>
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  name: string
}>()
</script>

<style scoped>
.slidev-icon {
  width: 1em;
  height: 1em;
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
