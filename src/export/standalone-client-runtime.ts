/**
 * 生成离线单文件独立 HTML 演示包内置的原生客户端播放器运行时脚本
 */
export function getStandaloneClientRuntimeScript(): string {
  return `    (function() {
      const data = window.__SLIDEV_DATA__ || { slides: [] };
      const slides = data.slides || [];
      let currentIndex = 0;

      const container = document.getElementById("slide-container");
      const pageNum = document.getElementById("page-num");
      const btnPrev = document.getElementById("btn-prev");
      const btnNext = document.getElementById("btn-next");
      const btnFullscreen = document.getElementById("btn-fullscreen");

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

      function updateScale() {
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

      function cleanCardListItemMarkdown(rawMarkdown) {
        if (!rawMarkdown) return "";
        let cleaned = rawMarkdown.replace(/^[ \t]*[-*+]\s+|^[ \t]*\d+\.\s+/, "");
        cleaned = cleaned.replace(/\n[ \t]{2,4}/g, "\n");
        return cleaned.trim();
      }

      function isHeadingBlock(b) {
        if (!b) return false;
        if (b.type === "h" || b.type === "NodeHeading") return true;
        if (b.subType && /^h[1-6]$/i.test(b.subType)) return true;
        const md = (b.rawMarkdown || b.content || "").trim();
        if (/^#{1,6}\s+/.test(md)) return true;
        if (/^(?:[-*+]|\d+\.)\s+#{1,6}\s+/.test(md)) return true;
        return false;
      }

      function cleanColList(blocks) {
        const valid = (blocks || []).filter(b => Boolean((b.rawMarkdown || b.content || "").trim()));
        if (valid.length === 0) return valid;
        const first = valid[0];
        const md = (first.rawMarkdown || first.content || "").trim();
        const isList = /^(?:[-*+]|\d+\.)\s+/.test(md) || first.type === "i" || first.type === "l";
        if (isList) {
          first.rawMarkdown = cleanCardListItemMarkdown(first.rawMarkdown || first.content || "");
          first.content = first.rawMarkdown;
        }
        return valid;
      }

      function renderBlock(block, extraClass) {
        const div = document.createElement("div");
        div.className = "slide-block" + (extraClass ? " " + extraClass : "");
        if (block && block.motion && block.motion.preset && block.motion.preset !== "none") {
          div.classList.add("slidev-motion-" + block.motion.preset.toLowerCase());
          if (typeof block.motion.duration === "number" && block.motion.duration > 0) {
            div.style.setProperty("--motion-duration", block.motion.duration + "ms");
          }
          if (typeof block.motion.delay === "number" && block.motion.delay > 0) {
            div.style.setProperty("--motion-delay", block.motion.delay + "ms");
          }
        }
        const md = block.rawMarkdown || block.content || "";

        if (md.includes('class="slidev-block-ref"') || md.includes('class="slidev-ref-tag"')) {
          div.innerHTML = md;
          return div;
        }

        const CARBON_MAP = {
          'carbon:arrow-right': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="m18 6l-1.43 1.393L24.15 15H4v2h20.15l-7.58 7.573L18 26l10-10z"/></svg>',
          'carbon:arrow-left': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="m14 26l1.43-1.393L7.85 17H28v-2H7.85l7.58-7.573L14 6L4 16z"/></svg>',
          'carbon:edit': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="M2 26h28v2H2zM25.4 9c.8-.8.8-2 0-2.8l-3.6-3.6c-.8-.8-2-.8-2.8 0l-15 15V24h6.4l15-15zM20.4 4L24 7.6l-2.4 2.4l-3.6-3.6L20.4 4zM6 22v-3.6l11-11l3.6 3.6l-11 11H6z"/></svg>',
          'carbon:logo-github': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path fill-rule="evenodd" d="M16 2a14 14 0 0 0-4.43 27.28c.7.13 1-.3 1-.67v-2.38c-3.89.84-4.71-1.88-4.71-1.88a3.7 3.7 0 0 0-1.56-2.05c-1.27-.86.1-.85.1-.85a2.94 2.94 0 0 1 2.14 1.44a3 3 0 0 0 4.08 1.16a2.93 2.93 0 0 1 .89-1.87c-3.1-.35-6.36-1.55-6.36-6.9a5.4 5.4 0 0 1 1.44-3.75a5 5 0 0 1 .14-3.71s1.17-.38 3.85 1.43a13.3 13.3 0 0 1 7 0c2.67-1.81 3.84-1.43 3.84-1.43a5 5 0 0 1 .14 3.71a5.4 5.4 0 0 1 1.44 3.75c0 5.37-3.27 6.54-6.38 6.89a3.35 3.35 0 0 1 1.26 2.61v3.87c0 .38.26.81 1 .67A14 14 0 0 0 16 2"/></svg>'
        };

        if (/@\\w+=['"]|v-\\w+|<button|<a\\b|<carbon:|^<div/i.test(md)) {
          if (md.includes('abs-br') || md.includes('abs-bl') || md.includes('abs-tr') || md.includes('abs-tl') || md.includes('absolute')) {
            div.classList.add("slide-block--absolute");
          }
          let renderedHtml = md;
          for (const [tag, svg] of Object.entries(CARBON_MAP)) {
            const regex = new RegExp("<" + tag + "\\\\s*\\\\/?>", "gi");
            renderedHtml = renderedHtml.replace(regex, svg);
            const regexDash = new RegExp("<" + tag.replace(":", "-") + "\\\\s*\\\\/?>", "gi");
            renderedHtml = renderedHtml.replace(regexDash, svg);
          }
          div.innerHTML = renderedHtml;

          // 挂载交互事件监听
          const nextBtns = div.querySelectorAll('[\\\\@click*="nav.next"], [\\\\@click*="next"]');
          nextBtns.forEach(btn => {
            btn.style.cursor = "pointer";
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              renderSlide(currentIndex + 1);
            });
          });

          const prevBtns = div.querySelectorAll('[\\\\@click*="nav.prev"], [\\\\@click*="prev"]');
          prevBtns.forEach(btn => {
            btn.style.cursor = "pointer";
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              renderSlide(currentIndex - 1);
            });
          });

          return div;
        }

        const hasHeadingTag = /(?:^|\n)\s*#{1,6}\s+/.test(md);
        const hMatch = md.match(/^(#{1,6})\\s+(.*)$/);

        if (hMatch) {
          const level = hMatch[1].length;
          let th = hMatch[2].trim().replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
          div.innerHTML = "<h" + level + ">" + th + "</h" + level + ">";
        }
        else if (md.startsWith("\`\`\`")) {
          const customMaxHeight = block?.attributes?.["custom-slidev-max-height"] || block?.attrs?.["custom-slidev-max-height"] || block?.maxHeight || "";
          const heightStyle = customMaxHeight ? ' style="max-height:' + customMaxHeight + ';overflow-y:auto;"' : "";
          div.innerHTML = "<pre" + heightStyle + "><code>" + md.slice(3, -3) + "</code></pre>";
        }
        else if (md.startsWith("> ")) div.innerHTML = "<blockquote><p>" + md.slice(2) + "</p></blockquote>";
        else if ((/<video\b/i.test(md) || (block && (block.type === "video" || block.type === "NodeVideo"))) && !/^(\s*)([-*+]|\d+\.)\s+/m.test(md) && !hasHeadingTag && !md.includes("\n")) {
          div.classList.add("slide-video-container", "slide-media-container", "slide-media-block");
          const isAutoplay = block && block.attributes && block.attributes["custom-slidev-autoplay"] === "true";
          const isLoop = block && block.attributes && block.attributes["custom-slidev-loop"] === "true";
          const isMuted = block && block.attributes && (block.attributes["custom-slidev-muted"] === "true" || isAutoplay);
          const hideControls = block && block.attributes && block.attributes["custom-slidev-controls"] === "false";
          let videoHtml = md;
          if (hideControls) videoHtml = videoHtml.replace(/\bcontrols(?:="[^"]*")?/gi, "").trim();
          else if (!videoHtml.includes("controls")) videoHtml = videoHtml.replace("<video", "<video controls");
          if (isAutoplay && !videoHtml.includes("autoplay")) videoHtml = videoHtml.replace("<video", "<video autoplay playsinline");
          if (isLoop && !videoHtml.includes("loop")) videoHtml = videoHtml.replace("<video", "<video loop");
          if (isMuted && !videoHtml.includes("muted")) videoHtml = videoHtml.replace("<video", "<video muted");
          videoHtml = videoHtml.replace("<video", '<video class="slide-video-player"');
          div.setAttribute("data-autoplay", isAutoplay ? "true" : "false");
          div.innerHTML = videoHtml;
        }
        else if (/^(\s*)([-*+]|\d+\.)\s+/m.test(md) || (md.includes("\n") && /^(\s*)([-*+]|\d+\.)\s+/m.test(md.split("\n").slice(1).join("\n")))) {
          div.classList.add("pdf-list-item");
          const lines = md.split("\n");
          let isOrdered = false;
          const items = [];
          const leadLines = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const tr = line.trim();
            if (!tr || /^\{:.*?\}$/.test(tr)) continue;
            const um = line.match(/^(\s*)[-*+]\s+(.*)$/);
            const om = line.match(/^(\s*)\d+\.\s+(.*)$/);
            if (um) {
              const indent = um[1].length;
              items.push({ type: "unordered", level: Math.floor(indent / 2), text: um[2], media: [] });
              continue;
            }
            if (om) {
              if (items.length === 0) isOrdered = true;
              const indent = om[1].length;
              items.push({ type: "ordered", level: Math.floor(indent / 2), text: om[2], media: [] });
              continue;
            }
            if (items.length > 0) {
              const im = tr.match(/^!\[(.*?)\]\((.*?)\)(?:\{:?[^}]*\})?$/);
              if (im) {
                const isGif = /\.gif(?:\?|$)/i.test(im[2]);
                items[items.length - 1].media.push('<div class="slide-list-media"><img alt="' + im[1] + '" src="' + im[2] + '" class="' + (isGif ? 'list-item-gif' : 'list-item-img') + '" /></div>');
                continue;
              }
              const hm = tr.match(/^<img\b[\s\S]*?\/?>$/i);
              if (hm) {
                const cleanTr = tr.replace(/\s+style="[^"]*"/gi, "");
                items[items.length - 1].media.push('<div class="slide-list-media">' + cleanTr + '</div>');
                continue;
              }
              if (/<video\b/i.test(tr)) {
                let vHtml = tr;
                if (!/<\/video>/i.test(vHtml)) {
                  while (i + 1 < lines.length && !/<\/video>/i.test(vHtml)) {
                    i++;
                    vHtml += " " + lines[i].trim();
                  }
                }
                const isAutoplay = block && block.attributes && block.attributes["custom-slidev-autoplay"] === "true";
                const isLoop = block && block.attributes && block.attributes["custom-slidev-loop"] === "true";
                const isMuted = block && block.attributes && (block.attributes["custom-slidev-muted"] === "true" || isAutoplay);
                const hideControls = block && block.attributes && block.attributes["custom-slidev-controls"] === "false";
                if (hideControls) vHtml = vHtml.replace(/\bcontrols(?:="[^"]*")?/gi, "").trim();
                else if (!vHtml.includes("controls")) vHtml = vHtml.replace("<video", "<video controls");
                if (isAutoplay && !vHtml.includes("autoplay")) vHtml = vHtml.replace("<video", "<video autoplay playsinline");
                if (isLoop && !vHtml.includes("loop")) vHtml = vHtml.replace("<video", "<video loop");
                if (isMuted && !vHtml.includes("muted")) vHtml = vHtml.replace("<video", "<video muted");
                vHtml = vHtml.replace("<video", '<video class="slide-video-player"');
                items[items.length - 1].media.push('<div class="slide-list-media slide-video-container slide-media-container" data-autoplay="' + (isAutoplay ? 'true' : 'false') + '">' + vHtml + '</div>');
                continue;
              }
              items[items.length - 1].text += "\n" + tr;
            } else {
              leadLines.push(tr);
            }
          }

          let leadHtml = "";
          if (leadLines.length > 0) {
            const lParts = [];
            const firstL = leadLines[0];
            const fhm = firstL.match(/^(#{1,6})\s+(.*)$/);
            if (fhm) {
              const lvl = fhm[1].length;
              let th = fhm[2].trim().replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
              lParts.push('<h' + lvl + ' class="slide-list-item-title">' + th + '</h' + lvl + '>');
            } else {
              let th = firstL.trim().replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
              lParts.push('<p class="slide-list-item-title">' + th + '</p>');
            }
            if (leadLines.length > 1) {
              const dLines = leadLines.slice(1);
              let pL = [];
              const flushLeadP = () => {
                if (pL.length > 0) {
                  let txt = pL.map(l => l.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>")).join("<br/>");
                  lParts.push('<p class="slide-list-item-desc">' + txt + '</p>');
                  pL = [];
                }
              };
              for (const l of dLines) {
                const hm = l.match(/^(#{1,6})\s+(.*)$/);
                if (hm) {
                  flushLeadP();
                  const lvl = hm[1].length;
                  let th = hm[2].trim().replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
                  lParts.push('<h' + lvl + ' class="slide-list-item-title">' + th + '</h' + lvl + '>');
                } else {
                  pL.push(l);
                }
              }
              flushLeadP();
            }
            leadHtml = lParts.join("\n") + "\n";
          }

          const tag = isOrdered ? "ol" : "ul";
          const listCls = isOrdered ? "pdf-list pdf-list--ordered" : "pdf-list pdf-list--unordered";
          const liHtml = items.map(it => {
            const med = it.media && it.media.length ? "\n" + it.media.join("\n") : "";
            const lines = (it.text || "").split("\n").map(l => l.trim()).filter(Boolean);
            const hasHeading = lines.some(l => /^#{1,6}\s+/.test(l));
            const lvl = it.level || 0;
            const nStyle = lvl > 0 ? ' style="margin-left:' + (lvl * 1.25).toFixed(2) + 'em;' + (it.type === 'unordered' ? 'list-style-type:' + (lvl % 2 === 1 ? 'circle' : 'square') + ' !important;' : '') + '"' : "";
            const nClass = lvl > 0 ? " slide-list-item--nested" : "";
            const clsAttr = nClass ? ' class="' + nClass.trim() + '"' : "";
            if (!hasHeading) {
              let h = lines.map(l => l.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>")).join("<br/>");
              return '<li' + clsAttr + nStyle + '>' + h + med + '</li>';
            }
            const parts = [];
            let pLines = [];
            const flushP = () => {
              if (pLines.length > 0) {
                let ph = pLines.map(l => l.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>")).join("<br/>");
                parts.push('<p class="slide-list-item-desc">' + ph + '</p>');
                pLines = [];
              }
            };
            for (const l of lines) {
              const hm = l.match(/^(#{1,6})\s+(.*)$/);
              if (hm) {
                flushP();
                const hl = hm[1].length;
                let th = hm[2].trim().replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
                parts.push('<h' + hl + ' class="slide-list-item-title">' + th + '</h' + hl + '>');
              } else {
                pLines.push(l);
              }
            }
            flushP();
            return '<li' + clsAttr + nStyle + '>' + parts.join("\n") + med + '</li>';
          }).join("\n");
          div.innerHTML = leadHtml + "<" + tag + " class=\"" + listCls + "\">\n" + liHtml + "\n</" + tag + ">";
        }
        else {
          // 复合块（包含换行、标题或媒体）高保真解析
          const lines = md.split(/\r?\n/);
          const subBlocks = [];
          let current = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (/^#{1,6}\s+/.test(trimmed)) {
              if (current.length > 0) { subBlocks.push(current.join("\n")); current = []; }
              subBlocks.push(trimmed);
              continue;
            }
            if (!trimmed) {
              if (current.length > 0) { subBlocks.push(current.join("\n")); current = []; }
              continue;
            }
            if (/^!\[.*?\]\(.*?\)$/.test(trimmed)) {
              if (current.length > 0) { subBlocks.push(current.join("\n")); current = []; }
              subBlocks.push(trimmed);
              continue;
            }
            if (/<video\b/i.test(trimmed)) {
              if (current.length > 0) { subBlocks.push(current.join("\n")); current = []; }
              let vRaw = trimmed;
              if (!/<\/video>/i.test(vRaw)) {
                while (i + 1 < lines.length && !/<\/video>/i.test(vRaw)) {
                  i++;
                  vRaw += "\n" + lines[i];
                }
              }
              subBlocks.push(vRaw);
              continue;
            }
            current.push(line);
          }
          if (current.length > 0) subBlocks.push(current.join("\n"));

          if (subBlocks.length > 1 || (subBlocks.length === 1 && /^#{1,6}\s+/.test(subBlocks[0].trim()))) {
            let isFirstParagraph = true;
            const htmlParts = subBlocks.map(sub => {
              const t = sub.trim();
              if (!t) return "";
              const hm = t.match(/^(#{1,6})\s+(.*)$/);
              if (hm) {
                isFirstParagraph = false;
                const hl = hm[1].length;
                let th = hm[2].trim().replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
                return '<h' + hl + ' class="slide-list-item-title">' + th + '</h' + hl + '>';
              }
              const im = t.match(/^!\[(.*?)\]\((.*?)\)$/);
              if (im) {
                return '<div class="slide-media-block slide-media-container slide-list-media"><img alt="' + im[1] + '" src="' + im[2] + '" class="slide-media-img" /></div>';
              }
              if (/<video\b/i.test(t)) {
                return '<div class="slide-media-block slide-video-container slide-media-container">' + t + '</div>';
              }
              if (isFirstParagraph) {
                isFirstParagraph = false;
                const subLines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                if (subLines.length === 1) {
                  let ph = subLines[0].replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
                  return '<p class="slide-list-item-title">' + ph + '</p>';
                }
                let titleHtml = subLines[0].replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
                let descHtml = subLines.slice(1).map(l => l.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>")).join("<br/>");
                return '<p class="slide-list-item-title">' + titleHtml + '</p>\n<p class="slide-list-item-desc">' + descHtml + '</p>';
              }
              let ph = t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
              return '<p class="slide-list-item-desc">' + ph + '</p>';
            }).filter(Boolean);
            div.innerHTML = htmlParts.join("\n");
          } else {
            const imgMatch = md.match(/!\\[(.*?)\\]\\((.*?)\\)/);
            if (imgMatch) {
              div.classList.add("slide-media-container", "slide-media-block", "slide-block--image");
              div.innerHTML = '<img alt="' + imgMatch[1] + '" src="' + imgMatch[2] + '" class="slide-media-img" />';
            } else {
              let html = md.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
              const pCls = (block && block.isColFirst) ? ' class="slide-list-item-title"' : '';
              div.innerHTML = "<p" + pCls + ">" + html + "</p>";
            }
          }
        }
        return div;
      }

      function renderSlide(idx) {
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

        if (slide.frontmatter?.layout === "two-cols") {
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
          for (const b of leftList) leftCol.appendChild(renderBlock(b, b === leftFirstH ? "slidev-col-first-heading-block" : ""));
          for (const b of rightList) rightCol.appendChild(renderBlock(b, b === rightFirstH ? "slidev-col-first-heading-block" : ""));
          container.appendChild(leftCol);
          container.appendChild(rightCol);
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
          gridDiv.className = (isClover ? "layout-clover-grid pdf-clover-wrapper" : ("layout-cols-wrapper layout-cols-grid " + (targetCols === 2 ? "pdf-two-cols-wrapper layout-two-cols-grid" : (targetCols === 3 ? "pdf-three-cols-wrapper layout-three-cols-grid" : "")))) + (isSuperBlockCols ? " has-superblock-cols" : "");

          const gridCols = isClover ? "repeat(2, minmax(0, 1fr))" : parseRatioToGridCols(slide.frontmatter?.layoutRatio, targetCols);
          if (gridCols) gridDiv.style.gridTemplateColumns = gridCols;
          if (isClover) gridDiv.style.gridTemplateRows = "repeat(2, minmax(0, 1fr))";

          let colsList = [];
          for (let i = 0; i < targetCols; i++) colsList.push([]);
          const hasExplicitCols = rem.some(b => b.slot && (b.slot.startsWith("col-") || b.slot === "left" || b.slot === "right" || b.slot === "center"));
          if (hasExplicitCols) {
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
          for (const b of headerBlocks) headerDiv.appendChild(renderBlock(b, b === headerFirstH ? "slidev-page-first-heading-block" : ""));
          containerDiv.appendChild(headerDiv);

          colsList.forEach((colBlocks, idx) => {
            const colDiv = document.createElement("div");
            colDiv.className = "pdf-col pdf-col--" + (idx + 1) + " col-" + (idx + 1) + (targetCols === 2 && idx === 0 ? " pdf-col--left" : "") + (targetCols === 2 && idx === 1 ? " pdf-col--right" : "");
            const cleaned = cleanColList(colBlocks);
            const colFirstH = !isCover ? (cleaned.find(isHeadingBlock) || cleaned[0]) : null;
            for (const b of cleaned) colDiv.appendChild(renderBlock(b, b === colFirstH ? "slidev-col-first-heading-block" : ""));
            gridDiv.appendChild(colDiv);
          });
          containerDiv.appendChild(gridDiv);
          container.appendChild(containerDiv);
        } else if (slide.frontmatter?.layout === "image-right" || slide.frontmatter?.layout === "image-left") {
          const isImageRight = slide.frontmatter?.layout === "image-right";
          const contentCol = document.createElement("div");
          contentCol.className = isImageRight ? "image-right-content" : "image-left-content";

          const isCover = slide.frontmatter?.layout === "cover";
          const pageFirstH = !isCover ? (slide.blocks || []).find(isHeadingBlock) : null;
          for (const block of (slide.blocks || [])) {
            contentCol.appendChild(renderBlock(block, block === pageFirstH ? "slidev-page-first-heading-block" : ""));
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

          if (isImageRight) {
            container.appendChild(contentCol);
            container.appendChild(imgCol);
          } else {
            container.appendChild(imgCol);
            container.appendChild(contentCol);
          }
        } else {
          const isCover = slide.frontmatter?.layout === "cover";
          const validBlocks = (slide.blocks || []).filter(b => b.slot !== "slot-divider-right");
          const pageFirstH = !isCover ? validBlocks.find(isHeadingBlock) : null;
          for (const block of (slide.blocks || [])) {
            container.appendChild(renderBlock(block, block === pageFirstH ? "slidev-page-first-heading-block" : ""));
          }
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
      const lightbox = document.getElementById("slidev-lightbox");
      const lightboxContent = document.getElementById("lightbox-content");
      const lightboxClose = document.getElementById("lightbox-close");
      let isLightboxOpen = false;

      function openLightbox(type, src, alt) {
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

      btnPrev.addEventListener("click", () => renderSlide(currentIndex - 1));
      btnNext.addEventListener("click", () => renderSlide(currentIndex + 1));
      btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().then(() => updateScale()).catch(() => {});
        } else {
          document.exitFullscreen().then(() => updateScale()).catch(() => {});
        }
      });

      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "Esc") {
          if (isLightboxOpen) {
            closeLightbox();
            e.preventDefault();
            return;
          }
        }
        if (isLightboxOpen) return;
        if (e.key === "ArrowRight" || e.key === " ") renderSlide(currentIndex + 1);
        if (e.key === "ArrowLeft") renderSlide(currentIndex - 1);
        if (e.key === "f" || e.key === "F") btnFullscreen.click();
      });

      // 监听鼠标滚轮上下翻页调度
      let lastWheelTime = 0;
      const WHEEL_COOLDOWN_MS = 280;
      const WHEEL_DELTA_THRESHOLD = 15;

      function canElementScrollY(el, deltaY) {
        let cur = el;
        while (cur && cur !== document.body && cur !== document.documentElement) {
          if (cur.classList && (cur.classList.contains("slidev-viewport") || cur.classList.contains("slidev-stage") || cur.classList.contains("slide-container"))) {
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
        if (isLightboxOpen) return;
        if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
        if (Math.abs(e.deltaY) < WHEEL_DELTA_THRESHOLD) return;

        const target = e.target instanceof Element ? e.target : e.target?.parentElement;
        if (target && canElementScrollY(target, e.deltaY)) return;

        e.preventDefault();
        const now = Date.now();
        if (now - lastWheelTime < WHEEL_COOLDOWN_MS) return;
        lastWheelTime = now;

        if (e.deltaY > 0) {
          renderSlide(currentIndex + 1);
        } else {
          renderSlide(currentIndex - 1);
        }
      }, { passive: false });

      document.addEventListener("click", (e) => {
        if (isLightboxOpen) {
          const target = e.target instanceof Element ? e.target : e.target?.parentElement;
          const isMediaItself = target && target.closest && target.closest(".slidev-lightbox-img, .slidev-lightbox-video");
          if (!isMediaItself) {
            e.stopPropagation();
            closeLightbox();
          }
          return;
        }
        if (e.button !== 0) return;
        const targetEl = e.target instanceof Element ? e.target : e.target?.parentElement;
        if (!targetEl || !targetEl.closest) return;

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
          ".slide-block, .controls-bar, .image-right-img-container, .image-left-img-container, .controls, img, video, audio, button, a, input, textarea, select, [data-clickable], [data-ref-id], .slidev-toc, .empty-state"
        );
        if (isComponent) return;

        const isLeft = e.clientX < window.innerWidth / 2;
        if (isLeft) {
          renderSlide(currentIndex - 1);
        } else {
          renderSlide(currentIndex + 1);
        }
      });

      renderSlide(0);
      updateScale();
    })();`;
}
