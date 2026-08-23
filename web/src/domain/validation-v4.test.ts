import { describe, expect, it } from "vitest";
import { createDiagram } from "./diagram";
import { validateDiagram } from "./validation";

describe("per-process validation", () => {
  it("annotates findings with process ownership and enforces Decision and Merge cardinality", () => {
    const document = createDiagram("Canvas");
    const process = document.processes[0];
    process.name = "Claims review";
    process.lanes.push({ id: "lane", name: "Reviewer", width: 320, colorIndex: 0 });
    process.nodes.push(
      { id: "activity", type: "activity", position: { x: 80, y: 80 }, label: "Evaluate", laneId: "lane" },
      { id: "decision", type: "decision", position: { x: 124, y: 168 }, label: "", laneId: "lane" },
      { id: "merge", type: "merge", position: { x: 124, y: 340 }, label: "", laneId: "lane" },
    );
    process.edges.push({ id: "to-decision", type: "control-flow", sourceNodeId: "activity", sourceAnchorId: "bottom", targetNodeId: "decision", targetAnchorId: "top", guardLabel: "", routing: "automatic" });
    const findings = validateDiagram(document);
    expect(findings.find((finding) => finding.id.includes("decision-branches"))).toMatchObject({ processId: process.id, processName: "Claims review", nodeId: "decision" });
    expect(findings.some((finding) => finding.id.includes("merge-inputs"))).toBe(true);
    expect(findings.some((finding) => finding.id.includes("merge-output"))).toBe(true);
  });

  it("requires a swimlane before process nodes and checks fixed bounds independently", () => {
    const document = createDiagram("Canvas");
    const process = document.processes[0];
    process.nodes.push({ id: "orphan", type: "activity", position: { x: 0, y: 900 }, label: "Orphan", laneId: null });
    process.swimlaneLayout = { heightMode: "fixed", height: 320 };
    const ids = validateDiagram(document).map((finding) => finding.id);
    expect(ids).toContain(`${process.id}:missing-lane`);
    expect(ids).toContain(`${process.id}:swimlane-fixed-overflow`);
  });

  it("reports content beyond either horizontal side of the lane pool", () => {
    const document = createDiagram("Canvas");
    const process = document.processes[0];
    process.lanes.push({ id: "lane", name: "Actor", width: 320, colorIndex: 0 });
    process.nodes.push({ id: "left", type: "activity", position: { x: 0, y: 100 }, label: "Left", laneId: null });
    expect(validateDiagram(document).map((finding) => finding.id)).toContain(`${process.id}:swimlane-horizontal-overflow`);
  });
});
