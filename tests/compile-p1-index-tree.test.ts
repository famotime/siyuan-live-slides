import { describe, expect, it, vi } from "vitest"
import {
  DocumentCompilerService,
  buildBlockTreeFromIndex,
} from "../src/compiler/document-compiler"
import type { ISiYuanBlockNode } from "../src/types/slidev-protocol"

const DOC = "doc-1"

/**
 * 完整索引行（模拟内核 blocks 表：列名为 subtype，且 parent_id 对标题下方的块会被覆写为标题）
 */
function fullIndexRows(): any[] {
  return [
    { id: "h1", parent_id: DOC, root_id: DOC, type: "h", subtype: "h1", content: "章节一", markdown: "# 章节一", sort: 1 },
    // 关键：处于标题下方的块，内核索引 parent_id 记为标题
    { id: "p1", parent_id: "h1", root_id: DOC, type: "p", content: "正文一", markdown: "正文一", sort: 2 },
    { id: "sb1", parent_id: DOC, root_id: DOC, type: "s", subtype: "col", content: "", markdown: "", sort: 3 },
    { id: "c1", parent_id: "sb1", root_id: DOC, type: "p", content: "左栏", markdown: "左栏", sort: 4 },
    { id: "c2", parent_id: "sb1", root_id: DOC, type: "p", content: "右栏", markdown: "右栏", sort: 5 },
  ]
}

/** 实时顶层块（getChildBlocks(docId) 语义：AST 直接子节点，标题下的块仍属顶层） */
function liveTopBlocks(): any[] {
  return [
    { id: "h1", type: "h", subType: "h1", content: "章节一", markdown: "# 章节一" },
    { id: "p1", type: "p", content: "正文一", markdown: "正文一" },
    { id: "sb1", type: "s", subType: "col", content: "", markdown: "" },
  ]
}

function makeDeps(indexRows: any[]) {
  const mockGetChildBlocks = vi.fn(async (id: string) => {
    if (id === DOC) return liveTopBlocks()
    if (id === "sb1") {
      return [
        { id: "c1", type: "p", content: "左栏", markdown: "左栏" },
        { id: "c2", type: "p", content: "右栏", markdown: "右栏" },
      ]
    }
    return []
  })
  const mockSql = vi.fn(async (query: string) => {
    if (query.includes("FROM blocks")) return indexRows
    return []
  })
  return {
    getBlockAttrs: vi.fn(async () => ({})),
    getChildBlocks: mockGetChildBlocks,
    setBlockAttrs: vi.fn(async () => ({})),
    sql: mockSql,
    getBaseUrl: () => "http://localhost:6806",
    getInlineStyles: vi.fn(async () => null),
  }
}

describe("P1-1：由内核索引行构建块树", () => {
  const resolveIal = (id: string, rowIal?: string) => (rowIal ? { raw: rowIal } : {})

  it("标题下方的块应沿标题父级上提，与 getChildBlocks 的层级语义保持一致", () => {
    const tree = buildBlockTreeFromIndex(DOC, fullIndexRows(), resolveIal)

    // p1 的 parent_id 指向标题 h1，但 getChildBlocks 不把标题当容器 → 应上提为顶层
    expect(tree.topLevel.map((n) => n.id)).toEqual(["h1", "p1", "sb1"])
    // 标题自身不承载子节点
    expect(tree.topLevel[0].children).toEqual([])
    expect(tree.byId.get("p1")?.id).toBe("p1")
  })

  it("容器块应按 parent_id 挂载子节点，并保留索引的行序", () => {
    const tree = buildBlockTreeFromIndex(DOC, fullIndexRows(), resolveIal)
    const superBlock = tree.byId.get("sb1")!
    expect(superBlock.children?.map((c) => c.id)).toEqual(["c1", "c2"])
  })

  it("应使用内核列名 subtype 映射为节点 subType（超级块分栏判定依赖该字段）", () => {
    const tree = buildBlockTreeFromIndex(DOC, fullIndexRows(), resolveIal)
    expect(tree.byId.get("sb1")?.subType).toBe("col")
    expect(tree.byId.get("h1")?.subType).toBe("h1")
  })

  it("非容器块（标题/段落/表格）不得挂载子节点，避免改变既有渲染结构", () => {
    const rows = [
      { id: "t1", parent_id: DOC, root_id: DOC, type: "t", subtype: "", content: "表格", markdown: "|a|", sort: 1 },
      { id: "tc1", parent_id: "t1", root_id: DOC, type: "tc", content: "单元格", markdown: "a", sort: 2 },
    ]
    const tree = buildBlockTreeFromIndex(DOC, rows, resolveIal)
    expect(tree.byId.get("t1")?.children).toEqual([])
    // 单元格因其父块非容器而不会成为顶层，故不出现在树中（与既有逐容器递归一致）
    expect(tree.byId.has("tc1")).toBe(false)
  })

  it("应遵守最大嵌套深度，避免异常层级导致无限递归", () => {
    const rows: any[] = []
    for (let i = 0; i < 12; i++) {
      rows.push({
        id: `s${i}`,
        parent_id: i === 0 ? DOC : `s${i - 1}`,
        root_id: DOC,
        type: "s",
        subtype: "col",
        content: "",
        markdown: "",
        sort: i,
      })
    }
    const tree = buildBlockTreeFromIndex(DOC, rows, resolveIal, 3)
    let depth = 0
    let cursor: ISiYuanBlockNode | undefined = tree.topLevel[0]
    while (cursor?.children?.length) {
      depth++
      cursor = cursor.children[0]
    }
    expect(depth).toBeLessThanOrEqual(3)
  })
})

describe("P1-1：快速路径与既有路径的等价性与 N+1 消除", () => {
  it("索引行完整时应走快速路径：getChildBlocks 仅调用 1 次（不再逐容器往返）", async () => {
    const deps = makeDeps(fullIndexRows())
    const doc = await new DocumentCompilerService(deps).compile(DOC)

    // 仅顶层查询 1 次内核调用，超级块子块来自索引行
    expect(deps.getChildBlocks).toHaveBeenCalledTimes(1)
    expect(deps.getChildBlocks).toHaveBeenCalledWith(DOC)
    expect(doc.slides.length).toBeGreaterThan(0)
  })

  it("索引行不完整时应回退到既有逐容器路径，内容不得缺失", async () => {
    const incomplete = fullIndexRows().map((row) => {
      const { type, ...rest } = row
      return rest
    })
    const deps = makeDeps(incomplete)
    const doc = await new DocumentCompilerService(deps).compile(DOC)

    // 顶层 + 逐容器补全
    expect(deps.getChildBlocks.mock.calls.length).toBeGreaterThan(1)
    expect(doc.slides.length).toBeGreaterThan(0)
  })

  it("两条路径对同一份文档应产出等价的演示模型", async () => {
    const fastDeps = makeDeps(fullIndexRows())
    const slowDeps = makeDeps(
      fullIndexRows().map((row) => {
        const { type, ...rest } = row
        return rest
      }),
    )

    const fastDoc = await new DocumentCompilerService(fastDeps).compile(DOC)
    const slowDoc = await new DocumentCompilerService(slowDeps).compile(DOC)

    expect(fastDoc.slides.length).toBe(slowDoc.slides.length)
    expect(fastDoc.slides.map((s) => s.frontmatter.layout)).toEqual(
      slowDoc.slides.map((s) => s.frontmatter.layout),
    )
    expect(fastDoc.fullMarkdown).toBe(slowDoc.fullMarkdown)
    // 两栏内容均须存在
    expect(fastDoc.fullMarkdown).toContain("左栏")
    expect(fastDoc.fullMarkdown).toContain("右栏")
    expect(fastDoc.fullMarkdown).toContain("正文一")
  })

  it("索引滞后（缺少实时顶层块）时应回退，不得丢块", async () => {
    // 模拟索引里还没有刚新增的 p1
    const staleRows = fullIndexRows().filter((row) => row.id !== "p1")
    const deps = makeDeps(staleRows)
    const doc = await new DocumentCompilerService(deps).compile(DOC)

    expect(deps.getChildBlocks.mock.calls.length).toBeGreaterThan(1)
    expect(doc.fullMarkdown).toContain("正文一")
  })
})
