import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Bell, CheckCheck, Info, RotateCcw, Trash2, X } from "lucide-react";
import { clearFindings, loadNotificationState, markAllRead, reconcileNotificationState, restoreCleared, saveNotificationState, type NotificationState } from "../domain/notification-state";
import { validateDiagram } from "../domain/validation";
import { useDiagramStore } from "../store/diagram-store";
import { Button } from "./ui/button";

const icons = { error: AlertCircle, warning: AlertTriangle, info: Info };
const emptyState: NotificationState = { readIds: [], dismissedIds: [], activeIds: [] };

export function ValidationNotifications({ projectId }: { projectId: string }) {
  const document = useDiagramStore((state) => state.document);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const setActiveProcess = useDiagramStore((state) => state.setActiveProcess);
  const findings = useMemo(() => validateDiagram(document), [document]);
  const findingIds = useMemo(() => findings.map((finding) => finding.id), [findings]);
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [state, setState] = useState<NotificationState>(() => {
    try { return loadNotificationState(window.localStorage, projectId) } catch { return emptyState }
  });

  useEffect(() => { try { setState(loadNotificationState(window.localStorage, projectId)) } catch { setState(emptyState) } }, [projectId]);
  useEffect(() => {
    setState((current) => {
      const next = reconcileNotificationState(current, findingIds);
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [findingIds]);
  useEffect(() => { try { saveNotificationState(window.localStorage, projectId, state) } catch { /* storage can be blocked */ } }, [projectId, state]);

  const read = useMemo(() => new Set(state.readIds), [state.readIds]);
  const dismissed = useMemo(() => new Set(state.dismissedIds), [state.dismissedIds]);
  const activeFindings = findings.filter((finding) => !dismissed.has(finding.id));
  const unread = activeFindings.filter((finding) => !read.has(finding.id)).length;

  function inspect(finding: (typeof findings)[number]) {
    setState((current) => markAllRead(current, [finding.id]));
    setActiveProcess(finding.processId);
    setSelection(finding.nodeId ? [finding.nodeId] : [], finding.edgeId ? [finding.edgeId] : []);
    window.dispatchEvent(new CustomEvent("flox:focus-process", { detail: finding.processId }));
  }
  function markRead() {
    setState((current) => markAllRead(current, activeFindings.map((finding) => finding.id)));
    setAnnouncement(`${activeFindings.length} findings marked as read.`);
  }
  function clear() {
    setState((current) => clearFindings(current, activeFindings.map((finding) => finding.id)));
    setAnnouncement(`${activeFindings.length} notifications cleared. Validation is still active.`);
  }
  function restore() {
    const count = state.dismissedIds.length;
    setState((current) => restoreCleared(current));
    setAnnouncement(`${count} cleared notifications restored.`);
  }

  return <div className="notification-center">
    <Button className="notification-trigger" variant="ghost" size="icon" aria-label={`Validation notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Bell />{unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
    </Button>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    {open && <section className="notification-panel" aria-label="Diagram health">
      <header><div><strong>Diagram health</strong><span>{findings.length ? `${findings.length} finding${findings.length === 1 ? "" : "s"}` : "Everything looks good"}</span></div><Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close notifications"><X /></Button></header>
      {(activeFindings.length > 0 || state.dismissedIds.length > 0) && <div className="notification-actions">
        {activeFindings.length > 0 && <button type="button" onClick={markRead}><CheckCheck /> Mark all as read</button>}
        {activeFindings.length > 0 && <button type="button" onClick={clear}><Trash2 /> Clear notifications</button>}
        {state.dismissedIds.length > 0 && <button type="button" onClick={restore}><RotateCcw /> Restore cleared ({state.dismissedIds.length})</button>}
      </div>}
      <div className="notification-list">
        {activeFindings.length === 0 && <div className="notification-empty"><CheckCheck /><strong>{state.dismissedIds.length ? "Notifications cleared" : "No validation issues"}</strong><span>{state.dismissedIds.length ? `${state.dismissedIds.length} findings are hidden while validation continues.` : "Every process passes the current structural checks."}</span></div>}
        {activeFindings.map((finding) => { const Icon = icons[finding.severity]; return <button key={finding.id} className={`notification-item is-${finding.severity}${read.has(finding.id) ? " is-read" : ""}`} onClick={() => inspect(finding)}>
          <span className="notification-icon"><Icon /></span><span><strong>{finding.severity === "error" ? "Action required" : finding.severity === "warning" ? "Review suggested" : "Information"}</strong><small>{finding.message}</small><em>{finding.processName}</em></span>{!read.has(finding.id) && <i aria-label="Unread" />}
        </button> })}
      </div>
    </section>}
  </div>;
}
