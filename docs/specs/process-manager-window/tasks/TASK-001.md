# TASK-001 — Scalable process manager window

Status: completed

Completed: 2026-08-22
Cleanup date: 2026-08-22

## Objective

Replace the stacked sidebar hierarchy with a compact launcher and a searchable two-panel process manager that remains usable with 100 processes.

## Provides

- `web/src/components/process-manager/`
- `web/src/components/EditorToolbar.tsx`
- `web/src/components/ProcessActionsMenu.tsx`
- `web/src/diagram/ActivityCanvas.tsx`
- `web/src/styles.css`
- `web/e2e/process-manager-fixture.ts`
- `web/e2e/process-manager.spec.ts`
- `web/e2e/visual.spec.ts`

## Definition of Done

- [x] Compact launcher shows process count and active process.
- [x] Searchable, sortable process grid preserves readable names.
- [x] Selected process exposes swimlane management in a separate panel.
- [x] Mobile uses a two-step process/lane flow.
- [x] Read-only browsing remains available while mutations are hidden.
- [x] Canvas uses viewport-only rendering for large imported documents.
- [x] Focus, keyboard, zoom, axe, and visual coverage are present.
- [x] Cleanup completed after approved review.

## Cleanup Summary

- Checked the touched React, TypeScript, and browser-test files for debug logging, temporary comments, stale TODOs, dead code, and unused imports; no cleanup artifacts remained.
- Kept the cleanup cosmetic and preserved the reviewed behavior.
- Verified 173 frontend unit tests, 31 server tests, production typecheck/build, and 77 applicable Edge/WebKit/mobile browser tests.
- Firefox verification was attempted and stopped before page launch because the Playwright Firefox executable is not installed in this environment.
