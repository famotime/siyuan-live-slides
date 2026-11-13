import { describe, expect, it, vi } from "vitest"
import {
  DocumentCompilerService,
  analyzeIndexContent,
  buildBlockTreeFromIndex,
} from "../src/compiler/document-compiler"
import type { ISiYuanBlockNode } from "../src/types/slides-protocol"

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

function makeDeps(indexRows: any[], orders: string[] = ["h1", "p1", "sb1", "c1", "c2"]) {
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
    getDocBlocksOrders: vi.fn(async () => orders),
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

  it("容器块应按 parent_id 挂载子节点；未提供文档序时退化为输入行序（仅老内核降级用）", () => {
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
    expect(fastDoc.slides.map((s) => s.rawMarkdown)).toEqual(
      slowDoc.slides.map((s) => s.rawMarkdown),
    )
    const fastMd = fastDoc.slides.map((s) => s.rawMarkdown).join("\n\n---\n\n")
    // 两栏内容均须存在
    expect(fastMd).toContain("左栏")
    expect(fastMd).toContain("右栏")
    expect(fastMd).toContain("正文一")
  })

  it("索引缺少实时顶层块（新增）时应按实时数据补齐，且不丢块、不退化为慢路径", async () => {
    // 模拟索引里还没有刚新增的 p1
    const staleRows = fullIndexRows().filter((row) => row.id !== "p1")
    const deps = makeDeps(staleRows)
    const doc = await new DocumentCompilerService(deps).compile(DOC)

    expect(doc.slides.map((s) => s.rawMarkdown).join("\n")).toContain("正文一")
    // 新增块为叶子段落，无需重建子树 → 仍只调用 1 次 getChildBlocks
    expect(deps.getChildBlocks).toHaveBeenCalledTimes(1)
  })
})

describe("P1-1：索引内容可用性判定（按子树精确处置，不做整体回退）", () => {
  it("全部一致时可用且无需修正", () => {
    const live = [{ id: "p1", type: "p", content: "同", markdown: "同" }]
    const rows = [{ id: "p1", type: "p", content: "同", markdown: "同" }]
    const decision = analyzeIndexContent(live, rows)
    expect(decision.usable).toBe(true)
    expect(decision.leafPatch.size).toBe(0)
    expect(decision.rebuildRoots).toEqual([])
  })

  it("叶子顶层块滞后时给出就地修正值", () => {
    const live = [{ id: "p1", type: "p", content: "新内容", markdown: "新内容" }]
    const rows = [{ id: "p1", type: "p", content: "旧内容", markdown: "旧内容" }]
    const decision = analyzeIndexContent(live, rows)
    expect(decision.usable).toBe(true)
    expect(decision.leafPatch.get("p1")).toEqual({ content: "新内容", markdown: "新内容" })
    expect(decision.rebuildRoots).toEqual([])
  })

  it("容器块滞后时只登记该子树为重建根，不整体判死", () => {
    const live = [
      { id: "l1", type: "l", content: "新列表", markdown: "新列表" },
      { id: "sb1", type: "s", content: "同", markdown: "同" },
    ]
    const rows = [
      { id: "l1", type: "l", content: "旧列表", markdown: "旧列表" },
      { id: "sb1", type: "s", content: "同", markdown: "同" },
    ]
    const decision = analyzeIndexContent(live, rows)
    expect(decision.usable).toBe(true)
    expect(decision.rebuildRoots).toEqual(["l1"])
  })

  it("索引缺少实时顶层块（新增）时不视为陈旧，交由调用方补齐", () => {
    const live = [{ id: "p1", type: "p", content: "新", markdown: "新" }]
    const decision = analyzeIndexContent(live, [{ id: "other", type: "p" }])
    expect(decision.usable).toBe(true)
    expect(decision.leafPatch.size).toBe(0)
    expect(decision.rebuildRoots).toEqual([])
  })

  it("索引完全没有行时判定为不可用", () => {
    const decision = analyzeIndexContent([{ id: "p1" }], [])
    expect(decision.usable).toBe(false)
  })
})

describe("P1-1：索引滞后时预览不得落后一步（回归）", () => {
  it("叶子块内容尚未落库时，应以实时内容渲染且仍走快速路径", async () => {
    // 实时顶层：p1 已是"新内容"；同时含一个内容一致（未滞后）的超级块容器
    // 索引行：p1 仍是"旧内容"（模拟 50ms 异步落库延迟），超级块及其子块一致
    const deps = {
      getBlockAttrs: vi.fn(async () => ({})),
      getChildBlocks: vi.fn(async (id: string) =>
        id === DOC
          ? [
              { id: "p1", type: "p", content: "新内容", markdown: "新内容" },
              { id: "sb1", type: "s", subType: "col", content: "", markdown: "" },
            ]
          : [],
      ),
      getDocBlocksOrders: vi.fn(async () => ["p1", "sb1", "c1", "c2"]),
      setBlockAttrs: vi.fn(async () => ({})),
      sql: vi.fn(async (query: string) => {
        if (query.includes("FROM blocks")) {
          return [
            { id: "p1", parent_id: DOC, root_id: DOC, type: "p", content: "旧内容", markdown: "旧内容", sort: 10 },
            { id: "sb1", parent_id: DOC, root_id: DOC, type: "s", subtype: "col", content: "", markdown: "", sort: 30 },
            { id: "c1", parent_id: "sb1", root_id: DOC, type: "p", content: "左栏", markdown: "左栏", sort: 10 },
            { id: "c2", parent_id: "sb1", root_id: DOC, type: "p", content: "右栏", markdown: "右栏", sort: 10 },
          ]
        }
        return []
      }),
      getBaseUrl: () => "http://localhost:6806",
      getInlineStyles: vi.fn(async () => null),
    }

    const doc = await new DocumentCompilerService(deps).compile(DOC)

    // 必须显示实时内容，而不是索引中的旧内容
    const md = doc.slides.map((s) => s.rawMarkdown).join("\n\n---\n\n")
    expect(md).toContain("新内容")
    expect(md).not.toContain("旧内容")
    // 容器子块取自索引 → 证明走的是快速路径（回退路径会为 sb1 再调一次 getChildBlocks）
    expect(md).toContain("左栏")
    expect(deps.getChildBlocks).toHaveBeenCalledTimes(1)
  })

  it("容器块内容滞后时只重建该子树，不应触发全文档逐容器遍历", async () => {
    // 两个顶层列表：l1 内容滞后（需重建），l2 与索引一致（无需重建）
    const live = [
      { id: "l1", type: "l", content: "新列表", markdown: "新列表" },
      { id: "l2", type: "l", content: "稳定列表", markdown: "稳定列表" },
    ]
    const rows = [
      { id: "l1", parent_id: DOC, root_id: DOC, type: "l", content: "旧列表", markdown: "旧列表" },
      { id: "li1", parent_id: "l1", root_id: DOC, type: "i", content: "旧项", markdown: "旧项" },
      { id: "l2", parent_id: DOC, root_id: DOC, type: "l", content: "稳定列表", markdown: "稳定列表" },
      { id: "li2", parent_id: "l2", root_id: DOC, type: "i", content: "稳定项", markdown: "稳定项" },
    ]
    const deps = {
      getBlockAttrs: vi.fn(async () => ({})),
      getChildBlocks: vi.fn(async (id: string) => {
        if (id === DOC) return live
        if (id === "l1") return [{ id: "li1", type: "i", content: "新项", markdown: "新项" }]
        if (id === "l2") return [{ id: "li2", type: "i", content: "稳定项", markdown: "稳定项" }]
        return []
      }),
      getDocBlocksOrders: vi.fn(async () => ["l1", "li1", "l2", "li2"]),
      setBlockAttrs: vi.fn(async () => ({})),
      sql: vi.fn(async (query: string) => (query.includes("FROM blocks") ? rows : [])),
      getBaseUrl: () => "http://localhost:6806",
      getInlineStyles: vi.fn(async () => null),
    }

    const doc = await new DocumentCompilerService(deps).compile(DOC)

    const md = doc.slides.map((s) => s.rawMarkdown).join("\n\n---\n\n")
    expect(md).toContain("新列表")
    expect(md).not.toContain("旧列表")
    // 只重建滞后的 l1 子树（含其内部列表项容器）；未滞后的 l2 子树不得被遍历
    const calledIds = deps.getChildBlocks.mock.calls.map((c) => c[0])
    expect(calledIds).toContain(DOC)
    expect(calledIds).toContain("l1")
    expect(calledIds).not.toContain("l2")
  })
})

describe("P1-1：超级块分栏顺序必须以实时文档序为准（回归：内容错位/编辑跳变）", () => {
  it("索引行序被打乱时，左中右三栏仍须按文档序渲染", async () => {
    // 模拟内核真实语义：sort 是块类型权重（heading=5、paragraph=10、superblock=30），
    // created 为秒级且可能相同，故 SQL 行序完全无法代表文档位置
    const rows = [
      { id: "sb1", parent_id: DOC, root_id: DOC, type: "s", subtype: "col", content: "", markdown: "", sort: 30, created: 100 },
      { id: "c2", parent_id: "sb1", root_id: DOC, type: "p", content: "右栏", markdown: "右栏", sort: 10, created: 100 },
      { id: "c1", parent_id: "sb1", root_id: DOC, type: "p", content: "左栏", markdown: "左栏", sort: 10, created: 100 },
      { id: "c3", parent_id: "sb1", root_id: DOC, type: "h", subtype: "h4", content: "中栏", markdown: "#### 中栏", sort: 5, created: 100 },
    ]
    const deps = {
      getBlockAttrs: vi.fn(async () => ({})),
      getChildBlocks: vi.fn(async (id: string) =>
        id === DOC ? [{ id: "sb1", type: "s", subType: "col", content: "", markdown: "" }] : [],
      ),
      // 权威文档序：superblock → 左 → 中 → 右
      getDocBlocksOrders: vi.fn(async () => ["sb1", "c1", "c3", "c2"]),
      setBlockAttrs: vi.fn(async () => ({})),
      sql: vi.fn(async (query: string) => (query.includes("FROM blocks") ? rows : [])),
      getBaseUrl: () => "http://localhost:6806",
      getInlineStyles: vi.fn(async () => null),
    }

    const doc = await new DocumentCompilerService(deps).compile(DOC)
    const md = doc.slides.map((s) => s.rawMarkdown).join("\n\n---\n\n")

    const left = md.indexOf("左栏")
    const middle = md.indexOf("中栏")
    const right = md.indexOf("右栏")
    expect(left).toBeGreaterThanOrEqual(0)
    expect(middle).toBeGreaterThan(left)
    expect(right).toBeGreaterThan(middle)
  })

  it("缺少实时文档序时应回退实时路径，不得按 SQL 行序渲染", async () => {
    const rows = [
      { id: "sb1", parent_id: DOC, root_id: DOC, type: "s", subtype: "col", content: "", markdown: "", sort: 30 },
      { id: "c2", parent_id: "sb1", root_id: DOC, type: "p", content: "右栏", markdown: "右栏", sort: 10 },
      { id: "c1", parent_id: "sb1", root_id: DOC, type: "p", content: "左栏", markdown: "左栏", sort: 10 },
    ]
    const deps = {
      getBlockAttrs: vi.fn(async () => ({})),
      getChildBlocks: vi.fn(async (id: string) => {
        if (id === DOC) return [{ id: "sb1", type: "s", subType: "col", content: "", markdown: "" }]
        if (id === "sb1") {
          return [
            { id: "c1", type: "p", content: "左栏", markdown: "左栏" },
            { id: "c2", type: "p", content: "右栏", markdown: "右栏" },
          ]
        }
        return []
      }),
      setBlockAttrs: vi.fn(async () => ({})),
      sql: vi.fn(async (query: string) => (query.includes("FROM blocks") ? rows : [])),
      getBaseUrl: () => "http://localhost:6806",
      getInlineStyles: vi.fn(async () => null),
    }

    const doc = await new DocumentCompilerService(deps).compile(DOC)
    const md = doc.slides.map((s) => s.rawMarkdown).join("\n\n---\n\n")
    expect(md.indexOf("左栏")).toBeLessThan(md.indexOf("右栏"))
    expect(deps.getChildBlocks.mock.calls.length).toBeGreaterThan(1)
  })
})
