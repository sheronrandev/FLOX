import { describe, expect, it } from "vitest";
import { createDiagram, importDiagram, parseDiagram } from "./diagram";

const now = "2026-08-11T00:00:00.000Z";

function v3Document() {
  return {
    format: "activity-diagram",
    version: 3,
    metadata: { title: "Claims canvas", createdAt: now, updatedAt: now },
    lanes: [{ id: "lane-a", name: "Reviewer", width: 260, colorIndex: 0 }],
    nodes: [
      { id: "source", type: "activity", position: { x: 40, y: 80 }, label: "Receive", laneId: "lane-a" },
      { id: "choice", type: "decision", position: { x: 240, y: 180 }, label: "Approved?", laneId: "lane-a" },
      { id: "target", type: "activity", position: { x: 420, y: 300 }, label: "Pay", laneId: "lane-a" },
    ],
    edges: [
      { id: "incoming", type: "control-flow", sourceNodeId: "source", sourceAnchorId: "right", targetNodeId: "choice", targetAnchorId: "left", guardLabel: "", routing: "automatic" },
      { id: "outgoing", type: "control-flow", sourceNodeId: "choice", sourceAnchorId: "right", targetNodeId: "target", targetAnchorId: "left", guardLabel: "yes", routing: "automatic", style: { dash: "dotted" } },
    ],
    swimlaneLayout: { heightMode: "automatic", height: 760 },
    appearance: createDiagram().appearance,
  };
}

describe("v4 nested activity processes", () => {
  it("creates a v4 canvas with one independently named empty process", () => {
    const document = createDiagram("Claims canvas");
    expect(document).toMatchObject({
      version: 4,
      metadata: { title: "Claims canvas" },
      processes: [{ name: "Claims canvas", position: { x: 0, y: 0 }, lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 } }],
    });
    expect(document.processes[0].id).toBeTruthy();
  });

  it("migrates v3 into one process and deterministically expands a labelled Decision", () => {
    const first = importDiagram(v3Document());
    const second = importDiagram(v3Document());
    expect(first).toEqual(second);
    expect(first.version).toBe(4);
    expect(first.processes).toHaveLength(1);
    expect(first.processes[0].name).toBe("Claims canvas");

    const process = first.processes[0];
    const decision = process.nodes.find((node) => node.id === "choice");
    const activity = process.nodes.find((node) => node.id === "choice-decision-activity");
    expect(decision).toMatchObject({ type: "decision", label: "", position: { x: 260, y: 200 } });
    expect(activity).toMatchObject({ type: "activity", label: "Approved?", position: { x: 216, y: 112 }, laneId: "lane-a" });
    expect(process.edges.find((edge) => edge.id === "incoming")?.targetNodeId).toBe(activity?.id);
    expect(process.edges.find((edge) => edge.id === "choice-decision-flow")).toMatchObject({
      sourceNodeId: activity?.id,
      targetNodeId: "choice",
      sourceAnchorId: "bottom",
      targetAnchorId: "top",
    });
    expect(process.edges.find((edge) => edge.id === "outgoing")).toMatchObject({ guardLabel: "yes", style: { dash: "dotted" } });
  });

  it("uses collision-safe deterministic IDs and fallback decision copy", () => {
    const legacy = v3Document();
    legacy.nodes[1].label = "";
    legacy.nodes.push({ id: "choice-decision-activity", type: "activity", position: { x: 0, y: 0 }, label: "Existing", laneId: "lane-a" });
    legacy.edges.push({ id: "choice-decision-flow", type: "control-flow", sourceNodeId: "source", sourceAnchorId: "bottom", targetNodeId: "target", targetAnchorId: "top", guardLabel: "", routing: "automatic" });
    const process = importDiagram(legacy).processes[0];
    expect(process.nodes.find((node) => node.id === "choice-decision-activity-2")?.label).toBe("Evaluate condition");
    expect(process.edges.some((edge) => edge.id === "choice-decision-flow-2")).toBe(true);
  });

  it("rejects duplicate IDs across processes and references outside process ownership", () => {
    const document = createDiagram("Canvas");
    const baseProcess = document.processes[0];
    baseProcess.lanes.push({ id: "lane-1", name: "One", width: 260, colorIndex: 0 });
    baseProcess.nodes.push({ id: "node-1", type: "activity", position: { x: 20, y: 80 }, label: "One", laneId: "lane-1" });
    document.processes.push({
      id: "process-2",
      name: "Second",
      position: { x: 0, y: 1000 },
      lanes: [{ id: "lane-2", name: "Two", width: 260, colorIndex: 1 }],
      nodes: [{ id: "node-2", type: "activity", position: { x: 20, y: 80 }, label: "Two", laneId: "lane-2" }],
      edges: [{ id: "edge-cross", type: "control-flow", sourceNodeId: "node-1", sourceAnchorId: "bottom", targetNodeId: "node-2", targetAnchorId: "top", guardLabel: "", routing: "automatic" }],
      swimlaneLayout: { heightMode: "automatic", height: 760 },
    });
    expect(() => parseDiagram(document)).toThrow(/missing node|process boundary/i);
    document.processes[1].edges = [];
    document.processes[1].nodes[0].id = "node-1";
    expect(() => parseDiagram(document)).toThrow(/duplicate id/i);
  });

  it("rejects labelled Decision diamonds and more than 100 processes", () => {
    const document = createDiagram("Canvas");
    document.processes[0].nodes.push({ id: "decision", type: "decision", position: { x: 0, y: 0 }, label: "No text", laneId: null });
    expect(() => parseDiagram(document)).toThrow(/decision.*label/i);

    const empty = document.processes[0];
    document.processes = Array.from({ length: 101 }, (_, index) => ({ ...empty, id: `process-${index}`, name: `Process ${index}`, nodes: [] }));
    expect(() => parseDiagram(document)).toThrow();
  });

  it("rejects export-shaped serialized documents with blank process names or lane references", () => {
    const exported = createDiagram("Claims");
    exported.processes[0].lanes.push({ id: "lane-a", name: "Owner", width: 260, colorIndex: 0 });
    exported.processes[0].nodes.push({ id: "node-a", type: "activity", position: { x: 0, y: 0 }, label: "Receive", laneId: "lane-a" });
    const serialized = JSON.stringify(exported);

    const blankProcess = JSON.parse(serialized);
    blankProcess.processes[0].name = "   ";
    expect(() => parseDiagram(blankProcess)).toThrow();

    const blankLaneReference = JSON.parse(serialized);
    blankLaneReference.processes[0].nodes[0].laneId = "";
    expect(() => parseDiagram(blankLaneReference)).toThrow();
  });

  it("rejects an export-shaped serialized document with a whitespace-only metadata title", () => {
    const exported = JSON.parse(JSON.stringify(createDiagram("Claims")));
    exported.metadata.title = "   ";

    expect(() => parseDiagram(exported)).toThrow();
  });

  it("rejects malformed and unknown legacy notation instead of coercing it", () => {
    const malformed = v3Document();
    malformed.nodes = [null] as never;
    expect(() => importDiagram(malformed)).toThrow();
    const unknown = v3Document();
    unknown.nodes[0].type = "mystery";
    expect(() => importDiagram(unknown)).toThrow();
    const extra = v3Document();
    (extra.nodes[0] as unknown as Record<string, unknown>).script = "not allowed";
    expect(() => importDiagram(extra)).toThrow();
    const oldAlias = v3Document();
    oldAlias.nodes[0].type = "start";
    expect(() => importDiagram(oldAlias)).toThrow();
    const v1WithModernType = { ...v3Document(), version: 1, nodes: [{ id: "modern", type: "state", position: { x: 0, y: 0 }, label: "State", laneId: null }], edges: [], lanes: [] };
    delete (v1WithModernType as Partial<typeof v1WithModernType>).swimlaneLayout;
    expect(() => importDiagram(v1WithModernType)).toThrow();
  });
});
