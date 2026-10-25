/**
 * IIFE 开启、播放数据与核心 DOM 引用、跳页角标样式注入
 */
export function getCoreStateSection(): string {
  return `    (function() {
      const data = window.__SLIDEV_DATA__ || { slides: [] };
      const slides = data.slides || [];
      let currentIndex = 0;

      const container = document.getElementById("slide-container");
      const pageNum = document.getElementById("page-num");
      const btnPrev = document.getElementById("btn-prev");
      const btnNext = document.getElementById("btn-next");
      const btnFullscreen = document.getElementById("btn-fullscreen");

      // 「数字+回车」跳页输入角标：右下角悬浮显示，独立于缩放视口
      const jumpBadge = document.createElement("div");
      jumpBadge.className = "jump-page-indicator";
      jumpBadge.style.display = "none";
      document.body.appendChild(jumpBadge);
      const jumpStyle = document.createElement("style");
      jumpStyle.textContent = ".jump-page-indicator{position:fixed;right:16px;bottom:16px;z-index:1000;min-width:40px;padding:4px 12px;border-radius:18px;background:rgba(24,24,27,0.8);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.12);color:#f4f4f5;font-size:14px;font-variant-numeric:tabular-nums;text-align:center;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.35);}.jump-page-indicator.is-invalid{background:rgba(153,27,27,0.85);border-color:rgba(248,113,113,0.5);color:#fecaca;animation:jump-indicator-shake 0.4s ease;}@keyframes jump-indicator-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-4px);}50%{transform:translateX(4px);}75%{transform:translateX(-2px);}}";
      document.head.appendChild(jumpStyle);

`;
}
