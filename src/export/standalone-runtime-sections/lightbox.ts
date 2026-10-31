/**
 * 图片/视频灯箱放大与关闭
 */
export function getLightboxSection(): string {
  return `      let lightboxScale = 1.0;
      let lightboxTranslateX = 0;
      let lightboxTranslateY = 0;
      let isLightboxDragging = false;
      let lightboxDragStartX = 0;
      let lightboxDragStartY = 0;
      let lightboxInitialTx = 0;
      let lightboxInitialTy = 0;
      let lightboxHasMoved = false;
      let lightboxMediaType = "";

      function updateLightboxImgTransform(animate) {
        if (!lightboxContent) return;
        const img = lightboxContent.querySelector(".slidev-lightbox-img");
        if (!img) return;
        img.style.transformOrigin = "center center";
        img.style.transform = "translate(" + lightboxTranslateX + "px, " + lightboxTranslateY + "px) scale(" + lightboxScale + ")";
        img.style.transition = animate ? "transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)" : "none";
        img.style.cursor = lightboxScale > 1.0 ? (isLightboxDragging ? "grabbing" : "grab") : "zoom-in";
      }

      function resetLightboxZoom() {
        lightboxScale = 1.0;
        lightboxTranslateX = 0;
        lightboxTranslateY = 0;
        isLightboxDragging = false;
        lightboxHasMoved = false;
        updateLightboxImgTransform(false);
      }

      function openLightbox(type, src, alt) {
        if (!lightbox || !lightboxContent) return;
        lightboxContent.innerHTML = "";
        lightboxMediaType = type;
        resetLightboxZoom();
        if (type === "video") {
          const v = document.createElement("video");
          v.className = "slidev-lightbox-video";
          v.src = src;
          v.controls = true;
          v.autoplay = true;
          v.playsInline = true;
          lightboxContent.appendChild(v);
        } else {
          const img = document.createElement("img");
          img.className = "slidev-lightbox-img";
          img.src = src;
          img.alt = alt || "";
          lightboxContent.appendChild(img);
          updateLightboxImgTransform(false);
        }
        lightbox.classList.add("active");
        isLightboxOpen = true;
      }

      function closeLightbox() {
        if (!lightbox) return;
        const v = lightbox.querySelector("video");
        if (v) v.pause();
        lightbox.classList.remove("active");
        if (lightboxContent) lightboxContent.innerHTML = "";
        isLightboxOpen = false;
        lightboxMediaType = "";
        resetLightboxZoom();
      }

      function handleLightboxWheel(e) {
        if (!lightboxContent || lightboxMediaType !== "image") return;
        const img = lightboxContent.querySelector(".slidev-lightbox-img");
        if (!img) return;
        e.preventDefault();
        e.stopPropagation();
        if (Math.abs(e.deltaY) < 1) return;

        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const currentScale = lightboxScale;
        let nextScale = currentScale * factor;

        if (nextScale <= 1.02) {
          resetLightboxZoom();
          return;
        }
        if (nextScale > 5.0) {
          nextScale = 5.0;
        }

        const rect = img.getBoundingClientRect();
        const currentCenterX = rect.left + rect.width / 2;
        const currentCenterY = rect.top + rect.height / 2;
        const origCenterX = currentCenterX - lightboxTranslateX;
        const origCenterY = currentCenterY - lightboxTranslateY;

        const nextTx = (e.clientX - origCenterX) * (1 - nextScale / currentScale) + lightboxTranslateX * (nextScale / currentScale);
        const nextTy = (e.clientY - origCenterY) * (1 - nextScale / currentScale) + lightboxTranslateY * (nextScale / currentScale);

        lightboxTranslateX = Math.round(nextTx * 10) / 10;
        lightboxTranslateY = Math.round(nextTy * 10) / 10;
        lightboxScale = Math.round(nextScale * 1000) / 1000;
        updateLightboxImgTransform(true);
      }

      if (lightboxContent) {
        lightboxContent.addEventListener("pointerdown", (e) => {
          if (e.button !== 0 || lightboxMediaType !== "image" || lightboxScale <= 1.0) return;
          const img = lightboxContent.querySelector(".slidev-lightbox-img");
          if (!img || (e.target !== img && !img.contains(e.target))) return;
          e.preventDefault();
          e.stopPropagation();
          isLightboxDragging = true;
          lightboxDragStartX = e.clientX;
          lightboxDragStartY = e.clientY;
          lightboxInitialTx = lightboxTranslateX;
          lightboxInitialTy = lightboxTranslateY;
          lightboxHasMoved = false;
          if (img.setPointerCapture) {
            try { img.setPointerCapture(e.pointerId); } catch (_) {}
          }
          updateLightboxImgTransform(false);
        });

        window.addEventListener("pointermove", (e) => {
          if (!isLightboxDragging || lightboxMediaType !== "image") return;
          e.preventDefault();
          e.stopPropagation();
          const dx = e.clientX - lightboxDragStartX;
          const dy = e.clientY - lightboxDragStartY;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            lightboxHasMoved = true;
          }
          lightboxTranslateX = Math.round((lightboxInitialTx + dx) * 10) / 10;
          lightboxTranslateY = Math.round((lightboxInitialTy + dy) * 10) / 10;
          updateLightboxImgTransform(false);
        });

        const onLightboxPointerEnd = (e) => {
          if (!isLightboxDragging) return;
          isLightboxDragging = false;
          const img = lightboxContent ? lightboxContent.querySelector(".slidev-lightbox-img") : null;
          if (img && img.releasePointerCapture) {
            try { img.releasePointerCapture(e.pointerId); } catch (_) {}
          }
          updateLightboxImgTransform(false);
        };
        window.addEventListener("pointerup", onLightboxPointerEnd);
        window.addEventListener("pointercancel", onLightboxPointerEnd);

        lightboxContent.addEventListener("dblclick", (e) => {
          if (lightboxMediaType !== "image") return;
          const img = lightboxContent.querySelector(".slidev-lightbox-img");
          if (!img || (e.target !== img && !img.contains(e.target))) return;
          e.preventDefault();
          e.stopPropagation();
          if (lightboxScale > 1.05 || lightboxTranslateX !== 0 || lightboxTranslateY !== 0) {
            resetLightboxZoom();
          } else {
            const targetScale = 2.0;
            const rect = img.getBoundingClientRect();
            const currentCenterX = rect.left + rect.width / 2;
            const currentCenterY = rect.top + rect.height / 2;
            const origCenterX = currentCenterX - lightboxTranslateX;
            const origCenterY = currentCenterY - lightboxTranslateY;
            lightboxTranslateX = Math.round(((e.clientX - origCenterX) * (1 - targetScale / 1.0)) * 10) / 10;
            lightboxTranslateY = Math.round(((e.clientY - origCenterY) * (1 - targetScale / 1.0)) * 10) / 10;
            lightboxScale = targetScale;
            updateLightboxImgTransform(true);
          }
        });
      }

      if (lightboxClose) {
        lightboxClose.addEventListener("click", (e) => {
          e.stopPropagation();
          closeLightbox();
        });
      }
      if (lightbox) {
        lightbox.addEventListener("click", (e) => {
          if (e.target === lightbox || e.target === lightboxClose) {
            if (lightboxHasMoved) {
              lightboxHasMoved = false;
              return;
            }
            e.stopPropagation();
            closeLightbox();
          }
        });
      }

      btnPrev.addEventListener("click", () => goPrev());
      btnNext.addEventListener("click", () => goNext());
      btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().then(() => updateScale()).catch(() => {});
        } else {
          document.exitFullscreen().then(() => updateScale()).catch(() => {});
        }
      });

      // 「数字+回车」跳页输入状态：数字缓冲实时回显，Esc/超时清空，越界红色抖动提示
      let jumpDisplay = "";
      let jumpInvalid = false;
      let jumpIdleTimer = null;
      let jumpFlashTimer = null;

`;
}
