import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { AnchorId, DiagramNodeType } from "../domain/diagram";
import { cn } from "../lib/utils";

export type UmlFlowNode = Node<{
  label: string;
  diagramType: DiagramNodeType;
  state?: string;
  body?: string;
  fill?: string;
  stroke?: string;
  textColor?: string;
  occupiedAnchors?: AnchorId[];
}, DiagramNodeType>;

const anchors = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

const compactTypes = new Set<DiagramNodeType>(["initial", "final", "fork", "join", "merge"]);

function NodeContent({ data }: { data: UmlFlowNode["data"] }) {
  if (data.diagramType === "object-in-state") {
    return <span className="uml-node__object-content">
      <strong>{data.label}</strong>
      <span>[{data.state}]</span>
    </span>;
  }
  if (data.diagramType === "constraint") {
    return <span className="uml-node__constraint-content">
      <small>«invariant»</small>
      <strong>{data.label}</strong>
      <span>{data.body}</span>
    </span>;
  }
  if (compactTypes.has(data.diagramType)) {
    return data.label ? <span className="uml-node__external-label">{data.label}</span> : null;
  }
  return <span className="uml-node__label">{data.label}</span>;
}

export function UmlNode({ data, selected }: NodeProps<UmlFlowNode>) {
  const style = {
    "--node-fill": data.fill,
    "--node-stroke": data.stroke,
    "--node-text": data.textColor,
  } as CSSProperties;
  const accessibleLabel = data.label || data.diagramType.replaceAll("-", " ");

  return (
    <div
      className={cn("uml-node", `uml-node--${data.diagramType}`, selected && "is-selected")}
      style={style}
      aria-label={`${data.diagramType}: ${accessibleLabel}`}
    >
      {anchors.map(({ id, position }) => (
        <Handle
          key={id}
          id={id}
          type="source"
          position={position}
          isConnectable={!data.occupiedAnchors?.includes(id)}
          className={cn("uml-anchor", data.occupiedAnchors?.includes(id) && "is-occupied")}
          aria-disabled={data.occupiedAnchors?.includes(id) || undefined}
          title={data.occupiedAnchors?.includes(id) ? `${id} connection point already in use` : `${id} connection point`}
        />
      ))}
      <div className="uml-node__shape" aria-hidden="true" />
      <NodeContent data={data} />
    </div>
  );
}
