# SiYuan Live Slides User Guide

> Last refreshed: 2026-10-26 (aligned with all user-facing capabilities shipped after v0.9.0)

Welcome to **SiYuan Live Slides**, the presentation plugin built specifically for SiYuan Note. It integrates the modern **Slidev** presentation framework into your note-taking workflow with **zero document pollution, modern frontend animations, millisecond bidirectional syncing, and tiered synergy**.

---

## 1. Core Architecture: Three-Tier Scope & Zero Pollution

Traditional presentation plugins force users to insert messy Frontmatter or custom code blocks into the markdown body, degrading reading clarity. SiYuan Live Slides leverages SiYuan's native **Block IAL (attribute)** engine to decouple presentation metadata from content entirely:

1. **Document Root Block**: global configuration (`theme`, `aspect-ratio`, `default-transition`, `spacing`);
2. **Horizontal Dividers (`---`)**: natural slide page breaks holding page attributes (`layout`, `transition`, `background`, `mask`, `layout-ratio`, `notes`);
3. **Content Elements**: plain paragraphs, headings, code blocks, and list items carrying element-level attributes (`v-click` steps, `v-motion` entrance effects, `slot` membership, `shiki-lines` spotlight).

See the [technical specification](./技术规格定义.md) for the full attribute dictionary.

---

## 2. Quick Start

### 2.1 Launching and Live Preview

- **Shortcut**: Press `Alt+P` (`⌥P` on macOS) to open the wide split preview tab (`SlidesPreviewTab`) directly beneath the active document; drag to resize;
- **Top Bar Icon**: click the Slidev icon in the top toolbar to launch the bottom split preview;
- **Hot Reload**: an elastic debounce controller updates the preview as you type, delete or insert blocks;
- **Instant Tab Title**: the tab title immediately shows "document name · current page" and follows document switching;
- **Right Inspector Dock**: the dock panel is the live presentation property and action inspector following your cursor;
- **Zero-Cost Idle**: compile requests pause automatically when both the preview tab and the dock panel are closed.

### 2.2 Common Shortcuts

Editor shortcuts:

| Shortcut | Description | Scenario |
| :--- | :--- | :--- |
| `Alt+P` / `⌥P` | Open/refresh bottom split preview | Anytime while editing |
| `Alt+M` / `⌥M` | Open dual-screen Presenter Mode console | Presenting with external displays |

During playback (split preview / fullscreen / exported HTML):

| Key / Gesture | Description |
| :--- | :--- |
| `→` / `↓` / `Space` / `PageDown` / **mouse wheel down** | Next slide or `v-click` step |
| `←` / `↑` / `PageUp` / **mouse wheel up** | Previous slide or step |
| **Digits + `Enter`** | Jump directly to a slide (a jump badge appears; `Esc` cancels; invalid numbers are flagged) |
| `O` | Toggle the thumbnail overview wall; click (or keyboard-focus) any thumbnail to jump |
| `F` | Toggle fullscreen |
| `P` | Open the presenter console |
| `Esc` | Close overview / cancel jump input / exit fullscreen |

---

## 3. Modern Presentation UI

### 3.1 Bottom Split Preview Tab (`SlidesPreviewTab`)
- **Wide viewport** with resizable height;
- **📌 Pin toggle**: unlocked, the preview follows document switching; pinned, it stays on the target document while you browse other notes;
- **Full control toolbar**: prev/next, page badge, 📑 outline drawer, 🎤 presenter mode, 📥 single-file HTML export, 🖨️ PDF export, 🔄 refresh, ⛶ fullscreen, plus the Sandbox/Pro engine switch;
- **Immersive Peek**: clicking links inside the playing slide no longer leaves the show (see section 6).

### 3.2 Right Inspector Dock (`SlidesInspectorDockView`)
Context switches with your cursor:
- **Content block selected**: ✨ `v-click` steps, 🎬 entrance motion presets (`slide-up` / `fade-in` / `zoom-in` / `bounce`), ▥ column slots (incl. header columns for `cols-header`), 🔍 Shiki code spotlight (`1-3|5|7-10`), and quick actions (insert dividers, two-cols compare, clear attributes);
- **Divider (`---`) selected**: layout picker (cover / default / two-cols / **cols-header** / **clover 2×2 quadrant** / image-left / image-right / center / fact / intro / quote), custom column ratios (e.g. `1:2`, with one-click auto-detection from superblock widths), **dynamic page mask** (direction, segmented ratio, solid/blur style, initial state), transition, background, and speaker notes with 🤖 AI generation;
- **Document root selected**: theme presets, aspect ratio, default transition, **spacing style** (compact/normal/loose), **global heading size normalization**, and global AI quick actions;
- **Immediate persistence**: changes save to block attributes and re-render the preview instantly.

---

## 4. Millisecond Bidirectional Cursor Tracking

- **Forward**: moving the cursor in the editor flips the preview to the matching slide, highlights the block, and syncs the inspector panel;
- **Reverse**: clicking any element in the preview scrolls and highlights the source block in the editor.

---

## 5. Block References & SiYuan AI

- **Block references** (`((block-id))`) are resolved at compile time via SQL and rendered as inline cards with reference badges;
- **`Slidev AI: Smart Outline Split`** analyzes long documents and inserts page dividers with suggested layouts;
- **`Slidev AI: Generate Speaker Notes`** drafts per-page talking points via the SiYuan kernel AI, gracefully falling back to heuristics on failure.

---

## 6. Immersive Peek: In-Place Link Preview During Shows

Clicking links inside a running presentation opens an **immersive side drawer** instead of leaving the show:

- **SiYuan document / block-ref links**: rendered in-place with a real Protyle editor (enable "local web serve" in global settings first);
- **External URLs**: opened in an embedded Webview mini-browser with navigation, zoom, **desktop/mobile viewport switching**, and error retry;
- **Local HTML links**: rendered directly in the drawer — ideal for interactive charts or small web demos;
- **Corporate proxy friendly**: system proxy sessions are reused so external pages no longer render blank;
- **SPA friendly**: in-site navigation never force-reloads the Webview, avoiding 404s on sites without an SPA fallback;
- Press `Esc` or click the mask to close and return to the show instantly.

---

## 7. Dynamic Page Mask & Segmented Reveal

A "spotlight" capability for image-background pages: configure `custom-slides-mask` on a page divider and a directional mask covers the slide during playback, revealing **segment by segment** as you advance:

- **Direction**: `down` (top-to-bottom) or `right` (left-to-right);
- **Segment ratio**: weight form (`1:1`, `1:2:1`) or cumulative breakpoints (`25:75:100`), with preset chips in the panel;
- **Style**: `solid` overlay or `blur` frosted glass (GPU-composited, edge-to-edge);
- **Initial state**: `hidden` (start covered, progressively reveal) or `revealed` (start revealed, progressively cover).

---

## 8. Dual-Screen Presenter Mode

Press `Alt+M` or click the 🎤 toolbar icon to open the standalone presenter console:
- **BroadcastChannel sync** with the sandbox in milliseconds;
- **Current + next slide** side by side;
- **Timer** with pause/reset;
- **Speaker notes** with `A-` / `A+` live font sizing;
- **Batch notes management**: append or delete note blocks in batches from the inspector panel;
- **Progress bar** and one-click restart.

---

## 9. Offline Exports

1. **Single-File HTML Export (`📥`)**: a 100% standalone package with Base64-inlined local assets and the full player — keyboard/wheel navigation, **digit+Enter jumping**, **`O` thumbnail overview**, and image/video lightbox;
2. **PDF Handout Export (`🖨️`)**: print-optimized 16:9 / 4:3 / A4 pages with speaker notes, page badges, and exact color fidelity (`print-color-adjust: exact`).

---

## 10. One-Click Slidev Import

Import existing Slidev projects into SiYuan:
- Open via the **📥 Import** button on the inspector dock (or the command palette); supports `.md` files, `.zip` projects, or pasted source;
- **Smart preflight** reports page count, theme, layout distribution, notes, and asset totals before importing;
- **Asset unpacking** stores images/media in SiYuan's `assets/` library and rewrites paths;
- **HTML container stripping** converts presentation-only HTML containers (terminal windows, timelines, log panels, comparison grids) into clean native blocks;
- After import, the new document opens automatically with the split preview running.

---

## 11. Pro Mode: Local Slidev CLI Bridge

- **Workspace isolation** in the system temp directory avoids kernel lock conflicts; the plugin auto-detects local Node.js and Slidev CLI;
- **`Slidev Pro: Export standard slides.md`** converts the current document into official Slidev Markdown with all frontmatter, slot directives, and HTML-comment notes;
- **`Slidev Pro: Sync slides.md to workspace`** writes via kernel API for isolated rendering;
- **`Slidev Pro: Probe local DevServer (localhost:3030)`** checks the local engine status.

See the [Pro mode setup guide](./思源笔记即现演示插件%20(siyuan-live-slides)%20Pro%20模式系统配置与用户指南.md) for environment details.

---

## 12. Synergy with Property Manager

- **Slidev Synergy: Copy Preset Templates to Clipboard** exports ready-made templates into `siyuan-property-manager`;
- **Slidev Synergy: Transition Statistics** and **Batch Replace Transitions** audit and batch-migrate presentation attributes across your entire library.
