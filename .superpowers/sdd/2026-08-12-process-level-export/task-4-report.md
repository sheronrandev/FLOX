# Task 4 Report: Backend compatibility and archive security verification

## Status

Complete.

## Files

- `server/test/validate-diagram-v4.test.mjs`
- `server/test/server.test.mjs`
- `server/src/services/project-service.mjs`
- `web/src/diagram/process-export.test.ts`
- `.superpowers/sdd/2026-08-12-process-level-export/task-4-report.md`

## Characterization and RED evidence

- `validateDiagram` accepted both strict v4 shapes without production changes: a selected-process export with title `Canvas - Claims` and one origin-positioned process, plus a complete two-process project with globally unique process IDs.
- Archive security coverage passed as characterization evidence: traversal, backslash, control-character, empty/dot, collision, and internal-ID disclosure cases all produce stable, unique, two-segment public paths.
- The initial focused server run was RED: 21 of 22 tests passed. The new revision test proved that revision summaries preserved title and revision but omitted `processCount` (`undefined` instead of 2/1).

## Production change and root cause

Added `processCount` to the existing `documentTotals` helper in `server/src/services/project-service.mjs`.

Root cause: the API's revision summary projection called `documentTotals`, which calculated only node and edge counts. Both export document shapes had empty nodes and edges, so that existing summary could not represent their process count even though persistence and restore retained the full v4 documents.

## Verification

- `server`: `npm.cmd test` — 29 passed, 0 failed.
- `web`: `npm.cmd test -- --run src/diagram/process-export.test.ts` — 14 passed, 0 failed.
- `web`: `npm.cmd run typecheck` — passed.

## Commit

`test: verify export persistence and archive safety` (this commit)

## Backend and security self-review

- Persistence/revision coverage uses the established authenticated API helpers, expected-revision controls, temporary store, and automatic cleanup. It verifies stored and restored v4 documents rather than mocks.
- The summary addition is derived only from validated document structure and is additive; it does not alter endpoint routing, stored records, schemas, authorization, or error responses.
- Archive-path tests reject traversal segments, backslashes, C0 controls, ambiguous segments, collisions, and internal identifiers from public filenames. Assertions do not expose internal filesystem data.

## Concerns

None.
