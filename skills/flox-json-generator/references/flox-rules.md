# FLOX-native activity-diagram rules

## Document contract

- Emit strict FLOX v4 JSON: `format: "activity-diagram"`, `version: 4`.
- Generate one document and one process per requested output file unless the user explicitly asks for a multi-process document.
- Keep every ID unique within the document and no longer than 80 characters.
- Keep titles and process names nonblank and no longer than 120 characters.
- Keep node labels at most 500 characters.
- Use lane widths from 180 to 1200 and process height from 320 to 5000.
- Keep each import file below FLOX's current upload limit; verify the active codebase because limits may change.

## Academic topology

- Start with exactly one initial node and finish with exactly one final node by default.
- Give the initial node no incoming flow and the final node no outgoing flow.
- Keep decision diamonds label-free. Put the question in the preceding activity and connect that activity to the diamond.
- Give each decision at least two guarded exits. For binary choices use unambiguous `Yes` and `No` guards.
- Rejoin all alternative decision branches through a merge before their common continuation or final node.
- Split parallel activities with a fork and rejoin every branch through a join before the common continuation or final node.
- Do not use a merge to represent synchronization and do not use a join to represent an alternative choice.

## Webhooks and flows

- A FLOX node has four anchors/webhooks: top, right, bottom, and left.
- Use one anchor for exactly one incident edge endpoint. Never attach multiple incoming or outgoing flows to the same anchor.
- Reject any node that needs more than four incident flows unless the process is remodeled with additional academically valid nodes.
- Use control flows for execution order. Use object flows only for explicit object/data movement.
- Preserve source-to-target direction and guard labels.

## Readability and routing

- Keep nodes inside the swimlane of the responsible role.
- Prefer a consistent top-to-bottom main flow.
- Reserve separate corridors for alternative or parallel branches.
- Never let a flow pass through a node, overlap another flow segment, cross another flow, or merge visually without a merge/join node.
- Avoid routing a long branch stem through the horizontal levels of the other branch. Reorder lanes or place branch-entry actors on opposite outer lanes when source roles allow it.
- Validate using FLOX's current router; source coordinates alone cannot prove the rendered route is clear.

## Page export

JSON/canvas correctness and page-export readability are different acceptance criteria. A valid multi-lane diagram may become unreadably small when fitted to one A4 page. Ask for the intended page size and orientation, use a compact preset only when requested, and inspect representative exports at final size.

## Acceptance gate

Do not deliver until every file passes:

1. JSON parsing and FLOX schema import.
2. Built-in FLOX validation.
3. Academic topology checks.
4. Unique-webhook checks.
5. Node-collision and routed-edge obstacle checks.
6. Edge-overlap and edge-crossing checks.
7. Folder, filename, count, and final-destination checks.
8. Representative real-editor visual QA across lane counts and topology variants.
