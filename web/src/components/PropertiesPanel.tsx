import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { resolveNodeStyle } from "../domain/notation";
import { useDiagramStore } from "../store/diagram-store";
import { Button } from "./ui/button";
import { processAtEdge, processAtNode } from "../domain/process-layout";
import { resolveEdgeColor } from "../domain/diagram";

interface PropertyDraft {
  label: string;
  state: string;
  body: string;
  fill: string;
  stroke: string;
  textColor: string;
  flowType: "control-flow" | "object-flow";
  width: number;
  dash: "solid" | "dashed" | "dotted";
}

function TextField({ label, value, onChange, multiline = false, maxLength = 500 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength?: number;
}) {
  return <label className="property-field">
    <span>{label}</span>
    {multiline
      ? <textarea value={value} maxLength={maxLength} rows={4} onChange={(event) => onChange(event.target.value)} />
      : <input value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />}
  </label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-field">
    <span>{label}</span>
    <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
  </label>;
}

export function PropertiesPanel({ readOnly = false }: { readOnly?: boolean }) {
  const document = useDiagramStore((store) => store.document);
  const selectedNodeIds = useDiagramStore((store) => store.selectedNodeIds);
  const selectedEdgeIds = useDiagramStore((store) => store.selectedEdgeIds);
  const setSelection = useDiagramStore((store) => store.setSelection);
  const setPropertiesDirty = useDiagramStore((store) => store.setPropertiesDirty);
  const updateNode = useDiagramStore((store) => store.updateNode);
  const updateEdge = useDiagramStore((store) => store.updateEdge);

  const nodeProcess = selectedNodeIds.length === 1 ? processAtNode(document, selectedNodeIds[0]) : undefined;
  const edgeProcess = selectedEdgeIds.length === 1 ? processAtEdge(document, selectedEdgeIds[0]) : undefined;
  const node = nodeProcess?.nodes.find((entry) => entry.id === selectedNodeIds[0]);
  const edge = edgeProcess?.edges.find((entry) => entry.id === selectedEdgeIds[0]);
  const targetKey = node ? `node:${node.id}` : edge ? `edge:${edge.id}` : "";

  const initial = useMemo<PropertyDraft | null>(() => {
    if (node) {
      const style = resolveNodeStyle(node);
      return {
        label: node.label,
        state: node.state ?? "",
        body: node.body ?? "",
        fill: style.fill,
        stroke: style.stroke,
        textColor: style.textColor,
        flowType: "control-flow",
        width: 1.5,
        dash: "solid",
      };
    }
    if (edge) return {
      label: edge.guardLabel,
      state: "",
      body: "",
      fill: "#ffffff",
      stroke: resolveEdgeColor(edge),
      textColor: "#181c1c",
      flowType: edge.type,
      width: edge.style?.width ?? 1.5,
      dash: edge.style?.dash ?? (edge.type === "object-flow" ? "dashed" : "solid"),
    };
    return null;
  }, [edge, node]);

  const [draft, setDraft] = useState<PropertyDraft | null>(initial);
  useEffect(() => setDraft(initial), [initial, targetKey]);
  const dirty = Boolean(initial && draft && JSON.stringify(initial) !== JSON.stringify(draft));
  useEffect(() => {
    setPropertiesDirty(dirty);
    return () => setPropertiesDirty(false);
  }, [dirty, setPropertiesDirty]);

  if (!initial || !draft) return null;
  const updateDraft = (patch: Partial<PropertyDraft>) => setDraft((current) => current ? { ...current, ...patch } : current);

  function close() {
    if (dirty && !window.confirm("Discard unsaved property changes?")) return;
    setPropertiesDirty(false);
    setSelection([], []);
  }

  function save() {
    const values = draft;
    if (readOnly || !dirty || !values) return;
    if (node) {
      updateNode(node.id, {
        label: values.label,
        ...(node.type === "object-in-state" ? { state: values.state } : {}),
        ...(node.type === "constraint" ? { body: values.body } : {}),
        style: { fill: values.fill, stroke: values.stroke, textColor: values.textColor },
      });
    } else if (edge) {
      updateEdge(edge.id, {
        guardLabel: values.label,
        type: values.flowType,
        style: { stroke: values.stroke, width: values.width, dash: values.dash },
      });
    }
    setPropertiesDirty(false);
  }

  const heading = node?.type ?? edge?.type;
  return (
    <aside className={`properties-panel${readOnly ? " is-read-only" : ""}`} aria-label="Properties">
      <div className="properties-heading">
        <div><span>Properties</span><strong>{heading?.replaceAll("-", " ")}</strong></div>
        <Button variant="ghost" size="icon" onPointerDown={(event) => event.stopPropagation()} onClick={close} aria-label="Close properties"><X /></Button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        <fieldset className="properties-fields" disabled={readOnly}>
          {node && <>
            {node.type !== "decision" && <TextField label={node.type === "object-in-state" ? "Object name" : node.type === "constraint" ? "Constraint name" : "Label"} value={draft.label} onChange={(label) => updateDraft({ label })} />}
            {node?.type === "object-in-state" && <TextField label="State" value={draft.state} maxLength={200} onChange={(state) => updateDraft({ state })} />}
            {node?.type === "constraint" && <TextField label="Body" value={draft.body} maxLength={1_000} multiline onChange={(body) => updateDraft({ body })} />}
            <div className="property-group-label">Component colors</div>
            <ColorField label="Fill" value={draft.fill} onChange={(fill) => updateDraft({ fill })} />
            <ColorField label="Border" value={draft.stroke} onChange={(stroke) => updateDraft({ stroke })} />
            {node.type !== "decision" && <ColorField label="Text" value={draft.textColor} onChange={(textColor) => updateDraft({ textColor })} />}
            {node && <p className="property-help">Drag any green anchor to another component to create a flow.</p>}
          </>}
          {edge && <>
            <TextField label="Guard label" value={draft.label} onChange={(label) => updateDraft({ label })} />
            <label className="property-field">
              <span>Flow type</span>
              <select value={draft.flowType} onChange={(event) => updateDraft({ flowType: event.target.value as PropertyDraft["flowType"] })}>
                <option value="control-flow">Control flow</option>
                <option value="object-flow">Object flow</option>
              </select>
            </label>
            <div className="property-group-label">Connector style</div>
            <ColorField label="Color" value={draft.stroke} onChange={(stroke) => updateDraft({ stroke })} />
            <label className="property-field">
              <span>Line width</span>
              <input type="number" min={1} max={6} step={0.5} value={draft.width} onChange={(event) => updateDraft({ width: Number(event.target.value) })} />
            </label>
            <label className="property-field">
              <span>Line pattern</span>
              <select value={draft.dash} onChange={(event) => updateDraft({ dash: event.target.value as PropertyDraft["dash"] })}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </label>
            <p className="property-help">Guard labels appear at the midpoint of the routed connector.</p>
          </>}
        </fieldset>
        {!readOnly && <div className="properties-actions">
          <Button type="button" variant="outline" onClick={() => setDraft(initial)} disabled={!dirty}>Cancel</Button>
          <Button type="submit" disabled={!dirty}>Save</Button>
        </div>}
      </form>
    </aside>
  );
}
