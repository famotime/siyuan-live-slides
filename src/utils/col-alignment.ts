/**
 * 计算并同步多栏超级块（.has-superblock-cols）内居中首项标题的左侧水平偏移（--col-title-inset），
 * 使栏内后续普通文本与子列表项左侧边缘精确对齐居中的首项标题左侧。
 */
export function syncSuperblockColTitleInsets(root: ParentNode | null | undefined): void {
  if (!root || typeof document === "undefined" || typeof window === "undefined" || !document.createRange) {
    return
  }

  const cols = root.querySelectorAll(".has-superblock-cols .col, .has-superblock-cols .pdf-col")
  cols.forEach((colNode) => {
    const col = colNode as HTMLElement
    const firstBlock = col.querySelector(
      ":scope > .slide-block:first-child, :scope > .pdf-block:first-child, :scope > *:first-child",
    ) as HTMLElement | null
    if (!firstBlock) {
      col.style.setProperty("--col-title-inset", "0px")
      return
    }

    const titleEl = (firstBlock.matches("h1,h2,h3,h4,h5,h6,.slide-list-item-title")
      ? firstBlock
      : firstBlock.querySelector("h1,h2,h3,h4,h5,h6,.slide-list-item-title,li:first-child,p:first-child")) as HTMLElement | null
    if (!titleEl || !(titleEl.textContent || "").trim()) {
      col.style.setProperty("--col-title-inset", "0px")
      return
    }

    const cs = window.getComputedStyle(titleEl)
    if (cs.textAlign !== "center") {
      col.style.setProperty("--col-title-inset", "0px")
      return
    }

    const blockRect = firstBlock.getBoundingClientRect()
    if (!firstBlock.offsetWidth || !blockRect.width) {
      return
    }
    const scale = blockRect.width / firstBlock.offsetWidth
    if (!scale || !Number.isFinite(scale)) {
      return
    }

    const range = document.createRange()
    range.selectNodeContents(titleEl)
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5)
    if (rects.length === 0) {
      col.style.setProperty("--col-title-inset", "0px")
      return
    }

    const minLeft = Math.min(...rects.map((r) => r.left))
    const insetPx = Math.max(0, (minLeft - blockRect.left) / scale)
    col.style.setProperty("--col-title-inset", `${insetPx.toFixed(2)}px`)
  })
}

/**
 * 供独立 HTML 与 PDF 打印模板内联注入的纯 ES2020 测量函数源码
 */
export const COL_TITLE_INSET_SYNC_SCRIPT = `
function syncSuperblockColTitleInsets(root) {
  if (!root || typeof document === "undefined" || typeof window === "undefined" || !document.createRange) return;
  var cols = root.querySelectorAll(".has-superblock-cols .col, .has-superblock-cols .pdf-col");
  cols.forEach(function(col) {
    var firstBlock = col.querySelector(":scope > .slide-block:first-child, :scope > .pdf-block:first-child, :scope > *:first-child");
    if (!firstBlock) {
      col.style.setProperty("--col-title-inset", "0px");
      return;
    }
    var titleEl = firstBlock.matches("h1,h2,h3,h4,h5,h6,.slide-list-item-title")
      ? firstBlock
      : firstBlock.querySelector("h1,h2,h3,h4,h5,h6,.slide-list-item-title,li:first-child,p:first-child");
    if (!titleEl || !(titleEl.textContent || "").trim()) {
      col.style.setProperty("--col-title-inset", "0px");
      return;
    }
    var cs = window.getComputedStyle(titleEl);
    if (cs.textAlign !== "center") {
      col.style.setProperty("--col-title-inset", "0px");
      return;
    }
    var blockRect = firstBlock.getBoundingClientRect();
    if (!firstBlock.offsetWidth || !blockRect.width) return;
    var scale = blockRect.width / firstBlock.offsetWidth;
    if (!scale || !isFinite(scale)) return;
    var range = document.createRange();
    range.selectNodeContents(titleEl);
    var rects = Array.prototype.slice.call(range.getClientRects()).filter(function(r) { return r.width > 0.5 && r.height > 0.5; });
    if (rects.length === 0) {
      col.style.setProperty("--col-title-inset", "0px");
      return;
    }
    var minLeft = Math.min.apply(null, rects.map(function(r) { return r.left; }));
    var insetPx = Math.max(0, (minLeft - blockRect.left) / scale);
    col.style.setProperty("--col-title-inset", insetPx.toFixed(2) + "px");
  });
}
`
