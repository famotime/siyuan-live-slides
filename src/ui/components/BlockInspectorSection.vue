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
import SlidesIcon from '@/ui/components/SlidesIcon.vue'
import MotionSelector from '@/ui/components/MotionSelector.vue'
import {
  EMPHASIS_PRESETS,
  TEXT_PRESETS,
  EMPHASIS_DURATION_OPTIONS,
} from '@/ui/components/motion-presets'
import { useBlockMotionSection } from '@/ui/components/useBlockMotionSection'
import { useBlockSlotSection } from '@/ui/components/useBlockSlotSection'

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

// 多栏插槽领域逻辑抽离：版式判定、分栏数探测与插槽清单由 useBlockSlotSection 提供
const {
  effectiveLayout,
  isMultiColsLayout,
  hasLayoutControls,
  detectedColumnsCount,
  slotControlTitle,
  slotControlDesc,
  availableSlots,
  isSlotActive,
} = useBlockSlotSection({
  elemSlot: () => props.elemSlot,
  currentSlideLayout: () => props.currentSlideLayout,
  currentSlideLayoutRatio: () => props.currentSlideLayoutRatio,
  currentSlideHeader: () => props.currentSlideHeader,
  isSuperBlock: () => props.isSuperBlock,
  isImage: () => props.isImage,
  imageRole: () => props.imageRole,
  isVideo: () => props.isVideo,
  isCodeBlock: () => props.isCodeBlock,
  detectedSbInfo: () => props.detectedSbInfo,
})

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

// 动效领域逻辑抽离：入场/强调/文本动效解析、变更与试播舞台统一由 useBlockMotionSection 提供
const {
  localPreset,
  currentPreset,
  currentDuration,
  currentDelay,
  isAdvAnimEnabled,
  hasEmphasisEffects,
  hasTextEffects,
  isEffectEnabled,
  currentAnimType,
  currentAnimDuration,
  activeAnimTab,
  hasAnyMotion,
  toggleAllMotion,
  switchAnimTab,
  setEmphasisType,
  setTextAnimType,
  setAnimDuration,
  countUpProps,
  updateCountUpField,
  autoExtractFromContent,
  stagePlayKey,
  currentStageCountUpValue,
  currentStageTypewriterText,
  activeTabTitle,
  activeMotionSummaryBadge,
  entranceStageStyle,
  emphasisStageStyle,
  replayLiveStage,
  handleMotionChange,
} = useBlockMotionSection(
  {
    elemMotion: () => props.elemMotion,
    elemAnim: () => props.elemAnim,
    elemAnimProps: () => props.elemAnimProps,
    activeBlockContent: () => props.activeBlockContent,
  },
  emit,
)
</script>

