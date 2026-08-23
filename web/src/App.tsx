import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { EditorPage } from "./pages/EditorPage";
import { parseAppTheme, parseThemePreference, themePresets, type AppTheme, type ThemeMode, type ThemePreference } from "./domain/app-theme";
import { AuthProvider } from "./auth/AuthContext";
import { AccountPage } from "./pages/AccountPage";
import { defaultExportPreferences, parseExportPreferences, type ExportPreferences } from "./domain/preferences";
import { SettingsPanel } from "./components/SettingsPanel";
import { RouteFeedback } from "./components/RouteFeedback";
import { OverviewPage } from "./pages/OverviewPage";
import { HelpPage } from "./pages/HelpPage";

const THEME_KEY = "activity-studio-custom-theme";
const THEME_PREFERENCE_KEY = "activity-studio-theme-preference";
const THEME_VERSION_KEY = "activity-studio-theme-version";
const THEME_STORAGE_VERSION = "4";
const EXPORT_KEY = "activity-studio-export-preferences";

function systemPrefersDark() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsProjectContext, setSettingsProjectContext] = useState<{ readOnly: boolean } | null>(null);
  const settingsTriggerId = useRef<string | null>(null);
  const settingsWasOpen = useRef(false);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    parseThemePreference(localStorage.getItem(THEME_PREFERENCE_KEY) ?? localStorage.getItem("activity-studio-theme")),
  );
  const [exportPreferences, setExportPreferences] = useState<ExportPreferences>(() => {
    try { return parseExportPreferences(JSON.parse(localStorage.getItem(EXPORT_KEY) ?? "null")); }
    catch { return defaultExportPreferences; }
  });
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const preferred = parseThemePreference(localStorage.getItem(THEME_PREFERENCE_KEY) ?? localStorage.getItem("activity-studio-theme"));
      const mode: ThemeMode = preferred === "system" ? (systemPrefersDark() ? "dark" : "light") : preferred;
      if (localStorage.getItem(THEME_VERSION_KEY) !== THEME_STORAGE_VERSION) return { ...themePresets[mode] };
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) return parseAppTheme(JSON.parse(saved));
      return themePresets[mode];
    } catch { return themePresets.light; }
  });

  function updateTheme(nextTheme: AppTheme) {
    const root = document.documentElement;
    root.classList.add("theme-changing");
    setTheme(nextTheme);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => root.classList.remove("theme-changing")));
  }

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const resolvedMode: ThemeMode = themePreference === "system" ? (systemDark ? "dark" : "light") : themePreference;

  useEffect(() => {
    if (theme.mode !== resolvedMode) updateTheme({ ...themePresets[resolvedMode] });
  }, [resolvedMode, theme.mode]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme.mode;
    document.documentElement.classList.toggle("dark", theme.mode === "dark");
    document.documentElement.style.colorScheme = theme.mode;
    document.documentElement.style.setProperty("--primary", theme.primary);
    document.documentElement.style.setProperty("--background", theme.background);
    document.documentElement.style.setProperty("--surface", theme.surface);
    document.documentElement.style.setProperty("--canvas", theme.canvas);
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", theme.background);
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    localStorage.setItem(THEME_VERSION_KEY, THEME_STORAGE_VERSION);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem(THEME_PREFERENCE_KEY, themePreference);
    localStorage.setItem("activity-studio-theme", themePreference);
  }, [themePreference]);
  useEffect(() => { localStorage.setItem(EXPORT_KEY, JSON.stringify(exportPreferences)); }, [exportPreferences]);
  useEffect(() => {
    const shouldRestoreFocus = settingsWasOpen.current && !settingsOpen;
    settingsWasOpen.current = settingsOpen;
    if (!shouldRestoreFocus) return;
    window.requestAnimationFrame(() => {
      if (settingsTriggerId.current) document.getElementById(settingsTriggerId.current)?.focus();
    });
  }, [settingsOpen]);

  function closeSettings() {
    setSettingsOpen(false);
    setSettingsProjectContext(null);
  }

  function openSettings(triggerId?: string, projectContext: { readOnly: boolean } | null = null) {
    settingsTriggerId.current = triggerId ?? null;
    setSettingsProjectContext(projectContext);
    setSettingsOpen(true);
  }

  return (
    <AuthProvider>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <RouteFeedback />
      <Routes>
      <Route path="/projects/overview" element={<OverviewPage onOpenSettings={(triggerId) => openSettings(triggerId)} />} />
      <Route path="/projects" element={<DashboardPage onOpenSettings={(triggerId) => openSettings(triggerId)} />} />
      <Route path="/help" element={<HelpPage onOpenSettings={(triggerId) => openSettings(triggerId)} />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/projects/:projectId/editor" element={<EditorPage
        theme={theme}
        exportPreferences={exportPreferences}
        onExportPreferencesChange={setExportPreferences}
        onOpenSettings={(triggerId, context) => openSettings(triggerId, context ?? null)}
      />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
      {settingsOpen && <SettingsPanel theme={theme} themePreference={themePreference} onThemePreferenceChange={setThemePreference} onThemeChange={updateTheme} exportPreferences={exportPreferences} onExportPreferencesChange={setExportPreferences} projectSettings={settingsProjectContext} onClose={closeSettings} />}
    </AuthProvider>
  );
}
