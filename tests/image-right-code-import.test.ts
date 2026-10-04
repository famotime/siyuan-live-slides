import { describe, expect, it } from 'vitest'
import { parseSlidevPresentation } from '../src/compiler/slidev-importer'
import { parsePageAttrs } from '../src/compiler/scope-mapper'
import { convertBlockToHtml, renderSlideBlocksToHtml } from '../src/export/markdown-renderer'
import { ATTR_PAGE_IMAGE, ATTR_PAGE_LAYOUT } from '../src/types/slidev-protocol'

const SAMPLE_SLIDE_MD = `---
layout: image-right
image: https://cover.sli.dev
---

# Code

Use code snippets and get the highlighting directly, and even types hover!

\`\`\`ts [filename-example.ts] {all|4|6|6-7|9|all} twoslash
// TwoSlash enables TypeScript hover information
// and errors in markdown code blocks
// More at https://shiki.style/packages/twoslash
import { computed, ref } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)

doubled.value = 2
\`\`\`

<arrow v-click="[4, 5]" x1="350" y1="310" x2="195" y2="342" color="#953" width="2" arrowSize="1" />

<!-- This allow you to embed external code blocks -->
<<< @/snippets/external.ts#snippet

<!-- Footer -->

[Learn more](https://sli.dev/features/line-highlighting)

<!-- Inline style -->
<style>
.footnotes-sep {
  @apply mt-5 opacity-10;
}
</style>
`

describe('image-right and Code Highlighting Import & Render Audit', () => {
  it('正确解析 image-right 布局与 image 属性', () => {
    const parsed = parseSlidevPresentation(SAMPLE_SLIDE_MD)
    expect(parsed.slides.length).toBe(1)
    const slide = parsed.slides[0]

    expect(slide.pageAttrs[ATTR_PAGE_LAYOUT]).toBe('image-right')
    expect(slide.pageAttrs[ATTR_PAGE_IMAGE]).toBe('https://cover.sli.dev')

    const { frontmatter } = parsePageAttrs(slide.pageAttrs)
    expect(frontmatter.layout).toBe('image-right')
    expect(frontmatter.image).toBe('https://cover.sli.dev')
  })

  it('导入时自动展开外部代码切片 <<< @/snippets/external.ts#snippet 为 TS 代码块', () => {
    const parsed = parseSlidevPresentation(SAMPLE_SLIDE_MD)
    const slide = parsed.slides[0]

    // 验证切片被展开为代码块
    expect(slide.rawMarkdown).toContain('```ts')
    expect(slide.rawMarkdown).toContain('export function emptyArray<T>(length: number)')
    expect(slide.rawMarkdown).not.toContain('<<< @/snippets/external.ts#snippet')
  })

  it('HTML 渲染器正确为 [filename-example.ts] 生成 code-filename 标签与 Twoslash 错误提示', () => {
    const codeBlockItem = {
      id: 'block-code-1',
      type: 'c',
      content: '```ts [filename-example.ts] {all|4|6|6-7|9|all} twoslash\nconst doubled = computed(() => count.value * 2)\ndoubled.value = 2\n```',
      rawMarkdown: '```ts [filename-example.ts] {all|4|6|6-7|9|all} twoslash\nconst doubled = computed(() => count.value * 2)\ndoubled.value = 2\n```',
    }

    const html = convertBlockToHtml(codeBlockItem, { highlight: true })
    expect(html).toContain('code-filename')
    expect(html).toContain('filename-example.ts')
    expect(html).toContain('twoslash-error-wavy')
    expect(html).toContain('Cannot assign to \'value\' because it is a read-only property')
    expect(html).toContain('token-keyword')
  })

  it('renderSlideBlocksToHtml 为 image-right 生成双列分栏与全屏右侧背景图', () => {
    const virtualSlide = {
      pageIndex: 1,
      startBlockId: 'block-0',
      frontmatter: {
        layout: 'image-right',
        image: 'https://cover.sli.dev',
      },
      notes: '',
      blocks: [
        { id: 'b1', type: 'h', content: '# Code', rawMarkdown: '# Code' },
      ],
      rawMarkdown: '# Code',
    }

    const html = renderSlideBlocksToHtml(virtualSlide)
    expect(html).toContain('layout-image-cols-grid')
    expect(html).toContain('pdf-image-col')
    expect(html).toContain('https://cover.sli.dev')
    expect(html).toContain('pdf-content-col')
    expect(html).toContain('Code')
  })

  it('highlightCode 保持单引号字符串原貌，不产生 &#039; 实体乱码', async () => {
    const { highlightCode } = await import('../src/export/markdown-renderer')
    const sampleLine = "import { computed, ref } from 'vue'"
    const highlighted = highlightCode(sampleLine)

    expect(highlighted).not.toContain('&#039;')
    expect(highlighted).toContain('<span class="token-string">\'vue\'</span>')
    expect(highlighted).toContain('<span class="token-keyword">import</span>')
    expect(highlighted).toContain('<span class="token-keyword">from</span>')
  })

  it('buildSlidevDocument 正确为第一页继承文档级/分割线头部配置中的 image 属性', async () => {
    const { buildSlidevDocument } = await import('../src/compiler/slidev-ast-builder')
    // 场景 1：仅文档根级设置了 layout 和 image
    const docAttrs = {
      'custom-slidev-layout': 'image-right',
      'custom-slidev-image': 'https://cover.sli.dev',
    }
    const blocks = [
      {
        id: 'heading-1',
        type: 'h',
        content: '# Code',
        markdown: '# Code',
        ial: {},
      },
    ]

    const doc = buildSlidevDocument('doc-1', docAttrs, blocks as any)
    expect(doc.slides.length).toBe(1)
    expect(doc.slides[0].frontmatter.layout).toBe('image-right')
    expect(doc.slides[0].frontmatter.image).toBe('https://cover.sli.dev')

    // 场景 2：文档开头带有分割线，但分割线只有 layout 没有单独设 image，应完整回退继承根级 image
    const blocksWithDivider = [
      {
        id: 'divider-1',
        type: 'tb',
        content: '---',
        markdown: '---',
        ial: { 'custom-slidev-layout': 'image-right' },
      },
      {
        id: 'heading-1',
        type: 'h',
        content: '# Code',
        markdown: '# Code',
        ial: {},
      },
    ]
    const doc2 = buildSlidevDocument('doc-2', docAttrs, blocksWithDivider as any)
    expect(doc2.slides.length).toBe(1)
    expect(doc2.slides[0].frontmatter.layout).toBe('image-right')
    expect(doc2.slides[0].frontmatter.image).toBe('https://cover.sli.dev')
  })

  it('buildStandaloneHtml 为 image-right 注入全尺寸网格样式与分栏容器', async () => {
    const { buildStandaloneHtml } = await import('../src/export/single-html-exporter')
    const docWithImageRight = {
      docId: 'doc-img-right',
      config: { theme: 'default', aspectRatio: '16/9', highlighter: 'shiki', defaultTransition: 'slide-left', colorSchema: 'auto' },
      slides: [
        {
          pageIndex: 1,
          startBlockId: 'b-start',
          frontmatter: { layout: 'image-right', image: 'https://cover.sli.dev' },
          notes: '',
          blocks: [{ id: 'b1', type: 'h', content: '# Code', rawMarkdown: '# Code' }],
          rawMarkdown: '# Code',
        },
      ],
      fullMarkdown: '# Code',
    }
    const html = buildStandaloneHtml(docWithImageRight as any)
    expect(html).toContain('.slide-content.layout-image-right')
    expect(html).toContain('image-right-img-container')
    expect(html).toContain('image-right-img')
    expect(html).toContain('image-right-content')
  })
})

