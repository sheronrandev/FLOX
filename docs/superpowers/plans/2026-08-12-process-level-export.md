# Process-Level Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FLOX export one process per PNG, SVG, or diagram-wise JSON, with current-project and workspace ZIP structures that follow project folders and process-order filenames.

**Architecture:** Add a focused process-export module that converts a v4 project into validated single-process documents and deterministic export manifests. Keep binary/text encoding in the existing workspace-export module, and make the export dialog choose a manifest rather than embedding project/process selection rules in each format branch.

**Tech Stack:** React 19, TypeScript 5.9, Vitest, React Testing Library, Playwright, fflate, Node.js test runner, existing v4 Zod/server validators.

## Global Constraints

- Process sequence numbers come from array order and use `001` through `100`; internal process IDs never appear in filenames.
- PNG/SVG Export selected is direct, Export separately is one current-project ZIP with one process per file, and All-in-one is one workspace ZIP with project folders and one process per file.
- JSON supports Export selected, Export project, and All-in-one; JSON All-in-one defaults to Diagram-wise and also offers Project-wise.
- Every selected-process JSON and project JSON must remain importable as a strict v4 `DiagramDocument`.
- Validate all manifest entries before producing an archive; never download a partial archive.
- Preserve existing PNG scale, safe-canvas rejection, transparent background, repository ordering, autosave, collaboration, and REST contracts.
- Do not edit BrandLogo, favicon, `assets/brand`, logo geometry, or header branding.
- Use `superpowers:test-driven-development` before each production change and `superpowers:systematic-debugging` for every unexpected failure.
- Use `senior-frontend` for TypeScript/React changes, `backend-development` and `backend-security-coder` for server compatibility and archive-path review, and `web-accessibility` for the dialog remediation packet.
- Run `specs-code-cleanup` only after `superpowers:requesting-code-review` approves the implementation.

---

### Task 1: Single-process documents, safe names, and export manifests

**Skills:** `superpowers:test-driven-development`, `senior-frontend`, `backend-security-coder`

**Files:**
- Create: `web/src/diagram/process-export.ts`
- Create: `web/src/diagram/process-export.test.ts`
- Reference: `web/src/domain/diagram.ts`
- Reference: `web/src/persistence/project-repository.ts`

**Interfaces:**
- Produces: `sliceProcessDocument(document, processId): DiagramDocument`
- Produces: `safeArchiveSegment(value): string`
- Produces: `processExportFilename(projectTitle, processIndex, format): string`
- Produces: `buildProjectProcessManifest(record, format, directory?): ExportManifestEntry[]`
- Produces: `buildWorkspaceManifest(records, format, organization): ExportManifestEntry[]`
- Produces types `ExportFormat`, `JsonOrganization`, and `ExportManifestEntry`

- [ ] **Step 1: Write failing slicing and numbering tests**

  Add literal expectations proving that the second process becomes a valid origin-normalized v4 document and receives `002`:

  ```ts
  const document = createDiagram("Claims Project");
  document.processes[0].name = "Intake";
  document.processes.push({
    id: "process-b", name: "Approval", position: { x: 900, y: 400 },
    lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 },
  });

  const sliced = sliceProcessDocument(document, "process-b");
  expect(parseDiagram(sliced).processes).toHaveLength(1);
  expect(sliced.processes[0]).toMatchObject({ id: "process-b", name: "Approval", position: { x: 0, y: 0 } });
  expect(sliced.metadata.title).toBe("Claims Project - Approval");
  expect(processExportFilename("Claims Project", 1, "png")).toBe("Claims-Project-002.png");
  ```

- [ ] **Step 2: Run the new unit file and verify RED**

  Run: `npm.cmd test -- --run src/diagram/process-export.test.ts` from `web`.

  Expected: FAIL because `process-export.ts` and its exports do not exist.

- [ ] **Step 3: Implement validated single-process slicing and numbering**

  Implement immutable cloning through `parseDiagram`:

  ```ts
  export function sliceProcessDocument(document: DiagramDocument, processId: string): DiagramDocument {
    const validated = parseDiagram(document);
    const process = validated.processes.find((entry) => entry.id === processId);
    if (!process) throw new Error("The selected diagram is no longer available.");
    return parseDiagram({
      ...validated,
      metadata: { ...validated.metadata, title: `${validated.metadata.title} - ${process.name}` },
      processes: [{ ...structuredClone(process), position: { x: 0, y: 0 } }],
    });
  }

  export function processExportFilename(projectTitle: string, processIndex: number, format: ExportFormat) {
    return `${safeArchiveSegment(projectTitle)}-${String(processIndex + 1).padStart(3, "0")}.${format}`;
  }
  ```

- [ ] **Step 4: Add failing archive-name security and manifest tests**

  Cover unsafe names, duplicate project names, current-project root entries, workspace folders, and JSON organization:

  ```ts
  expect(safeArchiveSegment("../\\..\u0000")).toBe("activity-diagram");
  expect(buildProjectProcessManifest(record, "svg").map((entry) => entry.path))
    .toEqual(["Claims-001.svg", "Claims-002.svg"]);
  expect(buildWorkspaceManifest([record, duplicate], "png", "diagram-wise").map((entry) => entry.path))
    .toEqual(["Claims/Claims-001.png", "Claims/Claims-002.png", "Claims-2/Claims-2-001.png"]);
  expect(buildWorkspaceManifest([record], "json", "project-wise").map((entry) => entry.path))
    .toEqual(["Claims/Claims.json"]);
  ```

- [ ] **Step 5: Run the manifest tests and verify RED**

  Run the same focused Vitest command.

  Expected: slicing/numbering tests pass and manifest/security tests fail because the builders are missing.

- [ ] **Step 6: Implement traversal-resistant manifest construction**

  Define:

  ```ts
  export interface ExportManifestEntry {
    projectId: string;
    projectName: string;
    processOrder: number | null;
    path: string;
    document: DiagramDocument;
  }
  ```

  Sanitize path separators, control characters, leading/trailing dots and hyphens, and the reserved `.`/`..` results. Generate duplicate project folder suffixes in input order. Validate source records and every sliced document before returning the complete manifest.

- [ ] **Step 7: Run focused tests and typecheck**

  Run: `npm.cmd test -- --run src/diagram/process-export.test.ts` from `web`.

  Run: `npm.cmd run typecheck` from `web`.

  Expected: all new tests pass and TypeScript exits 0.

- [ ] **Step 8: Commit Task 1**

  ```powershell
  git add web/src/diagram/process-export.ts web/src/diagram/process-export.test.ts
  git commit -m "feat: add process export manifests"
  ```

---

### Task 2: Encode project and workspace archives without combined images

**Skills:** `superpowers:test-driven-development`, `senior-frontend`, `backend-security-coder`

**Files:**
- Modify: `web/src/diagram/workspace-export.ts`
- Modify: `web/src/diagram/workspace-export.test.ts`
- Modify: `web/src/diagram/export-diagram.ts`
- Modify: `web/src/diagram/export-diagram.test.ts`

**Interfaces:**
- Consumes: `ExportManifestEntry[]` from Task 1
- Produces: `encodeExportArchive(entries, format, preferences, onProgress): Promise<Uint8Array>`
- Produces: `exportDiagramImage(document, format, preferences, filenameBase?): Promise<void>`

- [ ] **Step 1: Replace old combined-export expectations with failing process-entry expectations**

  Update `workspace-export.test.ts` to unzip real archives and assert literal entries:

  ```ts
  const imageEntries = buildWorkspaceManifest(records, "svg", "diagram-wise");
  const svgArchive = unzipSync(await encodeExportArchive(imageEntries, "svg", preferences));
  expect(Object.keys(svgArchive)).toEqual([
    "Review/Review-001.svg",
    "Review/Review-002.svg",
    "Approve/Approve-001.svg",
  ]);
  expect(strFromU8(svgArchive["Review/Review-001.svg"])).toContain("Claims review");
  expect(strFromU8(svgArchive["Review/Review-001.svg"])).not.toContain("Payment");
  ```

  Add JSON assertions that parse every diagram-wise entry with `parseDiagram`, while project-wise entries retain all project processes.

- [ ] **Step 2: Run workspace export tests and verify RED**

  Run: `npm.cmd test -- --run src/diagram/workspace-export.test.ts` from `web`.

  Expected: FAIL because archives still combine whole projects and use the legacy filenames.

- [ ] **Step 3: Implement manifest-driven archive encoding**

  Replace scope branching with one encoder:

  ```ts
  export async function encodeExportArchive(
    entries: ExportManifestEntry[],
    format: ExportFormat,
    preferences: ExportPreferences,
    onProgress: (current: number, total: number) => void = () => undefined,
  ): Promise<Uint8Array> {
    const validated = entries.map((entry) => ({ ...entry, document: parseDiagram(entry.document) }));
    const files: Record<string, Uint8Array> = {};
    for (let index = 0; index < validated.length; index += 1) {
      const entry = validated[index];
      onProgress(index + 1, validated.length);
      if (format === "json") files[entry.path] = strToU8(JSON.stringify(entry.document, null, 2));
      else {
        const svg = diagramToSvg(entry.document, preferences.transparentBackground);
        files[entry.path] = format === "svg" ? strToU8(svg)
          : new Uint8Array(await (await svgToPngBlob(svg, preferences.imageScale)).arrayBuffer());
      }
    }
    return zipSync(files);
  }
  ```

  Do not emit or download until the manifest and all documents have passed validation.

- [ ] **Step 4: Add a failing direct-image filename test**

  In `export-diagram.test.ts`, stub `URL.createObjectURL` and anchor click behavior, call `exportDiagramImage(document, "svg", preferences, "Claims-002")`, and assert the downloaded filename is exactly `Claims-002.svg`.

- [ ] **Step 5: Run the filename test and verify RED**

  Run: `npm.cmd test -- --run src/diagram/export-diagram.test.ts` from `web`.

  Expected: FAIL because `exportDiagramImage` always derives the name from document metadata.

- [ ] **Step 6: Add the optional direct filename base**

  Change the signature to:

  ```ts
  export async function exportDiagramImage(
    document: DiagramDocument,
    format: "svg" | "png",
    preferences: ExportPreferences,
    filenameBase = safeExportName(document.metadata.title),
  )
  ```

  Use `safeExportName(filenameBase)` once before appending the extension.

- [ ] **Step 7: Remove obsolete combined encoders after callers and tests are gone**

  Delete `combineWorkspaceSvgs`, `createWorkspaceEnvelope`, `uniqueExportFilenames`, the old scope union, and legacy combined-marker rewriting only after `rg` confirms no production caller remains.

- [ ] **Step 8: Verify Task 2**

  Run: `npm.cmd test -- --run src/diagram/process-export.test.ts src/diagram/workspace-export.test.ts src/diagram/export-diagram.test.ts src/diagram/export-diagram-v4.test.ts` from `web`.

  Expected: all process, archive, and rendering tests pass.

- [ ] **Step 9: Commit Task 2**

  ```powershell
  git add web/src/diagram/workspace-export.ts web/src/diagram/workspace-export.test.ts web/src/diagram/export-diagram.ts web/src/diagram/export-diagram.test.ts
  git commit -m "feat: export one process per archive file"
  ```

---

### Task 3: Format-specific export dialog and active-process downloads

**Skills:** `superpowers:test-driven-development`, `senior-frontend`, `web-accessibility`

**Files:**
- Modify: `web/src/components/ExportDialog.tsx`
- Modify: `web/src/components/ExportDialog.test.tsx`
- Modify: `web/src/components/EditorToolbar.tsx`
- Modify: `web/src/components/EditorToolbar.test.tsx`
- Modify: `web/src/styles.css` only if the Organization controls require existing-grid reflow adjustments

**Interfaces:**
- Consumes: `activeProcessId: string | null`
- Consumes: Task 1 manifest and filename helpers
- Consumes: Task 2 archive encoder and optional image filename
- Preserves: PNG preference persistence only after full success

- [ ] **Step 1: Write failing component tests for the scope matrix**

  Render a two-process document with `activeProcessId` set to the second process and assert:

  ```ts
  expect(screen.getByLabelText("Export selected")).toBeChecked();
  expect(screen.getByLabelText("Export separately")).toBeVisible();
  expect(screen.getByLabelText("All-in-one")).toBeVisible();
  fireEvent.click(screen.getByLabelText("JSON"));
  expect(screen.getByLabelText("Export project")).toBeVisible();
  expect(screen.queryByLabelText("Export separately")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("All-in-one"));
  expect(screen.getByRole("group", { name: "Organization" })).toBeVisible();
  expect(screen.getByLabelText("Diagram-wise")).toBeChecked();
  ```

  Add a no-active-process test proving Export selected is disabled with associated explanatory text.

- [ ] **Step 2: Run component tests and verify RED**

  Run: `npm.cmd test -- --run src/components/ExportDialog.test.tsx src/components/EditorToolbar.test.tsx` from `web`.

  Expected: FAIL because the dialog has legacy Current diagram/All in one/Export separately options and no active-process prop.

- [ ] **Step 3: Pass active process ownership into the dialog**

  Add `activeProcessId={activeProcessId}` at the `EditorToolbar` call site and to `ExportDialogProps`. Keep selection derived from the store; do not add duplicate dialog selection state.

- [ ] **Step 4: Implement format-specific scope state**

  Use:

  ```ts
  type ExportScope = "selected" | "separate" | "project" | "all-in-one";
  const [scope, setScope] = useState<ExportScope>("selected");
  const [jsonOrganization, setJsonOrganization] = useState<JsonOrganization>("diagram-wise");
  const scopes = format === "json"
    ? [["selected", "Export selected"], ["project", "Export project"], ["all-in-one", "All-in-one"]] as const
    : [["selected", "Export selected"], ["separate", "Export separately"], ["all-in-one", "All-in-one"]] as const;
  ```

  When format changes, retain `selected` or `all-in-one`; map `separate` to `project` for JSON and `project` to `separate` for PNG/SVG.

  Always render the Scope fieldset, even when the repository contains one project, because one project may contain multiple processes. Change the contextual count copy from `{N} diagrams in workspace` to `{N} projects in workspace`.

- [ ] **Step 5: Implement direct and archive orchestration**

  Branch only at the scope boundary:

  - `selected`: slice the active process; direct JSON blob or direct image with numbered filename.
  - JSON `project`: direct validated complete document named `{project-name}.json`.
  - `separate`: build current-project process entries at ZIP root and encode one archive.
  - `all-in-one`: load ordered workspace records, build project-folder entries using the selected JSON organization, and encode one archive.

  Name current-project archives `{project-name}-diagrams-{format}.zip` and workspace archives `flox-workspace-{format}.zip`.

- [ ] **Step 6: Complete the accessibility remediation packet**

  Primary packet: `labels-announcements`.

  - Use native radio fieldsets with unique legends for Format, Scope, and Organization.
  - Associate the disabled selected-process explanation through `aria-describedby`.
  - Keep dialog focus containment and trigger restoration unchanged.
  - Announce loading separately from file encoding; encoding uses `Preparing {current} of {entry total}`.
  - Ensure Organization appears immediately after All-in-one selection without moving focus.
  - Verify 200% zoom and mobile width do not cause horizontal document overflow.

- [ ] **Step 7: Expand success/failure tests**

  Assert that:

  - selected process index 1 downloads `Canvas-002.json` and contains one origin-normalized process;
  - Export project downloads `Canvas.json` and retains both processes;
  - separate calls the encoder with current-project entries only;
  - all-in-one loads repository projects and passes folder entries;
  - remembered PNG scale persists after a successful multi-file archive and not after failure;
  - progress maximum equals manifest entry count rather than workspace project count.
  - a one-project, two-process document still exposes Export separately.

- [ ] **Step 8: Verify Task 3**

  Run: `npm.cmd test -- --run src/components/ExportDialog.test.tsx src/components/EditorToolbar.test.tsx src/diagram/process-export.test.ts src/diagram/workspace-export.test.ts` from `web`.

  Run: `npm.cmd run typecheck` from `web`.

  Expected: component/unit tests and typecheck pass without console warnings.

- [ ] **Step 9: Commit Task 3**

  ```powershell
  git add web/src/components/ExportDialog.tsx web/src/components/ExportDialog.test.tsx web/src/components/EditorToolbar.tsx web/src/components/EditorToolbar.test.tsx web/src/styles.css
  git commit -m "feat: add process-level export scopes"
  ```

---

### Task 4: Backend compatibility and archive security verification

**Skills:** `superpowers:test-driven-development`, `backend-development`, `backend-security-coder`

**Files:**
- Modify: `server/test/validate-diagram-v4.test.mjs`
- Modify: `server/test/server.test.mjs`
- Modify production server files only if a new failing compatibility test proves an existing contract defect
- Modify: `web/src/diagram/process-export.test.ts`

**Interfaces:**
- Verifies: exported single-process and complete-project JSON use unchanged v4 API contracts
- Verifies: sanitized archive paths cannot contain traversal segments

- [ ] **Step 1: Add server validation tests for export-shaped documents**

  Add fixtures representing a single-process exported document at origin and a two-process complete project. Assert `validateDiagram` preserves process count, IDs, positions, and titles.

  ```js
  const selected = document();
  selected.metadata.title = "Canvas - Claims";
  selected.processes[0].position = { x: 0, y: 0 };
  assert.deepEqual(validateDiagram(selected), selected);

  const project = document();
  project.processes.push(process("process-2", "Approval"));
  assert.equal(validateDiagram(project).processes.length, 2);
  ```

- [ ] **Step 2: Add an API persistence/revision test**

  In `server.test.mjs`, PUT the selected-process document, PUT a complete multi-process document as revision 2, restore revision 1, then assert the restored document contains exactly the selected process and remains version 4.

- [ ] **Step 3: Run server tests and evaluate the result**

  Run: `npm.cmd test` from `server`.

  Expected: tests pass without production changes because both shapes already satisfy strict v4. If a test fails, invoke `superpowers:systematic-debugging`, trace the exact validator/API mismatch, and change only the affected validation code.

- [ ] **Step 4: Add archive traversal mutation cases**

  In `process-export.test.ts`, table-test inputs including `../Claims`, `..\\Claims`, `.`, `..`, control characters, `A/B`, `A\\B`, and duplicate sanitized names. Assert every produced path:

  ```ts
  expect(path).not.toMatch(/(^|\/)\.\.?($|\/)/);
  expect(path).not.toMatch(/[\\\u0000-\u001f]/);
  expect(path.split("/")).toHaveLength(2);
  ```

- [ ] **Step 5: Verify server and security tests**

  Run: `npm.cmd test` from `server`.

  Run: `npm.cmd test -- --run src/diagram/process-export.test.ts` from `web`.

  Expected: all backend compatibility and archive security cases pass.

- [ ] **Step 6: Commit Task 4**

  ```powershell
  git add server/test/validate-diagram-v4.test.mjs server/test/server.test.mjs web/src/diagram/process-export.test.ts
  git commit -m "test: verify export persistence and archive safety"
  ```

---

### Task 5: Browser downloads, ZIP contents, and accessibility

**Skills:** `superpowers:test-driven-development`, `senior-frontend`, `web-accessibility`, `superpowers:systematic-debugging`

**Files:**
- Modify: `web/e2e/editor.spec.ts`
- Modify: `web/e2e/accessibility.spec.ts`
- Modify: `web/e2e/helpers.ts` if a reusable download/ZIP reader reduces duplication
- Modify visual snapshots only if the conditional Organization field intentionally changes the export modal baseline

**Interfaces:**
- Exercises: real browser downloads for all requested scope/format combinations
- Exercises: native scope/organization controls, announcements, focus, mobile reflow

- [ ] **Step 1: Write browser tests before final UI implementation is considered complete**

  Build two processes in the current project and a second repository project. Use Playwright downloads plus `unzipSync` to assert:

  - selected SVG filename ends in `-002.svg` and its text contains only the active process;
  - separate PNG ZIP contains `Project-001.png` and `Project-002.png` at the archive root;
  - all-in-one SVG ZIP contains `Project/Project-001.svg` and `Second-Project/Second-Project-001.svg`;
  - selected JSON parses as one process at `{ x: 0, y: 0 }`;
  - project JSON parses as the full process array;
  - JSON All-in-one defaults to Diagram-wise and produces per-process entries;
  - Project-wise produces one JSON per project folder.

- [ ] **Step 2: Run the new Edge tests and verify RED or expose incomplete behavior**

  Run: `npx.cmd playwright test e2e/editor.spec.ts --project=edge --grep "process-level export"` from `web`.

  Expected before Tasks 1-3: failures on legacy scope labels/archive contents. After Tasks 1-3: pass.

- [ ] **Step 3: Add accessibility assertions**

  Extend the export-dialog accessibility test to cover keyboard selection of All-in-one, conditional Organization visibility, live progress, focus retention, dialog Escape behavior, axe serious violations, 200% zoom, and mobile reflow.

- [ ] **Step 4: Run focused browser and accessibility coverage**

  Run: `npx.cmd playwright test e2e/editor.spec.ts e2e/accessibility.spec.ts --project=edge --grep "export"` from `web`.

  Run the same focused tests with `--project=webkit` and `--project=mobile-edge`.

  Expected: all supported profiles pass; debug any failure from root cause before changing waits or assertions.

- [ ] **Step 5: Update visual baseline only when semantically expected**

  If the JSON Organization control changes the captured modal, run:

  `npx.cmd playwright test e2e/visual.spec.ts --project=edge --update-snapshots --grep "export preview modal"`

  Inspect the resulting image before accepting it.

- [ ] **Step 6: Commit Task 5**

  ```powershell
  git add web/e2e/editor.spec.ts web/e2e/accessibility.spec.ts web/e2e/helpers.ts web/e2e/visual.spec.ts-snapshots
  git commit -m "test: cover process-level export workflows"
  ```

---

### Task 6: Review, cleanup, and release verification

**Skills:** `superpowers:requesting-code-review`, `specs-code-cleanup`, `superpowers:verification-before-completion`

**Files:**
- Create: `docs/specs/process-level-export/tasks/TASK-001.md`
- Create: `docs/specs/process-level-export/tasks/TASK-001--review.md`
- Clean: every TS, TSX, MJS, and test file changed in Tasks 1-5

**Interfaces:**
- Produces: approved review record, cleanup record, and final verification evidence

- [ ] **Step 1: Create the implementation task artifact**

  Record requirements, files touched, protected brand surfaces, TDD evidence, browser coverage, and a completion checklist in `TASK-001.md`. Set status to `review pending`.

- [ ] **Step 2: Request a specification and code review**

  Use `superpowers:requesting-code-review` to inspect the implementation against the approved design. Require explicit review of:

  - process/order filename correctness;
  - per-process image isolation;
  - JSON import validity;
  - duplicate-folder and traversal handling;
  - no-partial archive behavior;
  - active-process and read-only behavior;
  - PNG scale persistence;
  - protected API and brand boundaries.

  Record every finding and resolution in `TASK-001--review.md`. Do not begin cleanup until the review says approved.

- [ ] **Step 3: Apply post-review cleanup**

  Use `specs-code-cleanup` across all touched files. Remove debug statements, stale comments, unused imports, dead combined-image/workspace-envelope code, and duplicated naming/branch logic. Do not change signatures or behavior during cleanup.

- [ ] **Step 4: Run focused verification after cleanup**

  Run from the repository root:

  ```powershell
  npm.cmd run verify
  npm.cmd run test:e2e
  ```

  Also run `npm.cmd run test:e2e:firefox`; if Firefox fails before page creation because of the known Windows headless compositor environment, record the exact pre-page evidence rather than reporting an application failure.

- [ ] **Step 5: Perform manual verification**

  Confirm with real downloads that:

  - an active second process exports as `Project-002`;
  - a separate current-project ZIP contains one process per root file;
  - an all-project ZIP uses one safe folder per project;
  - diagram-wise and project-wise JSON files import through FLOX;
  - no combined PNG/SVG path remains;
  - keyboard focus, progress announcements, 200% zoom, and mobile layout remain usable.

- [ ] **Step 6: Complete artifacts and commit**

  Set task status to `complete`, record exact test counts and environment exceptions, then commit:

  ```powershell
  git add docs/specs/process-level-export web/src web/e2e server/test
  git commit -m "feat: complete process-level export workflows"
  ```
