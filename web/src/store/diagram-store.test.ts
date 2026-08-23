import { beforeEach, describe, expect, it } from "vitest";
import { createDiagram } from "../domain/diagram";
import { useDiagramStore } from "./diagram-store";

const process = () => useDiagramStore.getState().document.processes[0];

describe("diagram store", () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useDiagramStore.getState().addLane();
  });

  it("adds structured notations to the active process", () => {
    useDiagramStore.getState().addNode("object-in-state", { x: 80, y: 120 });
    useDiagramStore.getState().addNode("constraint", { x: 220, y: 120 });
    expect(process().nodes).toMatchObject([
      { type: "object-in-state", label: "Object", state: "State" },
      { type: "constraint", label: "Constraint", body: "Constraint body" },
    ]);
  });

  it("applies node properties as one undoable command", () => {
    useDiagramStore.getState().addNode("state", { x: 80, y: 120 });
    const node = process().nodes[0];
    const before = useDiagramStore.getState().past.length;
    useDiagramStore.getState().updateNode(node.id, { label: "Approved", style: { fill: "#112233", stroke: "#445566", textColor: "#ffffff" } });
    expect(useDiagramStore.getState().past).toHaveLength(before + 1);
    expect(process().nodes[0]).toMatchObject({ label: "Approved", style: { fill: "#112233", stroke: "#445566", textColor: "#ffffff" } });
  });

  it("saves lane properties and shared height as one undoable command", () => {
    useDiagramStore.getState().addLane();
    const [first, second] = process().lanes;
    useDiagramStore.getState().addNode("activity", { x: first.width + 80, y: 100 });
    const beforeX = process().nodes[0].position.x;
    const beforeHistory = useDiagramStore.getState().past.length;
    useDiagramStore.getState().updateLaneSettings(first.id, { name: "Operations", fill: "#ddeeff", width: first.width + 80, heightMode: "fixed", height: 980 });
    expect(useDiagramStore.getState().past).toHaveLength(beforeHistory + 1);
    expect(process().lanes[0]).toMatchObject({ name: "Operations", width: first.width + 80, style: { fill: "#ddeeff" } });
    expect(process().swimlaneLayout).toEqual({ heightMode: "fixed", height: 980 });
    expect(process().nodes[0]).toMatchObject({ laneId: second.id, position: { x: beforeX + 80, y: 100 } });
  });

  it("stores connector anchors and blocks invalid imports", () => {
    useDiagramStore.getState().addNode("initial", { x: 80, y: 100 });
    useDiagramStore.getState().addNode("activity", { x: 220, y: 100 });
    const [source, target] = process().nodes;
    useDiagramStore.getState().connect({ source: source.id, sourceHandle: "right", target: target.id, targetHandle: "left" });
    expect(process().edges[0]).toMatchObject({ sourceAnchorId: "right", targetAnchorId: "left", routing: "automatic" });
    const before = useDiagramStore.getState().document;
    expect(() => useDiagramStore.getState().importDocument({ format: "foreign" })).toThrow();
    expect(useDiagramStore.getState().document).toBe(before);
  });

  it("separates overlapping processes during import", () => {
    const document = createDiagram("Imported");
    document.processes.push({ ...structuredClone(document.processes[0]), id: "process-2", name: "Second" });

    useDiagramStore.getState().importDocument(document);

    const [first, second] = useDiagramStore.getState().document.processes;
    expect(second.position).not.toEqual(first.position);
  });

  it("separates overlapping processes when reopening a saved project", () => {
    const document = createDiagram("Saved");
    document.processes.push({ ...structuredClone(document.processes[0]), id: "process-2", name: "Second" });

    useDiagramStore.getState().loadDocument(document);

    const [first, second] = useDiagramStore.getState().document.processes;
    expect(second.position).not.toEqual(first.position);
  });

  it("requires decision guards and prevents reusing decision or merge handles", () => {
    useDiagramStore.getState().addNode("decision", { x: 80, y: 100 });
    useDiagramStore.getState().addNode("merge", { x: 220, y: 260 });
    useDiagramStore.getState().addNode("activity", { x: 360, y: 100 });
    useDiagramStore.getState().addNode("activity", { x: 360, y: 260 });
    const decision = process().nodes.find((node) => node.type === "decision")!;
    const merge = process().nodes.find((node) => node.type === "merge")!;
    const targets = process().nodes.filter((node) => node.type === "activity").slice(-2);

    useDiagramStore.getState().connect({ source: decision.id, sourceHandle: "right", target: targets[0].id, targetHandle: "left" });
    expect(process().edges.filter((edge) => edge.sourceNodeId === decision.id)).toHaveLength(0);

    useDiagramStore.getState().connect({ source: decision.id, sourceHandle: "right", target: targets[0].id, targetHandle: "left" }, " [approved] ");
    useDiagramStore.getState().connect({ source: decision.id, sourceHandle: "right", target: targets[1].id, targetHandle: "left" }, "[rejected]");
    useDiagramStore.getState().connect({ source: decision.id, sourceHandle: "bottom", target: targets[1].id, targetHandle: "top" }, "[rejected]");
    expect(process().edges.filter((edge) => edge.sourceNodeId === decision.id)).toMatchObject([
      { sourceAnchorId: "right", guardLabel: "[approved]" },
      { sourceAnchorId: "bottom", guardLabel: "[rejected]" },
    ]);

    useDiagramStore.getState().connect({ source: targets[0].id, sourceHandle: "bottom", target: merge.id, targetHandle: "left" });
    useDiagramStore.getState().connect({ source: targets[1].id, sourceHandle: "bottom", target: merge.id, targetHandle: "left" });
    expect(process().edges.filter((edge) => edge.targetNodeId === merge.id && edge.targetAnchorId === "left")).toHaveLength(1);
  });

  it("undoes, redoes, and records drag gestures once", () => {
    useDiagramStore.getState().addNode("activity", { x: 80, y: 120 });
    const node = process().nodes[0];
    const before = useDiagramStore.getState().past.length;
    useDiagramStore.getState().beginGesture();
    useDiagramStore.getState().moveNode(node.id, { x: 100, y: 140 });
    useDiagramStore.getState().moveNode(node.id, { x: 140, y: 180 });
    useDiagramStore.getState().endGesture();
    expect(useDiagramStore.getState().past).toHaveLength(before + 1);
    useDiagramStore.getState().undo();
    expect(process().nodes[0].position).toEqual({ x: 80, y: 120 });
    useDiagramStore.getState().redo();
    expect(process().nodes[0].position).toEqual({ x: 140, y: 180 });
  });

  it("persists dragged nodes below the actor-name safety band", () => {
    useDiagramStore.getState().addNode("activity", { x: 80, y: 120 });
    const node = process().nodes[0];

    useDiagramStore.getState().moveNode(node.id, { x: 80, y: 0 });

    expect(process().nodes[0].position).toEqual({ x: 80, y: 86 });
  });

  it("keeps lane ownership while reordering and clears it when removed", () => {
    useDiagramStore.getState().addLane();
    const [first, second] = process().lanes;
    useDiagramStore.getState().addNode("activity", { x: 80, y: 100 });
    const beforeX = process().nodes[0].position.x;
    useDiagramStore.getState().moveLane(first.id, 1);
    expect(process().lanes.map((lane) => lane.id)).toEqual([second.id, first.id]);
    expect(process().nodes[0]).toMatchObject({ laneId: first.id, position: { x: beforeX + second.width, y: 100 } });
    useDiagramStore.getState().removeLane(first.id);
    expect(process().nodes[0].laneId).toBeNull();
  });

  it("duplicates selected nodes with fresh ids and can undo", () => {
    useDiagramStore.getState().addNode("activity", { x: 80, y: 120 });
    const original = process().nodes[0];
    useDiagramStore.getState().setSelection([original.id], []);
    useDiagramStore.getState().duplicateSelection();
    expect(process().nodes).toHaveLength(2);
    expect(process().nodes[1].id).not.toBe(original.id);
    useDiagramStore.getState().undo();
    expect(process().nodes).toHaveLength(1);
  });

  it("does not publish state for an unchanged selection", () => {
    const before = useDiagramStore.getState();
    useDiagramStore.getState().setSelection([], []);
    expect(useDiagramStore.getState()).toBe(before);
  });

  it("auto-arranges the active process as one command", () => {
    useDiagramStore.getState().addNode("initial", { x: 500, y: 500 });
    useDiagramStore.getState().addNode("activity", { x: 80, y: 120 });
    const [source, target] = process().nodes;
    useDiagramStore.getState().connect({ source: source.id, sourceHandle: "bottom", target: target.id, targetHandle: "top" });
    const before = process().nodes.map((node) => node.position);
    useDiagramStore.getState().autoArrange();
    expect(process().nodes[1].position.y).toBeGreaterThan(process().nodes[0].position.y);
    useDiagramStore.getState().undo();
    expect(process().nodes.map((node) => node.position)).toEqual(before);
  });

  it("resets to a valid empty v4 process", () => {
    useDiagramStore.getState().loadDocument(createDiagram("Clean"));
    expect(process()).toMatchObject({ name: "Clean", lanes: [], nodes: [], edges: [] });
  });
});
