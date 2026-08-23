import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Plus, Search, X } from "lucide-react";
import { useDialogFocus } from "../../hooks/use-dialog-focus";
import { useDiagramStore } from "../../store/diagram-store";
import { Button } from "../ui/button";
import { ProcessGrid } from "./ProcessGrid";
import { ProcessLanePanel } from "./ProcessLanePanel";
import {
  buildProcessSummaries,
  filterAndSortProcesses,
  type ProcessSortOrder,
} from "./process-manager-model";

export interface ProcessManagerDialogProps {
  readOnly: boolean;
  onClose: () => void;
}

export function ProcessManagerDialog({ readOnly, onClose }: ProcessManagerDialogProps) {
  const document = useDiagramStore((state) => state.document);
  const activeProcessId = useDiagramStore((state) => state.activeProcessId);
  const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
  const setActiveProcess = useDiagramStore((state) => state.setActiveProcess);
  const addProcess = useDiagramStore((state) => state.addProcess);
  const removeProcess = useDiagramStore((state) => state.removeProcess);
  const moveSelectedToProcess = useDiagramStore((state) => state.moveSelectedToProcess);
  const [selectedProcessId, setSelectedProcessId] = useState(
    () => activeProcessId ?? document.processes[0]?.id ?? null,
  );
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
  const summaries = useMemo(() => buildProcessSummaries(document.processes), [document.processes]);
  const filteredProcesses = useMemo(
    () => filterAndSortProcesses(summaries, query, sortOrder),
    [query, sortOrder, summaries],
  );
  const selectedProcess = document.processes.find((process) => process.id === selectedProcessId) ?? null;
  const selectedSummary = summaries.find((process) => process.id === selectedProcessId) ?? null;

  function confirmDrafts(): boolean {
    const addDirty = addProcessOpen && processName.trim().length > 0;
    if ((lanePanelDirty || addDirty) && !window.confirm("Discard unsaved process or swimlane changes?")) {
      return false;
    }
    setLanePanelDirty(false);
    setAddProcessOpen(false);
    setProcessName("");
    return true;
  }

  function requestClose() {
    if (confirmDrafts()) onClose();
  }

  useDialogFocus(dialogRef, requestClose, searchRef);

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

  function selectProcess(processId: string) {
    if (processId === selectedProcessId) {
      setMobileStep("lanes");
      return;
    }
    if (!confirmDrafts()) return;
    setSelectedProcessId(processId);
    setEditRequestId(null);
    setMobileStep("lanes");
  }

  function showOnCanvas(processId: string) {
    if (!confirmDrafts()) return;
    setActiveProcess(processId);
    onClose();
    window.setTimeout(
      () => window.dispatchEvent(new CustomEvent("flox:focus-process", { detail: processId })),
      0,
    );
  }

  function canMoveSelection(processId: string): boolean {
    if (!selectedNodeIds.length) return false;
    const target = document.processes.find((process) => process.id === processId);
    const sources = document.processes.filter((process) =>
      process.nodes.some((node) => selectedNodeIds.includes(node.id)),
    );
    return Boolean(target?.lanes.length && sources.length === 1 && sources[0].id !== processId);
  }

  function moveSelection(processId: string) {
    if (!confirmDrafts()) return;
    const target = document.processes.find((process) => process.id === processId);
    const moved = moveSelectedToProcess(processId);
    setAnnouncement(
      moved
        ? `Selection moved to ${target?.name ?? "the selected process"}.`
        : `Selection could not be moved to ${target?.name ?? "the selected process"}.`,
    );
  }

  function editProcess(processId: string) {
    if (processId !== selectedProcessId && !confirmDrafts()) return;
    setSelectedProcessId(processId);
    setEditRequestId(processId);
    setMobileStep("lanes");
  }

  function deleteProcess(processId: string) {
    if (!confirmDrafts()) return;
    const processIndex = document.processes.findIndex((process) => process.id === processId);
    const fallbackId = document.processes[processIndex + 1]?.id ?? document.processes[processIndex - 1]?.id ?? null;
    const processNameToDelete = document.processes[processIndex]?.name ?? "Process";
    removeProcess(processId, (message) => window.confirm(message));
    const processWasDeleted = !useDiagramStore.getState().document.processes.some((process) => process.id === processId);
    if (!processWasDeleted) return;
    if (selectedProcessId === processId) setSelectedProcessId(fallbackId);
    setAnnouncement(`${processNameToDelete} deleted.`);
  }

  function submitNewProcess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = processName.trim();
    if (!name) return;
    const previousIds = new Set(document.processes.map((process) => process.id));
    addProcess(name);
    const created = useDiagramStore.getState().document.processes.find((process) => !previousIds.has(process.id));
    setAddProcessOpen(false);
    setProcessName("");
    if (created) {
      setSelectedProcessId(created.id);
      setMobileStep("lanes");
      setAnnouncement(`${created.name} added.`);
    }
  }

  const resultLabel = `Showing ${filteredProcesses.length} ${filteredProcesses.length === 1 ? "process" : "processes"}`;

  return createPortal(
    <div className="process-manager-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) requestClose();
    }}>
      <section
        ref={dialogRef}
        className="process-manager-dialog"
        data-mobile-step={mobileStep}
        role="dialog"
        aria-modal="true"
        aria-labelledby="process-manager-title"
        tabIndex={-1}
      >
        <header>
          <div>
            <h2 id="process-manager-title">Processes</h2>
            <p>{document.processes.length} activity {document.processes.length === 1 ? "diagram" : "diagrams"}</p>
          </div>
          <div className="process-manager-dialog__header-actions">
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!confirmDrafts()) return;
                  setAddProcessOpen(true);
                }}
              >
                <Plus aria-hidden="true" />
                Add process
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Close processes" onClick={requestClose}>
              <X aria-hidden="true" />
            </Button>
          </div>
        </header>

        <div className="process-manager-dialog__body">
          <section className="process-manager-dialog__browse" aria-label="Browse processes">
            <div className="process-manager-toolbar">
              <label className="process-manager-field" htmlFor="process-manager-search">
                <span>Find a process</span>
                <span className="process-manager-field__control">
                  <Search aria-hidden="true" />
                  <input
                    id="process-manager-search"
                    ref={searchRef}
                    type="search"
                    aria-label="Find a process"
                    value={query}
                    placeholder="Name or number"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button type="button" aria-label="Clear process search" onClick={() => setQuery("")}>
                      <X aria-hidden="true" />
                    </button>
                  )}
                  <kbd>Ctrl K</kbd>
                </span>
              </label>
              <label className="process-manager-field" htmlFor="process-manager-sort">
                <span>Arrange results</span>
                <span className="process-manager-field__control">
                  <select id="process-manager-sort" aria-label="Arrange results" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as ProcessSortOrder)}>
                    <option value="document">Process order</option>
                    <option value="name-asc">Name A–Z</option>
                    <option value="name-desc">Name Z–A</option>
                  </select>
                </span>
              </label>
              <span className="sr-only" role="status" aria-label="Process results" aria-live="polite">
                {resultLabel}
              </span>
            </div>

            {!readOnly && addProcessOpen && (
              <form className="process-manager-add-form" onSubmit={submitNewProcess}>
                <label className="property-field">
                  <span>Process name</span>
                  <input
                    autoFocus
                    required
                    maxLength={120}
                    value={processName}
                    onChange={(event) => setProcessName(event.target.value)}
                  />
                </label>
                <div className="lane-form-actions">
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    setAddProcessOpen(false);
                    setProcessName("");
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={!processName.trim()}>Save</Button>
                </div>
              </form>
            )}

            <div className="process-manager-dialog__grid-scroll">
              {selectedProcessId && !filteredProcesses.some((process) => process.id === selectedProcessId) && (
                <p className="process-manager-filter-note">Selected process is outside the current results.</p>
              )}
              <ProcessGrid
                processes={filteredProcesses}
                selectedProcessId={selectedProcessId}
                activeProcessId={activeProcessId}
                readOnly={readOnly}
                canMoveSelection={canMoveSelection}
                onSelect={selectProcess}
                onShowOnCanvas={showOnCanvas}
                onEdit={editProcess}
                onMoveSelection={moveSelection}
                onDelete={deleteProcess}
              />
            </div>
          </section>

          <ProcessLanePanel
            process={selectedProcess}
            sequence={selectedSummary?.sequence ?? null}
            readOnly={readOnly}
            editRequestId={editRequestId}
            onConsumeEditRequest={() => setEditRequestId(null)}
            onShowOnCanvas={showOnCanvas}
            onDirtyChange={setLanePanelDirty}
            onAnnouncement={setAnnouncement}
          />
          <Button
            variant="ghost"
            size="sm"
            className="process-manager-mobile-back"
            onClick={() => {
              setMobileStep("grid");
              window.setTimeout(() => {
                if (selectedProcessId) window.document.getElementById(`process-card-${selectedProcessId}`)?.querySelector<HTMLButtonElement>(".process-manager-card__select")?.focus();
              }, 0);
            }}
          >
            <ArrowLeft aria-hidden="true" />
            Back to processes
          </Button>
          <span className="sr-only" role="status" aria-label="Process manager update" aria-live="polite">
            {announcement}
          </span>
        </div>
      </section>
    </div>,
    window.document.body,
  );
}
