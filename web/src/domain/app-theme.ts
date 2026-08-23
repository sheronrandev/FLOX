export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";
export type ThemePresetId = "studio-light" | "studio-dark" | "midnight" | "lavender" | "sand" | "custom";
export interface AppTheme { mode: ThemeMode; primary: string; background: string; surface: string; canvas: string }
export interface ThemePreset { id: Exclude<ThemePresetId, "custom">; name: string; description: string; theme: AppTheme }

const hex = /^#[0-9a-f]{6}$/i;
export const themeOptions: ThemePreset[] = [
  { id: "studio-light", name: "FLOX Light", description: "Clear and focused", theme: { mode: "light", primary: "#087f73", background: "#f5f8f7", surface: "#ffffff", canvas: "#fbfdfc" } },
  { id: "studio-dark", name: "FLOX Dark", description: "Modern, low-glare workspace", theme: { mode: "dark", primary: "#4fb6a3", background: "#1f1f1f", surface: "#252526", canvas: "#1e1e1e" } },
  { id: "midnight", name: "Midnight Blue", description: "Deep blue workspace", theme: { mode: "dark", primary: "#7aa2f7", background: "#10131c", surface: "#181d2b", canvas: "#0c1018" } },
  { id: "lavender", name: "Soft Lavender", description: "Calm and expressive", theme: { mode: "light", primary: "#7157b8", background: "#f6f3fb", surface: "#ffffff", canvas: "#fbfaff" } },
  { id: "sand", name: "Warm Sand", description: "Warm neutral palette", theme: { mode: "light", primary: "#8b5e34", background: "#f5f0e8", surface: "#fffdf9", canvas: "#faf7f1" } },
];

export const themePresets: Record<ThemeMode, AppTheme> = {
  light: themeOptions[0].theme,
  dark: themeOptions[1].theme,
};

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "dark" || value === "system" ? value : "light";
}

export function themesEqual(left: AppTheme, right: AppTheme) {
  return left.mode === right.mode && left.primary === right.primary && left.background === right.background &&
    left.surface === right.surface && left.canvas === right.canvas;
}

export function parseAppTheme(value: unknown): AppTheme {
  if (!value || typeof value !== "object") return themePresets.light;
  const candidate = value as Partial<AppTheme>;
  if ((candidate.mode !== "light" && candidate.mode !== "dark") ||
    ![candidate.primary, candidate.background, candidate.surface, candidate.canvas].every((color) => typeof color === "string" && hex.test(color))) {
    return themePresets.light;
  }
  return candidate as AppTheme;
}
