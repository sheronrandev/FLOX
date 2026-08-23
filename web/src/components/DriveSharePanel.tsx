import { useState, type FormEvent } from "react";
import { CloudUpload, ExternalLink, ShieldCheck, X } from "lucide-react";
import type { DiagramDocument } from "../domain/diagram";
import { useAuth } from "../auth/AuthContext";
import { driveFileLink, shareDriveFile, uploadDiagramToDrive } from "../lib/google-drive";
import { Button } from "./ui/button";
import { UserAvatar } from "./UserAvatar";

export function DriveSharePanel({ projectId, document, onClose }: { projectId: string; document: DiagramDocument; onClose: () => void }) {
  const { user, connectGoogle, getDriveToken, driveConfigured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  async function ensureUpload() {
    const token = await getDriveToken();
    const key = `activity-studio.drive-file.${projectId}`;
    const existing = localStorage.getItem(key) ?? undefined;
    const fileId = await uploadDiagramToDrive(token, document, existing);
    localStorage.setItem(key, fileId);
    setLink(await driveFileLink(token, fileId));
    return { token, fileId };
  }
  async function upload() {
    setBusy(true); setMessage("");
    try { await ensureUpload(); setMessage("Latest diagram uploaded to Google Drive."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Drive upload failed"); }
    finally { setBusy(false); }
  }
  async function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const { token, fileId } = await ensureUpload();
      await shareDriveFile(token, fileId, String(data.get("email") ?? ""), data.get("role") === "reader" ? "reader" : "writer");
      setMessage("Google Drive sent the sharing invitation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sharing failed"); }
    finally { setBusy(false); }
  }
  return <aside className="drive-panel" aria-label="Share with Google Drive">
    <header><div><span>Google Drive</span><strong>Upload & share</strong></div><Button variant="ghost" size="icon" aria-label="Close sharing" onClick={onClose}><X /></Button></header>
    <div className="drive-content">
      <div className="drive-privacy"><ShieldCheck /><div><strong>Local until you share</strong><p>This project remains in browser storage. Only this diagram is uploaded after you approve Google access.</p></div></div>
      {!driveConfigured && <div className="settings-note"><strong>Google OAuth setup required</strong><p>Add <code>VITE_GOOGLE_CLIENT_ID</code> to enable Drive upload for this deployment.</p></div>}
      {driveConfigured && !user && <Button onClick={() => void connectGoogle()}><span className="button-google-g">G</span> Connect Google</Button>}
      {driveConfigured && user && <>
        <div className="drive-account"><UserAvatar name={user.displayName} picture={user.picture} /><span><strong>{user.displayName}</strong><small>{user.email}</small></span></div>
        <Button variant="outline" disabled={busy} onClick={() => void upload()}><CloudUpload /> {busy ? "Uploading…" : "Upload latest version"}</Button>
        <form onSubmit={share}><label>Email<input name="email" type="email" required placeholder="collaborator@example.com" /></label><label>Access<select name="role"><option value="writer">Can edit</option><option value="reader">Can view</option></select></label><Button disabled={busy} type="submit">Upload and share</Button></form>
        {link && <a className="drive-link" href={link} target="_blank" rel="noreferrer">Open in Google Drive <ExternalLink /></a>}
      </>}
      {message && <p className="drive-message" role="status">{message}</p>}
    </div>
  </aside>;
}
