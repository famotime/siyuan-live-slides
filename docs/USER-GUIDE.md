# SiYuan Slidev User Guide

Welcome to the **SiYuan Slidev** presentation plugin! Built specifically for SiYuan Note, this plugin integrates the modern **Slidev** presentation framework into your personal note-taking workflows with **zero document pollution, modern frontend animations, millisecond bidirectional syncing, and tiered synergy**.

---

## 1. Core Architecture: Three-Tier Scope & Zero Pollution

Traditional presentation plugins often force users to insert messy Frontmatter blocks or custom code snippets directly into the markdown body, degrading reading clarity. SiYuan Slidev leverages SiYuan Note's native **Block IAL (Attribute View)** engine to decouple presentation metadata from content entirely:

1. **Document Root Block**: Manages global presentation configuration (`theme`, `aspectRatio`, `defaultTransition`);
2. **Horizontal Dividers (`---`)**: Functions as natural slide page breaks while holding page-specific attributes (`layout`, `transition`, `background`, `notes`);
3. **Content Elements**: Plain text paragraphs, headers, code blocks, and list items holding element-level animation attributes (`v-click: +1`, `slot: right`).

---

## 2. Quick Start

### 2.1 Launching and Live Preview

- **Shortcut**: Press `Alt+P` (`⌥P` on macOS) to instantly compile the active document and open the Slidev preview dock;
- **Top Bar Icon**: Click the Slidev icon in the top toolbar to start the presentation;
- **Incremental Hot Reload**: An elastic 150ms debounce controller automatically updates the dock preview whenever you type in the editor.

### 2.2 Common Shortcuts

| Shortcut | Description | Scenario |
| :--- | :--- | :--- |
| `Alt+P` / `⌥P` | Compile & preview current document | Anytime while editing notes |
| `Alt+M` / `⌥M` | Open dual-screen Presenter Mode console | Presenting with external displays |
| `Arrow Left/Right` / `Space` | Navigate previous/next slide or animation step | In presentation sandbox |
| `F` | Toggle fullscreen mode | In presentation sandbox |
| `P` | Open speaker presenter console | In presentation sandbox |

---

## 3. Dedicated Visual Micro-Interactions

### 3.1 Horizontal Divider Popover (`QuickDividerPopover`)
Click any horizontal divider (`---`) directly in the editor to trigger a translucent floating toolbar:
- **Layout Picker**: Switch between `cover`, `default`, `two-cols`, `fact`, and `center` with one click;
- **Transition Selector**: Hover over transition options to preview real-time 1-second CSS animations (`slide-left`, `fade`, `slide-up`, `zoom`);
- **Background & Notes**: Edit page background colors and speaker notes directly.

### 3.2 Block Icon Menu & Animation Bar (`ElementAnimBar`)
Click the block icon on the left side of any element, and choose **Slidev Element Settings** -> **✨ Open Animation Floating Bar** to set incremental step animations (`v-click`) or multi-column slots (`::right::`).

---

## 4. Millisecond Bidirectional Cursor Tracking

- **Forward Tracking**: Move the cursor in SiYuan Note to automatically slide the preview dock to the matching page and highlight the block;
- **Reverse Selection**: Click any element inside the right preview sandbox to smoothly scroll and highlight the source block in SiYuan Note.

---

## 5. Offline Exports & Pro DevServer Mode

- **Single-File Offline HTML Export (`📥`)**: Generates an all-in-one standalone HTML package with inlined Base64 local images and full keyboard navigation;
- **High-Fidelity PDF Handout Export (`🖨️`)**: Renders print-optimized slides with support for 16:9, 4:3, and A4 layouts with preserved colors (`print-color-adjust: exact`);
- **Pro Mode CLI DevServer Bridge**: Exports official standard `slides.md` files (with frontmatter, page delimiters, and slot directives) to run locally via `npx @slidev/cli`.

---

## 6. Synergy with Property Manager

- Run **Slidev Synergy: Copy Preset Templates to Clipboard** to export ready-to-use slide templates to `siyuan-property-manager`;
- Run **Slidev Synergy: Transition Statistics** and **Batch Replace Transitions** to audit and batch-migrate presentation attributes across your entire notebook library.
