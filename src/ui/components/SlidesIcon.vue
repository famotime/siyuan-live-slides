<template>
  <svg
    class="slides-icon"
    style="fill: none !important"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 全屏放映 (Fullscreen) -->
    <g v-if="name === 'fullscreen' || name === 'maximize'">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <polyline points="21 15 21 21 15 21" />
      <polyline points="3 9 3 3 9 3" />
    </g>

    <!-- 还原 / 退出最大化 (Minimize) -->
    <g v-else-if="name === 'minimize'">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </g>

    <!-- 关闭 (Close) -->
    <g v-else-if="name === 'close' || name === 'x'">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </g>

    <!-- 编辑 (Edit) -->
    <g v-else-if="name === 'edit'">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </g>

    <!-- 查阅 / 只读 (Eye) -->
    <g v-else-if="name === 'eye'">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </g>

    <!-- 外部链接 / 独立窗口 (External Link) -->
    <g v-else-if="name === 'external-link' || name === 'window'">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </g>

    <!-- 返回上层 (Arrow Left) -->
    <g v-else-if="name === 'arrow-left'">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </g>

    <!-- 前进 (Arrow Right) -->
    <g v-else-if="name === 'arrow-right'">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </g>

    <!-- 放大 / 增加 (Plus) -->
    <g v-else-if="name === 'plus'">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </g>

    <!-- 缩小 / 减少 (Minus) -->
    <g v-else-if="name === 'minus'">
      <line x1="5" y1="12" x2="19" y2="12" />
    </g>

    <!-- 分屏预览 -->
    <g v-else-if="name === 'split-preview'">
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

    <!-- 视频播放 (Video) -->
    <g v-else-if="name === 'video'">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </g>

    <!-- 逐步出现 (v-click / 闪烁) -->
    <g v-else-if="name === 'step'">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </g>

    <!-- 入场微动效 (v-motion) -->
    <g v-else-if="name === 'motion'">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
      <path d="M5 6h4" />
      <path d="M5 18h4" />
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

    <!-- 告警 / 加载失败 (Alert) -->
    <g v-else-if="name === 'alert' || name === 'warning'">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </g>

    <!-- 前后箭头 -->
    <g v-else-if="name === 'chevron-left'">
      <polyline points="15 18 9 12 15 6" />
    </g>
    <g v-else-if="name === 'chevron-right'">
      <polyline points="9 18 15 12 9 6" />
    </g>
    <g v-else-if="name === 'chevron-down'">
      <polyline points="6 9 12 15 18 9" />
    </g>

    <!-- 连续快进/快退箭头 (Chevrons Left / Right) -->
    <g v-else-if="name === 'chevrons-left'">
      <polyline points="11 17 6 12 11 7" />
      <polyline points="18 17 13 12 18 7" />
    </g>
    <g v-else-if="name === 'chevrons-right'">
      <polyline points="13 17 18 12 13 7" />
      <polyline points="6 17 11 12 6 7" />
    </g>

    <!-- 播放与暂停 (Play / Pause) -->
    <g v-else-if="name === 'play'">
      <polygon points="6 3 20 12 6 21 6 3" />
    </g>
    <g v-else-if="name === 'pause'">
      <line x1="10" y1="4" x2="10" y2="20" />
      <line x1="14" y1="4" x2="14" y2="20" />
    </g>

    <!-- 时钟 (Clock) -->
    <g v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </g>

    <!-- 复制 ID -->
    <g v-else-if="name === 'copy'">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </g>

    <!-- 图片 (Image / Export Image) -->
    <g v-else-if="name === 'image' || name === 'export-image'">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </g>

    <!-- 搜索/定位 (Search) -->
    <g v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </g>

    <!-- 齿轮设置 (Settings / Gear) -->
    <g v-else-if="name === 'settings' || name === 'gear'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </g>

    <!-- 笔记/备忘录 (Notes / File-text) -->
    <g v-else-if="name === 'notes' || name === 'file-text'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </g>

    <!-- 聚焦/准心靶标 (Focus / Target) -->
    <g v-else-if="name === 'focus' || name === 'target'">
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8" />
    </g>

    <!-- ====== 幻灯片版式线框图标 ====== -->
    <!-- 1. 版式：封面 (cover) -->
    <g v-else-if="name === 'layout-cover' || name === 'cover'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="5.5" y1="11.5" x2="18.5" y2="11.5" />
      <line x1="7.5" y1="15" x2="16.5" y2="15" />
    </g>

    <!-- 2. 版式：标准单栏 (default) -->
    <g v-else-if="name === 'layout-default' || name === 'default'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="5" y1="8" x2="11.5" y2="8" />
      <line x1="5" y1="11.5" x2="19" y2="11.5" />
      <line x1="5" y1="14.5" x2="19" y2="14.5" />
      <line x1="5" y1="17.5" x2="13.5" y2="17.5" />
    </g>

    <!-- 3. 版式：双栏 (two-cols) -->
    <g v-else-if="name === 'layout-two-cols' || name === 'two-cols'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" stroke-dasharray="2 1.5" />
      <!-- 左栏 -->
      <line x1="5" y1="8" x2="9.5" y2="8" />
      <line x1="5" y1="11.5" x2="9.5" y2="11.5" />
      <line x1="5" y1="15" x2="8" y2="15" />
      <!-- 右栏 -->
      <line x1="14.5" y1="8" x2="19" y2="8" />
      <line x1="14.5" y1="11.5" x2="19" y2="11.5" />
      <line x1="14.5" y1="15" x2="17.5" y2="15" />
    </g>

    <!-- 4. 版式：表头双栏 (two-cols-header) -->
    <g v-else-if="name === 'layout-two-cols-header' || name === 'two-cols-header'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="5" y1="7.5" x2="13" y2="7.5" />
      <line x1="12" y1="10.5" x2="12" y2="18.5" stroke-dasharray="1.5 1.5" />
      <!-- 左栏 -->
      <line x1="5" y1="12" x2="9.5" y2="12" />
      <line x1="5" y1="15.5" x2="8.5" y2="15.5" />
      <!-- 右栏 -->
      <line x1="14.5" y1="12" x2="19" y2="12" />
      <line x1="14.5" y1="15.5" x2="18" y2="15.5" />
    </g>

    <!-- 5. 版式：表头多栏 / 表头三栏 (cols-header / three-cols-header) -->
    <g v-else-if="name === 'layout-cols-header' || name === 'cols-header' || name === 'layout-three-cols-header' || name === 'three-cols-header'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="5" y1="7.5" x2="13" y2="7.5" />
      <line x1="9.3" y1="10.5" x2="9.3" y2="18.5" stroke-dasharray="1.5 1.5" />
      <line x1="14.7" y1="10.5" x2="14.7" y2="18.5" stroke-dasharray="1.5 1.5" />
      <!-- 第1栏 -->
      <line x1="4.5" y1="12" x2="7.5" y2="12" />
      <line x1="4.5" y1="15.5" x2="7" y2="15.5" />
      <!-- 第2栏 -->
      <line x1="10.5" y1="12" x2="13.5" y2="12" />
      <line x1="10.5" y1="15.5" x2="13.5" y2="15.5" />
      <!-- 第3栏 -->
      <line x1="16" y1="12" x2="19.5" y2="12" />
      <line x1="16" y1="15.5" x2="18.5" y2="15.5" />
    </g>

    <!-- 5.5 版式：四叶草 / 田字型 (clover) -->
    <g v-else-if="name === 'layout-clover' || name === 'clover'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="5" y1="7" x2="13" y2="7" />
      <!-- 田字型水平与垂直虚线分割 -->
      <line x1="4.5" y1="13.5" x2="19.5" y2="13.5" stroke-dasharray="1.5 1.5" />
      <line x1="12" y1="9" x2="12" y2="18.5" stroke-dasharray="1.5 1.5" />
      <!-- 四象限条目内容 -->
      <line x1="5" y1="11" x2="9.5" y2="11" />
      <line x1="14.5" y1="11" x2="19" y2="11" />
      <line x1="5" y1="16" x2="9.5" y2="16" />
      <line x1="14.5" y1="16" x2="19" y2="16" />
    </g>

    <!-- 6. 版式：图右 (image-right) -->
    <g v-else-if="name === 'layout-image-right' || name === 'image-right'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <!-- 左侧文字区 -->
      <line x1="4.5" y1="8" x2="9.5" y2="8" />
      <line x1="4.5" y1="11.5" x2="10" y2="11.5" />
      <line x1="4.5" y1="14.5" x2="8" y2="14.5" />
      <!-- 右侧图片区：太阳与山峰 -->
      <circle cx="15.5" cy="8.5" r="1.2" />
      <polyline points="13 17 15.5 13 18 16 19.5 14" />
    </g>

    <!-- 7. 版式：图左 (image-left) -->
    <g v-else-if="name === 'layout-image-left' || name === 'image-left'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <!-- 左侧图片区：太阳与山峰 -->
      <circle cx="6" cy="8.5" r="1.2" />
      <polyline points="3.5 17 6 13 8.5 16 10 14" />
      <!-- 右侧文字区 -->
      <line x1="14.5" y1="8" x2="19.5" y2="8" />
      <line x1="14.5" y1="11.5" x2="20" y2="11.5" />
      <line x1="14.5" y1="14.5" x2="18" y2="14.5" />
    </g>

    <!-- 8. 版式：居中 (center) -->
    <g v-else-if="name === 'layout-center' || name === 'center'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="6.5" y1="9" x2="17.5" y2="9" />
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="8" y1="15" x2="16" y2="15" />
    </g>

    <!-- 9. 版式：大字报 / 核心数据 (fact) -->
    <g v-else-if="name === 'layout-fact' || name === 'fact'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <!-- 大号核心数据符号（百分比 %） -->
      <circle cx="8" cy="9" r="1.5" />
      <line x1="14" y1="8" x2="9" y2="14" />
      <circle cx="15" cy="13" r="1.5" />
      <!-- 底部说明小字 -->
      <line x1="6.5" y1="17" x2="17.5" y2="17" />
    </g>

    <!-- 10. 版式：介绍 / 演讲者 (intro) -->
    <g v-else-if="name === 'layout-intro' || name === 'intro'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <!-- 左侧人物头像 -->
      <circle cx="7.5" cy="9.5" r="2" />
      <path d="M4.5 16.5c0-1.8 1.3-3 3-3s3 1.2 3 3" />
      <!-- 右侧个人名片/介绍信息 -->
      <line x1="13" y1="9" x2="18.5" y2="9" />
      <line x1="13" y1="12.5" x2="19.5" y2="12.5" />
      <line x1="13" y1="15.5" x2="17" y2="15.5" />
    </g>

    <!-- 11. 版式：引言 (quote) -->
    <g v-else-if="name === 'layout-quote' || name === 'quote'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <!-- 双引号标志 -->
      <path d="M6 7.5h2v2H6.5c0 1.2-.4 2-1.5 2.5" />
      <path d="M9.5 7.5h2v2H10c0 1.2-.4 2-1.5 2.5" />
      <!-- 引言文字 -->
      <line x1="6" y1="13.5" x2="18" y2="13.5" />
      <!-- 署名短线 -->
      <line x1="12.5" y1="16.5" x2="17.5" y2="16.5" />
    </g>

    <!-- 桌面端视图 (Desktop / Monitor) -->
    <g v-else-if="name === 'desktop' || name === 'monitor'">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </g>

    <!-- 移动端视图 (Mobile / Smartphone) -->
    <g v-else-if="name === 'mobile' || name === 'smartphone' || name === 'phone'">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" stroke-width="2" stroke-linecap="round" />
    </g>

    <!-- 文本/标题排版 (Type / Typography) -->
    <g v-else-if="name === 'type' || name === 'heading'">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </g>

    <!-- 重置 / 恢复 (Reset / Undo) -->
    <g v-else-if="name === 'reset' || name === 'undo'">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <polyline points="3 3 3 8 8 8" />
    </g>

    <!-- 循环播放 (Repeat) -->
    <g v-else-if="name === 'repeat' || name === 'loop'">
      <path d="m17 1 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 23-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </g>

    <!-- 静音播放 (Volume X / Mute) -->
    <g v-else-if="name === 'volume-x' || name === 'mute'">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </g>

    <!-- 控制条 / 控制器 (Sliders / Controls) -->
    <g v-else-if="name === 'sliders' || name === 'controls'">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </g>

    <!-- 安装包 / 归档 (Package / Zip) -->
    <g v-else-if="name === 'package' || name === 'zip' || name === 'archive'">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </g>

    <!-- 文件夹 (Folder) -->
    <g v-else-if="name === 'folder'">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </g>

    <!-- 火箭 / 发送 (Rocket) -->
    <g v-else-if="name === 'rocket'">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </g>

    <!-- 动效 / 魔法棒 (Wand / Magic) -->
    <g v-else-if="name === 'wand' || name === 'magic'">
      <path d="m19 2 2 2-6 6-2-2Z" />
      <path d="m13 8 2 2" />
      <path d="m3 21 9-9" />
    </g>

    <!-- 图左版式图标 -->
    <g v-else-if="name === 'image-left'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <rect x="4" y="6" width="6" height="12" rx="1" />
      <line x1="13" y1="8" x2="19" y2="8" />
      <line x1="13" y1="12" x2="19" y2="12" />
      <line x1="13" y1="16" x2="17" y2="16" />
    </g>

    <!-- 图右版式图标 -->
    <g v-else-if="name === 'image-right'">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <rect x="14" y="6" width="6" height="12" rx="1" />
      <line x1="5" y1="8" x2="11" y2="8" />
      <line x1="5" y1="12" x2="11" y2="12" />
      <line x1="5" y1="16" x2="9" y2="16" />
    </g>

    <!-- 帮助 / 问号 (Help / Info) -->
    <g v-else-if="name === 'help' || name === 'question' || name === 'info'">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
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
.slides-icon {
  width: 1em;
  height: 1em;
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
