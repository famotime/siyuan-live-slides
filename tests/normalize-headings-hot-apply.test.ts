import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { applyGlobalDisplaySettingImmediate } from '../src/main'
import { WebSandboxBridge } from '../src/engine/web-sandbox-bridge'
import { CursorTracker } from '../src/sync/cursor-tracker'
import { generateStandaloneExportStyles } from '../src/export/standalone-template-styles'
import { generatePdfExportStyles } from '../src/export/pdf-template-styles'

describe('固定特定标题大小热应用与封面独立性', () => {
  const indexHtmlPath = path.resolve(__dirname, '../public/slides-client/index.html')
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8')
  const thumbnailScssPath = path.resolve(__dirname, '../src/ui/tab/SlidesPresenterThumbnail.scss')
  const thumbnailScss = fs.readFileSync(thumbnailScssPath, 'utf8')
  const previewTabPath = path.resolve(__dirname, '../src/ui/tab/SlidesPreviewTab.vue')
  const previewTabCode = fs.readFileSync(previewTabPath, 'utf8')
  const docInspectorPath = path.resolve(__dirname, '../src/ui/components/DocInspectorSection.vue')
  const docInspectorCode = fs.readFileSync(docInspectorPath, 'utf8')

  describe('1. 侧栏高级设置开启即时热应用机制', () => {
    it('DocInspectorSection 应导入并在开关变动时立即调用 applyGlobalDisplaySettingImmediate', () => {
      expect(docInspectorCode).toContain('applyGlobalDisplaySettingImmediate({ normalizeHeadingSizes: enabled })')
      expect(docInspectorCode).toContain('applyGlobalDisplaySettingImmediate({ showUnorderedListMarkers: enabled })')
      expect(docInspectorCode).toContain('applyGlobalDisplaySettingImmediate({ showOrderedListMarkers: enabled })')
    })

    it('DocInspectorSection 应接收 currentDocId 并在编译时显式携带 docId 与 explicit 选项', () => {
      expect(docInspectorCode).toContain('currentDocId?: string')
      expect(docInspectorCode).toContain("const targetDocId = props.currentDocId || plugin?.currentDocId || plugin?.getActiveDocumentId?.()")
      expect(docInspectorCode).toContain("plugin.compileCurrentDocument(targetDocId, { reason: 'explicit' })")
    })

    it('WebSandboxBridge 应支持 updateConfig 并定向派发 CONFIG_UPDATE 消息', () => {
      const bridge = new WebSandboxBridge()
      const postSpy = vi.spyOn(bridge, 'postMessage')
      bridge.updateConfig({ normalizeHeadingSizes: true })
      expect(postSpy).toHaveBeenCalledWith('CONFIG_UPDATE', {
        config: { normalizeHeadingSizes: true }
      })
    })

    it('slides-client/index.html 应支持 CONFIG_UPDATE / UPDATE_CONFIG 即时更新 config', () => {
      expect(indexHtml).toContain('case "CONFIG_UPDATE":')
      expect(indexHtml).toContain('case "UPDATE_CONFIG":')
      expect(indexHtml).toContain('config.value = { ...config.value, ...data.payload.config }')
      expect(indexHtml).toContain('applyConfigThemeMode(config.value)')
    })

    it('slides-client/index.html 跨窗口 BroadcastChannel 应支持 SYNC_CONFIG', () => {
      expect(indexHtml).toContain('e.data?.type === "SYNC_CONFIG"')
    })
  })

  describe('2. 预览工具栏刷新按钮修复', () => {
    it('SlidesPreviewTab 的 onRefresh 应优先从已渲染文档获取准确 docId 并指定 explicit 重新编译', () => {
      expect(previewTabCode).toContain('latestDoc?.docId || renderedDocId')
      expect(previewTabCode).toContain("(plugin as any).compileCurrentDocument(docId, { reason: 'explicit' })")
    })

    it('SlidesPreviewTab 的 onRefresh 应立即同步当前最新全局设置并向沙箱推送更新', () => {
      expect(previewTabCode).toContain('const currentSettings = getRuntimeSettings()')
      expect(previewTabCode).toContain('normalizeHeadingSizes: currentSettings.normalizeHeadingSizes')
      expect(previewTabCode).toContain('showUnorderedListMarkers: currentSettings.showUnorderedListMarkers')
      expect(previewTabCode).toContain('showOrderedListMarkers: currentSettings.showOrderedListMarkers')
      expect(previewTabCode).toContain('sandboxBridge.updateSlides(')
    })

    it('SlidesPreviewTab 的 defineExpose 应提供 applyConfigUpdate 与 getDocId', () => {
      expect(previewTabCode).toContain('applyConfigUpdate(partialConfig: Partial<ISlidesPluginConfig>)')
      expect(previewTabCode).toContain('getDocId()')
    })
  })

  describe('3. 封面页排他性保障（开关不应影响封面字体显示）', () => {
    it('slides-client/index.html 中的 normalizeHeadings 规则必须排除封面页 (.layout-cover)', () => {
      // 1429 行规则
      expect(indexHtml).toContain('.slide-content-wrapper:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title)')
      expect(indexHtml).toContain('.slide-content-wrapper:not(.layout-cover) .slides-page-first-heading-block:is(h1, h2, h3, h4, h5, h6, .slide-list-item-title)')
      // 2351 行强力覆盖规则
      expect(indexHtml).toContain('.slide-content-wrapper:not(.layout-cover) .slides-page-first-heading-block :is(h1, h2, h3, h4, h5, h6, .slide-list-item-title)')
    })

    it('slides-client/index.html 模板在封面页下绝不能打上 slides-page-first-heading-block 类', () => {
      expect(indexHtml).toContain("(bIdx === 0 && currentSlide.frontmatter?.layout !== 'cover') ? 'slides-page-first-heading-block' : ''")
      expect(indexHtml).not.toMatch(/:class="\[bIdx === 0 \? 'slides-page-first-heading-block' : ''/)
    })

    it('单文件导出 standalone-template-styles 规则必须排除封面页', () => {
      const standaloneCss = generateStandaloneExportStyles()
      expect(standaloneCss).toContain('[data-normalize-headings="true"] .slide-content:not(.layout-cover) .slides-page-first-heading-block')
    })

    it('PDF 导出 pdf-template-styles 规则必须排除封面页', () => {
      const pdfCss = generatePdfExportStyles()
      expect(pdfCss).toContain('[data-normalize-headings="true"] .pdf-slide:not(.layout-cover) .slides-page-first-heading-block')
    })

    it('演讲者控制台缩略图 SlidesPresenterThumbnail.scss 规则必须排除封面页', () => {
      expect(thumbnailScss).toContain('&[data-normalize-headings="true"] .slide-content:not(.layout-cover) .slides-page-first-heading-block')
    })
  })

  describe('4. 双向探活机制与握手死锁自愈 (HOST_PING)', () => {
    it('WebSandboxBridge 应提供 ping 方法并发送 HOST_PING 消息', () => {
      const bridge = new WebSandboxBridge()
      const mockPost = vi.fn()
      ;(bridge as any).iframe = { contentWindow: { postMessage: mockPost } }
      bridge.ping()
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'siyuan-slides-host',
          action: 'HOST_PING',
        }),
        '*',
      )
    })

    it('slides-client/index.html 必须响应 HOST_PING / PING 并回传 CLIENT_READY', () => {
      expect(indexHtml).toContain('case "HOST_PING":')
      expect(indexHtml).toContain('case "PING":')
      expect(indexHtml).toContain('action: "CLIENT_READY"')
    })

    it('SlidesPreviewTab 应在 onMounted 与 onSandboxIframeLoad 时触发 ping 探活', () => {
      expect(previewTabCode).toContain('sandboxBridge.ping()')
    })
  })

  describe('5. 深层嵌套子块光标联动与沙箱命中 (allBlockIds)', () => {
    it('CursorTracker 应完整索引 slide.allBlockIds 中的嵌套子块', () => {
      const tracker = new CursorTracker()
      tracker.setDocId('doc-root')
      tracker.updateSlidesIndex([
        {
          pageIndex: 1,
          startBlockId: 'doc-root',
          blocks: [{ id: 'block-top-1', type: 'p' }],
          allBlockIds: ['block-top-1', 'nested-list-item-1', 'nested-p-inside-list'],
        },
        {
          pageIndex: 2,
          startBlockId: 'divider-2',
          blocks: [{ id: 'block-top-2', type: 'p' }],
          allBlockIds: ['divider-2', 'block-top-2', 'nested-super-col-1', 'nested-super-col-2'],
        },
      ] as any)

      // 验证深层子块能正确匹配到其所在页码
      expect(tracker.getPageByBlockId('nested-list-item-1')).toBe(1)
      expect(tracker.getPageByBlockId('nested-p-inside-list')).toBe(1)
      expect(tracker.getPageByBlockId('nested-super-col-1')).toBe(2)
      expect(tracker.getPageByBlockId('nested-super-col-2')).toBe(2)
    })

    it('slides-client/index.html HIGHLIGHT_ELEMENT 必须支持匹配 allBlockIds', () => {
      expect(indexHtml).toContain('s.allBlockIds?.includes(data.payload.targetBlockId)')
    })
  })
})
