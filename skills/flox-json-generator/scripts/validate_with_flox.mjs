import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const output = path.resolve(process.argv[2] ?? "");
const floxRoot = path.resolve(process.argv[3] ?? process.cwd());
if (!fs.statSync(output, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error(`Missing output folder: ${output}`);
}

const viteEntry = path.join(floxRoot, "web", "node_modules", "vite", "dist", "node", "index.js");
if (!fs.statSync(viteEntry, { throwIfNoEntry: false })?.isFile()) {
  throw new Error(`Missing FLOX web dependencies. Run npm ci --prefix web before native validation.`);
}

const { createServer } = await import(pathToFileURL(viteEntry).href);
const server = await createServer({
  root: path.join(floxRoot, "web"),
  configFile: path.join(floxRoot, "web", "vite.config.ts"),
  appType: "custom",
  server: { middlewareMode: true },
});

function segments(points) {
  return points
    .slice(1)
    .map((point, index) => [points[index], point])
    .filter(([a, b]) => a.x !== b.x || a.y !== b.y);
}

function between(value, first, second) {
  return value >= Math.min(first, second) && value <= Math.max(first, second);
}

function segmentConflict(a1, a2, b1, b2) {
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

function jsonFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(root, entry.name);
    return entry.isDirectory()
      ? jsonFiles(item)
      : entry.isFile() && entry.name.toLowerCase().endsWith(".json")
        ? [item]
        : [];
  }).sort();
}

try {
  const diagramModule = await server.ssrLoadModule("/src/domain/diagram.ts");
  const validationModule = await server.ssrLoadModule("/src/domain/validation.ts");
  const notationModule = await server.ssrLoadModule("/src/domain/notation.ts");
  const routingModule = await server.ssrLoadModule("/src/diagram/routing.ts");

  const { parseDiagram } = diagramModule;
  const { validateDiagram } = validationModule;
  const { getNodeDimensions } = notationModule;
  const { routeAll, segmentHitsObstacle } = routingModule;
  const files = jsonFiles(output);
  if (!files.length) throw new Error("No JSON files found");

  const laneCounts = new Map();
  let bytes = 0;
  for (const file of files) {
    const stat = fs.statSync(file);
    if (stat.size > 5_000_000) throw new Error(`${file}: exceeds FLOX's 5 MB import limit`);
    const document = parseDiagram(JSON.parse(fs.readFileSync(file, "utf8")));
    const findings = validateDiagram(document);
    if (findings.length) throw new Error(`${file}: ${JSON.stringify(findings)}`);
    if (document.processes.length !== 1) throw new Error(`${file}: expected one process`);

    const diagramProcess = document.processes[0];
    const { nodes, edges } = diagramProcess;
    const occupied = new Set();
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
      const obstacles = nodes
        .filter((node) => node.id !== edge.sourceNodeId && node.id !== edge.targetNodeId)
        .map((node) => {
          const size = getNodeDimensions(node);
          return {
            left: node.position.x - 1,
            top: node.position.y - 1,
            right: node.position.x + size.width + 1,
            bottom: node.position.y + size.height + 1,
          };
        });
      for (const [start, end] of segments(points)) {
        if (segmentHitsObstacle(start, end, obstacles)) throw new Error(`${file}: ${edge.id} crosses a node`);
      }
    }

    for (let left = 0; left < edges.length; left += 1) {
      for (let right = left + 1; right < edges.length; right += 1) {
        for (const [a1, a2] of segments(routes[edges[left].id])) {
          for (const [b1, b2] of segments(routes[edges[right].id])) {
            if (segmentConflict(a1, a2, b1, b2)) {
              throw new Error(`${file}: ${edges[left].id} intersects ${edges[right].id}`);
            }
          }
        }
      }
    }

    laneCounts.set(diagramProcess.lanes.length, (laneCounts.get(diagramProcess.lanes.length) ?? 0) + 1);
    bytes += stat.size;
  }

  console.log(JSON.stringify({
    output,
    floxRoot,
    jsonFiles: files.length,
    bytes,
    laneCounts: Object.fromEntries([...laneCounts].sort((a, b) => a[0] - b[0])),
  }, null, 2));
} finally {
  await server.close();
}
