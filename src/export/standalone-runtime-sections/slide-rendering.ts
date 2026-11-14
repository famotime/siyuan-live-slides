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

        function isLightColor(colorStr) {
          if (!colorStr || typeof colorStr !== 'string') return null;
          const s = colorStr.trim().toLowerCase();
          if (!s) return null;
          if (/^(?:https?:\\/\\/|\\/|data:|assets\\/|\\.\\/assets\\/|url\\s*\\()/i.test(s)) return null;
          const lightNamed = ['white', 'snow', 'ivory', 'ghostwhite', 'floralwhite', 'aliceblue', 'whitesmoke', 'seashell', 'beige', 'oldlace', 'linen', 'antiquewhite', 'lightyellow', 'lightcyan', 'papayawhip', 'blanchedalmond', 'cornsilk', 'lavender', 'lavenderblush', 'lemonchiffon', 'honeydew', 'mintcream', 'azure', 'mistyrose', 'wheat', 'lightgoldenrodyellow', 'palegoldenrod', 'gainsboro', 'lightgrey', 'lightgray', 'silver', 'pink', 'lightpink', 'peachpuff', 'navajowhite', 'moccasin', 'bisque', 'khaki', 'palegreen', 'lightgreen', 'lightblue', 'powderblue', 'paleturquoise', 'lightsteelblue', 'thistle', 'yellow', 'cyan', 'aqua'];
          const darkNamed = ['black', 'transparent', 'navy', 'darkblue', 'midnightblue', 'darkslategray', 'darkslategrey', 'maroon', 'darkred', 'darkgreen', 'indigo', 'darkslateblue', 'dimgray', 'dimgrey', 'purple', 'brown', 'olive', 'teal', 'blue', 'darkviolet', 'darkmagenta', 'darkcyan', 'darkolivegreen', 'saddlebrown', 'sienna', 'firebrick', 'crimson', 'mediumblue', 'rebeccapurple'];
          if (lightNamed.includes(s)) return true;
          if (darkNamed.includes(s)) return false;

          function calcLum(r, g, b) {
            return 0.299 * r + 0.587 * g + 0.114 * b;
          }
          function parseHexLum(hexRaw) {
            let hex = hexRaw.startsWith('#') ? hexRaw.slice(1) : hexRaw;
            if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).split('').map(c => c + c).join('');
            if (hex.length >= 6) {
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return calcLum(r, g, b);
            }
            return null;
          }
          function parseRgbLum(rgbStr) {
            const m = rgbStr.match(/rgba?\\s*\\(\\s*(\\d+(?:\\.\\d+)?)\\s*[,\\s]\\s*(\\d+(?:\\.\\d+)?)\\s*[,\\s]\\s*(\\d+(?:\\.\\d+)?)(?:\\s*[,\\/]\\s*([0-9.]+%?))?/i);
            if (!m) return null;
            const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
            if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
            if (m[4] !== undefined) {
              const a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
              if (!isNaN(a) && a <= 0.05) return null;
            }
            return calcLum(r, g, b);
          }
          function parseHslLum(hslStr) {
            const m = hslStr.match(/hsla?\\s*\\(\\s*([0-9.]+)(?:deg)?\\s*[,\\s]\\s*([0-9.]+)%\\s*[,\\s]\\s*([0-9.]+)%(?:\\s*[,\\/]\\s*([0-9.]+%?))?/i);
            if (!m) return null;
            if (m[4] !== undefined) {
              const a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
              if (!isNaN(a) && a <= 0.05) return null;
            }
            const h = (((Number(m[1]) % 360) + 360) % 360) / 360;
            const sat = Math.max(0, Math.min(1, Number(m[2]) / 100));
            const lig = Math.max(0, Math.min(1, Number(m[3]) / 100));
            let r, g, b;
            if (sat === 0) {
              r = g = b = lig * 255;
            } else {
              const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
              const p = 2 * lig - q;
              const hue2rgb = (t) => {
                let tt = t;
                if (tt < 0) tt += 1;
                if (tt > 1) tt -= 1;
                if (tt < 1 / 6) return p + (q - p) * 6 * tt;
                if (tt < 1 / 2) return q;
                if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
                return p;
              };
              r = hue2rgb(h + 1 / 3) * 255;
              g = hue2rgb(h) * 255;
              b = hue2rgb(h - 1 / 3) * 255;
            }
            return calcLum(r, g, b);
          }

          if (s.startsWith('#')) {
            const lum = parseHexLum(s);
            return lum === null ? null : lum > 140;
          }
          if (/^rgba?\\s*\\(/i.test(s)) {
            const lum = parseRgbLum(s);
            return lum === null ? null : lum > 140;
          }
          if (/^hsla?\\s*\\(/i.test(s)) {
            const lum = parseHslLum(s);
            return lum === null ? null : lum > 140;
          }
          if (/(?:linear|radial|conic)-gradient\\s*\\(/i.test(s)) {
            const luminances = [];
            const hexMatches = s.match(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\\b/gi);
            if (hexMatches) {
              for (const h of hexMatches) {
                const lum = parseHexLum(h);
                if (lum !== null) luminances.push(lum);
              }
            }
            const rgbMatches = s.match(/rgba?\\s*\\([^)]+\\)/gi);
            if (rgbMatches) {
              for (const r of rgbMatches) {
                const lum = parseRgbLum(r);
                if (lum !== null) luminances.push(lum);
              }
            }
            const hslMatches = s.match(/hsla?\\s*\\([^)]+\\)/gi);
            if (hslMatches) {
              for (const h of hslMatches) {
                const lum = parseHslLum(h);
                if (lum !== null) luminances.push(lum);
              }
            }
            const stripped = s.replace(/#[0-9a-f]+|rgba?\\([^)]+\\)|hsla?\\([^)]+\\)/gi, ' ');
            const wordMatches = stripped.match(/\\b[a-z]+\\b/gi);
            if (wordMatches) {
              for (const w of wordMatches) {
                if (w === 'transparent') continue;
                if (lightNamed.includes(w)) luminances.push(240);
                else if (darkNamed.includes(w)) luminances.push(20);
              }
            }
            if (luminances.length > 0) {
              const avg = luminances.reduce((acc, v) => acc + v, 0) / luminances.length;
              return avg > 140;
            }
            if (/\\btransparent\\b/.test(s)) return false;
          }
          return null;
        }

        const slideBg = slide.frontmatter?.background || (data.config && data.config.background);
        const isLightBg = isLightColor(slideBg);
        const curTheme = data.config?.theme || "default";
        if (slideBg) {
          if (/^(http|\\/|data:|assets\\/)/.test(slideBg)) {
            container.style.backgroundImage = 'url("' + slideBg + '")';
            container.style.backgroundSize = "cover";
            container.style.backgroundPosition = "center";
          } else {
            container.style.backgroundImage = "none";
            container.style.background = slideBg;
          }
        } else {
          container.style.backgroundImage = "none";
          container.style.background = "";
        }
        if (isLightBg === true) {
          if (viewport) viewport.setAttribute("data-theme", "light");
          const textColor = curTheme === "apple-basic" ? "#000000" : (curTheme === "seriph" ? "#231f1d" : "#0f172a");
          container.style.color = textColor;
          container.style.setProperty("--slide-text", textColor);
        } else if (isLightBg === false) {
          if (viewport) viewport.setAttribute("data-theme", "dark");
          const textColor = curTheme === "apple-basic" ? "#ffffff" : (curTheme === "seriph" ? "#f5f2eb" : "#f1f5f9");
          container.style.color = textColor;
          container.style.setProperty("--slide-text", textColor);
        } else {
          const fallbackSchema = (data.config?.colorSchema === "light" || data.config?.colorSchema === "dark")
            ? data.config.colorSchema
            : (data.config?.hostThemeMode || null);
          if (viewport) {
            if (fallbackSchema === "light" || fallbackSchema === "dark") {
              viewport.setAttribute("data-theme", fallbackSchema);
            } else {
              viewport.removeAttribute("data-theme");
            }
          }
          container.style.color = "";
          container.style.removeProperty("--slide-text");
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
          const isHeaderEnabled = slide.frontmatter?.header !== false;
          let headerBlocks = isHeaderEnabled ? blocks.filter(b => b.slot === "header") : [];
          if (isHeaderEnabled && headerBlocks.length === 0 && blocks.length > 0) {
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
        } else if (slide.frontmatter?.layout === "fact") {
          const validBlocks = (slide.blocks || []).filter(b => b.slot !== "slot-divider-right" && (b.rawMarkdown || b.content || "").trim());
          let headerBlocks = [];
          const explicitHeader = validBlocks.filter(b => b.slot === "header");
          const isFirstH = validBlocks.length >= 2 && isHeadingBlock(validBlocks[0]);
          const hasSubsequentList = validBlocks.length >= 2 && (validBlocks[1].type === "l" || (validBlocks[1].children && validBlocks[1].children.length > 0) || /^(\s*)(?:[-*+]|\d+\.)\s+/m.test(validBlocks[1].rawMarkdown || ""));

          if (explicitHeader.length > 0) {
            headerBlocks = explicitHeader;
          } else if (isFirstH && (hasSubsequentList || validBlocks.length >= 3)) {
            headerBlocks = [validBlocks[0]];
          }

          const rem = validBlocks.filter(b => !headerBlocks.includes(b));
          let cards = [];

          const rawLines = [];
          if (rem.length === 1 && rem[0].children && rem[0].children.length >= 1) {
            for (const c of rem[0].children) rawLines.push((c.rawMarkdown || c.content || "").trim());
          } else if (rem.length === 1) {
            const lines = (rem[0].rawMarkdown || rem[0].content || "").trim().split(/[\\r\\n]+/);
            for (const line of lines) {
              if (/^[\\s]*(?:[-*+]|\\d+\\.)[\\s]+/.test(line)) rawLines.push(line.trim());
            }
          }

          if (rawLines.length > 0) {
            cards = rawLines.map((line) => {
              const cl = cleanCardListItemMarkdown(line).trim();
              const m = cl.match(/^([^\\n:：]+?)(?:[\\s]*[:：][\\s]*)([\\s\\S]+)$/);
              return m ? { val: m[1].trim(), lbl: m[2].trim() } : { val: cl, lbl: "" };
            });
          } else if (rem.length >= 2 && rem.length % 2 === 0) {
            for (let i = 0; i < rem.length; i += 2) {
              cards.push({
                val: cleanCardListItemMarkdown(rem[i].rawMarkdown || rem[i].content || "").trim(),
                lbl: cleanCardListItemMarkdown(rem[i + 1].rawMarkdown || rem[i + 1].content || "").trim(),
              });
            }
          } else if (rem.length > 0) {
            const firstCl = cleanCardListItemMarkdown(rem[0].rawMarkdown || rem[0].content || "").trim();
            const m = firstCl.match(/^([^\\n:：]+?)(?:[\\s]*[:：][\\s]*)([\\s\\S]+)$/);
            if (m) cards.push({ val: m[1].trim(), lbl: m[2].trim() });
            else cards.push({ val: firstCl, lbl: rem.slice(1).map(b => cleanCardListItemMarkdown(b.rawMarkdown || b.content || "").trim()).join("\\n") });
          }

          const colsCount = Math.max(1, Math.min(4, cards.length));
          const factContainer = document.createElement("div");
          factContainer.className = "layout-fact-container layout-fact-cols-" + colsCount;
          factContainer.style.setProperty("--fact-cols", String(colsCount));

          const glow = document.createElement("div");
          glow.className = "fact-hero-glow";
          glow.setAttribute("aria-hidden", "true");
          factContainer.appendChild(glow);

          if (headerBlocks.length > 0) {
            const headerDiv = document.createElement("div");
            headerDiv.className = "layout-header-section";
            for (const hb of headerBlocks) {
              headerDiv.appendChild(renderBlock(hb, "slides-page-first-heading-block"));
            }
            factContainer.appendChild(headerDiv);
          }

          const box = document.createElement("div");
          box.className = "fact-content-box fact-stats-grid fact-stats-grid--cols-" + colsCount;

          cards.forEach((c) => {
            const cardEl = document.createElement("div");
            cardEl.className = "fact-stat-card";

            const valWrap = document.createElement("div");
            valWrap.className = "fact-value-wrapper fact-value-box";
            const valText = document.createElement("div");
            valText.className = "fact-value-text";
            valText.textContent = c.val;
            valWrap.appendChild(valText);
            cardEl.appendChild(valWrap);

            if (c.lbl) {
              const divLine = document.createElement("div");
              divLine.className = "fact-divider-line";
              cardEl.appendChild(divLine);

              const lblWrap = document.createElement("div");
              lblWrap.className = "fact-label-wrapper fact-label-box";
              const lblText = document.createElement("div");
              lblText.className = "fact-label-text";
              lblText.textContent = c.lbl;
              lblWrap.appendChild(lblText);
              cardEl.appendChild(lblWrap);
            }

            box.appendChild(cardEl);
          });

          factContainer.appendChild(box);
          container.appendChild(factContainer);
        } else if (slide.frontmatter?.layout === "timeline" || slide.frontmatter?.layout === "steps") {
          const blocks = (slide.blocks || []).filter(b => b.slot !== "slot-divider-right");
          const isHeaderEnabled = slide.frontmatter?.header !== false;
          let headerBlocks = isHeaderEnabled ? blocks.filter(b => b.slot === "header") : [];
          if (isHeaderEnabled && headerBlocks.length === 0 && blocks.length > 0) {
            const candidate = blocks.find(b => b.type === "h" && (!b.slot || b.slot === "default"));
            if (candidate) headerBlocks = [candidate];
          }
          const rem = blocks.filter(b => !headerBlocks.includes(b));

          const tlContainer = document.createElement("div");
          tlContainer.className = "layout-timeline-container layout-steps-container";

          if (headerBlocks.length > 0) {
            const headerDiv = document.createElement("div");
            headerDiv.className = "layout-header-section";
            for (const hb of headerBlocks) {
              headerDiv.appendChild(renderBlock(hb, "slides-page-first-heading-block"));
            }
            tlContainer.appendChild(headerDiv);
          }

          let stepItems = rem;
          if (rem.length === 1 && rem[0].children && rem[0].children.length >= 2) {
            stepItems = rem[0].children;
          }

          const track = document.createElement("div");
          track.className = "timeline-track-wrapper";
          track.style.setProperty("--timeline-steps", String(Math.max(1, Math.min(6, stepItems.length))));

          stepItems.forEach((item, idx) => {
            const stepNum = idx + 1;
            const itemEl = document.createElement("div");
            itemEl.className = "timeline-step-item";
            itemEl.style.setProperty("--step-index", String(stepNum));

            const nodeContainer = document.createElement("div");
            nodeContainer.className = "timeline-node-container";

            const badge = document.createElement("div");
            badge.className = "timeline-node-badge";
            badge.textContent = String(stepNum);
            nodeContainer.appendChild(badge);

            if (idx < stepItems.length - 1) {
              const line = document.createElement("div");
              line.className = "timeline-connector-line";
              nodeContainer.appendChild(line);
            }
            itemEl.appendChild(nodeContainer);

            const contentEl = document.createElement("div");
            contentEl.className = "timeline-step-content";
            contentEl.appendChild(renderBlock(item, ""));
            itemEl.appendChild(contentEl);

            track.appendChild(itemEl);
          });

          tlContainer.appendChild(track);
          container.appendChild(tlContainer);
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

        function runSlideAnimations(container) {
          if (!container) return;
          const animNodes = container.querySelectorAll("[data-slides-anim]");
          animNodes.forEach(node => {
            if (node.classList.contains("v-click-hidden")) return;
            const animType = node.getAttribute("data-slides-anim");
            if (animType === "countup") {
              const targetEl = node.querySelector(".slides-countup-target") || node.querySelector("p, h1, h2, h3, h4, h5, h6, span, strong") || node;
              if (!targetEl.getAttribute("data-anim-original")) {
                targetEl.setAttribute("data-anim-original", targetEl.textContent || "");
              }
              const toVal = parseFloat(node.getAttribute("data-countup-to") || "0");
              const fromVal = parseFloat(node.getAttribute("data-countup-from") || "0");
              const durationVal = parseInt(node.getAttribute("data-anim-duration") || "1500", 10);
              const decimalsVal = parseInt(node.getAttribute("data-countup-decimals") || "0", 10);
              const prefixVal = node.getAttribute("data-countup-prefix") || "";
              const suffixVal = node.getAttribute("data-countup-suffix") || "";
              const startTime = performance.now();
              const easeOutExpo = t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
              function update(now) {
                const elapsed = now - startTime;
                const progress = Math.min(1, Math.max(0, elapsed / durationVal));
                const current = fromVal + (toVal - fromVal) * easeOutExpo(progress);
                targetEl.textContent = prefixVal + current.toFixed(decimalsVal) + suffixVal;
                if (progress < 1) {
                  requestAnimationFrame(update);
                }
              }
              targetEl.textContent = prefixVal + fromVal.toFixed(decimalsVal) + suffixVal;
              requestAnimationFrame(update);
            } else if (animType === "typewriter") {
              const targetEl = node.querySelector("p, h1, h2, h3, h4, h5, h6, span, code") || node;
              if (!targetEl.getAttribute("data-anim-original")) {
                targetEl.setAttribute("data-anim-original", targetEl.textContent || "");
              }
              const fullText = targetEl.getAttribute("data-anim-original") || targetEl.textContent || "";
              const durationVal = parseInt(node.getAttribute("data-anim-duration") || "1500", 10);
              const stepMs = durationVal / Math.max(fullText.length, 1);
              let idx = 0;
              targetEl.textContent = "";
              function step() {
                idx++;
                targetEl.textContent = fullText.slice(0, idx);
                if (idx < fullText.length) {
                  setTimeout(step, stepMs);
                }
              }
              setTimeout(step, stepMs);
            }
          });
        }
        runSlideAnimations(stage);
      }

      // Lightbox 控制逻辑
      const lightbox = document.getElementById("slides-lightbox");
      const lightboxContent = document.getElementById("lightbox-content");
      const lightboxClose = document.getElementById("lightbox-close");
      let isLightboxOpen = false;

`;
}
