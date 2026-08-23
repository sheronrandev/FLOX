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
    document.processes[0].lanes = [
      {
        id: "lane",
        name: "Factory Supervisory and Production Control",
        width: 320,
        colorIndex: 0,
      },
    ];
    useDiagramStore.setState({
      document,
      activeProcessId: document.processes[0].id,
      past: [],
      future: [],
    });
  });

  afterEach(cleanup);

  it("renders only the selected process lanes and stages lane changes", () => {
    const process = useDiagramStore.getState().document.processes[0];
    const onDirtyChange = vi.fn();

    render(
      <ProcessLanePanel
        process={process}
        sequence="001"
        readOnly={false}
        editRequestId={null}
        onConsumeEditRequest={() => undefined}
        onShowOnCanvas={() => undefined}
        onDirtyChange={onDirtyChange}
        onAnnouncement={() => undefined}
      />,
    );

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

    render(
      <ProcessLanePanel
        process={process}
        sequence="001"
        readOnly
        editRequestId={null}
        onConsumeEditRequest={() => undefined}
        onShowOnCanvas={() => undefined}
        onDirtyChange={() => undefined}
        onAnnouncement={() => undefined}
      />,
    );

    expect(screen.getByText(process.lanes[0].name)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add swimlane" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lane settings/ })).not.toBeInTheDocument();
  });
});
