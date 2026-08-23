# TASK-001: Update 2.1 nested activity processes

Status: complete

## Objective

Upgrade FLOX to the strict version-4 multi-process activity-diagram aggregate. Each process owns its title, position, swimlanes, nodes, connectors, and layout while the existing project APIs, local-first behavior, visual system, and protected brand surfaces remain intact.

## Delivered

- Strict client/server v4 schemas with v1-v3 normalization and deterministic Decision expansion.
- Global identifier enforcement and process-boundary connector rejection at schema, store, canvas interaction, and server layers.
- Active-process commands, process management, atomic title movement, lane management, selection transfer, copy/paste, cascade deletion, and undo/redo.
- Layered table-style process pools with centered editable title rows, 72px Decision/Merge diamonds, and process-relative nodes.
- Per-process validation and persistent Diagram Health read, clear, restore, and focus behavior.
- Canvas-wide v4 JSON/PNG/SVG exports, project-based workspace archives, namespaced combined SVG markers, and functional 1x/2x/3x PNG preferences.
- Non-destructive Stitch Update 2.1 variants registered in `.stitch/metadata.json`.

## Protected surfaces

- `web/src/components/BrandLogo.tsx`
- `web/public/favicon.svg`
- `assets/brand`
- Header logo geometry and branding
- Existing project, revision, authentication, conflict, and collaboration endpoint contracts

## Test coverage

- Legacy migration, deterministic Decision conversion, strict fields/types, global IDs, and cross-process references.
- Process geometry, automatic layout, movement gestures, active commands, move-selected boundaries, cross-process paste, and cascade deletion.
- Per-process health rules and persisted notification read/dismiss/restore state.
- Nested status counts, workspace ordering, project-identified failures, ZIP contents, SVG marker isolation, and PNG scale persistence.
- Edge, WebKit, mobile Edge, axe, keyboard/focus, connector dragging, export, collaboration, and visual snapshots.

## Environment exception

Firefox builds successfully but cannot execute a FLOX page in the current Windows headless environment. The browser runner reports pre-page failures at 1-2ms and stalls until the 420-second command timeout despite software/compositor-disabling preferences.

## Final verification

- `npm run verify`: typecheck passed; 76 frontend tests passed; 27 server tests passed; the production build completed successfully.
- `npm run test:e2e`: 61 Edge, WebKit, and mobile Edge scenarios passed; 8 non-Edge visual-baseline cases were intentionally skipped by project configuration.
- Edge visual snapshots and automated axe coverage passed. WebKit and mobile interaction, responsive layout, keyboard/focus, notifications, nested-process connector rejection, and export behavior passed.
- Firefox remains the explicit pre-page environment exception documented above; no application assertion ran or failed in that profile.

## Cleanup

- Removed an unused active-lane alias from the process toolbar.
- Reused the version-specific node-type set instead of rebuilding it during each import.
- Confirmed no debug logs, debugger statements, TODO/FIXME markers, backup files, or obsolete swimlane renderer remain in touched feature source.
- Preserved the intentional structured server logger.

## Completion gate

- [x] Formal code review approved after all important findings were resolved.
- [x] Requested post-review cleanup completed.
- [x] Final typecheck, unit/server tests, production build, and supported-browser verification recorded.
