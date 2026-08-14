---
name: flox-json-generator
description: Convert user-supplied process guidelines, mixed data sources, source-structure explanations, and requested folder layouts into batches of importable FLOX-native activity-diagram JSON files. Use for FLOX bulk generation or regeneration from Excel/XLSX, CSV/TSV, JSON, text/Markdown, PDF, images, or mixed evidence; for mapping roles to swimlanes and activities to UML nodes; and for validating academic decisions/merges, forks/joins, one-flow-per-webhook, readable routing, naming, counts, and final output folders.
---

# FLOX JSON Generator

Generate one validated FLOX v4 document per requested diagram. Treat the active FLOX codebase as the schema and routing authority.

## Required intake

Obtain or infer these four inputs before generation:

1. Diagram rules and academic/business guidelines, supplied as text or media.
2. The process data source, such as XLSX, CSV, JSON, TXT, PDF, or images.
3. An explanation of the source structure and mappings, supplied as text or media.
4. The exact output folder and filename structure, supplied as text or media.

Also identify the intended export target when page readability matters. Do not assume that a large multi-lane canvas will remain readable on one A4 page.

## Workflow

### 1. Inspect inputs

- Preserve source files unchanged.
- Use the appropriate spreadsheet, PDF, document, image, or computer-control skill when its trigger applies.
- Run `scripts/inspect_source.py` for XLSX/XLSM, CSV/TSV, JSON, TXT, or Markdown profiling.
- Read the active FLOX schema, notation dimensions, validation, and router before generating. Common locations are `web/src/domain/diagram.ts`, `web/src/domain/notation.ts`, `web/src/domain/validation.ts`, and `web/src/diagram/routing.ts`.
- Reconcile conflicting instructions in this order: explicit current user instruction, supplied guideline, structure explanation/media, source inference. Report material conflicts.

### 2. Normalize to a batch specification

- Copy `assets/batch-spec.template.json` to a task-local writable location.
- Populate it from the source without inventing missing process facts.
- Read `references/batch-spec.md` for the complete contract.
- Keep project, diagram, lane, node, and edge identifiers stable and unique.
- Use explicit node positions for fragile branching layouts. Use `rank` only for straightforward top-to-bottom flows.

### 3. Enforce FLOX and academic rules

Read `references/flox-rules.md` before generating. At minimum:

- Use one initial node and one final node per process unless the user explicitly defines a supported alternative.
- Keep decision diamonds label-free; place the decision question in the preceding activity when required by FLOX.
- Label decision exits with guards such as `Yes` and `No`, and converge every split through a merge before the final path.
- Converge every fork through a join before the final path.
- Use one node anchor/webhook for exactly one edge endpoint. Never reuse a webhook.
- Keep nodes in their responsible role's swimlane.
- Prevent flows from passing through nodes, sharing segments, or crossing other flows.
- Use object flows only when the source explicitly describes object/data movement.

### 4. Generate

Run:

```powershell
python scripts/build_flox_batch.py --spec <batch-spec.json> --output <output-folder>
```

Never overwrite an existing output folder. Generate to a new folder, validate it, then copy or rename it to the requested destination.

### 5. Validate completely

Run the portable structural and route validator on every file:

```powershell
python scripts/validate_flox_batch.py <output-folder> --spec <batch-spec.json>
```

When the FLOX repository is available, also run the native validator with its bundled `vite-node`:

```powershell
& "<flox-root>\web\node_modules\.bin\vite-node.cmd" -r "<flox-root>" -c "<flox-root>\web\vite.config.ts" "<skill-dir>\scripts\validate_with_flox.ts" "<output-folder>" "<flox-root>"
```

Native validation must use the current FLOX importer, built-in findings, node dimensions, and automatic router. Fix every node collision, flow overlap, and flow intersection; do not downgrade or bypass these checks.

### 6. Visual QA

- Import representative diagrams into the real FLOX editor.
- Cover every distinct lane count, topology type, unusually long label, and compact/page-oriented preset.
- Fit the diagram, inspect labels and guard placement, and check browser errors.
- For large batches, validate every JSON programmatically and use representative visual sampling; do not manually spot-check instead of exhaustive validation.

### 7. Deliver

- Recheck the final destination itself after copying.
- Report the output path, project-folder count, JSON-file count, topology coverage, and validation result.
- State any export-page limitation separately from JSON correctness.
- Retain the normalized specification and generator only when the user wants reproducibility; otherwise deliver the requested FLOX JSON hierarchy without unrelated artifacts.

## Failure conditions

Stop generation and resolve the source/specification when any of these occurs:

- A required role, node label, connection, branch target, or folder mapping is ambiguous.
- A node needs more incident flows than its four unique FLOX anchors can support.
- A decision lacks guarded exits or a merge; a fork lacks a join.
- The requested folder template produces duplicate or unsafe paths.
- Current FLOX rejects the document or the router produces an unreadable path.
