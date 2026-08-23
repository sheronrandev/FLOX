import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, CloudOff, Download, Layers3, Settings, Share2, ShieldCheck, Upload } from "lucide-react";
import { ActivityCanvas } from "../diagram/ActivityCanvas";
import { EditorToolbar } from "../components/EditorToolbar";
import { PropertiesPanel } from "../components/PropertiesPanel";
import { createDiagram, importDiagram, type DiagramDocument } from "../domain/diagram";
import { recordFor, type ProjectRecord } from "../persistence/project-repository";
import { ProjectConflictError, SyncUnavailableError } from "../persistence/server-project-repository";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/button";
import { useDiagramStore } from "../store/diagram-store";
import type { AppTheme } from "../domain/app-theme";
import { ValidationNotifications } from "../components/ValidationNotifications";
import { DriveSharePanel } from "../components/DriveSharePanel";
import { BrandLogo } from "../components/BrandLogo";
import { defaultExportPreferences, type ExportPreferences } from "../domain/preferences";
import { ExportDialog } from "../components/ExportDialog";

interface EditorPageProps {
  theme: AppTheme;
  exportPreferences?: ExportPreferences;
  onExportPreferencesChange?: (preferences: ExportPreferences) => void;
  onOpenSettings?: (triggerId?: string, projectSettings?: { readOnly: boolean }) => void;
}

export function EditorPage({ theme, exportPreferences = defaultExportPreferences, onExportPreferencesChange, onOpenSettings = () => undefined }: EditorPageProps) {
  const { projectId = "local" } = useParams();
  const { repository } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<"loading" | "saving" | "saved" | "local" | "conflict" | "error">("loading");
  const [conflict, setConflict] = useState<ProjectRecord | null | undefined>(undefined);
  const [driveOpen, setDriveOpen] = useState(false);
  const [accessRole, setAccessRole] = useState<"owner" | "editor" | "viewer">("owner");
  const [titleDraft, setTitleDraft] = useState("");
  const [workspaceCount, setWorkspaceCount] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const createdAt = useRef<string | undefined>(undefined);
  const serverRevision = useRef<number | undefined>(undefined);
  const latestDocument = useRef<DiagramDocument | undefined>(undefined);
  const document = useDiagramStore((state) => state.document);
  const activeProcessId = useDiagramStore((state) => state.activeProcessId);
  const loadDocument = useDiagramStore((state) => state.loadDocument);
  const rename = useDiagramStore((state) => state.rename);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const importDocument = useDiagramStore((state) => state.importDocument);

  function openExport(trigger: HTMLButtonElement) {
    exportTriggerRef.current = trigger;
    setExportOpen(true);
  }

  function closeExport() {
    setExportOpen(false);
    window.setTimeout(() => exportTriggerRef.current?.focus(), 0);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || accessRole === "viewer") return;
    if (file.size > 5_000_000) {
      window.alert("Import refused: file is larger than 5 MB");
      return;
    }
    try {
      importDocument(importDiagram(JSON.parse(await file.text())));
    } catch (error) {
      window.alert(error instanceof Error ? `Import failed: ${error.message}` : "Import failed");
    }
  }
  const selectAll = useDiagramStore((state) => state.selectAll);
  const copySelection = useDiagramStore((state) => state.copySelection);
  const paste = useDiagramStore((state) => state.paste);
  const duplicateSelection = useDiagramStore((state) => state.duplicateSelection);
  const nudgeSelection = useDiagramStore((state) => state.nudgeSelection);
  const updateAppearance = useDiagramStore((state) => state.updateAppearance);

  latestDocument.current = document;

  const refreshWorkspaceCount = useCallback(() => {
    void repository.list().then((projects) => setWorkspaceCount(Math.max(1, projects.length))).catch(() => undefined);
  }, [repository]);

  useEffect(() => {
    refreshWorkspaceCount();
    window.addEventListener("focus", refreshWorkspaceCount);
    return () => window.removeEventListener("focus", refreshWorkspaceCount);
  }, [refreshWorkspaceCount]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setSaveState("loading");
    void repository.get(projectId).then(async (record) => {
      if (cancelled) return;
      const initial = record?.document ?? createDiagram("Untitled diagram");
      createdAt.current = record?.createdAt ?? initial.metadata.createdAt;
      serverRevision.current = record?.serverRevision;
      setAccessRole(record?.accessRole ?? "owner");
      loadDocument(initial);
      setTitleDraft(initial.metadata.title);
      if (!record) {
        try {
          const saved = await repository.put(recordFor(projectId, initial));
          serverRevision.current = saved.serverRevision;
          setAccessRole(saved.accessRole ?? "owner");
        } catch (error) {
          if (!(error instanceof SyncUnavailableError)) throw error;
        }
      }
      if (!cancelled) {
        setReady(true);
        setSaveState("saved");
        refreshWorkspaceCount();
      }
    }).catch(() => {
      if (!cancelled) setSaveState("error");
    });
    return () => { cancelled = true; };
  }, [loadDocument, projectId, refreshWorkspaceCount, repository]);

  useEffect(() => setTitleDraft(document.metadata.title), [document.metadata.title]);
  useEffect(() => {
    if (!ready) return;
    const themedAppearance = theme.mode === "dark"
      ? { canvasColor: theme.canvas, gridColor: "#383838", controlFlowColor: "#000000", objectFlowColor: "#000000" }
      : { canvasColor: theme.canvas, gridColor: "#d7dde1", controlFlowColor: "#000000", objectFlowColor: "#000000" };
    if (Object.entries(themedAppearance).some(([key, value]) => document.appearance[key as keyof typeof themedAppearance] !== value)) {
      updateAppearance(themedAppearance);
    }
  }, [document.appearance, ready, theme.canvas, theme.mode, theme.primary, updateAppearance]);

  useEffect(() => {
    if (!ready || accessRole === "viewer") return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void repository.put(recordFor(projectId, document, createdAt.current, serverRevision.current, accessRole))
        .then((saved) => { serverRevision.current = saved.serverRevision; setSaveState("saved"); })
        .catch((error) => {
          if (error instanceof ProjectConflictError) { setConflict(error.current); setSaveState("conflict"); }
          else if (error instanceof SyncUnavailableError) setSaveState("local");
          else setSaveState("error");
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [accessRole, document, projectId, ready, repository]);

  useEffect(() => () => {
    if (ready && latestDocument.current) {
      if (accessRole !== "viewer") void repository.put(recordFor(projectId, latestDocument.current, createdAt.current, serverRevision.current, accessRole)).catch(() => undefined);
    }
  }, [accessRole, projectId, ready, repository]);

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (accessRole === "viewer" && !(modifier && ["a", "c"].includes(event.key.toLowerCase()))) return;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAll();
      } else if (modifier && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelection();
      } else if (modifier && event.key.toLowerCase() === "v") {
        event.preventDefault();
        paste();
      } else if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
      } else if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) {
        const distance = event.shiftKey ? 20 : 5;
        const offsets: Record<string, [number, number]> = {
          ArrowUp: [0, -distance], ArrowRight: [distance, 0],
          ArrowDown: [0, distance], ArrowLeft: [-distance, 0],
        };
        event.preventDefault();
        nudgeSelection(...offsets[event.key]);
      }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [accessRole, copySelection, duplicateSelection, nudgeSelection, paste, redo, selectAll, undo]);

  const status = {
    loading: "Opening local project…",
    saving: "Saving locally…",
    saved: "Saved locally",
    local: "Saved locally · sync pending",
    conflict: "Sync conflict",
    error: "Local save failed",
  }[saveState];

  return (
    <main id="main-content" className="editor-page" tabIndex={-1}>
      <header className="editor-header">
        <div className="editor-header__identity">
          <Link to="/projects" className="back-link" aria-label="Back to projects"><ChevronLeft /></Link>
          <BrandLogo compact />
          <span className="editor-header__divider" />
          <div><span className="editor-breadcrumb">Workspace / Activity diagram</span><input
            className="document-title"
            aria-label="Diagram title"
            value={titleDraft}
            readOnly={accessRole === "viewer"}
            maxLength={120}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => rename(titleDraft)}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          /></div>
        </div>
        <div className="editor-header__actions">
          <span className={["error", "local", "conflict"].includes(saveState) ? "privacy-chip is-error" : "privacy-chip"}>
            {["error", "local", "conflict"].includes(saveState) ? <CloudOff /> : <ShieldCheck />} {status}
          </span>
          <ValidationNotifications projectId={projectId} />
          {accessRole !== "viewer" && <Button className="editor-header__quick-action" variant="outline" size="sm" aria-label="Import JSON" onClick={() => importInputRef.current?.click()}><Upload /><span>Import JSON</span></Button>}
          <Button className="editor-header__quick-action" variant="outline" size="sm" aria-label="Export" onClick={(event) => openExport(event.currentTarget)}><Download /><span>Export</span></Button>
          <Button id="editor-settings-trigger" variant="ghost" size="icon" onClick={() => onOpenSettings("editor-settings-trigger", { readOnly: accessRole === "viewer" })} aria-label="Open settings"><Settings /></Button>
          <Button size="sm" onClick={() => setDriveOpen(true)}><Share2 /> Share</Button>
        </div>
      </header>
      <div className="editor-workspace">
        <EditorToolbar collapsed={collapsed} onCollapsedChange={setCollapsed} readOnly={accessRole === "viewer"} />
        <ActivityCanvas readOnly={accessRole === "viewer"} />
        <footer className="editor-statusbar"><span><span className="status-dot" /> Ready</span><span><Layers3 /> {document.processes.length} {document.processes.length === 1 ? "diagram" : "diagrams"} · {document.processes.reduce((sum, process) => sum + process.nodes.length, 0)} nodes · {document.processes.reduce((sum, process) => sum + process.edges.length, 0)} connectors</span><span className="statusbar-id">LOCAL / {projectId.slice(0, 8).toUpperCase()}</span></footer>
        <PropertiesPanel readOnly={accessRole === "viewer"} />
        {driveOpen && <DriveSharePanel projectId={projectId} document={document} onClose={() => setDriveOpen(false)} />}
        <input ref={importInputRef} className="sr-only" aria-label="Import diagram JSON" type="file" accept="application/json,.json" onChange={importJson} />
        {exportOpen && <ExportDialog document={document} activeProcessId={activeProcessId} currentProjectId={projectId} repository={repository} workspaceCount={workspaceCount} defaults={exportPreferences} initialFormat={exportPreferences.defaultFormat} onDefaultsChange={onExportPreferencesChange} onClose={closeExport} />}
        {!ready && <div className="editor-loading">Opening project…</div>}
        {saveState === "conflict" && <div className="conflict-banner" role="alert">
          <strong>This project changed on the server.</strong><span>Choose which copy to continue with; neither version has been discarded.</span>
          <Button variant="outline" disabled={!conflict} onClick={() => {
            if (!conflict) return;
            serverRevision.current = conflict.serverRevision; createdAt.current = conflict.createdAt;
            loadDocument(conflict.document); setTitleDraft(conflict.title); setConflict(undefined); setSaveState("saved");
          }}>Use server copy</Button>
          <Button onClick={() => {
            serverRevision.current = conflict?.serverRevision ?? 0; setConflict(undefined); setSaveState("saving");
            void repository.put(recordFor(projectId, document, createdAt.current, serverRevision.current, accessRole))
              .then((saved) => { serverRevision.current = saved.serverRevision; setSaveState("saved"); })
              .catch(() => setSaveState("error"));
          }}>Keep this copy</Button>
        </div>}
      </div>
    </main>
  );
}
