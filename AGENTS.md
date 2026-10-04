# Repository Guide: siyuan-slidev

## 1. Project Overview

`siyuan-slidev` is a SiYuan Note plugin that integrates the modern presentation framework Slidev into SiYuan's block-level ecosystem.
All presentation layouts, animations, transitions, and presenter notes are stored cleanly in native SiYuan IAL block attributes (`custom-slidev-*`) with zero pollution to the Markdown content.

Stack: Vue 3, TypeScript, Vite, Vitest, Sass, SiYuan Plugin API.

---

## 2. Common Commands

- `npm test` — Run all test suites with Vitest (`tests/*.test.ts`).
- `npm run build` — Build production bundle to `dist/` and generate `package.zip`.
- `npm run dev` — Run Vite in watch mode for development.
- `npm run typecheck` — Run TypeScript type checking.
- `npm run release[:patch|:minor|:major|:manual]` — Version tagging and release helper.

---

## 3. Architecture & Key Modules

- **Plugin Entry**: `src/index.ts`
  - Extends `Plugin` from `siyuan`.
  - Manages plugin lifecycle, command palette items, dock panel, and bottom split-screen preview tab.
  - Delegates document compilation to `src/compiler/document-compiler.ts`.
- **Compiler Pipeline**: `src/compiler/`
  - `document-compiler.ts`: Orchestrates AST retrieval, IAL parsing, dynamic block ref resolution, and sandbox updates.
  - `slidev-ast-builder.ts`: Converts SiYuan block AST into Slidev presentation models.
  - `slidev-importer.ts` & `html-cleaner.ts`: Parses external Slidev Markdown and cleans/converts HTML containers and grids.
  - `block-ref-resolver.ts`: Recursively resolves SiYuan block references (`((id))`).
- **Dual-mode Engine**: `src/engine/`
  - `engine-manager.ts`: Toggles between the built-in zero-dependency Web Sandbox and local Slidev CLI DevServer (port 3030).
  - `web-sandbox-bridge.ts`: Handles iframe postMessage IPC with the embedded preview player.
- **Export Pipeline**: `src/export/`
  - `markdown-renderer.ts`: Shared lightweight Markdown-to-HTML block renderer.
  - `single-html-exporter.ts`: Bundles complete presentation assets into a standalone offline `.html`.
  - `pdf-exporter.ts`: Outputs printable 16:9 landscape PDF slides.
- **Presentation Inspector UI**: `src/ui/`
  - `dock/SlidevInspectorDockView.vue`: Master container dock view managing state and sync.
  - `components/PageInspectorSection.vue`: Slide layout, transition, background, notes.
  - `components/BlockInspectorSection.vue`: Block `v-click` animation, column slot, Shiki code spotlight.
  - `components/DocInspectorSection.vue`: Presentation theme, aspect ratio, AI toolbar, quick actions.
  - `tab/SlidevPreviewTab.vue`: Split-screen live preview tab.
- **Testing & Mocks**: `tests/`
  - 14 test suites covering compiler, cleaner, renderer, inspector state, engine, export, and synergy.
  - `tests/mocks/siyuan.ts`: Host plugin mock aliased in `vitest.config.ts` for running tests in pure Node environments.

---

## 4. Coding & Contribution Rules

1. **Commit & Push Constraint**: NEVER run `git commit` or `git push` unless explicitly instructed by the user.
2. **Testing First**: Before and after modifying compiler, renderer, or state logic, run `npm test` to ensure 0 regressions.
3. **Build Validation**: Always run `npm run build` after changes to verify that Vite bundle and `package.zip` build cleanly.
4. **Style**: Use 2-space indentation, semicolons as configured, and Chinese comments for internal business logic.

## Reference Projects

重要：在涉及解析思源笔记文档块结构和内容、确认API时，务必查看developer_docs目录下开发者文档 和 siyuan-note 项目源码确认，不要凭猜测开发和测试。

siyuan-note（思源笔记本体项目源码）: D:\MyCodingProjects\siyuan-note

/developer_docs：思源笔记插件开发者文档

Slidev: D:\MyCodingProjects\slidev

Slidev Templates: D:\MyCodingProjects\slidev-templates

siyuan-property-manager: D:\MyCodingProjects\siyuan-property-manager

