/**
 * 块级 Markdown 清洗与单块 HTML 渲染
 */
export function getBlockRenderingSection(): string {
  return `      function cleanCardListItemMarkdown(rawMarkdown) {
        if (!rawMarkdown) return "";
        let cleaned = rawMarkdown.replace(/^[ \\t]*[-*+]\\s+|^[ \\t]*\\d+\\.\\s+/, "");
        cleaned = cleaned.replace(/\\n[ \\t]{2,4}/g, "\\n");
        return cleaned.trim();
      }

      function isHeadingBlock(b) {
        if (!b) return false;
        if (b.type === "h" || b.type === "NodeHeading") return true;
        if (b.subType && /^h[1-6]$/i.test(b.subType)) return true;
        const md = (b.rawMarkdown || b.content || "").trim();
        if (/^#{1,6}\\s+/.test(md)) return true;
        if (/^(?:[-*+]|\\d+\\.)\\s+#{1,6}\\s+/.test(md)) return true;
        return false;
      }

      function cleanColList(blocks) {
        const valid = (blocks || []).filter(b => Boolean((b.rawMarkdown || b.content || "").trim()));
        if (valid.length === 0) return valid;
        const first = valid[0];
        const md = (first.rawMarkdown || first.content || "").trim();
        const isList = /^(?:[-*+]|\\d+\\.)\\s+/.test(md) || first.type === "i" || first.type === "l";
        if (isList) {
          first.rawMarkdown = cleanCardListItemMarkdown(first.rawMarkdown || first.content || "");
          first.content = first.rawMarkdown;
        }
        return valid;
      }

      function escapeInlineHtml(str) {
        return String(str || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function extractCleanImageUrlStandalone(rawDest) {
        const trimmed = (rawDest || "").trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("<")) {
          const endAngle = trimmed.indexOf(">");
          if (endAngle > 1) return trimmed.slice(1, endAngle).trim();
        }
        const titleMatch = trimmed.match(/^(\\S+?)(?:\\s+(?:"[^"]*"|'[^']*'|&quot;.*?&quot;|&#039;.*?&#039;|=\\S+))+$/);
        return titleMatch ? titleMatch[1] : trimmed;
      }

      const INLINE_MD_IMG_RE_STR = "!\\\\[((?:\\\\\\\\.|[^\\\\]\\\\n])*)\\\\]\\\\(([^()\\\\n]*(?:\\\\([^()\\\\n]*\\\\)[^()\\\\n]*)*)\\\\)(?:[ \\\\t]*\\\\{:[^}]*\\\\})*";
      const BLOCK_MD_IMG_RE = new RegExp("^" + INLINE_MD_IMG_RE_STR + "$");

      function cleanInlineKramdownStandalone(text) {
        if (!text || typeof text !== "string") return "";
        const codeTokens = [];
        let safeText = text.replace(/\\x60([^\\x60]+)\\x60/g, function(m) {
          codeTokens.push(m);
          return "%%INLINE_CODE_" + (codeTokens.length - 1) + "%%";
        });
        const imgTokens = [];
        safeText = safeText.replace(new RegExp(INLINE_MD_IMG_RE_STR, "g"), function(_, alt, dest) {
          imgTokens.push("![" + alt + "](" + dest + ")");
          return "%%INLINE_IMG_" + (imgTokens.length - 1) + "%%";
        });
        safeText = safeText.replace(/(<\\/[a-zA-Z0-9_-]+>)\\s*\\{:[^}]*\\}/g, "$1");
        const extractStyle = function(attrBody) {
          const m = attrBody.match(/\\bstyle\\s*=\\s*(?:"([^"]*)"|'([^']*)')/i);
          return m ? (m[1] ?? m[2] ?? "").trim() : null;
        };
        const wrapSyntax = function(pattern) {
          safeText = safeText.replace(pattern, function(full, content, attrBody) {
            const styleVal = extractStyle(attrBody);
            return styleVal ? '<span style="' + styleVal + '">' + content + '</span>' : full;
          });
        };
        wrapSyntax(/(\\[[^\\]]+\\]\\([^)]+\\))\\s*\\{:\\s*([^}]*)\\}/g);
        wrapSyntax(/(\\*\\*[^*]+\\*\\*)\\s*\\{:\\s*([^}]*)\\}/g);
        wrapSyntax(/(__[^_]+__)\\s*\\{:\\s*([^}]*)\\}/g);
        wrapSyntax(/(==[^=]+==)\\s*\\{:\\s*([^}]*)\\}/g);
        wrapSyntax(/(\\*[^*]+\\*)\\s*\\{:\\s*([^}]*)\\}/g);
        wrapSyntax(/(~~[^~]+~~)\\s*\\{:\\s*([^}]*)\\}/g);
        safeText = safeText.replace(/([^\\s<>]+)\\s*\\{:\\s*([^}]*)\\}/gu, function(full, content, attrBody) {
          const styleVal = extractStyle(attrBody);
          if (!styleVal) return full;
          const leadingDelim = content.match(/^(\\*\\*|__|==|~~|\\*)(.+)$/);
          if (leadingDelim) {
            return leadingDelim[1] + '<span style="' + styleVal + '">' + leadingDelim[2] + '</span>';
          }
          return '<span style="' + styleVal + '">' + content + '</span>';
        });
        safeText = safeText.replace(/\\{:[^}]*\\}/g, "");
        safeText = safeText.replace(/%%INLINE_IMG_(\\d+)%%/g, function(_, idx) {
          return imgTokens[parseInt(idx, 10)] || "";
        });
        safeText = safeText.replace(/%%INLINE_CODE_(\\d+)%%/g, function(_, idx) {
          return codeTokens[parseInt(idx, 10)] || "";
        });
        return safeText;
      }

      const SAFE_STANDALONE_INLINE_TAGS = new Set([
        "kbd", "mark", "sub", "sup", "span", "a", "br", "b", "i", "u", "s",
        "del", "em", "strong", "code", "small", "abbr", "ruby", "rt", "rp", "v-mark",
        "img", "video", "source", "picture"
      ]);

      function formatInlineStandalone(text) {
        if (!text) return "";
        const preprocessed = cleanInlineKramdownStandalone(text);
        const tokens = [];
        const tokenized = preprocessed.replace(/<\\/?([a-zA-Z0-9_-]+)(?:\\s+[^<>]*)?\\/?>/g, function(tagMatch, tagName) {
          const lowerTag = tagName.toLowerCase();
          if (!SAFE_STANDALONE_INLINE_TAGS.has(lowerTag)) return tagMatch;
          if (/on\\w+\\s*=|javascript:/i.test(tagMatch)) return tagMatch;
          if (lowerTag === "v-mark") {
            const tm = tagMatch.match(/type=["']?([a-zA-Z-]+)["']?/);
            const mt = tm ? tm[1] : "circle";
            tokens.push(tagMatch.startsWith("</") ? "</mark>" : '<mark class="v-mark v-mark--' + mt + '">');
            return "%%SAFE_HTML_" + (tokens.length - 1) + "%%";
          }
          tokens.push(tagMatch);
          return "%%SAFE_HTML_" + (tokens.length - 1) + "%%";
        });
        let res = escapeInlineHtml(tokenized);
        res = res.replace(/\\$([^$\\n]+)\\$/g, '<span class="katex-inline font-math"><em>$1</em></span>');
        res = res.replace(new RegExp(INLINE_MD_IMG_RE_STR, "g"), function(_, alt, rawDest) {
          const url = extractCleanImageUrlStandalone(rawDest);
          const isGif = /\\.gif(?:\\?|$)/i.test(url);
          return '<img alt="' + alt + '" src="' + url + '" class="' + (isGif ? "slide-inline-img list-item-gif" : "slide-inline-img") + '" />';
        });
        res = res.replace(/\\[(.*?)\\]\\((.*?)\\)/g, function(_, title, url) {
          if (url.startsWith("siyuan://blocks/")) {
            const blockId = url.replace("siyuan://blocks/", "").split("?")[0];
            return '<a href="' + url + '" data-ref-id="' + blockId + '" class="slides-ref-tag">🔗 ' + title + '</a>';
          }
          return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="slides-link">' + title + '</a>';
        });
        res = res.replace(/\\*\\*(.*?)\\*\\*/g, "<strong>$1</strong>");
        res = res.replace(/\\*(.*?)\\*/g, "<em>$1</em>");
        res = res.replace(/~~(.*?)~~/g, "<del>$1</del>");
        res = res.replace(/\\x60([^\\x60]+)\\x60/g, "<code>$1</code>");
        res = res.replace(/%%SAFE_HTML_(\\d+)%%/g, function(_, idxStr) {
          return tokens[parseInt(idxStr, 10)] || "";
        });
        return res;
      }

      function renderBlock(block, extraClass) {
        const div = document.createElement("div");
        div.className = "slide-block" + (extraClass ? " " + extraClass : "");
        const rawBlockStyle = (block && (block.attributes?.style || block.ial?.style)) || "";
        if (rawBlockStyle) {
          div.style.cssText = rawBlockStyle;
          div.classList.add("slide-styled-block");
          if (/\\bfont-size\\s*:/i.test(rawBlockStyle)) {
            div.classList.add("slide-block--custom-font-size");
          }
          if (/(?:^|;)\\s*color\\s*:/i.test(rawBlockStyle)) {
            div.classList.add("slide-block--custom-color");
          }
        }
        if (block && block.motion && block.motion.preset && block.motion.preset !== "none") {
          div.classList.add("slides-motion-" + block.motion.preset.toLowerCase());
          if (typeof block.motion.duration === "number" && block.motion.duration > 0) {
            div.style.setProperty("--motion-duration", block.motion.duration + "ms");
          }
          if (typeof block.motion.delay === "number" && block.motion.delay > 0) {
            div.style.setProperty("--motion-delay", block.motion.delay + "ms");
          }
        }
        if (block && block.anim && block.anim.type && block.anim.type !== "none") {
          const animType = String(block.anim.type).toLowerCase().trim();
          div.classList.add("slides-anim-" + animType);
          div.setAttribute("data-slides-anim", animType);
          if (typeof block.anim.duration === "number" && block.anim.duration > 0) {
            div.style.setProperty("--anim-duration", (block.anim.duration / 1000) + "s");
            div.setAttribute("data-anim-duration", String(block.anim.duration));
          }
          if (typeof block.anim.delay === "number" && block.anim.delay > 0) {
            div.style.setProperty("--anim-delay", (block.anim.delay / 1000) + "s");
          }
          if (animType === "countup") {
            div.setAttribute("data-countup-from", String(block.anim.from ?? 0));
            div.setAttribute("data-countup-to", String(block.anim.to ?? ""));
            div.setAttribute("data-countup-decimals", String(block.anim.decimals ?? 0));
            div.setAttribute("data-countup-prefix", block.anim.prefix ?? "");
            div.setAttribute("data-countup-suffix", block.anim.suffix ?? "");
          } else if (animType === "typewriter") {
            div.classList.add("slides-typewriter-cursor");
          }
        }
        const md = block.rawMarkdown || block.content || "";
        if (block && block.isListContinuation && !block.isListItem) {
          div.classList.add("slide-list-continuation");
        }

        if (md.includes('class="slides-block-ref"') || md.includes('class="slides-ref-tag"')) {
          div.innerHTML = md;
          return div;
        }

        const CARBON_MAP = {
          'carbon:arrow-right': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="m18 6l-1.43 1.393L24.15 15H4v2h20.15l-7.58 7.573L18 26l10-10z"/></svg>',
          'carbon:arrow-left': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="m14 26l1.43-1.393L7.85 17H28v-2H7.85l7.58-7.573L14 6L4 16z"/></svg>',
          'carbon:edit': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="M2 26h28v2H2zM25.4 9c.8-.8.8-2 0-2.8l-3.6-3.6c-.8-.8-2-.8-2.8 0l-15 15V24h6.4l15-15zM20.4 4L24 7.6l-2.4 2.4l-3.6-3.6L20.4 4zM6 22v-3.6l11-11l3.6 3.6l-11 11H6z"/></svg>',
          'carbon:logo-github': '<svg viewBox="0 0 32 32" width="1.2em" height="1.2em" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path fill-rule="evenodd" d="M16 2a14 14 0 0 0-4.43 27.28c.7.13 1-.3 1-.67v-2.38c-3.89.84-4.71-1.88-4.71-1.88a3.7 3.7 0 0 0-1.56-2.05c-1.27-.86.1-.85.1-.85a2.94 2.94 0 0 1 2.14 1.44a3 3 0 0 0 4.08 1.16a2.93 2.93 0 0 1 .89-1.87c-3.1-.35-6.36-1.55-6.36-6.9a5.4 5.4 0 0 1 1.44-3.75a5 5 0 0 1 .14-3.71s1.17-.38 3.85 1.43a13.3 13.3 0 0 1 7 0c2.67-1.81 3.84-1.43 3.84-1.43a5 5 0 0 1 .14 3.71a5.4 5.4 0 0 1 1.44 3.75c0 5.37-3.27 6.54-6.38 6.89a3.35 3.35 0 0 1 1.26 2.61v3.87c0 .38.26.81 1 .67A14 14 0 0 0 16 2"/></svg>'
        };

        const isListBlock = (block.type === 'l' || block.type === 'i' || block.isListItem || /^(\\s*)([-*+]|\\d+\\.)\\s+/m.test(md));
        const isHeadingOrQuote = (block.type === 'h' || /^#{1,6}\\s+/.test(md) || block.type === 'b' || /^>\\s+/.test(md));
        const isInteractiveVue = !isListBlock && !isHeadingOrQuote && (
          /<[a-zA-Z0-9_-]+[^>]*\\b(?:@[a-zA-Z0-9_-]+=[\'\"]|v-[a-zA-Z0-9_-]+)/i.test(md) ||
          /<(?:carbon:[a-zA-Z0-9_-]+|<(?:Toc|toc|arrow|Arrow)\\b|<button\\b)/i.test(md) ||
          (/^<div\\b/i.test(md) && (md.includes('class=') || md.includes('hover:') || md.includes('@')))
        );

        if (isInteractiveVue) {
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
          const allInteractive = div.querySelectorAll("*");
          allInteractive.forEach(btn => {
            let hasNext = false;
            let hasPrev = false;
            for (let i = 0; i < btn.attributes.length; i++) {
              const a = btn.attributes[i];
              const attrName = a.name.toLowerCase();
              if (attrName.indexOf("@click") !== -1 || attrName.indexOf("v-on:click") !== -1) {
                if (a.value.indexOf("next") !== -1) hasNext = true;
                if (a.value.indexOf("prev") !== -1) hasPrev = true;
              }
            }
            if (hasNext) {
              btn.style.cursor = "pointer";
              btn.addEventListener("click", (e) => {
                e.stopPropagation();
                renderSlide(currentIndex + 1);
              });
            } else if (hasPrev) {
              btn.style.cursor = "pointer";
              btn.addEventListener("click", (e) => {
                e.stopPropagation();
                renderSlide(currentIndex - 1);
              });
            }
          });

          return div;
        }

        const hasHeadingTag = /(?:^|\\n)\\s*#{1,6}\\s+/.test(md);
        const hMatch = md.match(/^(#{1,6})\\s+(.*)$/);

        if (hMatch) {
          const level = hMatch[1].length;
          let th = formatInlineStandalone(hMatch[2].trim());
          div.innerHTML = "<h" + level + ">" + th + "</h" + level + ">";
        }
        else if (md.startsWith("\\x60\\x60\\x60")) {
          var rawMaxH = block?.attributes?.["custom-slides-max-height"] || block?.attrs?.["custom-slides-max-height"] || block?.maxHeight || "";
          var customMaxHeight = "";
          if (rawMaxH) {
            var sMaxH = String(rawMaxH).trim();
            if (/^\\d+$/.test(sMaxH)) customMaxHeight = sMaxH + "px";
            else if (/^(\\d+(?:\\.\\d+)?)%$/.test(sMaxH)) customMaxHeight = sMaxH.replace("%", "cqh");
            else if (/^(\\d+(?:\\.\\d+)?)vh$/.test(sMaxH)) customMaxHeight = sMaxH.replace("vh", "cqh");
            else customMaxHeight = sMaxH;
          }
          const heightStyle = customMaxHeight ? ' style="max-height:' + customMaxHeight + ';overflow-y:auto;"' : "";
          div.innerHTML = "<pre" + heightStyle + "><code>" + md.slice(3, -3) + "</code></pre>";
        }
        else if (md.startsWith("> ")) div.innerHTML = "<blockquote><p>" + formatInlineStandalone(md.slice(2)) + "</p></blockquote>";
        else if ((/<video\\b/i.test(md) || (block && (block.type === "video" || block.type === "NodeVideo"))) && !/^(\\s*)([-*+]|\\d+\\.)\\s+/m.test(md) && !hasHeadingTag && !md.includes("\\n")) {
          div.classList.add("slide-video-container", "slide-media-container", "slide-media-block");
          const isAutoplay = block && block.attributes && block.attributes["custom-slides-autoplay"] === "true";
          const isLoop = block && block.attributes && block.attributes["custom-slides-loop"] === "true";
          const isMuted = block && block.attributes && (block.attributes["custom-slides-muted"] === "true" || isAutoplay);
          const hideControls = block && block.attributes && block.attributes["custom-slides-controls"] === "false";
          let videoHtml = md;
          if (hideControls) videoHtml = videoHtml.replace(/\\bcontrols(?:="[^"]*")?/gi, "").trim();
          else if (!videoHtml.includes("controls")) videoHtml = videoHtml.replace("<video", "<video controls");
          if (isAutoplay && !videoHtml.includes("autoplay")) videoHtml = videoHtml.replace("<video", "<video autoplay playsinline");
          if (isLoop && !videoHtml.includes("loop")) videoHtml = videoHtml.replace("<video", "<video loop");
          if (isMuted && !videoHtml.includes("muted")) videoHtml = videoHtml.replace("<video", "<video muted");
          videoHtml = videoHtml.replace("<video", '<video class="slide-video-player"');
          div.setAttribute("data-autoplay", isAutoplay ? "true" : "false");
          div.innerHTML = videoHtml;
        }
        else if (
          /^(\\s*)([-*+]|\\d+\\.)\\s+/m.test(md) ||
          (md.includes("\\n") && /^(\\s*)([-*+]|\\d+\\.)\\s+/m.test(md.split("\\n").slice(1).join("\\n"))) ||
          ((block && (block.isListItem || block.type === "i")) && !block.isColFirst)
        ) {
          div.classList.add("pdf-list-item");
          const lines = md.split("\\n");
          let isOrdered = false;
          const items = [];
          const leadLines = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const tr = line.trim();
            if (!tr || /^\\{:.*?\\}$/.test(tr)) continue;
            const um = line.match(/^(\\s*)[-*+]\\s+(.*)$/);
            const om = line.match(/^(\\s*)\\d+\\.\\s+(.*)$/);
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
              const im = tr.match(BLOCK_MD_IMG_RE);
              if (im) {
                const cleanUrl = extractCleanImageUrlStandalone(im[2]);
                const isGif = /\\.gif(?:\\?|$)/i.test(cleanUrl);
                items[items.length - 1].media.push('<div class="slide-list-media"><img alt="' + escapeInlineHtml(im[1]) + '" src="' + cleanUrl + '" class="' + (isGif ? 'list-item-gif' : 'list-item-img') + '" /></div>');
                continue;
              }
              const hm = tr.match(/^<img\\b[\\s\\S]*?\\/?>$/i);
              if (hm) {
                const cleanTr = tr.replace(/\\s+style="[^"]*"/gi, "");
                items[items.length - 1].media.push('<div class="slide-list-media">' + cleanTr + '</div>');
                continue;
              }
              if (/<video\\b/i.test(tr)) {
                let vHtml = tr;
                if (!/<\\/video>/i.test(vHtml)) {
                  while (i + 1 < lines.length && !/<\\/video>/i.test(vHtml)) {
                    i++;
                    vHtml += " " + lines[i].trim();
                  }
                }
                const isAutoplay = block && block.attributes && block.attributes["custom-slides-autoplay"] === "true";
                const isLoop = block && block.attributes && block.attributes["custom-slides-loop"] === "true";
                const isMuted = block && block.attributes && (block.attributes["custom-slides-muted"] === "true" || isAutoplay);
                const hideControls = block && block.attributes && block.attributes["custom-slides-controls"] === "false";
                if (hideControls) vHtml = vHtml.replace(/\\bcontrols(?:="[^"]*")?/gi, "").trim();
                else if (!vHtml.includes("controls")) vHtml = vHtml.replace("<video", "<video controls");
                if (isAutoplay && !vHtml.includes("autoplay")) vHtml = vHtml.replace("<video", "<video autoplay playsinline");
                if (isLoop && !vHtml.includes("loop")) vHtml = vHtml.replace("<video", "<video loop");
                if (isMuted && !vHtml.includes("muted")) vHtml = vHtml.replace("<video", "<video muted");
                vHtml = vHtml.replace("<video", '<video class="slide-video-player"');
                items[items.length - 1].media.push('<div class="slide-list-media slide-video-container slide-media-container" data-autoplay="' + (isAutoplay ? 'true' : 'false') + '">' + vHtml + '</div>');
                continue;
              }
              items[items.length - 1].text += "\\n" + tr;
            } else {
              leadLines.push(tr);
            }
          }

          if (items.length === 0 && (block && (block.isListItem || block.type === "i")) && !block.isColFirst) {
            items.push({ type: "unordered", level: 0, text: md, media: [] });
            leadLines.length = 0;
          }

          let leadHtml = "";
          if (leadLines.length > 0) {
            const lParts = [];
            const firstL = leadLines[0];
            const fhm = firstL.match(/^(#{1,6})\\s+(.*)$/);
            if (fhm) {
              const lvl = fhm[1].length;
              let th = formatInlineStandalone(fhm[2].trim());
              lParts.push('<h' + lvl + ' class="slide-list-item-title">' + th + '</h' + lvl + '>');
            } else {
              let th = formatInlineStandalone(firstL.trim());
              lParts.push('<p class="slide-list-item-title">' + th + '</p>');
            }
            if (leadLines.length > 1) {
              const dLines = leadLines.slice(1);
              let pL = [];
              const flushLeadP = () => {
                if (pL.length > 0) {
                  let txt = pL.map(l => formatInlineStandalone(l)).join("<br/>");
                  lParts.push('<p class="slide-list-item-desc">' + txt + '</p>');
                  pL = [];
                }
              };
              for (const l of dLines) {
                const hm = l.match(/^(#{1,6})\\s+(.*)$/);
                if (hm) {
                  flushLeadP();
                  const lvl = hm[1].length;
                  let th = formatInlineStandalone(hm[2].trim());
                  lParts.push('<h' + lvl + ' class="slide-list-item-title">' + th + '</h' + lvl + '>');
                } else {
                  pL.push(l);
                }
              }
              flushLeadP();
            }
            leadHtml = lParts.join("\\n") + "\\n";
          }

          const tag = isOrdered ? "ol" : "ul";
          const listCls = isOrdered ? "pdf-list pdf-list--ordered" : "pdf-list pdf-list--unordered";
          const liHtml = items.map(it => {
            const med = it.media && it.media.length ? "\\n" + it.media.join("\\n") : "";
            const lines = (it.text || "").split("\\n").map(l => l.trim()).filter(Boolean);
            const hasHeading = lines.some(l => /^#{1,6}\\s+/.test(l));
            const lvl = it.level || 0;
            const nStyle = lvl > 0 ? ' style="margin-left:' + (lvl * 1.25).toFixed(2) + 'em;' + (it.type === 'unordered' ? 'list-style-type:' + (lvl % 2 === 1 ? 'circle' : 'square') + ' !important;' : '') + '"' : "";
            const nClass = lvl > 0 ? " slide-list-item--nested" : "";
            const clsAttr = nClass ? ' class="' + nClass.trim() + '"' : "";
            if (!hasHeading) {
              let h = lines.map(l => formatInlineStandalone(l)).join("<br/>");
              return '<li' + clsAttr + nStyle + '>' + h + med + '</li>';
            }
            const parts = [];
            let pLines = [];
            const flushP = () => {
              if (pLines.length > 0) {
                let ph = pLines.map(l => formatInlineStandalone(l)).join("<br/>");
                parts.push('<p class="slide-list-item-desc">' + ph + '</p>');
                pLines = [];
              }
            };
            for (const l of lines) {
              const hm = l.match(/^(#{1,6})\\s+(.*)$/);
              if (hm) {
                flushP();
                const hl = hm[1].length;
                let th = formatInlineStandalone(hm[2].trim());
                parts.push('<h' + hl + ' class="slide-list-item-title">' + th + '</h' + hl + '>');
              } else {
                pLines.push(l);
              }
            }
            flushP();
            return '<li' + clsAttr + nStyle + '>' + parts.join("\\n") + med + '</li>';
          }).join("\\n");
          div.innerHTML = leadHtml + '<' + tag + ' class="' + listCls + '">\\n' + liHtml + '\\n</' + tag + '>';
        }
        else {
          // 复合块（包含换行、标题或媒体）高保真解析
          const lines = md.split(/\\r?\\n/);
          const subBlocks = [];
          let current = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (/^#{1,6}\\s+/.test(trimmed)) {
              if (current.length > 0) { subBlocks.push(current.join("\\n")); current = []; }
              subBlocks.push(trimmed);
              continue;
            }
            if (!trimmed) {
              if (current.length > 0) { subBlocks.push(current.join("\\n")); current = []; }
              continue;
            }
            if (BLOCK_MD_IMG_RE.test(trimmed)) {
              if (current.length > 0) { subBlocks.push(current.join("\\n")); current = []; }
              subBlocks.push(trimmed);
              continue;
            }
            if (/<video\\b/i.test(trimmed)) {
              if (current.length > 0) { subBlocks.push(current.join("\\n")); current = []; }
              let vRaw = trimmed;
              if (!/<\\/video>/i.test(vRaw)) {
                while (i + 1 < lines.length && !/<\\/video>/i.test(vRaw)) {
                  i++;
                  vRaw += "\\n" + lines[i];
                }
              }
              subBlocks.push(vRaw);
              continue;
            }
            current.push(line);
          }
          if (current.length > 0) subBlocks.push(current.join("\\n"));

          if (subBlocks.length > 1 || (subBlocks.length === 1 && /^#{1,6}\\s+/.test(subBlocks[0].trim()))) {
            let isFirstParagraph = true;
            const htmlParts = subBlocks.map(sub => {
              const t = sub.trim();
              if (!t) return "";
              const hm = t.match(/^(#{1,6})\\s+(.*)$/);
              if (hm) {
                isFirstParagraph = false;
                const hl = hm[1].length;
                let th = formatInlineStandalone(hm[2].trim());
                return '<h' + hl + ' class="slide-list-item-title">' + th + '</h' + hl + '>';
              }
              const im = t.match(BLOCK_MD_IMG_RE);
              if (im) {
                return '<div class="slide-media-block slide-media-container slide-list-media"><img alt="' + escapeInlineHtml(im[1]) + '" src="' + extractCleanImageUrlStandalone(im[2]) + '" class="slide-media-img" /></div>';
              }
              if (/<video\\b/i.test(t)) {
                return '<div class="slide-media-block slide-video-container slide-media-container">' + t + '</div>';
              }
              if (isFirstParagraph) {
                isFirstParagraph = false;
                const subLines = t.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
                if (subLines.length === 1) {
                  let ph = formatInlineStandalone(subLines[0]);
                  return '<p class="slide-list-item-title">' + ph + '</p>';
                }
                let titleHtml = formatInlineStandalone(subLines[0]);
                let descHtml = subLines.slice(1).map(l => formatInlineStandalone(l)).join("<br/>");
                return '<p class="slide-list-item-title">' + titleHtml + '</p>\\n<p class="slide-list-item-desc">' + descHtml + '</p>';
              }
              let ph = formatInlineStandalone(t);
              return '<p class="slide-list-item-desc">' + ph + '</p>';
            }).filter(Boolean);
            div.innerHTML = htmlParts.join("\\n");
          } else {
            const imgMatch = md.match(BLOCK_MD_IMG_RE);
            if (imgMatch) {
              div.classList.add("slide-media-container", "slide-media-block", "slide-block--image");
              div.innerHTML = '<img alt="' + escapeInlineHtml(imgMatch[1]) + '" src="' + extractCleanImageUrlStandalone(imgMatch[2]) + '" class="slide-media-img" />';
            } else {
              let html = formatInlineStandalone(md);
              const pCls = (block && block.isColFirst) ? ' class="slide-list-item-title"' : '';
              div.innerHTML = "<p" + pCls + ">" + html + "</p>";
            }
          }
        }
        return div;
      }
`;
}
