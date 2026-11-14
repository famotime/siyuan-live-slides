/**
 * 缩略图总览层构建、焦点导航与键盘交互
 */
export function getOverviewLayerSection(): string {
  return `      function getSlideOverviewTitle(slide) {
        const fm = slide?.frontmatter || {};
        if (fm.title) return String(fm.title);
        const blocks = slide?.blocks || [];
        for (const b of blocks) {
          if (b.type === "h" || /^h[1-6]$/i.test(b.subType || "")) {
            const md = (b.rawMarkdown || b.content || "").trim();
            return md.replace(/^#{1,6}\s+/, "").replace(/[*_\`]/g, "").slice(0, 40);
          }
        }
        return "";
      }

      // 把任意一页渲染为静态缩略图：复用 renderBlock 与主渲染同名版式类，导出样式自动生效
      function buildOverviewThumbInto(canvas, slide) {
        const fm = slide.frontmatter || {};
        const layout = fm.layout || "default";
        const blocks = (slide.blocks || []).filter((b) => b.slot !== "slot-divider-right");
        let headerBlocks = blocks.filter((b) => b.slot === "header");
        if (headerBlocks.length === 0 && blocks.length > 0) {
          const candidate = blocks.find((b) => b.type === "h" && (!b.slot || b.slot === "default"));
          if (candidate) headerBlocks = [candidate];
        }
        const rem = blocks.filter((b) => !headerBlocks.includes(b));
        let bodyEl = null;

        if (layout === "cols-header" || layout === "two-cols-header" || layout === "three-cols-header" || layout === "clover") {
          const isClover = layout === "clover";
          let targetCols = isClover ? 4 : 2;
          if (layout === "three-cols-header") targetCols = 3;
          else if (layout === "two-cols-header") targetCols = 2;
          else if (!isClover) {
            let maxCol = 0;
            for (const b of rem) {
              const m = (b.slot || "").match(/^col-(\d+)$/i);
              if (m) maxCol = Math.max(maxCol, parseInt(m[1], 10));
            }
            if (maxCol >= 2) targetCols = maxCol;
            else if (fm.layoutRatio) {
              const r = String(fm.layoutRatio).trim();
              if (r.includes(":")) {
                const parts = r.split(":").map((p) => parseFloat(p.trim())).filter((n) => !isNaN(n) && n > 0);
                if (parts.length >= 2) targetCols = parts.length;
              }
            }
          }
          const hasColSlots = rem.some((b) => b.slot && /^col-\d+$/i.test(b.slot));
          const containerDiv = document.createElement("div");
          containerDiv.className = (isClover ? "layout-clover-container" : ("layout-cols-header-container " + (targetCols === 2 ? "layout-two-cols-header-container" : (targetCols === 3 ? "layout-three-cols-header-container" : "")))) + (hasColSlots || isClover ? " has-superblock-cols" : "");
          const headerDiv = document.createElement("div");
          headerDiv.className = "layout-header-section";
          for (const b of headerBlocks) headerDiv.appendChild(renderBlock(b, ""));
          containerDiv.appendChild(headerDiv);
          const gridDiv = document.createElement("div");
          gridDiv.className = (isClover ? "layout-clover-grid pdf-clover-wrapper" : ("layout-cols-wrapper layout-cols-grid " + (targetCols === 2 ? "pdf-two-cols-wrapper layout-two-cols-grid" : (targetCols === 3 ? "pdf-three-cols-wrapper layout-three-cols-grid" : "")))) + (hasColSlots || isClover ? " has-superblock-cols" : "");
          const gridCols = isClover ? "repeat(2, minmax(0, 1fr))" : parseRatioToGridCols(fm.layoutRatio, targetCols);
          if (gridCols) gridDiv.style.gridTemplateColumns = gridCols;
          if (isClover) gridDiv.style.gridTemplateRows = "repeat(2, minmax(0, 1fr))";
          let colsList = [];
          for (let i = 0; i < targetCols; i++) colsList.push([]);
          const hasExplicitCols = rem.some((b) => b.slot && (b.slot.startsWith("col-") || b.slot === "left" || b.slot === "right" || b.slot === "center"));
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
          colsList.forEach((colBlocks, idx) => {
            const colDiv = document.createElement("div");
            colDiv.className = "pdf-col pdf-col--" + (idx + 1) + " col-" + (idx + 1) + (targetCols === 2 && idx === 0 ? " pdf-col--left" : "") + (targetCols === 2 && idx === 1 ? " pdf-col--right" : "");
            const cleaned = cleanColList(colBlocks);
            for (const b of cleaned) colDiv.appendChild(renderBlock(b, ""));
            gridDiv.appendChild(colDiv);
          });
          containerDiv.appendChild(gridDiv);
          bodyEl = containerDiv;
        } else if (layout === "two-cols") {
          bodyEl = document.createElement("div");
          bodyEl.style.display = "flex";
          bodyEl.style.flexDirection = "row";
          bodyEl.style.gap = "2rem";
          bodyEl.style.width = "100%";
          bodyEl.style.flex = "1";
          bodyEl.style.minHeight = "0";
          let leftList = [];
          let rightList = [];
          for (const b of blocks) {
            if (b.slot === "right") rightList.push(b);
            else leftList.push(b);
          }
          const leftCol = document.createElement("div");
          leftCol.className = "two-cols-left";
          const rightCol = document.createElement("div");
          rightCol.className = "two-cols-right";
          for (const b of cleanColList(leftList)) leftCol.appendChild(renderBlock(b, ""));
          for (const b of cleanColList(rightList)) rightCol.appendChild(renderBlock(b, ""));
          bodyEl.appendChild(leftCol);
          bodyEl.appendChild(rightCol);
        } else if (layout === "image-right" || layout === "image-left") {
          const isImageRight = layout === "image-right";
          bodyEl = document.createElement("div");
          bodyEl.style.display = "flex";
          bodyEl.style.flexDirection = isImageRight ? "row" : "row-reverse";
          bodyEl.style.gap = "2rem";
          bodyEl.style.width = "100%";
          bodyEl.style.flex = "1";
          bodyEl.style.minHeight = "0";
          const contentCol = document.createElement("div");
          contentCol.className = isImageRight ? "image-right-content" : "image-left-content";
          for (const b of blocks) contentCol.appendChild(renderBlock(b, ""));
          const imgCol = document.createElement("div");
          imgCol.className = isImageRight ? "image-right-img-container" : "image-left-img-container";
          const url = fm.image || fm.background || "";
          if (url) {
            const img = document.createElement("img");
            img.className = isImageRight ? "image-right-img" : "image-left-img";
            img.src = url;
            img.alt = "Slide cover";
            imgCol.appendChild(img);
          }
          bodyEl.appendChild(contentCol);
          bodyEl.appendChild(imgCol);
        } else {
          bodyEl = document.createElement("div");
          for (const b of blocks) bodyEl.appendChild(renderBlock(b, ""));
        }
        canvas.appendChild(bodyEl);
      }

      function buildOverviewCards() {
        if (overviewBuilt) return;
        overviewBuilt = true;
        const scale = OVERVIEW_CARD_W / baseWidth;
        const canvasH = Math.round(baseHeight * scale);
        slides.forEach((slide, idx) => {
          const card = document.createElement("div");
          card.className = "slides-overview-card";
          card.dataset.idx = String(idx);
          const box = document.createElement("div");
          box.className = "slides-overview-canvas-box";
          box.style.height = canvasH + "px";
          const fm = slide.frontmatter || {};
          const spacing = (fm.spacing && fm.spacing !== "inherit") ? fm.spacing : ((data.config && data.config.spacing) || "normal");
          const canvas = document.createElement("div");
          canvas.className = "slides-overview-canvas slide-content layout-" + (fm.layout || "default") + " spacing-" + spacing;
          canvas.style.width = baseWidth + "px";
          canvas.style.height = baseHeight + "px";
          canvas.style.transform = "scale(" + scale + ")";
          const bg = fm.background || (data.config && data.config.background);
          if (bg) {
            if (/^(http|\\/|data:|assets\\/)/.test(bg)) {
              canvas.style.backgroundImage = 'url("' + bg + '")';
              canvas.style.backgroundSize = "cover";
              canvas.style.backgroundPosition = "center";
            } else {
              canvas.style.background = bg;
            }
          }
          box.appendChild(canvas);
          const caption = document.createElement("div");
          caption.className = "slides-overview-caption";
          const pageNo = document.createElement("span");
          pageNo.className = "slides-overview-page-no";
          pageNo.textContent = String(idx + 1);
          caption.appendChild(pageNo);
          const title = getSlideOverviewTitle(slide);
          if (title) {
            const titleEl = document.createElement("span");
            titleEl.className = "slides-overview-title";
            titleEl.textContent = title;
            caption.appendChild(titleEl);
          }
          card.appendChild(box);
          card.appendChild(caption);
          card.addEventListener("click", (e) => {
            e.stopPropagation();
            goFromOverview(idx + 1);
          });
          overviewGrid.appendChild(card);
        });
        updateOverviewCurrentMark();
      }

      function renderOverviewThumb(card) {
        if (!card || card.dataset.rendered === "1") return;
        const idx = Number(card.dataset.idx);
        const slide = slides[idx];
        const canvas = card.querySelector(".slides-overview-canvas");
        if (slide && canvas) buildOverviewThumbInto(canvas, slide);
        card.dataset.rendered = "1";
      }

      function ensureOverviewObserver() {
        if (overviewObserver || typeof window.IntersectionObserver !== "function") return;
        overviewObserver = new IntersectionObserver((entries) => {
          for (const en of entries) {
            if (!en.isIntersecting) continue;
            overviewObserver.unobserve(en.target);
            renderOverviewThumb(en.target);
          }
        }, { rootMargin: "240px" });
      }

      function observeOverviewCards() {
        if (!overviewObserver) return;
        const cards = overviewGrid.children;
        for (let i = 0; i < cards.length; i++) {
          if (cards[i].dataset.rendered !== "1") overviewObserver.observe(cards[i]);
        }
      }

      function updateOverviewCurrentMark() {
        const cards = overviewGrid.children;
        for (let i = 0; i < cards.length; i++) {
          const pageNo = cards[i].querySelector(".slides-overview-page-no");
          if (pageNo) pageNo.classList.toggle("is-current", i === currentIndex);
        }
      }

      function setOverviewFocus(page) {
        const total = slides.length || 1;
        overviewFocus = Math.min(Math.max(1, page), total);
        const cards = overviewGrid.children;
        for (let i = 0; i < cards.length; i++) {
          cards[i].classList.toggle("is-active", i + 1 === overviewFocus);
        }
        const el = cards[overviewFocus - 1];
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }

      function getOverviewCols() {
        if (!overviewGrid || !overviewGrid.clientWidth) return 1;
        return Math.max(1, Math.round(overviewGrid.clientWidth / (OVERVIEW_CARD_W + 18)));
      }

      function goFromOverview(page) {
        const p = parseInt(page, 10);
        if (isNaN(p) || p < 1 || p > slides.length) return;
        closeOverview();
        renderSlide(p - 1);
        updateOverviewCurrentMark();
      }

      function openOverview() {
        if (slides.length === 0) return;
        buildOverviewCards();
        overviewOpen = true;
        overviewOverlay.style.display = "block";
        ensureOverviewObserver();
        if (overviewObserver) {
          observeOverviewCards();
        } else {
          const cards = overviewGrid.children;
          for (let i = 0; i < cards.length; i++) renderOverviewThumb(cards[i]);
        }
        setOverviewFocus(currentIndex + 1);
      }

      function closeOverview() {
        overviewOpen = false;
        overviewOverlay.style.display = "none";
        hideJumpIndicator();
        if (overviewObserver) {
          const cards = overviewGrid.children;
          for (let i = 0; i < cards.length; i++) overviewObserver.unobserve(cards[i]);
        }
      }

      function toggleOverview() {
        if (overviewOpen) closeOverview();
        else openOverview();
      }

      // 总览打开期间接管全部按键：修复上游总览中空格/PGUP/PGDN 仍会翻页的漏洞
      function handleOverviewKeyDown(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.isComposing || isEditableKeyTarget(e.target)) return;
        if (/^[0-9]$/.test(e.key)) {
          if (!jumpInvalid && jumpDisplay.length < 4) {
            jumpDisplay += e.key;
            const p = parseInt(jumpDisplay, 10);
            if (!isNaN(p) && p >= 1 && p <= slides.length) setOverviewFocus(p);
            renderJumpBadge();
            armJumpIdleTimer();
          }
          e.preventDefault();
          return;
        }
        if (e.key === "Enter" && jumpDisplay) {
          if (!jumpInvalid) {
            const page = parseInt(jumpDisplay, 10);
            if (!isNaN(page) && page >= 1 && page <= slides.length) {
              goFromOverview(page);
            } else {
              flashJumpInvalid();
            }
          }
          e.preventDefault();
          return;
        }
        if ((e.key === "Escape" || e.key === "Esc") && (jumpDisplay || jumpInvalid)) {
          hideJumpIndicator();
          e.preventDefault();
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setOverviewFocus(overviewFocus + 1);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setOverviewFocus(overviewFocus - 1);
          return;
        }
        if (e.key === "ArrowDown" || e.key === "PageDown") {
          e.preventDefault();
          setOverviewFocus(overviewFocus + getOverviewCols());
          return;
        }
        if (e.key === "ArrowUp" || e.key === "PageUp") {
          e.preventDefault();
          setOverviewFocus(overviewFocus - getOverviewCols());
          return;
        }
        if (e.key === " ") {
          e.preventDefault();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          goFromOverview(overviewFocus);
          return;
        }
        if (e.key === "Escape" || e.key === "Esc" || e.key === "o" || e.key === "O") {
          e.preventDefault();
          closeOverview();
        }
      }

      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "Esc") {
          if (isLightboxOpen) {
            closeLightbox();
            e.preventDefault();
            return;
          }
        }
        if (isLightboxOpen) return;
        // 总览打开期间全部按键由总览层接管
        if (overviewOpen) {
          handleOverviewKeyDown(e);
          return;
        }
        // 「数字+回车」跳页：可输入元素、修饰键、IME 组合输入中不拦截
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && !isEditableKeyTarget(e.target)) {
          if (/^[0-9]$/.test(e.key)) {
            if (!jumpInvalid && jumpDisplay.length < 4) {
              jumpDisplay += e.key;
              renderJumpBadge();
              armJumpIdleTimer();
            }
            e.preventDefault();
            return;
          }
          if (e.key === "Enter" && jumpDisplay) {
            if (!jumpInvalid) {
              const page = parseInt(jumpDisplay, 10);
              if (!isNaN(page) && page >= 1 && page <= slides.length) {
                hideJumpIndicator();
                renderSlide(page - 1);
              } else {
                flashJumpInvalid();
              }
            }
            e.preventDefault();
            return;
          }
          if ((e.key === "Escape" || e.key === "Esc") && (jumpDisplay || jumpInvalid)) {
            hideJumpIndicator();
            e.preventDefault();
            return;
          }
          if (e.key === "o" || e.key === "O") {
            e.preventDefault();
            toggleOverview();
            return;
          }
        }
        if (e.key === "ArrowRight" || e.key === " " || e.key === "ArrowDown") goNext();
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
        if (e.key === "f" || e.key === "F") btnFullscreen.click();
      });

      // 监听鼠标滚轮上下翻页调度
      let lastWheelTime = 0;
      const WHEEL_COOLDOWN_MS = 280;
      const WHEEL_DELTA_THRESHOLD = 15;

`;
}
