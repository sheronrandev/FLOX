import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CircleDot, Cloud, Files, GitBranch, Grid2X2, Plus, ShieldCheck, Workflow } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { Button } from "../components/ui/button";
import { createDiagram } from "../domain/diagram";
import { recordFor, type ProjectSummary } from "../persistence/project-repository";
import { SyncUnavailableError } from "../persistence/server-project-repository";

function relativeTime(value?: string) {
  if (!value) return "No activity yet";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

export function OverviewPage({ onOpenSettings = () => undefined }: { onOpenSettings?: (triggerId?: string) => void }) {
  const navigate = useNavigate();
  const { repository, user } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    try { setProjects(await repository.list()); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load the workspace overview"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [repository]);

  const totals = useMemo(() => projects.reduce((value, project) => ({
    nodes: value.nodes + project.nodeCount,
    edges: value.edges + project.edgeCount,
  }), { nodes: 0, edges: 0 }), [projects]);

  const recent = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return projects.filter((project) => !normalized || project.title.toLocaleLowerCase().includes(normalized)).slice(0, 3);
  }, [projects, query]);

  async function createProject(title = "Untitled diagram") {
    if (creating) return;
    setCreating(true);
    const id = crypto.randomUUID();
    try {
      await repository.put(recordFor(id, createDiagram(title)));
      navigate(`/projects/${id}/editor`);
    } catch (reason) {
      if (reason instanceof SyncUnavailableError) navigate(`/projects/${id}/editor`);
      else setError(reason instanceof Error ? reason.message : "Could not create this diagram");
    } finally { setCreating(false); }
  }

  return (
    <WorkspaceShell pageLabel="Overview" projectCount={projects.length} onOpenSettings={onOpenSettings} contentClassName="overview-content" search={{ value: query, onChange: setQuery, label: "Search recent diagrams", placeholder: "Search recent diagrams" }}>
      <header className="workspace-heading overview-heading">
        <div><p className="eyebrow">Workspace pulse</p><h1>Overview</h1><p>Review your local workspace and continue drafting without losing focus.</p></div>
        <Button onClick={() => void createProject()} disabled={creating} aria-busy={creating}><Plus /> {creating ? "Creating…" : "New diagram"}</Button>
      </header>

      {error && <div className="workspace-error" role="alert"><strong>Overview unavailable</strong><span>{error}</span><Button variant="outline" size="sm" onClick={() => void refresh()}>Retry</Button></div>}

      <section className="overview-metrics" aria-label="Workspace summary">
        <article><Files /><span>Total diagrams</span><strong>{loading ? "—" : projects.length}</strong></article>
        <article><CircleDot /><span>Total nodes</span><strong>{loading ? "—" : totals.nodes}</strong></article>
        <article><GitBranch /><span>Total connectors</span><strong>{loading ? "—" : totals.edges}</strong></article>
        <article><Activity /><span>Latest update</span><strong>{loading ? "—" : relativeTime(projects[0]?.updatedAt)}</strong></article>
      </section>

      <section className="overview-section" aria-labelledby="continue-heading">
        <div className="section-heading"><div><p className="eyebrow">Recent activity</p><h2 id="continue-heading">Continue working</h2></div><Link to="/projects">View all <ArrowRight /></Link></div>
        {!loading && recent.length === 0 ? <div className="overview-empty"><Workflow /><strong>{query ? "No matching diagrams" : "Your first diagram starts here"}</strong><span>{query ? "Try a different search term." : "Create a blank activity diagram and shape the workflow as you go."}</span>{!query && <Button size="sm" onClick={() => void createProject()}>Create diagram</Button>}</div> :
          <div className="recent-projects">{recent.map((project) => <Link key={project.id} to={`/projects/${project.id}/editor`} className="recent-project">
            <div className="project-thumb" aria-hidden="true"><span className="mini-node mini-node--start" /><i /><span className="mini-node mini-node--action" /><i /><span className="mini-node mini-node--decision" /></div>
            <strong>{project.title}</strong><span>{project.nodeCount} nodes · {project.edgeCount} connectors</span><small>Updated {relativeTime(project.updatedAt)}</small><b>Open <ArrowRight /></b>
          </Link>)}</div>}
      </section>

      <div className="overview-lower-grid">
        <section className="overview-panel workspace-health" aria-labelledby="health-heading"><div className="panel-icon"><ShieldCheck /></div><div><p className="eyebrow">Storage status</p><h2 id="health-heading">Workspace health</h2></div><p>{user ? "Google Drive is connected for explicit sharing. Your browser remains the source of truth for local edits." : "Your diagrams stay in this browser. Connect Google when you want to store or share selected files through Drive."}</p><Button variant="outline" asChild><Link to="/account"><Cloud /> {user ? "Manage Drive" : "Connect Google"}</Link></Button></section>
        <section className="overview-panel" aria-labelledby="quick-start-heading"><div className="panel-icon"><Grid2X2 /></div><div><p className="eyebrow">New work</p><h2 id="quick-start-heading">Quick start</h2></div><div className="quick-start-list"><button onClick={() => void createProject()}><Plus /><span><strong>Blank diagram</strong><small>Start with an empty canvas</small></span><ArrowRight /></button><button onClick={() => void createProject("Approval process")}><Workflow /><span><strong>Approval process</strong><small>Map a decision-driven review</small></span><ArrowRight /></button><button onClick={() => void createProject("Swimlane workflow")}><Grid2X2 /><span><strong>Swimlane workflow</strong><small>Organize work by owner</small></span><ArrowRight /></button></div></section>
      </div>
    </WorkspaceShell>
  );
}
