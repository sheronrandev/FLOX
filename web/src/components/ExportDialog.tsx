import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { DiagramDocument } from "../domain/diagram";
import type { ExportPreferences } from "../domain/preferences";
import { downloadBlob, exportDiagramImage, safeExportName } from "../diagram/export-diagram";
import { buildWorkspaceManifest, type ExportFormat } from "../diagram/process-export";
import { encodeExportArchive, orderWorkspaceRecords } from "../diagram/workspace-export";
import { useDialogFocus } from "../hooks/use-dialog-focus";
import { recordFor, type ProjectRecord, type ProjectRepository } from "../persistence/project-repository";
import { Button } from "./ui/button";

type ExportScope = "current" | "all-in-one" | "separate";

export function ExportDialog({ document, currentProjectId, repository, workspaceCount, defaults, initialFormat, onDefaultsChange = () => undefined, onClose }: {
  document: DiagramDocument;
  currentProjectId: string;
  repository: ProjectRepository;
  workspaceCount: number;
  defaults: ExportPreferences;
  initialFormat: ExportFormat;
  onDefaultsChange?: (preferences: ExportPreferences) => void;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [scope, setScope] = useState<ExportScope>("current");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [imageScale, setImageScale] = useState<1 | 2 | 3>(defaults.imageScale);
  const [rememberScale, setRememberScale] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, onClose);
  const batch = scope !== "current";
  const actionLabel = batch ? "Export ZIP" : `Export ${format.toUpperCase()}`;
  const helper = useMemo(() => batch
    ? "Batch exports download a ZIP archive. No partial archive is created if a diagram cannot be read."
    : "The current diagram downloads as one file.", [batch]);

  async function workspaceRecords(): Promise<ProjectRecord[]> {
    const summaries = await repository.list();
    const ordered = [...summaries].sort((a, b) => {
      if (a.id === currentProjectId) return -1;
      if (b.id === currentProjectId) return 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    const records: ProjectRecord[] = [];
    for (let index = 0; index < ordered.length; index += 1) {
      const summary = ordered[index];
      setProgress(`Preparing ${index + 1} of ${ordered.length}`);
      if (summary.id === currentProjectId) records.push(recordFor(currentProjectId, document));
      else {
        const record = await repository.get(summary.id);
        if (!record) throw new Error(`Could not read diagram “${summary.title}”. Export stopped.`);
        records.push(record);
      }
    }
    return orderWorkspaceRecords(records, currentProjectId);
  }

  async function run() {
    setExporting(true);
    setError("");
    try {
      const preferences = { ...defaults, imageScale };
      if (scope === "current") {
        setProgress("Preparing 1 of 1");
        if (format === "json") downloadBlob(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }), `${safeExportName(document.metadata.title)}.json`);
        else await exportDiagramImage(document, format, preferences);
      } else {
        const records = await workspaceRecords();
        const organization = format === "json" && scope === "all-in-one" ? "project-wise" : "diagram-wise";
        const archive = await encodeExportArchive(buildWorkspaceManifest(records, format, organization), format, preferences, (current, total) => setProgress(`Preparing ${current} of ${total}`));
        const bytes = new Uint8Array(archive.byteLength);
        bytes.set(archive);
        downloadBlob(new Blob([bytes.buffer], { type: "application/zip" }), `flox-workspace-${scope}-${format}.zip`);
      }
      if (format === "png" && rememberScale) onDefaultsChange(preferences);
      setProgress("Export ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Export failed");
      setProgress("");
    } finally {
      setExporting(false);
    }
  }

  return createPortal(<div className="export-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="export-dialog export-dialog--workspace" role="dialog" aria-modal="true" aria-labelledby="export-title" tabIndex={-1}>
      <header><div><span><Download aria-hidden="true" /> Workspace export</span><h2 id="export-title">Export diagrams</h2><p>Choose a format and how much of this workspace to include.</p></div><Button variant="ghost" size="icon" aria-label="Close export" onClick={onClose}><X aria-hidden="true" /></Button></header>
      <div className="workspace-export-options">
        <fieldset><legend>Format</legend><div className="export-choice-grid export-choice-grid--format">{(["json", "png", "svg"] as const).map((value) => <label key={value} className={format === value ? "is-selected" : ""}><input type="radio" name="format" value={value} checked={format === value} onChange={() => setFormat(value)} /><span>{value.toUpperCase()}</span></label>)}</div></fieldset>
        {workspaceCount > 1 && <fieldset><legend>Scope <small>{workspaceCount} diagrams in workspace</small></legend><div className="export-choice-grid">{([
          ["current", "Current diagram"], ["all-in-one", "All in one"], ["separate", "Export separately"],
        ] as const).map(([value, label]) => <label key={value} className={scope === value ? "is-selected" : ""}><input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} /><span>{label}</span></label>)}</div></fieldset>}
        <p className="workspace-export-helper">{helper}</p>
        {format === "png" && <div className="workspace-export-settings">
          <label>PNG quality<select value={imageScale} aria-label="PNG quality" onChange={(event) => setImageScale(Number(event.target.value) as 1 | 2 | 3)}><option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option></select></label>
          <label className="workspace-export-remember"><input type="checkbox" checked={rememberScale} onChange={(event) => setRememberScale(event.target.checked)} /><span>Remember as default<small>Saved only after a successful PNG export.</small></span></label>
          <span>{defaults.transparentBackground ? "Transparent background" : "Canvas background"}</span>
        </div>}
        {error && <p className="workspace-export-error" role="alert"><AlertTriangle aria-hidden="true" /> {error}</p>}
        <div className="workspace-export-progress" aria-live="polite" aria-atomic="true">
          {progress && <><span>{progress}</span>{exporting && <progress max={Math.max(1, workspaceCount)} value={Number(progress.match(/\d+/)?.[0] ?? 0)} />}</>}
        </div>
        <div className="export-dialog__actions"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={exporting} aria-busy={exporting} onClick={() => void run()}><Download aria-hidden="true" /> {exporting ? "Preparing…" : actionLabel}</Button></div>
      </div>
    </section>
  </div>, window.document.body);
}
