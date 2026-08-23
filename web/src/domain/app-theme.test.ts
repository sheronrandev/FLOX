import { describe, expect, it } from "vitest";
import { parseAppTheme, parseThemePreference, themePresets, themesEqual } from "./app-theme";

describe("application theme", () => {
  it("accepts constrained color tokens and rejects unsafe values", () => {
    const custom = { ...themePresets.dark, primary: "#abcdef" };
    expect(parseAppTheme(custom)).toEqual(custom);
    expect(parseAppTheme({ ...custom, primary: "url(example)" })).toEqual(themePresets.light);
  });

  it("compares every semantic theme token", () => {
    expect(themesEqual({ ...themePresets.light }, themePresets.light)).toBe(true);
    expect(themesEqual({ ...themePresets.light, canvas: "#ffffff" }, themePresets.light)).toBe(false);
  });

  it("accepts explicit and system theme preferences", () => {
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference("unknown")).toBe("light");
  });
});
