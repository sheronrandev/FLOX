import type { AnchorId, DiagramDocument, DiagramEdge, DiagramNode, DiagramProcess } from "./diagram";
import { getNodeDimensions } from "./notation";
import { getSwimlanePoolGeometry, resolvedNodePositions } from "./swimlane-layout";

export interface FlatDiagramNode extends DiagramNode { processId: string }
export interface FlatDiagramEdge extends DiagramEdge { processId: string }

export function localToCanvasPosition(process: DiagramProcess, position: { x: number; y: number }) {
  return { x: process.position.x + position.x, y: process.position.y + position.y };
}
export function canvasToLocalPosition(process: DiagramProcess, position: { x: number; y: number }) {
  return { x: position.x - process.position.x, y: position.y - process.position.y };
}
export function processAtNode(document: DiagramDocument, nodeId: string): DiagramProcess | undefined {
  return document.processes.find((process) => process.nodes.some((node) => node.id === nodeId));
}
export function processAtEdge(document: DiagramDocument, edgeId: string): DiagramProcess | undefined {
  return document.processes.find((process) => process.edges.some((edge) => edge.id === edgeId));
}
export function canConnectNodes(document: DiagramDocument, sourceId: string | null, targetId: string | null): boolean {
  if (!sourceId || !targetId || sourceId === targetId) return false;
  const source = processAtNode(document, sourceId);
  return Boolean(source && source.id === processAtNode(document, targetId)?.id);
}

const exclusiveHandleTypes = new Set(["decision", "merge"]);

export function indexOccupiedExclusiveAnchors(document: DiagramDocument): Map<string, Set<AnchorId>> {
  const occupied = new Map<string, Set<AnchorId>>();
  for (const process of document.processes) {
    const exclusiveNodeIds = new Set(process.nodes.filter((node) => exclusiveHandleTypes.has(node.type)).map((node) => node.id));
    for (const edge of process.edges) {
      if (exclusiveNodeIds.has(edge.sourceNodeId)) {
        const anchors = occupied.get(edge.sourceNodeId) ?? new Set<AnchorId>();
        anchors.add(edge.sourceAnchorId); occupied.set(edge.sourceNodeId, anchors);
      }
      if (exclusiveNodeIds.has(edge.targetNodeId)) {
        const anchors = occupied.get(edge.targetNodeId) ?? new Set<AnchorId>();
        anchors.add(edge.targetAnchorId); occupied.set(edge.targetNodeId, anchors);
      }
    }
  }
  return occupied;
}

export function occupiedExclusiveAnchors(document: DiagramDocument, nodeId: string): Set<AnchorId> {
  return indexOccupiedExclusiveAnchors(document).get(nodeId) ?? new Set<AnchorId>();
}

export function areConnectionHandlesAvailable(
  document: DiagramDocument,
  sourceId: string | null,
  sourceHandle: string | null,
  targetId: string | null,
  targetHandle: string | null,
): boolean {
  if (!sourceId || !sourceHandle || !targetId || !targetHandle) return false;
  const occupied = indexOccupiedExclusiveAnchors(document);
  return !occupied.get(sourceId)?.has(sourceHandle as AnchorId) && !occupied.get(targetId)?.has(targetHandle as AnchorId);
}
export function flattenProcesses(document: DiagramDocument): { nodes: FlatDiagramNode[]; edges: FlatDiagramEdge[] } {
  return {
    nodes: document.processes.flatMap((process) => {
      const positions = resolvedNodePositions(process, document.appearance);
      return process.nodes.map((node) => ({ ...node, position: localToCanvasPosition(process, positions.get(node.id) ?? node.position), processId: process.id }));
    }),
    edges: document.processes.flatMap((process) => process.edges.map((edge) => ({ ...edge, processId: process.id }))),
  };
}

export interface CanvasBounds { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number }

const IMPORT_GRID_COLUMNS = 10;
const IMPORT_GRID_GAP = 80;
const CANVAS_GRID_SIZE = 20;

function getLocalProcessBounds(process: DiagramProcess, document: DiagramDocument): CanvasBounds {
  const localProcess = { ...process, position: { x: 0, y: 0 } };
  const pool = getSwimlanePoolGeometry(localProcess, document.appearance);
  const positions = resolvedNodePositions(localProcess, document.appearance);
  let minX = pool.x; let minY = pool.y; let maxX = pool.x + pool.width; let maxY = pool.y + pool.height;
  for (const node of process.nodes) {
    const position = positions.get(node.id) ?? node.position;
    const size = getNodeDimensions(node, document.appearance);
    minX = Math.min(minX, position.x); minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + size.width); maxY = Math.max(maxY, position.y + size.height);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function overlaps(left: CanvasBounds, right: CanvasBounds): boolean {
  return left.minX < right.maxX && left.maxX > right.minX && left.minY < right.maxY && left.maxY > right.minY;
}

const snapUp = (value: number) => Math.ceil(value / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE;

/** Reflows imported process frames only when at least two occupy the same canvas area. */
export function layoutOverlappingProcesses(document: DiagramDocument): DiagramDocument {
  if (document.processes.length < 2) return document;
  const localBounds = document.processes.map((process) => getLocalProcessBounds(process, document));
  const canvasBounds = localBounds.map((bounds, index) => {
    const position = document.processes[index].position;
    return { ...bounds, minX: bounds.minX + position.x, maxX: bounds.maxX + position.x, minY: bounds.minY + position.y, maxY: bounds.maxY + position.y };
  });
  const hasOverlap = canvasBounds.some((bounds, index) => canvasBounds.slice(index + 1).some((candidate) => overlaps(bounds, candidate)));
  if (!hasOverlap) return document;

  const cellWidth = snapUp(Math.max(...localBounds.map((bounds) => bounds.width)) + IMPORT_GRID_GAP);
  const cellHeight = snapUp(Math.max(...localBounds.map((bounds) => bounds.height)) + IMPORT_GRID_GAP);
  const originX = canvasBounds[0].minX;
  const originY = canvasBounds[0].minY;
  const processes = document.processes.map((process, index) => ({
    ...process,
    position: {
      x: originX + index % IMPORT_GRID_COLUMNS * cellWidth - localBounds[index].minX,
      y: originY + Math.floor(index / IMPORT_GRID_COLUMNS) * cellHeight - localBounds[index].minY,
    },
  }));
  return { ...document, processes };
}

export function getCanvasBounds(document: DiagramDocument): CanvasBounds {
  if (!document.processes.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const process of document.processes) {
    const pool = getSwimlanePoolGeometry(process, document.appearance);
    const positions = resolvedNodePositions(process, document.appearance);
    minX = Math.min(minX, pool.x); minY = Math.min(minY, pool.y);
    maxX = Math.max(maxX, pool.x + pool.width); maxY = Math.max(maxY, pool.y + pool.height);
    for (const node of process.nodes) {
      const position = localToCanvasPosition(process, positions.get(node.id) ?? node.position); const size = getNodeDimensions(node, document.appearance);
      minX = Math.min(minX, position.x); minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + size.width); maxY = Math.max(maxY, position.y + size.height);
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
