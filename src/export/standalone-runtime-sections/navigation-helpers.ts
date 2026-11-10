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
        viewport.style.setProperty("--slides-slide-scale", scale);
        if (isFull) document.body.classList.add("is-fullscreen");
        else document.body.classList.remove("is-fullscreen");
      }

      window.addEventListener("resize", updateScale);
      document.addEventListener("fullscreenchange", updateScale);

      function parseMaskRatio(ratioStr, defaultSteps) {
        var defSteps = (defaultSteps === 4) ? 4 : 2;
        var defBps = (defaultSteps === 4) ? [25, 50, 75, 100] : [50, 100];
        if (!ratioStr || typeof ratioStr !== "string") {
          return { steps: defSteps, breakpoints: defBps };
        }
        var clean = ratioStr.trim();
        if (!clean || (defaultSteps === 4 && (clean === "1:1" || clean === "1"))) return { steps: defSteps, breakpoints: defBps };
        var parts = clean.split(":").map(function(p) { return parseFloat(p.trim()); }).filter(function(n) { return !isNaN(n) && n > 0; });
        if (parts.length === 0) return { steps: defSteps, breakpoints: defBps };
        if (parts.length === 1) {
          var val = Math.min(100, Math.max(1, parts[0]));
          if (val === 100) return { steps: 1, breakpoints: [100] };
          return { steps: 2, breakpoints: [Math.round(val * 100) / 100, 100] };
        }
        var isMonotonic = parts.every(function(val, idx) { return idx === 0 || val > parts[idx - 1]; });
        var maxVal = parts[parts.length - 1];
        if (isMonotonic && (maxVal === 100 || parts.some(function(p) { return p > 10; }))) {
          var bps = parts.map(function(p) { return Math.min(100, Math.round(p * 100) / 100); });
          if (bps[bps.length - 1] < 100) bps.push(100);
          return { steps: bps.length, breakpoints: bps };
        }
        var totalWeight = parts.reduce(function(acc, cur) { return acc + cur; }, 0);
        if (totalWeight <= 0) return { steps: defSteps, breakpoints: defBps };
        var accumulated = 0;
        var bps = [];
        for (var i = 0; i < parts.length; i++) {
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

        if (currentMaskConfig.isClock) {
          const isCw = currentMaskConfig.direction === "clockwise" || currentMaskConfig.direction === "cw";
          const sweepDeg = Math.min(360, Math.max(0, (p / 100) * 360));
          const needleAngle = isCw ? (-180 + sweepDeg) : (-90 - sweepDeg);

          if (maskOverlayEl) {
            let maskGrad = "";
            if (sweepDeg <= 0) {
              maskGrad = "conic-gradient(from 0deg at 50% 50%, #000 0deg, #000 360deg)";
            } else if (sweepDeg >= 360) {
              maskGrad = "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 360deg)";
            } else if (isCw) {
              maskGrad = "conic-gradient(from 270deg at 50% 50%, transparent 0deg, transparent " + sweepDeg + "deg, #000 " + sweepDeg + "deg, #000 360deg)";
            } else {
              const remDeg = 360 - sweepDeg;
              maskGrad = "conic-gradient(from 0deg at 50% 50%, #000 0deg, #000 " + remDeg + "deg, transparent " + remDeg + "deg, transparent 360deg)";
            }
            maskOverlayEl.style.webkitMaskImage = maskGrad;
            maskOverlayEl.style.maskImage = maskGrad;
          }

          if (maskDividerEl) {
            maskDividerEl.style.transform = "translateY(-50%) rotate(" + needleAngle + "deg)";
            maskDividerEl.style.opacity = (p <= 0 || p >= 100) ? "0" : "1";
          }

          if (p >= 100) {
            maskLayerEl.style.opacity = "0";
            maskLayerEl.style.pointerEvents = "none";
          } else {
            maskLayerEl.style.opacity = "1";
            maskLayerEl.style.pointerEvents = "none";
          }
          return;
        }

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
        // FSM-9 优化：回退至上一页时传递 backward 方向，使上一页遮罩处于完全展开状态
        renderSlide(currentIndex - 1, "backward");
      }

`;
}
