import { useState } from "react";
import {
  Box,
  Braces,
  Circle,
  CircleDot,
  Diamond,
  GitFork,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  RotateCcw,
  Square,
  StickyNote,
  Undo2,
  WandSparkles,
} from "lucide-react";
import type { DiagramNodeType } from "../domain/diagram";
import { useDiagramStore } from "../store/diagram-store";
import { ProcessManagerDialog } from "./process-manager/ProcessManagerDialog";
import { ProcessManagerLauncher } from "./process-manager/ProcessManagerLauncher";
import { Button } from "./ui/button";

const nodeGroups: Array<{ label: string; items: Array<{ type: DiagramNodeType; label: string; icon: typeof Circle }> }> = [
  { label: "Actions & states", items: [
    { type: "activity", label: "Activity", icon: Box },
    { type: "state", label: "State", icon: Square },
    { type: "object-in-state", label: "Object in State", icon: Square },
  ] },
  { label: "Control", items: [
    { type: "decision", label: "Decision", icon: Diamond },
    { type: "merge", label: "Merge", icon: Diamond },
    { type: "fork", label: "Fork", icon: GitFork },
    { type: "join", label: "Join", icon: GitFork },
    { type: "initial", label: "Initial State", icon: Circle },
    { type: "final", label: "Final State", icon: CircleDot },
  ] },
  { label: "Annotations", items: [
    { type: "constraint", label: "Constraint", icon: Braces },
    { type: "note", label: "Note", icon: StickyNote },
  ] },
];

const nodeIndex = new Map(nodeGroups.flatMap((group) => group.items).map((item, index) => [item.type, index]));

interface EditorToolbarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  readOnly?: boolean;
}

export function EditorToolbar({ collapsed, onCollapsedChange, readOnly = false }: EditorToolbarProps) {
  const document = useDiagramStore((state) => state.document);
  const addNode = useDiagramStore((state) => state.addNode);
  const reset = useDiagramStore((state) => state.reset);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const canUndo = useDiagramStore((state) => state.past.length > 0);
  const canRedo = useDiagramStore((state) => state.future.length > 0);
  const activeProcessId = useDiagramStore((state) => state.activeProcessId);
  const activeProcess = document.processes.find((process) => process.id === activeProcessId);
  const autoArrange = useDiagramStore((state) => state.autoArrange);
  const [processManagerOpen, setProcessManagerOpen] = useState(false);

  function addPaletteNode(type: DiagramNodeType, position: { x: number; y: number }) {
    addNode(type, position);
    if (window.matchMedia("(max-width: 760px)").matches) onCollapsedChange(true);
  }

  return (
    <aside className={`${collapsed ? "editor-sidebar is-collapsed" : "editor-sidebar"}${readOnly ? " is-read-only" : ""}`}>
      <div className="sidebar-heading">
        {!collapsed && <span>UML nodes <small>Components</small></span>}
        <Button variant="ghost" size="icon" onClick={() => onCollapsedChange(!collapsed)} aria-label={collapsed ? "Expand tools" : "Collapse tools"}>
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </Button>
      </div>

      <div className="node-palette" aria-label="Diagram components" inert={readOnly}>
        <div className="history-buttons" role="group" aria-label="Diagram history">
          <Button variant="outline" size="icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 aria-hidden="true" /></Button>
          <Button variant="outline" size="icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo"><Redo2 aria-hidden="true" /></Button>
        </div>
        {nodeGroups.map((group) => <div className="palette-group" role="group" aria-label={group.label} key={group.label}>
          {!collapsed && <span className="palette-group__label">{group.label}</span>}
          {group.items.map(({ type, label, icon: Icon }) => {
            const index = nodeIndex.get(type) ?? 0;
            return <Button
              key={type}
              variant="ghost"
              className={`palette-button palette-button--${type}`}
              title={`Add ${label}`}
              disabled={!activeProcess?.lanes.length}
              onClick={() => addPaletteNode(type, { x: 140 + (index % 2) * 220, y: 100 + Math.floor(index / 2) * 120 })}
            >
              <Icon aria-hidden="true" /> {!collapsed && <span>{label}</span>}
            </Button>;
          })}
        </div>)}
      </div>

      <ProcessManagerLauncher
        processes={document.processes}
        activeProcessId={activeProcessId}
        collapsed={collapsed}
        onOpen={() => setProcessManagerOpen(true)}
      />
      {processManagerOpen && (
        <ProcessManagerDialog readOnly={readOnly} onClose={() => setProcessManagerOpen(false)} />
      )}

      <div className="sidebar-spacer" />
      <div className="sidebar-actions">
        {!readOnly && <Button variant="ghost" className="palette-button" onClick={autoArrange} title="Auto arrange diagram">
          <WandSparkles aria-hidden="true" /> {!collapsed && <span>Auto arrange</span>}
        </Button>}
        {!readOnly && <Button variant="ghost" className="palette-button" onClick={reset} title="New diagram">
          <RotateCcw aria-hidden="true" /> {!collapsed && <span>New diagram</span>}
        </Button>}
      </div>
      {!collapsed && <p className="sidebar-status" role="status">Changes stay in this browser</p>}
    </aside>
  );
}
