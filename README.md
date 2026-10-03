# SiYuan Slidev Presentation Plugin

[简体中文](./README_zh_CN.md)

> **"Turn notes into presentations, bring presentations back to content; zero pollution of note content, powered by modern reactive web animation."**

`siyuan-slidev` is an integrated presentation plugin for SiYuan Note. Leveraging SiYuan's granular block-level architecture and Inline Attribute List (IAL) system, it brings the state-of-the-art **Slidev** presentation framework into the SiYuan ecosystem.

---

## Key Features

- 🎯 **Zero-Pollution Metadata**: All layouts, transitions, backgrounds, and speaker notes are persisted in horizontal dividers (`---`) or block attributes `custom-slidev-*`.
- ⚡ **Dual Presentation Engines**:
  - **Built-in Lightweight Web Sandbox**: 0 external dependencies, no Node/CLI required, loaded in milliseconds.
  - **Pro Mode**: Bridges directly to local running `slidev` CLI server (default port 3030) for full Vue SFC and npm ecosystem.
- 🔄 **Bi-directional Millisecond Sync**:
  - Move cursor in the editor, slide flips and highlights corresponding element immediately.
  - Click any element in the presentation sandbox, editor smoothly scrolls to the block.
- 🪄 **Visual Micro-Interactions**:
  - **Quick Divider Popover**: Click horizontal line `---` to switch 9-grid layouts, preview transitions, and edit speaker notes.
  - **Element Animation Bar**: Apply `v-click` progressive steps, column slots, and Shiki code spotlight with one click.
- 🎤 **Presenter Mode**: Dual-screen projection console with elapsed timer, next slide preview, and speaker notes.
- 📦 **Offline Export**: Export self-contained single-file HTML (offline playback) and high-resolution PDF handouts.
- 🤝 **Synergy with Property Manager**: Preset Slidev templates and whole-notebook slide attribute refactoring.
- 🤖 **AI Assistant**: Smart page splitting, animated list progressive steps, and automated speaker notes.

---

## Quick Start

1. Open any document in SiYuan Note.
2. Click **"Slidev Presentation"** icon on the top bar (or press `Alt+P` / `⌥P`).
3. Type `---` in your note to separate slides.
4. Click on the divider to pick layouts (e.g. `cover`, `two-cols`, `fact`).
5. Presentation Shortcuts:
   - `→` / `Space` / `PageDown`: Next action / slide;
   - `←` / `PageUp`: Previous action / slide;
   - `F`: Fullscreen;
   - `P`: Open Presenter console.

---

## License

[MIT License](./LICENSE)
