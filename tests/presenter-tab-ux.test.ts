import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Presenter Tab UX & Accessibility Standards (演讲者视图设计与无障碍规范)', () => {
  const presenterVuePath = path.resolve(__dirname, '../src/ui/tab/SlidevPresenterTab.vue')
  const content = fs.readFileSync(presenterVuePath, 'utf8')

  it('严禁使用 HTML 原生 title 属性，彻底根除定制与原生双重 Tooltip 重叠冲突', () => {
    // 检查 template 部分是否包含 title="..." 模式
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/)
    expect(templateMatch).toBeTruthy()
    const templateContent = templateMatch![1]

    // 严禁任何 title=" 或 title='
    const titleMatches = templateContent.match(/\btitle\s*=\s*["']/g)
    expect(titleMatches).toBeNull()
  })

  it('必须全面采用思源原生 b3-tooltips 配合 aria-label 机制', () => {
    expect(content).toContain('b3-tooltips')
    expect(content).toContain('aria-label')
    // 顶栏向下弹，底栏向上弹
    expect(content).toContain('b3-tooltips__s')
    expect(content).toContain('b3-tooltips__n')
  })

  it('必须使用显式线框图标，彻底杜绝 Emoji 作为操作按钮与标题符号', () => {
    // 检查旧版中的 Emoji 符号是否已被全部清除
    const emojis = ['🎤', '⚡', '🗗', '⏱', '📝', '📡']
    for (const emoji of emojis) {
      expect(content).not.toContain(emoji)
    }
  })

  it('必须引入标准 Lucide 线性图标并使用 SlidevIcon 组件', () => {
    expect(content).toContain("import SlidevIcon from '@/ui/components/SlidevIcon.vue'")
    expect(content).toContain('name="presenter"')
    expect(content).toContain('name="window"')
    expect(content).toContain('name="clock"')
    expect(content).toContain('name="chevrons-left"')
    expect(content).toContain('name="chevrons-right"')
  })

  it('顶栏与底栏必须设置 overflow: visible 防御线，确保 Tooltip 气泡不被截断', () => {
    // 提取 header 和 footer 的样式
    expect(content).toMatch(/\.presenter-header[\s\S]*?overflow:\s*visible;/)
    expect(content).toMatch(/\.presenter-actions[\s\S]*?overflow:\s*visible;/)
  })

  it('配色体系必须全面绑定思源 --b3-* 变量，同时兼容亮色与暗色模式', () => {
    expect(content).toContain('var(--b3-theme-background')
    expect(content).toContain('var(--b3-theme-surface')
    expect(content).toContain('var(--b3-theme-primary')
    expect(content).toContain('var(--b3-border-color')
    // 不再硬编码全黑变量
    expect(content).not.toContain('--bg-dark: #0f1117')
    expect(content).not.toContain('--card-bg: #1a1d26')
  })

  it('必须提供高保真步进点阵指示器与现实双时钟体验', () => {
    expect(content).toContain('step-dots-bar')
    expect(content).toContain('step-dot')
    expect(content).toContain('wallClockTime')
    expect(content).toContain('wall-clock')
  })

  it('步进点阵指示器必须位于下一步按钮左侧，下一步按钮去除重复的括号指示文本', () => {
    // 验证 step-dots-bar 在下一步按钮之前
    const stepDotsIndex = content.indexOf('class="step-dots-bar')
    const nextBtnIndex = content.indexOf('<span>下一步</span>')
    expect(stepDotsIndex).toBeGreaterThan(-1)
    expect(nextBtnIndex).toBeGreaterThan(-1)
    expect(stepDotsIndex).toBeLessThan(nextBtnIndex)

    // 严禁下一步按钮内部文本带有括号重复指示
    expect(content).toContain('<span>下一步</span>')
    expect(content).not.toContain('currentStep < currentMaxStep ?')
  })
})
