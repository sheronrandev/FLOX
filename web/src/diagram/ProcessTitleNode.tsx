import type { KeyboardEvent } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { GripHorizontal } from "lucide-react";
import { useDiagramStore } from "../store/diagram-store";

interface ProcessTitleData extends Record<string, unknown> {
  processId: string;
  name: string;
  width: number;
  textColor: string;
  fontSize: number;
  lineHeight: number;
  titleHeight: number;
  lines: string[];
  readOnly: boolean;
}

export type ProcessTitleFlowNode = Node<ProcessTitleData, "process-title">;

export function ProcessTitleNode({ data }: NodeProps<ProcessTitleFlowNode>) {
  function nudge(event: KeyboardEvent<HTMLButtonElement>) {
    if (data.readOnly || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const store = useDiagramStore.getState();
    const process = store.document.processes.find((entry) => entry.id === data.processId);
    if (!process) return;
    const amount = event.shiftKey ? 20 : 4;
    const delta = event.key === "ArrowLeft" ? { x: -amount, y: 0 }
      : event.key === "ArrowRight" ? { x: amount, y: 0 }
        : event.key === "ArrowUp" ? { x: 0, y: -amount } : { x: 0, y: amount };
    store.beginGesture();
    store.moveProcess(process.id, { x: process.position.x + delta.x, y: process.position.y + delta.y });
    store.endGesture();
  }

  return <div className="process-title-node" style={{ width: data.width, height: data.titleHeight, color: data.textColor }}>
    <button
      type="button"
      className="process-title-node__handle"
      style={{ fontSize: `${data.fontSize}px`, lineHeight: `${data.lineHeight}px` }}
      aria-label={`Move process ${data.name}`}
      aria-describedby={`process-title-help-${data.processId}`}
      disabled={data.readOnly}
      onKeyDown={nudge}
    >
      <GripHorizontal aria-hidden="true" />
      <span>{data.lines.join("\n")}</span>
    </button>
    <span id={`process-title-help-${data.processId}`} className="sr-only">Drag the title row, or use arrow keys to move this complete process. Hold Shift for larger steps.</span>
  </div>;
}
