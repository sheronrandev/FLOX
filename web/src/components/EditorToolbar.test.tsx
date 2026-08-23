// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDiagram } from "../domain/diagram";
import { useDiagramStore } from "../store/diagram-store";
import { EditorToolbar } from "./EditorToolbar";

function renderToolbar() {
  return render(
    <EditorToolbar
      collapsed={false}
      onCollapsedChange={() => undefined}
    />,
  );
}

describe("editor process and swimlane manager", () => {
  beforeEach(() => {
    const document = createDiagram("Order approval");
    const source = document.processes[0];
    source.lanes = [
      { id: "lane-user", name: "User", width: 320, colorIndex: 0 },
      { id: "lane-manager", name: "Manager", width: 320, colorIndex: 1 },
    ];
    source.nodes = [{ id: "node-request", type: "activity", position: { x: 80, y: 110 }, label: "Submit request", laneId: "lane-user" }];
    document.processes.push({
      id: "process-fulfillment",
      name: "Fulfillment",
      position: { x: 0, y: 900 },
      lanes: [{ id: "lane-operations", name: "Operations", width: 320, colorIndex: 0 }],
      nodes: [],
      edges: [],
      swimlaneLayout: { heightMode: "automatic", height: 760 },
    });
    useDiagramStore.setState({
      document,
      past: [],
      future: [],
      gestureStart: null,
      activeProcessId: source.id,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      propertiesDirty: false,
      clipboard: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

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
});
