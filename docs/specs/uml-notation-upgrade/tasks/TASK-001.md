# TASK-001: Full UML notation and property editing upgrade

Status: completed

## Objective

Implement the approved version-2 diagram model, complete UML notation palette, staged property editing, selectable connectors, safe v1 migration, and matching server persistence.

## Provides

- `web/src/domain/diagram.ts`
- `web/src/store/diagram-store.ts`
- `web/src/diagram/`
- `web/src/components/EditorToolbar.tsx`
- `web/src/components/PropertiesPanel.tsx`
- `web/src/styles.css`
- `server/src/domain/validate-diagram.mjs`
- Related unit, integration, and end-to-end tests

## Definition of Done

- [x] Version-1 documents migrate to the version-2 schema without data loss.
- [x] All approved UML notations render, persist, export, and participate in undo/redo.
- [x] Node, swimlane, and connector property drafts apply only through Save.
- [x] Connectors and their guard labels are selectable and editable.
- [x] Client, server, build, accessibility, and browser verification pass.
- [x] Approved review and cleanup summaries are recorded.

## Implementation verification

- `npm run verify` — passed (41 frontend tests, 20 server tests, typecheck, production build)
- `npm run test:e2e` — passed (46 browser/accessibility/visual checks, 8 expected non-Edge visual skips)

## Code cleanup summary

Cleanup date: 2026-08-11

- Reviewed all touched React, TypeScript, and MJS sources after implementation approval.
- Confirmed there are no temporary logs, debugger statements, TODO/FIXME markers, dead imports, or obsolete v1 runtime branches outside the intentional migration boundary.
- Normalized imports in the editor toolbar and swimlane renderer.
- Reformatted the selectable routed-edge implementation without changing behavior.
- Kept shared notation dimensions, labels, and defaults centralized in `web/src/domain/notation.ts`.
- Hardened connector E2E hit testing to select a verified pointer-accessible path segment.

Post-cleanup verification:

- `npm run verify` — passed.
- Edge editor and visual suites — 9 checks passed; the connector scenario was subsequently repeated three times and passed all three runs.
