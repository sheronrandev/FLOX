import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface Point { x: number; y: number }
interface NodeLike { id: string; type: string; position: Point }
interface EdgeLike {
  id: string; sourceNodeId: string; targetNodeId: string;
  sourceAnchorId: string; targetAnchorId: string; routing: string;
}

const output = path.resolve(process.argv[2] ?? "");
const floxRoot = path.resolve(process.argv[3] ?? process.cwd());
if (!fs.statSync(output, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Missing output folder: ${output}`);

const load = (relative: string) => import(pathToFileURL(path.join(floxRoot, relative)).href);
const diagramModule = await load("web/src/domain/diagram.ts");
const validationModule = await load("web/src/domain/validation.ts");
const notationModule = await load("web/src/domain/notation.ts");
const routingModule = await load("web/src/diagram/routing.ts");

const parseDiagram = diagramModule.parseDiagram as (value: unknown) => any;
const validateDiagram = validationModule.validateDiagram as (value: unknown) => unknown[];
const getNodeDimensions = notationModule.getNodeDimensions as (node: NodeLike) => { width: number; height: number };
const routeAll = routingModule.routeAll as (nodes: NodeLike[], edges: EdgeLike[]) => Record<string, Point[]>;
const segmentHitsObstacle = routingModule.segmentHitsObstacle as (a: Point, b: Point, obstacles: Array<{ left: number; top: number; right: number; bottom: number }>) => boolean;

function segments(points: Point[]): Array<[Point, Point]> {
  return points.slice(1).map((point, index) => [points[index], point] as [Point, Point]).filter(([a, b]) => a.x !== b.x || a.y !== b.y);
}

function between(value: number, first: number, second: number): boolean {
  return value >= Math.min(first, second) && value <= Math.max(first, second);
}

function segmentConflict(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const aVertical = a1.x === a2.x;
  const bVertical = b1.x === b2.x;
  if (aVertical && bVertical) {
    return a1.x === b1.x && Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) > Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y));
  }
  if (!aVertical && !bVertical) {
    return a1.y === b1.y && Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) > Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x));
  }
  const vertical = aVertical ? [a1, a2] : [b1, b2];
  const horizontal = aVertical ? [b1, b2] : [a1, a2];
  return between(vertical[0].x, horizontal[0].x, horizontal[1].x) && between(horizontal[0].y, vertical[0].y, vertical[1].y);
}

function jsonFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(root, entry.name);
    return entry.isDirectory() ? jsonFiles(item) : entry.isFile() && entry.name.toLowerCase().endsWith(".json") ? [item] : [];
  }).sort();
}

const files = jsonFiles(output);
if (!files.length) throw new Error("No JSON files found");
const laneCounts = new Map<number, number>();
let bytes = 0;
for (const file of files) {
  const stat = fs.statSync(file);
  if (stat.size > 5_000_000) throw new Error(`${file}: exceeds FLOX's 5 MB import limit`);
  const document = parseDiagram(JSON.parse(fs.readFileSync(file, "utf8")));
  const findings = validateDiagram(document);
  if (findings.length) throw new Error(`${file}: ${JSON.stringify(findings)}`);
  if (document.processes.length !== 1) throw new Error(`${file}: expected one process`);
  const diagramProcess = document.processes[0];
  const nodes = diagramProcess.nodes as NodeLike[];
  const edges = diagramProcess.edges as EdgeLike[];
  const occupied = new Set<string>();
  for (const edge of edges) {
    for (const endpoint of [`${edge.sourceNodeId}:${edge.sourceAnchorId}`, `${edge.targetNodeId}:${edge.targetAnchorId}`]) {
      if (occupied.has(endpoint)) throw new Error(`${file}: reused webhook ${endpoint}`);
      occupied.add(endpoint);
    }
  }
  const routes = routeAll(nodes, edges);
  for (const edge of edges) {
    const points = routes[edge.id];
    if (!points || points.length < 2) throw new Error(`${file}: missing automatic route for ${edge.id}`);
    const obstacles = nodes.filter((node) => node.id !== edge.sourceNodeId && node.id !== edge.targetNodeId).map((node) => {
      const size = getNodeDimensions(node);
      return { left: node.position.x - 1, top: node.position.y - 1, right: node.position.x + size.width + 1, bottom: node.position.y + size.height + 1 };
    });
    for (const [start, end] of segments(points)) {
      if (segmentHitsObstacle(start, end, obstacles)) throw new Error(`${file}: ${edge.id} crosses a node`);
    }
  }
  for (let left = 0; left < edges.length; left += 1) {
    for (let right = left + 1; right < edges.length; right += 1) {
      for (const [a1, a2] of segments(routes[edges[left].id])) {
        for (const [b1, b2] of segments(routes[edges[right].id])) {
          if (segmentConflict(a1, a2, b1, b2)) throw new Error(`${file}: ${edges[left].id} intersects ${edges[right].id}`);
        }
      }
    }
  }
  laneCounts.set(diagramProcess.lanes.length, (laneCounts.get(diagramProcess.lanes.length) ?? 0) + 1);
  bytes += stat.size;
}

console.log(JSON.stringify({ output, floxRoot, jsonFiles: files.length, bytes, laneCounts: Object.fromEntries([...laneCounts].sort((a, b) => a[0] - b[0])) }, null, 2));
