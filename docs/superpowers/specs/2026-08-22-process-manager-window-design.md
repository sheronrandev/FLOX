# Process Manager Window Design

## Purpose

Replace the editor sidebar's fully expanded process and swimlane list with a scalable process-management window. A project containing 100 activity-diagram processes must remain easy to navigate without forcing users to scroll through every process and every lane in the narrow sidebar.

In this document, a **process** means one activity diagram inside `DiagramDocument.processes`. The change is a frontend management-surface redesign. It does not alter the diagram schema, persistence, exports, collaboration APIs, or UML canvas behavior.

## Approved Direction

Use a large modal window divided into two independent regions:

- A searchable, sortable process grid on the left.
- A swimlane-management panel for the selected process on the right.

Process cards do not preview swimlanes. Their available space is reserved for complete process names and essential process metadata. This follows the high-level browsing model of Zen Browser's tab preview while retaining FLOX's established visual system and management commands.

## Editor Sidebar

Remove the expanded process cards, process forms, and swimlane lists from the editor sidebar.

Replace them with one compact launcher containing:

- A **Processes** button.
- A badge showing the total process count, including `100` when the document reaches its limit.
- A compact, wrapped line showing the active process name.

The active-process summary is informational and must not truncate the name into an unintelligible identifier. When there is no active process, it displays a clear fallback such as `No active process`.

The sidebar does not expose swimlane-management controls. Those controls exist only inside the Processes window. Existing palette commands continue to target the active process according to current store behavior.

## Processes Window

### Modal shell

The Processes button opens an accessible modal dialog. On desktop, the dialog uses most of the available viewport while preserving a visible outer margin. Its header contains:

- Title: **Processes**.
- Total process-count badge.
- **Add process** button.
- Close button.

The canvas remains mounted behind the modal. Opening the manager must not trigger canvas re-layout, routing, or thumbnail rendering.

### Left: process discovery

The desktop grid uses three responsive columns when space permits. It becomes two columns at intermediate widths and a single column on narrow screens.

Every process card contains:

- Three-digit display sequence derived from document array order, starting at `001`.
- The complete process name, wrapped naturally without ellipsis.
- Swimlane count.
- Selected-process indicator.
- Active-process indicator when the process is the current canvas target.
- **Show on canvas** action.
- Overflow menu for Process settings, Move selection to this process, and Delete process.

Cards have a consistent minimum height but may grow to show long names. Grid rows accommodate the tallest card in that row. The internal stable process ID is not shown as the primary label.

Clicking a card selects that process for the right panel. It does not change the active canvas process and does not close the dialog. **Show on canvas** sets the active process, closes the dialog, and focuses the corresponding process pool on the canvas.

### Search and ordering

Use the approved labelled-control toolbar:

- Label the search control **Find a process**.
- Search placeholder: `Search by process name or number…`.
- Include a search icon, an accessible clear-search button when text is present, and a `Ctrl/Cmd+K` shortcut while the dialog is open.
- Match process names case-insensitively and match displayed sequence numbers such as `001`.
- Announce the filtered result count politely.

The ordering control is labelled **Arrange results** and presents:

- **Process order · 001–100** by default.
- **Name · A–Z**.
- **Name · Z–A**.

Sorting affects only the manager view. It never mutates `DiagramDocument.processes`, process positions, IDs, or export numbering.

### Right: selected-process swimlanes

The right panel displays only the currently selected process. Its header contains:

- Display sequence.
- Complete process name.
- Swimlane count.
- **Process settings**.
- **Add swimlane**.

Each lane row contains:

- Complete lane name with wrapping where needed.
- Width and shared height-mode summary.
- Move left and Move right controls using the existing lane-order semantics.
- Lane settings.
- Delete action using the existing node-preservation behavior.

Lane settings continue to expose Label, Fill color, Width, Height mode, and Fixed height when applicable. Save applies the staged process or lane edit through existing store commands as one undoable commit. Cancel discards the draft.

Only one process or lane form may be open at a time. Changing selection, closing the dialog, opening another editor, showing a process on canvas, or starting a destructive action must confirm before discarding a dirty draft.

## Process Actions

The manager reuses existing behavior rather than creating parallel mutation paths:

- Add process uses the required-name staged form and selects the new process in the manager.
- Process settings edits the process name.
- Move selection retains the current eligibility rules and disabled explanation.
- Delete process retains the confirmed cascade summary for lanes, nodes, and connectors.
- Show on canvas activates and focuses the process.
- Add, update, reorder, and delete lane use the existing diagram-store commands.

Undo/redo, autosave, local/server persistence, collaboration revisions, validation, read-only mode, and conflict handling remain unchanged.

## Selection Model

The manager distinguishes two states:

- **Selected process:** controls the right-side swimlane panel.
- **Active process:** receives new nodes, lanes, paste, select-all, and other active-process commands on the canvas.

Opening the dialog initially selects the active process when one exists. Otherwise, it selects the first process in document order. Search and sort preserve selection even when the selected card is temporarily filtered out; the right panel remains associated with that process and provides a clear `Selected process is outside the current results` status.

If the selected process is deleted, selection moves to the next process in document order, then the previous one if no next process exists. If the final process is deleted, the right panel shows its empty state.

## Empty, Error, and Read-Only States

- No processes: explain that the project has no activity diagrams and present Add process when editable.
- No selected process: ask the user to select a process to manage its swimlanes.
- No search results: show the active query and a clear-search action.
- Zero swimlanes: explain that nodes require a swimlane and present Add swimlane when editable.
- Failed or blocked store operation: retain the dialog state and announce the existing store result without silently changing selection.
- Read-only: allow opening, searching, sorting, selecting, and showing processes on canvas; hide or disable mutation controls consistently with existing read-only editor behavior.

## Responsive Behavior

Desktop and intermediate widths use the two-panel layout with independent scrolling.

On narrow/mobile widths, the dialog becomes a two-step flow:

1. Process grid.
2. Selected process and swimlane manager.

Selecting a process opens the second step. A **Back to processes** control restores the grid and focus to the previously selected card. **Show on canvas** remains available from the detail step. This prevents a 100-process grid from placing lane management far below the fold.

## Accessibility

- Use modal-dialog semantics with an accessible name and description.
- Move initial focus to search and restore focus to the sidebar Processes button on close.
- Trap focus while the modal is open.
- Escape closes the modal unless a dirty-draft confirmation blocks closure.
- Support `Ctrl/Cmd+K` to focus search while the modal is open.
- Use native buttons and form controls for process cards, menus, sorting, lane actions, Back, and Show on canvas.
- Preserve existing overflow-menu keyboard behavior, including Arrow keys, Home, End, Escape, Tab, and focus restoration.
- Announce search results, selected process, reordered lanes, saved changes, and mobile navigation through polite live regions.
- Maintain 44px targets for primary touch controls and usable spacing for compact icon actions.
- At 200% zoom, names wrap and controls reflow without clipping or horizontal page scrolling.

## Component Architecture

Extract process-management responsibilities from `EditorToolbar` into focused components:

- `ProcessManagerLauncher`: sidebar button, count badge, and active-process summary.
- `ProcessManagerDialog`: modal lifecycle, selected-process state, search, sort, dirty-state coordination, responsive step state, and focus restoration.
- `ProcessGrid`: derives lightweight process summaries and renders filtered/sorted cards.
- `ProcessCard`: complete name, sequence, selection/active state, count, Show on canvas, and existing process actions.
- `ProcessLanePanel`: selected-process heading, process actions, lane list, and empty states.
- Existing `LanePropertiesForm` and `ProcessActionsMenu` remain reusable, with narrowly scoped prop changes only where needed.

The dialog owns ephemeral UI state. Diagram mutations continue through `useDiagramStore`. No manager-only data is persisted in the diagram document.

## Performance

The manager is designed for the existing 100-process document limit:

- Do not render process canvas thumbnails or swimlane previews.
- Derive process summaries with memoized name, sequence, and lane-count data.
- Render lane rows and lane forms only for the selected process.
- Keep search and sort local to the manager; do not alter the document or canvas node arrays.
- Do not invoke routing, fit-view, lane geometry, auto-arrange, or export rendering while filtering or sorting.
- Keep the canvas mounted to avoid teardown/reinitialization costs when the modal opens or closes.

Rendering 100 lightweight cards is acceptable without virtualization. Virtualization is out of scope unless measured browser tests demonstrate that the card grid misses the agreed interaction target on supported devices.

## Testing

### Unit and component tests

- Sidebar launcher shows process count and the complete active-process summary.
- Opening and closing the dialog moves and restores focus correctly.
- Long process names render without ellipsis.
- Search matches case-insensitive names and three-digit display sequences.
- Clear search, no-results state, and live result announcements work.
- Process order, A–Z, and Z–A sorting do not mutate document order.
- Opening selects the active process, with first-process fallback.
- Selecting a card updates only the lane panel; Show on canvas activates, closes, and emits the existing focus event.
- Process creation, rename, move selection, deletion, and selection fallback use existing store behavior.
- Lane add, staged settings, Cancel, Save, reorder, and delete remain undoable and scoped to the selected process.
- Dirty forms confirm before selection changes or dialog closure.
- Read-only mode prevents mutations while preserving navigation.
- A 100-process fixture proves only the selected process's lane controls are rendered.

### Browser and accessibility tests

- Desktop three-column, intermediate two-column, and mobile single-column/two-step layouts.
- Keyboard traversal, overflow menus, `Ctrl/Cmd+K`, Escape, focus trap, and focus restoration.
- Mobile Back returns focus to the selected card.
- 200% zoom and long-name reflow.
- Light and dark themes.
- Axe checks and manual screen-reader announcement checks.
- Existing node creation, canvas selection, process focus, autosave, collaboration, and read-only editor flows remain intact.

### Release verification

- Frontend typecheck.
- Full frontend unit/component suite.
- Production build.
- Focused Edge, WebKit, and mobile browser flows.
- Firefox where the headless compositor is available; report an environment-level pre-page failure explicitly.

## Compatibility and Protected Surfaces

- No diagram-version change.
- No schema or migration change.
- No server, REST endpoint, repository, authentication, or collaboration contract change.
- No export or import behavior change.
- No change to canvas process geometry, UML rendering, routing, or validation rules.
- `BrandLogo`, favicon, `assets/brand`, logo geometry, and header branding remain untouched.

## Out of Scope

- Canvas thumbnails in process cards.
- Swimlane previews inside process cards.
- Drag-and-drop process reordering.
- Persisting the manager's search, sort, selected process, or mobile step.
- Backend search or pagination for processes.
- Changing document process limits or IDs.
- Redesigning unrelated sidebar palette, canvas, properties, validation, export, or workspace interfaces.
