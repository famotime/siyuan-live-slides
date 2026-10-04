<template>
  <div class="spm-section spm-section--block">
    <!-- 分区大标题 -->
    <div class="spm-section-header">
      <span>元素动效与排版</span>
    </div>

    <!-- 1. 逐步出现 (v-click) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="step" />
            <span>逐步呈现 (v-click)</span>
          </div>
          <span class="spm-control-desc">放映时按步长逐个呈现</span>
        </div>
        <!-- 现代化微型开关 -->
        <label class="spm-switch b3-tooltips b3-tooltips__w" :aria-label="elemClick ? '关闭逐步呈现' : '开启逐步呈现 (+1)'">
          <input
            type="checkbox"
            :checked="Boolean(elemClick)"
            @change="$emit('toggleElemClick')"
          />
          <span class="spm-switch-slider"></span>
        </label>
      </div>

      <!-- 步长细化选择器 -->
      <div v-if="elemClick" class="spm-quick-chips">
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

    <!-- 2. 多栏布局插槽 (Slot) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="columns" />
            <span>双栏插槽归属 (Slot)</span>
          </div>
          <span class="spm-control-desc">在 two-cols 等分栏布局中的归属</span>
        </div>
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

    <!-- 3. 代码逐行聚光高亮 (仅代码块激活时可见) -->
    <div v-if="isCodeBlock" class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div class="spm-control-title">
            <SlidevIcon name="code" />
            <span>代码逐行聚光 (Shiki)</span>
          </div>
          <span class="spm-control-desc">翻页时动态聚光高亮特定行</span>
        </div>
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
        class="spm-input"
        placeholder="自定义高亮区间，如 1-3|5|all"
        @input="$emit('update:elemShikiLines', ($event.target as HTMLInputElement).value)"
        @change="$emit('update:elemShikiLines', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 4. 紧凑快捷操作 2x2 网格 -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <span class="spm-control-title">快捷操作</span>
        </div>
      </div>
      <div class="spm-action-grid">
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="在当前块上方插入幻灯片分页线 (---)"
          @click="$emit('insertDividerBefore')"
        >
          <SlidevIcon name="insert-above" />
          <span>上方分页</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="在当前块下方插入幻灯片分页线 (---)"
          @click="$emit('insertDividerAfter')"
        >
          <SlidevIcon name="insert-below" />
          <span>下方分页</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          aria-label="将当前块属性设为双栏左侧归属 (slot: left)"
          @click="$emit('setTwoColsContrast')"
        >
          <SlidevIcon name="columns" />
          <span>设为双栏</span>
        </button>

        <button
          v-if="hasBlockAttrs"
          class="spm-btn-action spm-btn-danger b3-tooltips b3-tooltips__s"
          aria-label="一键移除本块所有 custom-slidev 属性"
          @click="$emit('clearBlockAttrs')"
        >
          <SlidevIcon name="broom" />
          <span>清除属性</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SlidevIcon from '@/ui/components/SlidevIcon.vue'

defineProps<{
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
