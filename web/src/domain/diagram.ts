import { z } from "zod";
import { defaultLabels } from "./notation";

export const DIAGRAM_FORMAT = "activity-diagram" as const;
export const DIAGRAM_VERSION = 4 as const;
export const MAX_DIAGRAM_LANES = 1_000 as const;

export const nodeTypes = [
  "activity", "state", "object-in-state", "decision", "merge", "fork",
  "join", "initial", "final", "constraint", "note",
] as const;
export const anchorIds = ["top", "right", "bottom", "left"] as const;
export const edgeTypes = ["control-flow", "object-flow"] as const;

export type DiagramNodeType = (typeof nodeTypes)[number];
export type AnchorId = (typeof anchorIds)[number];
export type DiagramEdgeType = (typeof edgeTypes)[number];

export interface DiagramNodeStyle { fill?: string; stroke?: string; textColor?: string }
export interface DiagramEdgeStyle { stroke?: string; width?: number; dash?: "solid" | "dashed" | "dotted" }
export interface DiagramAppearance {
  canvasColor: string;
  gridColor: string;
  controlFlowColor: string;
  objectFlowColor: string;
  nodeFontSize: number;
  processNameFontSize: number;
  nodeInnerPadding: number;
}

export const defaultDiagramAppearance: DiagramAppearance = {
  canvasColor: "#fafafa", gridColor: "#d7dde1", controlFlowColor: "#000000", objectFlowColor: "#000000",
  nodeFontSize: 12, processNameFontSize: 20, nodeInnerPadding: 12,
};

export interface DiagramNode {
  id: string;
  type: DiagramNodeType;
  position: { x: number; y: number };
  label: string;
  laneId: string | null;
  state?: string;
  body?: string;
  style?: DiagramNodeStyle;
}

export interface DiagramEdge {
  id: string;
  type: DiagramEdgeType;
  sourceNodeId: string;
  sourceAnchorId: AnchorId;
  targetNodeId: string;
  targetAnchorId: AnchorId;
  guardLabel: string;
  routing: "automatic" | "manual";
  style?: DiagramEdgeStyle;
}

export function resolveEdgeColor(edge: Pick<DiagramEdge, "style">): string {
  return edge.style?.stroke ?? "#000000";
}

export interface DiagramLane { id: string; name: string; width: number; colorIndex: number; style?: DiagramNodeStyle }
export interface SwimlaneLayout { heightMode: "automatic" | "fixed"; height: number }
export interface DiagramMetadata { title: string; createdAt: string; updatedAt: string }

export interface DiagramProcess {
  id: string;
  name: string;
  position: { x: number; y: number };
  lanes: DiagramLane[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  swimlaneLayout: SwimlaneLayout;
}

export interface DiagramDocument {
  format: typeof DIAGRAM_FORMAT;
  version: typeof DIAGRAM_VERSION;
  metadata: DiagramMetadata;
  processes: DiagramProcess[];
  appearance: DiagramAppearance;
}

const safeColor = z.string().regex(/^#[0-9a-f]{6}$/i).optional();
const requiredSafeColor = z.string().regex(/^#[0-9a-f]{6}$/i);
const positionSchema = z.object({ x: z.number().finite().min(-10_000).max(100_000), y: z.number().finite().min(-10_000).max(100_000) }).strict();
const styleSchema = z.object({ fill: safeColor, stroke: safeColor, textColor: safeColor }).strict();

const nodeSchema = z.object({
  id: z.string().min(1).max(80), type: z.enum(nodeTypes), position: positionSchema,
  label: z.string().max(500), laneId: z.string().min(1).max(80).nullable(),
  state: z.string().max(200).optional(), body: z.string().max(1_000).optional(), style: styleSchema.optional(),
}).strict().superRefine((node, context) => {
  if (node.type === "decision" && node.label !== "") context.addIssue({ code: "custom", path: ["label"], message: "Decision label must be empty" });
  if (node.type === "object-in-state" && node.state === undefined) context.addIssue({ code: "custom", path: ["state"], message: "Object in State requires a state" });
  if (node.type !== "object-in-state" && node.state !== undefined) context.addIssue({ code: "custom", path: ["state"], message: "State detail is only valid for Object in State" });
  if (node.type === "constraint" && node.body === undefined) context.addIssue({ code: "custom", path: ["body"], message: "Constraint requires a body" });
  if (node.type !== "constraint" && node.body !== undefined) context.addIssue({ code: "custom", path: ["body"], message: "Body is only valid for Constraint" });
});

const edgeSchema = z.object({
  id: z.string().min(1).max(80), type: z.enum(edgeTypes), sourceNodeId: z.string().min(1).max(80), sourceAnchorId: z.enum(anchorIds),
  targetNodeId: z.string().min(1).max(80), targetAnchorId: z.enum(anchorIds), guardLabel: z.string().max(500), routing: z.enum(["automatic", "manual"]),
  style: z.object({ stroke: safeColor, width: z.number().finite().min(1).max(6).optional(), dash: z.enum(["solid", "dashed", "dotted"]).optional() }).strict().optional(),
}).strict();

const laneSchema = z.object({
  id: z.string().min(1).max(80), name: z.string().min(1).max(120), width: z.number().finite().min(180).max(1200),
  colorIndex: z.number().int().min(0).max(7), style: styleSchema.optional(),
}).strict();
const swimlaneLayoutSchema = z.object({ heightMode: z.enum(["automatic", "fixed"]), height: z.number().finite().int().min(320).max(5_000) }).strict();
const appearanceSchema = z.object({
  canvasColor: requiredSafeColor,
  gridColor: requiredSafeColor,
  controlFlowColor: requiredSafeColor,
  objectFlowColor: requiredSafeColor,
  nodeFontSize: z.number().finite().int().min(10).max(20).default(defaultDiagramAppearance.nodeFontSize),
  processNameFontSize: z.number().finite().int().min(18).max(40).default(defaultDiagramAppearance.processNameFontSize),
  nodeInnerPadding: z.number().finite().int().min(4).max(20).default(defaultDiagramAppearance.nodeInnerPadding),
}).strict();

const processSchema = z.object({
  id: z.string().min(1).max(80), name: z.string().min(1).max(120).refine((name) => name.trim().length > 0, "Process name cannot be blank"), position: positionSchema,
  lanes: z.array(laneSchema), nodes: z.array(nodeSchema), edges: z.array(edgeSchema), swimlaneLayout: swimlaneLayoutSchema,
}).strict().superRefine((process, context) => {
  const laneIds = new Set(process.lanes.map((lane) => lane.id));
  const nodeIds = new Set(process.nodes.map((node) => node.id));
  for (const node of process.nodes) if (node.laneId && !laneIds.has(node.laneId)) {
    context.addIssue({ code: "custom", message: `Node ${node.id} references a missing lane in process ${process.id}` });
  }
  for (const edge of process.edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) context.addIssue({ code: "custom", message: `Edge ${edge.id} crosses a process boundary or references a missing node` });
    if (edge.sourceNodeId === edge.targetNodeId) context.addIssue({ code: "custom", message: `Edge ${edge.id} is a self-loop` });
  }
});

export const diagramSchema = z.object({
  format: z.literal(DIAGRAM_FORMAT), version: z.literal(DIAGRAM_VERSION),
  metadata: z.object({ title: z.string().min(1).max(120).refine((title) => title.trim().length > 0, "Diagram title cannot be blank"), createdAt: z.string().datetime(), updatedAt: z.string().datetime() }).strict(),
  processes: z.array(processSchema).max(100), appearance: appearanceSchema.default(defaultDiagramAppearance),
}).strict().superRefine((document, context) => {
  const ids = new Set<string>();
  let nodeCount = 0; let edgeCount = 0; let laneCount = 0;
  for (const process of document.processes) {
    nodeCount += process.nodes.length; edgeCount += process.edges.length; laneCount += process.lanes.length;
    for (const item of [process, ...process.lanes, ...process.nodes, ...process.edges]) {
      if (ids.has(item.id)) context.addIssue({ code: "custom", message: `Duplicate id: ${item.id}` });
      ids.add(item.id);
    }
  }
  if (nodeCount > 5_000 || edgeCount > 10_000 || laneCount > MAX_DIAGRAM_LANES) context.addIssue({ code: "custom", message: "Diagram item limit exceeded" });
});

function newProcess(name: string): DiagramProcess {
  return { id: makeId("process"), name, position: { x: 0, y: 0 }, lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 } };
}

export function createDiagram(title = "Untitled diagram"): DiagramDocument {
  const now = new Date().toISOString();
  return { format: DIAGRAM_FORMAT, version: DIAGRAM_VERSION, metadata: { title, createdAt: now, updatedAt: now }, processes: [newProcess(title)], appearance: { ...defaultDiagramAppearance } };
}

export function parseDiagram(value: unknown): DiagramDocument { return diagramSchema.parse(value) as DiagramDocument }

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
const hasOnlyKeys = (value: Record<string, unknown>, allowed: Set<string>) => Object.keys(value).every((key) => allowed.has(key));
const legacyRootKeys = new Set(["format", "version", "metadata", "nodes", "edges", "lanes", "swimlaneLayout", "appearance"]);
const v1NodeKeys = new Set(["id", "type", "position", "label", "laneId", "style"]);
const legacyNodeKeys = new Set([...v1NodeKeys, "state", "body"]);
const v1EdgeKeys = new Set(["id", "type", "sourceNodeId", "sourceAnchorId", "targetNodeId", "targetAnchorId", "label", "routing", "style"]);
const legacyEdgeKeys = new Set([...v1EdgeKeys].filter((key) => key !== "label").concat("guardLabel"));
const v1LaneKeys = new Set(["id", "name", "width", "colorIndex"]);
const legacyLaneKeys = new Set([...v1LaneKeys, "style"]);
const v1NodeTypes = new Set(["start", "end", "activity", "decision", "fork", "join"]);
const currentNodeTypes = new Set<string>(nodeTypes);
function currentType(value: unknown): DiagramNodeType {
  if (value === "start") return "initial";
  if (value === "end") return "final";
  if (nodeTypes.includes(value as DiagramNodeType)) return value as DiagramNodeType;
  throw new Error(`Unsupported legacy node type: ${String(value)}`);
}
function legacyAnchorPair(source: DiagramNode, target: DiagramNode): [AnchorId, AnchorId] {
  const dx = target.position.x - source.position.x; const dy = target.position.y - source.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["right", "left"] : ["left", "right"];
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}
function collisionSafeId(base: string, used: Set<string>): string {
  if (!used.has(base)) { used.add(base); return base }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  const id = `${base}-${suffix}`; used.add(id); return id;
}

function expandLegacyDecisions(nodes: DiagramNode[], edges: DiagramEdge[], used: Set<string>): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const expandedNodes = [...nodes];
  const expandedEdges = [...edges];
  for (const decision of nodes.filter((node) => node.type === "decision")) {
    const activityId = collisionSafeId(`${decision.id}-decision-activity`, used);
    const flowId = collisionSafeId(`${decision.id}-decision-flow`, used);
    const old = { ...decision.position };
    const activity: DiagramNode = {
      id: activityId, type: "activity", position: { x: old.x - 24, y: old.y - 68 },
      label: decision.label.trim() || "Evaluate condition", laneId: decision.laneId,
    };
    decision.position = { x: old.x + 20, y: old.y + 20 };
    decision.label = "";
    for (const edge of expandedEdges) if (edge.targetNodeId === decision.id) edge.targetNodeId = activityId;
    expandedNodes.push(activity);
    expandedEdges.push({ id: flowId, type: "control-flow", sourceNodeId: activityId, sourceAnchorId: "bottom", targetNodeId: decision.id, targetAnchorId: "top", guardLabel: "", routing: "automatic" });
  }
  return { nodes: expandedNodes, edges: expandedEdges };
}

function migrateDocument(raw: Record<string, unknown>): DiagramDocument {
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges) || !Array.isArray(raw.lanes)) return parseDiagram(raw);
  const version = raw.version as number;
  if ([1, 2, 3].includes(version)) {
    const nodes = raw.nodes.map(asRecord); const edges = raw.edges.map(asRecord); const lanes = raw.lanes.map(asRecord);
    if (!hasOnlyKeys(raw, legacyRootKeys) || version !== 3 && "swimlaneLayout" in raw || [...nodes, ...edges, ...lanes].some((entry) => !entry)) throw new Error("Invalid legacy diagram item");
    const nodeKeys = version === 1 ? v1NodeKeys : legacyNodeKeys;
    const edgeKeys = version === 1 ? v1EdgeKeys : legacyEdgeKeys;
    const laneKeys = version === 1 ? v1LaneKeys : legacyLaneKeys;
    if (nodes.some((entry) => !hasOnlyKeys(entry!, nodeKeys)) || edges.some((entry) => !hasOnlyKeys(entry!, edgeKeys)) || lanes.some((entry) => !hasOnlyKeys(entry!, laneKeys))) {
      throw new Error("Unknown legacy diagram field");
    }
    const allowedTypes = version === 1 ? v1NodeTypes : currentNodeTypes;
    if (nodes.some((entry) => !allowedTypes.has(String(entry!.type)))) throw new Error("Unsupported legacy node type");
  }
  const now = new Date().toISOString(); const metadata = asRecord(raw.metadata);
  const lanes: DiagramLane[] = raw.lanes.map((entry, index) => {
    const lane = asRecord(entry) ?? {};
    return { id: String(lane.id ?? `lane-${index + 1}`), name: String(lane.name ?? `Lane ${index + 1}`).slice(0, 120), width: typeof lane.width === "number" ? lane.width : 260, colorIndex: typeof lane.colorIndex === "number" ? lane.colorIndex : index % 8, ...(asRecord(lane.style) ? { style: lane.style as DiagramNodeStyle } : {}) };
  });
  const nodes: DiagramNode[] = raw.nodes.map((entry, index) => {
    const node = asRecord(entry) ?? {}; const position = asRecord(node.position); const type = currentType(node.type);
    return { id: String(node.id ?? `node-${index + 1}`), type, position: { x: typeof position?.x === "number" ? position.x : Number(node.x), y: typeof position?.y === "number" ? position.y : Number(node.y) }, label: String(node.label ?? defaultLabels[type]).slice(0, 500), laneId: typeof node.laneId === "string" ? node.laneId : null, ...(type === "object-in-state" ? { state: String(node.state ?? "State").slice(0, 200) } : {}), ...(type === "constraint" ? { body: String(node.body ?? "Constraint body").slice(0, 1_000) } : {}), ...(asRecord(node.style) ? { style: node.style as DiagramNodeStyle } : {}) };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges: DiagramEdge[] = raw.edges.map((entry, index) => {
    const edge = asRecord(entry) ?? {}; const sourceNodeId = String(edge.sourceNodeId ?? edge.from ?? ""); const targetNodeId = String(edge.targetNodeId ?? edge.to ?? "");
    const source = nodeById.get(sourceNodeId); const target = nodeById.get(targetNodeId); const inferred = source && target ? legacyAnchorPair(source, target) : ["right", "left"] as const;
    return { id: String(edge.id ?? `edge-${index + 1}`), type: edge.type === "object-flow" ? "object-flow" : "control-flow", sourceNodeId, sourceAnchorId: anchorIds.includes(edge.sourceAnchorId as AnchorId) ? edge.sourceAnchorId as AnchorId : inferred[0], targetNodeId, targetAnchorId: anchorIds.includes(edge.targetAnchorId as AnchorId) ? edge.targetAnchorId as AnchorId : inferred[1], guardLabel: String(edge.guardLabel ?? edge.label ?? "").slice(0, 500), routing: edge.routing === "manual" ? "manual" : "automatic", ...(asRecord(edge.style) ? { style: edge.style as DiagramEdgeStyle } : {}) };
  });
  const title = String(metadata?.title ?? raw.title ?? "Imported diagram").slice(0, 120);
  const used = new Set<string>([...lanes, ...nodes, ...edges].map((item) => item.id));
  const processId = collisionSafeId("process-1", used);
  const expanded = expandLegacyDecisions(nodes, edges, used);
  return parseDiagram({ format: DIAGRAM_FORMAT, version: DIAGRAM_VERSION, metadata: { title, createdAt: typeof metadata?.createdAt === "string" ? metadata.createdAt : now, updatedAt: typeof metadata?.updatedAt === "string" ? metadata.updatedAt : now }, processes: [{ id: processId, name: title, position: { x: 0, y: 0 }, lanes, nodes: expanded.nodes, edges: expanded.edges, swimlaneLayout: raw.version === 3 && asRecord(raw.swimlaneLayout) ? raw.swimlaneLayout : { heightMode: "fixed", height: 760 } }], appearance: raw.appearance ?? { ...defaultDiagramAppearance } });
}

/** Accepts v4, v3, v2, v1, and the original framework-free representation. */
export function importDiagram(value: unknown): DiagramDocument {
  const raw = asRecord(value);
  if (!raw) return parseDiagram(value);
  if (raw.format === DIAGRAM_FORMAT && raw.version === DIAGRAM_VERSION) return parseDiagram(value);
  return migrateDocument(raw);
}

export function serializeDiagram(document: DiagramDocument): string { return JSON.stringify(parseDiagram(document), null, 2) }
export function makeId(prefix: "node" | "edge" | "lane" | "process"): string { return `${prefix}-${crypto.randomUUID()}` }
export { defaultLabels } from "./notation";
