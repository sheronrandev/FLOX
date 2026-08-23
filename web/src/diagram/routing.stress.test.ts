import { describe, expect, it } from "vitest";
import type { DiagramEdge, DiagramNode } from "../domain/diagram";
import { routeAll } from "./routing";

describe("routing performance", () => {
  it("routes a representative 250-node diagram within the interaction budget", () => {
    const nodes: DiagramNode[] = Array.from({ length: 250 }, (_, index) => ({
      id: `node-${index}`, type: "activity", position: { x: (index % 25) * 220, y: Math.floor(index / 25) * 140 }, label: `Activity ${index}`, laneId: null,
    }));
    const edges: DiagramEdge[] = nodes.slice(1).map((node, index) => ({
      id: `edge-${index}`, type: "control-flow", sourceNodeId: nodes[index].id, sourceAnchorId: "right", targetNodeId: node.id, targetAnchorId: "left", guardLabel: "", routing: "automatic",
    }));
    const started = performance.now();
    const memoryBefore = process.memoryUsage().heapUsed;
    const routes = routeAll(nodes, edges);
    const elapsed = performance.now() - started;
    const memoryGrowth = process.memoryUsage().heapUsed - memoryBefore;
    expect(Object.keys(routes)).toHaveLength(edges.length);
    expect(Object.values(routes).every((points) => points.length >= 2)).toBe(true);
    expect(elapsed).toBeLessThan(2_000);
    expect(memoryGrowth).toBeLessThan(64 * 1024 * 1024);
  });
});
