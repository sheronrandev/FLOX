import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Columns3, Crosshair, Settings2, Trash2 } from "lucide-react";
import type { DiagramProcess } from "../../domain/diagram";
import { useDiagramStore } from "../../store/diagram-store";
import { LanePropertiesForm } from "../LanePropertiesForm";
import { Button } from "../ui/button";

export interface ProcessLanePanelProps {
  process: DiagramProcess | null;
  sequence: string | null;
  readOnly: boolean;
  editRequestId: string | null;
  onConsumeEditRequest: () => void;
  onShowOnCanvas: (processId: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onAnnouncement: (message: string) => void;
}

export function ProcessLanePanel({
  process,
  sequence,
  readOnly,
  editRequestId,
  onConsumeEditRequest,
  onShowOnCanvas,
  onDirtyChange,
  onAnnouncement,
}: ProcessLanePanelProps) {
  const updateProcess = useDiagramStore((state) => state.updateProcess);
  const addLane = useDiagramStore((state) => state.addLane);
  const removeLane = useDiagramStore((state) => state.removeLane);
  const moveLane = useDiagramStore((state) => state.moveLane);
  const updateLaneSettings = useDiagramStore((state) => state.updateLaneSettings);
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

  if (!process) {
    return (
      <aside className="process-lane-panel process-lane-panel--empty" aria-label="Manage swimlanes">
        <strong>Select a process</strong>
        <span>Choose a process to manage its swimlanes.</span>
      </aside>
    );
  }
  const selectedProcess = process;

  function closeLaneEditor(confirmDiscard = true): boolean {
    if (!openLaneId) return true;
    if (confirmDiscard && laneDirty && !window.confirm("Discard unsaved swimlane changes?")) return false;
    const laneId = openLaneId;
    setOpenLaneId(null);
    setLaneDirty(false);
    window.setTimeout(() => window.document.getElementById(`lane-properties-${laneId}`)?.focus(), 0);
    return true;
  }

  function openProcessSettings() {
    if (!closeLaneEditor()) return;
    setProcessEditorOpen(true);
    setProcessDraftName(selectedProcess.name);
  }

  function toggleLaneEditor(laneId: string) {
    if (processDirty && !window.confirm("Discard unsaved process changes?")) return;
    if (processDirty) {
      setProcessEditorOpen(false);
      setProcessDraftName(selectedProcess.name);
    }
    if (openLaneId === laneId) {
      closeLaneEditor();
      return;
    }
    if (!closeLaneEditor()) return;
    setOpenLaneId(laneId);
    setLaneDirty(false);
  }

  return (
    <aside className="process-lane-panel" aria-label={`Manage swimlanes for ${process.name}`}>
      <header className="process-lane-panel__header">
        <span>Process {sequence}</span>
        <h3>{process.name}</h3>
        <small>
          {process.lanes.length} {process.lanes.length === 1 ? "swimlane" : "swimlanes"}
        </small>
      </header>

      <div className="process-lane-panel__actions">
        <Button variant="outline" size="sm" aria-label={`Show ${process.name} on canvas`} onClick={() => onShowOnCanvas(process.id)}>
          <Crosshair aria-hidden="true" />
          Show on canvas
        </Button>
        {!readOnly && <>
          <Button variant="outline" size="sm" onClick={openProcessSettings}>
            <Settings2 aria-hidden="true" />
            Process settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              addLane(process.id);
              onAnnouncement(`Swimlane added to ${process.name}.`);
            }}
          >
            <Columns3 aria-hidden="true" />
            Add swimlane
          </Button>
        </>}
      </div>

      <div className="process-lane-panel__list">
        {!readOnly && processEditorOpen && (
          <form
            className="process-editor-disclosure"
            onSubmit={(event) => {
              event.preventDefault();
              const name = processDraftName.trim();
              if (!name) return;
              updateProcess(process.id, { name });
              setProcessEditorOpen(false);
              onAnnouncement(`Process renamed to ${name}.`);
            }}
          >
            <label className="property-field">
              <span>Process name</span>
              <input
                autoFocus
                required
                maxLength={120}
                value={processDraftName}
                onChange={(event) => setProcessDraftName(event.target.value)}
              />
            </label>
            <div className="lane-form-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setProcessEditorOpen(false);
                  setProcessDraftName(process.name);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!processDirty || !processDraftName.trim()}>
                Save
              </Button>
            </div>
          </form>
        )}

        {!process.lanes.length && (
          <div className="process-manager-empty">
            <strong>No swimlanes yet</strong>
            <span>Add a swimlane before placing UML nodes in this process.</span>
          </div>
        )}

        <div role="list" aria-label={`${process.name} swimlanes`}>
          {process.lanes.map((lane, index) => (
            <div className="process-lane-row" role="listitem" key={lane.id}>
              <div className="process-lane-row__name">
                {lane.name}
                <small>
                  {lane.width}px wide · {process.swimlaneLayout.heightMode === "automatic" ? "Automatic height" : `${process.swimlaneLayout.height}px high`}
                </small>
              </div>
              {!readOnly && (
                <div className="process-lane-row__actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    aria-label={`Move ${lane.name} swimlane left`}
                    onClick={() => {
                      moveLane(lane.id, -1);
                      onAnnouncement(`${lane.name} swimlane moved to position ${index} of ${process.lanes.length}.`);
                    }}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === process.lanes.length - 1}
                    aria-label={`Move ${lane.name} swimlane right`}
                    onClick={() => {
                      moveLane(lane.id, 1);
                      onAnnouncement(`${lane.name} swimlane moved to position ${index + 2} of ${process.lanes.length}.`);
                    }}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    id={`lane-properties-${lane.id}`}
                    variant="outline"
                    size="sm"
                    aria-label={`Lane settings for ${lane.name}`}
                    aria-expanded={openLaneId === lane.id}
                    aria-controls={`lane-editor-${lane.id}`}
                    onClick={() => toggleLaneEditor(lane.id)}
                  >
                    Lane settings
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${lane.name} swimlane and keep its nodes`}
                    onClick={() => {
                      if (openLaneId === lane.id && !closeLaneEditor()) return;
                      removeLane(lane.id);
                      onAnnouncement(`${lane.name} swimlane deleted. Its nodes remain in ${process.name}.`);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              )}
              {!readOnly && openLaneId === lane.id && (
                <div id={`lane-editor-${lane.id}`} className="lane-editor-disclosure">
                  <LanePropertiesForm
                    lane={lane}
                    layout={process.swimlaneLayout}
                    onDirtyChange={setLaneDirty}
                    onCancel={() => closeLaneEditor(false)}
                    onSave={(draft) => {
                      updateLaneSettings(lane.id, draft);
                      setLaneDirty(false);
                      onAnnouncement(`${draft.name.trim() || lane.name} swimlane settings saved.`);
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
