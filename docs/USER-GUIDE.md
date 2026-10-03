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

- **Shortcut**: Press `Alt+P` (`⌥P` on macOS) to open the wide split preview tab (`SlidevPreviewTab`) directly beneath your active document;
- **Top Bar Icon**: Click the Slidev icon in the top toolbar to launch the bottom split preview;
- **Incremental Hot Reload**: An elastic 150ms debounce controller automatically updates the bottom preview whenever you type in the editor;
- **Right Inspector Dock**: The right dock panel (`SlidevInspectorDockView`) serves exclusively as a live presentation property and action inspector following your cursor.

### 2.2 Common Shortcuts

| Shortcut | Description | Scenario |
| :--- | :--- | :--- |
| `Alt+P` / `⌥P` | Open/refresh bottom split presentation preview | Anytime while editing notes |
| `Alt+M` / `⌥M` | Open dual-screen Presenter Mode console | Presenting with external displays |
| `Arrow Left/Right` / `Space` | Navigate previous/next slide or animation step | In presentation sandbox |
| `F` | Toggle fullscreen mode | In presentation sandbox |
| `P` | Open speaker presenter console | In presentation sandbox |

---

## 3. Modern Presentation UI Architecture

### 3.1 Bottom Split Preview Tab (`SlidevPreviewTab`)
Launched via `Alt+P` or the top bar icon directly below the editor:
- **Wide Viewport**: Full-width split tab with resizable height, eliminating sidebar space constraints;
- **📌 Pin Toggle Button**: Locks presentation preview to the current document. When unlocked, it follows document switching automatically; when pinned, it stays focused on the presentation even when you browse reference notes;
- **Full Control Toolbar**: Slide navigation, page indicator badge, 📑 outline drawer, 🎤 presenter mode, 📥 single-file HTML export, 🖨️ PDF export, 🔄 refresh, and ⛶ fullscreen.

### 3.2 Right Presentation Inspector Dock (`SlidevInspectorDockView`)
Replaces cumbersome nested block icon submenus and eliminates obstructive floating popovers:
- **Dynamic Context Switching**:
  - **Regular Content Blocks**: Configures ✨ incremental steps (`v-click`), ▥ multi-column slots (`slot: left / right`), and 🔍 code spotlight (`Shiki Lines`); provides quick actions to insert page dividers and set two-cols layouts.
  - **Horizontal Dividers (`---`)**: Displays slide page Frontmatter settings (Layout picker, Transition selector, Background, Speaker Notes with 🤖 AI generation), and quick actions to add or remove slides.
  - **Document Root**: Manages global document presentation parameters (Theme, Aspect Ratio, Default Transition) and presentation shortcuts.
- **Immediate Persistence**: Changes are instantly saved to block attributes and re-rendered in the bottom preview tab.

---

## 4. Millisecond Bidirectional Cursor Tracking

- **Forward Tracking**: Move the cursor in SiYuan Note to automatically slide the bottom preview tab to the matching slide page and highlight the block, while updating the right inspector panel in real-time;
- **Reverse Selection**: Click any element inside the bottom preview sandbox to smoothly scroll and highlight the source block in SiYuan Note.

---

## 5. Offline Exports & Pro DevServer Mode

- **Single-File Offline HTML Export (`📥`)**: Generates an all-in-one standalone HTML package with inlined Base64 local images and full keyboard navigation;
- **High-Fidelity PDF Handout Export (`🖨️`)**: Renders print-optimized slides with support for 16:9, 4:3, and A4 layouts with preserved colors (`print-color-adjust: exact`);
- **Pro Mode CLI DevServer Bridge**: Exports official standard `slides.md` files (with frontmatter, page delimiters, and slot directives) to run locally via `npx @slidev/cli`.

---

## 6. Synergy with Property Manager

- Run **Slidev Synergy: Copy Preset Templates to Clipboard** to export ready-to-use slide templates to `siyuan-property-manager`;
- Run **Slidev Synergy: Transition Statistics** and **Batch Replace Transitions** to audit and batch-migrate presentation attributes across your entire notebook library.
