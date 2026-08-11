// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { themePresets } from "../domain/app-theme";
import { createDiagram, parseDiagram } from "../domain/diagram";
import { defaultExportPreferences } from "../domain/preferences";
import type { ProjectRepository } from "../persistence/project-repository";
import { useDiagramStore } from "../store/diagram-store";
import { EditorToolbar } from "./EditorToolbar";

const downloadBlob = vi.hoisted(() => vi.fn());

vi.mock("../diagram/export-diagram", async (importOriginal) => {
  const original = await importOriginal<typeof import("../diagram/export-diagram")>();
  return { ...original, downloadBlob };
});

const repository: ProjectRepository = {
  async list() { return []; },
  async get() { return null; },
  async put(record) { return record; },
  async delete() { return undefined; },
};

function renderToolbar() {
  return render(
    <EditorToolbar
      collapsed={false}
      onCollapsedChange={() => undefined}
      theme={themePresets.light}
      onThemeChange={() => undefined}
      exportPreferences={defaultExportPreferences}
      currentProjectId="project"
      repository={repository}
      workspaceCount={1}
    />,
  );
}

async function readJsonBlob(blob: Blob): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(JSON.parse(String(reader.result)));
    reader.readAsText(blob);
  });
}

describe("editor process and swimlane manager", () => {
  beforeEach(() => {
    downloadBlob.mockReset();
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

  it("distinguishes process and lane actions and announces a lane reorder", () => {
    renderToolbar();

    expect(screen.getByRole("button", { name: "Process settings for Order approval" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Lane settings for User" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Show Order approval on canvas" })).toHaveTextContent("Show on canvas");

    const process = screen.getByRole("region", { name: "Order approval" });
    expect(within(process).getByText("Swimlanes")).toBeVisible();
    expect(within(process).getByText("2")).toBeVisible();
    expect(within(process).getByRole("list", { name: "Order approval swimlanes" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Move User swimlane right" }));
    expect(screen.getByRole("status", { name: "Swimlane update" })).toHaveTextContent("User swimlane moved to position 2 of 2.");
  });

  it("enables moving a selection only for a different process with a lane", async () => {
    renderToolbar();
    const trigger = screen.getByRole("button", { name: "More actions for Fulfillment" });

    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Move selection to this process" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());

    useDiagramStore.setState({ selectedNodeIds: ["node-request"] });
    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Move selection to this process" })).toBeEnabled();
  });

  it("returns focus to process settings when its editor is canceled", async () => {
    renderToolbar();
    const trigger = screen.getByRole("button", { name: "Process settings for Order approval" });
    fireEvent.click(trigger);
    expect(screen.getByLabelText("Process name")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Process name")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("returns focus to Add process after deleting a process", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderToolbar();

    fireEvent.click(screen.getByRole("button", { name: "More actions for Fulfillment" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete process" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Add process" })).toHaveFocus());
    expect(screen.queryByRole("region", { name: "Fulfillment" })).not.toBeInTheDocument();
  });

  it("returns focus to the process menu when deletion is canceled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderToolbar();
    const trigger = screen.getByRole("button", { name: "More actions for Fulfillment" });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete process" }));

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole("region", { name: "Fulfillment" })).toBeVisible();
  });

  it("passes the store active process to selected JSON export", async () => {
    useDiagramStore.setState({ activeProcessId: "process-fulfillment" });
    renderToolbar();

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Export diagrams" })).getByRole("button", { name: "Export JSON" }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, filename] = downloadBlob.mock.calls[0] as [Blob, string];
    const exported = parseDiagram(await readJsonBlob(blob));
    expect(filename).toBe("Order-approval-002.json");
    expect(exported.processes).toHaveLength(1);
    expect(exported.processes[0].id).toBe("process-fulfillment");
  });
});
