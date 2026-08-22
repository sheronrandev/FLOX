import { Crosshair } from "lucide-react";
import { ProcessActionsMenu } from "../ProcessActionsMenu";
import { Button } from "../ui/button";
import type { ProcessSummary } from "./process-manager-model";

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

export function ProcessGrid(props: ProcessGridProps) {
  if (!props.processes.length) {
    return (
      <div className="process-manager-empty">
        <strong>No matching processes</strong>
        <span>Clear the search to show every process.</span>
      </div>
    );
  }

  return (
    <div className="process-manager-grid" role="list" aria-label="Processes">
      {props.processes.map((process) => {
        const selected = process.id === props.selectedProcessId;
        const active = process.id === props.activeProcessId;

        return (
          <article
            id={`process-card-${process.id}`}
            className={`process-manager-card${selected ? " is-selected" : ""}${active ? " is-active" : ""}`}
            role="listitem"
            aria-label={`Process ${process.sequence}: ${process.name}`}
            key={process.id}
          >
            <button
              type="button"
              className="process-manager-card__select"
              aria-label={`Select ${process.name}`}
              aria-pressed={selected}
              onClick={() => props.onSelect(process.id)}
            >
              <span className="process-manager-card__sequence">{process.sequence}</span>
              <strong>{process.name}</strong>
              <span>
                {process.laneCount} {process.laneCount === 1 ? "swimlane" : "swimlanes"}
              </span>
              {active && <small>Active on canvas</small>}
            </button>
            <div className="process-manager-card__actions">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Show ${process.name} on canvas`}
                onClick={() => props.onShowOnCanvas(process.id)}
              >
                <Crosshair aria-hidden="true" />
                Show on canvas
              </Button>
              {!props.readOnly && (
                <ProcessActionsMenu
                  processName={process.name}
                  canMoveSelection={props.canMoveSelection(process.id)}
                  onEdit={() => props.onEdit(process.id)}
                  onMoveSelection={() => props.onMoveSelection(process.id)}
                  onDelete={() => props.onDelete(process.id)}
                />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
