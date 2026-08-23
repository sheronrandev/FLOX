# TASK-001: Standard swimlane layout and workspace export upgrade

Status: completed

## Objective

Implement the approved version-3 swimlane layout, table-style non-interactive pool, staged sidebar lane properties, workspace counts, and ZIP-based workspace exports without changing existing API contracts or brand assets.

## Provides

- `web/src/domain/diagram.ts`
- `web/src/domain/swimlane-layout.ts`
- `web/src/diagram/SwimlanePoolNode.tsx`
- `web/src/diagram/workspace-export.ts`
- `web/src/components/LanePropertiesForm.tsx`
- `web/src/components/ExportDialog.tsx`
- `web/src/components/EditorToolbar.tsx`
- `web/src/pages/EditorPage.tsx`
- `server/src/domain/validate-diagram.mjs`
- Stitch variants and related unit, server, component, browser, accessibility, and visual tests

## Protected surfaces

- `web/src/components/BrandLogo.tsx`
- `web/public/favicon.svg`
- `assets/brand`
- Existing project, revision, authentication, conflict, and collaboration endpoint contracts

## Definition of Done

- [x] Version-1 and version-2 documents normalize to strict version 3 while preserving coordinates.
- [x] One table-style swimlane pool renders below interactive nodes, connectors, labels, and handles.
- [x] Lane properties are staged and saved atomically from the left sidebar only.
- [x] Editor status reports workspace diagrams, nodes, and connectors.
- [x] Current and batch JSON, PNG, and SVG exports follow the approved direct-file and ZIP behavior.
- [x] Automatic and fixed heights share centralized geometry across canvas, validation, and exports.
- [x] Mobile lane editing, dialog focus, progress announcements, and serious axe findings are covered.
- [x] Post-review cleanup and final release verification are complete.

## Verification before cleanup

- Frontend typecheck, 54 frontend tests, 22 server tests, and production build passed.
- Edge editor suite: 7 passed.
- Edge accessibility suite: 7 passed.
- Edge visual suite: 4 passed with only the intentional export-dialog snapshot regenerated.
- Mobile regression scenarios: 3 passed after the responsive sidebar fix.
- Export focus restoration: passed on Edge, WebKit, and mobile Edge.

## Code cleanup summary

Cleanup date: 2026-08-11

- Removed the unreferenced legacy `SwimlaneNode.tsx` renderer after the synthetic pool replacement.
- Confirmed there are no feature-source debug logs, debugger statements, TODO/FIXME markers, or dead imports.
- Preserved the intentional structured server logger and atomic-write temporary-file handling.
- Added deterministic cross-browser export-dialog focus restoration.
- Kept mobile lane properties available in a bounded toolbar overlay and collapsed the overlay after normal node creation.
- Made theme token swaps transition-free for two animation frames so dark-mode contrast is never temporarily invalid.
- Confirmed `BrandLogo`, favicon, `assets/brand`, and header branding were not edited.

## Final verification

- `npm run verify` passed: typecheck, 54 frontend tests, 22 server tests, and production build.
- `npm run test:e2e` passed: 52 Edge, WebKit, and mobile Edge checks; 8 non-Edge visual checks intentionally skipped by configuration.
- Complete accessibility matrix passed: 21 checks across Edge, WebKit, and mobile Edge.
- The formerly intermittent WebKit dark-mode contrast scenario passed three consecutive isolated repetitions before the clean matrix run.
- Firefox could not start in this Windows headless environment: Playwright timed out after `RenderCompositorSWGL failed mapping default framebuffer`; no FLOX page or assertion executed.
