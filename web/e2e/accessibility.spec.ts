import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("dashboard and editor have no serious automated accessibility violations", async ({ page, isMobile }) => {
  await page.goto("/projects");
  let results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByTitle("Add Swimlane").click();
  await page.getByTitle("Add Activity").click();
  if (isMobile) await page.getByRole("button", { name: "Expand tools" }).click();
  await page.getByRole("button", { name: /Lane settings for/ }).click();
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("lane disclosure and export dialog keep focus and announcements usable", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByTitle("Add Swimlane").click();
  const laneButton = page.getByRole("button", { name: /Lane settings for/ });
  await laneButton.click();
  await expect(laneButton).toHaveAttribute("aria-expanded", "true");
  await page.locator(".lane-properties-form").getByRole("button", { name: "Cancel" }).click();
  await expect(laneButton).toBeFocused();
  const exportTrigger = page.getByTitle("Export JSON");
  await exportTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Export diagrams" });
  await expect(dialog.getByRole("button", { name: "Close export" })).toBeFocused();
  const results = await new AxeBuilder({ page }).include(".export-dialog").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(exportTrigger).toBeFocused();
});

test("dark mode settings, dashboard, and editor have no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: /Dark/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  let results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  await page.getByRole("button", { name: "Close settings" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByTitle("Add Swimlane").click();
  await page.getByTitle("Add Activity").click();
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("settings contains focus, closes with Escape, and restores the trigger", async ({ page }) => {
  await page.goto("/projects");
  const trigger = page.getByRole("button", { name: "Settings" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Close settings" })).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(page.getByLabel("Canvas")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("client-side navigation provides a title and focus cue", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveTitle("Workspace · FLOX");

  await page.getByRole("button", { name: "New diagram" }).click();
  await expect(page).toHaveTitle("Diagram editor · FLOX");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("overview and help routes provide accessible navigation and content", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveTitle("Workspace overview · FLOX");
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.locator("#main-content")).toBeFocused();

  let results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("link", { name: "Help & shortcuts" }).click();
  await expect(page).toHaveTitle("Help and shortcuts · FLOX");
  await expect(page.getByRole("heading", { level: 1, name: "Help & shortcuts" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByPlaceholder("Search help").fill("export");
  await expect(page.getByText("Export formats", { exact: true })).toBeVisible();
  await page.getByText("Export formats", { exact: true }).click();
  await expect(page.getByText(/PNG or SVG/)).toBeVisible();

  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("overview and help remain accessible in dark mode", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: /Dark/ }).click();
  await page.getByRole("button", { name: "Close settings" }).click();

  for (const path of ["/projects/overview", "/help"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  }
});
