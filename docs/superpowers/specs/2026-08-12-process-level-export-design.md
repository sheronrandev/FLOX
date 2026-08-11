# Process-Level Export Design

## Purpose

Correct FLOX's export scopes so that an activity diagram means one process inside a v4 project document. Image exports must render each process independently, while JSON exports must support both single-process documents and complete project documents that can be imported back into FLOX.

## Terminology

- **Process**: One independently rendered activity diagram in `DiagramDocument.processes`.
- **Project**: One repository record containing a complete v4 `DiagramDocument` and one or more processes.
- **Workspace**: All projects returned by the active project repository.
- **Selected diagram**: The active process in the current project.

## Scope Behavior

### PNG and SVG

#### Export selected

- Export only the active process.
- Download the file directly rather than wrapping it in a ZIP.
- Use `{project-name}-{process-order}.{format}`.

#### Export separately

- Export every process in the current project as an independently rendered file.
- Download one ZIP whose root contains one file per process.
- Use `{project-name}-001.{format}`, `{project-name}-002.{format}`, and so on.

#### All-in-one

- Export every process from every workspace project as an independently rendered file.
- Download one workspace ZIP.
- Create one folder per project and place that project's process files inside it:

  ```text
  {project-name}/
    {project-name}-001.{format}
    {project-name}-002.{format}
  ```

- Do not combine processes or projects into one image.

### JSON

#### Export selected

- Export a valid v4 `DiagramDocument` containing only the active process.
- Normalize the exported process position to `{ x: 0, y: 0 }` while preserving its lanes, nodes, connectors, layout, identifier, name, and appearance.
- Set the exported document metadata title to `{project title} - {process name}`.
- The result must pass `parseDiagram` and import through the existing FLOX diagram import flow.
- Download it directly as `{project-name}-{process-order}.json`.

#### Export project

- Export the complete current v4 project document without removing or combining processes.
- The result must pass `parseDiagram` and import through the existing FLOX diagram import flow.
- Download it directly as `{project-name}.json`.

#### All-in-one

- Download one workspace ZIP with one folder per project.
- Show an **Organization** choice only for JSON All-in-one exports.
- Default Organization to **Diagram-wise** each time the dialog opens.
- Diagram-wise produces one importable single-process v4 document per process:

  ```text
  {project-name}/
    {project-name}-001.json
    {project-name}-002.json
  ```

- Project-wise produces one complete importable v4 project document per project:

  ```text
  {project-name}/
    {project-name}.json
  ```

## Naming and Ordering

- Number processes from their array order within each project, starting at `001`.
- Use three-digit zero padding. The existing 100-process limit means `001` through `100` is sufficient.
- Derive filesystem-safe names from the project title while preserving readable casing where the current download helper permits it.
- Remove unsafe path characters and fall back to `activity-diagram` for an empty sanitized name.
- Resolve duplicate project folder names deterministically with `-2`, `-3`, and later suffixes in repository export order.
- Use `/` as the ZIP entry separator.
- Keep the current project first, followed by remaining projects in repository recency order.

## Architecture

Introduce a process-slicing helper that produces a valid one-process `DiagramDocument`, and a centralized export-manifest builder. A manifest entry contains the source project, optional process order, output path, and validated document to render or serialize.

The manifest builder owns scope, naming, ordering, and folder organization. PNG, SVG, and JSON encoders consume manifest entries without independently deciding which projects or processes belong in the export. This makes the same process boundaries apply to every format.

Direct selected/project exports reuse the same document and naming helpers without ZIP packaging. Archive exports validate and construct the complete manifest before encoding any entry.

## User Interface

- Replace the ambiguous scope labels with format-specific choices.
- For PNG and SVG, show **Export selected**, **Export separately**, and **All-in-one**.
- For JSON, show **Export selected**, **Export project**, and **All-in-one**.
- Show short helper copy describing the chosen scope and whether the result is a direct file or ZIP.
- Show the JSON Organization control only when Format is JSON and Scope is All-in-one.
- Organization contains **Diagram-wise** and **Project-wise**, with Diagram-wise selected by default.
- Keep PNG quality and Remember as default behavior unchanged.
- Disable Export selected with an accessible explanation only if no active process exists.
- Progress announcements count generated files, for example `Preparing 3 of 12`.

## Rendering

- A process-level image is rendered from a temporary valid v4 document containing that process only.
- Normalize the sliced process position to the origin before calculating export bounds.
- Preserve the complete table, centered process title, lanes, nodes, connectors, labels, colors, routing, and transparent-background behavior.
- Apply the selected PNG scale to every PNG entry.
- Retain safe browser-canvas limits for each independently rendered PNG.

## Validation and Failure Handling

- Validate every current or repository-loaded project with `parseDiagram` before creating downloads.
- Validate every single-process sliced document before rendering or serialization.
- Build and validate the entire manifest before ZIP encoding so a failure cannot produce a partial archive.
- Identify the failing project and, when applicable, its process order in the error message.
- Keep the dialog open and preserve the selected options after a failure.
- Persist remembered PNG quality only after the entire requested export succeeds.

## Compatibility

- Do not change the v4 persistence schema, repository model, REST endpoints, autosave, collaboration, or import APIs.
- A selected-process JSON imports as a normal one-process project document.
- A project JSON imports as its complete multi-process document.
- Workspace collection import remains out of scope.
- BrandLogo, favicon, `assets/brand`, logo geometry, and header branding remain untouched.

## Test Strategy

- Unit-test single-process slicing, origin normalization, process-order numbering, safe duplicate folder names, and manifest paths.
- Unit-test PNG/SVG current-project archives and all-project folder archives with one entry per process.
- Unit-test selected, project, diagram-wise workspace, and project-wise workspace JSON contents through `parseDiagram`.
- Component-test format-specific scope labels, default JSON organization, active-process selection, helper copy, progress, failure handling, and PNG preference persistence.
- Browser-test direct selected export, current-project separate ZIP, all-project folder ZIP, and both JSON organizations.
- Verify typecheck, frontend/server tests, production build, Edge/WebKit/mobile flows, and accessibility.

## Skill Workflow

- `superpowers:brainstorming`: establish and approve the scope semantics in this design.
- `superpowers:writing-plans`: translate this design into file-specific TDD implementation tasks.
- `superpowers:test-driven-development`: add each manifest, slicing, dialog, and archive behavior as a failing test before production changes.
- `superpowers:systematic-debugging`: investigate any unexpected export, archive, import, or browser-test failure before changing code.
- `senior-frontend`: implement the TypeScript export orchestration and React dialog state.
- `web-accessibility`: verify scope controls, conditional Organization disclosure, announcements, errors, keyboard operation, and mobile reflow.
- `superpowers:requesting-code-review`: review behavior against this specification before cleanup.
- `superpowers:verification-before-completion`: require fresh full verification evidence before completion claims.
- `specs-code-cleanup`: run hygiene cleanup only after review approval.

## Out of Scope

- Importing a whole workspace ZIP.
- User-editable export sequence numbers.
- Changing process identifiers stored in v4 documents.
- Combining multiple processes into one PNG or SVG.
- Redesigning unrelated editor or workspace interfaces.
