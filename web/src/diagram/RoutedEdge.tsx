import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { guardLabelPoint, pointsToPath, type Point } from "./routing";

export interface RoutedEdgeData extends Record<string, unknown> {
  points?: Point[];
  guardLabel?: string;
  labelColor?: string;
  haloColor?: string;
  fontSize?: number;
  onSelect?: () => void;
}

export function RoutedEdge(props: EdgeProps) {
  const data = props.data as RoutedEdgeData | undefined;
  const points = data?.points ?? [];
  const fallback = getSmoothStepPath(props);
  const path = points.length > 1 ? pointsToPath(points) : fallback[0];
  const labelPoint = points.length > 1
    ? guardLabelPoint(points, data?.guardLabel ?? "", data?.fontSize ?? 12)
    : { x: fallback[1], y: fallback[2] - (data?.fontSize ?? 12) - 7 };
  const edgeWidth = typeof props.style?.strokeWidth === "number" ? props.style.strokeWidth : Number(props.style?.strokeWidth) || 1.5;
  return (
    <>
      <path
        aria-hidden="true"
        d={path}
        fill="none"
        pointerEvents="none"
        stroke={data?.haloColor ?? "var(--canvas)"}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={edgeWidth + 4}
      />
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={props.style}
        interactionWidth={props.interactionWidth ?? 24}
      />
      <path
        aria-label="Select connector"
        className="uml-edge-hit-area"
        d={path}
        fill="none"
        onClick={(event) => {
          event.stopPropagation();
          data?.onSelect?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            data?.onSelect?.();
          }
        }}
        role="button"
        tabIndex={0}
      />
      {data?.guardLabel && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="edge-label nodrag nopan"
            style={{
              background: "#ffffff",
              borderColor: data.labelColor ?? "#000000",
              color: data.labelColor ?? "#000000",
              transform: `translate(-50%, -50%) translate(${labelPoint.x}px,${labelPoint.y}px)`,
            }}
            onClick={(event) => {
              event.stopPropagation();
              data.onSelect?.();
            }}
            aria-label={`Select connector with guard ${data.guardLabel}`}
          >
            {data.guardLabel}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
