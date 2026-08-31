import { useRef, useState } from "react";
import { Check, Download, Monitor, Moon, Palette, RotateCcw, SlidersHorizontal, Sun, UserRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { themePresets, themesEqual, type AppTheme, type ThemeMode, type ThemePreference } from "../domain/app-theme";
import { defaultDiagramAppearance } from "../domain/diagram";
import type { ExportPreferences } from "../domain/preferences";
import { useDialogFocus } from "../hooks/use-dialog-focus";
import { useDiagramStore } from "../store/diagram-store";
import { Button } from "./ui/button";
import { UserAvatar } from "./UserAvatar";

type Tab = "profile" | "appearance" | "project" | "export";

interface SettingsPanelProps {
  theme: AppTheme;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  onThemeChange: (theme: AppTheme) => void;
  exportPreferences: ExportPreferences;
  onExportPreferencesChange: (preferences: ExportPreferences) => void;
  projectSettings?: { readOnly: boolean } | null;
  onClose: () => void;
}

const themeChoices: Array<{ id: ThemePreference; name: string; description: string; icon: typeof Sun }> = [
  { id: "light", name: "Light", description: "Bright, precise workspace", icon: Sun },
  { id: "dark", name: "Dark", description: "Low-glare drafting studio", icon: Moon },
  { id: "system", name: "System", description: "Matches your device", icon: Monitor },
];

export function SettingsPanel({ theme, themePreference, onThemePreferenceChange, onThemeChange, exportPreferences, onExportPreferencesChange, projectSettings, onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>(() => projectSettings ? "project" : "profile");
  const dialogRef = useRef<HTMLElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const projectAppearance = useDiagramStore((state) => state.document.appearance);
  const updateProjectAppearance = useDiagramStore((state) => state.updateAppearance);
  const defaultThemeActive = themesEqual(theme, themePresets[theme.mode]);
  const projectDefaultsActive = projectAppearance.nodeFontSize === defaultDiagramAppearance.nodeFontSize
    && projectAppearance.processNameFontSize === defaultDiagramAppearance.processNameFontSize
    && projectAppearance.nodeInnerPadding === defaultDiagramAppearance.nodeInnerPadding;
  useDialogFocus(dialogRef, onClose);

  function chooseTheme(preference: ThemePreference) {
    onThemePreferenceChange(preference);
    if (preference !== "system") onThemeChange({ ...themePresets[preference] });
  }

  function customizeTheme(next: AppTheme) {
    onThemePreferenceChange(theme.mode as ThemeMode);
    onThemeChange(next);
  }

  const themeStatus = themePreference === "system"
    ? `System theme is active. FLOX ${theme.mode === "dark" ? "Dark" : "Light"} is currently in use.`
    : defaultThemeActive
      ? `FLOX ${theme.mode === "dark" ? "Dark" : "Light"} is active.`
      : "Custom workspace colors are active.";

  function resetProjectDefaults() {
    updateProjectAppearance({
      nodeFontSize: defaultDiagramAppearance.nodeFontSize,
      processNameFontSize: defaultDiagramAppearance.processNameFontSize,
      nodeInnerPadding: defaultDiagramAppearance.nodeInnerPadding,
    });
  }

  return <div className="settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1}>
      <header><h2 id="settings-title">Settings</h2><Button className="settings-close-button" variant="ghost" size="icon" aria-label="Close settings" onClick={onClose}><X aria-hidden="true" /></Button></header>
      <div className="settings-layout">
        <nav aria-label="Settings sections">
          <button aria-current={tab === "profile" ? "page" : undefined} className={tab === "profile" ? "is-active" : ""} onClick={() => setTab("profile")}><UserRound aria-hidden="true" /> Profile</button>
          <button aria-current={tab === "appearance" ? "page" : undefined} className={tab === "appearance" ? "is-active" : ""} onClick={() => setTab("appearance")}><Palette aria-hidden="true" /> Appearance</button>
          {projectSettings && <button aria-current={tab === "project" ? "page" : undefined} className={tab === "project" ? "is-active" : ""} onClick={() => setTab("project")}><SlidersHorizontal aria-hidden="true" /> Project</button>}
          <button aria-current={tab === "export" ? "page" : undefined} className={tab === "export" ? "is-active" : ""} onClick={() => setTab("export")}><Download aria-hidden="true" /> Export</button>
        </nav>
        <div className="settings-content">
          {tab === "profile" && <><div className="settings-title"><h3>Profile</h3><p>Your diagrams stay in this browser. An account is only used when you choose to share.</p></div>
            <div className="profile-card"><UserAvatar name={user?.displayName ?? "Local workspace"} picture={user?.picture} /><div><strong>{user?.displayName ?? "Local workspace"}</strong><span>{user?.email ?? "No connected sharing account"}</span></div><Button variant="outline" size="sm" onClick={() => { onClose(); navigate("/account"); }}>{user ? "Manage" : "Connect Google"}</Button></div>
            <div className="settings-note"><strong>Local-first privacy</strong><p>Creating, editing, and exporting diagrams never requires an account. Google Drive access is requested only when you share.</p></div>
          </>}
          {tab === "appearance" && <><div className="settings-title"><h3>Appearance</h3><p>Choose how FLOX looks across the workspace, editor, and dialogs.</p></div>
            <fieldset className="theme-selector"><legend>Theme</legend><div className="theme-options">
              {themeChoices.map(({ id, name, description, icon: Icon }) => <button key={id} type="button" role="radio" aria-checked={themePreference === id} className={themePreference === id ? "theme-option is-selected" : "theme-option"} onClick={() => chooseTheme(id)}>
                <span className={`theme-option__preview theme-option__preview--${id}`} aria-hidden="true"><i /><b /><Icon /></span>
                <span className="theme-option__copy"><strong>{name}</strong><small>{description}</small></span>
                {themePreference === id && <Check className="theme-option__check" aria-hidden="true" />}
              </button>)}
            </div></fieldset>
            <div className="active-design-system"><span className="active-design-system__preview"><i /><b /></span><div><span>Active design system</span><strong>{theme.mode === "dark" ? "Architectural Night" : "Architectural Precision"}</strong><small>{theme.mode === "dark" ? "Dark" : "Light"} · Inter · JetBrains Mono · 8px radius</small></div></div>
            <h4>Workspace colors</h4><div className="custom-theme-grid">
              <label>Accent<input aria-label="Accent" type="color" value={theme.primary} onChange={(event) => customizeTheme({ ...theme, primary: event.target.value })} /></label>
              <label>App background<input aria-label="App background" type="color" value={theme.background} onChange={(event) => customizeTheme({ ...theme, background: event.target.value })} /></label>
              <label>Panels<input aria-label="Panels" type="color" value={theme.surface} onChange={(event) => customizeTheme({ ...theme, surface: event.target.value })} /></label>
              <label>Canvas<input aria-label="Canvas" type="color" value={theme.canvas} onChange={(event) => customizeTheme({ ...theme, canvas: event.target.value })} /></label>
            </div>
            <div className="theme-reset-row"><p aria-live="polite">{themeStatus}</p><Button type="button" variant="outline" size="sm" disabled={defaultThemeActive} onClick={() => onThemeChange({ ...themePresets[theme.mode] })}><RotateCcw aria-hidden="true" /> Reset theme</Button></div>
          </>}
          {tab === "project" && projectSettings && <><div className="settings-title"><h3>Project</h3><p>Set the typography and node density used by this diagram and its exports.</p></div>
            <label className="settings-field"><span>Default font size<small>Applies to node text, actor labels, decision guards, and node sub-components. Application interface text is unchanged.</small></span><select aria-label="Default diagram font size" disabled={projectSettings.readOnly} value={projectAppearance.nodeFontSize} onChange={(event) => updateProjectAppearance({ nodeFontSize: Number(event.target.value) })}>{Array.from({ length: 11 }, (_, index) => index + 10).map((size) => <option key={size} value={size}>{size} px{size === defaultDiagramAppearance.nodeFontSize ? " (Default)" : ""}</option>)}</select></label>
            <label className="settings-field"><span>Process name label font size<small>Changes process titles on the canvas and in PNG and SVG exports.</small></span><select aria-label="Process name label font size" disabled={projectSettings.readOnly} value={projectAppearance.processNameFontSize} onChange={(event) => updateProjectAppearance({ processNameFontSize: Number(event.target.value) })}>{Array.from({ length: 23 }, (_, index) => index + 18).map((size) => <option key={size} value={size}>{size} px{size === defaultDiagramAppearance.processNameFontSize ? " (Default)" : ""}</option>)}</select></label>
            <label className="settings-field"><span>Default inner padding<small>Changes spacing inside text-bearing nodes. Fixed UML symbols, including decision diamonds, remain unchanged.</small></span><select aria-label="Default node inner padding" disabled={projectSettings.readOnly} value={projectAppearance.nodeInnerPadding} onChange={(event) => updateProjectAppearance({ nodeInnerPadding: Number(event.target.value) })}>{Array.from({ length: 17 }, (_, index) => index + 4).map((padding) => <option key={padding} value={padding}>{padding} px{padding === defaultDiagramAppearance.nodeInnerPadding ? " (Default)" : ""}</option>)}</select></label>
            <div className="theme-reset-row"><p aria-live="polite">{projectDefaultsActive ? "Project typography is using the default values." : "Custom project typography is active."}</p><Button type="button" variant="outline" size="sm" disabled={projectSettings.readOnly || projectDefaultsActive} onClick={resetProjectDefaults}><RotateCcw aria-hidden="true" /> Reset to defaults</Button></div>
            {projectSettings.readOnly && <div className="settings-note"><strong>View-only project</strong><p>These project defaults can be viewed here, but only an editor or owner can change them.</p></div>}
          </>}
          {tab === "export" && <><div className="settings-title"><h3>Export defaults</h3><p>These preferences are used by quick PNG and SVG exports.</p></div>
            <label className="settings-field"><span>Default format<small>Choose the first image format shown in export workflows.</small></span><select value={exportPreferences.defaultFormat} onChange={(event) => onExportPreferencesChange({ ...exportPreferences, defaultFormat: event.target.value as "png" | "svg" })}><option value="png">PNG image</option><option value="svg">SVG vector</option></select></label>
            <label className="settings-field"><span>PNG quality<small>Higher scale improves detail and increases file size.</small></span><select value={exportPreferences.imageScale} onChange={(event) => onExportPreferencesChange({ ...exportPreferences, imageScale: Number(event.target.value) as 1 | 2 | 3 })}><option value="1">Standard · 1×</option><option value="2">High · 2×</option><option value="3">Ultra · 3×</option></select></label>
            <label className="settings-toggle"><span><strong>Transparent background</strong><small>Remove the canvas color from PNG and SVG exports.</small></span><input type="checkbox" checked={exportPreferences.transparentBackground} onChange={(event) => onExportPreferencesChange({ ...exportPreferences, transparentBackground: event.target.checked })} /></label>
          </>}
        </div>
      </div>
    </section>
  </div>;
}
