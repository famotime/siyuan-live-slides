import { describe, expect, it, vi } from 'vitest'
import {
  backfillDividerAttributes,
  backfillSlotAttributes,
  executeSlidesImport,
  isDividerBlock,
  sanitizeDocTitle,
  uploadAndRewriteAssets,
  useSlidesImport,
} from '@/ui/components/useSlidesImport'
import type { IParsedSlidesPresentation } from '@/compiler/slides-importer'

describe('useSlidesImport 业务逻辑与 Composable 测试', () => {
  describe('isDividerBlock (水平分割线识别)', () => {
    it('应正确识别各类思源水平分割线与 Markdown 分隔符', () => {
      expect(isDividerBlock({ type: 'tb' })).toBe(true)
      expect(isDividerBlock({ type: 'thematic-break' })).toBe(true)
      expect(isDividerBlock({ type: 'NodeThematicBreak' })).toBe(true)
      expect(isDividerBlock({ markdown: '---' })).toBe(true)
      expect(isDividerBlock({ markdown: '  ***  ' })).toBe(true)
      expect(isDividerBlock({ content: '---' })).toBe(true)
    })

    it('对普通段落、标题与空对象应返回 false', () => {
      expect(isDividerBlock(null)).toBe(false)
      expect(isDividerBlock(undefined)).toBe(false)
      expect(isDividerBlock({ type: 'p', content: '段落内容' })).toBe(false)
      expect(isDividerBlock({ type: 'h', markdown: '## 标题' })).toBe(false)
    })
  })

  describe('sanitizeDocTitle (标题非法字符清洗)', () => {
    it('应清洗文件名与路径非法字符并去除前后空格', () => {
      expect(sanitizeDocTitle('  My:Slide/Presentation*2026?  ')).toBe('My_Slide_Presentation_2026_')
      expect(sanitizeDocTitle('<Test>"Document"|Name')).toBe('_Test__Document__Name')
    })

    it('对空字符应回退为默认标题', () => {
      expect(sanitizeDocTitle('   ')).toBe('Slidev 演示文稿')
      expect(sanitizeDocTitle('')).toBe('Slidev 演示文稿')
    })
  })

  describe('backfillDividerAttributes (分割线属性回填)', () => {
    it('当分割线数量与幻灯片一致时，按索引一一绑定属性', async () => {
      const blocks = [
        { id: 'tb-0', type: 'tb' },
        { id: 'p-1', type: 'p' },
        { id: 'tb-1', type: 'tb' },
      ]
      const slides = [
        { pageAttrs: { 'custom-slides-layout': 'cover' } },
        { pageAttrs: { 'custom-slides-layout': 'two-cols' } },
      ]

      const setAttrsRecord: Record<string, any> = {}
      const setAttrsMock = vi.fn(async (id: string, attrs: any) => {
        setAttrsRecord[id] = attrs
      })

      const count = await backfillDividerAttributes(blocks, slides, setAttrsMock as any)
      expect(count).toBe(2)
      expect(setAttrsRecord['tb-0']).toEqual({ 'custom-slides-layout': 'cover' })
      expect(setAttrsRecord['tb-1']).toEqual({ 'custom-slides-layout': 'two-cols' })
    })

    it('当第 1 页无独立分割线时，降级从第 2 页开始绑定第 1 条分割线', async () => {
      const blocks = [
        { id: 'p-1', type: 'p' },
        { id: 'tb-1', type: 'tb' },
      ]
      const slides = [
        { pageAttrs: { 'custom-slides-layout': 'cover' } },
        { pageAttrs: { 'custom-slides-layout': 'image-right' } },
      ]

      const setAttrsRecord: Record<string, any> = {}
      const setAttrsMock = vi.fn(async (id: string, attrs: any) => {
        setAttrsRecord[id] = attrs
      })

      const count = await backfillDividerAttributes(blocks, slides, setAttrsMock as any)
      expect(count).toBe(1)
      expect(setAttrsRecord['tb-1']).toEqual({ 'custom-slides-layout': 'image-right' })
    })
  })

  describe('backfillSlotAttributes (插槽属性回填)', () => {
    it('应将 ::right:: 之后的块打上 custom-slides-slot="right" 并在遇到下一个分割线时重置', async () => {
      const blocks = [
        { id: 'p-left-1', type: 'p', content: '左侧内容' },
        { id: 'slot-marker', type: 'p', markdown: '::right::' },
        { id: 'p-right-1', type: 'p', content: '右侧内容 1' },
        { id: 'p-right-2', type: 'p', content: '右侧内容 2' },
        { id: 'tb-next', type: 'tb' },
        { id: 'p-next-page', type: 'p', content: '下一页普通段落' },
      ]

      const updatedMap: Record<string, any> = {}
      const setAttrsMock = vi.fn(async (id: string, attrs: any) => {
        updatedMap[id] = attrs
      })

      const count = await backfillSlotAttributes(blocks, setAttrsMock as any)
      expect(count).toBe(2)
      expect(updatedMap['p-right-1']).toEqual({ 'custom-slides-slot': 'right' })
      expect(updatedMap['p-right-2']).toEqual({ 'custom-slides-slot': 'right' })
      expect(updatedMap['p-next-page']).toBeUndefined()
    })
  })

  describe('executeSlidesImport (端到端导入编排服务)', () => {
    it('应完整协调创建文档、合并根属性、回填分割线与打开分屏', async () => {
      const mockPresentation: IParsedSlidesPresentation = {
        docTitle: '我的年度汇报',
        docRootAttrs: { 'custom-slides-theme': 'seriph' },
        slides: [
          {
            pageIndex: 1,
            pageAttrs: { 'custom-slides-layout': 'cover' },
            notes: '',
            rawMarkdown: '# 封面标题',
            hasVueComponent: false,
            hasStyleTag: false,
            assetReferences: [],
          },
          {
            pageIndex: 2,
            pageAttrs: { 'custom-slides-layout': 'two-cols' },
            notes: '',
            rawMarkdown: '## 内容页\n\n::right::\n\n右栏段落',
            hasVueComponent: false,
            hasStyleTag: false,
            assetReferences: [],
          },
        ],
        flattenedMarkdown: '# 封面标题\n\n---\n\n## 内容页\n\n::right::\n\n右栏段落',
        stats: {
          totalSlides: 2,
          layoutDistribution: { cover: 1, 'two-cols': 1 },
          discoveredAssets: [],
          totalNotes: 0,
        },
      }

      const mockBlocks = [
        { id: 'b-h1', type: 'h', content: '封面标题' },
        { id: 'b-tb1', type: 'tb' },
        { id: 'b-h2', type: 'h', content: '内容页' },
        { id: 'b-slot', type: 'p', markdown: '::right::' },
        { id: 'b-right-p', type: 'p', content: '右栏段落' },
      ]

      const setAttrsMap: Record<string, any> = {}
      const openTabMock = vi.fn()
      const showMsgMock = vi.fn()

      const fakePlugin = {
        app: {},
        currentDocId: '',
        openBottomPreviewTab: vi.fn(),
      }

      const docId = await executeSlidesImport({
        presentation: mockPresentation,
        notebookId: 'nb-123',
        docTitle: '我的年度汇报',
        extractedAssets: [],
        uploadAssets: false,
        autoPreview: true,
        plugin: fakePlugin,
        api: {
          createDocFn: async () => 'doc-new-456',
          setAttrsFn: async (id, attrs) => {
            setAttrsMap[id] = attrs
          },
          getChildBlocksFn: async () => mockBlocks,
          openTabFn: openTabMock,
          showMessageFn: showMsgMock,
        },
      })

      expect(docId).toBe('doc-new-456')
      // 验证文档根属性合并了第 1 页的 pageAttrs 和 docRootAttrs
      expect(setAttrsMap['doc-new-456']).toEqual({
        'custom-slides-layout': 'cover',
        'custom-slides-theme': 'seriph',
      })
      // 验证分割线绑定了第 2 页属性
      expect(setAttrsMap['b-tb1']).toEqual({
        'custom-slides-layout': 'two-cols',
      })
      // 验证右插槽块属性注入
      expect(setAttrsMap['b-right-p']).toEqual({
        'custom-slides-slot': 'right',
      })
      // 验证提示消息与自动分屏开启
      expect(showMsgMock).toHaveBeenCalledWith('🎉 成功导入 Slidev 演示文档《我的年度汇报》！')
      expect(openTabMock).toHaveBeenCalled()
      expect(fakePlugin.openBottomPreviewTab).toHaveBeenCalled()
      expect(fakePlugin.currentDocId).toBe('doc-new-456')
    })

    it('应在执行即现演示文档导入时正确调用即现属性回填并弹出成功提示', async () => {
      const mockLivePresentation: any = {
        formatType: 'live',
        docTitle: '即现产品演示',
        totalSlides: 2,
        docRootAttrs: {},
        flattenedMarkdown: '# 即现产品演示\n\n---\n\n## 第二页',
        slides: [
          { pageIndex: 1, pageAttrs: { 'custom-slides-layout': 'cover' }, notes: '', rawMarkdown: '# 即现产品演示', assetReferences: [] },
          { pageIndex: 2, pageAttrs: { 'custom-slides-layout': 'fact' }, notes: '', rawMarkdown: '## 第二页', assetReferences: [] },
        ],
        stats: { totalNotes: 0, totalVClicks: 0, totalShikiHighlights: 0, totalSlots: 0, discoveredAssets: [], layoutDistribution: { cover: 1, fact: 1 } },
        blockAttrBindings: [
          { pageIndex: 1, blockType: 'h', contentPreview: '即现产品演示', attrs: { 'custom-slides-layout': 'cover' }, isPageLevel: true },
          { pageIndex: 2, blockType: 'tb', contentPreview: '---', attrs: { 'custom-slides-layout': 'fact' }, isPageLevel: true },
        ],
      }

      const setAttrsMap: Record<string, any> = {}
      const setAttrsMock = vi.fn(async (id: string, attrs: any) => {
        setAttrsMap[id] = attrs
      })
      const createDocMock = vi.fn(async () => 'doc-live-999')
      const getChildBlocksMock = vi.fn(async () => [
        { id: 'b-h1', type: 'h', content: '即现产品演示' },
        { id: 'b-tb1', type: 'tb', markdown: '---' },
        { id: 'b-h2', type: 'h', content: '第二页' },
      ])
      const showMsgMock = vi.fn()
      const openTabMock = vi.fn()

      const fakePlugin = {
        app: {},
        currentDocId: '',
        openBottomPreviewTab: vi.fn(),
      }

      const resultDocId = await executeSlidesImport({
        presentation: mockLivePresentation,
        notebookId: 'nb-123',
        docTitle: '即现产品演示',
        autoPreview: true,
        plugin: fakePlugin,
        api: {
          createDocFn: createDocMock as any,
          setAttrsFn: setAttrsMock as any,
          getChildBlocksFn: getChildBlocksMock as any,
          showMessageFn: showMsgMock as any,
          openTabFn: openTabMock as any,
        },
      })

      expect(resultDocId).toBe('doc-live-999')
      expect(createDocMock).toHaveBeenCalledWith('nb-123', '/即现产品演示', mockLivePresentation.flattenedMarkdown)
      expect(setAttrsMap['doc-live-999']).toEqual({
        'custom-slides-layout': 'cover',
      })
      expect(setAttrsMap['b-tb1']).toEqual({
        'custom-slides-layout': 'fact',
      })
      expect(showMsgMock).toHaveBeenCalledWith('🎉 成功导入 即现 演示文档《即现产品演示》！')
      expect(openTabMock).toHaveBeenCalled()
      expect(fakePlugin.openBottomPreviewTab).toHaveBeenCalled()
    })
  })

  describe('useSlidesImport Composable 响应式状态管理', () => {
    it('应当正确初始化与更新输入状态，支持即现与 Slidev 格式区分', async () => {
      const composable = useSlidesImport()
      expect(composable.importType.value).toBe('live')
      expect(composable.isImporting.value).toBe(false)
      expect(composable.parsedPresentation.value).toBeNull()

      // 模拟加载即现 Markdown 文件
      const fakeLiveFile = new File([
        `# 即现演示\n{: custom-slides-layout="cover" }\n\n---\n{: custom-slides-layout="fact" }\n* 100%：纯净度\n`
      ], 'my-live-slides.md', { type: 'text/markdown' })

      await composable.processFile(fakeLiveFile)

      expect(composable.importType.value).toBe('live')
      expect(composable.parsedPresentation.value).not.toBeNull()
      expect(composable.parsedPresentation.value?.totalSlides).toBe(2)
      expect(composable.customDocTitle.value).toBe('即现演示')

      // 测试清理
      composable.clearFile()
      expect(composable.parsedPresentation.value).toBeNull()
      expect(composable.selectedFileName.value).toBe('')
    })
  })
})
