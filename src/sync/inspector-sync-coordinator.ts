import { getBlockAttrs } from "@/api"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import {
  navigateDockToBlock,
  updateInspectorCurrentBlock,
} from "@/main"
import { purgeStaleDomSlidesAttrs as purgeStaleDomAttrs, syncDomBlockAttrs } from "@/sync/dom-attr-sync"
import { mirrorBlockSelection, clearBlockSelectionHighlight } from "@/sync/selection-mirror"
import { BlockAttrCache, buildCompiledIalIndex } from "@/sync/inspector-sync-cache"
import type { ISlidesDocument } from "@/types/slides-protocol"
import {
  ATTR_ELEM_NOTE,
  ATTR_ELEM_ROLE,
  ATTR_PAGE_LAYOUT,
  ATTR_ELEM_SLOT,
  ATTR_ELEM_CLICK,
} from "@/types/slides-protocol"

export class InspectorSyncCoordinator {
  private attrCache = new BlockAttrCache()
  private compiledIalIndex: { doc: ISlidesDocument | null; map: Map<string, Record<string, string>> } = {
    doc: null,
    map: new Map(),
  }
  private locatingLockUntil = 0
  private lockedTargetBlockId = ""
  private lastKnownPageDividerId = ""
  private lastKnownDocId = ""
  /** 光标联动代际号：多 await 解析期间有更新请求发起时，陈旧完成的回写被丢弃（P1-E3） */
  private inspectorSyncSeq = 0

  /**
   * 判定当前是否处于沙箱反向定位的平滑滚动锁定窗口中（FSM-2 缺陷修复：杜绝沿途 selectionchange 震荡回弹）
   */
  public isLocatingLocked(blockId?: string): boolean {
    if (Date.now() < this.locatingLockUntil) {
      if (blockId && blockId === this.lockedTargetBlockId) {
        return false // 目标块本身允许同步
      }
      return true // 沿途其他过渡块屏蔽同步
    }
    return false
  }

  /**
   * 解析块属性：即时覆盖层 → 编译模型 IAL → 带 TTL 的内核查询
   *
   * 光标联动（selectionchange）在敲字时逐字符触发，此前每次都会直接打内核；
   * 大文档下这会形成稳定的内核 CPU 背景负载。前两级均为内存命中，第三级合并短时间内的重复查询。
   */
  private async resolveBlockAttrs(
    id: string,
    latestCompiledDoc: ISlidesDocument | null,
  ): Promise<Record<string, string>> {
    if (!id) return {}
    const override = globalDocumentCompiler.getBlockAttrOverride(id)
    const compiled = this.getCompiledIal(latestCompiledDoc, id)

    if (override || compiled) {
      // 覆盖层优先级最高（属性变更经 ws 事务即时写入覆盖层）
      return { ...(compiled || {}), ...(override || {}) }
    }

    const cached = this.attrCache.get(id)
    if (cached) {
      return cached
    }

    const attrs = (await getBlockAttrs(id).catch(() => ({}))) || {}
    this.attrCache.set(id, attrs)
    return attrs
  }

  /** 从编译模型取块 IAL（同一文档对象只构建一次索引） */
  private getCompiledIal(
    doc: ISlidesDocument | null,
    id: string,
  ): Record<string, string> | undefined {
    if (!doc) return undefined
    if (this.compiledIalIndex.doc !== doc) {
      this.compiledIalIndex = { doc, map: buildCompiledIalIndex(doc) }
    }
    return this.compiledIalIndex.map.get(id)
  }

  /** 清空属性缓存（编译完成或卸载时调用） */
  public invalidateAttrCache(id?: string): void {
    this.attrCache.invalidate(id)
  }

  /**
   * 自动探测当前工作空间活跃主编辑区的文档 ID
   */
  public getActiveDocumentId(): string {
    if (typeof document === "undefined") return ""
    const activeTitle = (
      document.querySelector(".layout__wnd--active .protyle-title[data-node-id]") ||
      document.querySelector(".item--focus .protyle-title[data-node-id]") ||
      document.querySelector(".protyle-title[data-node-id]")
    ) as HTMLElement | null
    const titleDocId = activeTitle?.getAttribute("data-node-id")
    if (titleDocId) return titleDocId

    const protyleTitle = document.querySelector(".protyle .protyle-title[data-node-id]") as HTMLElement | null
    const innerDocId = protyleTitle?.getAttribute("data-node-id")
    if (innerDocId) return innerDocId

    const docEl = document.querySelector("[data-doc-id]") as HTMLElement | null
    const docId = docEl?.getAttribute("data-doc-id")
    if (docId) return docId

    return ""
  }

  /**
   * 从 DOM 元素解析所属文档的 rootId
   */
  public resolveDocIdFromElement(el: HTMLElement, currentDocId = ""): string {
    // 1. 尝试从文档标题容器提取其挂载的块 ID
    const titleEl = el.closest(".protyle-title") as HTMLElement | null
    const titleDocId = titleEl?.getAttribute("data-node-id")
    if (titleDocId) return titleDocId

    // 2. 尝试从当前元素所在的 .protyle 容器寻找子级 .protyle-title
    const protyle = el.closest(".protyle") as HTMLElement | null
    const innerTitle = protyle?.querySelector(".protyle-title") as HTMLElement | null
    const innerTitleId = innerTitle?.getAttribute("data-node-id")
    if (innerTitleId) return innerTitleId

    // 3. 查找带有 data-doc-id 的容器
    const docEl = el.closest("[data-doc-id]") as HTMLElement | null
    const anyDocId = docEl?.getAttribute("data-doc-id")
    if (anyDocId) return anyDocId

    // 4. 从全局主编辑区活跃标题提取
    const activeDocId = this.getActiveDocumentId()
    if (activeDocId) return activeDocId

    return currentDocId
  }

  /**
   * 切换右侧配置面板为全局文档演示配置模式
   */
  public async switchToDocGlobalInspector(docId: string, titleText?: string): Promise<void> {
    if (!docId) return

    let content = titleText || ""
    if (!content && typeof document !== "undefined") {
      const titleInput = (
        document.querySelector(`.protyle-title[data-node-id="${docId}"] .protyle-title__input`) ||
        document.querySelector(`.protyle[data-doc-id="${docId}"] .protyle-title__input`) ||
        document.querySelector(".protyle-title__input")
      ) as HTMLElement | null
      content = titleInput?.innerText?.trim() || ""
    }

    const attrs = await this.resolveBlockAttrs(docId, null)
    updateInspectorCurrentBlock({
      id: docId,
      rootId: docId,
      type: "doc",
      content,
      attrs,
      isDivider: false,
      isCode: false,
    })

    navigateDockToBlock(docId)
  }

  /**
   * 幻灯片点击回传，反向平滑定位到思源块并同步配置面板
   */
  public handleBlockClickedFromSlide(
    blockId: string,
    app: any,
    currentDocId: string,
    latestCompiledDoc: ISlidesDocument | null,
    page?: number,
  ): boolean {
    if (!blockId) {
      clearBlockSelectionHighlight()
      // 演示/预览界面取消高亮（再次点击同一对象 / 点击空白 / 按 Esc）
      // 保持思源编辑器现状不滚动，右侧配置面板退回当前页面的「幻灯片页面配置 (Page Inspector)」
      const targetPageIndex = typeof page === "number" && page > 0 ? page : 1
      const currentSlide = latestCompiledDoc?.slides?.[targetPageIndex - 1] || latestCompiledDoc?.slides?.[0]
      if (currentSlide) {
        const divId = currentSlide.startBlockId || ""
        const pageLayout = currentSlide.frontmatter?.layout || ""
        const initialAttrs: Record<string, string> = {
          "custom-slides-layout": pageLayout,
          ...(currentSlide.frontmatter as any),
        }
        updateInspectorCurrentBlock({
          id: divId,
          rootId: currentDocId,
          type: "NodeThematicBreak",
          attrs: initialAttrs,
          isDivider: true,
          isCode: false,
          isImage: false,
          pageDividerId: divId,
          pageDividerLayout: pageLayout,
        })
        void this.resolveBlockAttrs(divId, latestCompiledDoc).then(attrs => {
          if (attrs && Object.keys(attrs).length > 0) {
            updateInspectorCurrentBlock({
              id: divId,
              rootId: currentDocId,
              type: "NodeThematicBreak",
              attrs: { ...initialAttrs, ...attrs },
              isDivider: true,
              isCode: false,
              isImage: false,
              pageDividerId: divId,
              pageDividerLayout: pageLayout,
            })
          }
        })
        return true
      } else {
        void this.switchToDocGlobalInspector(currentDocId)
        return true
      }
    }

    // 1. 反向平滑定位并高亮目标思源块（带 openTab 降级）
    // FSM-2 缺陷修复：开启 500ms 定位锁定窗口，杜绝平滑滚动期间沿途 selectionchange 产生双向震荡回弹
    this.lockedTargetBlockId = blockId
    this.locatingLockUntil = Date.now() + 500
    const located = mirrorBlockSelection(blockId, app)

    // 2. 尝试从 DOM 或通过 API 获取块信息，同步右侧演示配置面板
    const blockEl = typeof document !== "undefined"
      ? ((document.querySelector(`.protyle-wysiwyg [data-node-id="${blockId}"]`) ||
          document.querySelector(`[data-node-id="${blockId}"]`)) as HTMLElement | null)
      : null

    const blockType = blockEl?.getAttribute("data-type") || ""
    if (blockEl) {
      this.syncInspectorBlock(blockEl, blockId, blockType, currentDocId, latestCompiledDoc)
    } else {
      let pageDividerId = ""
      let pageDividerLayout = ""
      if (latestCompiledDoc?.slides) {
        const matched = latestCompiledDoc.slides.find(s =>
          s.startBlockId === blockId ||
          s.blocks?.some(b => b.id === blockId) ||
          s.allBlockIds?.includes(blockId) ||
          s.noteBlocks?.some(b => b.id === blockId)
        )
        if (matched?.startBlockId) {
          pageDividerId = matched.startBlockId
        }
        if (matched?.frontmatter?.layout) {
          pageDividerLayout = matched.frontmatter.layout
        }
      }
      this.resolveBlockAttrs(blockId, latestCompiledDoc).then(async attrs => {
        if (pageDividerId && !pageDividerLayout) {
          const cachedOverride = globalDocumentCompiler.getBlockAttrOverride(pageDividerId)
          if (cachedOverride?.[ATTR_PAGE_LAYOUT] || cachedOverride?.["custom-slides-layout"]) {
            pageDividerLayout = cachedOverride[ATTR_PAGE_LAYOUT] || cachedOverride["custom-slides-layout"] || ""
          } else {
            const dividerAttrs = await this.resolveBlockAttrs(pageDividerId, latestCompiledDoc)
            pageDividerLayout = dividerAttrs[ATTR_PAGE_LAYOUT] || dividerAttrs["custom-slides-layout"] || ""
            if (dividerAttrs && Object.keys(dividerAttrs).length > 0) {
              globalDocumentCompiler.setBlockAttrOverride(pageDividerId, dividerAttrs)
            }
          }
        }
        updateInspectorCurrentBlock({
          id: blockId,
          rootId: currentDocId,
          type: blockType || "NodeParagraph",
          attrs: attrs || {},
          pageDividerId,
          pageDividerLayout,
        })
      }).catch(() => {})
    }

    return located
  }

  /**
   * 同步当前激活块元信息至右侧演示配置面板
   */
  public async syncInspectorBlock(
    blockEl: HTMLElement,
    blockId: string,
    blockType: string,
    currentDocId: string,
    latestCompiledDoc: ISlidesDocument | null,
  ): Promise<void> {
    // FSM-2 缺陷修复：处于反向平滑定位锁定时，屏蔽中间过渡块的同步
    if (this.isLocatingLocked(blockId)) {
      return
    }

    // P1-E3：登记本次联动代际，多处 await（内核属性解析）期间若发起新的联动，
    // 本轮陈旧完成不得覆写右侧配置面板
    const mySeq = ++this.inspectorSyncSeq

    let effectiveEl = blockEl
    let effectiveId = blockId
    let effectiveType = blockType

    // 智能识别 Callout 提示块容器：若当前选中的是提示块内部的段落等子元素，检查外层 Callout 是否属于讲稿备注
    const calloutEl = typeof blockEl?.closest === "function" ? (blockEl.closest('[data-type="NodeCallout"]') as HTMLElement | null) : null
    if (calloutEl && calloutEl !== blockEl) {
      const calloutId = calloutEl.getAttribute("data-node-id")
      if (calloutId) {
        const calloutAttrs = await this.resolveBlockAttrs(calloutId, latestCompiledDoc)
        const override = globalDocumentCompiler.getBlockAttrOverride(calloutId) || {}
        const mergedAttrs = { ...calloutAttrs, ...override }
        if (mergedAttrs[ATTR_ELEM_NOTE]) {
          effectiveEl = calloutEl
          effectiveId = calloutId
          effectiveType = "NodeCallout"
        }
      }
    }

    // 解析当前块所属顶层块 ID 以及其所归属的前置分页符 ID 与版式
    const topBlockEl = (effectiveEl.closest(".protyle-wysiwyg > [data-node-id]") || effectiveEl) as HTMLElement
    const topBlockId = topBlockEl?.getAttribute("data-node-id") || effectiveId

    const isDivider =
      effectiveType === "NodeThematicBreak" ||
      effectiveType === "tb" ||
      effectiveType === "thematic-break" ||
      topBlockEl?.getAttribute("data-type") === "NodeThematicBreak" ||
      topBlockEl?.getAttribute("data-type") === "tb" ||
      Boolean(topBlockEl?.classList?.contains("hr"))
    const isCode = effectiveType === "NodeCodeBlock"
    const contentText = effectiveEl.innerText?.trim() || ""
    const attrs = await this.resolveBlockAttrs(effectiveId, latestCompiledDoc)
    const override = globalDocumentCompiler.getBlockAttrOverride(effectiveId) || {}
    const finalAttrs = { ...attrs, ...override }

    let pageDividerId = ""
    let pageDividerLayout = ""

    if (isDivider) {
      // 当前激活块本身即为分页符 (---)，其开启并承载了分隔行下一页的页面配置与演讲备注
      pageDividerId = effectiveId
      pageDividerLayout = finalAttrs[ATTR_PAGE_LAYOUT] || finalAttrs["custom-slides-layout"] || ""
    } else {
      let prev = topBlockEl.previousElementSibling
      while (prev) {
        const pType = prev.getAttribute("data-type")
        if (pType === "NodeThematicBreak" || pType === "tb" || prev.classList?.contains("hr")) {
          pageDividerId = prev.getAttribute("data-node-id") || ""
          break
        }
        prev = prev.previousElementSibling
      }
    }

    // 容错降级：若 Protyle 虚拟滚动导致前置分页符已从 DOM 中卸载，
    // 则直接从最新编译的虚拟演示文档 (latestCompiledDoc) 中精准反查归属幻灯片及其 startBlockId 与 layout
    if (latestCompiledDoc?.slides) {
      const candidateIds = [effectiveId, topBlockId]
      let parentEl = effectiveEl.parentElement
      while (parentEl && !parentEl.classList.contains("protyle-wysiwyg")) {
        const nid = parentEl.getAttribute("data-node-id")
        if (nid && !candidateIds.includes(nid)) {
          candidateIds.push(nid)
        }
        parentEl = parentEl.parentElement
      }

      const matchedSlide = latestCompiledDoc.slides.find(s =>
        candidateIds.includes(s.startBlockId) ||
        s.blocks?.some(b => candidateIds.includes(b.id)) ||
        s.allBlockIds?.some(id => candidateIds.includes(id)) ||
        s.noteBlocks?.some(b => candidateIds.includes(b.id))
      )
      if (matchedSlide) {
        if (!pageDividerId && matchedSlide.startBlockId) {
          pageDividerId = matchedSlide.startBlockId
        }
        if (!pageDividerLayout && matchedSlide.frontmatter?.layout) {
          pageDividerLayout = matchedSlide.frontmatter.layout
        }
      }
    }

    // FSM-3 缺陷修复：若当前通过 DOM 或编译模型确定了分页符，记录为当前文档的最近已知有效分页符
    if (pageDividerId) {
      this.lastKnownDocId = currentDocId
      this.lastKnownPageDividerId = pageDividerId
    } else if (currentDocId && this.lastKnownDocId === currentDocId && this.lastKnownPageDividerId) {
      // 容错保护：若当前块位于长文档中且前置分页符因虚拟滚动已被卸载，未命中文档首页时安全继承上一已知有效分页符，杜绝局部版式错写至文档根
      const isTopElementAtOrigin = !topBlockEl.previousElementSibling && (topBlockEl.parentElement?.scrollTop || 0) === 0
      if (!isTopElementAtOrigin) {
        pageDividerId = this.lastKnownPageDividerId
      }
    }

    // 深度持久化回溯：若确定了前置分页符，查缓存、编译模型并直接调用思源内核 API 获取持久化属性
    if (pageDividerId) {
      const cachedOverride = globalDocumentCompiler.getBlockAttrOverride(pageDividerId)
      if (cachedOverride && (ATTR_PAGE_LAYOUT in cachedOverride || "custom-slides-layout" in cachedOverride)) {
        pageDividerLayout = cachedOverride[ATTR_PAGE_LAYOUT] || cachedOverride["custom-slides-layout"] || ""
      }
      if (!pageDividerLayout && latestCompiledDoc?.slides) {
        const matched = latestCompiledDoc.slides.find(s => s.startBlockId === pageDividerId)
        if (matched?.frontmatter?.layout) {
          pageDividerLayout = matched.frontmatter.layout
        }
      }
      if (!pageDividerLayout) {
        const dividerAttrs = await this.resolveBlockAttrs(pageDividerId, latestCompiledDoc)
        pageDividerLayout = dividerAttrs[ATTR_PAGE_LAYOUT] || dividerAttrs["custom-slides-layout"] || ""
        if (dividerAttrs && Object.keys(dividerAttrs).length > 0) {
          globalDocumentCompiler.setBlockAttrOverride(pageDividerId, dividerAttrs)
        }
      }
      syncDomBlockAttrs(pageDividerId, { [ATTR_PAGE_LAYOUT]: pageDividerLayout || "" })
    } else if (currentDocId) {
      // 若当前块位于首个分页符之前（即第 1 页），页面版式源自文档根属性
      const docOverride = globalDocumentCompiler.getBlockAttrOverride(currentDocId)
      if (docOverride && (ATTR_PAGE_LAYOUT in docOverride || "custom-slides-layout" in docOverride)) {
        pageDividerLayout = docOverride[ATTR_PAGE_LAYOUT] || docOverride["custom-slides-layout"] || ""
      } else if (!pageDividerLayout && latestCompiledDoc?.slides?.[0]?.frontmatter?.layout) {
        pageDividerLayout = latestCompiledDoc.slides[0].frontmatter.layout
      }
    }

    // 对齐当前激活块 DOM 属性与真实属性：若 DOM 上有残留属性但真实已无，立即清除
    const currentDomLayout = effectiveEl.getAttribute(ATTR_PAGE_LAYOUT) || effectiveEl.getAttribute("custom-slides-layout")
    const expectedLayout = finalAttrs[ATTR_PAGE_LAYOUT] || finalAttrs["custom-slides-layout"] || ""
    if (currentDomLayout && currentDomLayout !== expectedLayout) {
      syncDomBlockAttrs(effectiveId, { [ATTR_PAGE_LAYOUT]: expectedLayout })
    }
    const currentDomRole = effectiveEl.getAttribute(ATTR_ELEM_ROLE) || effectiveEl.getAttribute("custom-slides-role")
    const expectedRole = finalAttrs[ATTR_ELEM_ROLE] || finalAttrs["custom-slides-role"] || ""
    if (currentDomRole && currentDomRole !== expectedRole) {
      syncDomBlockAttrs(effectiveId, { [ATTR_ELEM_ROLE]: expectedRole })
    }

    let parentContainerId = ""
    let parentContainerSlot = ""
    let parentContainerClicks = ""

    // 针对列表项结构：若当前激活块位于列表项内部（如列表段落），检查并自愈外层 NodeListItem 容器的 DOM 属性
    const parentLiEl = effectiveEl.closest('[data-type="NodeListItem"]') as HTMLElement | null
    if (parentLiEl && parentLiEl !== effectiveEl) {
      const parentLiId = parentLiEl.getAttribute("data-node-id")
      if (parentLiId) {
        parentContainerId = parentLiId
        const parentAttrs = await this.resolveBlockAttrs(parentLiId, latestCompiledDoc)
        const parentOverride = globalDocumentCompiler.getBlockAttrOverride(parentLiId) || {}
        const parentFinalAttrs = { ...parentAttrs, ...parentOverride }
        parentContainerSlot = parentFinalAttrs[ATTR_ELEM_SLOT] || ""
        parentContainerClicks = parentFinalAttrs[ATTR_ELEM_CLICK] || ""

        const parentExpectedLayout = parentFinalAttrs[ATTR_PAGE_LAYOUT] || parentFinalAttrs["custom-slides-layout"] || ""
        const parentDomLayout = parentLiEl.getAttribute(ATTR_PAGE_LAYOUT) || parentLiEl.getAttribute("custom-slides-layout")
        if (parentDomLayout && parentDomLayout !== parentExpectedLayout) {
          syncDomBlockAttrs(parentLiId, { [ATTR_PAGE_LAYOUT]: parentExpectedLayout })
        }
        const parentExpectedRole = parentFinalAttrs[ATTR_ELEM_ROLE] || parentFinalAttrs["custom-slides-role"] || ""
        const parentDomRole = parentLiEl.getAttribute(ATTR_ELEM_ROLE) || parentLiEl.getAttribute("custom-slides-role")
        if (parentDomRole && parentDomRole !== parentExpectedRole) {
          syncDomBlockAttrs(parentLiId, { [ATTR_ELEM_ROLE]: parentExpectedRole })
        }
      }
    }

    const hasImgTag = Boolean(effectiveEl.querySelector("img, span[data-type='img']"))
    const textWithoutImg = (effectiveEl.innerText || "").replace(/[\r\n\t\s]+/g, " ").trim()
    const isImage = hasImgTag && textWithoutImg.length <= 50

    // 代际校验：解析期间有更新的联动请求发起，丢弃本轮陈旧结果
    if (mySeq !== this.inspectorSyncSeq) {
      return
    }

    updateInspectorCurrentBlock({
      id: effectiveId,
      rootId: currentDocId,
      type: effectiveType,
      content: contentText,
      attrs: finalAttrs,
      isDivider,
      isCode,
      isImage,
      topBlockId,
      pageDividerId,
      pageDividerLayout,
      parentContainerId,
      parentContainerSlot,
      parentContainerClicks,
    })
  }

  /**
   * 针对思源前端忽略 NodeThematicBreak updateAttrs 的底层缺陷进行防御性补丁同步
   */
  public patchThematicBreakTransactions(data: any): void {
    // 仅内容事务需要同步属性覆盖层；savedoc/progress/readystate 等高频非内容消息直接跳过，
    // 避免每次内核推送都做一轮 DOM 写入
    if (data?.cmd !== "transactions") {
      return
    }
    if (Array.isArray(data.data)) {
      for (const tx of data.data) {
        if (Array.isArray(tx?.doOperations)) {
          for (const op of tx.doOperations) {
            if (op?.action === "updateAttrs" && op.id && op.data) {
              const oldAttrs = op.data.old || {}
              const newAttrs = op.data.new || {}
              const diff: Record<string, string> = {}
              for (const k of Object.keys(oldAttrs)) {
                if (!(k in newAttrs)) {
                  diff[k] = ""
                }
              }
              for (const [k, v] of Object.entries(newAttrs)) {
                diff[k] = String(v ?? "")
              }
              syncDomBlockAttrs(op.id, diff)
              globalDocumentCompiler.setBlockAttrOverride(op.id, diff)
            }
          }
        }
      }
    }
  }

  /**
   * 收集编译模型与内存覆盖层中的所有合法版式与角色，巡检并清理 Protyle 编辑区中残留的幽灵 DOM 属性与角标
   */
  public purgeStaleDomSlidesAttrs(doc: ISlidesDocument): void {
    if (typeof document === "undefined" || !doc) return

    const validAttrsMap = new Map<string, Record<string, string>>()

    // 1. 收集各分页 startBlockId 的版式
    if (Array.isArray(doc.slides)) {
      for (const slide of doc.slides) {
        if (slide.startBlockId) {
          const m: Record<string, string> = validAttrsMap.get(slide.startBlockId) || {}
          if (slide.frontmatter?.layout) {
            m[ATTR_PAGE_LAYOUT] = slide.frontmatter.layout
          }
          validAttrsMap.set(slide.startBlockId, m)
        }
        // 收集各幻灯片内具有特定版式/角色的块
        if (Array.isArray(slide.blocks)) {
          for (const b of slide.blocks) {
            if (b.id) {
              const bm: Record<string, string> = validAttrsMap.get(b.id) || {}
              if (b.ial?.[ATTR_PAGE_LAYOUT]) {
                bm[ATTR_PAGE_LAYOUT] = b.ial[ATTR_PAGE_LAYOUT]
              }
              if (b.ial?.[ATTR_ELEM_ROLE]) {
                bm[ATTR_ELEM_ROLE] = b.ial[ATTR_ELEM_ROLE]
              }
              if (Object.keys(bm).length > 0) {
                validAttrsMap.set(b.id, bm)
              }
            }
          }
        }
      }
    }

    // 2. 合并当前所有内存即时覆盖层
    const allOverrides = globalDocumentCompiler.getAllAttrOverrides()
    for (const [id, override] of allOverrides.entries()) {
      const existing = validAttrsMap.get(id) || {}
      if (override[ATTR_PAGE_LAYOUT] !== undefined) {
        existing[ATTR_PAGE_LAYOUT] = override[ATTR_PAGE_LAYOUT]
      }
      if (override[ATTR_ELEM_ROLE] !== undefined) {
        existing[ATTR_ELEM_ROLE] = override[ATTR_ELEM_ROLE]
      }
      validAttrsMap.set(id, existing)
    }

    purgeStaleDomAttrs(validAttrsMap)
  }
}

export const globalInspectorSyncCoordinator = new InspectorSyncCoordinator()
