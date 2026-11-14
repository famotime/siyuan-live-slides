/**
 * 入场微动效 (v-motion) 预设与配置定义
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
