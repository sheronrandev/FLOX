// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { themePresets } from "../domain/app-theme";
import { createDiagram } from "../domain/diagram";
import { defaultExportPreferences } from "../domain/preferences";
import type { ProjectRepository } from "../persistence/project-repository";
import { useDiagramStore } from "../store/diagram-store";
import { EditorToolbar } from "./EditorToolbar";

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

  afterEach(cleanup);

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
});
