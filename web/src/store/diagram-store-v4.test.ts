import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore } from "./diagram-store";

beforeEach(() => useDiagramStore.getState().reset());

describe("nested process store", () => {
  it("creates and activates a process below existing bounds", () => {
    const first = useDiagramStore.getState().document.processes[0];
    useDiagramStore.getState().addProcess("Second process");
    const state = useDiagramStore.getState();
    expect(state.document.processes).toHaveLength(2);
    expect(state.activeProcessId).toBe(state.document.processes[1].id);
    expect(state.document.processes[1].position.y).toBe(first.position.y + 160);
  });

  it("requires an active process lane and creates a Decision pair atomically", () => {
    const store = useDiagramStore.getState();
    store.addNode("activity");
    expect(useDiagramStore.getState().document.processes[0].nodes).toHaveLength(0);
    store.addLane();
    store.addNode("decision", { x: 200, y: 180 });
    const state = useDiagramStore.getState();
    expect(state.document.processes[0].nodes.map((node) => node.type)).toEqual(["activity", "decision"]);
    expect(state.document.processes[0].nodes[1]).toMatchObject({ label: "", position: { x: 244, y: 268 } });
    expect(state.document.processes[0].edges).toHaveLength(1);
    expect(state.selectedNodeIds).toEqual([state.document.processes[0].nodes[0].id]);
    expect(state.past).toHaveLength(2);
  });

  it("blocks cross-process connectors", () => {
    const store = useDiagramStore.getState();
    store.addLane(); store.addNode("activity");
    const source = useDiagramStore.getState().document.processes[0].nodes[0].id;
    store.addProcess("Second"); store.addLane(); store.addNode("activity");
    const target = useDiagramStore.getState().document.processes[1].nodes[0].id;
    useDiagramStore.getState().connect({ source, target, sourceHandle: "right", targetHandle: "left" });
    expect(useDiagramStore.getState().document.processes.flatMap((process) => process.edges)).toHaveLength(0);
  });

  it("moves a process as one undoable keyboard gesture", () => {
    const id = useDiagramStore.getState().document.processes[0].id;
    useDiagramStore.getState().beginGesture();
    useDiagramStore.getState().moveProcess(id, { x: 8, y: 0 });
    useDiagramStore.getState().moveProcess(id, { x: 16, y: 0 });
    useDiagramStore.getState().endGesture();
    expect(useDiagramStore.getState().past).toHaveLength(1);
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().document.processes[0].position).toEqual({ x: 0, y: 0 });
  });

  it("separates process frames that overlap at the end of a drag", () => {
    const store = useDiagramStore.getState();
    store.addProcess("Second process");
    const [first, second] = useDiagramStore.getState().document.processes;

    store.beginGesture();
    store.moveProcess(second.id, first.position);
    store.endGesture();

    const positions = useDiagramStore.getState().document.processes.map((process) => process.position);
    expect(positions[1]).not.toEqual(positions[0]);
  });

  it("cascades process deletion as one commit and restores it with undo", () => {
    const confirm = vi.fn(() => true);
    useDiagramStore.getState().addProcess("Second");
    const id = useDiagramStore.getState().activeProcessId!;
    useDiagramStore.getState().removeProcess(id, confirm);
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/0 lanes, 0 nodes, and 0 connectors/i));
    expect(useDiagramStore.getState().document.processes).toHaveLength(1);
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().document.processes).toHaveLength(2);
  });

  it("stacks disconnected nodes vertically inside the active lane", () => {
    const store = useDiagramStore.getState();
    store.addLane();
    store.addNode("activity"); store.addNode("state"); store.addNode("note");
    store.autoArrange();
    const nodes = useDiagramStore.getState().document.processes[0].nodes;
    expect(new Set(nodes.map((node) => node.position.y)).size).toBe(3);
    expect(nodes.every((node) => node.position.x < 320)).toBe(true);
  });

  it("blocks boundary-breaking moves and moves a closed selection atomically", () => {
    const store = useDiagramStore.getState();
    store.addLane();
    store.addNode("activity", { x: 80, y: 100 }); store.addNode("activity", { x: 80, y: 220 }); store.addNode("activity", { x: 80, y: 340 });
    const [a, b, c] = useDiagramStore.getState().document.processes[0].nodes;
    store.connect({ source: a.id, sourceHandle: "bottom", target: b.id, targetHandle: "top" });
    store.connect({ source: b.id, sourceHandle: "bottom", target: c.id, targetHandle: "top" });
    store.addProcess("Target"); store.addLane();
    const targetId = useDiagramStore.getState().activeProcessId!;
    store.setSelection([a.id, b.id], []);
    expect(store.moveSelectedToProcess(targetId)).toBe(false);
    useDiagramStore.getState().removeEdges([useDiagramStore.getState().document.processes[0].edges[1].id]);
    expect(useDiagramStore.getState().moveSelectedToProcess(targetId)).toBe(true);
    expect(useDiagramStore.getState().document.processes[1]).toMatchObject({ nodes: [{ laneId: expect.any(String) }, { laneId: expect.any(String) }], edges: [{ sourceNodeId: a.id, targetNodeId: b.id }] });
  });

  it("pastes copied internal layout and edges into another active process", () => {
    const store = useDiagramStore.getState();
    store.addLane(); store.addNode("activity", { x: 80, y: 100 }); store.addNode("activity", { x: 80, y: 220 });
    const [a, b] = useDiagramStore.getState().document.processes[0].nodes;
    store.connect({ source: a.id, sourceHandle: "bottom", target: b.id, targetHandle: "top" });
    store.setSelection([a.id, b.id], []); store.copySelection();
    store.addProcess("Target"); store.addLane(); store.paste();
    const target = useDiagramStore.getState().document.processes[1];
    expect(target.nodes).toHaveLength(2); expect(target.edges).toHaveLength(1);
    expect(target.nodes.every((node) => node.laneId === target.lanes[0].id)).toBe(true);
    expect(target.edges[0]).toMatchObject({ sourceNodeId: target.nodes[0].id, targetNodeId: target.nodes[1].id });
  });
});
