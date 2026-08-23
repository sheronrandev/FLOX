import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Cloud, Download, HardDrive, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/button";
import { BrandLogo } from "../components/BrandLogo";

export function AccountPage() {
  const { user, connectGoogle, logout, driveConfigured } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    setBusy(true); setError("");
    try { await connectGoogle(); navigate("/projects"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Google connection failed"); }
    finally { setBusy(false); }
  }

  if (user) return <main id="main-content" className="account-page" tabIndex={-1}>
    <Link className="account-back" to="/projects"><ArrowLeft /> Back to workspace</Link>
    <section className="account-shell account-shell--connected">
      <div className="account-story">
        <BrandLogo variant="stacked" decorative />
        <p className="eyebrow">Private by design</p>
        <h1>Your workspace stays local.</h1>
        <p>Google is connected only for files you explicitly choose to share.</p>
      </div>
      <div className="account-form">
        {user.picture ? <img className="google-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" /> : <ShieldCheck className="account-state-icon" />}
        <p className="eyebrow">Google connected</p><h2>{user.displayName}</h2><p>{user.email}</p>
        <div className="account-benefits"><span><Check /> Diagrams remain local</span><span><Check /> Drive access only when sharing</span></div>
        <div className="account-actions" role="group" aria-label="Google account actions">
          <Button onClick={() => navigate("/projects")}>Open local workspace</Button>
          <Button variant="outline" onClick={() => void logout()}><LogOut /> Disconnect Google</Button>
        </div>
      </div>
    </section>
  </main>;

  return <main id="main-content" className="account-page" tabIndex={-1}>
    <Link className="account-back" to="/projects"><ArrowLeft /> Back to workspace</Link>
    <section className="account-shell">
      <div className="account-story">
        <BrandLogo variant="stacked" decorative />
        <div className="account-story__copy"><p className="eyebrow">Private by design</p><h1>Your ideas stay yours.</h1><p>FLOX is a local-first diagram editor. Create, edit, and export without an account.</p></div>
        <div className="privacy-points">
          <article><span><HardDrive /></span><div><strong>Local by default</strong><p>Your diagrams are saved in this browser, not on our servers.</p></div></article>
          <article><span><LockKeyhole /></span><div><strong>Permission when needed</strong><p>Google access is requested only when you decide to share.</p></div></article>
          <article><span><Download /></span><div><strong>Portable at any time</strong><p>Export JSON, PNG, or SVG whenever you want a backup.</p></div></article>
        </div>
        <p className="account-privacy-note"><ShieldCheck /> No tracking pixels · no hidden cloud sync</p>
      </div>

      <div className="account-form">
        <div className="account-form__mark"><Cloud /></div>
        <p className="eyebrow">Optional cloud connection</p>
        <h2>Sign in to share</h2>
        <p>Connect Google Drive to upload a copy and invite collaborators. Your working file remains local.</p>
        <div className="storage-flow"><span><HardDrive /> This device</span><i /><span><Cloud /> Google Drive</span></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button disabled={busy || !driveConfigured} onClick={() => void connect()}><span className="button-google-g">G</span>{busy ? "Connecting…" : "Continue with Google"}</Button>
        {!driveConfigured && <p className="configuration-note">Google sharing needs a <code>VITE_GOOGLE_CLIENT_ID</code> environment value. Local editing and exports remain available.</p>}
        <div className="account-divider"><span>or</span></div>
        <Link className="text-button" to="/projects">Continue with local workspace</Link>
        <p className="account-terms">By connecting Google, you agree to grant file access only for documents you choose to share.</p>
      </div>
    </section>
  </main>;
}
