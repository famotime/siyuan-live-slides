import { describe, expect, it } from "vitest"
import fs from "fs"
import path from "path"
import {
  BlockAttrCache,
  InspectorSyncThrottle,
  buildCompiledIalIndex,
} from "../src/sync/inspector-sync-cache"
import type { ISlidevDocument } from "../src/types/slidev-protocol"

const PROJECT_ROOT = path.resolve(__dirname, "..")

describe("P1-2：块属性短 TTL 缓存", () => {
  it("TTL 内命中缓存，超时后失效并重新查询", () => {
    const cache = new BlockAttrCache(400)
    cache.set("b1", { "custom-slidev-layout": "cover" }, 1000)

    expect(cache.get("b1", 1200)).toEqual({ "custom-slidev-layout": "cover" })
    expect(cache.get("b1", 1400)).toEqual({ "custom-slidev-layout": "cover" })
    // 超出 TTL 窗口
    expect(cache.get("b1", 1401)).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it("未缓存的块返回 undefined，空 id 安全处理", () => {
    const cache = new BlockAttrCache()
    expect(cache.get("missing")).toBeUndefined()
    expect(cache.get("")).toBeUndefined()
    cache.set("", { a: "1" })
    expect(cache.size).toBe(0)
  })

  it("支持按块与整体失效（属性变更后立即失效）", () => {
    const cache = new BlockAttrCache()
    cache.set("b1", { a: "1" })
    cache.set("b2", { b: "2" })
    cache.invalidate("b1")
    expect(cache.get("b1")).toBeUndefined()
    expect(cache.get("b2")).toEqual({ b: "2" })

    cache.invalidate()
    expect(cache.size).toBe(0)
  })
})

describe("P1-2：编译模型 IAL 索引", () => {
  it("应收集幻灯片正文块与讲稿备注块的 IAL", () => {
    const doc = {
      slides: [
        {
          blocks: [{ id: "b1", ial: { "custom-slidev-layout": "cover" } }],
          noteBlocks: [{ id: "n1", ial: { "custom-slidev-note": "true" } }],
        },
        {
          blocks: [{ id: "b2", ial: { "custom-slidev-slot": "left" } }],
        },
      ],
    } as unknown as ISlidevDocument

    const index = buildCompiledIalIndex(doc)
    expect(index.get("b1")).toEqual({ "custom-slidev-layout": "cover" })
    expect(index.get("n1")).toEqual({ "custom-slidev-note": "true" })
    expect(index.get("b2")).toEqual({ "custom-slidev-slot": "left" })
    expect(index.size).toBe(3)
  })

  it("空文档与缺字段块应安全跳过", () => {
    expect(buildCompiledIalIndex(null).size).toBe(0)
    expect(buildCompiledIalIndex({ slides: [] } as unknown as ISlidevDocument).size).toBe(0)
    const index = buildCompiledIalIndex({
      slides: [{ blocks: [{ id: "b1" }, { ial: { a: "1" } } as any] }],
    } as unknown as ISlidevDocument)
    expect(index.size).toBe(0)
  })
})

describe("P1-2：光标联动同块节流", () => {
  it("同一块在时间窗内重复触发应跳过，超窗后恢复", () => {
    const throttle = new InspectorSyncThrottle(150)

    expect(throttle.shouldSkip("b1", 1000)).toBe(false)
    expect(throttle.shouldSkip("b1", 1050)).toBe(true)
    expect(throttle.shouldSkip("b1", 1149)).toBe(true)
    // 超出窗口
    expect(throttle.shouldSkip("b1", 1151)).toBe(false)
  })

  it("切换到其它块应立即同步，不受窗口限制（光标跨块联动无延迟）", () => {
    const throttle = new InspectorSyncThrottle(150)
    expect(throttle.shouldSkip("b1", 1000)).toBe(false)
    expect(throttle.shouldSkip("b2", 1001)).toBe(false)
    expect(throttle.shouldSkip("b1", 1002)).toBe(false)
  })

  it("reset 应清空节流状态（插件卸载场景）", () => {
    const throttle = new InspectorSyncThrottle(150)
    throttle.shouldSkip("b1", 1000)
    throttle.reset()
    expect(throttle.shouldSkip("b1", 1001)).toBe(false)
  })
})

describe("P1-2：内核往返收敛的接线契约", () => {
  const coordinatorSource = fs.readFileSync(
    path.join(PROJECT_ROOT, "src/sync/inspector-sync-coordinator.ts"),
    "utf-8",
  )
  const indexSource = fs.readFileSync(path.join(PROJECT_ROOT, "src/index.ts"), "utf-8")
  const compilerSource = fs.readFileSync(
    path.join(PROJECT_ROOT, "src/compiler/document-compiler.ts"),
    "utf-8",
  )

  it("协调器内只允许在属性解析器内部直接调用 getBlockAttrs", () => {
    // 其余 4 处调用点（主块/Callout/外层列表项/分页符）必须走内存优先解析
    const directCalls = coordinatorSource.match(/getBlockAttrs\(/g) || []
    expect(directCalls.length).toBe(1)
    expect(coordinatorSource).toContain("private async resolveBlockAttrs(")
    expect(coordinatorSource).toContain("globalDocumentCompiler.getBlockAttrOverride(id)")
    expect(coordinatorSource).toContain("this.attrCache.get(id)")
    expect(coordinatorSource).toContain("buildCompiledIalIndex(doc)")
  })

  it("插件应在光标联动入口启用同块节流，并在卸载时重置", () => {
    expect(indexSource).toContain("this.inspectorSyncThrottle.shouldSkip(blockId)")
    expect(indexSource).toContain("private inspectorSyncThrottle = new InspectorSyncThrottle()")
    expect(indexSource).toContain("this.inspectorSyncThrottle.reset()")
  })

  it("索引查询须使用内核真实列名 subtype 并携带 LIMIT 99999（突破 search.limit 截断）", () => {
    expect(compilerSource).toContain("SELECT id, parent_id, root_id, type, subtype, content, markdown, ial, sort, created FROM blocks")
    expect(compilerSource).toContain("LIMIT 99999")
    // 旧的错误列名 sub_type 不得残留（该降级查询此前恒被 .catch 吞掉而失效）
    expect(compilerSource).not.toContain("sub_type")
  })
})
