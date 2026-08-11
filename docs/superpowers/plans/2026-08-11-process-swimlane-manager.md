# Process and Swimlane Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clearer, keyboard-accessible process and swimlane manager without changing backend, persistence, diagram schema, or store-command behavior.

**Architecture:** Keep `EditorToolbar` as the store-aware integration boundary and extract one store-agnostic `ProcessActionsMenu` for its focus and dismissal behavior. Reuse existing Zustand commands for all diagram mutations, keep reorder feedback in local UI state, and implement hierarchy through semantic markup and existing design tokens.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Zustand 5, Lucide React, Testing Library, Vitest, Playwright, axe-core, CSS design tokens.

## Global Constraints

- Modify frontend files only under `web/` plus this implementation plan.
- Do not modify `server/`, HTTP APIs, persistence adapters, diagram schemas, or store-command semantics.
- Preserve the existing unsaved-draft guards, read-only behavior, inline editors, and focus return.
- Use existing semantic color, spacing, radius, focus, and motion tokens; do not add a second palette.
- Process actions use the exact visible copy `Process settings`, `Add lane`, and `Show on canvas`.
- Lane actions use the exact visible copy `Lane settings` and contextual accessible names.
- Overflow actions use `Move selection to this process` and `Delete process`.
- Icon targets are at least 44 by 44 CSS pixels and remain usable at 200% zoom without horizontal page scrolling.
- Every production behavior is introduced by a failing test and verified green before refactoring.

---

### Task 1: Accessible Process Action Menu

**Files:**
- Create: `web/src/components/ProcessActionsMenu.tsx`
- Create: `web/src/components/ProcessActionsMenu.test.tsx`

**Interfaces:**
- Consumes: `processName: string`, `canMoveSelection: boolean`, `onMoveSelection: () => void`, and `onDelete: () => void`.
- Produces: `ProcessActionsMenu(props: ProcessActionsMenuProps)` with contextual trigger naming, menu roles, disabled move state, Escape/outside dismissal, arrow-key navigation, and focus restoration.

- [ ] **Step 1: Write the failing interaction tests**

```tsx
// @vitest-environment jsdom
render(<ProcessActionsMenu processName="Claims approval" canMoveSelection={false} onMoveSelection={onMove} onDelete={onDelete} />);
const trigger = screen.getByRole("button", { name: "More actions for Claims approval" });
fireEvent.click(trigger);
expect(screen.getByRole("menuitem", { name: "Move selection to this process" })).toBeDisabled();
expect(screen.getByRole("menuitem", { name: "Delete process" })).toBeEnabled();
fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
expect(trigger).toHaveFocus();
```

Add a second test with `canMoveSelection={true}` that proves ArrowDown moves focus between enabled items and clicking Move calls `onMoveSelection` once and closes the menu.

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- ProcessActionsMenu.test.tsx` from `web/`.

Expected: FAIL because `ProcessActionsMenu.tsx` does not exist.

- [ ] **Step 3: Implement the minimal store-agnostic menu**

```tsx
export interface ProcessActionsMenuProps {
  processName: string;
  canMoveSelection: boolean;
  onMoveSelection: () => void;
  onDelete: () => void;
}

export function ProcessActionsMenu(props: ProcessActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Focus the first enabled item on open; dismiss on Escape or outside pointerdown;
  // ArrowUp, ArrowDown, Home, and End move among enabled [role="menuitem"] controls.
  return <div className="process-actions-menu">{/* contextual trigger and two menu items */}</div>;
}
```

Use native `Button` controls. The trigger exposes `aria-haspopup="menu"`, `aria-expanded`, and `aria-controls`. The menu uses `role="menu"`; actions use `role="menuitem"`; delete uses `process-actions-menu__delete`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- ProcessActionsMenu.test.tsx` from `web/`.

Expected: both tests PASS with no React act warnings.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- web/src/components/ProcessActionsMenu.tsx web/src/components/ProcessActionsMenu.test.tsx
git commit -m "feat: add accessible process actions menu"
```

### Task 2: Integrate the Hierarchical Manager and Feedback

**Files:**
- Create: `web/src/components/EditorToolbar.test.tsx`
- Modify: `web/src/components/EditorToolbar.tsx`

**Interfaces:**
- Consumes: `ProcessActionsMenu` from Task 1 and existing store fields `document`, `activeProcessId`, `selectedNodeIds` plus existing commands.
- Produces: contextual process/lane labels, visible lane counts, selection-aware move eligibility, and polite lane-reorder feedback.

- [ ] **Step 1: Write failing manager behavior tests**

Create a real diagram fixture through `createDiagram`, add a second process and two named lanes, load it with `useDiagramStore.setState`, and render `EditorToolbar` with a minimal in-memory `ProjectRepository` and `defaultExportPreferences`.

```tsx
expect(screen.getByRole("button", { name: "Process settings for Order approval" })).toBeVisible();
expect(screen.getByRole("button", { name: "Lane settings for User" })).toBeVisible();
expect(screen.getByRole("button", { name: "Show Order approval on canvas" })).toHaveTextContent("Show on canvas");
expect(screen.getByText("Swimlanes")).toBeVisible();
expect(screen.getByText("2")).toBeVisible();

fireEvent.click(screen.getByRole("button", { name: "Move User swimlane right" }));
expect(screen.getByRole("status")).toHaveTextContent("User swimlane moved to position 2 of 2.");
```

Add a second test proving the target process overflow action is disabled with no selected node and becomes enabled when a node from another process is selected.

- [ ] **Step 2: Run the new toolbar test and verify RED**

Run: `npm test -- EditorToolbar.test.tsx` from `web/`.

Expected: FAIL because the old toolbar still exposes generic Properties/Focus copy and no reorder status.

- [ ] **Step 3: Implement selection-aware integration and semantic hierarchy**

In `EditorToolbar.tsx`:

```tsx
const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
const [managerMessage, setManagerMessage] = useState("");

function canMoveSelectionTo(processId: string) {
  if (!selectedNodeIds.length) return false;
  const target = document.processes.find((process) => process.id === processId);
  const sources = document.processes.filter((process) => process.nodes.some((node) => selectedNodeIds.includes(node.id)));
  return Boolean(target?.lanes.length && sources.length === 1 && sources[0].id !== processId);
}

function reorderLane(laneName: string, laneId: string, direction: -1 | 1, index: number, count: number) {
  moveLane(laneId, direction);
  setManagerMessage(`${laneName} swimlane moved to position ${index + direction + 1} of ${count}.`);
}
```

Replace generic copy with contextual labels, add a `Swimlanes` heading/count, use `role="list"`/`role="listitem"`, integrate `ProcessActionsMenu`, and render one visually hidden polite `role="status"` region for `managerMessage`.

- [ ] **Step 4: Run focused component tests and verify GREEN**

Run: `npm test -- ProcessActionsMenu.test.tsx EditorToolbar.test.tsx` from `web/`.

Expected: all focused tests PASS.

- [ ] **Step 5: Run existing related unit tests**

Run: `npm test -- LanePropertiesForm.test.tsx PropertiesPanel.test.tsx EditorPage.test.tsx` from `web/`.

Expected: all related tests PASS with no warnings.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- web/src/components/EditorToolbar.tsx web/src/components/EditorToolbar.test.tsx
git commit -m "feat: clarify process and swimlane management"
```

### Task 3: Responsive Visual Hierarchy and Browser Verification

**Files:**
- Modify: `web/src/styles.css`
- Modify: `web/e2e/editor.spec.ts`
- Modify only if the intentional editor view is captured: `web/e2e/visual.spec.ts` and its affected snapshot file.

**Interfaces:**
- Consumes: class names and semantic markup from Tasks 1 and 2.
- Produces: compact process cards, distinct selected state, two-level lane rows, 44-pixel icon targets, viewport-contained menus, and responsive reflow.

- [ ] **Step 1: Add a failing browser assertion for the new manager contract**

Extend the existing editor process-management test:

```ts
await expect(page.getByRole("button", { name: /Process settings for/ })).toBeVisible();
await expect(page.getByRole("button", { name: /Show .* on canvas/ })).toHaveText("Show on canvas");
await page.getByRole("button", { name: /More actions for/ }).first().click();
await expect(page.getByRole("menuitem", { name: "Delete process" })).toBeVisible();
await expect(page.locator(".lane-row").first()).toHaveCSS("min-width", "0px");
```

- [ ] **Step 2: Run the targeted browser test and verify RED**

Run: `npx playwright test e2e/editor.spec.ts --project=edge --grep "process"` from `web/`.

Expected: FAIL on the new labels/menu before the style and browser-contract updates are complete.

- [ ] **Step 3: Implement the manager styles**

Update the existing manager selectors in `styles.css`:

```css
.process-entry { position: relative; border-radius: var(--flox-radius-control); background: var(--surface); overflow: visible; }
.process-row { grid-template-columns: minmax(0,1fr) auto 44px; min-height: 52px; }
.process-row__actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); }
.process-lanes__heading { display: flex; justify-content: space-between; }
.lane-row { display: grid; grid-template-columns: minmax(0,1fr) auto; }
.lane-row__actions { display: flex; justify-content: flex-end; grid-column: 1 / -1; }
.lane-row__actions button { width: 44px; min-height: 44px; }
.process-actions-menu__content { position: absolute; z-index: 50; right: 0; top: calc(100% + 4px); }
```

Use only existing tokens present in `styles.css`. Add a reduced-motion override only if a new transform or opacity transition is introduced.

- [ ] **Step 4: Run unit, type, build, accessibility, and browser verification**

Run from `web/`:

```powershell
npm run typecheck
npm test
npm run build
npx playwright test e2e/accessibility.spec.ts --project=edge
npx playwright test e2e/editor.spec.ts --project=edge --grep "process"
```

Expected: every command exits 0 with no TypeScript errors, unit failures, axe violations, or targeted browser failures.

- [ ] **Step 5: Perform visual review and update only intentional snapshots**

Start the Vite preview, inspect the manager in dark and light themes at desktop width and at 200% zoom, confirm no horizontal page overflow, and confirm focus/selected states are visually distinct. If an existing Playwright screenshot covers this manager, update only that snapshot and rerun its individual visual test.

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- web/src/styles.css web/e2e/editor.spec.ts
git commit -m "style: refine process manager hierarchy"
```

### Task 4: Final Scope and Regression Gate

**Files:**
- Verify only; no production file is expected to change.

**Interfaces:**
- Consumes: completed Tasks 1 through 3.
- Produces: evidence that the feature is frontend-only and all required gates pass.

- [ ] **Step 1: Verify backend and domain boundaries are untouched**

Run: `git status --short` and `git diff --name-only HEAD~3..HEAD`.

Expected: changed implementation files are limited to `web/src/components/`, `web/src/styles.css`, `web/e2e/`, and the Superpowers plan/spec documents; no `server/`, persistence, domain, or store files appear.

- [ ] **Step 2: Run the full frontend verification gate**

Run from `web/`:

```powershell
npm run typecheck
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Record manual accessibility verification**

Verify keyboard-only menu opening, ArrowUp/ArrowDown navigation, Escape dismissal and focus return, contextual lane controls, reorder announcement, 200% zoom, and narrow-sidebar reflow. Report which screen-reader behavior remains a manual follow-up if no screen reader is available in the environment.
