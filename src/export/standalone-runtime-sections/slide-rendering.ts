/**
 * 整页幻灯片装配渲染与版式容器分发
 */
export function getSlideRenderingSection(): string {
  return `      function renderSlide(idx, direction) {
        if (slides.length === 0) return;
        currentIndex = Math.max(0, Math.min(idx, slides.length - 1));
        const slide = slides[currentIndex];
        pageNum.textContent = (currentIndex + 1) + " / " + slides.length;

        const pageSp = slide.frontmatter?.spacing;
        const currentSpacing = (pageSp && pageSp !== "inherit") ? pageSp : (data.config?.spacing || "normal");
        container.className = "slide-content layout-" + (slide.frontmatter?.layout || "default") + " spacing-" + currentSpacing;
        if (viewport) viewport.setAttribute("data-spacing", currentSpacing);
        container.innerHTML = "";

        const z = typeof slide.frontmatter?.zoom === "number" && slide.frontmatter.zoom > 0 ? slide.frontmatter.zoom : 1;
        if (z !== 1) {
          container.style.width = (100 / z) + "%";
          container.style.height = (100 / z) + "%";
          container.style.transformOrigin = "top left";
          container.style.transform = "scale(" + z + ")";
        } else {
          container.style.width = "100%";
          container.style.height = "100%";
          container.style.transform = "none";
        }

        maskOverlayEl = null;
        maskDividerEl = null;
        const maskDir = slide.frontmatter?.mask;
        const isClock = maskDir === "clockwise" || maskDir === "counter-clockwise" || maskDir === "cw" || maskDir === "ccw";
        if (maskDir === "down" || maskDir === "right" || isClock) {
          const isClover = slide.frontmatter?.layout === "clover";
          const ratioInfo = parseMaskRatio(slide.frontmatter.maskRatio, (isClock || isClover) ? 4 : 2);
          const isInitRev = slide.frontmatter.maskInitial === "revealed";
          currentMaskConfig = {
            direction: isClock ? ((maskDir === "cw" || maskDir === "clockwise") ? "clockwise" : "counter-clockwise") : maskDir,
            isClock: isClock,
            totalSteps: isInitRev ? Math.max(0, ratioInfo.steps - 1) : ratioInfo.steps,
            rawSteps: ratioInfo.steps,
            breakpoints: ratioInfo.breakpoints,
            isInitialRevealed: isInitRev,
            style: slide.frontmatter.maskStyle || "solid",
          };
          // FSM-9 优化：后退进入历史页时，遮罩与逐步呈现处于全部揭开完成状态，避免上一页重新变为全黑遮盖
          currentMaskStep = (direction === "backward") ? currentMaskConfig.totalSteps : 0;
        } else {
          currentMaskConfig = null;
          currentMaskStep = 0;
        }

        function createMaskElements() {
          if (!currentMaskConfig) return null;
          const layer = document.createElement("div");
          layer.className = "slides-mask-layer slides-mask-layer--" + currentMaskConfig.style + " slides-mask-layer--" + currentMaskConfig.direction + (currentMaskConfig.isClock ? " slides-mask-layer--clock" : "");
          const overlay = document.createElement("div");
          overlay.className = "slides-mask-overlay";
          const divider = document.createElement("div");
          divider.className = "slides-mask-divider-line" + (currentMaskConfig.isClock ? " slides-mask-divider-line--clock" : "");
          divider.style.opacity = "0";
          if (currentMaskConfig.isClock) {
            const isCw = currentMaskConfig.direction === "clockwise" || currentMaskConfig.direction === "cw";
            divider.style.transform = isCw ? "translateY(-50%) rotate(-180deg)" : "translateY(-50%) rotate(-90deg)";
          }
          layer.appendChild(overlay);
          layer.appendChild(divider);
          maskLayerEl = layer;
          maskOverlayEl = overlay;
          maskDividerEl = divider;
          return { layer, overlay, divider };
        }

        if (slide.frontmatter?.layout === "two-cols") {
          const bodyWrap = document.createElement("div");
          bodyWrap.className = "slides-mask-body-container" + (currentMaskConfig ? " slides-mask-body-container--has-mask" : "");
          bodyWrap.style.display = "flex";
          bodyWrap.style.flexDirection = "row";
          bodyWrap.style.gap = "2rem";
          bodyWrap.style.width = "100%";
          bodyWrap.style.height = "100%";

          const leftCol = document.createElement("div");
          leftCol.className = "two-cols-left";
          const rightCol = document.createElement("div");
          rightCol.className = "two-cols-right";

          const blocks = (slide.blocks || []).filter(b => b.slot !== "slot-divider-right");
          let leftList = [];
          let rightList = [];
          for (const block of blocks) {
            if (block.slot === "right") rightList.push(block);
            else leftList.push(block);
          }
          leftList = cleanColList(leftList);
          rightList = cleanColList(rightList);
          const isCover = slide.frontmatter?.layout === "cover";
          const leftFirstH = !isCover ? leftList.find(isHeadingBlock) : null;
          const rightFirstH = !isCover ? rightList.find(isHeadingBlock) : null;
          for (const b of leftList) leftCol.appendChild(renderBlock(b, b === leftFirstH ? "slides-col-first-heading-block" : ""));
          for (const b of rightList) rightCol.appendChild(renderBlock(b, b === rightFirstH ? "slides-col-first-heading-block" : ""));
          bodyWrap.appendChild(leftCol);
          bodyWrap.appendChild(rightCol);

          const maskEls = createMaskElements();
          if (maskEls) {
            bodyWrap.appendChild(maskEls.layer);
          }
          container.appendChild(bodyWrap);
        } else if (slide.frontmatter?.layout === "cols-header" || slide.frontmatter?.layout === "two-cols-header" || slide.frontmatter?.layout === "three-cols-header" || slide.frontmatter?.layout === "clover") {
          const isCover = slide.frontmatter?.layout === "cover";
          const isClover = slide.frontmatter?.layout === "clover";
          const blocks = (slide.blocks || []).filter(b => b.slot !== "slot-divider-right");
          let headerBlocks = blocks.filter(b => b.slot === "header");
          if (headerBlocks.length === 0 && blocks.length > 0) {
            const candidate = blocks.find(b => b.type === "h" && (!b.slot || b.slot === "default"));
            if (candidate) headerBlocks = [candidate];
          }
          const rem = blocks.filter(b => !headerBlocks.includes(b));

          let targetCols = isClover ? 4 : 2;
          if (isClover) {
            targetCols = 4;
          } else if (slide.frontmatter?.layout === "three-cols-header") {
            targetCols = 3;
          } else if (slide.frontmatter?.layout === "two-cols-header") {
            targetCols = 2;
          } else {
            let maxCol = 0;
            for (const b of rem) {
              const m = (b.slot || "").match(/^col-(\d+)$/i);
              if (m) maxCol = Math.max(maxCol, parseInt(m[1], 10));
            }
            if (maxCol >= 2) {
              targetCols = maxCol;
            } else if (slide.frontmatter?.layoutRatio) {
              const r = slide.frontmatter.layoutRatio.trim();
              if (r.includes(":")) {
                const parts = r.split(":").map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0);
                if (parts.length >= 2) targetCols = parts.length;
              }
            }
          }

          const hasColSlots = rem.some(b => b.slot && /^col-\d+$/i.test(b.slot));
          const isSuperBlockCols = isClover || hasColSlots;

          const containerDiv = document.createElement("div");
          containerDiv.className = (isClover ? "layout-clover-container" : ("layout-cols-header-container " + (targetCols === 2 ? "layout-two-cols-header-container" : (targetCols === 3 ? "layout-three-cols-header-container" : "")))) + (isSuperBlockCols ? " has-superblock-cols" : "");
          const headerDiv = document.createElement("div");
          headerDiv.className = "layout-header-section";
          const gridDiv = document.createElement("div");
          gridDiv.className = (isClover ? "layout-clover-grid pdf-clover-wrapper" : ("layout-cols-wrapper layout-cols-grid " + (targetCols === 2 ? "pdf-two-cols-wrapper layout-two-cols-grid" : (targetCols === 3 ? "pdf-three-cols-wrapper layout-three-cols-grid" : "")))) + (isSuperBlockCols ? " has-superblock-cols" : "") + (currentMaskConfig ? " slides-mask-body-container slides-mask-body-container--has-mask" : "");

          const gridCols = isClover ? "repeat(2, minmax(0, 1fr))" : parseRatioToGridCols(slide.frontmatter?.layoutRatio, targetCols);
          if (gridCols) gridDiv.style.gridTemplateColumns = gridCols;
          if (isClover) gridDiv.style.gridTemplateRows = "repeat(2, minmax(0, 1fr))";

          let colsList = [];
          for (let i = 0; i < targetCols; i++) colsList.push([]);
          const hasExplicitCols = rem.some(b => b.slot && (b.slot.startsWith("col-") || b.slot === "left" || b.slot === "right" || b.slot === "center"));
          if (hasExplicitCols && rem.length > 1) {
            for (const b of rem) {
              let idx = 0;
              if (b.slot === "left" || b.slot === "col-1") idx = 0;
              else if (b.slot === "center" || b.slot === "col-2") idx = 1;
              else if (b.slot === "right") idx = targetCols === 2 ? 1 : targetCols - 1;
              else {
                const m = (b.slot || "").match(/^col-(\d+)$/i);
                if (m) idx = Math.min(targetCols - 1, Math.max(0, parseInt(m[1], 10) - 1));
              }
              colsList[idx].push(b);
            }
            const hasExplicitColN = rem.some(b => /^col-\d+$/i.test((b.slot || "").trim()));
            if (!hasExplicitColN && colsList[0].length === 0) {
              const nonEmptyCols = colsList.filter(c => c.length > 0);
              if (nonEmptyCols.length === 1) {
                colsList = [nonEmptyCols[0], ...Array.from({ length: targetCols - 1 }, () => [])];
              }
            }
          } else if (rem.length === 1) {
            colsList[0] = [rem[0]];
          } else {
            let cur = 0;
            for (let i = 0; i < targetCols; i++) {
              const remainingCols = targetCols - i;
              const remainingItems = rem.length - cur;
              const take = Math.ceil(remainingItems / remainingCols);
              colsList[i] = rem.slice(cur, cur + take);
              cur += take;
            }
          }

          const headerFirstH = !isCover ? headerBlocks.find(isHeadingBlock) : null;
          for (const b of headerBlocks) headerDiv.appendChild(renderBlock(b, b === headerFirstH ? "slides-page-first-heading-block" : ""));
          containerDiv.appendChild(headerDiv);

          colsList.forEach((colBlocks, idx) => {
            const colDiv = document.createElement("div");
            colDiv.className = "pdf-col pdf-col--" + (idx + 1) + " col-" + (idx + 1) + (targetCols === 2 && idx === 0 ? " pdf-col--left" : "") + (targetCols === 2 && idx === 1 ? " pdf-col--right" : "");
            const cleaned = cleanColList(colBlocks);
            const colFirstH = !isCover ? (cleaned.find(isHeadingBlock) || cleaned[0]) : null;
            for (const b of cleaned) colDiv.appendChild(renderBlock(b, b === colFirstH ? "slides-col-first-heading-block" : ""));
            gridDiv.appendChild(colDiv);
          });

          const maskEls = createMaskElements();
          if (maskEls) {
            gridDiv.appendChild(maskEls.layer);
          }

          containerDiv.appendChild(gridDiv);
          container.appendChild(containerDiv);
        } else if (slide.frontmatter?.layout === "image-right" || slide.frontmatter?.layout === "image-left") {
          const isImageRight = slide.frontmatter?.layout === "image-right";
          const isCover = slide.frontmatter?.layout === "cover";
          const allBlocks = slide.blocks || [];
          const pageFirstH = !isCover ? allBlocks.find(isHeadingBlock) : null;

          if (pageFirstH) {
            container.appendChild(renderBlock(pageFirstH, "slides-page-first-heading-block"));
          }

          const bodyWrap = document.createElement("div");
          bodyWrap.className = "slides-mask-body-container" + (currentMaskConfig ? " slides-mask-body-container--has-mask" : "");
          bodyWrap.style.display = "flex";
          bodyWrap.style.flexDirection = isImageRight ? "row" : "row-reverse";
          bodyWrap.style.gap = "2rem";
          bodyWrap.style.width = "100%";
          bodyWrap.style.height = "100%";
          bodyWrap.style.minHeight = "0";
          bodyWrap.style.flex = "1";

          const contentCol = document.createElement("div");
          contentCol.className = isImageRight ? "image-right-content" : "image-left-content";

          for (const block of allBlocks) {
            if (block === pageFirstH) continue;
            contentCol.appendChild(renderBlock(block, ""));
          }

          const imgCol = document.createElement("div");
          imgCol.className = isImageRight ? "image-right-img-container" : "image-left-img-container";
          const img = document.createElement("img");
          img.className = isImageRight ? "image-right-img" : "image-left-img";
          img.src = slide.frontmatter?.image || slide.frontmatter?.background || "";
          img.alt = "Slide cover";
          img.onerror = function() {
            this.src = "https://fastly.jsdelivr.net/gh/slidevjs/slidev-covers@main/static/2HmfbSpvcos.webp";
          };
          imgCol.appendChild(img);

          bodyWrap.appendChild(contentCol);
          bodyWrap.appendChild(imgCol);

          const maskEls = createMaskElements();
          if (maskEls) {
            bodyWrap.appendChild(maskEls.layer);
          }
          container.appendChild(bodyWrap);
        } else {
          const isCover = slide.frontmatter?.layout === "cover";
          const validBlocks = (slide.blocks || []).filter(b => b.slot !== "slot-divider-right");
          const pageFirstH = !isCover ? validBlocks.find(isHeadingBlock) : null;

          if (pageFirstH) {
            container.appendChild(renderBlock(pageFirstH, "slides-page-first-heading-block"));
          }

          const bodyWrap = document.createElement("div");
          bodyWrap.className = "slides-mask-body-container" + (currentMaskConfig ? " slides-mask-body-container--has-mask" : "");

          for (const block of validBlocks) {
            if (block === pageFirstH) continue;
            bodyWrap.appendChild(renderBlock(block, ""));
          }

          const maskEls = createMaskElements();
          if (maskEls) {
            bodyWrap.appendChild(maskEls.layer);
          }
          container.appendChild(bodyWrap);
        }

        updateMaskVisual();
        if (currentMaskConfig && maskLayerEl) {
          requestAnimationFrame(() => {
            if (maskLayerEl) void maskLayerEl.offsetHeight;
          });
        }

        function syncAutoplayVideos() {
          const doSync = () => {
            const videos = container.querySelectorAll("video");
            videos.forEach((v) => {
              const box = v.closest("[data-autoplay]");
              const isAuto = v.hasAttribute("autoplay") || v.autoplay || (box && box.getAttribute("data-autoplay") === "true");
              if (isAuto) {
                v.muted = true;
                v.defaultMuted = true;
                v.setAttribute("muted", "");
                v.playsInline = true;
                v.setAttribute("playsinline", "");
                const playFn = () => {
                  if (!v.paused) return;
                  v.muted = true;
                  v.defaultMuted = true;
                  const p = v.play();
                  if (p !== undefined) {
                    p.catch(() => {
                      v.muted = true;
                      v.defaultMuted = true;
                      setTimeout(() => { if (v.paused) v.play().catch(() => {}); }, 150);
                    });
                  }
                };
                playFn();
                if (!v.__autoplayBound) {
                  v.__autoplayBound = true;
                  v.addEventListener("loadedmetadata", playFn);
                  v.addEventListener("canplay", playFn);
                }
              }
            });
          };
          setTimeout(doSync, 60);
          setTimeout(doSync, 200);
        }
        syncAutoplayVideos();
      }

      // Lightbox 控制逻辑
      const lightbox = document.getElementById("slides-lightbox");
      const lightboxContent = document.getElementById("lightbox-content");
      const lightboxClose = document.getElementById("lightbox-close");
      let isLightboxOpen = false;

`;
}
