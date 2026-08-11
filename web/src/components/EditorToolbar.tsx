import { useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Box,
  Braces,
  Circle,
  CircleDot,
  Columns3,
  Crosshair,
  Diamond,
  Download,
  GitFork,
  ImageDown,
  Paintbrush,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  RotateCcw,
  Square,
  StickyNote,
  Trash2,
  Upload,
  Undo2,
  WandSparkles,
} from "lucide-react";
import type { AppTheme } from "../domain/app-theme";
import { importDiagram, type DiagramNodeType } from "../domain/diagram";
import type { ExportPreferences } from "../domain/preferences";
import type { ProjectRepository } from "../persistence/project-repository";
import { useDiagramStore } from "../store/diagram-store";
import { ExportDialog } from "./ExportDialog";
import { LanePropertiesForm } from "./LanePropertiesForm";
import { ProcessActionsMenu } from "./ProcessActionsMenu";
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
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  readOnly?: boolean;
  exportPreferences: ExportPreferences;
  currentProjectId: string;
  repository: ProjectRepository;
  workspaceCount: number;
  onExportPreferencesChange?: (preferences: ExportPreferences) => void;
}

export function EditorToolbar({ collapsed, onCollapsedChange, theme, onThemeChange, readOnly = false, exportPreferences, currentProjectId, repository, workspaceCount, onExportPreferencesChange }: EditorToolbarProps) {
  const document = useDiagramStore((state) => state.document);
  const addNode = useDiagramStore((state) => state.addNode);
  const importDocument = useDiagramStore((state) => state.importDocument);
  const reset = useDiagramStore((state) => state.reset);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const canUndo = useDiagramStore((state) => state.past.length > 0);
  const canRedo = useDiagramStore((state) => state.future.length > 0);
  const activeProcessId = useDiagramStore((state) => state.activeProcessId);
  const setActiveProcess = useDiagramStore((state) => state.setActiveProcess);
  const addProcess = useDiagramStore((state) => state.addProcess);
  const updateProcess = useDiagramStore((state) => state.updateProcess);
  const removeProcess = useDiagramStore((state) => state.removeProcess);
  const moveSelectedToProcess = useDiagramStore((state) => state.moveSelectedToProcess);
  const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
  const activeProcess = document.processes.find((process) => process.id === activeProcessId);
  const addLane = useDiagramStore((state) => state.addLane);
  const removeLane = useDiagramStore((state) => state.removeLane);
  const moveLane = useDiagramStore((state) => state.moveLane);
  const updateLaneSettings = useDiagramStore((state) => state.updateLaneSettings);
  const updateAppearance = useDiagramStore((state) => state.updateAppearance);
  const autoArrange = useDiagramStore((state) => state.autoArrange);
  const inputRef = useRef<HTMLInputElement>(null);
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [message, setMessage] = useState("Changes stay in this browser");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "png" | "svg">(exportPreferences.defaultFormat);
  const [openLaneId, setOpenLaneId] = useState<string | null>(null);
  const [laneDraftDirty, setLaneDraftDirty] = useState(false);
  const [addProcessOpen, setAddProcessOpen] = useState(false);
  const [processName, setProcessName] = useState("");
  const [openProcessId, setOpenProcessId] = useState<string | null>(null);
  const [processDraftName, setProcessDraftName] = useState("");
  const [managerMessage, setManagerMessage] = useState("");
  const processDraftDirty = Boolean(openProcessId && processDraftName !== document.processes.find((process) => process.id === openProcessId)?.name);

  function openExport(trigger: HTMLButtonElement, format: "json" | "png" | "svg") {
    exportTriggerRef.current = trigger;
    setExportFormat(format);
    setExportOpen(true);
  }

  function closeExport() {
    setExportOpen(false);
    window.setTimeout(() => exportTriggerRef.current?.focus(), 0);
  }

  function addPaletteNode(type: DiagramNodeType, position: { x: number; y: number }) {
    addNode(type, position);
    if (window.matchMedia("(max-width: 760px)").matches) onCollapsedChange(true);
  }

  function addSwimlane() {
    addLane();
    if (window.matchMedia("(max-width: 760px)").matches) onCollapsedChange(false);
  }

  function confirmStructuralDrafts() {
    if ((laneDraftDirty || processDraftDirty || addProcessOpen && processName.trim()) && !window.confirm("Discard unsaved process or swimlane changes?")) return false;
    setOpenLaneId(null); setLaneDraftDirty(false); setOpenProcessId(null); setProcessDraftName(""); setAddProcessOpen(false); setProcessName("");
    return true;
  }

  function openProcessEditor(id: string) {
    if (openProcessId === id) { if (confirmStructuralDrafts()) window.setTimeout(() => window.document.getElementById(`process-properties-${id}`)?.focus(), 0); return }
    if (!confirmStructuralDrafts()) return;
    const process = document.processes.find((entry) => entry.id === id); if (!process) return;
    setActiveProcess(id); setOpenProcessId(id); setProcessDraftName(process.name);
  }

  function closeProcessEditor(processId: string) {
    setOpenProcessId(null);
    setProcessDraftName("");
    window.setTimeout(() => window.document.getElementById(`process-properties-${processId}`)?.focus(), 0);
  }

  function returnLaneFocus(laneId: string) {
    window.setTimeout(() => window.document.getElementById(`lane-properties-${laneId}`)?.focus(), 0);
  }

  function closeLaneEditor() {
    if (!openLaneId) return true;
    if (laneDraftDirty && !window.confirm("Discard unsaved swimlane changes?")) return false;
    const previous = openLaneId;
    setOpenLaneId(null);
    setLaneDraftDirty(false);
    returnLaneFocus(previous);
    return true;
  }

  function toggleLaneEditor(laneId: string) {
    if (openLaneId === laneId) {
      closeLaneEditor();
      return;
    }
    if (openLaneId && !closeLaneEditor()) return;
    setOpenLaneId(laneId);
    setLaneDraftDirty(false);
  }

  function canMoveSelectionTo(processId: string) {
    if (!selectedNodeIds.length) return false;
    const target = document.processes.find((process) => process.id === processId);
    const sources = document.processes.filter((process) => process.nodes.some((node) => selectedNodeIds.includes(node.id)));
    return Boolean(target?.lanes.length && sources.length === 1 && sources[0].id !== processId);
  }

  function moveSelectionTo(processId: string, processName: string) {
    const moved = moveSelectedToProcess(processId);
    setManagerMessage(moved ? `Selection moved to ${processName}.` : `Selection could not be moved to ${processName}.`);
  }

  function reorderLane(laneName: string, laneId: string, direction: -1 | 1, index: number, count: number) {
    moveLane(laneId, direction);
    setManagerMessage(`${laneName} swimlane moved to position ${index + direction + 1} of ${count}.`);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5_000_000) {
      setMessage("Import refused: file is larger than 5 MB");
      return;
    }
    try {
      importDocument(importDiagram(JSON.parse(await file.text())));
      setMessage("Diagram imported");
    } catch (error) {
      setMessage(error instanceof Error ? `Import failed: ${error.message}` : "Import failed");
    }
  }

  return (
    <aside className={`${collapsed ? "editor-sidebar is-collapsed" : "editor-sidebar"}${readOnly ? " is-read-only" : ""}`}>
      <div className="sidebar-heading">
        {!collapsed && <span>UML nodes <small>Components</small></span>}
        <Button variant="ghost" size="icon" onClick={() => onCollapsedChange(!collapsed)} aria-label={collapsed ? "Expand tools" : "Collapse tools"}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <div className="node-palette" aria-label="Diagram components" inert={readOnly}>
        <div className="history-buttons">
          <Button variant="outline" size="icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 /></Button>
          <Button variant="outline" size="icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"><Redo2 /></Button>
        </div>
        {nodeGroups.map((group) => <div className="palette-group" key={group.label}>
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
              <Icon /> {!collapsed && <span>{label}</span>}
            </Button>;
          })}
        </div>)}
        <div className="palette-group">
          {!collapsed && <span className="palette-group__label">Structure</span>}
          <Button variant="ghost" className="palette-button" title="Add Swimlane" onClick={addSwimlane}>
            <Columns3 /> {!collapsed && <span>Swimlane</span>}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="lane-manager process-manager" inert={readOnly}>
          <div className="lane-manager__heading"><span>Processes</span><Button id="add-process-trigger" variant="ghost" size="sm" onClick={() => { if (confirmStructuralDrafts()) setAddProcessOpen(true); }}><Plus /> Add process</Button></div>
          {addProcessOpen && <form className="process-editor-disclosure" onSubmit={(event) => { event.preventDefault(); const name = processName.trim(); if (!name) return; addProcess(name); setAddProcessOpen(false); setProcessName(""); }}>
            <label className="property-field"><span>Process name</span><input autoFocus required maxLength={120} value={processName} onChange={(event) => setProcessName(event.target.value)} /></label>
            <div className="lane-form-actions"><Button type="button" variant="outline" size="sm" onClick={() => { setAddProcessOpen(false); setProcessName(""); }}>Cancel</Button><Button type="submit" size="sm" disabled={!processName.trim()}>Save</Button></div>
          </form>}
          {document.processes.map((process) => <section className={`process-entry${process.id === activeProcessId ? " is-active" : ""}`} key={process.id} aria-labelledby={`process-name-${process.id}`}>
            <div className="process-row">
              <button id={`process-name-${process.id}`} type="button" className="process-row__name" aria-current={process.id === activeProcessId ? "true" : undefined} title={process.name} onClick={() => { if (confirmStructuralDrafts()) setActiveProcess(process.id); }}>{process.name}</button>
              <Button id={`process-properties-${process.id}`} className="process-settings-button" variant="outline" size="sm" aria-label={`Process settings for ${process.name}`} aria-expanded={openProcessId === process.id} aria-controls={`process-editor-${process.id}`} onClick={() => openProcessEditor(process.id)}>Process settings</Button>
              <ProcessActionsMenu
                processName={process.name}
                canMoveSelection={canMoveSelectionTo(process.id)}
                onMoveSelection={() => moveSelectionTo(process.id, process.name)}
                onDelete={() => {
                  if (!confirmStructuralDrafts()) return;
                  removeProcess(process.id, (message) => window.confirm(message));
                  window.setTimeout(() => {
                    const processWasDeleted = !useDiagramStore.getState().document.processes.some((entry) => entry.id === process.id);
                    if (processWasDeleted) window.document.getElementById("add-process-trigger")?.focus();
                  }, 0);
                }}
              />
            </div>
            <div className="process-row__actions">
              <Button variant="ghost" size="sm" onClick={() => { if (confirmStructuralDrafts()) { setActiveProcess(process.id); addLane(process.id); } }}><Columns3 /> Add lane</Button>
              <Button variant="ghost" size="sm" aria-label={`Show ${process.name} on canvas`} onClick={() => { setActiveProcess(process.id); window.dispatchEvent(new CustomEvent("flox:focus-process", { detail: process.id })); }}><Crosshair /> Show on canvas</Button>
            </div>
            {openProcessId === process.id && <form id={`process-editor-${process.id}`} className="process-editor-disclosure" onSubmit={(event) => { event.preventDefault(); updateProcess(process.id, { name: processDraftName }); closeProcessEditor(process.id); }}>
              <label className="property-field"><span>Process name</span><input autoFocus required maxLength={120} value={processDraftName} onChange={(event) => setProcessDraftName(event.target.value)} /></label>
              <div className="lane-form-actions"><Button type="button" variant="outline" size="sm" onClick={() => closeProcessEditor(process.id)}>Cancel</Button><Button type="submit" size="sm" disabled={!processDraftDirty || !processDraftName.trim()}>Save</Button></div>
            </form>}
            <div className="process-lanes">
              <div className="process-lanes__heading"><span>Swimlanes</span><strong aria-label={`${process.lanes.length} swimlanes`}>{process.lanes.length}</strong></div>
              <div className="process-lanes__list" role="list" aria-label={`${process.name} swimlanes`}>
          {process.lanes.map((lane, index) => <div className="lane-entry" role="listitem" key={lane.id}>
            <div className="lane-row">
              <span className="lane-row__name" title={lane.name}>{lane.name}</span>
              <Button id={`lane-properties-${lane.id}`} className="lane-settings-button" variant="outline" size="sm" aria-label={`Lane settings for ${lane.name}`} aria-expanded={openLaneId === lane.id} aria-controls={`lane-editor-${lane.id}`} onClick={() => toggleLaneEditor(lane.id)}>Lane settings</Button>
              <div className="lane-row__actions">
                <Button variant="ghost" size="icon" disabled={index === 0} aria-label={`Move ${lane.name} swimlane left`} title={`Move ${lane.name} swimlane left`} onClick={() => reorderLane(lane.name, lane.id, -1, index, process.lanes.length)}><ArrowUp aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon" disabled={index === process.lanes.length - 1} aria-label={`Move ${lane.name} swimlane right`} title={`Move ${lane.name} swimlane right`} onClick={() => reorderLane(lane.name, lane.id, 1, index, process.lanes.length)}><ArrowDown aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${lane.name} swimlane and keep its nodes`} title={`Delete ${lane.name} swimlane and keep its nodes`} onClick={() => {
                  if (openLaneId === lane.id && !closeLaneEditor()) return;
                  removeLane(lane.id);
                }}><Trash2 aria-hidden="true" /></Button>
              </div>
            </div>
            {openLaneId === lane.id && <div id={`lane-editor-${lane.id}`} className="lane-editor-disclosure">
              <LanePropertiesForm
                lane={lane}
                layout={process.swimlaneLayout}
                onDirtyChange={setLaneDraftDirty}
                onCancel={closeLaneEditor}
                onSave={(draft) => {
                  updateLaneSettings(lane.id, draft);
                  setLaneDraftDirty(false);
                }}
              />
            </div>}
          </div>)}
              </div>
            </div>
          </section>)}
          {!document.processes.length && <p className="manager-empty">Add a process to begin.</p>}
          <p className="sr-only" role="status" aria-label="Swimlane update" aria-live="polite">{managerMessage}</p>
        </div>
      )}

      {!collapsed && <details className="appearance-manager" inert={readOnly}>
        <summary><Paintbrush /> Appearance</summary>
        <div className="appearance-grid">
          <label>App accent<input aria-label="App accent" type="color" value={theme.primary} onChange={(event) => onThemeChange({ ...theme, primary: event.target.value })} /></label>
          <label>App background<input aria-label="App background" type="color" value={theme.background} onChange={(event) => onThemeChange({ ...theme, background: event.target.value })} /></label>
          <label>Panels<input aria-label="Panel color" type="color" value={theme.surface} onChange={(event) => onThemeChange({ ...theme, surface: event.target.value })} /></label>
          <label>Canvas<input aria-label="Canvas color" type="color" value={document.appearance.canvasColor} onChange={(event) => updateAppearance({ canvasColor: event.target.value })} /></label>
          <label>Grid<input aria-label="Grid color" type="color" value={document.appearance.gridColor} onChange={(event) => updateAppearance({ gridColor: event.target.value })} /></label>
          <label>Control flows<input aria-label="Control flow color" type="color" value={document.appearance.controlFlowColor} onChange={(event) => updateAppearance({ controlFlowColor: event.target.value })} /></label>
          <label>Object flows<input aria-label="Object flow color" type="color" value={document.appearance.objectFlowColor} onChange={(event) => updateAppearance({ objectFlowColor: event.target.value })} /></label>
        </div>
      </details>}

      <div className="sidebar-spacer" />
      <div className="sidebar-actions">
        {!readOnly && <Button variant="ghost" className="palette-button" onClick={autoArrange} title="Auto arrange diagram">
          <WandSparkles /> {!collapsed && <span>Auto arrange</span>}
        </Button>}
        {!readOnly && <Button variant="ghost" className="palette-button" onClick={() => inputRef.current?.click()} title="Import JSON">
          <Upload /> {!collapsed && <span>Import JSON</span>}
        </Button>}
        <div className="sidebar-export">
          <Button variant="ghost" className="palette-button" onClick={(event) => openExport(event.currentTarget, exportPreferences.defaultFormat)} title="Export image">
            <ImageDown /> {!collapsed && <span>Export image</span>}
          </Button>
          {exportOpen && <ExportDialog document={document} activeProcessId={activeProcessId} currentProjectId={currentProjectId} repository={repository} workspaceCount={workspaceCount} defaults={exportPreferences} initialFormat={exportFormat} onDefaultsChange={onExportPreferencesChange} onClose={closeExport} />}
        </div>
        <Button variant="ghost" className="palette-button" onClick={(event) => openExport(event.currentTarget, "json")} title="Export JSON">
          <Download /> {!collapsed && <span>Export JSON</span>}
        </Button>
        {!readOnly && <Button variant="ghost" className="palette-button" onClick={reset} title="New diagram">
          <RotateCcw /> {!collapsed && <span>New diagram</span>}
        </Button>}
        <input ref={inputRef} className="sr-only" aria-label="Import diagram JSON" type="file" accept="application/json,.json" onChange={importJson} />
      </div>
      {!collapsed && <p className="sidebar-status" role="status">{message}</p>}
    </aside>
  );
}
