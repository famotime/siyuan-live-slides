<template>
  <div class="spm-section spm-section--block">
    <div class="spm-section-header">
      <span>元素动效与排版</span>
      <span class="spm-section-sub">{{ blockContentSnippet || '已聚焦块' }}</span>
    </div>

    <!-- 逐步出现 (v-click) -->
    <div class="spm-card-control">
      <div class="spm-control-row">
        <div class="spm-control-title">
          <span>✨ 逐步出现 (v-click)</span>
          <span class="spm-control-desc">翻页时按步长逐个呈现</span>
        </div>
        <button
          class="spm-toggle-btn"
          :class="{ active: Boolean(elemClick) }"
          @click="$emit('toggleElemClick')"
        >
          {{ elemClick ? '已开启' : '关闭' }}
        </button>
      </div>

      <div v-if="elemClick" class="spm-quick-chips spm-mt-2">
        <button
          v-for="step in ['+1', '1', '2', 'hide']"
          :key="step"
          class="spm-chip"
          :class="{ active: elemClick === step }"
          @click="$emit('update:elemClick', step)"
        >
          {{ step === '+1' ? '顺延 (+1)' : step === 'hide' ? '隐藏 (hide)' : '第 ' + step + ' 步' }}
        </button>
      </div>
    </div>

    <!-- 多栏布局插槽 (Slot) -->
    <div class="spm-card-control">
      <div class="spm-control-title">
        <span>▥ 双栏插槽 (Slot)</span>
        <span class="spm-control-desc">在 two-cols 等分栏布局中的归属</span>
      </div>
      <div class="spm-segmented-group">
        <button
          class="spm-segmented-item"
          :class="{ active: !elemSlot || elemSlot === 'default' }"
          @click="$emit('update:elemSlot', '')"
        >
          默认
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: elemSlot === 'left' }"
          @click="$emit('update:elemSlot', 'left')"
        >
          左栏 (left)
        </button>
        <button
          class="spm-segmented-item"
          :class="{ active: elemSlot === 'right' }"
          @click="$emit('update:elemSlot', 'right')"
        >
          右栏 (right)
        </button>
      </div>
    </div>

    <!-- 代码逐行聚光高亮 (仅代码块) -->
    <div v-if="isCodeBlock" class="spm-card-control">
      <div class="spm-control-title">
        <span>🔍 代码逐行聚光 (Shiki)</span>
        <span class="spm-control-desc">翻页时动态聚光高亮特定行</span>
      </div>
      <div class="spm-quick-chips">
        <button
          v-for="shiki in ['1-3', 'all', '1|2|3', '2-5']"
          :key="shiki"
          class="spm-chip"
          :class="{ active: elemShikiLines === shiki }"
          @click="$emit('update:elemShikiLines', shiki)"
        >
          {{ shiki }}
        </button>
        <button
          v-if="elemShikiLines"
          class="spm-chip spm-chip-clear"
          @click="$emit('update:elemShikiLines', '')"
        >
          清空
        </button>
      </div>
      <input
        :value="elemShikiLines"
        class="spm-input spm-mt-2"
        placeholder="自定义高亮区间，如 1-3|5|all"
        @input="$emit('update:elemShikiLines', ($event.target as HTMLInputElement).value)"
        @change="$emit('update:elemShikiLines', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 内容块快捷操作 -->
    <div class="spm-action-group">
      <div class="spm-action-group-title">块快捷操作</div>
      <div class="spm-action-buttons">
        <button class="spm-btn-action" @click="$emit('insertDividerBefore')">
          ➕ 在上方插入分页符 (---)
        </button>
        <button class="spm-btn-action" @click="$emit('insertDividerAfter')">
          ➕ 在下方插入分页符 (---)
        </button>
        <button class="spm-btn-action" @click="$emit('setTwoColsContrast')">
          ▥ 设为双栏对比
        </button>
        <button
          v-if="hasBlockAttrs"
          class="spm-btn-action spm-btn-warn"
          @click="$emit('clearBlockAttrs')"
        >
          🧹 清除本块演示属性
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  blockContentSnippet?: string
  elemClick: string
  elemSlot: string
  elemShikiLines: string
  isCodeBlock: boolean
  hasBlockAttrs: boolean
}>()

defineEmits<{
  (e: 'toggleElemClick'): void
  (e: 'update:elemClick', val: string): void
  (e: 'update:elemSlot', val: string): void
  (e: 'update:elemShikiLines', val: string): void
  (e: 'insertDividerBefore'): void
  (e: 'insertDividerAfter'): void
  (e: 'setTwoColsContrast'): void
  (e: 'clearBlockAttrs'): void
}>()
</script>
