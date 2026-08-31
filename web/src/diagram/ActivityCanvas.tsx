import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Background,
  ConnectionMode,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  type Edge,
  type EdgeChange,
  type Connection,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { Focus, Keyboard, X, ZoomIn, ZoomOut } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { useDiagramStore } from "../store/diagram-store";
import { UmlNode, type UmlFlowNode } from "./UmlNode";
import { buildSwimlanePoolNode, SwimlanePoolNode, type SwimlanePoolFlowNode } from "./SwimlanePoolNode";
import { RoutedEdge } from "./RoutedEdge";
import { routeAll, type Point } from "./routing";
import { areConnectionHandlesAvailable, canConnectNodes, flattenProcesses, indexOccupiedExclusiveAnchors, processAtNode } from "../domain/process-layout";
import { getProcessTitleLayout, getSwimlanePoolGeometry, SWIMLANE_POOL_X, SWIMLANE_LANE_Y } from "../domain/swimlane-layout";
import { ProcessTitleNode, type ProcessTitleFlowNode } from "./ProcessTitleNode";
import { defaultNodeStyles, getNodeDimensions, resolveNodeStyle } from "../domain/notation";
import { GuardLabelDialog } from "./GuardLabelDialog";
import { resolveEdgeColor } from "../domain/diagram";

const nodeTypes = {
  activity: UmlNode,
  state: UmlNode,
  "object-in-state": UmlNode,
  decision: UmlNode,
  merge: UmlNode,
  fork: UmlNode,
  join: UmlNode,
  initial: UmlNode,
  final: UmlNode,
  constraint: UmlNode,
  note: UmlNode,
  "swimlane-pool": SwimlanePoolNode,
  "process-title": ProcessTitleNode,
};
const edgeTypes = { routed: RoutedEdge };

type CanvasNode = UmlFlowNode | SwimlanePoolFlowNode | ProcessTitleFlowNode;

export function ActivityCanvas({ readOnly = false }: { readOnly?: boolean }) {
  const document = useDiagramStore((state) => state.document);
  const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useDiagramStore((state) => state.selectedEdgeIds);
  const moveNode = useDiagramStore((state) => state.moveNode);
  const moveProcess = useDiagramStore((state) => state.moveProcess);
  const beginGesture = useDiagramStore((state) => state.beginGesture);
  const endGesture = useDiagramStore((state) => state.endGesture);
  const removeNodes = useDiagramStore((state) => state.removeNodes);
  const removeEdges = useDiagramStore((state) => state.removeEdges);
  const connect = useDiagramStore((state) => state.connect);
  const [dragging, setDragging] = useState(false);
  const [routes, setRoutes] = useState<Record<string, Point[]>>({});
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pendingDecisionConnection, setPendingDecisionConnection] = useState<Connection | null>(null);
  const [connectionAnnouncement, setConnectionAnnouncement] = useState("");
  const routingRequest = useRef(0);
  const invalidConnectionMessage = useRef("");
  const decisionSourceNode = useRef<HTMLElement | null>(null);
  const flow = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const flat = useMemo(() => flattenProcesses(document), [document]);
  const occupiedAnchors = useMemo(() => indexOccupiedExclusiveAnchors(document), [document]);

  const requestSelection = useCallback((nodeIds: string[], edgeIds: string[]) => {
    const state = useDiagramStore.getState();
    const changed = nodeIds.join("|") !== state.selectedNodeIds.join("|") || edgeIds.join("|") !== state.selectedEdgeIds.join("|");
    if (!changed) return;
    if (state.propertiesDirty && !window.confirm("Discard unsaved property changes?")) return;
    state.setPropertiesDirty(false);
    state.setSelection(nodeIds, edgeIds);
  }, []);

  useEffect(() => {
    if (dragging) {
      setRoutes({});
      return;
    }
    const requestId = ++routingRequest.current;
    if (typeof Worker === "undefined") {
      setRoutes(routeAll(flat.nodes, flat.edges, document.appearance));
      return;
    }
    const worker = new Worker(new URL("./routing.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ requestId: number; routes: Record<string, Point[]> }>) => {
      if (event.data.requestId === routingRequest.current) setRoutes(event.data.routes);
      worker.terminate();
    };
    worker.postMessage({ requestId, nodes: flat.nodes, edges: flat.edges, settings: document.appearance });
    return () => worker.terminate();
  }, [document.appearance, dragging, flat]);

  const nodes = useMemo<CanvasNode[]>(() => {
    const pools = document.processes.map((process) => buildSwimlanePoolNode(process, document.appearance));
    const titles: ProcessTitleFlowNode[] = document.processes.map((process) => {
      const geometry = getSwimlanePoolGeometry(process, document.appearance);
      const titleLayout = getProcessTitleLayout(process.name, geometry.width, document.appearance);
      return {
        id: `__process-title-${process.id}`,
        type: "process-title",
        position: { x: geometry.x, y: geometry.y },
        data: {
          processId: process.id,
          name: process.name,
          width: geometry.width,
          textColor: defaultNodeStyles.activity.textColor,
          fontSize: titleLayout.fontSize,
          lineHeight: titleLayout.lineHeight,
          titleHeight: geometry.titleHeight,
          lines: titleLayout.lines,
          readOnly,
        },
        style: { width: geometry.width, height: geometry.titleHeight },
        draggable: !readOnly,
        dragHandle: ".process-title-node__handle",
        selectable: false,
        connectable: false,
        deletable: false,
        focusable: false,
        zIndex: 0,
      };
    });
    const diagramNodes: UmlFlowNode[] = flat.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        label: node.label,
        diagramType: node.type,
        state: node.state,
        body: node.body,
        ...resolveNodeStyle(node),
        occupiedAnchors: [...(occupiedAnchors.get(node.id) ?? [])],
      },
      selected: selectedNodeIds.includes(node.id),
      draggable: !readOnly,
      connectable: !readOnly,
      zIndex: 1,
      style: getNodeDimensions(node, document.appearance),
    }));
    return [...pools, ...titles, ...diagramNodes];
  }, [document.appearance, document.processes, flat.nodes, occupiedAnchors, readOnly, selectedNodeIds]);

  const edges = useMemo<Edge[]>(() => flat.edges.map((edge) => {
    const color = resolveEdgeColor(edge);
    return {
      id: edge.id,
      source: edge.sourceNodeId,
      sourceHandle: edge.sourceAnchorId,
      target: edge.targetNodeId,
      targetHandle: edge.targetAnchorId,
      type: "routed",
      data: {
        points: routes[edge.id],
        guardLabel: edge.guardLabel || undefined,
        labelColor: color,
        haloColor: document.appearance.canvasColor,
        fontSize: document.appearance.nodeFontSize,
        onSelect: () => requestSelection([], [edge.id]),
      },
      markerEnd: { type: MarkerType.ArrowClosed, markerUnits: "userSpaceOnUse", color },
      style: {
        stroke: color,
        strokeWidth: edge.style?.width ?? 1.5,
        strokeDasharray: edge.style?.dash === "dotted" ? "2 5" : edge.style?.dash === "dashed" || (!edge.style?.dash && edge.type === "object-flow") ? "7 5" : undefined,
      },
      selected: selectedEdgeIds.includes(edge.id),
      selectable: true,
      interactionWidth: 24,
      focusable: true,
    };
  }), [document.appearance.canvasColor, flat.edges, requestSelection, routes, selectedEdgeIds]);

  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    const removed: string[] = [];
    for (const change of changes) {
      if (change.type === "add") continue;
      if (change.id.startsWith("__process-pool-")) continue;
      if (change.id.startsWith("__process-title-")) {
        if (change.type === "position" && change.position) {
          const processId = change.id.slice("__process-title-".length);
          const process = document.processes.find((entry) => entry.id === processId);
          if (!process) continue;
          const geometry = getSwimlanePoolGeometry(process, document.appearance);
          moveProcess(processId, { x: change.position.x - SWIMLANE_POOL_X, y: change.position.y - SWIMLANE_LANE_Y + geometry.titleHeight });
        }
        continue;
      }
      if (change.type === "position" && change.position) moveNode(change.id, change.position);
      if (change.type === "remove") removed.push(change.id);
    }
    if (removed.length) removeNodes(removed);
  }, [document.appearance, document.processes, moveNode, moveProcess, removeNodes]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = changes.filter((change) => change.type === "remove").map((change) => change.id);
    if (removed.length) removeEdges(removed);
  }, [removeEdges]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: CanvasNode[]; edges: Edge[] }) => {
    // Empty React Flow selection events can follow clicks handled by a custom edge.
    // Pane clicks are the authoritative way to clear the application selection.
    if (!selectedNodes.length && !selectedEdges.length) return;
    const nodeIds = selectedNodes.filter((node) => !node.id.startsWith("__process-")).map((node) => node.id);
    const edgeIds = selectedEdges.map((edge) => edge.id);
    requestSelection(nodeIds, edgeIds);
  }, [requestSelection]);

  const clearSelection = useCallback(() => requestSelection([], []), [requestSelection]);
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const nodesAreCompatible = canConnectNodes(document, connection.source, connection.target);
    const handlesAreAvailable = areConnectionHandlesAvailable(document, connection.source, connection.sourceHandle ?? null, connection.target, connection.targetHandle ?? null);
    const source = processAtNode(document, connection.source); const target = processAtNode(document, connection.target);
    invalidConnectionMessage.current = source && target && source.id !== target.id
      ? "Flows cannot cross process boundaries."
      : nodesAreCompatible && !handlesAreAvailable
        ? "That decision or merge connection point is already in use."
        : "";
    return nodesAreCompatible && handlesAreAvailable;
  }, [document]);

  const createConnection = useCallback((connection: Connection) => {
    const sourceProcess = processAtNode(document, connection.source);
    const sourceNode = sourceProcess?.nodes.find((node) => node.id === connection.source);
    if (sourceNode?.type === "decision") {
      decisionSourceNode.current = [...window.document.querySelectorAll<HTMLElement>(".react-flow__node")]
        .find((element) => element.dataset.id === sourceNode.id) ?? null;
      setPendingDecisionConnection(connection);
      return;
    }
    connect(connection);
  }, [connect, document]);

  function submitDecisionGuard(guardLabel: string) {
    if (!pendingDecisionConnection) return;
    connect(pendingDecisionConnection, guardLabel);
    setPendingDecisionConnection(null);
    setConnectionAnnouncement(`Decision flow created with guard ${guardLabel}.`);
    window.requestAnimationFrame(() => decisionSourceNode.current?.focus());
  }

  useEffect(() => {
    function focusProcess(event: Event) {
      const processId = (event as CustomEvent<string>).detail;
      const process = document.processes.find((entry) => entry.id === processId);
      if (!process) return;
      const geometry = getSwimlanePoolGeometry(process, document.appearance);
      void flow.current?.fitBounds(
        { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height },
        { padding: 0.22, duration: document.processes.length > 20 ? 0 : 180 },
      );
    }
    window.addEventListener("flox:focus-process", focusProcess);
    return () => window.removeEventListener("flox:focus-process", focusProcess);
  }, [document.appearance, document.processes]);

  useEffect(() => {
    function canvasShortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (event.key === "Escape") {
        clearSelection();
        setShortcutsOpen(false);
      } else if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((open) => !open);
      } else if (modifier && ["+", "="].includes(event.key)) {
        event.preventDefault();
        void flow.current?.zoomIn({ duration: 140 });
      } else if (modifier && event.key === "-") {
        event.preventDefault();
        void flow.current?.zoomOut({ duration: 140 });
      } else if (modifier && event.key === "0") {
        event.preventDefault();
        void flow.current?.fitView({ padding: 0.22, duration: 180 });
      }
    }
    window.addEventListener("keydown", canvasShortcuts);
    return () => window.removeEventListener("keydown", canvasShortcuts);
  }, [clearSelection]);

  return (
    <div className="canvas-stage" aria-label="Activity diagram editor" style={{
      background: document.appearance.canvasColor,
      "--diagram-font-size": `${document.appearance.nodeFontSize}px`,
      "--diagram-line-height": `${document.appearance.nodeFontSize + 4}px`,
      "--diagram-node-padding-x": `${document.appearance.nodeInnerPadding}px`,
      "--diagram-node-padding-y": `${Math.max(2, document.appearance.nodeInnerPadding - 2)}px`,
    } as CSSProperties}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => { flow.current = instance; }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeClick={(_, edge) => requestSelection([], [edge.id])}
        onConnect={readOnly ? undefined : createConnection}
        isValidConnection={isValidConnection}
        onConnectEnd={() => {
          setConnectionAnnouncement(invalidConnectionMessage.current);
          invalidConnectionMessage.current = "";
        }}
        onNodeDragStart={() => { setDragging(true); beginGesture(); }}
        onNodeDragStop={() => { endGesture(); setDragging(false); }}
        onSelectionChange={onSelectionChange}
        onPaneClick={clearSelection}
        connectionMode={ConnectionMode.Loose}
        selectionOnDrag
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
        defaultEdgeOptions={{ type: "routed", markerEnd: { type: MarkerType.ArrowClosed, markerUnits: "userSpaceOnUse" } }}
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.2}
        maxZoom={2.5}
        onlyRenderVisibleElements
        fitView
        fitViewOptions={{ padding: 0.22 }}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
      >
        <Background gap={20} size={1} color={document.appearance.gridColor} />
        <MiniMap pannable zoomable className="canvas-minimap" maskColor="color-mix(in srgb, var(--canvas) 72%, transparent)" />
        <Panel position="top-center" className="canvas-hint nodrag nopan"><span>Space + drag to pan</span><span>Scroll to zoom</span><button type="button" onClick={() => setShortcutsOpen(true)}><Keyboard /> Shortcuts</button></Panel>
        <Panel position="bottom-left" className="canvas-controls nodrag nopan"><button type="button" aria-label="Zoom in" onClick={() => void flow.current?.zoomIn({ duration: 140 })}><ZoomIn /></button><button type="button" aria-label="Zoom out" onClick={() => void flow.current?.zoomOut({ duration: 140 })}><ZoomOut /></button><span /><button type="button" aria-label="Fit diagram" onClick={() => void flow.current?.fitView({ padding: 0.22, duration: 180 })}><Focus /></button></Panel>
        {shortcutsOpen && <Panel position="top-right" className="shortcut-panel nodrag nopan">
          <header><div><Keyboard /><strong>Canvas shortcuts</strong></div><button type="button" aria-label="Close shortcuts" onClick={() => setShortcutsOpen(false)}><X /></button></header>
          <dl><div><dt>Pan canvas</dt><dd><kbd>Space</kbd> + drag</dd></div><div><dt>Zoom</dt><dd><kbd>Ctrl</kbd> <kbd>+</kbd> / <kbd>−</kbd></dd></div><div><dt>Fit diagram</dt><dd><kbd>Ctrl</kbd> <kbd>0</kbd></dd></div><div><dt>Duplicate</dt><dd><kbd>Ctrl</kbd> <kbd>D</kbd></dd></div><div><dt>Nudge</dt><dd><kbd>Arrow</kbd> · <kbd>Shift</kbd> × 4</dd></div><div><dt>Deselect / close</dt><dd><kbd>Esc</kbd></dd></div></dl>
        </Panel>}
      </ReactFlow>
      {pendingDecisionConnection && <GuardLabelDialog onSubmit={submitDecisionGuard} />}
      <span className="sr-only" role="status" aria-live="polite">{connectionAnnouncement}</span>
    </div>
  );
}
