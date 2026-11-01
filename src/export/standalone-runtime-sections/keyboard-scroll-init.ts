/**
 * 滚轮/键盘事件处理与启动初始化
 */
export function getKeyboardScrollInitSection(): string {
  return `      function canElementScrollY(el, deltaY) {
        let cur = el;
        while (cur && cur !== document.body && cur !== document.documentElement) {
          if (cur.classList && (cur.classList.contains("slides-viewport") || cur.classList.contains("slides-stage") || cur.classList.contains("slide-container"))) {
            break;
          }
          const style = window.getComputedStyle(cur);
          const overflowY = style.overflowY;
          if (overflowY === "auto" || overflowY === "scroll") {
            const maxScroll = cur.scrollHeight - cur.clientHeight;
            if (maxScroll > 2) {
              if (deltaY > 0 && cur.scrollTop < maxScroll - 1) return true;
              if (deltaY < 0 && cur.scrollTop > 1) return true;
            }
          }
          cur = cur.parentElement;
        }
        return false;
      }

      window.addEventListener("wheel", (e) => {
        if (isLightboxOpen) {
          if (typeof handleLightboxWheel === "function") {
            handleLightboxWheel(e);
          }
          return;
        }
        // 总览打开时滚轮交给总览列表原生滚动，不触发翻页
        if (overviewOpen) return;
        if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
        if (Math.abs(e.deltaY) < WHEEL_DELTA_THRESHOLD) return;

        const target = e.target instanceof Element ? e.target : e.target?.parentElement;
        if (target && canElementScrollY(target, e.deltaY)) return;

        e.preventDefault();
        const now = Date.now();
        if (now - lastWheelTime < WHEEL_COOLDOWN_MS) return;
        lastWheelTime = now;

        if (e.deltaY > 0) {
          goNext();
        } else {
          goPrev();
        }
      }, { passive: false });

      document.addEventListener("click", (e) => {
        if (isLightboxOpen) {
          if (typeof lightboxHasMoved !== "undefined" && lightboxHasMoved) {
            lightboxHasMoved = false;
            e.stopPropagation();
            return;
          }
          const target = e.target instanceof Element ? e.target : e.target?.parentElement;
          const isMediaItself = target && target.closest && target.closest(".slides-lightbox-img, .slides-lightbox-video");
          if (!isMediaItself) {
            e.stopPropagation();
            closeLightbox();
          }
          return;
        }
        // 总览打开时空白点击由总览层自身处理，不触发底层翻页
        if (overviewOpen) return;
        if (e.button !== 0) return;
        const targetEl = e.target instanceof Element ? e.target : e.target?.parentElement;
        if (!targetEl || !targetEl.closest) return;

        const hasPendingMask = currentMaskConfig && (currentMaskStep < currentMaskConfig.totalSteps);
        if (hasPendingMask) {
          const isBottomControls = targetEl.closest(".controls-bar, .controls, .slides-toc");
          if (isBottomControls) return;
          e.preventDefault();
          e.stopPropagation();
          goNext();
          return;
        }

        const refEl = targetEl.closest("[data-ref-id]");
        if (refEl) {
          const id = refEl.getAttribute("data-ref-id");
          if (id) {
            window.open("siyuan://blocks/" + id, "_blank");
            return;
          }
        }

        // 媒体点击唤起 Lightbox 放大模态
        const mediaEl = targetEl.closest(".slide-content img, .slide-content video");
        if (mediaEl && !mediaEl.closest(".controls, .controls-bar, button, a")) {
          e.stopPropagation();
          const isVideo = mediaEl.tagName.toLowerCase() === "video";
          const src = isVideo ? (mediaEl.currentSrc || mediaEl.src || mediaEl.querySelector("source")?.src) : mediaEl.src;
          if (src) {
            openLightbox(isVideo ? "video" : "image", src, mediaEl.alt || "");
            return;
          }
        }

        const selection = window.getSelection ? window.getSelection().toString().trim() : "";
        if (selection.length > 0) return;

        const isComponent = targetEl.closest(
          ".slide-block, .controls-bar, .image-right-img-container, .image-left-img-container, .controls, img, video, audio, button, a, input, textarea, select, [data-clickable], [data-ref-id], .slides-toc, .empty-state"
        );
        if (isComponent) return;

        const isLeft = e.clientX < window.innerWidth / 2;
        if (isLeft) {
          goPrev();
        } else {
          goNext();
        }
      });

      renderSlide(0);
      updateScale();
    })();`;
}
