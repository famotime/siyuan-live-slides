import { describe, expect, it } from "vitest"
import { parseSuperBlockDom, parseSuperBlockAst } from "../src/ui/dock/useSuperBlockInspector"

describe("useSuperBlockInspector (超级块 DOM/AST 探测与比例计算)", () => {
  describe("parseSuperBlockDom (DOM 几何宽度与分栏比例解析)", () => {
    it("非 col 布局超级块应返回 null", () => {
      const mockEl = {
        getAttribute: (attr: string) => (attr === "data-sb-layout" ? "row" : null),
        querySelectorAll: () => [],
      } as any
      expect(parseSuperBlockDom(mockEl)).toBeNull()
    })

    it("子列数小于 2 时应返回 null", () => {
      const mockEl = {
        getAttribute: (attr: string) => (attr === "data-sb-layout" ? "col" : null),
        querySelectorAll: () => [{ getAttribute: () => "" }],
      } as any
      expect(parseSuperBlockDom(mockEl)).toBeNull()
    })

    it("无显式宽度时应均分比例", () => {
      const mockEl = {
        getAttribute: (attr: string) => (attr === "data-sb-layout" ? "col" : null),
        querySelectorAll: () => [
          { getAttribute: () => "" },
          { getAttribute: () => "" },
        ],
      } as any
      const res = parseSuperBlockDom(mockEl)
      expect(res).toBeTruthy()
      expect(res?.hasSuperBlock).toBe(true)
      expect(res?.colCount).toBe(2)
      expect(res?.ratio).toBe("1:1")
      expect(res?.isCustomWidth).toBe(false)
      expect(res?.recommendedLayout).toBe("cols-header")
    })

    it("50%:50% 显式宽度应解析为 1:1 比例", () => {
      const mockEl = {
        getAttribute: (attr: string) => (attr === "data-sb-layout" ? "col" : null),
        querySelectorAll: () => [
          { getAttribute: (attr: string) => (attr === "style" ? "width: 50%" : null) },
          { getAttribute: (attr: string) => (attr === "style" ? "width: 50%" : null) },
        ],
      } as any
      const res = parseSuperBlockDom(mockEl)
      expect(res?.ratio).toBe("1:1")
      expect(res?.isCustomWidth).toBe(true)
    })

    it("33%:67% 显式宽度应解析为 1:2 比例", () => {
      const mockEl = {
        getAttribute: (attr: string) => (attr === "data-sb-layout" ? "col" : null),
        querySelectorAll: () => [
          { getAttribute: (attr: string) => (attr === "style" ? "width: 33%" : null) },
          { getAttribute: (attr: string) => (attr === "style" ? "width: 67%" : null) },
        ],
      } as any
      const res = parseSuperBlockDom(mockEl)
      expect(res?.ratio).toBe("1:2")
    })

    it("3 栏等宽应解析为 1:1:1 比例", () => {
      const mockEl = {
        getAttribute: (attr: string) => (attr === "data-sb-layout" ? "col" : null),
        querySelectorAll: () => [
          { getAttribute: (attr: string) => (attr === "style" ? "calc(33.33% - 10px)" : null) },
          { getAttribute: (attr: string) => (attr === "style" ? "calc(33.33% - 10px)" : null) },
          { getAttribute: (attr: string) => (attr === "style" ? "calc(33.33% - 10px)" : null) },
        ],
      } as any
      const res = parseSuperBlockDom(mockEl)
      expect(res?.ratio).toBe("1:1:1")
    })
  })

  describe("parseSuperBlockAst (AST 回退解析)", () => {
    it("空 slide 或无 blocks 时返回 null", () => {
      expect(parseSuperBlockAst(null)).toBeNull()
      expect(parseSuperBlockAst({ blocks: [] })).toBeNull()
    })
  })
})
