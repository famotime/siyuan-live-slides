import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('BlockInspectorSection UX & Layout Evolution', () => {
  const blockInspectorPath = path.resolve(__dirname, '../src/ui/components/BlockInspectorSection.vue')
  const content = fs.readFileSync(blockInspectorPath, 'utf8')

  it('1. 不得存在独立的「设为讲稿备注」卡片', () => {
    // 确认顶部独立卡片已被移除
    expect(content).not.toContain('<!-- 0. 设为讲稿备注 (slides-note) -->')
    expect(content).not.toMatch(/<div class="spm-control-title">\s*<SlidesIcon name="presenter" \/>\s*<span>设为讲稿备注<\/span>/)
  })

  it('2. 快捷操作网格中不得存在「设为双栏」按钮', () => {
    expect(content).not.toMatch(/<span>{{\s*effectiveLayout === 'three-cols-header' \? '设为第1栏' : '设为双栏'\s*}}<\/span>/)
    expect(content).not.toContain('@click="$emit(\'setTwoColsContrast\')"')
  })

  it('3. 快捷操作网格中必须包含状态切换式的「讲稿备注」操作按钮，位于清除属性之前', () => {
    // 必须包含切换备注按钮
    expect(content).toMatch(/<SlidesIcon name="presenter" \/>\s*<span>{{\s*isNote \? '取消备注' : '设为备注'\s*}}<\/span>/)
    expect(content).toContain('@click="$emit(\'toggleNote\')"')
    expect(content).toContain(':class="{ \'spm-btn-action--active\': Boolean(isNote) }"')

    // 顺序检查：备注切换按钮必须在清除属性按钮之前
    const noteBtnIdx = content.indexOf('@click="$emit(\'toggleNote\')"')
    const clearBtnIdx = content.indexOf('@click="$emit(\'clearBlockAttrs\')"')
    expect(noteBtnIdx).toBeGreaterThan(0)
    expect(clearBtnIdx).toBeGreaterThan(noteBtnIdx)
  })

  it('4. 「清除属性」按钮应始终渲染，在无属性时应用 disabled 禁用态', () => {
    // 不得以 v-if="hasBlockAttrs" 隐藏按钮（保持 2x2 网格对齐）
    expect(content).not.toMatch(/<button[^>]*v-if="hasBlockAttrs"[^>]*@click="\$emit\('clearBlockAttrs'\)"/)
    // 必须有 disabled 绑定和 is-disabled 类绑定
    expect(content).toContain(':disabled="!hasBlockAttrs"')
    expect(content).toContain(':class="{ \'is-disabled\': !hasBlockAttrs }"')
  })

  it('5. 必须分开「元素排版」与「元素动效」两个独立分区，且排版位于动效上方', () => {
    // 包含独立的分区大标题
    expect(content).toContain('<span>元素排版</span>')
    expect(content).toContain('<span>元素动效</span>')

    const layoutHeaderIdx = content.indexOf('<span>元素排版</span>')
    const motionHeaderIdx = content.indexOf('<span>元素动效</span>')
    expect(layoutHeaderIdx).toBeGreaterThan(0)
    expect(motionHeaderIdx).toBeGreaterThan(layoutHeaderIdx)
  })

  it('6. 多栏插槽归属作为核心排版控制项，在 DOM 顺序中必须置顶位于逐步呈现与动效强化之前', () => {
    const slotIdx = content.indexOf('<span>{{ slotControlTitle }}</span>')
    const vClickIdx = content.indexOf('<span>逐步呈现</span>')
    const motionIdx = content.indexOf('<span>动效与视觉强调</span>')

    expect(slotIdx).toBeGreaterThan(0)
    expect(vClickIdx).toBeGreaterThan(slotIdx)
    expect(motionIdx).toBeGreaterThan(vClickIdx)
  })
})
