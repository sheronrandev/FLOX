import { describe, expect, it } from "vitest";
import type { DiagramEdge, DiagramNode } from "../domain/diagram";
import { guardLabelPoint, ROUTING_ARROWHEAD_LENGTH, ROUTING_SOURCE_LEAD_DISTANCE, ROUTING_TARGET_LEAD_DISTANCE, ROUTING_VISIBLE_ENDPOINT_LENGTH, routeEdge, segmentHitsObstacle } from "./routing";

function segmentLength(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

describe("orthogonal routing", () => {
  it("routes around an intervening component", () => {
    const nodes: DiagramNode[] = [
      { id: "a", type: "activity", position: { x: 0, y: 100 }, label: "A", laneId: null },
      { id: "block", type: "activity", position: { x: 220, y: 100 }, label: "Block", laneId: null },
      { id: "b", type: "activity", position: { x: 440, y: 100 }, label: "B", laneId: null },
    ];
    const edge: DiagramEdge = { id: "e", type: "control-flow", sourceNodeId: "a", sourceAnchorId: "right", targetNodeId: "b", targetAnchorId: "left", guardLabel: "", routing: "automatic" };
    const points = routeEdge(nodes, edge);
    expect(points[0]).toEqual({ x: 160, y: 132 });
    expect(points.at(-1)).toEqual({ x: 440, y: 132 });
    expect(points.slice(1).every((point, index) => point.x === points[index].x || point.y === points[index].y)).toBe(true);
    const obstacle = { left: 204, top: 84, right: 396, bottom: 180 };
    expect(points.slice(1).some((point, index) => segmentHitsObstacle(points[index], point, [obstacle]))).toBe(false);
  });

  it("reserves a visible 15px shaft beyond the fixed arrowhead footprint", () => {
    const nodes: DiagramNode[] = [
      { id: "source", type: "activity", position: { x: 0, y: 0 }, label: "Source", laneId: null },
      { id: "target", type: "activity", position: { x: 320, y: 70 }, label: "Target", laneId: null },
    ];
    const edge: DiagramEdge = { id: "flow", type: "control-flow", sourceNodeId: "source", sourceAnchorId: "bottom", targetNodeId: "target", targetAnchorId: "top", guardLabel: "", routing: "automatic" };

    const points = routeEdge(nodes, edge);

    expect(ROUTING_SOURCE_LEAD_DISTANCE).toBe(15);
    expect(ROUTING_TARGET_LEAD_DISTANCE).toBe(24);
    expect(segmentLength(points[0], points[1])).toBe(ROUTING_SOURCE_LEAD_DISTANCE);
    expect(segmentLength(points.at(-2)!, points.at(-1)!)).toBe(ROUTING_TARGET_LEAD_DISTANCE);
    expect(ROUTING_TARGET_LEAD_DISTANCE - ROUTING_ARROWHEAD_LENGTH).toBe(ROUTING_VISIBLE_ENDPOINT_LENGTH);
    expect(points[1].y).toBeGreaterThan(points[0].y);
    expect(points.at(-2)!.y).toBeLessThan(points.at(-1)!.y);
  });

  it("keeps routing safe when larger imported nodes overlap", () => {
    const nodes: DiagramNode[] = [
      { id: "source", type: "activity", position: { x: 80, y: 80 }, label: "Source", laneId: null },
      { id: "obstacle", type: "activity", position: { x: 80, y: 150 }, label: "Obstacle", laneId: null },
      { id: "target", type: "activity", position: { x: 80, y: 220 }, label: "Target", laneId: null },
    ];
    const edge: DiagramEdge = { id: "flow", type: "control-flow", sourceNodeId: "source", sourceAnchorId: "bottom", targetNodeId: "target", targetAnchorId: "top", guardLabel: "", routing: "automatic" };

    expect(() => routeEdge(nodes, edge, { nodeFontSize: 20, nodeInnerPadding: 12 })).not.toThrow();
  });

  it("places guard labels beside the first meaningful branch segment", () => {
    expect(guardLabelPoint([{ x: 100, y: 100 }, { x: 100, y: 115 }, { x: 100, y: 175 }], "Yes")).toEqual({ x: 122.4, y: 145 });
    expect(guardLabelPoint([{ x: 100, y: 100 }, { x: 160, y: 100 }], "Yes")).toEqual({ x: 130, y: 81 });
  });
});
