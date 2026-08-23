import type { DiagramAppearance, DiagramDocument, DiagramProcess } from "./diagram";
import { getNodeDimensions } from "./notation";
import { renderedNodeBottom, SWIMLANE_LANE_Y, SWIMLANE_POOL_X } from "./swimlane-layout";

export interface ValidationFinding {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  processId: string;
  processName: string;
  nodeId?: string;
  edgeId?: string;
}

function validateProcess(process: DiagramProcess, appearance: DiagramAppearance): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const add = (finding: Omit<ValidationFinding, "processId" | "processName">) => findings.push({ ...finding, processId: process.id, processName: process.name });
  const id = (suffix: string) => `${process.id}:${suffix}`;

  if (!process.lanes.length && process.nodes.length) add({ id: id("missing-lane"), severity: "error", message: "Add a swimlane before placing nodes in this process." });
  if (process.swimlaneLayout.heightMode === "fixed" && process.nodes.some((node) => renderedNodeBottom(node, appearance) > SWIMLANE_LANE_Y + process.swimlaneLayout.height)) {
    add({ id: id("swimlane-fixed-overflow"), severity: "warning", message: "Process content extends below the fixed swimlane frame." });
  }
  const poolRight = SWIMLANE_POOL_X + process.lanes.reduce((sum, lane) => sum + lane.width, 0);
  if (process.lanes.length && process.nodes.some((node) => node.position.x < SWIMLANE_POOL_X || node.position.x + getNodeDimensions(node, appearance).width > poolRight)) {
    add({ id: id("swimlane-horizontal-overflow"), severity: "warning", message: "Process content extends beyond its swimlane widths." });
  }

  const incoming = new Map(process.nodes.map((node) => [node.id, [] as typeof process.edges]));
  const outgoing = new Map(process.nodes.map((node) => [node.id, [] as typeof process.edges]));
  for (const edge of process.edges) { outgoing.get(edge.sourceNodeId)?.push(edge); incoming.get(edge.targetNodeId)?.push(edge) }
  const nodeById = new Map(process.nodes.map((node) => [node.id, node]));
  const starts = process.nodes.filter((node) => node.type === "initial");
  const finals = process.nodes.filter((node) => node.type === "final");
  if (!starts.length) add({ id: id("missing-start"), severity: "error", message: "Add an initial node." });
  if (starts.length > 1) starts.forEach((node) => add({ id: id(`multiple-start-${node.id}`), severity: "error", message: "Only one initial node is allowed in a process.", nodeId: node.id }));
  if (!finals.length) add({ id: id("missing-final"), severity: "warning", message: "Add an activity final node." });

  for (const node of process.nodes) {
    const ins = incoming.get(node.id) ?? []; const outs = outgoing.get(node.id) ?? []; const label = node.label || node.type;
    if (node.type !== "initial" && !ins.length) add({ id: id(`no-input-${node.id}`), severity: "warning", message: `${label} has no incoming flow.`, nodeId: node.id });
    if (node.type !== "final" && !outs.length) add({ id: id(`no-output-${node.id}`), severity: "warning", message: `${label} has no outgoing flow.`, nodeId: node.id });
    if (node.type === "decision") {
      const incomingFromActivity = ins.filter((edge) => nodeById.get(edge.sourceNodeId)?.type === "activity");
      if (ins.length !== 1 || incomingFromActivity.length !== 1) add({ id: id(`decision-input-${node.id}`), severity: "error", message: "Decision needs exactly one incoming flow from an activity.", nodeId: node.id });
      if (outs.length < 2) add({ id: id(`decision-branches-${node.id}`), severity: "error", message: "Decision needs at least two uniquely guarded outgoing flows.", nodeId: node.id });
      const guards = new Set<string>();
      for (const edge of outs) {
        const guard = edge.guardLabel.trim().toLowerCase();
        if (!guard) add({ id: id(`guard-${edge.id}`), severity: "error", message: "Decision branch needs a guard label.", edgeId: edge.id });
        else if (guards.has(guard)) add({ id: id(`duplicate-guard-${edge.id}`), severity: "error", message: `Duplicate decision guard: ${edge.guardLabel}`, edgeId: edge.id });
        guards.add(guard);
      }
    }
    if (node.type === "merge") {
      if (ins.length < 2) add({ id: id(`merge-inputs-${node.id}`), severity: "error", message: "Merge needs at least two incoming flows.", nodeId: node.id });
      if (outs.length !== 1) add({ id: id(`merge-output-${node.id}`), severity: "error", message: "Merge needs exactly one outgoing flow.", nodeId: node.id });
    }
    if (node.type === "fork") {
      if (ins.length !== 1) add({ id: id(`fork-input-${node.id}`), severity: "warning", message: "A fork needs exactly one incoming flow.", nodeId: node.id });
      if (outs.length < 2) add({ id: id(`fork-output-${node.id}`), severity: "warning", message: "A fork needs at least two outgoing flows.", nodeId: node.id });
    }
    if (node.type === "join") {
      if (ins.length < 2) add({ id: id(`join-input-${node.id}`), severity: "warning", message: "A join needs at least two incoming flows.", nodeId: node.id });
      if (outs.length !== 1) add({ id: id(`join-output-${node.id}`), severity: "warning", message: "A join needs exactly one outgoing flow.", nodeId: node.id });
    }
    if (process.lanes.length && !node.laneId) add({ id: id(`lane-${node.id}`), severity: "info", message: `${label} is outside every swimlane.`, nodeId: node.id });
  }

  if (starts.length === 1) {
    const reachable = new Set<string>(); const stack = [starts[0].id];
    while (stack.length) { const nodeId = stack.pop()!; if (reachable.has(nodeId)) continue; reachable.add(nodeId); stack.push(...(outgoing.get(nodeId) ?? []).map((edge) => edge.targetNodeId)) }
    process.nodes.filter((node) => !reachable.has(node.id)).forEach((node) => add({ id: id(`unreachable-${node.id}`), severity: "warning", message: `${node.label || node.type} cannot be reached from the initial node.`, nodeId: node.id }));
  }
  return findings;
}

export function validateDiagram(document: DiagramDocument): ValidationFinding[] {
  return document.processes.flatMap((process) => validateProcess(process, document.appearance));
}
