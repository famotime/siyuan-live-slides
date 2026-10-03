# CLAUDE.md: siyuan-slidev

## Commands

- Run tests: `npm test` (or `npx vitest run`)
- Run build: `npm run build`
- Dev mode: `npm run dev`
- Typecheck: `npm run typecheck`

## Architecture Quick Reference

- **Plugin Entry**: `src/index.ts` (manages lifecycle, commands, docks, tabs).
- **Compiler**:
  - `src/compiler/document-compiler.ts`: Orchestrates SiYuan block AST & IAL compilation to Slidev.
  - `src/compiler/slidev-importer.ts` & `src/compiler/html-cleaner.ts`: Slidev Markdown importer and HTML container cleaner.
  - `src/compiler/slidev-ast-builder.ts`: Core AST builder.
- **Engine**: `src/engine/engine-manager.ts` (Web Sandbox vs CLI DevServer).
- **Export**: `src/export/` (`single-html-exporter.ts`, `pdf-exporter.ts`, `markdown-renderer.ts`).
- **UI**: `src/ui/dock/SlidevInspectorDockView.vue` (contains `PageInspectorSection.vue`, `BlockInspectorSection.vue`, `DocInspectorSection.vue`).
- **Testing**: `tests/` (14 suites, uses `tests/mocks/siyuan.ts`).

## Rules

- Do not commit or push to git without explicit user request.
- Run `npm test` and `npm run build` to verify changes.
