# Process Manager Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor sidebar's expanded process/swimlane stack with a compact launcher and an accessible, searchable two-panel manager that remains usable with 100 processes.

**Architecture:** Extract process management from `EditorToolbar` into focused components under `web/src/components/process-manager/`. A pure view-model module owns display numbering, search, and non-mutating sort; the modal owns ephemeral selection, draft, responsive-step, and focus state; all document mutations continue through existing Zustand commands.

**Tech Stack:** React 19, TypeScript, Zustand, Testing Library/Vitest, Playwright, axe-core, existing FLOX CSS tokens and button primitives.

**Spec:** `docs/superpowers/specs/2026-08-22-process-manager-window-design.md`

## Global Constraints

- Support the existing maximum of 100 processes without canvas thumbnails, lane previews, or backend pagination.
- Show complete process and lane names with wrapping; do not replace readable names with internal stable IDs or ellipses.
- Search matches process names case-insensitively and three-digit display sequences such as `001`.
- Sorting offers document process order, Name A–Z, and Name Z–A, and never mutates `DiagramDocument.processes`.
- The sidebar contains one Processes launcher, total count badge, and active-process summary; Add swimlane and every lane-management control live only in the Processes window.
- Process selection in the manager is independent from the active canvas process until Show on canvas is invoked.
- Preserve existing store commands, undo/redo, autosave, persistence, collaboration, conflicts, validation, and read-only behavior.
- Do not change the diagram schema, document version, server, REST endpoints, exports, imports, canvas rendering, routing, or validation rules.
- Do not modify `BrandLogo`, favicon, `assets/brand`, logo geometry, or header branding.
- Use the existing black-and-white UML and connector defaults without changing their behavior.

---

### Task 1: Process Manager View Model

**Files:**
- Create: `web/src/components/process-manager/process-manager-model.ts`
- Test: `web/src/components/process-manager/process-manager-model.test.ts`

**Interfaces:**
- Consumes: `DiagramProcess[]` from `web/src/domain/diagram.ts`.
- Produces:
  - `ProcessSortOrder = "document" | "name-asc" | "name-desc"`
  - `ProcessSummary { id, name, sequence, laneCount, documentIndex }`
  - `buildProcessSummaries(processes: DiagramProcess[]): ProcessSummary[]`
  - `filterAndSortProcesses(summaries: ProcessSummary[], query: string, order: ProcessSortOrder): ProcessSummary[]`

- [ ] **Step 1: Write the failing view-model tests**

```ts
import { describe, expect, it } from "vitest";
import type { DiagramProcess } from "../../domain/diagram";
import { buildProcessSummaries, filterAndSortProcesses } from "./process-manager-model";

const processes: DiagramProcess[] = [
  { id: "p-z", name: "Zulu approval", position: { x: 0, y: 0 }, lanes: [
    { id: "l1", name: "One", width: 320, colorIndex: 0 },
    { id: "l2", name: "Two", width: 320, colorIndex: 1 },
  ], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 } },
  { id: "p-a", name: "Annual procurement review", position: { x: 0, y: 900 }, lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 } },
];

describe("process manager model", () => {
  it("derives stable display sequence and lane counts without mutating processes", () => {
    const before = structuredClone(processes);
    expect(buildProcessSummaries(processes)).toEqual([
      { id: "p-z", name: "Zulu approval", sequence: "001", laneCount: 2, documentIndex: 0 },
      { id: "p-a", name: "Annual procurement review", sequence: "002", laneCount: 0, documentIndex: 1 },
    ]);
    expect(processes).toEqual(before);
  });

  it("matches case-insensitive names and displayed sequence numbers", () => {
    const summaries = buildProcessSummaries(processes);
    expect(filterAndSortProcesses(summaries, "PROCUREMENT", "document").map((item) => item.id)).toEqual(["p-a"]);
    expect(filterAndSortProcesses(summaries, "001", "document").map((item) => item.id)).toEqual(["p-z"]);
  });

  it("sorts names without changing document order", () => {
    const summaries = buildProcessSummaries(processes);
    expect(filterAndSortProcesses(summaries, "", "name-asc").map((item) => item.id)).toEqual(["p-a", "p-z"]);
    expect(filterAndSortProcesses(summaries, "", "name-desc").map((item) => item.id)).toEqual(["p-z", "p-a"]);
    expect(summaries.map((item) => item.id)).toEqual(["p-z", "p-a"]);
  });
});
```

- [ ] **Step 2: Run the view-model test and verify the red state**

Run: `cd web && npm.cmd test -- src/components/process-manager/process-manager-model.test.ts`

Expected: FAIL because `process-manager-model.ts` does not exist.

- [ ] **Step 3: Implement the pure view model**

```ts
import type { DiagramProcess } from "../../domain/diagram";

export type ProcessSortOrder = "document" | "name-asc" | "name-desc";

export interface ProcessSummary {
  id: string;
  name: string;
  sequence: string;
  laneCount: number;
  documentIndex: number;
}

export function buildProcessSummaries(processes: DiagramProcess[]): ProcessSummary[] {
  return processes.map((process, documentIndex) => ({
    id: process.id,
    name: process.name,
    sequence: String(documentIndex + 1).padStart(3, "0"),
    laneCount: process.lanes.length,
    documentIndex,
  }));
}

export function filterAndSortProcesses(
  summaries: ProcessSummary[],
  query: string,
  order: ProcessSortOrder,
): ProcessSummary[] {
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = normalized
    ? summaries.filter((process) => process.name.toLocaleLowerCase().includes(normalized) || process.sequence.includes(normalized))
    : [...summaries];
  if (order === "document") return filtered.sort((a, b) => a.documentIndex - b.documentIndex);
  const direction = order === "name-asc" ? 1 : -1;
  return filtered.sort((a, b) => direction * a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
}
```

- [ ] **Step 4: Run the view-model test and typecheck**

Run: `cd web && npm.cmd test -- src/components/process-manager/process-manager-model.test.ts && npm.cmd run typecheck`

Expected: all tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the view model**

```powershell
git add web/src/components/process-manager/process-manager-model.ts web/src/components/process-manager/process-manager-model.test.ts
git commit -m "feat: add process manager search model"
```

---

### Task 2: Compact Sidebar Launcher

**Files:**
- Create: `web/src/components/process-manager/ProcessManagerLauncher.tsx`
- Test: `web/src/components/process-manager/ProcessManagerLauncher.test.tsx`
- Modify: `web/src/styles.css` in the editor-sidebar component section near `.lane-manager`

**Interfaces:**
- Consumes: `processes: DiagramProcess[]`, `activeProcessId: string | null`, `collapsed: boolean`, and `onOpen(): void`.
- Produces: `ProcessManagerLauncher` with trigger id `process-manager-trigger` for focus restoration and browser tests.

- [ ] **Step 1: Write failing launcher tests**

```tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiagram } from "../../domain/diagram";
import { ProcessManagerLauncher } from "./ProcessManagerLauncher";

afterEach(cleanup);

describe("process manager launcher", () => {
  it("shows count and the complete active process name", () => {
    const document = createDiagram();
    document.processes[0].name = "Supplier Registration, Compliance Review and Final Authorization";
    render(<ProcessManagerLauncher processes={document.processes} activeProcessId={document.processes[0].id} collapsed={false} onOpen={() => undefined} />);
    expect(screen.getByRole("button", { name: "Open processes (1)" })).toBeVisible();
    expect(screen.getByText(document.processes[0].name)).toBeVisible();
  });

  it("opens from expanded and collapsed sidebars", () => {
    const onOpen = vi.fn();
    const document = createDiagram();
    const { rerender } = render(<ProcessManagerLauncher processes={document.processes} activeProcessId={document.processes[0].id} collapsed={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Open processes (1)" }));
    rerender(<ProcessManagerLauncher processes={document.processes} activeProcessId={document.processes[0].id} collapsed onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Open processes (1)" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the launcher test and verify the red state**

Run: `cd web && npm.cmd test -- src/components/process-manager/ProcessManagerLauncher.test.tsx`

Expected: FAIL because `ProcessManagerLauncher` is not defined.

- [ ] **Step 3: Implement the launcher**

```tsx
import { PanelsTopLeft } from "lucide-react";
import type { DiagramProcess } from "../../domain/diagram";
import { Button } from "../ui/button";

export interface ProcessManagerLauncherProps {
  processes: DiagramProcess[];
  activeProcessId: string | null;
  collapsed: boolean;
  onOpen: () => void;
}

export function ProcessManagerLauncher({ processes, activeProcessId, collapsed, onOpen }: ProcessManagerLauncherProps) {
  const activeName = processes.find((process) => process.id === activeProcessId)?.name ?? "No active process";
  return <section className="process-manager-launcher" aria-label="Process manager">
    <Button id="process-manager-trigger" variant="outline" className="process-manager-launcher__button" aria-label={`Open processes (${processes.length})`} onClick={onOpen}>
      <PanelsTopLeft aria-hidden="true" />
      {!collapsed && <><span>Processes</span><strong aria-label={`${processes.length} processes`}>{processes.length}</strong></>}
    </Button>
    {!collapsed && <p><span>Active process</span><strong>{activeName}</strong></p>}
  </section>;
}
```

Add CSS using existing tokens:

```css
.process-manager-launcher { display: grid; gap: 7px; margin: 0 12px 12px; padding-top: 12px; border-top: 1px solid var(--line-soft); }
.process-manager-launcher__button { width: 100%; justify-content: flex-start; }
.process-manager-launcher__button strong { min-width: 24px; margin-left: auto; padding: 2px 6px; border: 1px solid var(--border); border-radius: 999px; font: 700 9px/14px var(--mono); }
.process-manager-launcher p { display: grid; gap: 2px; margin: 0; min-width: 0; }
.process-manager-launcher p span { color: var(--muted); font: 600 8px/12px var(--mono); letter-spacing: .06em; text-transform: uppercase; }
.process-manager-launcher p strong { overflow-wrap: anywhere; font-size: 10px; line-height: 1.4; }
.editor-sidebar.is-collapsed .process-manager-launcher { margin-inline: 8px; }
.editor-sidebar.is-collapsed .process-manager-launcher__button { justify-content: center; padding-inline: 0; }
```

- [ ] **Step 4: Run launcher tests and typecheck**

Run: `cd web && npm.cmd test -- src/components/process-manager/ProcessManagerLauncher.test.tsx && npm.cmd run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the launcher**

```powershell
git add web/src/components/process-manager/ProcessManagerLauncher.tsx web/src/components/process-manager/ProcessManagerLauncher.test.tsx web/src/styles.css
git commit -m "feat: add compact process manager launcher"
```

---

### Task 3: Process Grid and Process Actions

**Files:**
- Create: `web/src/components/process-manager/ProcessGrid.tsx`
- Test: `web/src/components/process-manager/ProcessGrid.test.tsx`
- Modify: `web/src/components/ProcessActionsMenu.tsx`
- Modify: `web/src/components/ProcessActionsMenu.test.tsx`
- Modify: `web/src/styles.css` in a new process-manager-dialog section

**Interfaces:**
- Consumes: `ProcessSummary[]` from Task 1.
- Produces:

```ts
export interface ProcessGridProps {
  processes: ProcessSummary[];
  selectedProcessId: string | null;
  activeProcessId: string | null;
  readOnly: boolean;
  canMoveSelection: (processId: string) => boolean;
  onSelect: (processId: string) => void;
  onShowOnCanvas: (processId: string) => void;
  onEdit: (processId: string) => void;
  onMoveSelection: (processId: string) => void;
  onDelete: (processId: string) => void;
}
```

- Extends `ProcessActionsMenuProps` with required `onEdit(): void` and renders Process settings as the first menu item.

- [ ] **Step 1: Extend the process-actions test first**

Add `onEdit={onEdit}` to every existing `ProcessActionsMenu` render and add this assertion to the arrow-key test:

```tsx
const onEdit = vi.fn();
render(<ProcessActionsMenu processName="Claims approval" canMoveSelection onEdit={onEdit} onMoveSelection={onMoveSelection} onDelete={() => undefined} />);
fireEvent.click(screen.getByRole("button", { name: "More actions for Claims approval" }));
const settings = screen.getByRole("menuitem", { name: "Process settings" });
await waitFor(() => expect(settings).toHaveFocus());
fireEvent.click(settings);
expect(onEdit).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Write failing ProcessGrid tests**

```tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProcessGrid } from "./ProcessGrid";

afterEach(cleanup);

const processes = [{
  id: "long",
  name: "Supplier Registration, Compliance Review and Final Authorization",
  sequence: "001",
  laneCount: 5,
  documentIndex: 0,
}];

describe("process grid", () => {
  it("renders the complete name and keeps selection separate from Show on canvas", () => {
    const onSelect = vi.fn();
    const onShowOnCanvas = vi.fn();
    render(<ProcessGrid processes={processes} selectedProcessId={null} activeProcessId={null} readOnly={false} canMoveSelection={() => false} onSelect={onSelect} onShowOnCanvas={onShowOnCanvas} onEdit={() => undefined} onMoveSelection={() => undefined} onDelete={() => undefined} />);
    expect(screen.getByText(processes[0].name)).toBeVisible();
    expect(screen.getByText("001")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: `Select ${processes[0].name}` }));
    expect(onSelect).toHaveBeenCalledWith("long");
    expect(onShowOnCanvas).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: `Show ${processes[0].name} on canvas` }));
    expect(onShowOnCanvas).toHaveBeenCalledWith("long");
  });

  it("hides mutation menus in read-only mode", () => {
    render(<ProcessGrid processes={processes} selectedProcessId="long" activeProcessId="long" readOnly canMoveSelection={() => false} onSelect={() => undefined} onShowOnCanvas={() => undefined} onEdit={() => undefined} onMoveSelection={() => undefined} onDelete={() => undefined} />);
    expect(screen.queryByRole("button", { name: /More actions/ })).not.toBeInTheDocument();
    expect(screen.getByText("Active on canvas")).toBeVisible();
  });
});
```

- [ ] **Step 3: Run both tests and verify the red state**

Run: `cd web && npm.cmd test -- src/components/ProcessActionsMenu.test.tsx src/components/process-manager/ProcessGrid.test.tsx`

Expected: FAIL for missing `onEdit` behavior and missing `ProcessGrid`.

- [ ] **Step 4: Add Process settings to the existing menu**

Update its interface and prepend this menu item:

```tsx
import { Ellipsis, MoveRight, Settings2, Trash2 } from "lucide-react";

export interface ProcessActionsMenuProps {
  processName: string;
  canMoveSelection: boolean;
  onEdit: () => void;
  onMoveSelection: () => void;
  onDelete: () => void;
}

<Button variant="ghost" role="menuitem" tabIndex={-1} onClick={() => { closeAndRestoreFocus(); onEdit(); }}>
  <Settings2 aria-hidden="true" /> Process settings
</Button>
```

Keep the existing Move selection and Delete items and keyboard logic unchanged.

- [ ] **Step 5: Implement ProcessGrid**

Use an article per card, a dedicated selection button, and sibling action buttons so interactive elements are never nested:

```tsx
import { Crosshair } from "lucide-react";
import { ProcessActionsMenu } from "../ProcessActionsMenu";
import { Button } from "../ui/button";
import type { ProcessSummary } from "./process-manager-model";

export function ProcessGrid(props: ProcessGridProps) {
  if (!props.processes.length) return <div className="process-manager-empty"><strong>No matching processes</strong><span>Clear the search to show every process.</span></div>;
  return <div className="process-manager-grid" role="list" aria-label="Processes">
    {props.processes.map((process) => {
      const selected = process.id === props.selectedProcessId;
      const active = process.id === props.activeProcessId;
      return <article id={`process-card-${process.id}`} className={`process-manager-card${selected ? " is-selected" : ""}${active ? " is-active" : ""}`} role="listitem" aria-label={`Process ${process.sequence}: ${process.name}`} key={process.id}>
        <button type="button" className="process-manager-card__select" aria-label={`Select ${process.name}`} aria-pressed={selected} onClick={() => props.onSelect(process.id)}>
          <span className="process-manager-card__sequence">{process.sequence}</span>
          <strong>{process.name}</strong>
          <span>{process.laneCount} {process.laneCount === 1 ? "swimlane" : "swimlanes"}</span>
          {active && <small>Active on canvas</small>}
        </button>
        <div className="process-manager-card__actions">
          <Button variant="ghost" size="sm" aria-label={`Show ${process.name} on canvas`} onClick={() => props.onShowOnCanvas(process.id)}><Crosshair aria-hidden="true" /> Show on canvas</Button>
          {!props.readOnly && <ProcessActionsMenu processName={process.name} canMoveSelection={props.canMoveSelection(process.id)} onEdit={() => props.onEdit(process.id)} onMoveSelection={() => props.onMoveSelection(process.id)} onDelete={() => props.onDelete(process.id)} />}
        </div>
      </article>;
    })}
  </div>;
}
```

- [ ] **Step 6: Add grid/card styling**

```css
.process-manager-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; align-content: start; }
.process-manager-card { display: grid; min-width: 0; min-height: 128px; grid-template-rows: 1fr auto; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); overflow: hidden; }
.process-manager-card.is-selected { border-color: var(--primary); box-shadow: inset 3px 0 var(--primary); }
.process-manager-card__select { display: grid; min-width: 0; gap: 5px; padding: 12px; border: 0; background: transparent; color: var(--foreground); cursor: pointer; text-align: left; }
.process-manager-card__select strong { overflow-wrap: anywhere; font-size: 11px; line-height: 1.4; }
.process-manager-card__select > span:last-of-type, .process-manager-card__select small { color: var(--muted); font-size: 9px; }
.process-manager-card__sequence { width: max-content; padding: 2px 6px; border-radius: 4px; background: color-mix(in srgb,var(--primary) 14%,var(--surface)); color: var(--primary); font: 700 9px/14px var(--mono); }
.process-manager-card__actions { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 4px; padding: 6px 7px; border-top: 1px solid var(--line-soft); }
```

- [ ] **Step 7: Run focused tests and typecheck**

Run: `cd web && npm.cmd test -- src/components/ProcessActionsMenu.test.tsx src/components/process-manager/ProcessGrid.test.tsx && npm.cmd run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit the grid and process actions**

```powershell
git add web/src/components/ProcessActionsMenu.tsx web/src/components/ProcessActionsMenu.test.tsx web/src/components/process-manager/ProcessGrid.tsx web/src/components/process-manager/ProcessGrid.test.tsx web/src/styles.css
git commit -m "feat: add readable process selection grid"
```

---

### Task 4: Selected-Process Swimlane Panel

**Files:**
- Create: `web/src/components/process-manager/ProcessLanePanel.tsx`
- Test: `web/src/components/process-manager/ProcessLanePanel.test.tsx`
- Modify: `web/src/styles.css` in the process-manager-dialog section

**Interfaces:**
- Consumes:

```ts
export interface ProcessLanePanelProps {
  process: DiagramProcess | null;
  sequence: string | null;
  readOnly: boolean;
  editRequestId: string | null;
  onConsumeEditRequest: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onAnnouncement: (message: string) => void;
}
```

- Uses existing store methods `updateProcess`, `addLane`, `removeLane`, `moveLane`, and `updateLaneSettings`.
- Reuses `LanePropertiesForm` and reports whether its local process or lane editor is dirty.

- [ ] **Step 1: Write the failing lane-panel tests**

```tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDiagram } from "../../domain/diagram";
import { useDiagramStore } from "../../store/diagram-store";
import { ProcessLanePanel } from "./ProcessLanePanel";

describe("selected process lane panel", () => {
  beforeEach(() => {
    const document = createDiagram("Long process name for procurement approval");
    document.processes[0].lanes = [{ id: "lane", name: "Factory Supervisory and Production Control", width: 320, colorIndex: 0 }];
    useDiagramStore.setState({ document, activeProcessId: document.processes[0].id, past: [], future: [] });
  });
  afterEach(cleanup);

  it("renders only the selected process lanes and stages lane changes", () => {
    const process = useDiagramStore.getState().document.processes[0];
    const onDirtyChange = vi.fn();
    render(<ProcessLanePanel process={process} sequence="001" readOnly={false} editRequestId={null} onConsumeEditRequest={() => undefined} onDirtyChange={onDirtyChange} onAnnouncement={() => undefined} />);
    expect(screen.getByText(process.name)).toBeVisible();
    expect(screen.getByText(process.lanes[0].name)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: `Lane settings for ${process.lanes[0].name}` }));
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Production Control" } });
    expect(useDiagramStore.getState().document.processes[0].lanes[0].name).toBe(process.lanes[0].name);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(useDiagramStore.getState().document.processes[0].lanes[0].name).toBe("Production Control");
  });

  it("allows browsing but hides mutations in read-only mode", () => {
    const process = useDiagramStore.getState().document.processes[0];
    render(<ProcessLanePanel process={process} sequence="001" readOnly editRequestId={null} onConsumeEditRequest={() => undefined} onDirtyChange={() => undefined} onAnnouncement={() => undefined} />);
    expect(screen.getByText(process.lanes[0].name)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add swimlane" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lane settings/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the lane-panel test and verify the red state**

Run: `cd web && npm.cmd test -- src/components/process-manager/ProcessLanePanel.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the lane-panel state machine**

Use local state with these exact meanings:

```ts
const [openLaneId, setOpenLaneId] = useState<string | null>(null);
const [laneDirty, setLaneDirty] = useState(false);
const [processEditorOpen, setProcessEditorOpen] = useState(false);
const [processDraftName, setProcessDraftName] = useState(process?.name ?? "");
const processDirty = Boolean(process && processEditorOpen && processDraftName !== process.name);
const dirty = laneDirty || processDirty;
useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
useEffect(() => {
  setOpenLaneId(null);
  setLaneDirty(false);
  setProcessEditorOpen(false);
  setProcessDraftName(process?.name ?? "");
}, [process?.id, process?.name]);
useEffect(() => {
  if (process && editRequestId === process.id) {
    setProcessEditorOpen(true);
    setProcessDraftName(process.name);
    onConsumeEditRequest();
  }
}, [editRequestId, onConsumeEditRequest, process]);
```

Render:

- An empty instruction when `process === null`.
- Sequence, full name, and lane count.
- Process settings and Add swimlane only when editable.
- A staged process-name form using `updateProcess(process.id, { name: processDraftName })`.
- Lane rows with complete names, width/height summary, move-left, move-right, settings, and delete controls.
- `LanePropertiesForm` only for `openLaneId`.
- `updateLaneSettings`, `moveLane`, `removeLane`, and announcements using the same messages currently emitted by `EditorToolbar`.

Use `ArrowUp` for Move left and `ArrowDown` for Move right to preserve the current compact icon vocabulary, but keep the accessible labels `Move [name] swimlane left/right`.

- [ ] **Step 4: Add lane-panel styling**

```css
.process-lane-panel { display: grid; min-width: 0; grid-template-rows: auto auto minmax(0,1fr); background: var(--surface); }
.process-lane-panel__header { padding: 16px; border-bottom: 1px solid var(--line-soft); }
.process-lane-panel__header span { color: var(--primary); font: 700 8px/12px var(--mono); letter-spacing: .07em; text-transform: uppercase; }
.process-lane-panel__header h3 { margin: 5px 0 3px; overflow-wrap: anywhere; font-size: 13px; line-height: 1.4; }
.process-lane-panel__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 10px 16px; border-bottom: 1px solid var(--line-soft); }
.process-lane-panel__list { min-height: 0; overflow: auto; padding: 6px 16px 16px; }
.process-lane-row { display: grid; min-width: 0; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--line-soft); }
.process-lane-row__name { overflow-wrap: anywhere; font-size: 10px; font-weight: 650; }
.process-lane-row__name small { display: block; margin-top: 3px; color: var(--muted); font-weight: 400; }
.process-lane-row__actions { display: flex; gap: 3px; }
```

- [ ] **Step 5: Run focused tests and typecheck**

Run: `cd web && npm.cmd test -- src/components/LanePropertiesForm.test.tsx src/components/process-manager/ProcessLanePanel.test.tsx && npm.cmd run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the swimlane panel**

```powershell
git add web/src/components/process-manager/ProcessLanePanel.tsx web/src/components/process-manager/ProcessLanePanel.test.tsx web/src/styles.css
git commit -m "feat: add selected process swimlane panel"
```

---

### Task 5: Accessible Process Manager Dialog

**Files:**
- Create: `web/src/components/process-manager/ProcessManagerDialog.tsx`
- Test: `web/src/components/process-manager/ProcessManagerDialog.test.tsx`
- Modify: `web/src/hooks/use-dialog-focus.ts`
- Modify: `web/src/hooks/use-dialog-focus.test.tsx`
- Modify: `web/src/styles.css` in the process-manager-dialog section

**Interfaces:**
- Consumes: `readOnly: boolean` and `onClose(): void`.
- Produces: `ProcessManagerDialog`, rendered through `createPortal`, with accessible name `Processes`.
- Extends `useDialogFocus` to `useDialogFocus(containerRef, onClose, initialFocusRef?)`, leaving existing two-argument calls valid.

- [ ] **Step 1: Write the failing initial-focus hook test**

Add a harness with a close button before a search input:

```tsx
function FocusHarness() {
  const dialogRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useDialogFocus(dialogRef, () => undefined, searchRef);
  return <section ref={dialogRef}><button type="button">Close</button><input ref={searchRef} aria-label="Find a process" /></section>;
}

it("honors an explicit initial focus target", async () => {
  render(<FocusHarness />);
  await waitFor(() => expect(screen.getByLabelText("Find a process")).toHaveFocus());
});
```

- [ ] **Step 2: Write failing dialog tests**

Create a 100-process fixture from `createDiagram()` and cover:

```tsx
it("filters 100 lightweight cards while rendering lanes only for the selected process", async () => {
  render(<ProcessManagerDialog readOnly={false} onClose={() => undefined} />);
  expect(screen.getAllByRole("listitem", { name: /^Process \d{3}:/ })).toHaveLength(100);
  expect(screen.getAllByRole("button", { name: /Lane settings for/ })).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Find a process"), { target: { value: "Process 099" } });
  expect(screen.getByRole("button", { name: "Select Process 099" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Select Process 001" })).not.toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Process results" })).toHaveTextContent("Showing 1 process");
});

it("keeps manager selection separate until Show on canvas", () => {
  render(<ProcessManagerDialog readOnly={false} onClose={onClose} />);
  fireEvent.click(screen.getByRole("button", { name: "Select Process 002" }));
  expect(useDiagramStore.getState().activeProcessId).toBe("process-001");
  fireEvent.click(screen.getByRole("button", { name: "Show Process 002 on canvas" }));
  expect(useDiagramStore.getState().activeProcessId).toBe("process-002");
  expect(onClose).toHaveBeenCalledOnce();
});

it("confirms before changing process with a dirty lane draft", () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<ProcessManagerDialog readOnly={false} onClose={() => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: /Lane settings for/ }).first());
  fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Unsaved" } });
  fireEvent.click(screen.getByRole("button", { name: "Select Process 002" }));
  expect(screen.getByText("Process 001")).toBeVisible();
  expect(window.confirm).toHaveBeenCalledWith("Discard unsaved process or swimlane changes?");
});
```

- [ ] **Step 3: Run the hook and dialog tests to verify the red state**

Run: `cd web && npm.cmd test -- src/hooks/use-dialog-focus.test.tsx src/components/process-manager/ProcessManagerDialog.test.tsx`

Expected: FAIL for the missing overload and missing dialog.

- [ ] **Step 4: Extend the focus hook without breaking existing dialogs**

```diff
- export function useDialogFocus(containerRef: RefObject<HTMLElement | null>, onClose: () => void) {
+ export function useDialogFocus(containerRef: RefObject<HTMLElement | null>, onClose: () => void, initialFocusRef?: RefObject<HTMLElement | null>) {
```

Inside the existing animation-frame callback, replace `dialog.querySelector<HTMLElement>(FOCUSABLE)` with `initialFocusRef?.current ?? dialog.querySelector<HTMLElement>(FOCUSABLE)`. Retain the existing `onCloseRef`, Escape handling, Tab trap, animation-frame cancellation, previous-focus restoration, and closing brace verbatim.

- [ ] **Step 5: Implement dialog orchestration**

Use these state values:

```ts
const document = useDiagramStore((state) => state.document);
const activeProcessId = useDiagramStore((state) => state.activeProcessId);
const [selectedProcessId, setSelectedProcessId] = useState(() => activeProcessId ?? document.processes[0]?.id ?? null);
const [query, setQuery] = useState("");
const [sortOrder, setSortOrder] = useState<ProcessSortOrder>("document");
const [lanePanelDirty, setLanePanelDirty] = useState(false);
const [addProcessOpen, setAddProcessOpen] = useState(false);
const [processName, setProcessName] = useState("");
const [editRequestId, setEditRequestId] = useState<string | null>(null);
const [mobileStep, setMobileStep] = useState<"grid" | "lanes">("grid");
const [announcement, setAnnouncement] = useState("");
const dialogRef = useRef<HTMLElement>(null);
const searchRef = useRef<HTMLInputElement>(null);
```

Derive summaries and selected process with `useMemo`. Implement one confirmation function:

```ts
function confirmDrafts(): boolean {
  const addDirty = addProcessOpen && processName.trim().length > 0;
  if ((lanePanelDirty || addDirty) && !window.confirm("Discard unsaved process or swimlane changes?")) return false;
  setLanePanelDirty(false);
  setAddProcessOpen(false);
  setProcessName("");
  return true;
}
```

Use it before selecting, closing, showing on canvas, deleting, or opening a different editor. Implement Show on canvas exactly as:

```ts
function showOnCanvas(processId: string) {
  if (!confirmDrafts()) return;
  setActiveProcess(processId);
  onClose();
  window.setTimeout(() => window.dispatchEvent(new CustomEvent("flox:focus-process", { detail: processId })), 0);
}
```

Implement `Ctrl/Cmd+K` only while mounted:

```ts
useEffect(() => {
  function focusSearch(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
      event.preventDefault();
      searchRef.current?.focus();
    }
  }
  window.addEventListener("keydown", focusSearch);
  return () => window.removeEventListener("keydown", focusSearch);
}, []);
```

Render through `createPortal` with:

- `.process-manager-backdrop` and `.process-manager-dialog`.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="process-manager-title"`.
- Header count, Add process, Close.
- The approved labelled search and order controls.
- Clear search button only when `query` is non-empty.
- `ProcessGrid` in the left region.
- `ProcessLanePanel` keyed by selected process id in the right region.
- `data-mobile-step={mobileStep}` and Back to processes.
- Polite result and manager-action status regions.
- Read-only mutation hiding.
- Empty states from the spec.

When deletion succeeds, compute the next selected ID from the pre-delete document order, then read the current store document to verify deletion before applying the fallback. When search filters the selected process out, retain the right panel and render `Selected process is outside the current results.`

- [ ] **Step 6: Add dialog shell and toolbar CSS**

```css
.process-manager-backdrop { position: fixed; inset: 0; z-index: 110; display: grid; place-items: center; padding: 20px; background: var(--backdrop); backdrop-filter: blur(3px); }
.process-manager-dialog { display: grid; width: min(1320px,calc(100vw - 40px)); height: min(820px,calc(100vh - 40px)); grid-template-rows: auto minmax(0,1fr); overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow-dialog); }
.process-manager-dialog > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--line-soft); }
.process-manager-dialog__body { display: grid; min-height: 0; grid-template-columns: minmax(0,64fr) minmax(320px,36fr); }
.process-manager-dialog__browse { display: grid; min-width: 0; min-height: 0; grid-template-rows: auto minmax(0,1fr); border-right: 1px solid var(--border); }
.process-manager-toolbar { display: grid; grid-template-columns: minmax(200px,1fr) minmax(205px,auto); align-items: end; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--line-soft); }
.process-manager-field { display: grid; gap: 6px; color: var(--muted); font: 700 8px/12px var(--mono); letter-spacing: .06em; text-transform: uppercase; }
.process-manager-field__control { display: flex; min-height: 44px; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--background); color: var(--foreground); }
.process-manager-field__control:focus-within { border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in srgb,var(--ring) 16%,transparent); }
.process-manager-field__control input, .process-manager-field__control select { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: inherit; font-size: 11px; }
.process-manager-dialog__grid-scroll { min-height: 0; overflow: auto; padding: 14px; }
```

- [ ] **Step 7: Run dialog, hook, component, and type checks**

Run: `cd web && npm.cmd test -- src/hooks/use-dialog-focus.test.tsx src/components/process-manager/process-manager-model.test.ts src/components/process-manager/ProcessGrid.test.tsx src/components/process-manager/ProcessLanePanel.test.tsx src/components/process-manager/ProcessManagerDialog.test.tsx && npm.cmd run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit the dialog**

```powershell
git add web/src/components/process-manager/ProcessManagerDialog.tsx web/src/components/process-manager/ProcessManagerDialog.test.tsx web/src/hooks/use-dialog-focus.ts web/src/hooks/use-dialog-focus.test.tsx web/src/styles.css
git commit -m "feat: add accessible process manager dialog"
```

---

### Task 6: Replace the Sidebar Stack and Add Responsive Behavior

**Files:**
- Modify: `web/src/components/EditorToolbar.tsx`
- Modify: `web/src/components/EditorToolbar.test.tsx`
- Modify: `web/src/styles.css` process-manager and responsive sections

**Interfaces:**
- Consumes: `ProcessManagerLauncher` and `ProcessManagerDialog` from Tasks 2 and 5.
- Produces: one `processManagerOpen` boolean in `EditorToolbar`; no process/lane draft state remains in the toolbar.

- [ ] **Step 1: Rewrite the toolbar tests before production integration**

Replace assertions for inline process regions and lane lists with:

```tsx
it("replaces the process stack with a compact launcher", () => {
  renderToolbar();
  expect(screen.getByRole("button", { name: "Open processes (2)" })).toBeVisible();
  expect(screen.getByText("Order approval")).toBeVisible();
  expect(screen.queryByRole("region", { name: "Fulfillment" })).not.toBeInTheDocument();
  expect(screen.queryByTitle("Add Swimlane")).not.toBeInTheDocument();
});

it("opens the manager and restores focus when it closes", async () => {
  renderToolbar();
  const trigger = screen.getByRole("button", { name: "Open processes (2)" });
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "Processes" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Close processes" }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("allows read-only users to open and browse the manager", () => {
  render(<EditorToolbar collapsed={false} onCollapsedChange={() => undefined} readOnly />);
  fireEvent.click(screen.getByRole("button", { name: "Open processes (2)" }));
  expect(screen.getByRole("dialog", { name: "Processes" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Add process" })).not.toBeInTheDocument();
});
```

Move process/lane mutation assertions into `ProcessManagerDialog.test.tsx` and `ProcessLanePanel.test.tsx`; do not duplicate them in the toolbar test.

- [ ] **Step 2: Run the toolbar test and verify the red state**

Run: `cd web && npm.cmd test -- src/components/EditorToolbar.test.tsx`

Expected: FAIL because the expanded manager and Add Swimlane still exist.

- [ ] **Step 3: Integrate the launcher and dialog**

In `EditorToolbar`:

- Remove `ArrowDown`, `ArrowUp`, `Columns3`, `Crosshair`, and `Trash2` imports when no longer used.
- Remove `LanePropertiesForm` and `ProcessActionsMenu` imports.
- Remove `addProcess`, `updateProcess`, `removeProcess`, `moveSelectedToProcess`, lane mutation selectors, and every local process/lane draft state and helper.
- Remove the Structure palette group containing Add Swimlane.
- Add `const [processManagerOpen, setProcessManagerOpen] = useState(false);`.
- Render:

```tsx
<ProcessManagerLauncher processes={document.processes} activeProcessId={activeProcessId} collapsed={collapsed} onOpen={() => setProcessManagerOpen(true)} />
{processManagerOpen && <ProcessManagerDialog readOnly={readOnly} onClose={() => setProcessManagerOpen(false)} />}
```

Render the launcher outside any `inert={readOnly}` container so viewers can browse it. Keep the UML node palette inert in read-only mode.

- [ ] **Step 4: Remove obsolete sidebar-manager CSS and add responsive manager rules**

Delete obsolete selectors for `.lane-manager`, `.process-entry`, `.process-row`, `.process-row__actions`, `.process-lanes`, and inline `.lane-entry` management only after confirming no remaining component references them with `rg`.

Add:

```css
@media (max-width: 980px) {
  .process-manager-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .process-manager-dialog__body { grid-template-columns: minmax(0,58fr) minmax(300px,42fr); }
}

@media (max-width: 760px) {
  .process-manager-backdrop { padding: 8px; }
  .process-manager-dialog { width: calc(100vw - 16px); height: calc(100dvh - 16px); }
  .process-manager-dialog__body { display: block; position: relative; }
  .process-manager-toolbar { grid-template-columns: 1fr; }
  .process-manager-grid { grid-template-columns: 1fr; }
  .process-manager-dialog[data-mobile-step="grid"] .process-lane-panel { display: none; }
  .process-manager-dialog[data-mobile-step="lanes"] .process-manager-dialog__browse { display: none; }
  .process-manager-mobile-back { display: inline-flex; }
}

@media (min-width: 761px) {
  .process-manager-mobile-back { display: none; }
}
```

- [ ] **Step 5: Run toolbar and all process-manager tests**

Run: `cd web && npm.cmd test -- src/components/EditorToolbar.test.tsx src/components/ProcessActionsMenu.test.tsx src/components/LanePropertiesForm.test.tsx src/components/process-manager && npm.cmd run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the sidebar integration**

```powershell
git add web/src/components/EditorToolbar.tsx web/src/components/EditorToolbar.test.tsx web/src/styles.css
git commit -m "feat: move process management out of sidebar"
```

---

### Task 7: Browser, Accessibility, Performance, and Visual Coverage

**Files:**
- Create: `web/e2e/process-manager-fixture.ts`
- Modify: `web/e2e/editor.spec.ts`
- Modify: `web/e2e/accessibility.spec.ts`
- Modify: `web/e2e/visual.spec.ts`
- Create/update snapshots under: `web/e2e/visual.spec.ts-snapshots/`

**Interfaces:**
- Consumes: accessible names and stable classes introduced in Tasks 2–6.
- Produces: browser evidence for 100-process navigation, long names, lane management, mobile two-step behavior, focus, zoom, read-only browsing, axe, and light/dark visuals.

- [ ] **Step 1: Add reusable process-manager browser fixtures**

Create `web/e2e/process-manager-fixture.ts`:

```ts
import type { Page } from "@playwright/test";
import { createDiagram, parseDiagram, type DiagramDocument } from "../src/domain/diagram";

export function processManagerFixture(): DiagramDocument {
  const document = createDiagram("Process manager scale");
  document.processes = Array.from({ length: 100 }, (_, index) => {
    const sequence = String(index + 1).padStart(3, "0");
    const processId = `process-${sequence}`;
    return {
      id: processId,
      name: index === 98 ? "Supplier Registration, Compliance Review and Final Authorization" : `Process ${sequence}`,
      position: { x: 0, y: index * 920 },
      lanes: Array.from({ length: 3 }, (__, laneIndex) => ({ id: `${processId}-lane-${laneIndex + 1}`, name: `Lane ${laneIndex + 1}`, width: 320, colorIndex: laneIndex })),
      nodes: [],
      edges: [],
      swimlaneLayout: { heightMode: "automatic" as const, height: 760 },
    };
  });
  return parseDiagram(document);
}

export async function importProcessManagerFixture(page: Page): Promise<void> {
  const document = processManagerFixture();
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByLabel("Import diagram JSON").setInputFiles({
    name: "process-manager-scale.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(document)),
  });
  await page.getByText("Diagram imported", { exact: true }).waitFor();
}

export async function openReadOnlyProcessManagerFixture(page: Page): Promise<void> {
  const document = processManagerFixture();
  await page.goto("/projects");
  await page.evaluate(async ({ document }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("activity-studio", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("projects")) request.result.createObjectStore("projects", { keyPath: "id" });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("projects", "readwrite");
        transaction.objectStore("projects").put({
          id: "process-manager-viewer",
          title: document.metadata.title,
          document,
          createdAt: document.metadata.createdAt,
          updatedAt: document.metadata.updatedAt,
          accessRole: "viewer",
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
    });
  }, { document });
  await page.goto("/projects/process-manager-viewer/editor");
  await page.locator(".react-flow").waitFor();
}
```

Export `processManagerFixture`, `importProcessManagerFixture`, and `openReadOnlyProcessManagerFixture`.

- [ ] **Step 2: Add the desktop manager browser test**

Cover this exact flow:

```ts
test("manages and focuses one of 100 processes from the process window", async ({ page }) => {
  await importProcessManagerFixture(page);
  await page.getByRole("button", { name: "Open processes (100)" }).click();
  const dialog = page.getByRole("dialog", { name: "Processes" });
  await expect(dialog.getByLabel("Find a process")).toBeFocused();
  await dialog.getByLabel("Find a process").fill("Supplier Registration");
  await expect(dialog.getByText("Supplier Registration, Compliance Review and Final Authorization")).toBeVisible();
  await dialog.getByRole("button", { name: /Select Supplier Registration/ }).click();
  await expect(dialog.getByRole("button", { name: /Lane settings for/ })).toHaveCount(3);
  await dialog.getByRole("button", { name: /Lane settings for Lane 1/ }).click();
  await dialog.getByLabel("Label").fill("Procurement Officer");
  await dialog.getByRole("button", { name: "Save" }).click();
  await dialog.getByRole("button", { name: /Show Supplier Registration/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".process-title-node")).toContainText("Supplier Registration, Compliance Review and Final Authorization");
});
```

- [ ] **Step 3: Add mobile and read-only browser coverage**

Add one test that runs on `mobile-edge`: call `importProcessManagerFixture(page)`, select Process 002, assert the grid is hidden and Back to processes is visible, click Back, and assert `Select Process 002` regains focus.

Add one Edge test using `openReadOnlyProcessManagerFixture(page)`. Open Processes and assert search, Arrange results, Select Process 002, and Show Process 002 on canvas remain available while Add process, Process settings, Add swimlane, lane settings, reorder, and delete controls are absent.

- [ ] **Step 4: Add accessibility checks**

In `accessibility.spec.ts`:

```ts
test("process manager dialog remains accessible at scale and zoom", async ({ page }) => {
  await importProcessManagerFixture(page);
  const trigger = page.getByRole("button", { name: "Open processes (100)" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Processes" });
  let results = await new AxeBuilder({ page }).include(".process-manager-dialog").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
```

Also assert `Control+k` focuses search and Escape is blocked when a dirty form's confirmation is dismissed.

- [ ] **Step 5: Replace the obsolete sidebar visual test**

Replace `process and swimlane manager hierarchy` with an Edge-only process-manager dialog test that imports a long-name multi-process fixture, opens the dialog, selects the long process, switches to dark mode before opening, and captures:

```ts
await expect(page.getByRole("dialog", { name: "Processes" })).toHaveScreenshot("process-manager-dark.png");
```

Add a mobile screenshot of the lane-detail step named `process-manager-mobile-lanes.png`.

- [ ] **Step 6: Run focused browser tests and update snapshots**

Run:

```powershell
cd web
npm.cmd run build
npx playwright test --project=edge --project=mobile-edge --grep "process manager"
npx playwright test e2e/visual.spec.ts --project=edge --update-snapshots --grep "process manager"
```

Expected: desktop, mobile, accessibility, and visual process-manager tests PASS; only the two intended process-manager snapshots change.

- [ ] **Step 7: Commit browser and visual coverage**

```powershell
git add web/e2e/process-manager-fixture.ts web/e2e/editor.spec.ts web/e2e/accessibility.spec.ts web/e2e/visual.spec.ts web/e2e/visual.spec.ts-snapshots
git commit -m "test: cover scalable process manager flows"
```

---

### Task 8: Full Verification, Review, and Post-Approval Cleanup

**Files:**
- Review all files changed by Tasks 1–7.
- Modify only touched React/TypeScript/CSS/test files when review finds a specific defect.

**Interfaces:**
- Consumes: complete implementation and tests from Tasks 1–7.
- Produces: fresh verification evidence and a clean, review-approved change set.

- [ ] **Step 1: Run the full frontend unit and component suite**

Run: `cd web && npm.cmd test`

Expected: every Vitest file passes with no unhandled errors or act warnings.

- [ ] **Step 2: Run typecheck and production build**

Run: `cd web && npm.cmd run typecheck && npm.cmd run build`

Expected: both commands exit 0; Vite reports a successful production build.

- [ ] **Step 3: Run the supported multi-browser suite**

Run: `cd web && npm.cmd run test:e2e`

Expected: Edge, WebKit, and mobile-edge pass.

- [ ] **Step 4: Run Firefox separately**

Run: `cd web && npm.cmd run test:e2e:firefox`

Expected: Firefox passes. If its headless compositor fails before a page loads, preserve the exact environment error in the final report and do not describe it as an application failure.

- [ ] **Step 5: Request code review against the specification**

Use `superpowers:requesting-code-review` with:

- Spec: `docs/superpowers/specs/2026-08-22-process-manager-window-design.md`
- Plan: `docs/superpowers/plans/2026-08-22-process-manager-window.md`
- Base commit: the commit immediately before Task 1.
- Head commit: the current implementation commit.

Expected: reviewers explicitly check spec coverage, dirty-state behavior, selected-versus-active semantics, read-only behavior, 100-process rendering, mobile navigation, accessibility, and protected brand/backend surfaces.

- [ ] **Step 6: Address approved review findings with test-first fixes**

For each accepted finding, add or adjust the narrowest failing test, run it to confirm failure, implement the fix, and rerun the focused test. Commit accepted fixes together only when they share one root cause; otherwise use one commit per finding.

- [ ] **Step 7: Run post-review code hygiene cleanup**

After review approval, use `specs-code-cleanup` on touched React, TypeScript, CSS, and test files. Remove debug output, obsolete inline-manager code, unused imports, stale selectors, and duplicated confirmation/summary logic without changing behavior.

Verify cleanup with:

```powershell
rg -n "console\.(log|debug)|debugger|process-entry|lane-manager" web/src/components web/src/styles.css
cd web
npm.cmd run typecheck
npm.cmd test
```

Expected: no debug artifacts or obsolete inline-manager selectors; typecheck and all tests pass.

- [ ] **Step 8: Commit cleanup only if it changes files**

```powershell
git add web/src/components web/src/hooks web/src/styles.css web/e2e
git commit -m "chore: clean up process manager implementation"
```

- [ ] **Step 9: Re-run release verification after cleanup**

Run:

```powershell
cd web
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Expected: all supported release checks pass from the final tree.
