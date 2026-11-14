import { performTransactions, type IOperation } from "@/api"

/**
 * 生成符合思源笔记规格的块 ID (14位时间戳-7位随机字符)
 */
export function generateBlockId(): string {
  if (typeof window !== "undefined" && typeof (window as any).Lute?.NewNodeID === "function") {
    return (window as any).Lute.NewNodeID()
  }
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz"
  let rnd = ""
  for (let i = 0; i < 7; i++) {
    rnd += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${ts}-${rnd}`
}

/**
 * 查找当前处于激活/可见状态的主编辑区
 */
export function findActiveEditor(): HTMLElement | null {
  if (typeof document === "undefined") return null
  return (
    document.querySelector(".layout__wnd--active .protyle-wysiwyg") ||
    document.querySelector(".protyle:not(.fn__none) .protyle-wysiwyg") ||
    document.querySelector(".protyle-wysiwyg")
  ) as HTMLElement | null
}

/**
 * 校验当前选区状态是否支持「转为横向超级块」
 * 条件：
 * 1. 选中了 >= 2 个同级/独立块；
 * 2. 或者选中的是同一列表内的 >= 2 个列表项 (NodeListItem)；
 * 3. 或者当前单选/聚焦于一个包含 >= 2 个直接列表项的列表块 (NodeList)。
 */
export function checkCanConvertToSuperBlock(activeBlockId?: string, activeBlockType?: string): boolean {
  if (typeof document === "undefined") return false
  const editor = findActiveEditor()
  if (!editor) return false

  // 1. 检查多选块
  const selectedEls = Array.from(
    editor.querySelectorAll(".protyle-wysiwyg--select[data-node-id]")
  ) as HTMLElement[]

  if (selectedEls.length >= 2) {
    return true
  }

  // 2. 检查单选或光标聚焦于列表块 (NodeList)，且包含 >= 2 个列表项
  const targetId = selectedEls[0]?.getAttribute("data-node-id") || activeBlockId
  const isTargetListType = activeBlockType === "NodeList" || activeBlockType === "l" || activeBlockType === "list"
  if (targetId) {
    const el = editor.querySelector(`[data-node-id="${targetId}"]`) as HTMLElement | null
    if (el) {
      const listEl = (isTargetListType || el.getAttribute("data-type") === "NodeList" || el.classList.contains("list"))
        ? (el.getAttribute("data-type") === "NodeList" ? el : el.closest('[data-type="NodeList"], .list') as HTMLElement | null)
        : (el.closest('[data-type="NodeList"], .list') as HTMLElement | null)
      if (listEl) {
        const items = listEl.querySelectorAll(":scope > [data-type='NodeListItem'], :scope > .li")
        if (items.length >= 2) {
          return true
        }
      }
    }
  }

  return false
}

export interface ISuperBlockTransformResult {
  success: boolean
  colCount?: number
  superBlockId?: string
  error?: string
}

/**
 * 执行「转为横向超级块」转换
 */
export async function executeConvertToSuperBlock(options: {
  currentDocId: string
  activeBlockId?: string
}): Promise<ISuperBlockTransformResult> {
  const editor = findActiveEditor()
  if (!editor) {
    return { success: false, error: "未找到主编辑区" }
  }

  const selectedEls = Array.from(
    editor.querySelectorAll(".protyle-wysiwyg--select[data-node-id]")
  ) as HTMLElement[]

  // 判断是否为「同一列表块的多个列表项」
  let isAllFromSameList = false
  let commonListEl: HTMLElement | null = null
  let selectedListItems: HTMLElement[] = []

  if (selectedEls.length >= 2) {
    const firstList = selectedEls[0].closest('[data-type="NodeList"], .list') as HTMLElement | null
    if (firstList) {
      const items = new Set<HTMLElement>()
      let allBelongToFirstList = true
      for (const el of selectedEls) {
        const item = (el.getAttribute("data-type") === "NodeListItem" || el.classList.contains("li"))
          ? el
          : (el.closest('[data-type="NodeListItem"], .li') as HTMLElement | null)
        if (!item || item.closest('[data-type="NodeList"], .list') !== firstList) {
          allBelongToFirstList = false
          break
        }
        items.add(item)
      }
      if (allBelongToFirstList && items.size >= 2) {
        isAllFromSameList = true
        commonListEl = firstList
        selectedListItems = Array.from(firstList.querySelectorAll(":scope > [data-type='NodeListItem'], :scope > .li"))
          .filter(item => items.has(item as HTMLElement)) as HTMLElement[]
      }
    }
  }

  // 判断是否为「直接选中整个列表块」
  let isWholeList = false
  if (!isAllFromSameList) {
    const targetEl = (selectedEls.length === 1 ? selectedEls[0] : null) ||
      (options.activeBlockId ? editor.querySelector(`[data-node-id="${options.activeBlockId}"]`) : null) as HTMLElement | null
    if (targetEl) {
      const listEl = (targetEl.getAttribute("data-type") === "NodeList" || targetEl.classList.contains("list"))
        ? targetEl
        : (targetEl.closest('[data-type="NodeList"], .list') as HTMLElement | null)
      if (listEl) {
        const allItems = Array.from(listEl.querySelectorAll(":scope > [data-type='NodeListItem'], :scope > .li")) as HTMLElement[]
        if (allItems.length >= 2) {
          isWholeList = true
          commonListEl = listEl
          selectedListItems = allItems
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 模式 1：列表项转为多个列表块后再合并为横向超级块
  // -------------------------------------------------------------
  if (isAllFromSameList || isWholeList) {
    if (!commonListEl || selectedListItems.length < 2) {
      return { success: false, error: "选中的列表项不足 2 项，无法合并为横向超级块" }
    }

    const allDirectItems = Array.from(
      commonListEl.querySelectorAll(":scope > [data-type='NodeListItem'], :scope > .li")
    ) as HTMLElement[]
    const isAllItems = selectedListItems.length === allDirectItems.length
    const subtype = commonListEl.getAttribute("data-subtype") || "u"
    const originalListId = commonListEl.getAttribute("data-node-id") || ""
    const parentEl = commonListEl.parentElement
    const parentId = parentEl?.getAttribute("data-node-id") || options.currentDocId

    let prevEl = commonListEl.previousElementSibling
    while (prevEl && !prevEl.getAttribute("data-node-id")) {
      prevEl = prevEl.previousElementSibling
    }
    const prevId = prevEl?.getAttribute("data-node-id") || ""

    let nextEl = commonListEl.nextElementSibling
    while (nextEl && !nextEl.getAttribute("data-node-id")) {
      nextEl = nextEl.nextElementSibling
    }
    const nextId = nextEl?.getAttribute("data-node-id") || ""

    const sbId = generateBlockId()
    const itemMap = selectedListItems.map(li => ({
      li,
      liId: li.getAttribute("data-node-id") || "",
      newListId: generateBlockId(),
    }))

    const doOps: IOperation[] = []
    const undoOps: IOperation[] = []

    if (isAllItems) {
      // 1. 插入横向超级块
      doOps.push({
        action: "insert",
        id: sbId,
        data: `<div data-node-id="${sbId}" data-type="NodeSuperBlock" class="sb" data-sb-layout="col"><div class="protyle-attr" contenteditable="false">&#x200B;</div></div>`,
        parentID: parentId,
        previousID: prevId || undefined,
        nextID: !prevId ? (nextId || undefined) : undefined,
      })

      // 2. 为每个选中的列表项创建独立的列表容器，并将列表项移入其中
      for (let i = 0; i < itemMap.length; i++) {
        const { liId, newListId } = itemMap[i]
        doOps.push({
          action: "insert",
          id: newListId,
          data: `<div data-node-id="${newListId}" data-type="NodeList" data-subtype="${subtype}" class="list"><div class="protyle-attr" contenteditable="false">&#x200B;</div></div>`,
          parentID: sbId,
          previousID: i === 0 ? undefined : itemMap[i - 1].newListId,
        })
        doOps.push({
          action: "move",
          id: liId,
          parentID: newListId,
        })
      }

      // 3. 删除原已清空的列表块
      if (originalListId) {
        doOps.push({
          action: "delete",
          id: originalListId,
        })
      }

      // 撤销操作：
      // 1. 恢复原列表外壳
      if (originalListId) {
        undoOps.push({
          action: "insert",
          id: originalListId,
          data: commonListEl.outerHTML,
          parentID: parentId,
          previousID: prevId || undefined,
          nextID: !prevId ? (nextId || undefined) : undefined,
        })
      }
      // 2. 将列表项移回原列表
      for (let i = 0; i < itemMap.length; i++) {
        undoOps.push({
          action: "move",
          id: itemMap[i].liId,
          parentID: originalListId,
          previousID: i === 0 ? undefined : itemMap[i - 1].liId,
        })
      }
      // 3. 销毁各个新列表块与超级块
      for (const { newListId } of itemMap) {
        undoOps.push({ action: "delete", id: newListId })
      }
      undoOps.push({ action: "delete", id: sbId })
    } else {
      // 选中国列表中部分列表项：
      // 在原列表之后插入横向超级块，并将选中的列表项移入超级块内的独立列表块中，未选中的项在原列表中保留
      doOps.push({
        action: "insert",
        id: sbId,
        data: `<div data-node-id="${sbId}" data-type="NodeSuperBlock" class="sb" data-sb-layout="col"><div class="protyle-attr" contenteditable="false">&#x200B;</div></div>`,
        parentID: parentId,
        previousID: originalListId,
      })

      for (let i = 0; i < itemMap.length; i++) {
        const { liId, newListId } = itemMap[i]
        doOps.push({
          action: "insert",
          id: newListId,
          data: `<div data-node-id="${newListId}" data-type="NodeList" data-subtype="${subtype}" class="list"><div class="protyle-attr" contenteditable="false">&#x200B;</div></div>`,
          parentID: sbId,
          previousID: i === 0 ? undefined : itemMap[i - 1].newListId,
        })
        doOps.push({
          action: "move",
          id: liId,
          parentID: newListId,
        })
      }

      // 撤销操作：把列表项移回原列表，并删除新列表块与超级块
      for (let i = 0; i < itemMap.length; i++) {
        undoOps.push({
          action: "move",
          id: itemMap[i].liId,
          parentID: originalListId,
        })
      }
      for (const { newListId } of itemMap) {
        undoOps.push({ action: "delete", id: newListId })
      }
      undoOps.push({ action: "delete", id: sbId })
    }

    await performTransactions([{ doOperations: doOps, undoOperations: undoOps }])

    // 清理编辑区选中样式
    editor.querySelectorAll(".protyle-wysiwyg--select").forEach(el => el.classList.remove("protyle-wysiwyg--select"))

    return {
      success: true,
      colCount: itemMap.length,
      superBlockId: sbId,
    }
  }

  // -------------------------------------------------------------
  // 模式 2：多个普通块合并为横向超级块
  // -------------------------------------------------------------
  // 过滤出顶层选中的块（防止选中的嵌套子块被重复处理）
  const topSelectedEls = selectedEls.filter(el => {
    let p = el.parentElement
    while (p && p !== editor) {
      if (selectedEls.includes(p as HTMLElement)) return false
      p = p.parentElement
    }
    return true
  })

  if (topSelectedEls.length < 2) {
    return {
      success: false,
      error: "请在编辑区选中多个块，或选中一个包含多个列表项的列表",
    }
  }

  const firstEl = topSelectedEls[0]
  const lastEl = topSelectedEls[topSelectedEls.length - 1]
  const parentEl = firstEl.parentElement
  const parentId = parentEl?.getAttribute("data-node-id") || options.currentDocId

  let prevEl = firstEl.previousElementSibling
  while (prevEl && !prevEl.getAttribute("data-node-id")) {
    prevEl = prevEl.previousElementSibling
  }
  const prevId = prevEl?.getAttribute("data-node-id") || ""

  let nextEl = lastEl.nextElementSibling
  while (nextEl && !nextEl.getAttribute("data-node-id")) {
    nextEl = nextEl.nextElementSibling
  }
  const nextId = nextEl?.getAttribute("data-node-id") || ""

  const sbId = generateBlockId()
  const doOps: IOperation[] = []
  const undoOps: IOperation[] = []

  // 1. 插入横向超级块
  doOps.push({
    action: "insert",
    id: sbId,
    data: `<div data-node-id="${sbId}" data-type="NodeSuperBlock" class="sb" data-sb-layout="col"><div class="protyle-attr" contenteditable="false">&#x200B;</div></div>`,
    parentID: parentId,
    previousID: prevId || undefined,
    nextID: !prevId ? (nextId || undefined) : undefined,
  })

  // 2. 将每个选中的块移入超级块
  for (let i = 0; i < topSelectedEls.length; i++) {
    const blockId = topSelectedEls[i].getAttribute("data-node-id")!
    doOps.push({
      action: "move",
      id: blockId,
      parentID: sbId,
      previousID: i === 0 ? undefined : topSelectedEls[i - 1].getAttribute("data-node-id")!,
    })
  }

  // 撤销操作：
  // 1. 把各个块按原顺序移回父节点
  for (let i = 0; i < topSelectedEls.length; i++) {
    const blockId = topSelectedEls[i].getAttribute("data-node-id")!
    undoOps.push({
      action: "move",
      id: blockId,
      parentID: parentId,
      previousID: i === 0 ? (prevId || undefined) : topSelectedEls[i - 1].getAttribute("data-node-id")!,
    })
  }
  // 2. 销毁超级块
  undoOps.push({
    action: "delete",
    id: sbId,
  })

  await performTransactions([{ doOperations: doOps, undoOperations: undoOps }])

  // 清理选中状态
  editor.querySelectorAll(".protyle-wysiwyg--select").forEach(el => el.classList.remove("protyle-wysiwyg--select"))

  return {
    success: true,
    colCount: topSelectedEls.length,
    superBlockId: sbId,
  }
}
