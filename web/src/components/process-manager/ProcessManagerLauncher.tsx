import { PanelsTopLeft } from "lucide-react";
import type { DiagramProcess } from "../../domain/diagram";
import { Button } from "../ui/button";

export interface ProcessManagerLauncherProps {
  processes: DiagramProcess[];
  activeProcessId: string | null;
  collapsed: boolean;
  onOpen: () => void;
}

export function ProcessManagerLauncher({
  processes,
  activeProcessId,
  collapsed,
  onOpen,
}: ProcessManagerLauncherProps) {
  const activeName = processes.find((process) => process.id === activeProcessId)?.name ?? "No active process";

  return (
    <section className="process-manager-launcher" aria-label="Process manager">
      <Button
        id="process-manager-trigger"
        variant="outline"
        className="process-manager-launcher__button"
        aria-label={`Open processes (${processes.length})`}
        onClick={(event) => {
          event.currentTarget.focus();
          onOpen();
        }}
      >
        <PanelsTopLeft aria-hidden="true" />
        {!collapsed && (
          <>
            <span>Processes</span>
            <strong aria-label={`${processes.length} processes`}>{processes.length}</strong>
          </>
        )}
      </Button>
      {!collapsed && (
        <p>
          <span>Active process</span>
          <strong>{activeName}</strong>
        </p>
      )}
    </section>
  );
}
