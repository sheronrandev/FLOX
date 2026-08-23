import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, Cloud, ExternalLink, Keyboard, Search, ShieldCheck, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { WorkspaceShell } from "../components/WorkspaceShell";

const topics = [
  { id: "local-storage", title: "Local storage", copy: "FLOX saves diagrams in this browser first. Clearing browser site data can remove local projects, so export important diagrams regularly." },
  { id: "google-drive", title: "Google Drive sharing", copy: "Connecting Google adds explicit Drive storage and sharing. Local editing remains available, and FLOX only requests access to files it creates or opens." },
  { id: "export-formats", title: "Export formats", copy: "Open a diagram and choose Export to download PNG or SVG. PNG supports 1×, 2×, and 3× scale; both formats can use a transparent background." },
  { id: "validation-issues", title: "Validation issues", copy: "The editor flags incomplete or unreachable flows. Open Validation, select an issue, and use the highlighted node or connector as the starting point." },
  { id: "privacy", title: "Privacy", copy: "Local projects remain on this device unless you explicitly export or share them. Google access can be disconnected from Account at any time." },
];

function Keys({ children }: { children: string[] }) {
  return <span className="key-combination">{children.map((key, index) => <span key={`${key}-${index}`}>{index > 0 && <i aria-hidden="true">+</i>}<kbd>{key}</kbd></span>)}</span>;
}

export function HelpPage({ onOpenSettings = () => undefined }: { onOpenSettings?: (triggerId?: string) => void }) {
  const { repository } = useAuth();
  const [projectCount, setProjectCount] = useState(0);
  const [query, setQuery] = useState("");
  useEffect(() => { void repository.list().then((projects) => setProjectCount(projects.length)).catch(() => undefined); }, [repository]);
  const visibleTopics = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return topics.filter((topic) => !normalized || `${topic.title} ${topic.copy}`.toLocaleLowerCase().includes(normalized));
  }, [query]);

  return (
    <WorkspaceShell pageLabel="Help & shortcuts" projectCount={projectCount} onOpenSettings={onOpenSettings} contentClassName="help-content">
      <header className="help-heading"><p className="eyebrow">Reference library</p><h1>Help & shortcuts</h1><p>Documentation and keyboard controls for faster, clearer diagramming.</p></header>
      <label className="help-search"><Search /><span className="sr-only">Search help</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help" /></label>

      <nav className="help-quick-links" aria-label="Start here">
        <Link to="/projects"><Workflow /> Create a diagram</Link><a href="#getting-started">Add and connect nodes</a><a href="#getting-started">Use swimlanes</a><a href="#validation-issues">Validate a diagram</a><a href="#export-formats">Export and share</a>
      </nav>

      <div className="help-bento">
        <section className="shortcuts-card" aria-labelledby="shortcuts-heading"><div className="section-heading"><div><p className="eyebrow">Keyboard reference</p><h2 id="shortcuts-heading"><Keyboard /> Shortcuts</h2></div></div><div className="shortcut-groups">
          <div><h3>Canvas</h3><dl><div><dt>Pan canvas</dt><dd><Keys children={["Space", "Drag"]} /></dd></div><div><dt>Zoom in</dt><dd><Keys children={["Ctrl", "+"]} /></dd></div><div><dt>Zoom out</dt><dd><Keys children={["Ctrl", "−"]} /></dd></div><div><dt>Fit diagram</dt><dd><Keys children={["Ctrl", "0"]} /></dd></div></dl></div>
          <div><h3>Editing</h3><dl><div><dt>Delete selection</dt><dd><Keys children={["Delete"]} /></dd></div><div><dt>Duplicate</dt><dd><Keys children={["Ctrl", "D"]} /></dd></div><div><dt>Undo</dt><dd><Keys children={["Ctrl", "Z"]} /></dd></div><div><dt>Redo</dt><dd><Keys children={["Ctrl", "Y"]} /></dd></div></dl></div>
          <div><h3>Selection</h3><dl><div><dt>Select all</dt><dd><Keys children={["Ctrl", "A"]} /></dd></div><div><dt>Nudge</dt><dd><Keys children={["Arrow"]} /></dd></div><div><dt>Move farther</dt><dd><Keys children={["Shift", "Arrow"]} /></dd></div><div><dt>Deselect</dt><dd><Keys children={["Esc"]} /></dd></div></dl></div>
          <div><h3>App</h3><dl><div><dt>Open shortcut card</dt><dd><Keys children={["?"]} /></dd></div><div><dt>Copy</dt><dd><Keys children={["Ctrl", "C"]} /></dd></div><div><dt>Paste</dt><dd><Keys children={["Ctrl", "V"]} /></dd></div></dl></div>
        </div></section>

        <aside className="help-side-cards"><article id="getting-started"><span><BookOpen /></span><h2>Getting started</h2><p>Add activities from the component rail, drag between node anchors to connect them, and use swimlanes to show ownership.</p><Link to="/projects">Open workspace <ChevronRight /></Link></article><article><span><Cloud /></span><h2>Storage & sharing</h2><p>Work locally by default, then connect Google Drive when a diagram needs portable storage or sharing.</p><Link to="/account">Review connection <ChevronRight /></Link></article></aside>
      </div>

      <section className="help-topics" aria-labelledby="topics-heading"><div className="section-heading"><div><p className="eyebrow">Troubleshooting</p><h2 id="topics-heading">Common topics</h2></div><span>{visibleTopics.length} results</span></div>{visibleTopics.length ? visibleTopics.map((topic) => <details id={topic.id} key={topic.id}><summary>{topic.title}<ChevronRight aria-hidden="true" /></summary><p>{topic.copy}</p></details>) : <p className="help-no-results" role="status">No help topics match “{query}”. Try storage, export, Drive, validation, or privacy.</p>}</section>

      <footer className="help-footer"><ShieldCheck /><div><strong>Still need help?</strong><span>Review the editor’s Validation panel and confirm your browser still has local storage enabled.</span></div><Link to="/projects">Return to workspace <ExternalLink /></Link></footer>
    </WorkspaceShell>
  );
}
