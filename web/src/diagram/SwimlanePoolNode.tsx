import type { Node, NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { DiagramProcess } from "../domain/diagram";
import { getSwimlanePoolGeometry } from "../domain/swimlane-layout";
import type { NodeLayoutSettings } from "../domain/notation";

interface PoolLaneData {
  id: string;
  label: string;
  width: number;
  colorIndex: number;
  fill?: string;
  textColor?: string;
}

interface SwimlanePoolData extends Record<string, unknown> {
  processId: string;
  title: string;
  width: number;
  height: number;
  titleHeight: number;
  laneHeight: number;
  lanes: PoolLaneData[];
}

export type SwimlanePoolFlowNode = Node<SwimlanePoolData, "swimlane-pool">;

export function buildSwimlanePoolNode(process: DiagramProcess, settings?: NodeLayoutSettings): SwimlanePoolFlowNode {
  const geometry = getSwimlanePoolGeometry(process, settings);
  return {
    id: `__process-pool-${process.id}`,
    type: "swimlane-pool",
    position: { x: geometry.x, y: geometry.y },
    data: {
      processId: process.id,
      title: process.name,
      width: geometry.width,
      height: geometry.height,
      titleHeight: geometry.titleHeight,
      laneHeight: geometry.laneHeight,
      lanes: process.lanes.map((lane) => ({
        id: lane.id,
        label: lane.name,
        width: lane.width,
        colorIndex: lane.colorIndex,
        fill: lane.style?.fill,
        textColor: lane.style?.textColor,
      })),
    },
    style: { width: geometry.width, height: geometry.height },
    draggable: false,
    selectable: false,
    connectable: false,
    deletable: false,
    focusable: false,
    zIndex: -10,
  };
}

export function SwimlanePoolNode({ data }: NodeProps<SwimlanePoolFlowNode>) {
  const style = {
    width: data.width,
    height: data.height,
    "--pool-title-height": `${data.titleHeight}px`,
    "--pool-lane-height": `${data.laneHeight}px`,
    gridTemplateColumns: data.lanes.map((lane) => `${lane.width}px`).join(" "),
  } as CSSProperties;
  return <div className="swimlane-pool" style={style} aria-hidden="true">
    <div className="swimlane-pool__title" />
    <div className="swimlane-pool__title-rule" />
    <div className="swimlane-pool__lanes">
      {data.lanes.map((lane, index) => <div
        key={lane.id}
        className={`swimlane-pool__lane swimlane-pool__lane--${lane.colorIndex}`}
        style={{ width: lane.width, background: lane.fill ?? "#ffffff", color: lane.textColor } as CSSProperties}
      >
        <span>{lane.label}</span>
        {index < data.lanes.length - 1 && <i className="swimlane-pool__separator" />}
      </div>)}
    </div>
    {!data.lanes.length && <div className="swimlane-pool__empty">Add a swimlane</div>}
  </div>;
}
