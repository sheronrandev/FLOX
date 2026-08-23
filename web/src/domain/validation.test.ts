import { describe, expect, it } from "vitest";
import { createDiagram } from "./diagram";
import { validateDiagram } from "./validation";

describe("diagram validation", () => {
  it("reports missing initial and final nodes", () => {
    const ids = validateDiagram(createDiagram()).map((finding) => finding.id);
    expect(ids.some((id) => id.endsWith(":missing-start"))).toBe(true);
    expect(ids.some((id) => id.endsWith(":missing-final"))).toBe(true);
  });

  it("accepts a connected start-to-final flow", () => {
    const document = createDiagram();
    document.processes[0].lanes = [{ id: "lane", name: "Actor", width: 320, colorIndex: 0 }];
    document.processes[0].nodes = [
      { id: "start", type: "initial", position: { x: 80, y: 80 }, label: "Start", laneId: "lane" },
      { id: "end", type: "final", position: { x: 80, y: 180 }, label: "End", laneId: "lane" },
    ];
    document.processes[0].edges = [{ id: "edge", type: "control-flow", sourceNodeId: "start", sourceAnchorId: "bottom", targetNodeId: "end", targetAnchorId: "top", guardLabel: "", routing: "automatic" }];
    expect(validateDiagram(document)).toEqual([]);
  });

  it("requires decision guards", () => {
    const document = createDiagram();
    document.processes[0].nodes = [
      { id: "d", type: "decision", position: { x: 0, y: 0 }, label: "", laneId: null },
      { id: "a", type: "activity", position: { x: 100, y: 0 }, label: "A", laneId: null },
      { id: "b", type: "activity", position: { x: 100, y: 100 }, label: "B", laneId: null },
    ];
    document.processes[0].edges = ["a", "b"].map((target, index) => ({ id: `e${index}`, type: "control-flow", sourceNodeId: "d", sourceAnchorId: "right", targetNodeId: target, targetAnchorId: "left", guardLabel: "", routing: "automatic" }));
    expect(validateDiagram(document).filter((finding) => finding.id.includes(":guard-"))).toHaveLength(2);
  });

  it("warns when content extends below a fixed swimlane frame", () => {
    const document = createDiagram();
    document.processes[0].swimlaneLayout = { heightMode: "fixed", height: 320 };
    document.processes[0].nodes = [{ id: "low", type: "activity", position: { x: 80, y: 400 }, label: "Below frame", laneId: null }];
    expect(validateDiagram(document)).toContainEqual(expect.objectContaining({ id: `${document.processes[0].id}:swimlane-fixed-overflow`, severity: "warning" }));
  });
});
