import { computed, ref } from 'vue'
import { openTab, showMessage } from 'siyuan'
import {
  createDocWithMd,
  getChildBlocks,
  lsNotebooks,
  setBlockAttrs,
  upload,
} from '@/api'
import { extractSlidesZip, rewritePresentationAssetPaths } from '@/compiler/asset-importer'
import type { IExtractedAssetItem } from '@/compiler/asset-importer'
import type { IParsedSlidesPresentation } from '@/compiler/slides-importer'
import { parseSlidesPresentation } from '@/compiler/slides-importer'
import { ATTR_ELEM_SLOT } from '@/types/slides-protocol'

/**
 * 判断块是否为水平分割线 / 分页符
 */
export function isDividerBlock(b: any): boolean {
  if (!b) return false
  const t = String(b.type || '').toLowerCase()
  const md = String(b.markdown || '').trim()
  const c = String(b.content || '').trim()
  return (
    t === 'tb' ||
    t === 'thematic-break' ||
    t === 'nodethematicbreak' ||
    md === '---' ||
    md === '***' ||
    c === '---' ||
    c === '***'
  )
}

/**
 * 清洗文档标题，去除操作系统非法字符
 */
export function sanitizeDocTitle(title: string): string {
  const trimmed = title.trim() || 'Slidev 演示文稿'
  return trimmed.replace(/[\\/:*?"<>|]/g, '_')
}

/**
 * 为各页分割线回填 Page Attrs
 */
export async function backfillDividerAttributes(
  blocks: any[],
  slides: Array<{ pageAttrs: Record<string, string> }>,
  setAttrsFn = setBlockAttrs,
): Promise<number> {
  const dividerBlocks = blocks.filter(isDividerBlock)
  let updatedCount = 0

  if (dividerBlocks.length >= slides.length) {
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      const tbBlock = dividerBlocks[i]
      if (tbBlock && tbBlock.id && Object.keys(slide.pageAttrs || {}).length > 0) {
        await setAttrsFn(tbBlock.id, slide.pageAttrs)
        updatedCount++
      }
    }
  } else {
    // 容错降级：第 1 页属性保存在根节点，第 2 页及后续页绑定在对应的水平分割线上
    for (let i = 1; i < slides.length; i++) {
      const slide = slides[i]
      const tbBlock = dividerBlocks[i - 1]
      if (tbBlock && tbBlock.id && Object.keys(slide.pageAttrs || {}).length > 0) {
        await setAttrsFn(tbBlock.id, slide.pageAttrs)
        updatedCount++
      }
    }
  }

  return updatedCount
}

/**
 * 扫描各块并将 ::right:: 插槽标记之后的块自动持久化打上 custom-slides-slot="right" 块属性
 */
export async function backfillSlotAttributes(
  blocks: any[],
  setAttrsFn = setBlockAttrs,
): Promise<number> {
  let inRightSlot = false
  let updatedCount = 0

  for (const b of blocks) {
    if (isDividerBlock(b)) {
      inRightSlot = false
      continue
    }
    const text = (b.markdown || b.content || '').trim()
    if (text === '::right::' || text.startsWith('::right::')) {
      inRightSlot = true
      continue
    }
    if (inRightSlot && b.id) {
      await setAttrsFn(b.id, { [ATTR_ELEM_SLOT]: 'right' }).catch(() => {})
      updatedCount++
    }
  }

  return updatedCount
}

/**
 * 批量上传本地资产并重写演示模型中的引用路径
 */
export async function uploadAndRewriteAssets(
  presentation: IParsedSlidesPresentation,
  extractedAssets: IExtractedAssetItem[],
  uploadFn = upload,
): Promise<Record<string, string>> {
  const assetMap: Record<string, string> = {}
  if (!extractedAssets || extractedAssets.length === 0) return assetMap

  const filesToUpload: File[] = []
  for (const a of extractedAssets) {
    const fileObj = new File([a.data as any], a.fileName, { type: 'application/octet-stream' })
    filesToUpload.push(fileObj)
  }

  try {
    const uploadRes: any = await uploadFn('/data/assets', filesToUpload)
    if (uploadRes?.succMap) {
      for (const [origName, syPath] of Object.entries(uploadRes.succMap)) {
        assetMap[origName] = String(syPath)
      }
    }
  } catch (upErr) {
    console.warn('上传本地静态资产失败，保留原路径:', upErr)
  }

  if (Object.keys(assetMap).length > 0) {
    rewritePresentationAssetPaths(presentation, assetMap)
  }

  return assetMap
}

export interface ISlidesImportExecutionParams {
  presentation: IParsedSlidesPresentation
  notebookId: string
  docTitle: string
  extractedAssets?: IExtractedAssetItem[]
  uploadAssets?: boolean
  autoPreview?: boolean
  plugin?: any
  api?: {
    uploadFn?: typeof upload
    createDocFn?: typeof createDocWithMd
    setAttrsFn?: typeof setBlockAttrs
    getChildBlocksFn?: typeof getChildBlocks
    openTabFn?: typeof openTab
    showMessageFn?: typeof showMessage
  }
}

/**
 * 导入执行编排服务核心入口
 */
export async function executeSlidesImport(
  params: ISlidesImportExecutionParams,
): Promise<string> {
  const {
    presentation,
    notebookId,
    docTitle,
    extractedAssets = [],
    uploadAssets = true,
    autoPreview = true,
    plugin,
    api = {},
  } = params

  const uploadFn = api.uploadFn || upload
  const createDocFn = api.createDocFn || createDocWithMd
  const setAttrsFn = api.setAttrsFn || setBlockAttrs
  const getChildBlocksFn = api.getChildBlocksFn || getChildBlocks
  const openTabFn = api.openTabFn || openTab
  const showMessageFn = api.showMessageFn || showMessage

  // 1. 若有待上传资产且勾选了上传选项
  if (uploadAssets && extractedAssets.length > 0) {
    await uploadAndRewriteAssets(presentation, extractedAssets, uploadFn)
  }

  // 2. 在思源笔记创建新文档
  const safeTitle = sanitizeDocTitle(docTitle)
  const docPath = `/${safeTitle}`

  const newDocId: string = await createDocFn(
    notebookId,
    docPath,
    presentation.flattenedMarkdown,
  )

  if (!newDocId) {
    throw new Error('思源内核创建文档失败，未返回有效 DocumentId')
  }

  // 3. 设置文档根属性 (Doc Attrs 与第 1 页 Page Attrs 融合，确保第一页版式如 image-right、image 等完整持久化)
  const firstSlideAttrs = presentation.slides[0]?.pageAttrs || {}
  await setAttrsFn(newDocId, { ...firstSlideAttrs, ...presentation.docRootAttrs })

  // 4. 设置各页分割线属性与插槽属性
  const rawBlocks: any[] = await getChildBlocksFn(newDocId).catch(() => [])
  if (Array.isArray(rawBlocks) && rawBlocks.length > 0) {
    await backfillDividerAttributes(rawBlocks, presentation.slides, setAttrsFn)
    await backfillSlotAttributes(rawBlocks, setAttrsFn)
  }

  showMessageFn(`🎉 成功导入 Slidev 演示文档《${safeTitle}》！`)

  // 5. 沉浸式流转闭环：打开文档并在下方分屏放映
  if (autoPreview && plugin) {
    plugin.currentDocId = newDocId
    await openTabFn({
      app: plugin.app,
      doc: { id: newDocId },
    })
    if (plugin.openBottomPreviewTab) {
      plugin.openBottomPreviewTab()
    }
  }

  return newDocId
}

/**
 * Slidev 导入对话框组合式函数 (Composable)
 */
export function useSlidesImport(pluginInstance?: any) {
  const inputMode = ref<'file' | 'text'>('file')
  const isDragging = ref(false)
  const isImporting = ref(false)
  const errorMessage = ref('')

  const fileInputRef = ref<HTMLInputElement | null>(null)
  const selectedFile = ref<File | null>(null)
  const selectedFileName = ref('')
  const selectedFileSize = ref(0)
  const rawMarkdownText = ref('')

  const extractedAssets = ref<IExtractedAssetItem[]>([])
  const parsedPresentation = ref<IParsedSlidesPresentation | null>(null)

  const customDocTitle = ref('')
  const notebooks = ref<Array<{ id: string; name: string }>>([])
  const selectedNotebookId = ref('')

  // 选项开关
  const optCleanHtml = ref(true)
  const optStripNotes = ref(true)
  const optUploadAssets = ref(true)
  const optAutoPreview = ref(true)

  const formattedFileSize = computed(() => {
    const bytes = selectedFileSize.value
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / (k ** i)).toFixed(1)} ${sizes[i]}`
  })

  const currentTheme = computed(() => {
    return parsedPresentation.value?.docRootAttrs['custom-slides-theme'] || 'default'
  })

  const extractedAssetsCount = computed(() => {
    if (extractedAssets.value.length > 0) {
      return extractedAssets.value.length
    }
    return parsedPresentation.value?.stats.discoveredAssets.length || 0
  })

  const layoutChips = computed(() => {
    const dist = parsedPresentation.value?.stats.layoutDistribution || {}
    return Object.entries(dist).map(([name, count]) => ({ name, count }))
  })

  async function fetchNotebooks(lsNotebooksFn = lsNotebooks) {
    try {
      const nbRes: any = await lsNotebooksFn()
      if (nbRes?.notebooks && Array.isArray(nbRes.notebooks)) {
        notebooks.value = nbRes.notebooks.filter((n: any) => !n.closed)
        if (notebooks.value.length > 0 && !selectedNotebookId.value) {
          selectedNotebookId.value = notebooks.value[0].id
        }
      }
    } catch (e) {
      console.warn('获取笔记本列表失败:', e)
    }
  }

  function triggerFileInput() {
    fileInputRef.value?.click()
  }

  function clearFile() {
    selectedFile.value = null
    selectedFileName.value = ''
    selectedFileSize.value = 0
    parsedPresentation.value = null
    extractedAssets.value = []
    errorMessage.value = ''
  }

  async function processFile(file: File) {
    errorMessage.value = ''
    selectedFile.value = file
    selectedFileName.value = file.name
    selectedFileSize.value = file.size

    try {
      const isZip = file.name.toLowerCase().endsWith('.zip')
      if (isZip) {
        const buffer = await file.arrayBuffer()
        const zipRes = await extractSlidesZip(buffer)
        if (!zipRes.entryMarkdown) {
          errorMessage.value = '未在 Zip 压缩包中找到 slides.md 或任何有效的 Markdown 入口文件'
          return
        }
        extractedAssets.value = zipRes.assets
        const parsed = parseSlidesPresentation(zipRes.entryMarkdown, {
          stripNotesFromMarkdown: optStripNotes.value,
          cleanHtmlToMarkdown: optCleanHtml.value,
          cleanSlots: false,
          virtualFiles: zipRes.virtualFiles,
        })
        parsedPresentation.value = parsed
        customDocTitle.value = parsed.docTitle || file.name.replace(/\.zip$/i, '')
      } else {
        // .md 文件
        const text = await file.text()
        extractedAssets.value = []
        const filePath = (file as any).path || ''
        const baseDir = filePath ? filePath.replace(/[\\/][^\\/]+$/, '') : ''
        const parsed = parseSlidesPresentation(text, {
          stripNotesFromMarkdown: optStripNotes.value,
          cleanHtmlToMarkdown: optCleanHtml.value,
          cleanSlots: false,
          baseDir: baseDir || undefined,
        })
        parsedPresentation.value = parsed
        customDocTitle.value = parsed.docTitle || file.name.replace(/\.md$/i, '')
      }
    } catch (err: any) {
      console.error('解析文件失败:', err)
      errorMessage.value = `解析文件失败: ${err.message || String(err)}`
    }
  }

  function onTextChange() {
    errorMessage.value = ''
    if (!rawMarkdownText.value.trim()) {
      parsedPresentation.value = null
      return
    }
    try {
      const parsed = parseSlidesPresentation(rawMarkdownText.value, {
        stripNotesFromMarkdown: optStripNotes.value,
        cleanHtmlToMarkdown: optCleanHtml.value,
        cleanSlots: false,
      })
      parsedPresentation.value = parsed
      customDocTitle.value = parsed.docTitle || 'Slidev 演示文稿'
    } catch (err: any) {
      errorMessage.value = `解析 Markdown 源码失败: ${err.message || String(err)}`
    }
  }

  async function reprocessCurrentInput() {
    if (selectedFile.value) {
      await processFile(selectedFile.value)
    } else if (rawMarkdownText.value) {
      onTextChange()
    }
  }

  async function onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files && input.files[0]) {
      await processFile(input.files[0])
    }
  }

  async function onFileDrop(e: DragEvent) {
    isDragging.value = false
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0])
    }
  }

  async function handleConfirmImport(plugin = pluginInstance): Promise<string | undefined> {
    if (!parsedPresentation.value) return
    if (!selectedNotebookId.value && notebooks.value.length > 0) {
      selectedNotebookId.value = notebooks.value[0].id
    }
    if (!selectedNotebookId.value) {
      errorMessage.value = '请先选择目标笔记本'
      return
    }

    isImporting.value = true
    errorMessage.value = ''

    try {
      const newDocId = await executeSlidesImport({
        presentation: parsedPresentation.value,
        notebookId: selectedNotebookId.value,
        docTitle: customDocTitle.value,
        extractedAssets: extractedAssets.value,
        uploadAssets: optUploadAssets.value,
        autoPreview: optAutoPreview.value,
        plugin,
      })
      return newDocId
    } catch (err: any) {
      console.error('导入 Slidev 演示失败:', err)
      errorMessage.value = `导入执行失败: ${err.message || String(err)}`
    } finally {
      isImporting.value = false
    }
  }

  return {
    inputMode,
    isDragging,
    isImporting,
    errorMessage,
    fileInputRef,
    selectedFile,
    selectedFileName,
    selectedFileSize,
    rawMarkdownText,
    extractedAssets,
    parsedPresentation,
    customDocTitle,
    notebooks,
    selectedNotebookId,
    optCleanHtml,
    optStripNotes,
    optUploadAssets,
    optAutoPreview,
    formattedFileSize,
    currentTheme,
    extractedAssetsCount,
    layoutChips,
    fetchNotebooks,
    triggerFileInput,
    clearFile,
    processFile,
    onFileSelected,
    onFileDrop,
    onTextChange,
    reprocessCurrentInput,
    handleConfirmImport,
  }
}
