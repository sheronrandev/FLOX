import { useRef, useState } from "react";
import { AlertTriangle, Download, X } from "lucide-react";
import { createPortal } from "react-dom";
import { parseDiagram, type DiagramDocument } from "../domain/diagram";
import type { ExportPreferences } from "../domain/preferences";
import { downloadBlob, exportDiagramImage, safeExportName } from "../diagram/export-diagram";
import {
  buildProjectProcessManifest,
  buildWorkspaceManifest,
  processExportFilename,
  sliceProcessDocument,
  type ExportFormat,
  type ExportManifestEntry,
  type JsonOrganization,
} from "../diagram/process-export";
import { encodeExportArchive, orderWorkspaceRecords } from "../diagram/workspace-export";
import { useDialogFocus } from "../hooks/use-dialog-focus";
import { recordFor, type ProjectRecord, type ProjectRepository } from "../persistence/project-repository";
import { Button } from "./ui/button";

type ExportScope = "selected" | "separate" | "project" | "all-in-one";

interface ExportDialogProps {
  document: DiagramDocument;
  activeProcessId: string | null;
  currentProjectId: string;
  repository: ProjectRepository;
  workspaceCount: number;
  defaults: ExportPreferences;
  initialFormat: ExportFormat;
  onDefaultsChange?: (preferences: ExportPreferences) => void;
  onClose: () => void;
}

function archiveBlob(archive: Uint8Array): Blob {
  const bytes = new Uint8Array(archive.byteLength);
  bytes.set(archive);
  return new Blob([bytes.buffer], { type: "application/zip" });
}

export function ExportDialog({
  document,
  activeProcessId,
  currentProjectId,
  repository,
  workspaceCount,
  defaults,
  initialFormat,
  onDefaultsChange = () => undefined,
  onClose,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [scope, setScope] = useState<ExportScope>("selected");
  const [jsonOrganization, setJsonOrganization] = useState<JsonOrganization>("diagram-wise");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressValue, setProgressValue] = useState(0);
  const [progressMax, setProgressMax] = useState(0);
  const [error, setError] = useState("");
  const [imageScale, setImageScale] = useState<1 | 2 | 3>(defaults.imageScale);
  const [rememberScale, setRememberScale] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, onClose);

  const selectedUnavailable = scope === "selected" && activeProcessId === null;
  const archive = scope === "separate" || scope === "all-in-one";
  const actionLabel = archive ? "Export ZIP" : `Export ${format.toUpperCase()}`;
  const scopes = format === "json"
    ? [["selected", "Export selected"], ["project", "Export project"], ["all-in-one", "All-in-one"]] as const
    : [["selected", "Export selected"], ["separate", "Export separately"], ["all-in-one", "All-in-one"]] as const;
  const workspaceCopy = `${workspaceCount} ${workspaceCount === 1 ? "project" : "projects"} in workspace`;
  const helper = scope === "selected"
    ? `The selected process downloads directly as one ${format.toUpperCase()} file.`
    : scope === "project"
      ? "The complete current project downloads directly as one JSON file."
      : scope === "separate"
        ? `Every process in the current project downloads together in one ${format.toUpperCase()} ZIP.`
        : `All projects in the workspace download together in one ${format.toUpperCase()} ZIP.`;

  function changeFormat(nextFormat: ExportFormat) {
    setFormat(nextFormat);
    setScope((currentScope) => {
      if (nextFormat === "json" && currentScope === "separate") return "project";
      if (nextFormat !== "json" && currentScope === "project") return "separate";
      return currentScope;
    });
  }

  async function workspaceRecords(): Promise<ProjectRecord[]> {
    const summaries = (await repository.list())
      .filter((summary) => summary.id !== currentProjectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const total = summaries.length + 1;
    const records: ProjectRecord[] = [recordFor(currentProjectId, document)];
    setProgress(`Loading project 1 of ${total}`);

    for (let index = 0; index < summaries.length; index += 1) {
      const summary = summaries[index];
      setProgress(`Loading project ${index + 2} of ${total}`);
      try {
        const record = await repository.get(summary.id);
        if (!record) throw new Error("Project record is missing");
        records.push({ ...record, document: parseDiagram(record.document) });
      } catch {
        throw new Error(`Could not read project “${summary.title}”. Export stopped.`);
      }
    }
    return orderWorkspaceRecords(records, currentProjectId);
  }

  async function encodeAndDownload(entries: ExportManifestEntry[], exportFormat: ExportFormat, preferences: ExportPreferences, filename: string) {
    setProgressValue(0);
    setProgressMax(entries.length);
    const encoded = await encodeExportArchive(entries, exportFormat, preferences, (current, total) => {
      setProgress(`Preparing ${current} of ${total}`);
      setProgressValue(current);
      setProgressMax(total);
    });
    downloadBlob(archiveBlob(encoded), filename);
  }

  async function run() {
    setExporting(true);
    setError("");
    setProgress("");
    setProgressValue(0);
    setProgressMax(0);
    const exportFormat = format;
    const exportScope = scope;
    const preferences = { ...defaults, imageScale };
    try {
      if (exportScope === "selected") {
        if (activeProcessId === null) throw new Error("Select a process before exporting a selected diagram.");
        const processIndex = document.processes.findIndex((process) => process.id === activeProcessId);
        if (processIndex < 0) throw new Error("The selected diagram is no longer available.");
        const sliced = sliceProcessDocument(document, activeProcessId);
        const filename = processExportFilename(document.metadata.title, processIndex, exportFormat);
        if (exportFormat === "json") {
          downloadBlob(new Blob([JSON.stringify(sliced, null, 2)], { type: "application/json" }), filename);
        } else {
          await exportDiagramImage(sliced, exportFormat, preferences, filename.slice(0, -(exportFormat.length + 1)));
        }
      } else if (exportScope === "project") {
        const validated = parseDiagram(document);
        downloadBlob(
          new Blob([JSON.stringify(validated, null, 2)], { type: "application/json" }),
          `${safeExportName(validated.metadata.title)}.json`,
        );
      } else if (exportScope === "separate") {
        const entries = buildProjectProcessManifest(recordFor(currentProjectId, document), exportFormat);
        await encodeAndDownload(entries, exportFormat, preferences, `${safeExportName(document.metadata.title)}-diagrams-${exportFormat}.zip`);
      } else {
        const records = await workspaceRecords();
        const organization = exportFormat === "json" ? jsonOrganization : "diagram-wise";
        const entries = buildWorkspaceManifest(records, exportFormat, organization);
        await encodeAndDownload(entries, exportFormat, preferences, `flox-workspace-${exportFormat}.zip`);
      }
      if (exportFormat === "png" && rememberScale) onDefaultsChange(preferences);
      setProgress("Export ready");
      setProgressValue(0);
      setProgressMax(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Export failed");
      setProgress("");
      setProgressValue(0);
      setProgressMax(0);
    } finally {
      setExporting(false);
    }
  }

  return createPortal(<div className="export-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="export-dialog export-dialog--workspace" role="dialog" aria-modal="true" aria-labelledby="export-title" tabIndex={-1}>
      <header><div><span><Download aria-hidden="true" /> Workspace export</span><h2 id="export-title">Export diagrams</h2><p>Choose a format and how much of this workspace to include.</p></div><Button variant="ghost" size="icon" aria-label="Close export" onClick={onClose}><X aria-hidden="true" /></Button></header>
      <div className="workspace-export-options">
        <fieldset disabled={exporting}><legend>Format</legend><div className="export-choice-grid export-choice-grid--format">{(["json", "png", "svg"] as const).map((value) => <label key={value} className={format === value ? "is-selected" : ""}><input type="radio" name="format" value={value} checked={format === value} onChange={() => changeFormat(value)} /><span>{value.toUpperCase()}</span></label>)}</div></fieldset>
        <fieldset disabled={exporting}><legend>Scope <small>{workspaceCopy}</small></legend><div className="export-choice-grid">{scopes.map(([value, label]) => {
          const disabled = value === "selected" && activeProcessId === null;
          return <label key={value} className={scope === value ? "is-selected" : ""}><input type="radio" name="scope" value={value} checked={scope === value} disabled={disabled} aria-describedby={disabled ? "selected-export-help" : undefined} onChange={() => setScope(value)} /><span>{label}</span></label>;
        })}</div></fieldset>
        {activeProcessId === null && <p id="selected-export-help" className="workspace-export-helper">Select a process before exporting a selected diagram.</p>}
        {format === "json" && scope === "all-in-one" && <fieldset disabled={exporting}><legend>Organization</legend><div className="export-choice-grid export-choice-grid--organization">{([[
          "diagram-wise", "Diagram-wise",
        ], ["project-wise", "Project-wise"]] as const).map(([value, label]) => <label key={value} className={jsonOrganization === value ? "is-selected" : ""}><input type="radio" name="organization" value={value} checked={jsonOrganization === value} onChange={() => setJsonOrganization(value)} /><span>{label}</span></label>)}</div></fieldset>}
        <p className="workspace-export-helper">{helper}</p>
        {format === "png" && <div className="workspace-export-settings">
          <label>PNG quality<select disabled={exporting} value={imageScale} aria-label="PNG quality" onChange={(event) => setImageScale(Number(event.target.value) as 1 | 2 | 3)}><option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option></select></label>
          <label className="workspace-export-remember"><input disabled={exporting} type="checkbox" checked={rememberScale} onChange={(event) => setRememberScale(event.target.checked)} /><span>Remember as default<small>Saved only after a successful PNG export.</small></span></label>
          <span>{defaults.transparentBackground ? "Transparent background" : "Canvas background"}</span>
        </div>}
        {error && <p className="workspace-export-error" role="alert"><AlertTriangle aria-hidden="true" /> {error}</p>}
        <div className="workspace-export-progress" aria-live="polite" aria-atomic="true">
          {progress && <span>{progress}</span>}
          {exporting && progressMax > 0 && <progress max={progressMax} value={progressValue} />}
        </div>
        <div className="export-dialog__actions"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={exporting || selectedUnavailable} aria-busy={exporting} onClick={() => void run()}><Download aria-hidden="true" /> {exporting ? "Preparing…" : actionLabel}</Button></div>
      </div>
    </section>
  </div>, window.document.body);
}
