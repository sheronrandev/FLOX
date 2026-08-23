import { describe, expect, it } from "vitest";
import { createDiagram } from "./diagram";
import { areConnectionHandlesAvailable, canConnectNodes, flattenProcesses, getCanvasBounds, layoutOverlappingProcesses, localToCanvasPosition, occupiedExclusiveAnchors, processAtNode } from "./process-layout";

describe("nested process geometry", () => {
  it("flattens local node positions into absolute canvas positions and retains ownership", () => {
    const document = createDiagram("Canvas");
    const process = document.processes[0];
    process.position = { x: 300, y: 500 };
    process.lanes.push({ id: "lane", name: "Owner", width: 260, colorIndex: 0 });
    process.nodes.push({ id: "node", type: "activity", position: { x: 40, y: 90 }, label: "Review", laneId: "lane" });
    const flat = flattenProcesses(document);
    expect(flat.nodes[0]).toMatchObject({ id: "node", position: { x: 348, y: 590 }, processId: process.id });
    expect(localToCanvasPosition(process, { x: 10, y: 20 })).toEqual({ x: 310, y: 520 });
    expect(processAtNode(document, "node")?.id).toBe(process.id);
  });

  it("unions process pool and node extents across the whole canvas", () => {
    const document = createDiagram("Canvas");
    const first = document.processes[0];
    first.lanes.push({ id: "lane-1", name: "One", width: 320, colorIndex: 0 });
    document.processes.push({ id: "process-2", name: "Two", position: { x: 900, y: 1200 }, lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 } });
    expect(getCanvasBounds(document)).toMatchObject({ minX: 40, minY: -10, maxX: 1260, maxY: 1230 });
  });

  it("places overlapping imported processes into a 10-column grid", () => {
    const document = createDiagram("Canvas");
    document.processes = Array.from({ length: 12 }, (_, index) => ({
      ...document.processes[0], id: `process-${index + 1}`, name: `Process ${index + 1}`, position: { x: 0, y: 0 },
    }));

    const arranged = layoutOverlappingProcesses(document);
    const positions = arranged.processes.map((process) => process.position);

    expect(positions[0]).toEqual({ x: 0, y: 0 });
    expect(positions[1].x).toBeGreaterThan(positions[0].x);
    expect(positions[9].y).toBe(positions[0].y);
    expect(positions[10].x).toBe(positions[0].x);
    expect(positions[10].y).toBeGreaterThan(positions[0].y);
    expect(new Set(positions.map(({ x, y }) => `${x}:${y}`))).toHaveLength(12);
  });

  it("preserves process positions when imported diagrams are already separate", () => {
    const document = createDiagram("Canvas");
    document.processes.push({ ...document.processes[0], id: "process-2", name: "Two", position: { x: 1_000, y: 0 } });

    expect(layoutOverlappingProcesses(document)).toBe(document);
  });

  it("accepts only distinct nodes owned by the same process", () => {
    const document = createDiagram("Canvas");
    document.processes[0].nodes.push(
      { id: "one", type: "activity", position: { x: 0, y: 0 }, label: "One", laneId: null },
      { id: "two", type: "activity", position: { x: 0, y: 100 }, label: "Two", laneId: null },
    );
    document.processes.push({ id: "second", name: "Second", position: { x: 500, y: 0 }, lanes: [], nodes: [{ id: "three", type: "activity", position: { x: 0, y: 0 }, label: "Three", laneId: null }], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 } });
    expect(canConnectNodes(document, "one", "two")).toBe(true);
    expect(canConnectNodes(document, "one", "one")).toBe(false);
    expect(canConnectNodes(document, "one", "three")).toBe(false);
  });

  it("reserves occupied decision and merge handles without restricting ordinary nodes", () => {
    const document = createDiagram("Canvas");
    const process = document.processes[0];
    process.nodes.push(
      { id: "decision", type: "decision", position: { x: 0, y: 0 }, label: "", laneId: null },
      { id: "merge", type: "merge", position: { x: 0, y: 100 }, label: "", laneId: null },
      { id: "one", type: "activity", position: { x: 0, y: 200 }, label: "One", laneId: null },
      { id: "two", type: "activity", position: { x: 0, y: 300 }, label: "Two", laneId: null },
    );
    process.edges.push(
      { id: "decision-flow", type: "control-flow", sourceNodeId: "decision", sourceAnchorId: "right", targetNodeId: "one", targetAnchorId: "left", guardLabel: "[yes]", routing: "automatic" },
      { id: "merge-flow", type: "control-flow", sourceNodeId: "two", sourceAnchorId: "bottom", targetNodeId: "merge", targetAnchorId: "left", guardLabel: "", routing: "automatic" },
    );

    expect(occupiedExclusiveAnchors(document, "decision")).toEqual(new Set(["right"]));
    expect(occupiedExclusiveAnchors(document, "merge")).toEqual(new Set(["left"]));
    expect(occupiedExclusiveAnchors(document, "one")).toEqual(new Set());
    expect(areConnectionHandlesAvailable(document, "decision", "right", "two", "top")).toBe(false);
    expect(areConnectionHandlesAvailable(document, "decision", "bottom", "two", "top")).toBe(true);
    expect(areConnectionHandlesAvailable(document, "one", "left", "merge", "left")).toBe(false);
    expect(areConnectionHandlesAvailable(document, "one", "left", "two", "top")).toBe(true);
  });
});
