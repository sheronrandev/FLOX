/// <reference lib="webworker" />
import type { DiagramEdge, DiagramNode } from "../domain/diagram";
import { routeAll } from "./routing";
import type { NodeLayoutSettings } from "../domain/notation";

self.onmessage = (event: MessageEvent<{ requestId: number; nodes: DiagramNode[]; edges: DiagramEdge[]; settings?: NodeLayoutSettings }>) => {
  self.postMessage({ requestId: event.data.requestId, routes: routeAll(event.data.nodes, event.data.edges, event.data.settings) });
};

export {};
