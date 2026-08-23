import { useEffect, useMemo, useState } from "react";
import type { DiagramLane, SwimlaneLayout } from "../domain/diagram";
import { Button } from "./ui/button";

export interface LaneSettingsDraft {
  name: string;
  fill: string;
  width: number;
  heightMode: "automatic" | "fixed";
  height: number;
}

function initialDraft(lane: DiagramLane, layout: SwimlaneLayout): LaneSettingsDraft {
  return {
    name: lane.name,
    fill: lane.style?.fill ?? "#ffffff",
    width: lane.width,
    heightMode: layout.heightMode,
    height: layout.height,
  };
}

export function LanePropertiesForm({ lane, layout, onSave, onCancel, onDirtyChange }: {
  lane: DiagramLane;
  layout: SwimlaneLayout;
  onSave: (draft: LaneSettingsDraft) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const initial = useMemo(() => initialDraft(lane, layout), [lane, layout]);
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  return <form className="lane-properties-form" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
    <label><span>Label</span><input value={draft.name} maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
    <label><span>Fill color</span><input type="color" value={draft.fill} onChange={(event) => setDraft({ ...draft, fill: event.target.value })} /></label>
    <label><span>Width</span><input type="number" min={180} max={1200} value={draft.width} onChange={(event) => setDraft({ ...draft, width: Number(event.target.value) })} /></label>
    <label><span>Height mode</span><select value={draft.heightMode} onChange={(event) => setDraft({ ...draft, heightMode: event.target.value as LaneSettingsDraft["heightMode"] })}><option value="automatic">Automatic</option><option value="fixed">Fixed</option></select></label>
    {draft.heightMode === "fixed" && <label><span>Height</span><input type="number" min={320} max={5000} value={draft.height} onChange={(event) => setDraft({ ...draft, height: Number(event.target.value) })} /></label>}
    <p>Height is shared by the entire swimlane pool.</p>
    <div className="lane-properties-form__actions"><Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button><Button type="submit" size="sm" disabled={!dirty}>Save</Button></div>
  </form>;
}
