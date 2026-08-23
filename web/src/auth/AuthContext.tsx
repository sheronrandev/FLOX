import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { projectRepository, type ProjectRepository } from "../persistence/project-repository";

const PROFILE_KEY = "activity-studio.google-profile";
const GOOGLE_SCOPE = "openid email profile https://www.googleapis.com/auth/drive.file";
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
const GOOGLE_CLIENT_PLACEHOLDER = "your-client-id.apps.googleusercontent.com";
const GOOGLE_DRIVE_CONFIGURED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== GOOGLE_CLIENT_PLACEHOLDER);

interface GoogleTokenResponse { access_token?: string; error?: string; error_description?: string }
interface GoogleTokenClient { requestAccessToken(options?: { prompt?: string }): void }
interface GoogleApi {
  accounts: { oauth2: {
    initTokenClient(config: { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void; error_callback?: (error: { type?: string }) => void }): GoogleTokenClient;
    revoke(token: string, callback?: () => void): void;
  } };
}
declare global { interface Window { google?: GoogleApi } }

export interface AccountUser { id: string; email: string; displayName: string; createdAt: string; picture?: string }
interface AuthContextValue {
  user: AccountUser | null;
  loading: boolean;
  serverAvailable: boolean;
  driveConfigured: boolean;
  repository: ProjectRepository;
  connectGoogle(): Promise<void>;
  getDriveToken(): Promise<string>;
  login(email: string, password: string): Promise<void>;
  register(displayName: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  api<T>(path: string, options?: RequestInit & { json?: unknown }): Promise<T>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

function storedProfile(): AccountUser | null {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null") as Partial<AccountUser> | null;
    return value && typeof value.id === "string" && typeof value.email === "string" && typeof value.displayName === "string"
      ? { id: value.id, email: value.email, displayName: value.displayName, createdAt: value.createdAt ?? new Date().toISOString(), picture: value.picture }
      : null;
  } catch { return null; }
}

let googleScript: Promise<void> | null = null;
function loadGoogleIdentity() {
  if (window.google) return Promise.resolve();
  if (!googleScript) googleScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.defer = true;
    script.onload = () => resolve(); script.onerror = () => reject(new Error("Google sign-in could not be loaded"));
    document.head.appendChild(script);
  });
  return googleScript;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(storedProfile);
  const token = useRef<string | null>(null);

  async function getDriveToken() {
    if (token.current) return token.current;
    if (!GOOGLE_DRIVE_CONFIGURED || !GOOGLE_CLIENT_ID) throw new Error("Google Drive is not configured. Add a valid VITE_GOOGLE_CLIENT_ID to the web environment.");
    await loadGoogleIdentity();
    return new Promise<string>((resolve, reject) => {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPE,
        callback: (response) => {
          if (!response.access_token) { reject(new Error(response.error_description ?? response.error ?? "Google authorization was cancelled")); return; }
          token.current = response.access_token; resolve(response.access_token);
        },
        error_callback: () => reject(new Error("Google authorization was closed or blocked")),
      });
      client.requestAccessToken({ prompt: user ? "" : "consent" });
    });
  }

  async function connectGoogle() {
    const accessToken = await getDriveToken();
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) { token.current = null; throw new Error("Google profile could not be loaded"); }
    const profile = await response.json() as { sub: string; email: string; name?: string; picture?: string };
    const next = { id: profile.sub, email: profile.email, displayName: profile.name ?? profile.email, picture: profile.picture, createdAt: new Date().toISOString() };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); setUser(next);
  }

  async function logout() {
    if (token.current && window.google) window.google.accounts.oauth2.revoke(token.current);
    token.current = null; localStorage.removeItem(PROFILE_KEY); setUser(null);
  }

  async function retiredAccountFlow(): Promise<never> { throw new Error("Password accounts were replaced by optional Google Drive connection."); }
  async function retiredApi<T>(): Promise<T> { throw new Error("Server collaboration was replaced by Google Drive sharing."); }

  return <AuthContext.Provider value={{
    user, loading: false, serverAvailable: true, driveConfigured: GOOGLE_DRIVE_CONFIGURED, repository: projectRepository,
    connectGoogle, getDriveToken, logout, login: retiredAccountFlow, register: retiredAccountFlow, api: retiredApi,
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
