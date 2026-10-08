import { getBlockAttrs } from "@/api"
import { globalDocumentCompiler } from "@/compiler/document-compiler"
import {
  navigateDockToBlock,
  updateInspectorCurrentBlock,
} from "@/main"
import { purgeStaleDomSlidevAttrs as purgeStaleDomAttrs, syncDomBlockAttrs } from "@/sync/dom-attr-sync"
import { mirrorBlockSelection } from "@/sync/selection-mirror"
import type { ISlidevDocument } from "@/types/slidev-protocol"
import {
  ATTR_ELEM_NOTE,
  ATTR_ELEM_ROLE,
  ATTR_PAGE_LAYOUT,
  ATTR_ELEM_SLOT,
  ATTR_ELEM_CLICK,
} from "@/types/slidev-protocol"

export class InspectorSyncCoordinator {
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

    const attrs = await getBlockAttrs(docId).catch(() => ({}))
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
    latestCompiledDoc: ISlidevDocument | null,
  ): boolean {
    if (!blockId) return false

    // 1. 反向平滑定位并高亮目标思源块（带 openTab 降级）
    const located = mirrorBlockSelection(blockId, app)

    // 2. 尝试从 DOM 或通过 API 获取块信息，同步右侧演示配置面板
    const blockEl = (document.querySelector(`.protyle-wysiwyg [data-node-id="${blockId}"]`) ||
      document.querySelector(`[data-node-id="${blockId}"]`)) as HTMLElement | null

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
      getBlockAttrs(blockId).then(async attrs => {
        if (pageDividerId && !pageDividerLayout) {
          const cachedOverride = globalDocumentCompiler.getBlockAttrOverride(pageDividerId)
          if (cachedOverride?.[ATTR_PAGE_LAYOUT] || cachedOverride?.["custom-slidev-layout"]) {
            pageDividerLayout = cachedOverride[ATTR_PAGE_LAYOUT] || cachedOverride["custom-slidev-layout"] || ""
          } else {
            const dividerAttrs = (await getBlockAttrs(pageDividerId).catch(() => ({}))) || {}
            pageDividerLayout = dividerAttrs[ATTR_PAGE_LAYOUT] || dividerAttrs["custom-slidev-layout"] || ""
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
    latestCompiledDoc: ISlidevDocument | null,
  ): Promise<void> {
    let effectiveEl = blockEl
    let effectiveId = blockId
    let effectiveType = blockType

    // 智能识别 Callout 提示块容器：若当前选中的是提示块内部的段落等子元素，检查外层 Callout 是否属于讲稿备注
    const calloutEl = blockEl.closest('[data-type="NodeCallout"]') as HTMLElement | null
    if (calloutEl && calloutEl !== blockEl) {
      const calloutId = calloutEl.getAttribute("data-node-id")
      if (calloutId) {
        const calloutAttrs = (await getBlockAttrs(calloutId).catch(() => ({}))) || {}
        const override = globalDocumentCompiler.getBlockAttrOverride(calloutId) || {}
        const mergedAttrs = { ...calloutAttrs, ...override }
        if (mergedAttrs[ATTR_ELEM_NOTE] || mergedAttrs["slidev-note"]) {
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
    const attrs = (await getBlockAttrs(effectiveId).catch(() => ({}))) || {}
    const override = globalDocumentCompiler.getBlockAttrOverride(effectiveId) || {}
    const finalAttrs = { ...attrs, ...override }

    let pageDividerId = ""
    let pageDividerLayout = ""

    if (isDivider) {
      // 当前激活块本身即为分页符 (---)，其开启并承载了分隔行下一页的页面配置与演讲备注
      pageDividerId = effectiveId
      pageDividerLayout = finalAttrs[ATTR_PAGE_LAYOUT] || finalAttrs["custom-slidev-layout"] || ""
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

    // 深度持久化回溯：若确定了前置分页符，查缓存、编译模型并直接调用思源内核 API 获取持久化属性
    if (pageDividerId) {
      const cachedOverride = globalDocumentCompiler.getBlockAttrOverride(pageDividerId)
      if (cachedOverride && (ATTR_PAGE_LAYOUT in cachedOverride || "custom-slidev-layout" in cachedOverride)) {
        pageDividerLayout = cachedOverride[ATTR_PAGE_LAYOUT] || cachedOverride["custom-slidev-layout"] || ""
      }
      if (!pageDividerLayout && latestCompiledDoc?.slides) {
        const matched = latestCompiledDoc.slides.find(s => s.startBlockId === pageDividerId)
        if (matched?.frontmatter?.layout) {
          pageDividerLayout = matched.frontmatter.layout
        }
      }
      if (!pageDividerLayout) {
        const dividerAttrs = (await getBlockAttrs(pageDividerId).catch(() => ({}))) || {}
        pageDividerLayout = dividerAttrs[ATTR_PAGE_LAYOUT] || dividerAttrs["custom-slidev-layout"] || ""
        if (dividerAttrs && Object.keys(dividerAttrs).length > 0) {
          globalDocumentCompiler.setBlockAttrOverride(pageDividerId, dividerAttrs)
        }
      }
      syncDomBlockAttrs(pageDividerId, { [ATTR_PAGE_LAYOUT]: pageDividerLayout || "" })
    } else if (currentDocId) {
      // 若当前块位于首个分页符之前（即第 1 页），页面版式源自文档根属性
      const docOverride = globalDocumentCompiler.getBlockAttrOverride(currentDocId)
      if (docOverride && (ATTR_PAGE_LAYOUT in docOverride || "custom-slidev-layout" in docOverride)) {
        pageDividerLayout = docOverride[ATTR_PAGE_LAYOUT] || docOverride["custom-slidev-layout"] || ""
      } else if (!pageDividerLayout && latestCompiledDoc?.slides?.[0]?.frontmatter?.layout) {
        pageDividerLayout = latestCompiledDoc.slides[0].frontmatter.layout
      }
    }

    // 对齐当前激活块 DOM 属性与真实属性：若 DOM 上有残留属性但真实已无，立即清除
    const currentDomLayout = effectiveEl.getAttribute(ATTR_PAGE_LAYOUT) || effectiveEl.getAttribute("custom-slidev-layout")
    const expectedLayout = finalAttrs[ATTR_PAGE_LAYOUT] || finalAttrs["custom-slidev-layout"] || ""
    if (currentDomLayout && currentDomLayout !== expectedLayout) {
      syncDomBlockAttrs(effectiveId, { [ATTR_PAGE_LAYOUT]: expectedLayout })
    }
    const currentDomRole = effectiveEl.getAttribute(ATTR_ELEM_ROLE) || effectiveEl.getAttribute("custom-slidev-role")
    const expectedRole = finalAttrs[ATTR_ELEM_ROLE] || finalAttrs["custom-slidev-role"] || ""
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
        const parentAttrs = (await getBlockAttrs(parentLiId).catch(() => ({}))) || {}
        const parentOverride = globalDocumentCompiler.getBlockAttrOverride(parentLiId) || {}
        const parentFinalAttrs = { ...parentAttrs, ...parentOverride }
        parentContainerSlot = parentFinalAttrs[ATTR_ELEM_SLOT] || ""
        parentContainerClicks = parentFinalAttrs[ATTR_ELEM_CLICK] || ""

        const parentExpectedLayout = parentFinalAttrs[ATTR_PAGE_LAYOUT] || parentFinalAttrs["custom-slidev-layout"] || ""
        const parentDomLayout = parentLiEl.getAttribute(ATTR_PAGE_LAYOUT) || parentLiEl.getAttribute("custom-slidev-layout")
        if (parentDomLayout && parentDomLayout !== parentExpectedLayout) {
          syncDomBlockAttrs(parentLiId, { [ATTR_PAGE_LAYOUT]: parentExpectedLayout })
        }
        const parentExpectedRole = parentFinalAttrs[ATTR_ELEM_ROLE] || parentFinalAttrs["custom-slidev-role"] || ""
        const parentDomRole = parentLiEl.getAttribute(ATTR_ELEM_ROLE) || parentLiEl.getAttribute("custom-slidev-role")
        if (parentDomRole && parentDomRole !== parentExpectedRole) {
          syncDomBlockAttrs(parentLiId, { [ATTR_ELEM_ROLE]: parentExpectedRole })
        }
      }
    }

    const hasImgTag = Boolean(effectiveEl.querySelector("img, span[data-type='img']"))
    const textWithoutImg = (effectiveEl.innerText || "").replace(/[\r\n\t\s]+/g, " ").trim()
    const isImage = hasImgTag && textWithoutImg.length <= 50

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
  public purgeStaleDomSlidevAttrs(doc: ISlidevDocument): void {
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
