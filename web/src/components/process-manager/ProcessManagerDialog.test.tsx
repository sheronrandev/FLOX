// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDiagram, type DiagramProcess } from "../../domain/diagram";
import { useDiagramStore } from "../../store/diagram-store";
import { ProcessManagerDialog } from "./ProcessManagerDialog";

function processFixture(index: number): DiagramProcess {
  const sequence = String(index + 1).padStart(3, "0");
  return {
    id: `process-${sequence}`,
    name: `Process ${sequence}`,
    position: { x: 0, y: index * 900 },
    lanes: Array.from({ length: 3 }, (_, laneIndex) => ({
      id: `process-${sequence}-lane-${laneIndex + 1}`,
      name: `Lane ${laneIndex + 1}`,
      width: 320,
      colorIndex: laneIndex,
    })),
    nodes: [],
    edges: [],
    swimlaneLayout: { heightMode: "automatic", height: 760 },
  };
}

describe("process manager dialog", () => {
  beforeEach(() => {
    const document = createDiagram("Process manager scale");
    document.processes = Array.from({ length: 100 }, (_, index) => processFixture(index));
    useDiagramStore.setState({
      document,
      activeProcessId: "process-001",
      selectedNodeIds: [],
      selectedEdgeIds: [],
      past: [],
      future: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("filters 100 lightweight cards while rendering lanes only for the selected process", () => {
    render(<ProcessManagerDialog readOnly={false} onClose={() => undefined} />);

    expect(screen.getAllByRole("listitem", { name: /^Process \d{3}:/ })).toHaveLength(100);
    expect(screen.getAllByRole("button", { name: /Lane settings for/ })).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Find a process"), { target: { value: "Process 099" } });
    expect(screen.getByRole("button", { name: "Select Process 099" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Select Process 001" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Process results" })).toHaveTextContent("Showing 1 process");
  });

  it("keeps manager selection separate until Show on canvas", () => {
    const onClose = vi.fn();
    render(<ProcessManagerDialog readOnly={false} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Select Process 002" }));
    expect(useDiagramStore.getState().activeProcessId).toBe("process-001");
    fireEvent.click(screen.getByRole("button", { name: "Show Process 002 on canvas" }));
    expect(useDiagramStore.getState().activeProcessId).toBe("process-002");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("confirms before changing process with a dirty lane draft", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ProcessManagerDialog readOnly={false} onClose={() => undefined} />);

    fireEvent.click(screen.getAllByRole("button", { name: /Lane settings for/ })[0]);
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Select Process 002" }));

    expect(screen.getByRole("heading", { name: "Process 001" })).toBeVisible();
    expect(confirm).toHaveBeenCalledWith("Discard unsaved process or swimlane changes?");
  });
});
