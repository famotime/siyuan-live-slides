/**
 * 缩略图总览层 DOM 骨架与常量（o 键呼出）
 */
export function getOverviewDomSection(): string {
  return `      // ========= 缩略图总览层（o 键呼出，方向键/数字+回车/点选跳页） =========
      const OVERVIEW_CARD_W = 236;
      let overviewOpen = false;
      let overviewFocus = 1;
      let overviewBuilt = false;
      let overviewObserver = null;
      const overviewOverlay = document.createElement("div");
      overviewOverlay.className = "slides-overview";
      overviewOverlay.style.display = "none";
      const overviewGrid = document.createElement("div");
      overviewGrid.className = "slides-overview-grid";
      const overviewHint = document.createElement("div");
      overviewHint.className = "slides-overview-hint";
      overviewHint.textContent = "← → ↑ ↓ 移动 · Enter 跳转 · 数字直达 · Esc / O 关闭";
      overviewOverlay.appendChild(overviewGrid);
      overviewOverlay.appendChild(overviewHint);
      document.body.appendChild(overviewOverlay);
      overviewOverlay.addEventListener("click", (e) => {
        if (e.target === overviewOverlay) closeOverview();
      });
      const overviewStyle = document.createElement("style");
      overviewStyle.textContent = ".slides-overview{position:fixed;inset:0;z-index:900;overflow-y:auto;background:rgba(13,16,22,0.88);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);padding:36px 44px 20px;box-sizing:border-box;}.slides-overview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(236px,1fr));gap:18px;max-width:1440px;margin:0 auto;}.slides-overview-card{cursor:pointer;border-radius:10px;border:2px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);overflow:hidden;transition:border-color 0.15s ease,transform 0.15s ease,box-shadow 0.15s ease;}.slides-overview-card:hover{border-color:rgba(255,255,255,0.38);transform:translateY(-2px);}.slides-overview-card.is-active{border-color:var(--slide-accent,#3b82f6);box-shadow:0 0 0 1px var(--slide-accent,#3b82f6),0 8px 24px rgba(0,0,0,0.4);}.slides-overview-canvas-box{position:relative;overflow:hidden;background:var(--slide-bg,#ffffff);}.slides-overview-canvas{position:absolute;top:0;left:0;transform-origin:top left;pointer-events:none;}.slides-overview-canvas *{scrollbar-width:none;}.slides-overview-caption{display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:12px;color:rgba(255,255,255,0.72);border-top:1px solid rgba(255,255,255,0.08);background:rgba(13,16,22,0.6);}.slides-overview-page-no{flex-shrink:0;font-variant-numeric:tabular-nums;font-weight:600;color:#f4f4f5;background:rgba(255,255,255,0.16);border-radius:8px;padding:0 7px;line-height:18px;}.slides-overview-page-no.is-current{background:var(--slide-accent,#10b981);color:#0b1210;}.slides-overview-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:none;}.slides-overview-hint{text-align:center;margin:18px 0 8px;font-size:12px;color:rgba(255,255,255,0.45);user-select:none;}";
      document.head.appendChild(overviewStyle);

      const baseWidth = 980;
      const aspectStr = (data.config && data.config.aspectRatio) || "16/9";
      let ratioNum = 16 / 9;
      if (aspectStr === "4/3") ratioNum = 4 / 3;
      else if (aspectStr === "16/10") ratioNum = 16 / 10;
      else if (typeof aspectStr === "string" && aspectStr.includes("/")) {
        const parts = aspectStr.split("/").map(Number);
        if (parts[0] && parts[1]) ratioNum = parts[0] / parts[1];
      }
      const baseHeight = Math.ceil(baseWidth / ratioNum);
      const viewport = document.getElementById("viewport");

`;
}
