import { create } from "zustand";
import type { Connection, XYPosition } from "@xyflow/react";
import {
  anchorIds, createDiagram, importDiagram, makeId, parseDiagram,
  type AnchorId, type DiagramAppearance, type DiagramDocument, type DiagramEdge,
  type DiagramEdgeStyle, type DiagramLane, type DiagramNode, type DiagramNodeStyle,
  type DiagramNodeType, type DiagramProcess,
} from "../domain/diagram";
import { areConnectionHandlesAvailable, canConnectNodes, getCanvasBounds, layoutOverlappingProcesses, processAtEdge, processAtNode } from "../domain/process-layout";
import { defaultLabels, nodeDimensions } from "../domain/notation";
import { SWIMLANE_NODE_MIN_Y } from "../domain/swimlane-layout";

const HISTORY_LIMIT = 100;
const LANE_START_X = 40;
const makeProcess = (name: string, position: XYPosition): DiagramProcess => ({
  id: makeId("process"), name, position, lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 },
});
const isAnchor = (value: string | null | undefined): value is AnchorId => Boolean(value && anchorIds.includes(value as AnchorId));
const touched = (document: DiagramDocument): DiagramDocument => ({ ...document, metadata: { ...document.metadata, updatedAt: new Date().toISOString() } });
const replaceProcess = (document: DiagramDocument, next: DiagramProcess): DiagramDocument => ({ ...document, processes: document.processes.map((process) => process.id === next.id ? next : process) });

function laneOffsets(lanes: DiagramLane[]): Map<string, number> {
  let x = LANE_START_X;
  return new Map(lanes.map((lane) => { const entry: [string, number] = [lane.id, x]; x += lane.width; return entry }));
}
function laneAt(lanes: DiagramLane[], centerX: number): string | null {
  let x = LANE_START_X;
  for (const lane of lanes) { if (centerX >= x && centerX < x + lane.width) return lane.id; x += lane.width }
  return null;
}

interface DiagramStore {
  document: DiagramDocument;
  past: DiagramDocument[];
  future: DiagramDocument[];
  gestureStart: DiagramDocument | null;
  activeProcessId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  propertiesDirty: boolean;
  clipboard: { nodes: DiagramNode[]; edges: DiagramEdge[] } | null;
  setActiveProcess: (id: string) => void;
  addProcess: (name: string) => void;
  updateProcess: (id: string, patch: { name?: string }) => void;
  moveProcess: (id: string, position: XYPosition) => void;
  removeProcess: (id: string, confirm?: (message: string) => boolean) => void;
  moveSelectedToProcess: (id: string) => boolean;
  addNode: (type: DiagramNodeType, position?: XYPosition) => void;
  moveNode: (id: string, position: XYPosition) => void;
  beginGesture: () => void;
  endGesture: () => void;
  removeNodes: (ids: string[]) => void;
  removeEdges: (ids: string[]) => void;
  connect: (connection: Connection, guardLabel?: string) => void;
  rename: (title: string) => void;
  updateNode: (id: string, patch: { label?: string; state?: string; body?: string; style?: DiagramNodeStyle }) => void;
  updateEdge: (id: string, patch: { guardLabel?: string; type?: "control-flow" | "object-flow"; style?: DiagramEdgeStyle }) => void;
  updateLaneSettings: (id: string, patch: { name: string; fill: string; width: number; heightMode: "automatic" | "fixed"; height: number }) => void;
  updateAppearance: (patch: Partial<DiagramAppearance>) => void;
  autoArrange: () => void;
  addLane: (processId?: string) => void;
  removeLane: (id: string, deleteNodes?: boolean) => void;
  moveLane: (id: string, direction: -1 | 1) => void;
  selectAll: () => void;
  copySelection: () => void;
  paste: () => void;
  duplicateSelection: () => void;
  nudgeSelection: (dx: number, dy: number) => void;
  setSelection: (nodes: string[], edges: string[]) => void;
  setPropertiesDirty: (dirty: boolean) => void;
  importDocument: (document: unknown) => void;
  loadDocument: (document: unknown) => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
}

function commit(state: DiagramStore, nextDocument: DiagramDocument): Partial<DiagramStore> {
  if (nextDocument === state.document) return {};
  return { document: touched(nextDocument), past: [...state.past, state.document].slice(-HISTORY_LIMIT), future: [] };
}
function activeProcess(state: DiagramStore): DiagramProcess | undefined {
  return state.document.processes.find((process) => process.id === state.activeProcessId) ?? state.document.processes[0];
}

const initialDocument = createDiagram("Order approval");
export const useDiagramStore = create<DiagramStore>((set) => ({
  document: initialDocument,
  past: [], future: [], gestureStart: null, activeProcessId: initialDocument.processes[0].id,
  selectedNodeIds: [], selectedEdgeIds: [], propertiesDirty: false, clipboard: null,

  setActiveProcess: (id) => set((state) => state.document.processes.some((process) => process.id === id) ? { activeProcessId: id } : state),
  addProcess: (rawName) => set((state) => {
    const name = rawName.trim(); if (!name || state.document.processes.length >= 100) return state;
    const bounds = getCanvasBounds(state.document);
    const process = makeProcess(name, { x: 0, y: state.document.processes.length ? bounds.maxY + 130 : 0 });
    return { ...commit(state, { ...state.document, processes: [...state.document.processes, process] }), activeProcessId: process.id, selectedNodeIds: [], selectedEdgeIds: [] };
  }),
  updateProcess: (id, patch) => set((state) => {
    const process = state.document.processes.find((entry) => entry.id === id); if (!process) return state;
    const name = patch.name?.trim() || process.name; if (name === process.name) return state;
    return commit(state, replaceProcess(state.document, { ...process, name }));
  }),
  moveProcess: (id, position) => set((state) => {
    const process = state.document.processes.find((entry) => entry.id === id);
    if (!process || process.position.x === position.x && process.position.y === position.y) return state;
    const document = touched(replaceProcess(state.document, { ...process, position }));
    return state.gestureStart ? { document } : commit(state, document);
  }),
  removeProcess: (id, confirmDelete = () => true) => set((state) => {
    const process = state.document.processes.find((entry) => entry.id === id); if (!process) return state;
    const message = `Delete ${process.name} with ${process.lanes.length} lanes, ${process.nodes.length} nodes, and ${process.edges.length} connectors?`;
    if (!confirmDelete(message)) return state;
    const processes = state.document.processes.filter((entry) => entry.id !== id);
    return { ...commit(state, { ...state.document, processes }), activeProcessId: processes[0]?.id ?? null, selectedNodeIds: [], selectedEdgeIds: [] };
  }),
  moveSelectedToProcess: (targetId) => {
    let moved = false;
    set((state) => {
      const target = state.document.processes.find((process) => process.id === targetId);
      const selected = new Set(state.selectedNodeIds);
      if (!target?.lanes.length || !selected.size) return state;
      const sources = state.document.processes.filter((process) => process.nodes.some((node) => selected.has(node.id)));
      if (sources.length !== 1 || sources[0].id === target.id) return state;
      const source = sources[0];
      if (source.edges.some((edge) => selected.has(edge.sourceNodeId) !== selected.has(edge.targetNodeId))) return state;
      const nodes = source.nodes.filter((node) => selected.has(node.id));
      const edges = source.edges.filter((edge) => selected.has(edge.sourceNodeId) && selected.has(edge.targetNodeId));
      const minX = Math.min(...nodes.map((node) => node.position.x)); const minY = Math.min(...nodes.map((node) => node.position.y));
      const movedNodes = nodes.map((node) => ({ ...node, laneId: target.lanes[0].id, position: { x: node.position.x - minX + 80, y: node.position.y - minY + 110 } }));
      const nextSource = { ...source, nodes: source.nodes.filter((node) => !selected.has(node.id)), edges: source.edges.filter((edge) => !edges.some((entry) => entry.id === edge.id)) };
      const nextTarget = { ...target, nodes: [...target.nodes, ...movedNodes], edges: [...target.edges, ...edges] };
      moved = true;
      return { ...commit(state, { ...state.document, processes: state.document.processes.map((process) => process.id === source.id ? nextSource : process.id === target.id ? nextTarget : process) }), activeProcessId: target.id };
    });
    return moved;
  },

  addNode: (type, position = { x: 160, y: 120 }) => set((state) => {
    const process = activeProcess(state); if (!process?.lanes.length) return state;
    if (type === "decision") {
      const activityId = makeId("node"); const decisionId = makeId("node");
      const activity: DiagramNode = { id: activityId, type: "activity", position, label: defaultLabels.activity, laneId: laneAt(process.lanes, position.x + 80) };
      const decision: DiagramNode = { id: decisionId, type: "decision", position: { x: position.x + 44, y: position.y + 88 }, label: "", laneId: activity.laneId };
      const edge: DiagramEdge = { id: makeId("edge"), type: "control-flow", sourceNodeId: activityId, sourceAnchorId: "bottom", targetNodeId: decisionId, targetAnchorId: "top", guardLabel: "", routing: "automatic" };
      return { ...commit(state, replaceProcess(state.document, { ...process, nodes: [...process.nodes, activity, decision], edges: [...process.edges, edge] })), selectedNodeIds: [activityId], selectedEdgeIds: [] };
    }
    const node: DiagramNode = { id: makeId("node"), type, position, label: defaultLabels[type], laneId: laneAt(process.lanes, position.x + nodeDimensions[type].width / 2), ...(type === "object-in-state" ? { state: "State" } : {}), ...(type === "constraint" ? { body: "Constraint body" } : {}) };
    return commit(state, replaceProcess(state.document, { ...process, nodes: [...process.nodes, node] }));
  }),
  moveNode: (id, canvasPosition) => set((state) => {
    const process = processAtNode(state.document, id); if (!process) return state;
    const localY = canvasPosition.y - process.position.y;
    const position = {
      x: canvasPosition.x - process.position.x,
      y: process.lanes.length ? Math.max(SWIMLANE_NODE_MIN_Y, localY) : localY,
    };
    const node = process.nodes.find((entry) => entry.id === id);
    if (!node || node.position.x === position.x && node.position.y === position.y) return state;
    const document = touched(replaceProcess(state.document, { ...process, nodes: process.nodes.map((entry) => entry.id === id ? { ...entry, position } : entry) }));
    return state.gestureStart ? { document } : commit(state, document);
  }),
  beginGesture: () => set((state) => state.gestureStart ? state : { gestureStart: state.document }),
  endGesture: () => set((state) => {
    if (!state.gestureStart) return state;
    if (JSON.stringify(state.gestureStart.processes) === JSON.stringify(state.document.processes)) return { gestureStart: null };
    const processes = state.document.processes.map((process) => ({ ...process, nodes: process.nodes.map((node) => ({ ...node, laneId: laneAt(process.lanes, node.position.x + nodeDimensions[node.type].width / 2) })) }));
    const document = layoutOverlappingProcesses({ ...state.document, processes });
    return { document: touched(document), gestureStart: null, past: [...state.past, state.gestureStart].slice(-HISTORY_LIMIT), future: [] };
  }),
  removeNodes: (ids) => set((state) => {
    const removed = new Set(ids);
    const processes = state.document.processes.map((process) => ({ ...process, nodes: process.nodes.filter((node) => !removed.has(node.id)), edges: process.edges.filter((edge) => !removed.has(edge.sourceNodeId) && !removed.has(edge.targetNodeId)) }));
    return commit(state, { ...state.document, processes });
  }),
  removeEdges: (ids) => set((state) => {
    const removed = new Set(ids); return commit(state, { ...state.document, processes: state.document.processes.map((process) => ({ ...process, edges: process.edges.filter((edge) => !removed.has(edge.id)) })) });
  }),
  connect: ({ source, target, sourceHandle, targetHandle }, guardLabel = "") => set((state) => {
    if (!source || !target || source === target || !isAnchor(sourceHandle) || !isAnchor(targetHandle)) return state;
    const sourceProcess = processAtNode(state.document, source);
    const sourceNode = sourceProcess?.nodes.find((node) => node.id === source);
    const normalizedGuard = guardLabel.trim();
    if (!sourceProcess || !sourceNode || sourceNode.type === "decision" && !normalizedGuard) return state;
    const duplicate = sourceProcess.edges.some((edge) => edge.sourceNodeId === source && edge.sourceAnchorId === sourceHandle && edge.targetNodeId === target && edge.targetAnchorId === targetHandle);
    if (!canConnectNodes(state.document, source, target) || !areConnectionHandlesAvailable(state.document, source, sourceHandle, target, targetHandle) || duplicate) return state;
    const edge: DiagramEdge = { id: makeId("edge"), type: "control-flow", sourceNodeId: source, sourceAnchorId: sourceHandle, targetNodeId: target, targetAnchorId: targetHandle, guardLabel: normalizedGuard, routing: "automatic" };
    return commit(state, replaceProcess(state.document, { ...sourceProcess, edges: [...sourceProcess.edges, edge] }));
  }),
  rename: (rawTitle) => set((state) => { const title = rawTitle.trim() || "Untitled diagram"; return title === state.document.metadata.title ? state : commit(state, { ...state.document, metadata: { ...state.document.metadata, title } }) }),
  updateNode: (id, patch) => set((state) => {
    const process = processAtNode(state.document, id); const current = process?.nodes.find((node) => node.id === id); if (!process || !current) return state;
    const normalized = current.type === "decision" ? { ...patch, label: undefined } : patch;
    const next = { ...current, ...Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined)) };
    if (JSON.stringify(current) === JSON.stringify(next)) return state;
    return commit(state, replaceProcess(state.document, { ...process, nodes: process.nodes.map((node) => node.id === id ? next : node) }));
  }),
  updateEdge: (id, patch) => set((state) => {
    const process = processAtEdge(state.document, id); const current = process?.edges.find((edge) => edge.id === id); if (!process || !current) return state;
    const next = { ...current, ...patch }; if (JSON.stringify(current) === JSON.stringify(next)) return state;
    return commit(state, replaceProcess(state.document, { ...process, edges: process.edges.map((edge) => edge.id === id ? next : edge) }));
  }),
  updateLaneSettings: (id, patch) => set((state) => {
    const process = state.document.processes.find((entry) => entry.lanes.some((lane) => lane.id === id)); if (!process) return state;
    const index = process.lanes.findIndex((lane) => lane.id === id); const current = process.lanes[index];
    const width = Math.max(180, Math.min(1200, Math.round(patch.width))); const height = Math.max(320, Math.min(5000, Math.round(patch.height)));
    const lane = { ...current, name: patch.name.trim() || current.name, width, style: { ...current.style, fill: patch.fill } };
    const layout = { heightMode: patch.heightMode, height } as const; const delta = width - current.width;
    const shifted = new Set(process.lanes.slice(index + 1).map((entry) => entry.id));
    const next = { ...process, swimlaneLayout: layout, lanes: process.lanes.map((entry) => entry.id === id ? lane : entry), nodes: process.nodes.map((node) => shifted.has(node.laneId ?? "") ? { ...node, position: { ...node.position, x: node.position.x + delta } } : node) };
    return JSON.stringify(process) === JSON.stringify(next) ? state : commit(state, replaceProcess(state.document, next));
  }),
  updateAppearance: (patch) => set((state) => { const appearance = { ...state.document.appearance, ...patch }; return JSON.stringify(appearance) === JSON.stringify(state.document.appearance) ? state : commit(state, { ...state.document, appearance }) }),
  autoArrange: () => set((state) => {
    const process = activeProcess(state); if (!process || process.nodes.length < 2) return state;
    const levels = new Map<string, number>(); const incoming = new Map(process.nodes.map((node) => [node.id, 0]));
    for (const edge of process.edges) incoming.set(edge.targetNodeId, (incoming.get(edge.targetNodeId) ?? 0) + 1);
    const queue = process.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id); if (!queue.length) queue.push(process.nodes[0].id); queue.forEach((id) => levels.set(id, 0));
    for (let index = 0; index < queue.length; index += 1) for (const edge of process.edges.filter((entry) => entry.sourceNodeId === queue[index])) { const level = (levels.get(queue[index]) ?? 0) + 1; if (!levels.has(edge.targetNodeId)) queue.push(edge.targetNodeId); levels.set(edge.targetNodeId, Math.max(levels.get(edge.targetNodeId) ?? 0, level)) }
    const isolated = process.nodes.filter((node) => !process.edges.some((edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id));
    const connectedLevel = Math.max(-1, ...process.nodes.filter((node) => !isolated.includes(node)).map((node) => levels.get(node.id) ?? -1));
    isolated.forEach((node, index) => levels.set(node.id, connectedLevel + 1 + index));
    const fallback = Math.max(0, ...levels.values()) + 1; const rows = new Map<number, DiagramNode[]>();
    for (const node of process.nodes) { const level = levels.get(node.id) ?? fallback; rows.set(level, [...(rows.get(level) ?? []), node]) }
    const offsets = laneOffsets(process.lanes);
    const nodes = process.nodes.map((node) => { const level = levels.get(node.id) ?? fallback; const rowIndex = (rows.get(level) ?? [node]).findIndex((entry) => entry.id === node.id); let x = 120 + rowIndex * 220; if (node.laneId) { const lane = process.lanes.find((entry) => entry.id === node.laneId); x = (offsets.get(node.laneId) ?? LANE_START_X) + Math.max(20, ((lane?.width ?? 320) - nodeDimensions[node.type].width) / 2) } return { ...node, position: { x, y: 90 + level * 150 } } });
    return commit(state, replaceProcess(state.document, { ...process, nodes }));
  }),
  addLane: (processId) => set((state) => {
    const process = state.document.processes.find((entry) => entry.id === (processId ?? state.activeProcessId)); if (!process) return state;
    const lane: DiagramLane = { id: makeId("lane"), name: `Lane ${process.lanes.length + 1}`, width: 320, colorIndex: process.lanes.length % 8 };
    return { ...commit(state, replaceProcess(state.document, { ...process, lanes: [...process.lanes, lane] })), activeProcessId: process.id };
  }),
  removeLane: (id, deleteNodes = false) => set((state) => {
    const process = state.document.processes.find((entry) => entry.lanes.some((lane) => lane.id === id)); if (!process) return state;
    const removed = new Set(deleteNodes ? process.nodes.filter((node) => node.laneId === id).map((node) => node.id) : []);
    const next = { ...process, lanes: process.lanes.filter((lane) => lane.id !== id), nodes: process.nodes.filter((node) => !removed.has(node.id)).map((node) => node.laneId === id ? { ...node, laneId: null } : node), edges: process.edges.filter((edge) => !removed.has(edge.sourceNodeId) && !removed.has(edge.targetNodeId)) };
    return commit(state, replaceProcess(state.document, next));
  }),
  moveLane: (id, direction) => set((state) => {
    const process = state.document.processes.find((entry) => entry.lanes.some((lane) => lane.id === id)); if (!process) return state;
    const from = process.lanes.findIndex((lane) => lane.id === id); const to = from + direction; if (to < 0 || to >= process.lanes.length) return state;
    const oldOffsets = laneOffsets(process.lanes); const lanes = [...process.lanes]; [lanes[from], lanes[to]] = [lanes[to], lanes[from]]; const nextOffsets = laneOffsets(lanes);
    const nodes = process.nodes.map((node) => { if (!node.laneId) return node; const delta = (nextOffsets.get(node.laneId) ?? 0) - (oldOffsets.get(node.laneId) ?? 0); return delta ? { ...node, position: { ...node.position, x: node.position.x + delta } } : node });
    return commit(state, replaceProcess(state.document, { ...process, lanes, nodes }));
  }),
  selectAll: () => set((state) => { const process = activeProcess(state); return { selectedNodeIds: process?.nodes.map((node) => node.id) ?? [], selectedEdgeIds: process?.edges.map((edge) => edge.id) ?? [] } }),
  copySelection: () => set((state) => {
    const selected = new Set(state.selectedNodeIds); const process = state.document.processes.find((entry) => entry.nodes.some((node) => selected.has(node.id))); if (!process || !selected.size) return state;
    return { clipboard: { nodes: structuredClone(process.nodes.filter((node) => selected.has(node.id))), edges: structuredClone(process.edges.filter((edge) => selected.has(edge.sourceNodeId) && selected.has(edge.targetNodeId))) } };
  }),
  paste: () => set((state) => {
    const process = activeProcess(state); if (!process?.lanes.length || !state.clipboard?.nodes.length) return state;
    const ids = new Map(state.clipboard.nodes.map((node) => [node.id, makeId("node")])); const minX = Math.min(...state.clipboard.nodes.map((node) => node.position.x)); const minY = Math.min(...state.clipboard.nodes.map((node) => node.position.y));
    const nodes = state.clipboard.nodes.map((node) => ({ ...structuredClone(node), id: ids.get(node.id)!, laneId: process.lanes[0].id, position: { x: node.position.x - minX + 80, y: node.position.y - minY + 110 } }));
    const edges = state.clipboard.edges.map((edge) => ({ ...structuredClone(edge), id: makeId("edge"), sourceNodeId: ids.get(edge.sourceNodeId)!, targetNodeId: ids.get(edge.targetNodeId)! }));
    return { ...commit(state, replaceProcess(state.document, { ...process, nodes: [...process.nodes, ...nodes], edges: [...process.edges, ...edges] })), selectedNodeIds: nodes.map((node) => node.id), selectedEdgeIds: edges.map((edge) => edge.id) };
  }),
  duplicateSelection: () => { useDiagramStore.getState().copySelection(); useDiagramStore.getState().paste() },
  nudgeSelection: (dx, dy) => set((state) => {
    const selected = new Set(state.selectedNodeIds); if (!selected.size) return state;
    return commit(state, { ...state.document, processes: state.document.processes.map((process) => ({ ...process, nodes: process.nodes.map((node) => selected.has(node.id) ? { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } } : node) })) });
  }),
  setSelection: (nodes, edges) => set((state) => {
    const owner = nodes[0] ? processAtNode(state.document, nodes[0]) : edges[0] ? processAtEdge(state.document, edges[0]) : undefined;
    const sameNodes = nodes.length === state.selectedNodeIds.length && nodes.every((id, index) => id === state.selectedNodeIds[index]); const sameEdges = edges.length === state.selectedEdgeIds.length && edges.every((id, index) => id === state.selectedEdgeIds[index]);
    return sameNodes && sameEdges && (!owner || owner.id === state.activeProcessId) ? state : { selectedNodeIds: nodes, selectedEdgeIds: edges, ...(owner ? { activeProcessId: owner.id } : {}) };
  }),
  setPropertiesDirty: (propertiesDirty) => set({ propertiesDirty }),
  importDocument: (document) => set((state) => { const parsed = layoutOverlappingProcesses(importDiagram(document)); return { ...commit(state, parsed), activeProcessId: parsed.processes[0]?.id ?? null } }),
  loadDocument: (document) => set(() => { const parsed = layoutOverlappingProcesses(importDiagram(document)); return { document: parsed, past: [], future: [], gestureStart: null, activeProcessId: parsed.processes[0]?.id ?? null, selectedNodeIds: [], selectedEdgeIds: [], propertiesDirty: false, clipboard: null } }),
  reset: () => set(() => { const document = createDiagram(); return { document, past: [], future: [], gestureStart: null, activeProcessId: document.processes[0].id, selectedNodeIds: [], selectedEdgeIds: [], propertiesDirty: false, clipboard: null } }),
  undo: () => set((state) => { const document = state.past.at(-1); if (!document) return state; return { document, past: state.past.slice(0, -1), future: [state.document, ...state.future].slice(0, HISTORY_LIMIT), activeProcessId: document.processes.some((process) => process.id === state.activeProcessId) ? state.activeProcessId : document.processes[0]?.id ?? null, selectedNodeIds: [], selectedEdgeIds: [], propertiesDirty: false, gestureStart: null } }),
  redo: () => set((state) => { const document = state.future[0]; if (!document) return state; return { document, past: [...state.past, state.document].slice(-HISTORY_LIMIT), future: state.future.slice(1), activeProcessId: document.processes.some((process) => process.id === state.activeProcessId) ? state.activeProcessId : document.processes[0]?.id ?? null, selectedNodeIds: [], selectedEdgeIds: [], propertiesDirty: false, gestureStart: null } }),
}));

export { parseDiagram };
