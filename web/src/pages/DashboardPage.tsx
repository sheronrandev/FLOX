import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Copy, FilePlus2, FolderOpen, Grid2X2, HardDrive, Import, Plus, Trash2, Workflow } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { createDiagram } from "../domain/diagram";
import { recordFor, type ProjectSummary } from "../persistence/project-repository";
import { SyncUnavailableError } from "../persistence/server-project-repository";
import { useAuth } from "../auth/AuthContext";
import { WorkspaceShell } from "../components/WorkspaceShell";

export function DashboardPage({ onOpenSettings = () => undefined }: { onOpenSettings?: (triggerId?: string) => void }) {
  const navigate = useNavigate();
  const { repository } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  async function refresh() {
    try {
      setProjects(await repository.list());
      setWorkspaceError("");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not load this workspace");
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [repository]);

  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? projects.filter((project) => project.title.toLocaleLowerCase().includes(normalized)) : projects;
  }, [projects, query]);

  async function createProject() {
    if (creating) return;
    setCreating(true);
    setWorkspaceError("");
    const id = crypto.randomUUID();
    try {
      await repository.put(recordFor(id, createDiagram("Untitled diagram")));
      navigate(`/projects/${id}/editor`);
    } catch (error) {
      if (error instanceof SyncUnavailableError) navigate(`/projects/${id}/editor`);
      else setWorkspaceError(error instanceof Error ? error.message : "Could not create this diagram");
    } finally { setCreating(false); }
  }

  async function duplicateProject(id: string) {
    const source = await repository.get(id);
    if (!source) return;
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const document = structuredClone(source.document);
    document.metadata = { title: `${source.title} copy`, createdAt: now, updatedAt: now };
    await repository.put(recordFor(newId, document));
    await refresh();
  }

  async function deleteProject(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    await repository.delete(id);
    await refresh();
  }

  return (
    <WorkspaceShell pageLabel="All diagrams" projectCount={projects.length} onOpenSettings={onOpenSettings} search={{ value: query, onChange: setQuery, label: "Search diagrams", placeholder: "Search diagrams" }}>
        <section id="projects">
          <div className="workspace-heading">
            <div><p className="eyebrow">Local storage</p><h1>All diagrams</h1><p>Create, edit, and export activity diagrams from this device.</p></div>
            <Button onClick={createProject} disabled={creating} aria-busy={creating}><Plus /> {creating ? "Creating…" : "New diagram"}</Button>
          </div>

          {workspaceError && <div className="workspace-error" role="alert"><strong>Workspace unavailable</strong><span>{workspaceError}</span><Button variant="outline" size="sm" onClick={() => void refresh()}>Retry</Button></div>}
          {loading && <div className="project-skeleton" role="status" aria-label="Loading diagrams"><span /><span /><span /></div>}

          {!loading && projects.length === 0 && (
            <section className="empty-workspace" aria-labelledby="empty-heading">
              <div className="empty-workspace__mark"><Workflow aria-hidden="true" /></div>
              <p className="eyebrow">Your canvas is ready</p>
              <h2 id="empty-heading">No diagrams yet</h2>
              <p>Map a process from scratch or bring in a FLOX diagram file. Everything stays in your browser until you choose to share.</p>
              <div className="empty-workspace__actions">
                <Button onClick={createProject} disabled={creating}><FilePlus2 /> Create diagram</Button>
                <Button variant="outline" onClick={createProject}><Import /> Import file</Button>
              </div>
              <div className="template-strip" aria-label="Starter templates">
                <button onClick={createProject}><span><Workflow /></span><strong>Basic activity flow</strong><small>Start → activity → end</small></button>
                <button onClick={createProject}><span><FolderOpen /></span><strong>Approval process</strong><small>Decision and review steps</small></button>
                <button onClick={createProject}><span><Grid2X2 /></span><strong>Swimlane workflow</strong><small>Organize work by owner</small></button>
              </div>
            </section>
          )}

          {!loading && projects.length > 0 && visibleProjects.length === 0 && <div className="empty-search">No diagrams match “{query}”.</div>}
          <div className="project-list">
            {visibleProjects.map((project) => (
              <article className="project-card" key={project.id}>
                <Link to={`/projects/${project.id}/editor`} className="project-card__main">
                  <div className="project-thumb" aria-hidden="true">
                    <span className="mini-node mini-node--start" /><i /><span className="mini-node mini-node--action" /><i /><span className="mini-node mini-node--decision" />
                  </div>
                  <div className="project-card__copy"><strong>{project.title}</strong><span>{project.nodeCount} nodes · {project.edgeCount} connectors</span><small>Updated {new Date(project.updatedAt).toLocaleString()}</small></div>
                  <span className="open-affordance">Open <ArrowUpRight /></span>
                </Link>
                <div className="project-card__actions">
                  <Button variant="ghost" size="icon" onClick={() => duplicateProject(project.id)} aria-label={`Duplicate ${project.title}`}><Copy /></Button>
                  {(!project.accessRole || project.accessRole === "owner") && <Button variant="ghost" size="icon" onClick={() => deleteProject(project.id, project.title)} aria-label={`Delete ${project.title}`}><Trash2 /></Button>}
                </div>
              </article>
            ))}
          </div>
          <p className="workspace-footnote"><HardDrive /> Diagrams are stored locally in this browser. Export regularly for portable backups.</p>
        </section>
    </WorkspaceShell>
  );
}
