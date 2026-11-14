/**
 * 入场、持续强调与文本微动效预设与配置定义
 */

export interface IMotionPreset {
  name: string
  label: string
  desc: string
  type: 'slide' | 'fade' | 'zoom' | 'bounce'
}

/** 7 种标准的入场微动效预设 */
export const MOTION_PRESETS: IMotionPreset[] = [
  { name: 'slide-up', label: '上浮', desc: '自下向上平滑升起并淡入，最通用的优雅要点呈现', type: 'slide' },
  { name: 'fade-in', label: '淡入', desc: '原地平滑淡入，无位移干扰，适合学术与柔和叙事', type: 'fade' },
  { name: 'slide-down', label: '下沉', desc: '自上向下平滑滑落并淡入，适合层级解构与自顶向下', type: 'slide' },
  { name: 'slide-left', label: '左滑', desc: '从右向左平滑推入，适合横向流程推进或下一步展示', type: 'slide' },
  { name: 'slide-right', label: '右滑', desc: '从左向右平滑推入，适合逆向对比或回归说明', type: 'slide' },
  { name: 'zoom-in', label: '缩放', desc: '从小到大微缩放弹出，带有弹性视觉焦点冲击力', type: 'zoom' },
  { name: 'bounce', label: '弹性', desc: '带有自然物理弹跳回弹阻尼，极具现代科技发布会感', type: 'bounce' },
]

/** 常用持续时长预设 (ms) */
export const MOTION_DURATION_OPTIONS = [
  { label: '默认耗时 (450ms)', value: 0 },
  { label: '极速 (200ms)', value: 200 },
  { label: '较快 (350ms)', value: 350 },
  { label: '平滑 (500ms)', value: 500 },
  { label: '缓慢 (800ms)', value: 800 },
]

/** 常用触发延迟预设 (ms) */
export const MOTION_DELAY_OPTIONS = [
  { label: '无延迟', value: 0 },
  { label: '延迟 150ms', value: 150 },
  { label: '延迟 300ms', value: 300 },
  { label: '延迟 500ms', value: 500 },
]

/** 持续强调微动效预设接口 */
export interface IEmphasisPreset {
  name: 'pulse' | 'float' | 'shimmer'
  label: string
  desc: string
  icon: string
  type: 'emphasis'
}

/** 3 种标准的持续强调微动效预设 */
export const EMPHASIS_PRESETS: IEmphasisPreset[] = [
  {
    name: 'pulse',
    label: '呼吸微光',
    desc: '周期性柔和光晕扩散与微呼吸放大，适合重点词句与关键卡片',
    icon: 'sparkles',
    type: 'emphasis',
  },
  {
    name: 'float',
    label: '3D 悬浮',
    desc: '轻盈上下浮动与微倾斜阴影，赋予卡片悬空漂浮的层次感',
    icon: 'motion',
    type: 'emphasis',
  },
  {
    name: 'shimmer',
    label: '流光掠过',
    desc: '高光扫过表面呈现如金属反光般的高级质感，极具吸睛力',
    icon: 'sparkles',
    type: 'emphasis',
  },
]

/** 文本微动效预设接口 */
export interface ITextAnimPreset {
  name: 'countup' | 'typewriter'
  label: string
  desc: string
  icon: string
  type: 'text'
}

/** 2 种标准的文本微动效预设 */
export const TEXT_PRESETS: ITextAnimPreset[] = [
  {
    name: 'countup',
    label: '数字滚动',
    desc: '数值从起始值平滑缓动翻滚递增至目标值，适合数据指标与战报统计',
    icon: 'step',
    type: 'text',
  },
  {
    name: 'typewriter',
    label: '终端打字机',
    desc: '逐字敲击输出并伴随光标跳动，营造终端命令行或手敲代码现场感',
    icon: 'code',
    type: 'text',
  },
]

/** 持续强调常用循环周期选项 (ms) */
export const EMPHASIS_DURATION_OPTIONS = [
  { label: '极速 (1.5s)', value: 1500 },
  { label: '平滑 (2.4s)', value: 2400 },
  { label: '舒缓 (3.6s)', value: 3600 },
]

/** 打字机打字速度选项 (ms/字) */
export const TYPEWRITER_SPEED_OPTIONS = [
  { label: '极速 (35ms)', value: 35 },
  { label: '自然 (60ms)', value: 60 },
  { label: '从容 (100ms)', value: 100 },
]

