import { HttpError } from "../lib/errors.mjs";

const HEX = /^#[0-9a-f]{6}$/i;
const NODE_TYPES = new Set(["activity", "state", "object-in-state", "decision", "merge", "fork", "join", "initial", "final", "constraint", "note"]);
const LEGACY_NODE_TYPES = new Set(["start", "end", "activity", "decision", "fork", "join"]);
const ANCHORS = new Set(["top", "right", "bottom", "left"]);
const EDGE_TYPES = new Set(["control-flow", "object-flow"]);
const MAX_DIAGRAM_LANES = 1_000;
const LEGACY_ROOT_KEYS = new Set(["format", "version", "metadata", "nodes", "edges", "lanes", "swimlaneLayout", "appearance"]);
const V1_NODE_KEYS = new Set(["id", "type", "position", "label", "laneId", "style"]);
const NODE_KEYS = new Set([...V1_NODE_KEYS, "state", "body"]);
const V1_EDGE_KEYS = new Set(["id", "type", "sourceNodeId", "sourceAnchorId", "targetNodeId", "targetAnchorId", "label", "routing", "style"]);
const EDGE_KEYS = new Set([...V1_EDGE_KEYS].filter((key) => key !== "label"));
EDGE_KEYS.add("guardLabel");
const V1_LANE_KEYS = new Set(["id", "name", "width", "colorIndex"]);
const LANE_KEYS = new Set([...V1_LANE_KEYS, "style"]);
const ownKeys = (value, allowed) => Object.keys(value).every((key) => allowed.has(key));
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const safeColor = (value) => value === undefined || typeof value === "string" && HEX.test(value);

function invalid(message = "Invalid diagram document") { throw new HttpError(400, message, "invalid_diagram") }
function collisionSafeId(base, used) {
  if (!used.has(base)) { used.add(base); return base }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  const id = `${base}-${suffix}`; used.add(id); return id;
}

function normalizeLegacyArrays(value) {
  const copy = structuredClone(value);
  if (copy.version === 1) {
    if (!copy.nodes.every((node) => object(node) && ownKeys(node, V1_NODE_KEYS) && LEGACY_NODE_TYPES.has(node.type)) ||
      !copy.edges.every((edge) => object(edge) && ownKeys(edge, V1_EDGE_KEYS)) ||
      !copy.lanes.every((lane) => object(lane) && ownKeys(lane, V1_LANE_KEYS))) invalid();
    copy.nodes = copy.nodes.map((node) => ({ ...node, type: node.type === "start" ? "initial" : node.type === "end" ? "final" : node.type }));
    copy.edges = copy.edges.map(({ label, ...edge }) => ({ ...edge, guardLabel: label ?? "" }));
  }
  copy.swimlaneLayout = copy.version === 3 ? copy.swimlaneLayout : { heightMode: "fixed", height: 760 };
  return copy;
}

function expandLegacyDecisions(nodes, edges, used) {
  const expandedNodes = [...nodes]; const expandedEdges = [...edges];
  for (const decision of nodes.filter((node) => node.type === "decision")) {
    const activityId = collisionSafeId(`${decision.id}-decision-activity`, used);
    const flowId = collisionSafeId(`${decision.id}-decision-flow`, used);
    const old = { ...decision.position };
    decision.position = { x: old.x + 20, y: old.y + 20 };
    const label = decision.label.trim() || "Evaluate condition";
    decision.label = "";
    for (const edge of expandedEdges) if (edge.targetNodeId === decision.id) edge.targetNodeId = activityId;
    expandedNodes.push({ id: activityId, type: "activity", position: { x: old.x - 24, y: old.y - 68 }, label, laneId: decision.laneId });
    expandedEdges.push({ id: flowId, type: "control-flow", sourceNodeId: activityId, sourceAnchorId: "bottom", targetNodeId: decision.id, targetAnchorId: "top", guardLabel: "", routing: "automatic" });
  }
  return { nodes: expandedNodes, edges: expandedEdges };
}

function normalizeVersion(value) {
  if (!object(value) || value.format !== "activity-diagram") invalid();
  if (value.version === 4) return structuredClone(value);
  if (![1, 2, 3].includes(value.version) || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || !Array.isArray(value.lanes)) invalid("Unsupported diagram version");
  if (!object(value.metadata) || !object(value.appearance) ||
    ![...value.nodes, ...value.edges, ...value.lanes].every(object)) invalid();
  if (!ownKeys(value, LEGACY_ROOT_KEYS) || value.version !== 3 && "swimlaneLayout" in value) invalid();
  if (value.version !== 1 && (!value.nodes.every((node) => ownKeys(node, NODE_KEYS) && NODE_TYPES.has(node.type)) ||
    !value.edges.every((edge) => ownKeys(edge, EDGE_KEYS)) || !value.lanes.every((lane) => ownKeys(lane, LANE_KEYS)))) invalid();
  const legacy = normalizeLegacyArrays(value);
  const used = new Set([...legacy.lanes, ...legacy.nodes, ...legacy.edges].map((item) => item.id));
  const processId = collisionSafeId("process-1", used);
  const expanded = expandLegacyDecisions(legacy.nodes, legacy.edges, used);
  return {
    format: "activity-diagram", version: 4, metadata: legacy.metadata,
    processes: [{ id: processId, name: legacy.metadata.title, position: { x: 0, y: 0 }, lanes: legacy.lanes, nodes: expanded.nodes, edges: expanded.edges, swimlaneLayout: legacy.swimlaneLayout }],
    appearance: legacy.appearance,
  };
}

function validStyle(style) {
  return style === undefined || object(style) && ownKeys(style, new Set(["fill", "stroke", "textColor"])) && safeColor(style.fill) && safeColor(style.stroke) && safeColor(style.textColor);
}
function validPosition(position) {
  return object(position) && ownKeys(position, new Set(["x", "y"])) && Number.isFinite(position.x) && Number.isFinite(position.y) && position.x >= -10000 && position.x <= 100000 && position.y >= -10000 && position.y <= 100000;
}
function validLayout(layout) {
  return object(layout) && ownKeys(layout, new Set(["heightMode", "height"])) && ["automatic", "fixed"].includes(layout.heightMode) && Number.isInteger(layout.height) && layout.height >= 320 && layout.height <= 5000;
}
function optionalIntegerInRange(value, minimum, maximum) {
  return value === undefined || Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function validateDiagram(input, maxBytes = 2_000_000) {
  if (Buffer.byteLength(JSON.stringify(input)) > maxBytes) throw new HttpError(413, "Diagram exceeds the configured size limit", "diagram_too_large");
  const value = normalizeVersion(input);
  if (!object(value.metadata) || !object(value.appearance) || !Array.isArray(value.processes) ||
    !ownKeys(value, new Set(["format", "version", "metadata", "processes", "appearance"]))) invalid("Unknown diagram fields");
  if (!ownKeys(value.metadata, new Set(["title", "createdAt", "updatedAt"])) || typeof value.metadata.title !== "string" || !value.metadata.title.trim() || value.metadata.title.length > 120 || !Number.isFinite(Date.parse(value.metadata.createdAt)) || !Number.isFinite(Date.parse(value.metadata.updatedAt))) invalid("Invalid diagram metadata");
  if (value.processes.length > 100) invalid("Diagram process limit exceeded");

  const ids = new Set(); let nodeCount = 0; let edgeCount = 0; let laneCount = 0;
  for (const process of value.processes) {
    if (!object(process) || !ownKeys(process, new Set(["id", "name", "position", "lanes", "nodes", "edges", "swimlaneLayout"])) || typeof process.id !== "string" || !process.id || process.id.length > 80 || typeof process.name !== "string" || !process.name.trim() || process.name.length > 120 || !validPosition(process.position) || !Array.isArray(process.lanes) || !Array.isArray(process.nodes) || !Array.isArray(process.edges)) invalid("Invalid diagram process");
    if (!validLayout(process.swimlaneLayout)) invalid("Invalid swimlane layout");
    if (ids.has(process.id)) invalid("Duplicate diagram id"); ids.add(process.id);
    nodeCount += process.nodes.length; edgeCount += process.edges.length; laneCount += process.lanes.length;

    const lanes = new Set();
    for (const lane of process.lanes) {
      if (!object(lane) || !ownKeys(lane, new Set(["id", "name", "width", "colorIndex", "style"])) || typeof lane.id !== "string" || !lane.id || lane.id.length > 80 || typeof lane.name !== "string" || !lane.name || lane.name.length > 120 || !Number.isFinite(lane.width) || lane.width < 180 || lane.width > 1200 || !Number.isInteger(lane.colorIndex) || lane.colorIndex < 0 || lane.colorIndex > 7 || !validStyle(lane.style)) invalid("Invalid swimlane");
      if (ids.has(lane.id)) invalid("Duplicate diagram id"); ids.add(lane.id); lanes.add(lane.id);
    }

    const nodes = new Set();
    for (const node of process.nodes) {
      if (!object(node) || !ownKeys(node, new Set(["id", "type", "position", "label", "laneId", "state", "body", "style"])) || typeof node.id !== "string" || !node.id || node.id.length > 80 || !NODE_TYPES.has(node.type) || !validPosition(node.position) || typeof node.label !== "string" || node.label.length > 500 || node.type === "decision" && node.label !== "" || !(node.laneId === null || typeof node.laneId === "string" && lanes.has(node.laneId)) || !validStyle(node.style) || node.type === "object-in-state" !== (typeof node.state === "string") || node.state !== undefined && node.state.length > 200 || node.type === "constraint" !== (typeof node.body === "string") || node.body !== undefined && node.body.length > 1000) invalid("Invalid diagram node or Decision label");
      if (ids.has(node.id)) invalid("Duplicate diagram id"); ids.add(node.id); nodes.add(node.id);
    }

    for (const edge of process.edges) {
      if (!object(edge) || !ownKeys(edge, new Set(["id", "type", "sourceNodeId", "sourceAnchorId", "targetNodeId", "targetAnchorId", "guardLabel", "routing", "style"])) || typeof edge.id !== "string" || !edge.id || edge.id.length > 80 || !EDGE_TYPES.has(edge.type) || !nodes.has(edge.sourceNodeId) || !nodes.has(edge.targetNodeId) || edge.sourceNodeId === edge.targetNodeId || !ANCHORS.has(edge.sourceAnchorId) || !ANCHORS.has(edge.targetAnchorId) || typeof edge.guardLabel !== "string" || edge.guardLabel.length > 500 || !["automatic", "manual"].includes(edge.routing) || edge.style !== undefined && (!object(edge.style) || !ownKeys(edge.style, new Set(["stroke", "width", "dash"])) || !safeColor(edge.style.stroke) || edge.style.width !== undefined && (!Number.isFinite(edge.style.width) || edge.style.width < 1 || edge.style.width > 6) || edge.style.dash !== undefined && !["solid", "dashed", "dotted"].includes(edge.style.dash))) invalid("Invalid diagram edge or process boundary");
      if (ids.has(edge.id)) invalid("Duplicate diagram id"); ids.add(edge.id);
    }
  }
  if (nodeCount > 5000 || edgeCount > 10000 || laneCount > MAX_DIAGRAM_LANES) invalid("Diagram item limit exceeded");
  if (!ownKeys(value.appearance, new Set(["canvasColor", "gridColor", "controlFlowColor", "objectFlowColor", "nodeFontSize", "processNameFontSize", "nodeInnerPadding"]))
    || ![value.appearance.canvasColor, value.appearance.gridColor, value.appearance.controlFlowColor, value.appearance.objectFlowColor].every((color) => typeof color === "string" && HEX.test(color))
    || !optionalIntegerInRange(value.appearance.nodeFontSize, 10, 20)
    || !optionalIntegerInRange(value.appearance.processNameFontSize, 18, 40)
    || !optionalIntegerInRange(value.appearance.nodeInnerPadding, 4, 20)) invalid("Invalid diagram appearance");
  return value;
}
