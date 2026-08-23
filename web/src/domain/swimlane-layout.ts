import type { DiagramNode, DiagramProcess } from "./diagram";
import { getExternalLabelLayout, getNodeDimensions, type NodeLayoutSettings } from "./notation";

export const SWIMLANE_POOL_X = 40;
export const SWIMLANE_LANE_Y = 30;
export const SWIMLANE_TITLE_HEIGHT = 40;
export const SWIMLANE_MIN_HEIGHT = 760;
export const SWIMLANE_BOTTOM_PADDING = 80;
export const SWIMLANE_NODE_PADDING = 8;
export const SWIMLANE_ACTOR_HEADER_HEIGHT = 48;
export const SWIMLANE_NODE_MIN_Y = SWIMLANE_LANE_Y + SWIMLANE_ACTOR_HEADER_HEIGHT + SWIMLANE_NODE_PADDING;
export const OVERLAPPED_NODE_GAP = 32;
export const EMPTY_PROCESS_WIDTH = 320;

const externalLabelTypes = new Set(["initial", "final", "fork", "join", "merge"]);

export function paddedNodePosition(process: DiagramProcess, node: DiagramNode, settings?: NodeLayoutSettings): { x: number; y: number } {
  const laneIndex = process.lanes.findIndex((lane) => lane.id === node.laneId);
  if (laneIndex < 0) return node.position;
  const laneStart = SWIMLANE_POOL_X + process.lanes.slice(0, laneIndex).reduce((sum, lane) => sum + lane.width, 0);
  const lane = process.lanes[laneIndex];
  const nodeWidth = getNodeDimensions(node, settings).width;
  const minimumX = laneStart + SWIMLANE_NODE_PADDING;
  const maximumX = laneStart + lane.width - SWIMLANE_NODE_PADDING - nodeWidth;
  const x = maximumX >= minimumX ? Math.min(maximumX, Math.max(minimumX, node.position.x)) : laneStart + (lane.width - nodeWidth) / 2;
  return { x, y: Math.max(SWIMLANE_NODE_MIN_Y, node.position.y) };
}

export function resolvedNodePositions(process: DiagramProcess, settings?: NodeLayoutSettings): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const placed: Array<{ left: number; right: number; top: number; bottom: number }> = [];

  for (const node of process.nodes) {
    const base = paddedNodePosition(process, node, settings);
    const size = getNodeDimensions(node, settings);
    let y = base.y;

    while (true) {
      const collisions = placed.filter((candidate) =>
        base.x < candidate.right && base.x + size.width > candidate.left
        && y < candidate.bottom && y + size.height > candidate.top);
      if (!collisions.length) break;
      y = Math.max(...collisions.map((candidate) => candidate.bottom + OVERLAPPED_NODE_GAP));
    }

    positions.set(node.id, { x: base.x, y });
    placed.push({ left: base.x, right: base.x + size.width, top: y, bottom: y + size.height });
  }

  return positions;
}

export function renderedNodeBottom(node: DiagramNode, settings?: NodeLayoutSettings): number {
  const dimensions = getNodeDimensions(node, settings);
  const external = node.label && externalLabelTypes.has(node.type)
    ? 7 + getExternalLabelLayout(node, settings).lines.length * getExternalLabelLayout(node, settings).lineHeight
    : 0;
  return node.position.y + dimensions.height + external;
}

export function automaticSwimlaneHeight(process: DiagramProcess, settings?: NodeLayoutSettings): number {
  const positions = resolvedNodePositions(process, settings);
  const deepest = Math.max(SWIMLANE_LANE_Y, ...process.nodes.map((node) => renderedNodeBottom({ ...node, position: positions.get(node.id) ?? node.position }, settings)));
  return Math.max(SWIMLANE_MIN_HEIGHT, deepest - SWIMLANE_LANE_Y + SWIMLANE_BOTTOM_PADDING);
}

export function resolveSwimlaneHeight(process: DiagramProcess, settings?: NodeLayoutSettings): number {
  if (!process.lanes.length) return 0;
  return process.swimlaneLayout.heightMode === "fixed" ? process.swimlaneLayout.height : automaticSwimlaneHeight(process, settings);
}

export interface SwimlanePoolGeometry {
  x: number; y: number; laneY: number; titleHeight: number; laneHeight: number;
  width: number; height: number; separatorXs: number[];
}

export function getSwimlanePoolGeometry(process: DiagramProcess, settings?: NodeLayoutSettings): SwimlanePoolGeometry {
  const laneHeight = resolveSwimlaneHeight(process, settings);
  const widths = process.lanes.map((lane) => lane.width);
  let offset = process.position.x + SWIMLANE_POOL_X;
  const separatorXs = widths.slice(0, -1).map((width) => { offset += width; return offset });
  const width = widths.length ? widths.reduce((sum, value) => sum + value, 0) : EMPTY_PROCESS_WIDTH;
  return {
    x: process.position.x + SWIMLANE_POOL_X,
    y: process.position.y + SWIMLANE_LANE_Y - SWIMLANE_TITLE_HEIGHT,
    laneY: process.position.y + SWIMLANE_LANE_Y,
    titleHeight: SWIMLANE_TITLE_HEIGHT,
    laneHeight,
    width,
    height: SWIMLANE_TITLE_HEIGHT + laneHeight,
    separatorXs,
  };
}
