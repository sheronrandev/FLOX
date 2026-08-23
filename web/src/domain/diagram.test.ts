import { describe, expect, it } from "vitest";
import { createDiagram, defaultDiagramAppearance, importDiagram, parseDiagram, serializeDiagram } from "./diagram";

describe("diagram document", () => {
  it("uses black as the default color for control and object flows", () => {
    expect(defaultDiagramAppearance.controlFlowColor).toBe("#000000");
    expect(defaultDiagramAppearance.objectFlowColor).toBe("#000000");
  });

  it("round-trips a valid v4 document", () => {
    const document = createDiagram("Review flow");
    expect(parseDiagram(JSON.parse(serializeDiagram(document)))).toEqual(document);
  });

  it("adds project typography defaults when opening an older v4 document", () => {
    const stored = JSON.parse(serializeDiagram(createDiagram("Older project")));
    delete stored.appearance.nodeFontSize;
    delete stored.appearance.nodeInnerPadding;

    expect(parseDiagram(stored).appearance).toMatchObject({ nodeFontSize: 12, nodeInnerPadding: 12 });
  });

  it("rejects dangling and cross-process edges", () => {
    const document = createDiagram();
    document.processes[0].edges.push({
      id: "edge-1", type: "control-flow", sourceNodeId: "missing-a", sourceAnchorId: "right",
      targetNodeId: "missing-b", targetAnchorId: "left", guardLabel: "", routing: "automatic",
    });
    expect(() => parseDiagram(document)).toThrow(/missing node/i);
  });

  it("rejects unsafe and type-incompatible values", () => {
    const document = createDiagram();
    document.processes[0].nodes.push({
      id: "node-1", type: "activity", position: { x: 10, y: 10 }, label: "Safe", laneId: null,
      style: { fill: "url(https://example.invalid/tracker)" },
    });
    expect(() => parseDiagram(document)).toThrow();
  });

  it("migrates original coordinates, endpoints, and start notation into one process", () => {
    const migrated = importDiagram({
      title: "Legacy review",
      nodes: [
        { id: "n1", type: "start", x: 20, y: 30, label: "Start" },
        { id: "n2", type: "activity", x: 200, y: 30, label: "Review" },
      ],
      edges: [{ id: "e1", from: "n1", to: "n2", label: "" }], lanes: [],
    });
    const process = migrated.processes[0];
    expect(process.name).toBe("Legacy review");
    expect(process.nodes[0]).toMatchObject({ type: "initial", position: { x: 20, y: 30 } });
    expect(process.edges[0]).toMatchObject({ sourceAnchorId: "right", targetAnchorId: "left" });
    expect(migrated.version).toBe(4);
    expect(process.swimlaneLayout).toEqual({ heightMode: "fixed", height: 760 });
  });

  it("migrates v1 connector labels and styles", () => {
    const now = new Date().toISOString();
    const migrated = importDiagram({
      format: "activity-diagram", version: 1,
      metadata: { title: "Legacy", createdAt: now, updatedAt: now },
      nodes: [
        { id: "a", type: "start", position: { x: 0, y: 0 }, label: "", laneId: null, style: { fill: "#123456" } },
        { id: "b", type: "end", position: { x: 0, y: 100 }, label: "", laneId: null },
      ],
      edges: [{ id: "e", type: "control-flow", sourceNodeId: "a", sourceAnchorId: "bottom", targetNodeId: "b", targetAnchorId: "top", label: "[ok]", routing: "automatic", style: { dash: "dotted" } }],
      lanes: [], appearance: createDiagram().appearance,
    });
    const process = migrated.processes[0];
    expect(process.nodes.map((node) => node.type)).toEqual(["initial", "final"]);
    expect(process.nodes[0].style?.fill).toBe("#123456");
    expect(process.edges[0]).toMatchObject({ guardLabel: "[ok]", style: { dash: "dotted" } });
  });

  it("creates a named v4 process with automatic height", () => {
    const document = createDiagram("New process");
    expect(document).toMatchObject({ version: 4, processes: [{ name: "New process", swimlaneLayout: { heightMode: "automatic", height: 760 } }] });
  });

  it("keeps structured fields on matching notation types only", () => {
    const document = createDiagram();
    document.processes[0].nodes.push(
      { id: "object", type: "object-in-state", position: { x: 0, y: 0 }, label: "Order", state: "Approved", laneId: null },
      { id: "constraint", type: "constraint", position: { x: 200, y: 0 }, label: "Limit", body: "Total < 100", laneId: null },
    );
    expect(parseDiagram(document).processes[0].nodes).toHaveLength(2);
    document.processes[0].nodes[0].body = "not allowed";
    expect(() => parseDiagram(document)).toThrow(/Body is only valid/i);
  });

  it("rejects unknown fields and documents beyond the total node limit", () => {
    expect(() => parseDiagram({ ...createDiagram(), script: "alert(1)" })).toThrow();
    const oversized = createDiagram();
    oversized.processes[0].nodes = Array.from({ length: 5_001 }, (_, index) => ({
      id: `n-${index}`, type: "activity" as const, position: { x: 0, y: index }, label: "Node", laneId: null,
    }));
    expect(() => parseDiagram(oversized)).toThrow();
  });
});
