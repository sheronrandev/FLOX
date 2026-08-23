import type { ReactNode } from "react";
import { Cloud, CloudOff, Files, Grid2X2, HardDrive, HelpCircle, LogIn, LogOut, Search, Settings } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BrandLogo } from "./BrandLogo";
import { UserAvatar } from "./UserAvatar";
import { Button } from "./ui/button";

interface WorkspaceSearch {
  value: string;
  placeholder: string;
  label: string;
  onChange(value: string): void;
}

interface WorkspaceShellProps {
  pageLabel: string;
  projectCount: number;
  onOpenSettings(triggerId?: string): void;
  children: ReactNode;
  search?: WorkspaceSearch;
  contentClassName?: string;
}

export function WorkspaceShell({ pageLabel, projectCount, onOpenSettings, children, search, contentClassName = "" }: WorkspaceShellProps) {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();

  return (
    <main id="main-content" className="dashboard-shell" tabIndex={-1}>
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" to="/projects/overview" aria-label="FLOX workspace"><BrandLogo decorative /></Link>
        <p className="sidebar-section-label">Workspace</p>
        <nav aria-label="Workspace navigation">
          <NavLink to="/projects/overview" className={({ isActive }) => isActive ? "is-active" : undefined}><Grid2X2 /> Overview</NavLink>
          <NavLink end to="/projects" className={({ isActive }) => isActive ? "is-active" : undefined}><Files /> All diagrams <span>{projectCount}</span></NavLink>
        </nav>
        <div className="sidebar-divider" />
        <nav aria-label="Workspace utilities">
          <button id="dashboard-settings-trigger" onClick={() => onOpenSettings("dashboard-settings-trigger")}><Settings /> Settings</button>
          <NavLink to="/help" className={({ isActive }) => isActive ? "is-active" : undefined}><HelpCircle /> Help & shortcuts</NavLink>
        </nav>
        <div className="dashboard-sidebar__account">
          {!loading && (user ? <>
            <UserAvatar name={user.displayName} picture={user.picture} />
            <div><strong>{user.displayName}</strong><small>Local + Drive</small></div>
            <Button variant="ghost" size="icon" onClick={() => void logout()} title="Sign out"><LogOut /></Button>
          </> : <>
            <UserAvatar name="Local workspace" fallback={<HardDrive />} className="user-avatar is-local" />
            <div><strong>Local workspace</strong><small>Stored on this device</small></div>
            <Button variant="ghost" size="icon" onClick={() => navigate("/account")} title="Connect Google"><LogIn /></Button>
          </>)}
        </div>
      </aside>

      <section className="dashboard-main">
        <header className={`dashboard-topbar${search ? " has-search" : ""}`}>
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{pageLabel}</strong></div>
          <div className="dashboard-topbar__actions">
            {search && <label className="project-search"><Search /><span className="sr-only">{search.label}</span><input value={search.value} onChange={(event) => search.onChange(event.target.value)} placeholder={search.placeholder} /></label>}
            <span className={`local-status${user ? " is-connected" : ""}`} title={user ? "Files stay local and can also be stored and shared through Google Drive" : "Files are stored only in this browser"}>
              {user ? <><Cloud /> Local + Drive</> : <><CloudOff /> Local only</>}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigate("/account")} title={user ? "Manage Google connection" : "Connect Google"}>
              <UserAvatar name={user?.displayName ?? "Local workspace"} picture={user?.picture} className="topbar-avatar" />
            </Button>
          </div>
        </header>
        <div className={`dashboard-content ${contentClassName}`.trim()}>{children}</div>
      </section>
    </main>
  );
}
