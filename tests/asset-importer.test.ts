import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import {
  extractSlidesZip,
  rewritePresentationAssetPaths,
} from "../src/compiler/asset-importer"
import { parseSlidesPresentation } from "../src/compiler/slides-importer"

describe("Asset Importer Tests", () => {
  it("should extract entry slides.md, sub-pages and media assets from zip buffer", async () => {
    const zip = new JSZip()
    zip.file("slides.md", "# Main Slide\n\n![arch](/diagram.png)\n")
    zip.file("pages/sub.md", "# Sub Slide\n")
    zip.file("public/diagram.png", new Uint8Array([1, 2, 3, 4]))
    zip.file("assets/photo.jpg", new Uint8Array([5, 6, 7]))
    zip.file("README.md", "ignore me")

    const zipBuffer = await zip.generateAsync({ type: "uint8array" })
    const res = await extractSlidesZip(zipBuffer)

    expect(res.entryMarkdownPath).toBe("slides.md")
    expect(res.entryMarkdown).toContain("# Main Slide")
    expect(res.virtualFiles["pages/sub.md"]).toContain("# Sub Slide")

    expect(res.assets.length).toBe(2)
    const names = res.assets.map(a => a.fileName)
    expect(names).toContain("diagram.png")
    expect(names).toContain("photo.jpg")
  })

  it("should rewrite asset paths in markdown, HTML tags, and background attrs", () => {
    const md = `---
theme: default
background: /images/cover.png
---

# Slide 1

![Diagram](/images/diagram.png)

<img src="./assets/photo.jpg" width="200" />
`
    const parsed = parseSlidesPresentation(md)

    const assetMap = {
      "/images/cover.png": "assets/cover-sy2026.png",
      "/images/diagram.png": "assets/diagram-sy2026.png",
      "photo.jpg": "assets/photo-sy2026.jpg",
    }

    const rewritten = rewritePresentationAssetPaths(parsed, assetMap)

    // 检查背景属性
    expect(rewritten.docRootAttrs["custom-slides-background"]).toBe("assets/cover-sy2026.png")

    // 检查 Markdown 正文
    const s1 = rewritten.slides[0]
    expect(s1.rawMarkdown).toContain("![Diagram](assets/diagram-sy2026.png)")
    expect(s1.rawMarkdown).toContain('src="assets/photo-sy2026.jpg"')
    expect(rewritten.flattenedMarkdown).toContain("![Diagram](assets/diagram-sy2026.png)")
  })
})
