# Batch specification

Use this normalized JSON contract between source interpretation and FLOX generation. Copy `assets/batch-spec.template.json`, then replace its example values.

## Root

- `schemaVersion`: `1`.
- `batchName`: Human-readable batch label.
- `output`: Folder and filename templates.
- `layout`: Default canvas geometry.
- `projects`: One entry per requested project folder.

## Output templates

`output.projectFolderTemplate` supports `{projectId}`, `{projectName}`, and `{projectOrder}`. `output.fileNameTemplate` supports `{diagramId}`, `{diagramTitle}`, `{order}`, and padded order tokens such as `{order:02}` or `{order:04}`. Include `.json` in the filename template.

Templates must produce unique, Windows-safe relative names. The builder rejects absolute paths, traversal, reserved device names, duplicates, and an existing output root.

## Layout

- `preset`: `readable`, `compact-a4-landscape`, or `compact-a4-portrait`.
- `laneWidth`: Optional override, 180-1200 FLOX units.
- `rankGap`: Optional vertical distance between ranks.
- `top`: Optional first-rank Y position.
- `processX`, `processY`: Optional process position.
- `height`: Optional swimlane height, 320-5000.

Compact presets reduce geometry but cannot guarantee readable single-page A4 output for high lane counts or long labels. Treat export-page fitness as a separate requirement and visually verify it.

## Projects and diagrams

Each project requires `id`, `name`, `order`, and `diagrams`. Each diagram requires:

- `id`, `title`, `order`, and optional `processName`.
- `lanes`: Ordered objects with unique `id`, `name`, and optional `width` or `colorIndex`.
- `nodes`: UML node definitions.
- `edges`: Directed FLOX flows.

Generate one FLOX v4 document containing one process for each diagram entry.

## Nodes

Required fields are `id`, `type`, and `laneId` (`null` is allowed for annotations). Supported types are `activity`, `state`, `object-in-state`, `decision`, `merge`, `fork`, `join`, `initial`, `final`, `constraint`, and `note`.

- Set `label` for activities and states. Keep decision and merge labels empty.
- Set `state` only for `object-in-state`.
- Set `body` only for `constraint`.
- Position with either numeric `x` and `y`, or `rank` plus a lane. `rank` starts at zero.
- Use `offsetX` or `offsetY` to separate branch nodes within a lane.
- Prefer explicit `x` and `y` for decisions, forks, merges, joins, rework loops, and dense multi-lane paths.

## Edges

Required fields are `id`, `source`, and `target`. Optional fields:

- `type`: `control-flow` by default or `object-flow`.
- `sourceAnchor`, `targetAnchor`: `top`, `right`, `bottom`, or `left`.
- `guardLabel`: Required on decision exits; normally `Yes`/`No` or bracketed conditions.

When anchors are omitted, the builder selects the closest directional pair and allocates unused anchors. It fails if no unique anchor remains. Explicitly define anchors for branching structures.

## Source mapping rules

- Map each responsible role/actor to one swimlane.
- Map each action/state row to one node unless the guidelines explicitly combine rows.
- Preserve source order using `order` and `rank`; do not infer missing business steps.
- Convert a decision question into a preceding activity plus an empty decision diamond when required by FLOX.
- Add merge/join nodes only when required by the supplied structure or academic rules; never silently discard a branch.
