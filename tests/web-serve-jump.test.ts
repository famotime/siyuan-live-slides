import { describe, expect, it, beforeEach } from 'vitest'
import {
  DEFAULT_GLOBAL_SETTINGS,
  buildSiYuanWebUrl,
  getRuntimeSettings,
  normalizeGlobalSettings,
  setRuntimeSettings,
} from '../src/settings'

describe('Web Serve Jump & URL Specification (思源本地网络伺服外跳规范与配置测试)', () => {
  beforeEach(() => {
    // 重置运行时配置为默认值
    setRuntimeSettings({ ...DEFAULT_GLOBAL_SETTINGS })
  })

  describe('buildSiYuanWebUrl (根据 siyuan-note 源码规范生成 Web URL)', () => {
    it('标准情况下应准确生成思源桌面端 Web 路由地址 (含 /stage/build/desktop/ 与 r 缓存随机串)', () => {
      const url = buildSiYuanWebUrl('http://127.0.0.1:3758', '20261004210505-yuvkc3m', { r: '9owcnxr' })
      expect(url).toBe('http://127.0.0.1:3758/stage/build/desktop/?id=20261004210505-yuvkc3m&r=9owcnxr')
    })

    it('块聚焦模式下 (focus: true) 应自动追加 &focus=1 参数', () => {
      const url = buildSiYuanWebUrl('http://127.0.0.1:6806', '20260625214150-d151ljw', { focus: true, r: 'abcdef1' })
      expect(url).toBe('http://127.0.0.1:6806/stage/build/desktop/?id=20260625214150-d151ljw&focus=1&r=abcdef1')
    })

    it('当伺服地址带有多个多余的结尾斜杠时应自动剔除并保留完整路径', () => {
      const url = buildSiYuanWebUrl('http://127.0.0.1:9352///', '20260801083216-m7enl4c', { r: '1234567' })
      expect(url).toBe('http://127.0.0.1:9352/stage/build/desktop/?id=20260801083216-m7enl4c&r=1234567')
    })

    it('当伺服地址本身已包含 /stage/build/desktop 时不重复追加', () => {
      const url = buildSiYuanWebUrl('http://127.0.0.1:3758/stage/build/desktop/', '20261004210505-yuvkc3m', { r: '9owcnxr' })
      expect(url).toBe('http://127.0.0.1:3758/stage/build/desktop/?id=20261004210505-yuvkc3m&r=9owcnxr')
    })

    it('当伺服地址缺少 http:// 协议前缀时应智能自动补齐', () => {
      const url = buildSiYuanWebUrl('127.0.0.1:6806', '20231019123456-abcdef', { r: '7654321' })
      expect(url).toBe('http://127.0.0.1:6806/stage/build/desktop/?id=20231019123456-abcdef&r=7654321')
    })

    it('未显式传入 r 时应自动生成 7 位随机字符串', () => {
      const url = buildSiYuanWebUrl('http://127.0.0.1:6806', '20231019123456-abcdef')
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:6806\/stage\/build\/desktop\/\?id=20231019123456-abcdef&r=[a-z0-9]{7}$/)
    })

    it('支持局域网 IP 与自定义端口', () => {
      const url = buildSiYuanWebUrl('http://192.168.1.100:9352', '20231020123456-112233', { focus: true, r: 'lanhost' })
      expect(url).toBe('http://192.168.1.100:9352/stage/build/desktop/?id=20231020123456-112233&focus=1&r=lanhost')
    })
  })

  describe('normalizeGlobalSettings & setRuntimeSettings (配置规范化与运行时状态)', () => {
    it('空值或非法输入应安全回退到默认设置', () => {
      const res1 = normalizeGlobalSettings(null)
      expect(res1.enableWebServeJump).toBe(false)
      expect(res1.webServeUrl).toBe('http://127.0.0.1:6806')

      const res2 = normalizeGlobalSettings(undefined)
      expect(res2.enableWebServeJump).toBe(false)
      expect(res2.webServeUrl).toBe('http://127.0.0.1:6806')

      const res3 = normalizeGlobalSettings({ webServeUrl: '   ' })
      expect(res3.webServeUrl).toBe('http://127.0.0.1:6806')
    })

    it('正确规范化用户自定义的伺服地址与开启开关', () => {
      const custom = normalizeGlobalSettings({
        enableWebServeJump: true,
        webServeUrl: '  http://127.0.0.1:9352/  ',
      })
      expect(custom.enableWebServeJump).toBe(true)
      expect(custom.webServeUrl).toBe('http://127.0.0.1:9352/')
    })

    it('setRuntimeSettings 应响应式更新全局配置状态', () => {
      setRuntimeSettings({
        enableWebServeJump: true,
        webServeUrl: 'http://localhost:6806',
      })
      const current = getRuntimeSettings()
      expect(current.enableWebServeJump).toBe(true)
      expect(current.webServeUrl).toBe('http://localhost:6806')
    })

    it('setRuntimeSettings 在仅传入部分字段时必须保留其他字段的现有状态 (防止在输入框按键时关闭开关)', () => {
      setRuntimeSettings({ enableWebServeJump: true })
      expect(getRuntimeSettings().enableWebServeJump).toBe(true)
      expect(getRuntimeSettings().webServeUrl).toBe('http://127.0.0.1:6806')

      // 在输入框中输入/粘贴新地址时，仅更新 webServeUrl，enableWebServeJump 绝不能被置为 false
      setRuntimeSettings({ webServeUrl: 'http://127.0.0.1:9352' })
      expect(getRuntimeSettings().enableWebServeJump).toBe(true)
      expect(getRuntimeSettings().webServeUrl).toBe('http://127.0.0.1:9352')

      // 再次仅修改开关时，webServeUrl 也不能被重置
      setRuntimeSettings({ enableWebServeJump: false })
      expect(getRuntimeSettings().enableWebServeJump).toBe(false)
      expect(getRuntimeSettings().webServeUrl).toBe('http://127.0.0.1:9352')
    })
  })

  describe('速览抽屉分流逻辑模拟 (Preview Tab Drawer Routing)', () => {
    it('当本地伺服关闭时，点击思源块应路由至 siyuan 轨 (ProtylePeekDrawer)', () => {
      setRuntimeSettings({ enableWebServeJump: false })
      const settings = getRuntimeSettings()

      const detail = { peekType: 'siyuan' as const, target: '20260625214150-d151ljw', title: '测试文档' }

      let resolvedType: 'siyuan' | 'web' = detail.peekType
      let resolvedUrl = ''
      if (detail.peekType === 'siyuan' && settings.enableWebServeJump) {
        resolvedType = 'web'
        resolvedUrl = buildSiYuanWebUrl(settings.webServeUrl, detail.target)
      }

      expect(resolvedType).toBe('siyuan')
      expect(resolvedUrl).toBe('')
    })

    it('当本地伺服开启时，点击非文档块 (isDoc: false) 必须自动追加 &focus=1 参数', () => {
      setRuntimeSettings({
        enableWebServeJump: true,
        webServeUrl: 'http://127.0.0.1:3758',
      })
      const settings = getRuntimeSettings()

      const isDoc = false // 非文档块
      const url = buildSiYuanWebUrl(settings.webServeUrl, '20261004210505-yuvkc3m', {
        focus: !isDoc,
        r: '9owcnxr',
      })

      expect(url).toBe('http://127.0.0.1:3758/stage/build/desktop/?id=20261004210505-yuvkc3m&focus=1&r=9owcnxr')
    })

    it('当本地伺服开启时，点击文档块 (isDoc: true) 不应追加 &focus=1 参数', () => {
      setRuntimeSettings({
        enableWebServeJump: true,
        webServeUrl: 'http://127.0.0.1:3758',
      })
      const settings = getRuntimeSettings()

      const isDoc = true // 文档块
      const url = buildSiYuanWebUrl(settings.webServeUrl, '20261004210505-docroot', {
        focus: !isDoc,
        r: '9owcnxr',
      })

      expect(url).toBe('http://127.0.0.1:3758/stage/build/desktop/?id=20261004210505-docroot&r=9owcnxr')
      expect(url).not.toContain('&focus=1')
    })
  })
})
