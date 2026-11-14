import { describe, expect, it, vi } from "vitest"
import { existsSync, readFileSync } from "fs"
import { dirname, resolve } from "path"
import {
  detectPresentationFormat,
  parseLiveSlidesMarkdown,
  backfillLiveSlidesAttributes,
  collectLocalAssetsForMarkdown,
} from "../src/compiler/live-slides-importer"
import {
  ATTR_PAGE_LAYOUT,
  ATTR_PAGE_TRANSITION,
  ATTR_PAGE_BACKGROUND,
  ATTR_ELEM_CLICK,
  ATTR_ELEM_MOTION,
  ATTR_ELEM_SHIKI_LINES,
  ATTR_ELEM_SLOT,
} from "../src/types/slides-protocol"

function getSampleDocPath(): string {
  const p1 = resolve(__dirname, "../docs/reference/即现插件介绍样例文档.md")
  if (existsSync(p1)) return p1
  return resolve(__dirname, "../docs/即现插件介绍样例文档.md")
}

describe("LiveSlidesImporter - 即现演示文档解析与属性剥离", () => {
  it("detectPresentationFormat 能够准确识别即现文档与 Slidev 文档", () => {
    expect(detectPresentationFormat("demo.md", "# Title\n{: custom-slides-layout=\"cover\" }")).toBe("live")
    expect(detectPresentationFormat("slides.md", "---\nlayout: cover\ntheme: seriph\n---")).toBe("slidev")
    expect(detectPresentationFormat("package.zip", "custom-slides-click=\"1\"")).toBe("live")
  })

  it("应成功解析实际的即现介绍样例文档，提取 20 页与各版式分布，并剥离正文 IAL", () => {
    const samplePath = getSampleDocPath()
    const rawMd = readFileSync(samplePath, "utf-8")

    const result = parseLiveSlidesMarkdown(rawMd)

    // 1. 验证幻灯片总页数
    expect(result.totalSlides).toBe(20)
    expect(result.formatType).toBe("live")
    expect(result.docTitle).toContain("即现")

    // 2. 验证第一页封面属性 (首块 IAL 提取)
    const page1 = result.slides[0]
    expect(page1.pageAttrs[ATTR_PAGE_LAYOUT]).toBe("cover")
    expect(page1.pageAttrs[ATTR_PAGE_TRANSITION]).toBe("fade")
    expect(page1.assetReferences.some(a => a.includes("stage.jpg"))).toBe(true)

    // 3. 验证第二页引言版式
    const page2 = result.slides[1]
    expect(page2.pageAttrs[ATTR_PAGE_LAYOUT]).toBe("quote")
    expect(page2.pageAttrs[ATTR_PAGE_TRANSITION]).toBe("slide-left")

    // 4. 验证第五页大字报版式
    const page5 = result.slides[4]
    expect(page5.pageAttrs[ATTR_PAGE_LAYOUT]).toBe("fact")

    // 5. 验证第六页表头四栏版式与插槽
    const page6 = result.slides[5]
    expect(page6.pageAttrs[ATTR_PAGE_LAYOUT]).toBe("cols-header")
    expect(result.stats.totalSlots).toBeGreaterThanOrEqual(4)

    // 6. 验证逐步呈现 (v-click) 与微动效 (motion) 提取
    expect(result.stats.totalVClicks).toBeGreaterThanOrEqual(4)
    const vClickBinding = result.blockAttrBindings.find(b => b.attrs[ATTR_ELEM_CLICK] === "+1")
    expect(vClickBinding).toBeDefined()
    expect(vClickBinding?.attrs[ATTR_ELEM_MOTION]).toBeDefined()

    // 7. 验证 Shiki 代码逐行聚光提取
    expect(result.stats.totalShikiHighlights).toBeGreaterThanOrEqual(1)
    const shikiBinding = result.blockAttrBindings.find(b => b.attrs[ATTR_ELEM_SHIKI_LINES] === "1-3|5-7|9-11")
    expect(shikiBinding).toBeDefined()

    // 8. 验证正文剥离：生成的 flattenedMarkdown 不再包含任何 {: custom-slides- 标记，且不包含备注 Callout
    expect(result.flattenedMarkdown).not.toContain("{: custom-slides-")
    expect(result.flattenedMarkdown).not.toContain("{:custom-slides-")
    expect(result.flattenedMarkdown).not.toContain("💡 演讲备注")
    expect(result.flattenedMarkdown).not.toContain("[!NOTE]")

    // 8.1 验证开头有且仅有一条前导分隔线 ---，且正文中间绝无连续重复的分隔线
    expect(result.flattenedMarkdown.startsWith("---")).toBe(true)
    expect(/---\s*\r?\n\s*---/.test(result.flattenedMarkdown)).toBe(false)

    // 9. 验证演讲者提词提取与页面属性注入
    expect(result.stats.totalNotes).toBeGreaterThan(0)
    expect(page1.notes).toContain("欢迎大家")
    expect(page1.pageAttrs["custom-slides-notes"]).toContain("欢迎大家")
  })

  it("collectLocalAssetsForMarkdown 能够正确识别并读取本地相对路径素材", () => {
    const samplePath = getSampleDocPath()
    const rawMd = readFileSync(samplePath, "utf-8")
    const assets = collectLocalAssetsForMarkdown(rawMd, dirname(samplePath))

    expect(assets.length).toBeGreaterThan(0)
    const stageAsset = assets.find(a => a.fileName === "stage.jpg")
    expect(stageAsset).toBeDefined()
    expect(stageAsset?.data.byteLength).toBeGreaterThan(1000)
  })

  it("backfillLiveSlidesAttributes 能够正确回填文档根属性、各页分割线属性与元素级属性", async () => {
    const rawMd = `# 演示标题
{: custom-slides-layout="cover" custom-slides-transition="fade" }

- 步骤一
{: custom-slides-click="+1" }

---
{: custom-slides-layout="two-cols" }

### 左栏内容
{: custom-slides-slot="left" }
`

    const parsed = parseLiveSlidesMarkdown(rawMd)
    const setAttrsMock = vi.fn().mockResolvedValue({})
    const getChildBlocksMock = vi.fn().mockImplementation(async (id: string) => {
      if (id === "doc-1") {
        return [
          { id: "h-1", type: "h", content: "演示标题" },
          { id: "l-1", type: "l", content: "" },
          { id: "tb-1", type: "tb", markdown: "---" },
          { id: "h-2", type: "h", content: "左栏内容" },
        ]
      }
      if (id === "l-1") {
        return [
          { id: "item-1", type: "i", content: "步骤一" },
        ]
      }
      return []
    })

    const { updatedCount, matchedBindings } = await backfillLiveSlidesAttributes("doc-1", parsed, {
      setAttrsFn: setAttrsMock,
      getChildBlocksFn: getChildBlocksMock,
    })

    expect(updatedCount).toBeGreaterThan(0)
    expect(matchedBindings).toBeGreaterThan(0)

    // 验证根文档设置了第一页属性
    expect(setAttrsMock).toHaveBeenCalledWith("doc-1", expect.objectContaining({
      "custom-slides-layout": "cover",
      "custom-slides-transition": "fade",
    }))

    // 验证分割线设置了第二页属性
    expect(setAttrsMock).toHaveBeenCalledWith("tb-1", expect.objectContaining({
      "custom-slides-layout": "two-cols",
    }))

    // 验证列表项设置了 v-click 属性
    expect(setAttrsMock).toHaveBeenCalledWith("item-1", expect.objectContaining({
      "custom-slides-click": "+1",
    }))
  })
})
