import { describe, expect, it } from "vitest";
import { createDiagram } from "../domain/diagram";
import { diagramToSvg } from "./export-diagram";

describe("multi-process SVG export", () => {
  it("renders every process pool, translated local nodes, connectors, and centered process titles", () => {
    const document = createDiagram("Workspace canvas");
    const first = document.processes[0];
    first.name = "Claims review";
    first.lanes.push({ id: "lane-a", name: "Reviewer", width: 320, colorIndex: 0 });
    first.nodes.push({ id: "a", type: "activity", position: { x: 80, y: 90 }, label: "Review", laneId: "lane-a" });
    document.processes.push({
      id: "process-b", name: "Payment", position: { x: 900, y: 1100 },
      lanes: [{ id: "lane-b", name: "Finance", width: 320, colorIndex: 1 }],
      nodes: [
        { id: "b", type: "activity", position: { x: 80, y: 90 }, label: "Pay", laneId: "lane-b" },
        { id: "c", type: "final", position: { x: 140, y: 220 }, label: "Done", laneId: "lane-b" },
      ],
      edges: [{ id: "flow", type: "control-flow", sourceNodeId: "b", sourceAnchorId: "bottom", targetNodeId: "c", targetAnchorId: "top", guardLabel: "complete", routing: "automatic" }],
      swimlaneLayout: { heightMode: "automatic", height: 760 },
    });
    const svg = diagramToSvg(document, false);
    expect(svg).toContain('data-process-id="process-b"');
    expect(svg).toContain("Claims review");
    expect(svg).toContain("Payment");
    expect(svg).toContain('x="980" y="1190"');
    expect(svg).toContain("complete");
  });

  it("paints every process title row when the canvas background is transparent", () => {
    const document = createDiagram("Transparent canvas");
    document.processes[0].name = "First process";
    document.processes.push({
      id: "process-b", name: "Second process", position: { x: 500, y: 0 },
      lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 },
    });

    const svg = diagramToSvg(document, true);
    const titleRows = svg.match(/<rect class="swimlane-title-row"[^>]*height="40"[^>]*fill="#fbfcfd"\/>/g);

    expect(titleRows).toHaveLength(2);
  });
});
