import type { ISlidevDocument } from "../types/slidev-protocol"

export interface IStandaloneHtmlOptions {
  title?: string
  inlineVueBundle?: string
  inlineAssetBase64Map?: Record<string, string>
}

/**
 * 构建无外部依赖的离线单文件独立 HTML 演示包（支持 Base64 资产内联）
 */
export function buildStandaloneHtml(
  doc: ISlidevDocument,
  options?: IStandaloneHtmlOptions,
): string {
  const title = options?.title || "Slidev 演示文稿"
  let processedSlides = doc.slides

  // 若提供 Base64 字典，将各块中匹配到的本地资产 URL 替换为 Base64
  if (options?.inlineAssetBase64Map && Object.keys(options.inlineAssetBase64Map).length > 0) {
    const map = options.inlineAssetBase64Map
    processedSlides = doc.slides.map(slide => {
      let slideMd = slide.rawMarkdown
      for (const [assetPath, b64] of Object.entries(map)) {
        if (slideMd.includes(assetPath)) {
          slideMd = slideMd.split(assetPath).join(b64)
        }
      }
      const newBlocks = slide.blocks.map(b => {
        let md = b.rawMarkdown
        for (const [assetPath, b64] of Object.entries(map)) {
          if (md.includes(assetPath)) {
            md = md.split(assetPath).join(b64)
          }
        }
        return { ...b, rawMarkdown: md }
      })
      return { ...slide, rawMarkdown: slideMd, blocks: newBlocks }
    })
  }

  const slidesJson = JSON.stringify(processedSlides)
  const configJson = JSON.stringify(doc.config)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --slide-bg: #ffffff;
      --slide-text: #1a1a1a;
      --slide-accent: #3b82f6;
      --slide-font: system-ui, -apple-system, sans-serif;
    }
    [data-theme="dark"] {
      --slide-bg: #121214;
      --slide-text: #e2e8f0;
      --slide-accent: #60a5fa;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%; overflow: hidden;
      background: #0f1115; font-family: var(--slide-font);
      display: flex; justify-content: center; align-items: center;
    }
    #app { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; }
    .slide-viewport {
      position: relative; background: var(--slide-bg); color: var(--slide-text);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 8px; overflow: hidden;
      aspect-ratio: 16 / 9; width: min(96vw, calc(92vh * 16 / 9)); max-height: 92vh;
      display: flex; flex-direction: column;
    }
    .slide-content { padding: 48px 56px; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
    .layout-cover { justify-content: center; align-items: center; text-align: center; }
    .layout-cover h1 { font-size: 3.2rem; font-weight: 800; color: var(--slide-accent); margin-bottom: 16px; }
    .layout-two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; height: 100%; }
    .slide-block { margin-bottom: 14px; line-height: 1.6; }
    .slide-block h1 { font-size: 2.2rem; margin-bottom: 12px; }
    .slide-block h2 { font-size: 1.7rem; margin-bottom: 10px; }
    .slide-block p { font-size: 1.15rem; }
    .slide-block pre { background: rgba(0,0,0,0.1); padding: 12px; border-radius: 6px; font-family: monospace; }
    .controls {
      position: absolute; bottom: 16px; display: flex; gap: 12px; align-items: center;
      background: rgba(24, 24, 27, 0.8); backdrop-filter: blur(8px);
      padding: 6px 18px; border-radius: 20px; color: #fff; font-size: 13px; z-index: 10;
    }
    .controls button { background: transparent; border: none; color: inherit; cursor: pointer; padding: 2px 6px; }
  </style>
  <script>
    // 注入演示数据载荷
    window.__SLIDEV_DATA__ = {
      docId: ${JSON.stringify(doc.docId)},
      slides: ${slidesJson},
      config: ${configJson}
    };
  </script>
</head>
<body>
  <div id="app">
    <div class="slide-viewport" id="viewport">
      <div class="slide-content" id="slide-container"></div>
    </div>
    <div class="controls">
      <button id="btn-prev">◀ 上一页</button>
      <span id="page-num">1 / 1</span>
      <button id="btn-next">下一页 ▶</button>
      <button id="btn-fullscreen">⛶ 全屏</button>
    </div>
  </div>

  <script>
    (function() {
      const data = window.__SLIDEV_DATA__ || { slides: [] };
      const slides = data.slides || [];
      let currentIndex = 0;

      const container = document.getElementById("slide-container");
      const pageNum = document.getElementById("page-num");
      const btnPrev = document.getElementById("btn-prev");
      const btnNext = document.getElementById("btn-next");
      const btnFullscreen = document.getElementById("btn-fullscreen");

      function renderBlock(block) {
        const div = document.createElement("div");
        div.className = "slide-block";
        const md = block.rawMarkdown || block.content || "";

        if (md.includes('class="slidev-block-ref"') || md.includes('class="slidev-ref-tag"')) {
          div.innerHTML = md;
          return div;
        }

        if (md.startsWith("### ")) div.innerHTML = "<h3>" + md.slice(4) + "</h3>";
        else if (md.startsWith("## ")) div.innerHTML = "<h2>" + md.slice(3) + "</h2>";
        else if (md.startsWith("# ")) div.innerHTML = "<h1>" + md.slice(2) + "</h1>";
        else if (md.startsWith("\`\`\`")) div.innerHTML = "<pre><code>" + md.slice(3, -3) + "</code></pre>";
        else if (md.startsWith("> ")) div.innerHTML = "<blockquote><p>" + md.slice(2) + "</p></blockquote>";
        else {
          const imgMatch = md.match(/!\\[(.*?)\\]\\((.*?)\\)/);
          if (imgMatch) {
            div.innerHTML = '<img alt="' + imgMatch[1] + '" src="' + imgMatch[2] + '" style="max-width:100%;max-height:45vh;object-fit:contain;" />';
          } else {
            let html = md.replace(/\\*\\*(.*?)\\*\\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
            div.innerHTML = "<p>" + html + "</p>";
          }
        }
        return div;
      }

      function renderSlide(idx) {
        if (slides.length === 0) return;
        currentIndex = Math.max(0, Math.min(idx, slides.length - 1));
        const slide = slides[currentIndex];
        pageNum.textContent = (currentIndex + 1) + " / " + slides.length;

        container.className = "slide-content layout-" + (slide.frontmatter?.layout || "default");
        container.innerHTML = "";

        if (slide.frontmatter?.layout === "two-cols") {
          const leftCol = document.createElement("div");
          leftCol.className = "two-cols-left";
          const rightCol = document.createElement("div");
          rightCol.className = "two-cols-right";

          for (const block of (slide.blocks || [])) {
            const el = renderBlock(block);
            if (block.slot === "right") rightCol.appendChild(el);
            else leftCol.appendChild(el);
          }
          container.appendChild(leftCol);
          container.appendChild(rightCol);
        } else {
          for (const block of (slide.blocks || [])) {
            container.appendChild(renderBlock(block));
          }
        }
      }

      btnPrev.addEventListener("click", () => renderSlide(currentIndex - 1));
      btnNext.addEventListener("click", () => renderSlide(currentIndex + 1));
      btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      });

      window.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === " ") renderSlide(currentIndex + 1);
        if (e.key === "ArrowLeft") renderSlide(currentIndex - 1);
        if (e.key === "f" || e.key === "F") btnFullscreen.click();
      });

      renderSlide(0);
    })();
  </script>
</body>
</html>`
}

/**
 * 触发浏览器本地下载单文件 HTML
 */
export function downloadHtmlFile(filename: string, content: string): boolean {
  if (typeof document === "undefined") {
    return false
  }

  const blob = new Blob([content], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
