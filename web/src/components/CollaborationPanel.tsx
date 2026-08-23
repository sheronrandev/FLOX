import { useCallback, useEffect, useState, type FormEvent } from "react";
import { History, Trash2, UserPlus, Users, X } from "lucide-react";
import { importDiagram } from "../domain/diagram";
import type { ProjectRecord } from "../persistence/project-repository";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./ui/button";

interface Member { id: string; email: string; displayName: string; role: "owner" | "editor" | "viewer"; addedAt?: string }
interface Revision { revision: number; createdAt: string; title: string; nodeCount: number; edgeCount: number; actor?: { displayName: string } | null }

export function CollaborationPanel({ projectId, currentRevision, accessRole, retentionLimit, onClose, onRestored, onRetentionChanged }: {
  projectId: string; currentRevision: number; accessRole: "owner" | "editor" | "viewer"; retentionLimit: number;
  onClose: () => void; onRestored: (project: ProjectRecord) => void; onRetentionChanged: (value: number) => void;
}) {
  const { api } = useAuth();
  const [tab, setTab] = useState<"members" | "history">("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [message, setMessage] = useState("");
  const [retention, setRetention] = useState(retentionLimit);

  const refreshMembers = useCallback(async () => {
    const value = await api<{ members: Member[] }>(`/api/projects/${projectId}/members`);
    setMembers(value.members);
  }, [api, projectId]);
  const refreshHistory = useCallback(async () => {
    const value = await api<{ revisions: Revision[] }>(`/api/projects/${projectId}/revisions`);
    setRevisions(value.revisions);
  }, [api, projectId]);
  useEffect(() => { void Promise.all([refreshMembers(), refreshHistory()]).catch((error) => setMessage(error.message)); }, [refreshHistory, refreshMembers]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const form = event.currentTarget; const data = new FormData(form);
    try {
      await api(`/api/projects/${projectId}/members`, { method: "PUT", json: { email: String(data.get("email") ?? ""), role: String(data.get("role") ?? "viewer") } });
      form.reset(); await refreshMembers(); setMessage("Member access updated");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update member"); }
  }

  async function restore(revision: number) {
    if (!window.confirm(`Restore revision ${revision}? The current document remains in history.`)) return;
    try {
      const value = await api<{ project: ProjectRecord & { document: unknown; revision: number } }>(`/api/projects/${projectId}/revisions/${revision}/restore`, { method: "POST", json: { expectedRevision: currentRevision } });
      const project = { ...value.project, title: importDiagram(value.project.document).metadata.title, document: importDiagram(value.project.document), serverRevision: value.project.revision } as ProjectRecord & { revision: number };
      onRestored(project); await refreshHistory(); setMessage(`Revision ${revision} restored as a new revision`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not restore revision"); }
  }

  return <aside className="collaboration-panel" aria-label="Project collaboration">
    <header><div><span>Server project</span><strong>{accessRole === "owner" ? "Owner" : accessRole === "editor" ? "Can edit" : "View only"}</strong></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close collaboration panel"><X /></Button></header>
    <div className="collaboration-tabs">
      <button className={tab === "members" ? "is-active" : ""} onClick={() => setTab("members")}><Users /> Members</button>
      <button className={tab === "history" ? "is-active" : ""} onClick={() => setTab("history")}><History /> History</button>
    </div>
    {tab === "members" && <div className="collaboration-content">
      {accessRole === "owner" && <form className="member-form" onSubmit={addMember}>
        <input name="email" type="email" placeholder="Registered user email" required />
        <select name="role" defaultValue="viewer"><option value="viewer">Viewer</option><option value="editor">Editor</option></select>
        <Button size="sm" type="submit"><UserPlus /> Add or update</Button>
      </form>}
      <div className="member-list">{members.map((member) => <div key={member.id} className="member-row">
        <span><strong>{member.displayName}</strong><small>{member.email}</small></span>
        {accessRole === "owner" && member.role !== "owner" ? <><select value={member.role} onChange={async (event) => { await api(`/api/projects/${projectId}/members`, { method: "PUT", json: { email: member.email, role: event.target.value } }); await refreshMembers(); }}><option value="viewer">Viewer</option><option value="editor">Editor</option></select><Button variant="ghost" size="icon" title="Remove member" onClick={async () => { await api(`/api/projects/${projectId}/members/${member.id}`, { method: "DELETE" }); await refreshMembers(); }}><Trash2 /></Button></> : <span className="role-chip">{member.role}</span>}
      </div>)}</div>
    </div>}
    {tab === "history" && <div className="collaboration-content">
      {accessRole === "owner" && <label className="retention-control">Keep revisions<input type="number" min={5} max={200} value={retention} onChange={(event) => setRetention(Number(event.target.value))} onBlur={async () => { try { await api(`/api/projects/${projectId}/settings`, { method: "PUT", json: { retentionLimit: retention } }); onRetentionChanged(retention); setMessage("Retention updated"); } catch (error) { setMessage(error instanceof Error ? error.message : "Invalid retention"); } }} /></label>}
      <div className="revision-list">{revisions.map((revision) => <article key={revision.revision}>
        <div><strong>Revision {revision.revision}</strong><span>{revision.title}</span><small>{revision.nodeCount} nodes · {new Date(revision.createdAt).toLocaleString()} · {revision.actor?.displayName ?? "Unknown user"}</small></div>
        {accessRole !== "viewer" && revision.revision !== currentRevision && <Button variant="outline" size="sm" onClick={() => void restore(revision.revision)}>Restore</Button>}
      </article>)}</div>
    </div>}
    {message && <p className="collaboration-message" role="status">{message}</p>}
  </aside>;
}
