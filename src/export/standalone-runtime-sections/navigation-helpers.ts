/**
 * 缩放适配、遮罩比例解析与上下翻页导航助手
 */
export function getNavigationHelpersSection(): string {
  return `      function updateScale() {
        if (!viewport) return;
        const isFull = !!document.fullscreenElement;
        const padX = isFull ? 0 : 20;
        const padY = isFull ? 0 : 32;
        const availW = Math.max(100, window.innerWidth - padX);
        const availH = Math.max(100, window.innerHeight - padY);
        const scale = Math.min(availW / baseWidth, availH / baseHeight);
        viewport.style.width = baseWidth + "px";
        viewport.style.height = baseHeight + "px";
        viewport.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
        viewport.style.setProperty("--slidev-slide-scale", scale);
        if (isFull) document.body.classList.add("is-fullscreen");
        else document.body.classList.remove("is-fullscreen");
      }

      window.addEventListener("resize", updateScale);
      document.addEventListener("fullscreenchange", updateScale);

      function parseMaskRatio(ratioStr) {
        if (!ratioStr || typeof ratioStr !== "string") {
          return { steps: 2, breakpoints: [50, 100] };
        }
        const clean = ratioStr.trim();
        if (!clean) return { steps: 2, breakpoints: [50, 100] };
        const parts = clean.split(":").map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0);
        if (parts.length === 0) return { steps: 2, breakpoints: [50, 100] };
        if (parts.length === 1) {
          const val = Math.min(100, Math.max(1, parts[0]));
          if (val === 100) return { steps: 1, breakpoints: [100] };
          return { steps: 2, breakpoints: [Math.round(val * 100) / 100, 100] };
        }
        const isMonotonic = parts.every((val, idx) => idx === 0 || val > parts[idx - 1]);
        const maxVal = parts[parts.length - 1];
        if (isMonotonic && (maxVal === 100 || parts.some(p => p > 10))) {
          const bps = parts.map(p => Math.min(100, Math.round(p * 100) / 100));
          if (bps[bps.length - 1] < 100) bps.push(100);
          return { steps: bps.length, breakpoints: bps };
        }
        const totalWeight = parts.reduce((acc, cur) => acc + cur, 0);
        if (totalWeight <= 0) return { steps: 2, breakpoints: [50, 100] };
        let accumulated = 0;
        const bps = [];
        for (let i = 0; i < parts.length; i++) {
          accumulated += parts[i];
          if (i === parts.length - 1) {
            bps.push(100);
          } else {
            bps.push(Math.round((accumulated / totalWeight) * 10000) / 100);
          }
        }
        return { steps: bps.length, breakpoints: bps };
      }

      let currentMaskStep = 0;
      let currentMaskConfig = null;
      let maskLayerEl = null;
      let maskOverlayEl = null;
      let maskDividerEl = null;

      function updateMaskVisual() {
        if (!currentMaskConfig || !maskLayerEl) return;
        const p = (currentMaskStep <= 0)
          ? (currentMaskConfig.isInitialRevealed ? currentMaskConfig.breakpoints[0] : 0)
          : (currentMaskStep >= currentMaskConfig.totalSteps
              ? 100
              : currentMaskConfig.breakpoints[currentMaskConfig.isInitialRevealed ? currentMaskStep : (currentMaskStep - 1)]);

        const isDown = currentMaskConfig.direction === "down";
        if (p >= 100) {
          maskLayerEl.style.transform = isDown ? "translate3d(0, 100%, 0)" : "translate3d(100%, 0, 0)";
          maskLayerEl.style.opacity = "0";
          maskLayerEl.style.pointerEvents = "none";
          if (maskDividerEl) maskDividerEl.style.opacity = "0";
        } else {
          maskLayerEl.style.transform = isDown ? ("translate3d(0, " + p + "%, 0)") : ("translate3d(" + p + "%, 0, 0)");
          maskLayerEl.style.opacity = "1";
          maskLayerEl.style.pointerEvents = "none";
          if (maskDividerEl) {
            maskDividerEl.style.opacity = (p <= 0) ? "0" : "1";
          }
        }
      }

      function goNext() {
        if (currentMaskConfig && currentMaskStep < currentMaskConfig.totalSteps) {
          currentMaskStep++;
          updateMaskVisual();
          return;
        }
        renderSlide(currentIndex + 1);
      }

      function goPrev() {
        if (currentMaskConfig && currentMaskStep > (currentMaskConfig.isInitialRevealed ? 1 : 0)) {
          currentMaskStep--;
          updateMaskVisual();
          return;
        }
        renderSlide(currentIndex - 1);
      }

`;
}
