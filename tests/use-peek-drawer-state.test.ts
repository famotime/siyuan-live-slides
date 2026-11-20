import { describe, expect, it, vi } from "vitest"
import { usePeekDrawerState } from "../src/ui/tab/usePeekDrawerState"
import type { ISlidesDocument } from "../src/types/slides-protocol"

/**
 * usePeekDrawerState 领域测试
 *
 * 覆盖：速览抽屉双通道（思源块 / 网页）打开状态迁移、工作区跳转设置分支、
 * 文档块/页内块 SQL 探测回退、外链外跳、关闭抽屉与键盘冻结解除。
 */

function createHarness(overrides: Partial<{
  latestDoc: any
  enableWebServeJump: boolean
  webServeUrl: string
  detectDocBlock: (targetId: string) => Promise<boolean>
}> = {}) {
  const freezeKeyboardNav = vi.fn()
  const sandboxBridge = { freezeKeyboardNav } as any
  const openExternalUrl = vi.fn()
  const drawer = usePeekDrawerState({
    sandboxBridge,
    getLatestDoc: () => (overrides.latestDoc ?? null) as ISlidesDocument | null,
    getSettings: () => ({
      enableWebServeJump: overrides.enableWebServeJump ?? false,
      webServeUrl: overrides.webServeUrl ?? "http://127.0.0.1:6806",
    }) as any,
    buildWebUrl: (base: string, target: string, opts: any) => `${base}/blocks?id=${target}&focus=${opts?.focus ? 1 : 0}`,
    resolveUrl: (target: string) =>
      target.startsWith("http") ? { url: target, external: false } : { url: "", external: true },
    detectDocBlock: overrides.detectDocBlock ?? (async () => true),
    openExternalUrl,
  })
  return { drawer, freezeKeyboardNav, openExternalUrl }
}

describe("usePeekDrawerState (速览抽屉状态机)", () => {
  describe("思源块通道", () => {
    it("webServeJump 关闭时应保持 siyuan 类型并展示块速览标题", () => {
      const { drawer, freezeKeyboardNav } = createHarness({})
      drawer.handleOpenPeekDrawer({ peekType: "siyuan", target: "20240101120000-abcdef12", title: "" })
      expect(drawer.peekType.value).toBe("siyuan")
      expect(drawer.peekBlockId.value).toBe("20240101120000-abcdef12")
      expect(drawer.drawerTitle.value).toBe("块速览: 20240101")
      expect(drawer.isDrawerOpen.value).toBe(true)
      expect(freezeKeyboardNav).toHaveBeenCalledWith(true)
    })

    it("detail 自带标题时应优先使用", () => {
      const { drawer } = createHarness({})
      drawer.handleOpenPeekDrawer({ peekType: "siyuan", target: "20240101120000-abcdef12", title: "自定义标题" })
      expect(drawer.drawerTitle.value).toBe("自定义标题")
    })
  })

  describe("工作区网页跳转通道 (siyuan + enableWebServeJump)", () => {
    it("目标即当前文档时应按『思源文档』跳转且不追加 focus 参数", async () => {
      const { drawer } = createHarness({
        latestDoc: { docId: "20240101120000-abcdef12" },
        enableWebServeJump: true,
      })
      await drawer.handleOpenPeekDrawer({ peekType: "siyuan", target: "20240101120000-abcdef12", title: "" })
      expect(drawer.peekType.value).toBe("web")
      expect(drawer.hasOpenedWeb.value).toBe(true)
      expect(drawer.peekUrl.value).toBe("http://127.0.0.1:6806/blocks?id=20240101120000-abcdef12&focus=0")
      expect(drawer.drawerTitle.value).toBe("思源文档: 20240101")
      expect(drawer.isDrawerOpen.value).toBe(true)
    })

    it("目标为当前文档页内块时应按『思源块』跳转并追加 focus 参数", async () => {
      const { drawer } = createHarness({
        latestDoc: {
          docId: "root-1",
          slides: [{ blocks: [{ id: "child-9" }] }],
        },
        enableWebServeJump: true,
      })
      await drawer.handleOpenPeekDrawer({ peekType: "siyuan", target: "child-9", title: "" })
      expect(drawer.peekUrl.value).toContain("focus=1")
      expect(drawer.drawerTitle.value).toBe("思源块: child-9")
    })

    it("目标不在当前文档时应回退 SQL 探测判定 focus 与标题形态", async () => {
      const isDocProbe = vi.fn(async () => true)
      const { drawer } = createHarness({ latestDoc: { docId: "root-1", slides: [] }, enableWebServeJump: true, detectDocBlock: isDocProbe })
      await drawer.handleOpenPeekDrawer({ peekType: "siyuan", target: "other-doc", title: "" })
      expect(isDocProbe).toHaveBeenCalledWith("other-doc")
      expect(drawer.drawerTitle.value).toBe("思源文档: other-do")

      const blockProbe = vi.fn(async () => false)
      const { drawer: drawer2 } = createHarness({ latestDoc: { docId: "root-1", slides: [] }, enableWebServeJump: true, detectDocBlock: blockProbe })
      await drawer2.handleOpenPeekDrawer({ peekType: "siyuan", target: "plain-block", title: "" })
      expect(drawer2.drawerTitle.value).toBe("思源块: plain-bl")
    })
  })

  describe("网页链接通道", () => {
    it("工作区内可伺服地址应直接进入 web 抽屉", () => {
      const { drawer } = createHarness({})
      drawer.handleOpenPeekDrawer({ peekType: "web", target: "https://example.com/page", title: "" })
      expect(drawer.peekType.value).toBe("web")
      expect(drawer.peekUrl.value).toBe("https://example.com/page")
      expect(drawer.drawerTitle.value).toBe("https://example.com/page")
      expect(drawer.isDrawerOpen.value).toBe(true)
      expect(drawer.hasOpenedWeb.value).toBe(true)
    })

    it("外链地址应外跳系统浏览器且不打开抽屉", () => {
      const { drawer, openExternalUrl, freezeKeyboardNav } = createHarness({})
      drawer.handleOpenPeekDrawer({ peekType: "web", target: "D:\\local\\file.html", title: "" })
      expect(openExternalUrl).toHaveBeenCalledWith("D:\\local\\file.html")
      expect(drawer.isDrawerOpen.value).toBe(false)
      expect(freezeKeyboardNav).not.toHaveBeenCalled()
    })
  })

  describe("closeDrawer (关闭抽屉)", () => {
    it("应关闭抽屉并解除键盘冻结", () => {
      const { drawer, freezeKeyboardNav } = createHarness({})
      drawer.handleOpenPeekDrawer({ peekType: "siyuan", target: "b-1", title: "" })
      expect(drawer.isDrawerOpen.value).toBe(true)
      drawer.closeDrawer()
      expect(drawer.isDrawerOpen.value).toBe(false)
      expect(freezeKeyboardNav).toHaveBeenLastCalledWith(false)
    })
  })
})
