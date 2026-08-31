import { describe, expect, it } from "vitest";
import { createDiagram } from "./diagram";
import { getProcessTitleLayout, getSwimlanePoolGeometry, paddedNodePosition, resolveSwimlaneHeight, resolvedNodePositions } from "./swimlane-layout";

describe("swimlane pool geometry", () => {
  it("places a 40px process title immediately above the preserved lane origin", () => {
    const document = createDiagram("Claims review");
    document.processes[0].lanes = [
      { id: "one", name: "Agent", width: 300, colorIndex: 0 },
      { id: "two", name: "Manager", width: 340, colorIndex: 1 },
    ];
    expect(getSwimlanePoolGeometry(document.processes[0])).toMatchObject({
      x: 40, y: -10, titleHeight: 40, laneY: 30, laneHeight: 760,
      width: 640, height: 800, separatorXs: [340],
    });
  });

  it("grows a wrapped process title upward without moving the lane origin", () => {
    const document = createDiagram("FIN1-P03-D21 - System Posting Failure - Purchase Order Processing");
    const process = document.processes[0];
    process.lanes = [{ id: "lane", name: "Accounts", width: 280, colorIndex: 0 }];
    const title = getProcessTitleLayout(process.name, 280, document.appearance);
    const geometry = getSwimlanePoolGeometry(process, document.appearance);

    expect(title.lines.length).toBeGreaterThan(1);
    expect(geometry.titleHeight).toBe(title.height);
    expect(geometry.titleHeight).toBeGreaterThan(40);
    expect(geometry.y + geometry.titleHeight).toBe(geometry.laneY);
    expect(geometry.laneY).toBe(30);
  });

  it("grows automatic height for the deepest rendered label plus padding", () => {
    const document = createDiagram();
    const process = document.processes[0];
    process.lanes.push({ id: "lane", name: "Lane", width: 320, colorIndex: 0 });
    process.nodes = [{ id: "final", type: "final", position: { x: 80, y: 900 }, label: "Done", laneId: "lane" }];
    expect(resolveSwimlaneHeight(process)).toBe(1015);
    process.swimlaneLayout = { heightMode: "fixed", height: 500 };
    expect(resolveSwimlaneHeight(process)).toBe(500);
  });

  it("keeps lane-owned nodes below the actor header and inside horizontal padding", () => {
    const document = createDiagram();
    const process = document.processes[0];
    process.lanes = [{ id: "lane", name: "Lane", width: 260, colorIndex: 0 }];
    const node = { id: "node", type: "activity" as const, position: { x: 40, y: 0 }, label: "Node", laneId: "lane" };
    expect(paddedNodePosition(process, node)).toEqual({ x: 48, y: 86 });
  });

  it("adds a stable 32px gap when rendered nodes overlap", () => {
    const document = createDiagram();
    const process = document.processes[0];
    process.lanes = [{ id: "lane", name: "Lane", width: 260, colorIndex: 0 }];
    process.nodes = [
      { id: "start", type: "initial", position: { x: 100, y: 0 }, label: "", laneId: "lane" },
      { id: "activity", type: "activity", position: { x: 80, y: 0 }, label: "Receive trigger", laneId: "lane" },
    ];

    expect(resolvedNodePositions(process).get("start")).toEqual({ x: 100, y: 86 });
    expect(resolvedNodePositions(process).get("activity")).toEqual({ x: 80, y: 160 });
  });
});
