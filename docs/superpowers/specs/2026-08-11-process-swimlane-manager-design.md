# Process and Swimlane Manager UI Design

## Goal

Improve the process and swimlane manager so users can identify hierarchy, understand every action, and safely manage processes and lanes within the narrow editor sidebar. The change is frontend-only and preserves the existing diagram store commands and document behavior.

## Scope

The implementation changes the process and swimlane management section rendered by `web/src/components/EditorToolbar.tsx`, its local styles in `web/src/styles.css`, and focused frontend tests. It may add a small colocated UI component or hook if that keeps menu or announcement behavior isolated and testable.

The implementation must not modify server files, HTTP APIs, persistence adapters, diagram schemas, store command semantics, or backend behavior.

## Visual Direction

Use FLOX's existing calm technical style: restrained teal emphasis, quiet dark surfaces, clear borders, and efficient spacing. The manager should feel like a structured editing tool rather than a stack of equally weighted buttons.

Each process is a compact hierarchical card with three visual levels:

1. A process header containing the process name, selected state, Process settings action, and overflow menu.
2. A primary action row containing Add lane and Show on canvas.
3. A labeled lane list containing full-priority lane names and contextual management controls.

The selected process uses a stronger card border and surface treatment than inactive processes. Keyboard focus remains a separate, unmistakable focus ring and must not reuse the selected-state treatment alone.

## Information Architecture and Copy

- `Properties` at process level becomes `Process settings`.
- `Properties` at lane level becomes `Lane settings`.
- `Focus` becomes `Show on canvas`.
- The lane collection is visibly introduced as `Swimlanes` with an item count.
- `Move selected here` becomes contextual menu copy such as `Move selection to this process`.
- Process deletion is labeled `Delete process` and retains the existing store confirmation behavior.
- Lane movement controls expose contextual names such as `Move User swimlane left` and `Move User swimlane right`.
- Lane deletion exposes a contextual name such as `Delete User swimlane and keep its nodes`.

## Process Card Behavior

Clicking the process name continues to set that process active after the existing unsaved-draft guard passes.

The Process settings button continues to open the existing inline process editor and expose `aria-expanded` and `aria-controls`. Closing or saving the editor returns focus to its trigger.

Add lane remains directly visible because it is a frequent structural action. Show on canvas remains directly visible because it navigates the diagram viewport and clarifies the former Focus action.

The overflow menu contains the lower-frequency actions:

- Move selection to this process
- Delete process

The overflow trigger has a contextual accessible name, for example `More actions for Claims approval`. The menu opens adjacent to its trigger, supports Escape to close, closes on outside interaction, and restores focus to the trigger. Delete process is visually separated and styled as destructive.

Move selection is disabled when the existing store state shows no selected nodes, when the selected nodes already belong to the target process, or when the target has no lane. The UI does not duplicate the store's full movement-validity algorithm; the store remains authoritative when the action is invoked. Disabled presentation must not imply that a move succeeded.

## Swimlane Row Behavior

Lane names receive the flexible width in the row. The full text remains available through the native title text and programmatic control labels when visual truncation is unavoidable at the narrowest supported width.

Lane settings remains a visible text action. Reorder and delete remain icon controls with at least a 44 by 44 CSS-pixel interaction target. Disabled reorder buttons remain distinguishable without becoming illegible.

After a successful reorder action, a polite live status region announces the lane name and its new one-based position, for example `User swimlane moved to position 2 of 3.` The store's existing `moveLane` command remains unchanged.

The existing lane settings disclosure, dirty-draft confirmation, save behavior, and focus return are preserved.

## Responsive and Overflow Rules

The manager must remain usable in the existing expanded editor sidebar and at 200% browser zoom. Process names and lane names receive priority over secondary actions. Controls may wrap into an intentional second row, but the manager must not introduce horizontal page scrolling.

The overflow menu must remain within the viewport. Existing tooltip infrastructure may provide supplemental text, but tooltips are not the sole source of an accessible name.

## Accessibility Packet

- Surface: process and swimlane manager component family
- Workflow type: remediation pass
- Primary packet: keyboard-focus
- Signal source: manual UI review
- Severity: major
- Ownership: frontend application

Native buttons and menu-capable primitives are preferred over clickable generic elements. Every icon-only control has a contextual accessible name. Menu focus order, Escape behavior, outside dismissal, and focus restoration are explicitly tested. Selected process state is programmatic as well as visual. Reorder results use a polite status announcement.

Automated checks cover names, roles, relationships, contrast regressions, and invalid ARIA. Manual verification covers logical tab order, visible focus, menu keyboard behavior, announcements, 200% zoom, and narrow-sidebar reflow.

## Component and Data Boundaries

`EditorToolbar` continues to read document, active process, and selection state from `useDiagramStore`. Existing commands remain the only mutation path: `setActiveProcess`, `addLane`, `moveLane`, `removeLane`, `removeProcess`, and `moveSelectedToProcess`.

If extracted, the overflow menu receives labels, disabled state, and callbacks through props. It does not import the diagram store or own domain decisions. Reorder announcement state remains local UI state because it is transient interaction feedback, not document data.

## Error and Edge-State Handling

- A process with no lanes still displays Add lane and disables moving a selection into it.
- A process with one lane disables both reorder directions for that lane.
- A process with no active selection disables the move action.
- Long process and lane names preserve layout and expose their full text.
- Read-only mode continues to make the manager inert through the existing boundary.
- Existing unsaved process and lane draft confirmation behavior is preserved.
- Empty process state continues to provide an Add process path.

## Test Strategy

Implementation follows test-driven development.

Focused component tests verify:

- distinct Process settings and Lane settings labels;
- contextual overflow trigger and menu items;
- disabled move-selection conditions visible from store state;
- menu Escape behavior and focus restoration;
- contextual lane reorder and delete names;
- reorder status announcement text.

Existing editor tests are updated only where visible copy intentionally changes. Automated verification runs typechecking, unit tests, the production build, accessibility checks, and targeted editor browser tests. Visual verification updates the relevant screenshot only after direct review confirms the intended hierarchy in dark and light themes and at narrow width.

## Success Criteria

- Process, process actions, and swimlanes are distinguishable within three seconds.
- Generic `Properties` and `Focus` copy no longer appears in this manager.
- Full lane identity has more visual priority than secondary actions.
- All management actions have contextual accessible names.
- Overflow and reorder interactions are keyboard-operable with visible focus and useful feedback.
- Existing diagram mutations behave exactly as before.
- No backend, API, persistence, or document-schema file changes.
