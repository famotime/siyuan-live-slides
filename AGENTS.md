# Repository Guide: siyuan-live-slides

## 1. Project Overview

`siyuan-live-slides` is a SiYuan Note plugin that integrates the modern presentation framework Slidev into SiYuan's block-level ecosystem.
All presentation layouts, animations, transitions, and presenter notes are stored cleanly in native SiYuan IAL block attributes (`custom-slides-*`) with zero pollution to the Markdown content.

Stack: Vue 3, TypeScript, Vite, Vitest, Sass, SiYuan Plugin API.

---

## 2. Common Commands

- `pnpm test` — Run all test suites with Vitest (`tests/*.test.ts`).
- `pnpm run build` — Build production bundle to `dist/` and generate `package.zip`.
- `pnpm run dev` — Run Vite in watch mode for development.
- `pnpm run typecheck` — Run TypeScript type checking.
- `pnpm run release[:patch|:minor|:major|:manual]` — Version tagging and release helper.

---

## 3. Architecture & Key Modules

- **Plugin Entry & Commands**: `src/index.ts` & `src/plugin/`
  - `src/index.ts`: Extends `Plugin` from `siyuan`. Manages plugin lifecycle, dock panel, and coordination.
  - `src/plugin/command-registry.ts`: Centralizes registration and callbacks for 13 commands and palette actions.
  - `src/plugin/api-switch-bridge.ts`: Bridges `siyuan-api-switch` events and status synchronization.
  - `src/plugin/preview-window-manager.ts`: Manages preview tab, presenter window, and 16:9 standalone windows.
  - Delegates document compilation to `src/compiler/document-compiler.ts`.
- **Compiler Pipeline**: `src/compiler/`
  - `document-compiler.ts`: Orchestrates AST retrieval, IAL parsing, dynamic block ref resolution, and sandbox updates.
  - `slides-ast-builder.ts` & `directive-wrapper.ts`: Converts SiYuan block AST into Slidev presentation models and handles Frontmatter/v-click/v-motion/Shiki directives.
  - `slides-importer.ts` & `frontmatter-parser.ts`: Parses external Slidev Markdown, handles YAML frontmatter state machine, and unfolds code slice directives.
  - `html-cleaner.ts`: Cleans and converts HTML containers and grids to native SiYuan blocks.
  - `superblock-scanner.ts` & `list-column-scanner.ts`: Scans superblocks, allocates list column slots, and infers image roles.
  - `block-ref-resolver.ts`: Recursively resolves SiYuan block references (`((id))`).
- **Sync & Coordination**: `src/sync/`
  - `inspector-sync-coordinator.ts`: Manages Protyle DOM selection probing, preceding divider back-tracing, and list item attribute self-healing.
  - `cursor-tracker.ts`: Synchronizes cursor position with active slide pages.
- **Runtime & Sandbox Engine**: `src/engine/`
  - `runtime-node.ts`: Cross-runtime Node.js/Electron adapter (runtime `require`, platform & physical path resolution).
  - `v-click-resolver.ts`: Single Source of Truth for `v-click` step scheduling plans (Slidev-spec compliant incremental steps).
  - `web-sandbox-bridge.ts`: Handles iframe postMessage IPC with the embedded preview player.
- **Feature Flags**: `src/feature-flags/feature-flags.ts`
  - Build-time constants (`FEATURE_FLAGS`) gating command/UI entry points (`presenterMode`, `exportHtml`, `import`, `aiScript`, layouts, animation effects...). Disabled features keep code in bundle but strip entry points.
- **Export Pipeline**: `src/export/`
  - `markdown-renderer.ts`: Shared lightweight Markdown-to-HTML block renderer facade.
  - `visual-list-renderer.ts`: Renders visual list formats (cards, timelines, steps).
  - `slide-layout-renderer.ts`: Dispatches multi-column and rich slide layouts (two-cols, image-right, etc.).
  - `single-html-exporter.ts`: Orchestrates Base64 asset inlining and standalone presentation assembly.
  - `standalone-template-styles.ts` & `pdf-template-styles.ts`: Generates standalone and PDF CSS stylesheets reusing `src/export/styles/` shared layout styles.
  - `styles/shared-layout-styles.ts` & `styles/standalone-extra-styles.ts`: Shared layout rules (fact, timeline, intro) and standalone extra features (lightbox, mask).
  - `standalone-client-runtime.ts`: Self-contained presentation player client runtime script template.
  - `pdf-exporter.ts`: Generates 16:9 landscape PDF slides and handles isolated @page print styles.
- **Presentation Inspector UI**: `src/ui/`
  - `dock/SlidesInspectorDockView.vue`: Master container dock view managing state and layout orchestration.
  - `dock/useInspectorActions.ts`: Encapsulates kernel API mutations, notes conversion, and divider management.
  - `dock/useSuperBlockInspector.ts`: Computes superblock DOM/AST column widths and handles multi-block selection conversion.
  - `components/SlidesImportDialog.vue` & `components/useSlidesImport.ts`: Slidev project import dialog and composable orchestrating asset uploads, document creation, and slot backfilling.
  - `components/PageInspectorSection.vue`: Slide layout, transition, background, notes.
  - `components/BlockInspectorSection.vue`: Block `v-click` animation, column slot, Shiki code spotlight.
  - `components/DocInspectorSection.vue`: Presentation theme, aspect ratio, AI toolbar, quick actions.
  - `tab/SlidesPreviewTab.vue`: Split-screen live preview tab.
  - `tab/SlidesPresenterTab.vue`: Dual-screen presenter console view with external SCSS and timer/sync composables.
  - `tab/usePresenterTimer.ts` & `tab/usePresenterSync.ts`: FSM-8 drift-proof timer and cross-window BroadcastChannel sync composables.
- **Testing & Mocks**: `tests/`
  - 116 test suites (~1090 tests) covering compiler, cleaner, renderer, inspector state, actions (facade + domain modules), coordinator, engine, export runtime sections & shared styles, import composable, peek, presenter, and synergy.
  - `tests/mocks/siyuan.ts`: Host plugin mock aliased in `vitest.config.ts` for running tests in pure Node environments.

---

## 4. Coding & Contribution Rules

1. **Commit & Push Constraint**: NEVER run `git commit` or `git push` unless explicitly instructed by the user.
2. **Testing First**: Before and after modifying compiler, renderer, or state logic, run `pnpm test` to ensure 0 regressions.
3. **Build Validation**: Always run `pnpm run build` after changes to verify that Vite bundle and `package.zip` build cleanly.
4. **Style**: Use 2-space indentation, semicolons as configured, and Chinese comments for internal business logic.

## Reference Projects

重要：在涉及解析思源笔记文档块结构和内容、确认API时，务必查看developer_docs目录下开发者文档 和 siyuan-note 项目源码确认，不要凭猜测开发和测试。

路径按开发机器取用其一（两套路径指向同一批参考工程，不同机器布局不同）：

| 参考工程 | Windows 开发机 | Linux 开发机（本机） |
| --- | --- | --- |
| siyuan-note（思源笔记本体项目源码） | `D:\MyCodingProjects\siyuan-note` | `../siyuan` |
| siyuan-property-manager | `D:\MyCodingProjects\siyuan-property-manager` | — |
| Slidev | `D:\GitHub\slidev` | — |
| Slidev Templates | `D:\GitHub\slidev-templates` | — |

- `developer_docs/`：思源笔记插件开发者文档。本机为指向 `../siyuan-plugin-template/developer_docs` 的符号链接（仅本机参考，已列入 `.gitignore`，不入库、不推送）。
- 核对内核行为时以 `../siyuan` 的 Go 源码为准（`kernel/server/serve.go`、`kernel/model/assets.go`），`app/src` 为前端实现参考；developer_docs 未覆盖的细节不要凭猜测推断。


