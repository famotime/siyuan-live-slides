/**
 * 图片/视频灯箱放大与关闭
 */
export function getLightboxSection(): string {
  return `      function openLightbox(type, src, alt) {
        if (!lightbox || !lightboxContent) return;
        lightboxContent.innerHTML = "";
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
