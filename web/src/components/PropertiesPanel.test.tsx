// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDiagram } from "../domain/diagram";
import { useDiagramStore } from "../store/diagram-store";
import { PropertiesPanel } from "./PropertiesPanel";

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("properties panel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const document = createDiagram();
    document.processes[0].nodes.push({ id: "node", type: "activity", position: { x: 0, y: 0 }, label: "Review", laneId: null });
    useDiagramStore.setState({
      document,
      past: [],
      future: [],
      gestureStart: null,
      selectedNodeIds: ["node"],
      selectedEdgeIds: [],
      propertiesDirty: false,
      clipboard: null,
    });
    container = window.document.createElement("div");
    window.document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await act(async () => root.unmount());
    container.remove();
  });

  it("stages edits until Save and commits them as one undo entry", async () => {
    await act(async () => root.render(<PropertiesPanel />));
    const label = container.querySelector<HTMLInputElement>('input[maxlength="500"]')!;
    await act(async () => changeInput(label, "Approve order"));
    expect(useDiagramStore.getState().document.processes[0].nodes[0].label).toBe("Review");
    expect(useDiagramStore.getState().propertiesDirty).toBe(true);

    const save = [...container.querySelectorAll("button")].find((button) => button.textContent === "Save")!;
    await act(async () => save.click());
    expect(useDiagramStore.getState().document.processes[0].nodes[0].label).toBe("Approve order");
    expect(useDiagramStore.getState().past).toHaveLength(1);
  });

  it("shows monochrome defaults until the user selects custom colors", async () => {
    await act(async () => root.render(<PropertiesPanel />));
    const colors = [...container.querySelectorAll<HTMLInputElement>('input[type="color"]')];
    expect(colors.map((input) => input.value)).toEqual(["#ffffff", "#000000", "#000000"]);
  });

  it("shows black as the default flow and guard-label color", async () => {
    const document = createDiagram();
    document.processes[0].nodes = [
      { id: "source", type: "activity", position: { x: 0, y: 0 }, label: "Source", laneId: null },
      { id: "target", type: "activity", position: { x: 200, y: 0 }, label: "Target", laneId: null },
    ];
    document.processes[0].edges = [{ id: "edge", type: "control-flow", sourceNodeId: "source", sourceAnchorId: "right", targetNodeId: "target", targetAnchorId: "left", guardLabel: "approved", routing: "automatic" }];
    useDiagramStore.setState({ document, selectedNodeIds: [], selectedEdgeIds: ["edge"] });

    await act(async () => root.render(<PropertiesPanel />));

    expect(container.querySelector<HTMLInputElement>('input[type="color"]')?.value).toBe("#000000");
  });

  it("confirms before closing a dirty form", async () => {
    await act(async () => root.render(<PropertiesPanel />));
    const label = container.querySelector<HTMLInputElement>('input[maxlength="500"]')!;
    await act(async () => changeInput(label, "Unsaved"));
    const close = container.querySelector<HTMLButtonElement>('button[aria-label="Close properties"]')!;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await act(async () => close.click());
    expect(useDiagramStore.getState().selectedNodeIds).toEqual(["node"]);
    confirm.mockReturnValue(true);
    await act(async () => close.click());
    expect(useDiagramStore.getState().selectedNodeIds).toEqual([]);
  });
});
