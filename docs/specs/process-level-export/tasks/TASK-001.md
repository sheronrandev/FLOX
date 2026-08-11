# TASK-001: Process-level export workflows

Status: complete

## Objective

Correct FLOX export scopes so one activity diagram means one ordered process inside a version-4 project document. Image exports render processes independently, while JSON exports produce either an importable selected-process document, a complete project document, or an organized workspace archive.

## Delivered

- Selected PNG/SVG exports for the active process with readable three-digit process-order filenames.
- Current-project separate PNG/SVG ZIPs with one independently rendered process at the archive root.
- All-project PNG/SVG ZIPs with one safe project folder and one independently rendered file per process.
- Importable selected-process and complete-project JSON downloads.
- Diagram-wise and project-wise JSON workspace organizations, with Diagram-wise as the dialog default.
- Centralized process slicing, safe naming, deterministic duplicate-folder handling, manifest validation, and no-partial archive preflight.
- Format-specific accessible scope controls, progress announcements, guarded in-flight dismissal, active-process handling, and functional PNG scale behavior.
- Existing v4 persistence, repository, REST, autosave, collaboration, and import contracts remain unchanged.

## Touched feature surfaces

- `web/src/diagram/process-export.ts` and tests
- `web/src/diagram/workspace-export.ts` and tests
- `web/src/diagram/export-diagram.ts` and tests
- `web/src/components/ExportDialog.tsx` and tests
- `web/src/components/EditorToolbar.tsx` and tests
- `web/e2e/editor.spec.ts`, `web/e2e/accessibility.spec.ts`, and `web/e2e/helpers.ts`
- Server compatibility/security tests only; no backend endpoint or schema changes

## Protected surfaces

- `web/src/components/BrandLogo.tsx`
- `web/public/favicon.svg`
- `assets/brand`
- Header logo geometry and branding
- Project, revision, authentication, conflict, collaboration, persistence, and import API contracts

## TDD and review evidence

- Unit coverage for single-process slicing, title truncation, process-order numbering, traversal-safe names, duplicate folders, manifests, PNG scale/background forwarding, and archive preflight.
- Component coverage for format-specific scopes, JSON organization defaults, active-process selection, progress, failure retention, focus, and guarded dismissal.
- Server tests confirm version-4 persistence and restore compatibility without manufacturing new summary fields.
- Real Edge, WebKit, and mobile Edge downloads are opened and inspected for exact filenames, ZIP paths, process isolation, JSON content, and re-import.
- Task reviews approved Tasks 1-5 after all Important findings were resolved.

## Final verification

- `npm.cmd run verify`: typecheck passed; 133 frontend tests passed; 31 server tests passed; the production build completed successfully.
- `npm.cmd run test:e2e`: 68 Edge, WebKit, and mobile Edge scenarios passed; 10 non-Edge visual-baseline cases were intentionally skipped by project configuration.
- The approved export dialog snapshot was visually inspected, updated for the new format/scope controls, and passed on the clean rerun.
- Real browser downloads verified selected-process PNG/SVG, separate current-project archives, workspace folder archives, selected/project JSON re-import, both JSON organizations, exact content-to-path mapping, and long-title numbering.
- Automated axe, keyboard/focus, live-announcement sequence, constrained-width 200% simulation, and mobile overflow checks passed.
- Manual screen-reader announcement quality and physical 200% browser zoom remain recommended human QA checks; their automated counterparts are covered.

## Environment exception

`npm.cmd run test:e2e:firefox` built successfully and discovered 26 tests, but the Windows headless Firefox runner aborted every attempted case at 1-4ms before page creation and produced no application assertion. The bounded command timed out after 600 seconds. This is recorded as the known pre-page compositor/runtime exception, not as a FLOX test failure.

## Cleanup

- Replaced stale combined-PNG canvas-limit guidance with accurate scale/SVG guidance.
- Guarded the direct image boundary to accept exactly one sliced process.
- Added successful multi-entry PNG scale and transparent-background forwarding coverage.
- Confirmed no debug output, temporary comments, unused imports, removable duplicate export branches, or legacy workspace-envelope implementation remains in the touched feature surface.
- Preserved public APIs, document schemas, persistence/import behavior, and all protected brand surfaces.

## Completion gate

- [x] Whole-feature specification and code review approved.
- [x] Post-approval hygiene cleanup completed.
- [x] Full typecheck, frontend/server tests, production build, and supported-browser verification recorded.
- [x] Firefox result or pre-page environment exception recorded.
- [x] Final task and review artifacts completed.
