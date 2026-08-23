import type { AnchorId, DiagramEdge, DiagramNode } from "../domain/diagram";
import { getNodeDimensions, type NodeLayoutSettings } from "../domain/notation";

export interface Point { x: number; y: number }
export interface Rect { left: number; top: number; right: number; bottom: number }
export const ROUTING_VISIBLE_ENDPOINT_LENGTH = 15;
export const ROUTING_ARROWHEAD_LENGTH = 9;
export const ROUTING_SOURCE_LEAD_DISTANCE = ROUTING_VISIBLE_ENDPOINT_LENGTH;
export const ROUTING_TARGET_LEAD_DISTANCE = ROUTING_VISIBLE_ENDPOINT_LENGTH + ROUTING_ARROWHEAD_LENGTH;

/** Places a guard beside the first meaningful branch segment, avoiding bends and arrowheads. */
export function guardLabelPoint(points: Point[], label = "", fontSize = 12): Point {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const candidates = points.slice(1).map((point, index) => {
    const start = points[index];
    const length = Math.abs(point.x - start.x) + Math.abs(point.y - start.y);
    return { start, point, length, index };
  }).filter((segment) => segment.length > 8);
  const segment = candidates.find((candidate) => candidate.index > 0 && candidate.length >= ROUTING_VISIBLE_ENDPOINT_LENGTH)
    ?? candidates.sort((a, b) => b.length - a.length)[0]
    ?? { start: points[0], point: points[1], length: 0, index: 0 };
  const vertical = segment.start.x === segment.point.x;
  const center = { x: (segment.start.x + segment.point.x) / 2, y: (segment.start.y + segment.point.y) / 2 };
  const labelHalfWidth = Math.max(fontSize * 1.2, label.length * fontSize * 0.32);
  const offset = vertical ? labelHalfWidth + 8 : fontSize + 7;
  return vertical ? { x: center.x + offset, y: center.y } : { x: center.x, y: center.y - offset };
}

function anchor(node: DiagramNode, side: AnchorId, settings?: NodeLayoutSettings): Point {
  const size = getNodeDimensions(node, settings);
  const center = { x: node.position.x + size.width / 2, y: node.position.y + size.height / 2 };
  if (side === "top") return { x: center.x, y: node.position.y };
  if (side === "bottom") return { x: center.x, y: node.position.y + size.height };
  if (side === "left") return { x: node.position.x, y: center.y };
  return { x: node.position.x + size.width, y: center.y };
}

function lead(point: Point, side: AnchorId, distance: number): Point {
  if (side === "top") return { x: point.x, y: point.y - distance };
  if (side === "bottom") return { x: point.x, y: point.y + distance };
  if (side === "left") return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
}

function inside(point: Point, rect: Rect): boolean {
  return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
}

export function segmentHitsObstacle(a: Point, b: Point, obstacles: Rect[]): boolean {
  return obstacles.some((rect) => {
    if (a.x === b.x) return a.x > rect.left && a.x < rect.right && Math.max(a.y, b.y) > rect.top && Math.min(a.y, b.y) < rect.bottom;
    if (a.y === b.y) return a.y > rect.top && a.y < rect.bottom && Math.max(a.x, b.x) > rect.left && Math.min(a.x, b.x) < rect.right;
    return true;
  });
}

function simplify(points: Point[]): Point[] {
  const unique = points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  return unique.filter((point, index) => {
    if (index === 0 || index === unique.length - 1) return true;
    const before = unique[index - 1];
    const after = unique[index + 1];
    return !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y));
  });
}

function pathLength(points: Point[]): number {
  return points.slice(1).reduce((total, point, index) => total + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
}

function clear(points: Point[], obstacles: Rect[]): boolean {
  return points.slice(1).every((point, index) => !segmentHitsObstacle(points[index], point, obstacles));
}

function protectedEndpointDetour(
  start: Point,
  end: Point,
  sourceSide: AnchorId,
  targetSide: AnchorId,
  obstacles: Rect[],
): Point[] | null {
  const verticalLeadsCross = sourceSide === "bottom" && targetSide === "top" && start.y > end.y
    || sourceSide === "top" && targetSide === "bottom" && start.y < end.y;
  if (verticalLeadsCross) {
    const middleX = (start.x + end.x) / 2;
    const candidate = [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
    if (clear(candidate, obstacles)) return candidate;
  }

  const horizontalLeadsCross = sourceSide === "right" && targetSide === "left" && start.x > end.x
    || sourceSide === "left" && targetSide === "right" && start.x < end.x;
  if (horizontalLeadsCross) {
    const middleY = (start.y + end.y) / 2;
    const candidate = [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end];
    if (clear(candidate, obstacles)) return candidate;
  }

  return null;
}

function findPath(start: Point, end: Point, obstacles: Rect[]): Point[] {
  const direct = [
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end],
  ].filter((candidate) => clear(candidate, obstacles));
  if (direct.length) return simplify(direct.sort((a, b) => pathLength(a) - pathLength(b))[0]);

  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap((rect) => [rect.left, rect.right])])].sort((a, b) => a - b);
  const ys = [...new Set([start.y, end.y, ...obstacles.flatMap((rect) => [rect.top, rect.bottom])])].sort((a, b) => a - b);
  const points = new Map<string, Point>();
  for (const x of xs) for (const y of ys) {
    const point = { x, y };
    if (!obstacles.some((rect) => inside(point, rect))) points.set(`${x},${y}`, point);
  }
  const startKey = `${start.x},${start.y}`;
  const endKey = `${end.x},${end.y}`;
  // Imported nodes can overlap after a larger font setting expands their bounds.
  // Preserve both route endpoints even when an expanded obstacle contains one.
  points.set(startKey, start);
  points.set(endKey, end);
  const open = new Set([startKey]);
  const distance = new Map([[startKey, 0]]);
  const previous = new Map<string, string>();
  while (open.size) {
    const current = [...open].sort((a, b) =>
      (distance.get(a)! + pathLength([points.get(a)!, end])) - (distance.get(b)! + pathLength([points.get(b)!, end])))[0];
    if (current === endKey) break;
    open.delete(current);
    const point = points.get(current)!;
    const xi = xs.indexOf(point.x);
    const yi = ys.indexOf(point.y);
    const neighbors = [[xi - 1, yi], [xi + 1, yi], [xi, yi - 1], [xi, yi + 1]]
      .filter(([x, y]) => x >= 0 && y >= 0 && x < xs.length && y < ys.length)
      .map(([x, y]) => points.get(`${xs[x]},${ys[y]}`))
      .filter((candidate): candidate is Point => Boolean(candidate && !segmentHitsObstacle(point, candidate, obstacles)));
    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`;
      const candidateDistance = distance.get(current)! + pathLength([point, neighbor]);
      if (candidateDistance < (distance.get(key) ?? Infinity)) {
        distance.set(key, candidateDistance);
        previous.set(key, current);
        open.add(key);
      }
    }
  }
  if (!distance.has(endKey)) return [start, { x: end.x, y: start.y }, end];
  const result: Point[] = [];
  for (let key: string | undefined = endKey; key; key = previous.get(key)) result.unshift(points.get(key)!);
  return simplify(result);
}

export function routeEdge(nodes: DiagramNode[], edge: DiagramEdge, settings?: NodeLayoutSettings): Point[] {
  const source = nodes.find((node) => node.id === edge.sourceNodeId);
  const target = nodes.find((node) => node.id === edge.targetNodeId);
  if (!source || !target) return [];
  const start = anchor(source, edge.sourceAnchorId, settings);
  const end = anchor(target, edge.targetAnchorId, settings);
  const startLead = lead(start, edge.sourceAnchorId, ROUTING_SOURCE_LEAD_DISTANCE);
  const endLead = lead(end, edge.targetAnchorId, ROUTING_TARGET_LEAD_DISTANCE);
  const obstacles = nodes.filter((node) => node.id !== source.id && node.id !== target.id).map((node) => {
    const size = getNodeDimensions(node, settings);
    return { left: node.position.x - 16, top: node.position.y - 16, right: node.position.x + size.width + 16, bottom: node.position.y + size.height + 16 };
  });
  const middle = protectedEndpointDetour(startLead, endLead, edge.sourceAnchorId, edge.targetAnchorId, obstacles)
    ?? findPath(startLead, endLead, obstacles);
  return simplify([start, startLead, ...middle, endLead, end]);
}

export function routeAll(nodes: DiagramNode[], edges: DiagramEdge[], settings?: NodeLayoutSettings): Record<string, Point[]> {
  return Object.fromEntries(edges.filter((edge) => edge.routing === "automatic").map((edge) => [edge.id, routeEdge(nodes, edge, settings)]));
}

export function pointsToPath(points: Point[]): string {
  return points.length ? points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ") : "";
}
