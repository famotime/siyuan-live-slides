<template>
  <div class="spm-section spm-section--block">
    <!-- 分区 A：元素排版 -->
    <div v-if="hasLayoutControls" class="spm-section-header">
      <span>元素排版</span>
    </div>

    <!-- A1. 多栏布局插槽 (Slot) - 排版核心项置顶 -->
    <div v-if="isMultiColsLayout || elemSlot" class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            :aria-label="slotControlDesc"
          >
            <SlidesIcon name="columns" />
            <span>{{ slotControlTitle }}</span>
          </div>
        </div>
      </div>
      <div class="spm-segmented-group">
        <button
          v-for="item in availableSlots"
          :key="item.value"
          class="spm-segmented-item"
          :class="{ active: isSlotActive(item.value) }"
          @click="$emit('update:elemSlot', item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <!-- A2. 超级块专属：列宽比例与布局一键同步 -->
    <div v-if="isSuperBlock || detectedSbInfo?.hasSuperBlock" class="spm-card-control" style="border-left: 3px solid var(--b3-theme-primary);">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="读取思源超级块列宽并一键同步到幻灯片分栏"
          >
            <SlidesIcon name="ratio" />
            <span>超级块列宽与布局</span>
          </div>
        </div>
      </div>

      <div style="background: var(--b3-theme-surface); border: 1px solid var(--b3-theme-surface-lighter); border-radius: 6px; padding: 10px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <div style="font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 4px;">
            <SlidesIcon name="ratio" />
            <span v-if="detectedSbInfo?.isCustomWidth">已识别自定义列宽比例</span>
            <span v-else>识别到 {{ detectedSbInfo?.colCount || 2 }} 列超级块分栏</span>
          </div>
          <code style="background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.16); color: var(--b3-theme-primary); border: 1px solid rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.3); padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 12px;">
            {{ detectedSbInfo?.ratio || '1:1' }}
          </code>
        </div>
        <div style="font-size: 11px; opacity: 0.75; line-height: 1.4;">
          {{ detectedSbInfo?.isCustomWidth ? '检测到已调节子块宽度，可一键应用为当前页分栏比例。' : '当前超级块子列为思源默认均宽，可在思源中拖动调节或直接应用。' }}
        </div>
      </div>

      <div class="spm-action-grid">
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          aria-label="一键将当前页版式切换为对应双栏/三栏，并写入此列宽比例"
          style="background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.16); color: var(--b3-theme-primary); font-weight: 500; border: 1px solid rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.3);"
          @click="$emit('applySuperBlockLayout', detectedSbInfo)"
        >
          <SlidesIcon name="sparkles" />
          <span>应用版式与比例</span>
        </button>
        <button
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="仅将提取的比值写入当前页的分栏比例属性"
          @click="$emit('applySuperBlockRatio', detectedSbInfo?.ratio || '1:1')"
        >
          <SlidesIcon name="check" />
          <span>应用比例 ({{ detectedSbInfo?.ratio || '1:1' }})</span>
        </button>
      </div>
    </div>


    <!-- A3. 演示图片角色与排版 (Role & Layout) - 仅对图片元素或已打标块显示 -->
    <div v-if="isImage || Boolean(imageRole)" class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="设为幻灯片背景图或图文分栏配图"
          >
            <SlidesIcon name="image" />
            <span>图片角色与分栏</span>
          </div>
        </div>
      </div>
      <div class="spm-quick-chips">
        <button
          class="spm-chip"
          :class="{ active: !imageRole }"
          @click="$emit('update:imageRole', '')"
        >
          普通内容
        </button>
        <button
          class="spm-chip"
          :class="{ active: imageRole === 'background' }"
          @click="$emit('update:imageRole', 'background')"
        >
          <SlidesIcon name="image" />
          <span>背景图</span>
        </button>
        <button
          class="spm-chip"
          :class="{ active: imageRole === 'image-left' }"
          @click="$emit('update:imageRole', 'image-left')"
        >
          <SlidesIcon name="image-left" />
          <span>图左</span>
        </button>
        <button
          class="spm-chip"
          :class="{ active: imageRole === 'image-right' }"
          @click="$emit('update:imageRole', 'image-right')"
        >
          <SlidesIcon name="image-right" />
          <span>图右</span>
        </button>
      </div>
    </div>

    <!-- A4. 视频播放设置 (Video Playback) - 仅对视频元素显示 -->
    <div v-if="isVideo" class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="配置播放器控制条、自动播放与循环"
          >
            <SlidesIcon name="video" />
            <span>视频播放设置</span>
          </div>
        </div>
      </div>
      <div class="spm-video-settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
        <div class="spm-toggle-item" style="display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; background: rgba(125,125,125,0.06); border-radius: 4px;">
          <span style="font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><SlidesIcon name="sliders" /> 控制条</span>
          <label class="spm-switch b3-tooltips b3-tooltips__se" :aria-label="videoControls ? '关闭控制条' : '开启控制条'">
            <input type="checkbox" :checked="Boolean(videoControls)" @change="$emit('toggleVideoControls')" />
            <span class="spm-switch-slider"></span>
          </label>
        </div>
        <div class="spm-toggle-item" style="display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; background: rgba(125,125,125,0.06); border-radius: 4px;">
          <span style="font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><SlidesIcon name="video" /> 自动播放</span>
          <label class="spm-switch b3-tooltips b3-tooltips__sw" :aria-label="videoAutoplay ? '关闭自动播放' : '开启自动播放'">
            <input type="checkbox" :checked="Boolean(videoAutoplay)" @change="$emit('toggleVideoAutoplay')" />
            <span class="spm-switch-slider"></span>
          </label>
        </div>
        <div class="spm-toggle-item" style="display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; background: rgba(125,125,125,0.06); border-radius: 4px;">
          <span style="font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><SlidesIcon name="repeat" /> 循环播放</span>
          <label class="spm-switch b3-tooltips b3-tooltips__se" :aria-label="videoLoop ? '关闭循环播放' : '开启循环播放'">
            <input type="checkbox" :checked="Boolean(videoLoop)" @change="$emit('toggleVideoLoop')" />
            <span class="spm-switch-slider"></span>
          </label>
        </div>
        <div class="spm-toggle-item" style="display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; background: rgba(125,125,125,0.06); border-radius: 4px;">
          <span style="font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><SlidesIcon name="volume-x" /> 静音播放</span>
          <label class="spm-switch b3-tooltips b3-tooltips__sw" :aria-label="videoMuted ? '关闭静音' : '开启静音'">
            <input type="checkbox" :checked="Boolean(videoMuted)" @change="$emit('toggleVideoMuted')" />
            <span class="spm-switch-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- A5. 代码块最大高度限制 (Max Height) -->
    <div v-if="isCodeBlock" class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="超出限高自动竖向滚动，弱提示滚动条"
          >
            <SlidesIcon name="code" />
            <span>代码块限高</span>
          </div>
        </div>
      </div>
      <div class="spm-quick-chips">
        <button
          v-for="h in ['240px', '320px', '400px', '50%']"
          :key="h"
          class="spm-chip"
          :class="{ active: elemMaxHeight === h || (h === '50%' && (elemMaxHeight === '50vh' || elemMaxHeight === '50%')) }"
          @click="$emit('update:elemMaxHeight', h)"
        >
          {{ h }}
        </button>
        <button
          v-if="elemMaxHeight"
          class="spm-chip spm-chip-clear"
          @click="$emit('update:elemMaxHeight', '')"
        >
          自适应
        </button>
      </div>
      <input
        :value="elemMaxHeight"
        class="spm-input"
        placeholder="自适应高度，或输入 350px、50%"
        @input="$emit('update:elemMaxHeight', ($event.target as HTMLInputElement).value)"
        @change="$emit('update:elemMaxHeight', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 分区 B：元素动效 -->
    <div class="spm-section-header" :style="hasLayoutControls ? 'margin-top: 6px;' : ''">
      <span>元素动效</span>
    </div>

    <!-- B1. 逐步出现 (v-click) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="放映时按步长逐个呈现"
          >
            <SlidesIcon name="step" />
            <span>逐步呈现</span>
          </div>
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
          {{ step === '+1' ? '顺延 (+1)' : step === 'hide' ? '隐藏' : '第 ' + step + ' 步' }}
        </button>
      </div>

      <!-- 继承状态指示器：未开启独立开关时，提示跟随整栏出现 -->
      <div
        v-else-if="parentElemClick"
        class="spm-inherit-tip"
        style="margin-top: 6px; padding: 4px 8px; background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.08); border-radius: 4px; font-size: 11px; opacity: 0.85; display: flex; align-items: center; gap: 4px;"
      >
        <SlidesIcon name="check" />
        <span>未单独开启逐步呈现：当前跟随整栏同时出现</span>
      </div>
    </div>

    <!-- 2. 动效与视觉强调 (Motion & Visual Emphasis) -->
    <div class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="为当前块添加平滑位移与渐入动画"
          >
            <SlidesIcon name="motion" />
            <span>动效与视觉强调</span>
          </div>
        </div>
        <label class="spm-switch b3-tooltips b3-tooltips__w" :aria-label="hasAnyMotion ? '关闭动效' : '开启动效'">
          <input
            type="checkbox"
            :checked="hasAnyMotion"
            @change="toggleAllMotion"
          />
          <span class="spm-switch-slider"></span>
        </label>
      </div>

      <template v-if="hasAnyMotion">
        <!-- 1. 动效即时试播舞台 (跨 Tab 统一置顶常驻，固定高度 52px 舞台视口，杜绝跳动) -->
        <div class="spm-motion-stage-card">
          <div class="spm-motion-stage-header">
            <div class="spm-stage-title-wrap">
              <span class="spm-stage-title">即时试播</span>
              <span class="spm-stage-badge">{{ activeMotionSummaryBadge }}</span>
            </div>
            <button
              type="button"
              class="spm-btn-stage-replay b3-tooltips b3-tooltips__s"
              :aria-label="'重新播放' + activeTabTitle"
              @click="replayLiveStage"
            >
              <SlidesIcon name="play" />
              <span>重播</span>
            </button>
          </div>

          <div class="spm-motion-stage-viewport">
            <!-- A. 入场过渡舞台 -->
            <div
              v-if="activeAnimTab === 'entrance'"
              :key="'ent-' + stagePlayKey"
              class="spm-motion-stage-sample"
              :class="['stage-motion-' + currentPreset]"
              :style="entranceStageStyle"
            >
              <div class="spm-sample-header-bar">
                <span class="spm-sample-dot"></span>
                <span class="spm-sample-title-line"></span>
              </div>
              <div class="spm-sample-text-line"></div>
              <div class="spm-sample-text-line short"></div>
            </div>

            <!-- B. 持续强调舞台 (Pulse, Float, Shimmer) -->
            <div
              v-else-if="activeAnimTab === 'emphasis'"
              :key="'emp-' + stagePlayKey"
              class="spm-motion-stage-sample"
              :class="['stage-emphasis-' + (currentAnimType || 'pulse')]"
              :style="emphasisStageStyle"
            >
              <div class="spm-sample-header-bar">
                <span class="spm-sample-dot"></span>
                <span class="spm-sample-title-line"></span>
              </div>
              <div class="spm-sample-text-line"></div>
              <div class="spm-sample-text-line short"></div>
            </div>

            <!-- C. 文本动效舞台 (CountUp, Typewriter) -->
            <div
              v-else-if="activeAnimTab === 'text'"
              :key="'txt-' + stagePlayKey"
              class="spm-stage-text-viewport"
            >
              <!-- 数字滚动 -->
              <div v-if="currentAnimType === 'countup'" class="spm-stage-countup-display">
                <span v-if="countUpProps.prefix" class="spm-countup-prefix">{{ countUpProps.prefix }}</span>
                <span class="spm-countup-num">{{ currentStageCountUpValue }}</span>
                <span v-if="countUpProps.suffix" class="spm-countup-suffix">{{ countUpProps.suffix }}</span>
              </div>
              <!-- 终端打字机 -->
              <div v-else-if="currentAnimType === 'typewriter'" class="spm-stage-typewriter-display">
                <span class="spm-typewriter-code-tag">&gt;&nbsp;</span>
                <span class="spm-typewriter-text">{{ currentStageTypewriterText }}</span>
                <span class="spm-typewriter-cursor">|</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Tab 切换 (入场 / 强调 / 文本) - 受 feature flag 控制 -->
        <div v-if="isAdvAnimEnabled" class="spm-segmented-group" style="margin-bottom: 8px;">
          <button
            class="spm-segmented-item"
            :class="{ active: activeAnimTab === 'entrance' }"
            @click="switchAnimTab('entrance')"
          >
            入场过渡
          </button>
          <button
            v-if="hasEmphasisEffects"
            class="spm-segmented-item"
            :class="{ active: activeAnimTab === 'emphasis' }"
            @click="switchAnimTab('emphasis')"
          >
            持续强调
          </button>
          <button
            v-if="hasTextEffects"
            class="spm-segmented-item"
            :class="{ active: activeAnimTab === 'text' }"
            @click="switchAnimTab('text')"
          >
            文本动效
          </button>
        </div>

        <!-- 1. 入场过渡 (Entrance) -->
        <div v-if="activeAnimTab === 'entrance'" class="spm-tab-panel-fade">
          <MotionSelector
            :model-value="currentPreset"
            :duration="currentDuration"
            :delay="currentDelay"
            :hide-header="true"
            :hide-stage="true"
            @change="handleMotionChange"
          />
        </div>

        <!-- 2. 持续强调 (Emphasis: Pulse, Float, Shimmer) -->
        <div v-else-if="activeAnimTab === 'emphasis'" class="spm-emphasis-panel spm-tab-panel-fade">
          <!-- 可视化微动效网格 (Visual Motion Grid 3列等宽) -->
          <div class="spm-motion-grid spm-motion-grid--cols-3">
            <div
              v-for="item in EMPHASIS_PRESETS"
              v-show="isEffectEnabled(item.name)"
              :key="item.name"
              class="spm-motion-item b3-tooltips b3-tooltips__s"
              :class="{ active: currentAnimType === item.name }"
              :aria-label="item.label + '：' + item.desc"
              @click="setEmphasisType(item.name)"
            >
              <div class="spm-motion-mini-stage">
                <div class="spm-motion-mini-elem" :class="'mini-anim-emphasis-' + item.name"></div>
              </div>
              <span class="spm-motion-item-label">{{ item.label }}</span>
            </div>
          </div>

          <!-- 持续时长微调 (紧凑 3 选项) -->
          <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 11px; opacity: 0.8;">循环时长</span>
            <div class="spm-quick-chips" style="margin: 0;">
              <button
                v-for="opt in EMPHASIS_DURATION_OPTIONS"
                :key="opt.value"
                class="spm-chip"
                :class="{ active: currentAnimDuration === opt.value }"
                @click="setAnimDuration(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- 3. 文本动效 (Text: CountUp, Typewriter) -->
        <div v-else-if="activeAnimTab === 'text'" class="spm-text-anim-panel spm-tab-panel-fade">
          <!-- 可视化微动效网格 (Visual Motion Grid 2列等宽) -->
          <div class="spm-motion-grid spm-motion-grid--cols-2" style="margin-bottom: 8px;">
            <div
              v-for="item in TEXT_PRESETS"
              v-show="isEffectEnabled(item.name)"
              :key="item.name"
              class="spm-motion-item b3-tooltips b3-tooltips__s"
              :class="{ active: currentAnimType === item.name }"
              :aria-label="item.label + '：' + item.desc"
              @click="setTextAnimType(item.name)"
            >
              <div class="spm-motion-mini-stage">
                <div v-if="item.name === 'countup'" class="mini-text-countup-wrap">
                  <span class="mini-countup-num">99</span>
                </div>
                <div v-else-if="item.name === 'typewriter'" class="mini-text-typewriter-wrap">
                  <span class="mini-typewriter-dots">abc</span>
                  <span class="mini-typewriter-cursor">|</span>
                </div>
              </div>
              <span class="spm-motion-item-label">{{ item.label }}</span>
            </div>
          </div>

          <!-- CountUp 参数配置 -->
          <div v-if="currentAnimType === 'countup'" class="spm-countup-config" style="background: rgba(125,125,125,0.06); padding: 8px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 500;">数字参数设置</span>
              <button
                class="spm-chip b3-tooltips b3-tooltips__sw"
                aria-label="从当前块文本中自动提取数字与前后缀"
                style="font-size: 10px; padding: 2px 6px;"
                @click="autoExtractFromContent"
              >
                从正文提取
              </button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
              <div>
                <span style="opacity: 0.7;">目标数值 (To)</span>
                <input
                  type="number"
                  class="spm-input"
                  style="margin-top: 2px;"
                  :value="countUpProps.to"
                  @input="updateCountUpField('to', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
              <div>
                <span style="opacity: 0.7;">起始数值 (From)</span>
                <input
                  type="number"
                  class="spm-input"
                  style="margin-top: 2px;"
                  :value="countUpProps.from"
                  @input="updateCountUpField('from', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
              <div>
                <span style="opacity: 0.7;">前缀 (Prefix)</span>
                <input
                  class="spm-input"
                  style="margin-top: 2px;"
                  placeholder="如 ¥ 或 $"
                  :value="countUpProps.prefix"
                  @input="updateCountUpField('prefix', ($event.target as HTMLInputElement).value)"
                />
              </div>
              <div>
                <span style="opacity: 0.7;">后缀 (Suffix)</span>
                <input
                  class="spm-input"
                  style="margin-top: 2px;"
                  placeholder="如 % 或 ms"
                  :value="countUpProps.suffix"
                  @input="updateCountUpField('suffix', ($event.target as HTMLInputElement).value)"
                />
              </div>
              <div>
                <span style="opacity: 0.7;">小数位数</span>
                <input
                  type="number"
                  min="0"
                  max="4"
                  class="spm-input"
                  style="margin-top: 2px;"
                  :value="countUpProps.decimals"
                  @input="updateCountUpField('decimals', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
              <div>
                <span style="opacity: 0.7;">持续耗时</span>
                <div class="spm-quick-chips" style="margin-top: 2px;">
                  <button
                    v-for="d in [1000, 1500, 2000]"
                    :key="d"
                    class="spm-chip"
                    :class="{ active: countUpProps.duration === d }"
                    @click="updateCountUpField('duration', d)"
                  >
                    {{ (d / 1000).toFixed(1) }}s
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Typewriter 参数配置 -->
          <div v-else-if="currentAnimType === 'typewriter'" class="spm-typewriter-config" style="background: rgba(125,125,125,0.06); padding: 8px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; opacity: 0.8;">打字总耗时</span>
              <div class="spm-quick-chips" style="margin: 0;">
                <button
                  v-for="d in [1000, 1500, 2500]"
                  :key="d"
                  class="spm-chip"
                  :class="{ active: currentAnimDuration === d }"
                  @click="setAnimDuration(d)"
                >
                  {{ (d / 1000).toFixed(1) }}s
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 3. 代码逐行聚光高亮 (仅代码块激活时可见) -->
    <div v-if="isCodeBlock" class="spm-card-control">
      <div class="spm-control-header">
        <div class="spm-control-title-group">
          <div
            class="spm-control-title b3-tooltips b3-tooltips__se"
            aria-label="翻页时动态聚光高亮特定行"
          >
            <SlidesIcon name="code" />
            <span>代码逐行聚光</span>
          </div>
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
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          aria-label="在当前块上方插入幻灯片分页线 (---)"
          @click="$emit('insertDividerBefore')"
        >
          <SlidesIcon name="insert-above" />
          <span>上方分页</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__sw"
          aria-label="在当前块下方插入幻灯片分页线 (---)"
          @click="$emit('insertDividerAfter')"
        >
          <SlidesIcon name="insert-below" />
          <span>下方分页</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__se"
          :class="{ 'spm-btn-action--active': Boolean(isNote) }"
          :aria-label="isNote ? '取消当前块的演示讲稿备注' : '将当前块设为演示讲稿备注'"
          @click="$emit('toggleNote')"
        >
          <SlidesIcon name="presenter" />
          <span>{{ isNote ? '取消备注' : '设为备注' }}</span>
        </button>

        <button
          class="spm-btn-action spm-btn-danger b3-tooltips b3-tooltips__sw"
          :class="{ 'is-disabled': !hasBlockAttrs }"
          :disabled="!hasBlockAttrs"
          :aria-label="hasBlockAttrs ? '一键移除本块所有 custom-slides 演示属性' : '当前块无演示属性'"
          @click="$emit('clearBlockAttrs')"
        >
          <SlidesIcon name="broom" />
          <span>清除属性</span>
        </button>

        <button
          class="spm-btn-action b3-tooltips b3-tooltips__s"
          style="grid-column: 1 / -1;"
          :class="{ 'is-disabled': !canConvertToSuperBlock }"
          :disabled="!canConvertToSuperBlock"
          :aria-label="canConvertToSuperBlock ? '将当前选中的多个块或列表项合并为横向超级块' : '请在编辑区选中多个块，或选中一个列表/列表项'"
          @click="$emit('convertToSuperBlock')"
        >
          <SlidesIcon name="columns" />
          <span>转为超级块</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import MotionSelector from '@/ui/components/MotionSelector.vue'
import { isAnimationEnabled } from '@/feature-flags/feature-flags'
import {
  MOTION_PRESETS,
  EMPHASIS_PRESETS,
  TEXT_PRESETS,
  EMPHASIS_DURATION_OPTIONS,
} from '@/ui/components/motion-presets'

const props = defineProps<{
  elemClick: string
  elemMotion: string
  elemAnim?: string
  elemAnimProps?: string
  activeBlockContent?: string
  elemSlot: string
  elemShikiLines: string
  elemMaxHeight?: string
  isCodeBlock: boolean
  isImage?: boolean
  isVideo?: boolean
  videoAutoplay?: boolean
  videoLoop?: boolean
  videoMuted?: boolean
  videoControls?: boolean
  hasBlockAttrs: boolean
  isNote?: boolean
  imageRole?: string
  currentSlideLayout?: string
  currentSlideLayoutRatio?: string
  currentSlideHeader?: boolean | string
  isSuperBlock?: boolean
  parentElemClick?: string
  parentContainerSlot?: string
  parentContainerId?: string
  detectedSbInfo?: {
    hasSuperBlock: boolean
    colCount: number
    ratio: string
    isCustomWidth: boolean
    recommendedLayout: string
  } | null
  canConvertToSuperBlock?: boolean
}>()

const effectiveLayout = computed(() => {
  const l = props.currentSlideLayout || ''
  // 智能推断：如果当前块已经分配了 header 或 col-1 ~ col-6 插槽，无论上层传入什么，它必然属于 cols-header
  if (['header', 'col-1', 'col-2', 'col-3', 'col-4', 'col-5', 'col-6'].includes(props.elemSlot)) {
    return 'cols-header'
  }
  return l
})

const isMultiColsLayout = computed(() => {
  const l = effectiveLayout.value
  return ['two-cols', 'cols-header', 'two-cols-header', 'three-cols-header'].includes(l)
})

const hasLayoutControls = computed(() => {
  return isMultiColsLayout.value ||
    Boolean(props.elemSlot) ||
    Boolean(props.isSuperBlock) ||
    Boolean(props.detectedSbInfo?.hasSuperBlock) ||
    Boolean(props.isImage) ||
    Boolean(props.imageRole) ||
    Boolean(props.isVideo) ||
    Boolean(props.isCodeBlock)
})

const detectedColumnsCount = computed(() => {
  // 1. 若当前页显式配置了分栏比例，以比例段数为准 (2~6 栏)
  const ratio = (props.currentSlideLayoutRatio || '').trim()
  if (ratio.includes(':')) {
    const parts = ratio.split(':').filter(Boolean)
    if (parts.length >= 2 && parts.length <= 6) return parts.length
  }
  // 2. 超级块信息
  if (props.detectedSbInfo?.colCount && props.detectedSbInfo.colCount >= 2) {
    return Math.min(props.detectedSbInfo.colCount, 6)
  }
  // 3. 当前块自身插槽
  const match = props.elemSlot?.match(/^col-(\d+)$/)
  if (match) {
    const num = parseInt(match[1], 10)
    if (num >= 2 && num <= 6) return num
  }
  if (props.currentSlideLayout === 'three-cols-header') return 3
  if (props.currentSlideLayout === 'two-cols-header' || props.currentSlideLayout === 'two-cols') return 2
  if (props.detectedSbInfo?.ratio?.includes(':')) {
    const parts = props.detectedSbInfo.ratio.split(':').filter(Boolean)
    if (parts.length >= 2) return Math.min(parts.length, 6)
  }
  return 2 // 默认按 2 栏起步
})

const slotControlTitle = computed(() => {
  return '多栏插槽归属'
})

const slotControlDesc = computed(() => {
  const hasHeader = props.currentSlideHeader !== false && props.currentSlideHeader !== 'false'
  const headerText = hasHeader ? '带通栏标题' : '纯分栏对比'
  return `在多栏版式（${detectedColumnsCount.value} 栏，${headerText}）中的内容块位置，未分配栏位的块将按通栏文本排版`
})

const availableSlots = computed(() => {
  const cols = detectedColumnsCount.value
  const slots = [
    { value: 'default', label: '默认' },
    { value: 'header', label: '标题' },
  ]
  for (let i = 1; i <= cols; i++) {
    let label = `第 ${i} 栏`
    if (cols === 2) {
      label = i === 1 ? '第 1 栏 (左)' : '第 2 栏 (右)'
    }
    slots.push({ value: `col-${i}`, label })
  }
  return slots
})

function isSlotActive(val: string): boolean {
  const s = props.elemSlot || ''
  if (val === 'default' || !val) {
    return !s || s === 'default'
  }
  if (s === val) return true
  if (val === 'col-1' && s === 'left') return true
  if (val === 'col-2' && s === 'center') return true
  if (val === 'col-3' && s === 'right' && detectedColumnsCount.value === 3) return true
  if (val === 'col-2' && s === 'right' && detectedColumnsCount.value === 2) return true
  if (val === 'left' && s === 'col-1') return true
  if (val === 'right' && (s === 'col-2' || s === 'col-3')) return true
  return false
}

const emit = defineEmits<{
  (e: 'toggleNote'): void
  (e: 'toggleElemClick'): void
  (e: 'update:elemClick', val: string): void
  (e: 'update:elemMotion', val: string): void
  (e: 'update:elemAnim', val: string, propsJson?: string): void
  (e: 'update:elemSlot', val: string): void
  (e: 'update:elemShikiLines', val: string): void
  (e: 'update:elemMaxHeight', val: string): void
  (e: 'applySuperBlockLayout', info: any): void
  (e: 'applySuperBlockRatio', ratio: string): void
  (e: 'insertDividerBefore'): void
  (e: 'insertDividerAfter'): void
  (e: 'setTwoColsContrast'): void
  (e: 'clearBlockAttrs'): void
  (e: 'convertToSuperBlock'): void
  (e: 'update:imageRole', val: string): void
  (e: 'toggleVideoAutoplay'): void
  (e: 'toggleVideoLoop'): void
  (e: 'toggleVideoMuted'): void
  (e: 'toggleVideoControls'): void
}>()

const motionPresets = [
  { label: '上浮', value: 'slide-up' },
  { label: '淡入', value: 'fade-in' },
  { label: '下沉', value: 'slide-down' },
  { label: '左滑', value: 'slide-left' },
  { label: '右滑', value: 'slide-right' },
  { label: '缩放', value: 'zoom-in' },
  { label: '弹性', value: 'bounce' },
]

const parsedMotion = computed(() => {
  if (!props.elemMotion || props.elemMotion.trim() === '' || props.elemMotion.trim() === 'none') {
    return null
  }
  try {
    const obj = JSON.parse(props.elemMotion)
    if (typeof obj === 'object' && obj !== null) {
      return {
        preset: obj.preset || obj.type || 'slide-up',
        duration: typeof obj.duration === 'number' ? obj.duration : 0,
        delay: typeof obj.delay === 'number' ? obj.delay : 0,
      }
    }
  } catch {
    // 字符串预设
  }
  return {
    preset: props.elemMotion.trim(),
    duration: 0,
    delay: 0,
  }
})

const localPreset = ref<string | null>(null)
const hasMotion = computed(() => Boolean(parsedMotion.value))
const currentPreset = computed(() => localPreset.value || parsedMotion.value?.preset || 'slide-up')
const currentDuration = computed(() => parsedMotion.value?.duration || 0)
const currentDelay = computed(() => parsedMotion.value?.delay || 0)

watch(
  () => props.elemMotion,
  () => {
    localPreset.value = null
  },
)

// Feature Flags 状态检测
const isAdvAnimEnabled = computed(() => isAnimationEnabled())
const hasEmphasisEffects = computed(() => isAnimationEnabled('pulse') || isAnimationEnabled('float') || isAnimationEnabled('shimmer'))
const hasTextEffects = computed(() => isAnimationEnabled('countup') || isAnimationEnabled('typewriter'))
function isEffectEnabled(effect: string) {
  return isAnimationEnabled(effect)
}

// 强调与文本高级动效解析
const currentAnimType = computed(() => (props.elemAnim || '').trim().toLowerCase())
const parsedAnimProps = computed<Record<string, any>>(() => {
  if (!props.elemAnimProps) return {}
  try {
    const obj = JSON.parse(props.elemAnimProps)
    return typeof obj === 'object' && obj !== null ? obj : {}
  } catch {
    return {}
  }
})

const currentAnimDuration = computed(() => {
  if (typeof parsedAnimProps.value.duration === 'number' && parsedAnimProps.value.duration > 0) {
    return parsedAnimProps.value.duration
  }
  return currentAnimType.value === 'countup' || currentAnimType.value === 'typewriter' ? 1500 : 2400
})

// Tab 状态：根据当前生效的属性初始化/自适应 Tab
const activeAnimTab = ref<'entrance' | 'emphasis' | 'text'>('entrance')

watch(
  [() => props.elemMotion, () => props.elemAnim],
  ([motion, anim]) => {
    if (anim) {
      if (['pulse', 'float', 'shimmer'].includes(anim)) {
        activeAnimTab.value = 'emphasis'
      } else if (['countup', 'typewriter'].includes(anim)) {
        activeAnimTab.value = 'text'
      }
    } else if (motion) {
      activeAnimTab.value = 'entrance'
    }
  },
  { immediate: true },
)

const hasAnyMotion = computed(() => hasMotion.value || Boolean(currentAnimType.value))

function toggleAllMotion() {
  if (hasAnyMotion.value) {
    emit('update:elemMotion', '')
    emit('update:elemAnim', '')
  } else {
    // 默认开启当前选中的 Tab
    if (activeAnimTab.value === 'emphasis') {
      const effect = isEffectEnabled('pulse') ? 'pulse' : isEffectEnabled('float') ? 'float' : 'shimmer'
      setEmphasisType(effect)
    } else if (activeAnimTab.value === 'text') {
      const effect = isEffectEnabled('countup') ? 'countup' : 'typewriter'
      setTextAnimType(effect)
    } else {
      emit('update:elemMotion', 'slide-up')
      emit('update:elemAnim', '')
    }
  }
}

function switchAnimTab(tab: 'entrance' | 'emphasis' | 'text') {
  activeAnimTab.value = tab
  if (tab === 'entrance') {
    emit('update:elemAnim', '')
    emit('update:elemMotion', currentPreset.value || 'slide-up')
  } else if (tab === 'emphasis') {
    const effect = isEffectEnabled('pulse') ? 'pulse' : isEffectEnabled('float') ? 'float' : 'shimmer'
    setEmphasisType(effect)
  } else if (tab === 'text') {
    const effect = isEffectEnabled('countup') ? 'countup' : 'typewriter'
    setTextAnimType(effect)
  }
}

function setEmphasisType(type: string) {
  emit('update:elemMotion', '')
  const nextProps = { ...parsedAnimProps.value, duration: currentAnimDuration.value }
  emit('update:elemAnim', type, JSON.stringify(nextProps))
}

function setTextAnimType(type: string) {
  emit('update:elemMotion', '')
  if (type === 'countup') {
    if (countUpProps.value.to === 0 && countUpProps.value.from === 0 && !countUpProps.value.prefix && !countUpProps.value.suffix) {
      autoExtractFromContent()
    } else {
      emit('update:elemAnim', 'countup', JSON.stringify(countUpProps.value))
    }
  } else {
    const nextProps = { ...parsedAnimProps.value, duration: currentAnimDuration.value }
    emit('update:elemAnim', type, JSON.stringify(nextProps))
  }
}

function setAnimDuration(duration: number) {
  const nextProps = { ...parsedAnimProps.value, duration }
  if (currentAnimType.value) {
    emit('update:elemAnim', currentAnimType.value, JSON.stringify(nextProps))
  }
}

// CountUp 专属参数计算属性与操作
const countUpProps = computed(() => {
  return {
    from: typeof parsedAnimProps.value.from === 'number' ? parsedAnimProps.value.from : 0,
    to: typeof parsedAnimProps.value.to === 'number' ? parsedAnimProps.value.to : 0,
    prefix: parsedAnimProps.value.prefix || '',
    suffix: parsedAnimProps.value.suffix || '',
    decimals: typeof parsedAnimProps.value.decimals === 'number' ? parsedAnimProps.value.decimals : 0,
    duration: typeof parsedAnimProps.value.duration === 'number' ? parsedAnimProps.value.duration : 1500,
  }
})

function updateCountUpField(field: string, val: any) {
  const nextProps = {
    ...countUpProps.value,
    [field]: val,
  }
  emit('update:elemAnim', 'countup', JSON.stringify(nextProps))
}

function autoExtractFromContent() {
  const text = props.activeBlockContent || ''
  const match = text.match(/([^\d\s]*)([\d,]+(?:\.\d+)?)([^\d\s]*)/)
  if (match) {
    const prefix = match[1] || ''
    const numRaw = match[2].replace(/,/g, '')
    const suffix = match[3] || ''
    const to = parseFloat(numRaw) || 0
    let decimals = 0
    if (numRaw.includes('.')) {
      decimals = numRaw.split('.')[1].length
    }
    const nextProps = {
      from: 0,
      to,
      prefix,
      suffix,
      decimals,
      duration: parsedAnimProps.value.duration || 1500,
    }
    emit('update:elemAnim', 'countup', JSON.stringify(nextProps))
  } else {
    const nextProps = {
      from: 0,
      to: 100,
      prefix: '',
      suffix: '%',
      decimals: 0,
      duration: 1500,
    }
    emit('update:elemAnim', 'countup', JSON.stringify(nextProps))
  }
}

// 动效即时试播舞台 (Live Preview Stage) 与 WYSIWYG 联动
const stagePlayKey = ref(0)
const currentStageCountUpValue = ref('0')
const currentStageTypewriterText = ref('')
let countUpRafId: number | null = null
let typewriterTimerId: any = null

const activeTabTitle = computed(() => {
  if (activeAnimTab.value === 'emphasis') return '持续强调动效'
  if (activeAnimTab.value === 'text') return '文本微动效'
  return '入场微动效'
})

const activeMotionSummaryBadge = computed(() => {
  if (activeAnimTab.value === 'entrance') {
    const p = MOTION_PRESETS.find(m => m.name === currentPreset.value)
    const label = p ? p.label : currentPreset.value
    const dur = currentDuration.value > 0 ? `${currentDuration.value}ms` : '450ms'
    const del = currentDelay.value > 0 ? ` · 延时${currentDelay.value}ms` : ''
    return `${label} · ${dur}${del}`
  }
  if (activeAnimTab.value === 'emphasis') {
    const p = EMPHASIS_PRESETS.find(m => m.name === currentAnimType.value)
    const label = p ? p.label : '呼吸微光'
    const dur = (currentAnimDuration.value / 1000).toFixed(1) + 's'
    return `${label} · 周期${dur}`
  }
  if (activeAnimTab.value === 'text') {
    if (currentAnimType.value === 'countup') {
      const p = countUpProps.value
      const targetStr = `${p.prefix}${p.to}${p.suffix}`
      return `数字滚动 · 目标 ${targetStr}`
    }
    if (currentAnimType.value === 'typewriter') {
      const dur = (currentAnimDuration.value / 1000).toFixed(1) + 's'
      return `打字机 · 耗时${dur}`
    }
    return '文本动效'
  }
  return '未激活'
})

const entranceStageStyle = computed(() => {
  const dur = currentDuration.value > 0 ? currentDuration.value : 450
  const del = currentDelay.value > 0 ? currentDelay.value : 0
  return {
    '--motion-duration': `${dur}ms`,
    '--motion-delay': `${del}ms`,
  }
})

const emphasisStageStyle = computed(() => {
  const dur = currentAnimDuration.value > 0 ? currentAnimDuration.value : 2400
  return {
    '--emphasis-duration': `${dur}ms`,
  }
})

function triggerTextWYSIWYG() {
  if (countUpRafId !== null) {
    cancelAnimationFrame(countUpRafId)
    countUpRafId = null
  }
  if (typewriterTimerId !== null) {
    clearTimeout(typewriterTimerId)
    typewriterTimerId = null
  }

  if (activeAnimTab.value === 'text') {
    if (currentAnimType.value === 'countup') {
      const from = typeof countUpProps.value.from === 'number' ? countUpProps.value.from : 0
      const to = typeof countUpProps.value.to === 'number' ? countUpProps.value.to : 0
      const duration = countUpProps.value.duration || 1500
      const decimals = countUpProps.value.decimals || 0
      const startTime = performance.now()
      currentStageCountUpValue.value = from.toFixed(decimals)

      const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))
      function update(now: number) {
        const elapsed = now - startTime
        const progress = Math.min(1, Math.max(0, elapsed / duration))
        const val = from + (to - from) * easeOutExpo(progress)
        currentStageCountUpValue.value = val.toFixed(decimals)
        if (progress < 1) {
          countUpRafId = requestAnimationFrame(update)
        } else {
          countUpRafId = null
        }
      }
      countUpRafId = requestAnimationFrame(update)
    } else if (currentAnimType.value === 'typewriter') {
      let rawText = (props.activeBlockContent || '').trim()
      if (rawText) {
        rawText = rawText.replace(/^[#*`>-\s]+/, '').split('\n')[0].trim()
      }
      if (!rawText) {
        rawText = 'Slidev 演示微动效系统'
      }
      const fullText = rawText.length > 24 ? rawText.slice(0, 24) + '...' : rawText
      const len = fullText.length
      const duration = currentAnimDuration.value || 1500
      const stepMs = Math.max(25, duration / len)
      let idx = 0
      currentStageTypewriterText.value = ''

      function step() {
        idx++
        currentStageTypewriterText.value = fullText.slice(0, idx)
        if (idx < len) {
          typewriterTimerId = setTimeout(step, stepMs)
        } else {
          typewriterTimerId = null
        }
      }
      typewriterTimerId = setTimeout(step, stepMs)
    }
  }
}

function replayLiveStage() {
  stagePlayKey.value++
  triggerTextWYSIWYG()
}

watch(
  [
    () => activeAnimTab.value,
    () => currentPreset.value,
    () => currentDuration.value,
    () => currentDelay.value,
    () => currentAnimType.value,
    () => currentAnimDuration.value,
    () => countUpProps.value.to,
    () => countUpProps.value.from,
    () => countUpProps.value.prefix,
    () => countUpProps.value.suffix,
    () => countUpProps.value.decimals,
    () => countUpProps.value.duration,
  ],
  () => {
    replayLiveStage()
  },
)

onMounted(() => {
  if (hasAnyMotion.value) {
    replayLiveStage()
  }
})

onBeforeUnmount(() => {
  if (countUpRafId !== null) {
    cancelAnimationFrame(countUpRafId)
    countUpRafId = null
  }
  if (typewriterTimerId !== null) {
    clearTimeout(typewriterTimerId)
    typewriterTimerId = null
  }
})

function handleMotionChange(payload: { preset: string; duration: number; delay: number }) {
  localPreset.value = payload.preset
  replayLiveStage()
  emitMotionChange(payload.preset, payload.duration, payload.delay)
}

function selectPreset(preset: string) {
  localPreset.value = preset
  replayLiveStage()
  emitMotionChange(preset, currentDuration.value, currentDelay.value)
}

function updateDuration(duration: number) {
  replayLiveStage()
  emitMotionChange(currentPreset.value, duration, currentDelay.value)
}

function updateDelay(delay: number) {
  replayLiveStage()
  emitMotionChange(currentPreset.value, currentDuration.value, delay)
}

function emitMotionChange(preset: string, duration: number, delay: number) {
  if (!preset || preset === 'none') {
    emit('update:elemMotion', '')
    return
  }
  emit('update:elemAnim', '')
  if (!duration && !delay) {
    emit('update:elemMotion', preset)
    return
  }
  const payload: Record<string, any> = { preset }
  if (duration > 0) payload.duration = duration
  if (delay > 0) payload.delay = delay
  emit('update:elemMotion', JSON.stringify(payload))
}
</script>
