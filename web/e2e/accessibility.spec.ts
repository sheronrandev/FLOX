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

test("export dialog keeps native groups, announcements, focus, and reflow accessible", async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByTitle("Add Swimlane").click();
  await page.getByTitle("Add Activity").click();
  if (isMobile) await page.getByRole("button", { name: "Expand tools" }).click();
  await page.getByRole("button", { name: "Add process" }).click();
  await page.getByLabel("Process name").fill("Second flow");
  await page.locator(".process-editor-disclosure").getByRole("button", { name: "Save" }).click();
  await page.getByTitle("Add Swimlane").click();
  await page.getByTitle("Add Activity").click();

  const exportTrigger = page.getByTitle("Export JSON");
  await exportTrigger.click();
  let dialog = page.getByRole("dialog", { name: "Export diagrams" });
  await expect(dialog.getByRole("button", { name: "Close export" })).toBeFocused();
  await expect(dialog.getByRole("group", { name: "Format", exact: true })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Scope", exact: true })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Organization", exact: true })).toBeHidden();

  const selectedScope = dialog.getByLabel("Export selected");
  await selectedScope.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const allInOne = dialog.getByLabel("All-in-one");
  await expect(allInOne).toBeChecked();
  await expect(allInOne).toBeFocused();
  await expect(dialog.getByRole("group", { name: "Organization", exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Diagram-wise")).toBeChecked();
  await expect(allInOne).toBeFocused();

  let results = await new AxeBuilder({ page }).include(".export-dialog").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  if (!isMobile) await page.setViewportSize({ width: 640, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  if (isMobile) {
    const columns = await dialog.locator(".export-choice-grid").first().evaluate((grid) => getComputedStyle(grid).gridTemplateColumns);
    expect(columns.trim().split(/\s+/)).toHaveLength(1);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(exportTrigger).toBeFocused();

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("radio", { name: /Dark/ }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await exportTrigger.click();
  dialog = page.getByRole("dialog", { name: "Export diagrams" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  results = await new AxeBuilder({ page }).include(".export-dialog").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  await dialog.getByLabel("All-in-one").check();
  await dialog.getByLabel("PNG").check();
  await page.evaluate(() => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function delayedToBlob(callback, type, quality) {
      window.setTimeout(() => originalToBlob.call(this, callback, type, quality), 350);
    };
    const progress = document.querySelector(".workspace-export-progress");
    const observed: string[] = [];
    (window as typeof window & { __exportStatuses?: string[] }).__exportStatuses = observed;
    if (progress) new MutationObserver(() => {
      const value = progress.textContent?.trim();
      if (value && observed.at(-1) !== value) observed.push(value);
    }).observe(progress, { childList: true, subtree: true, characterData: true });
  });

  const downloadEvent = page.waitForEvent("download");
  const exportButton = dialog.locator(".export-dialog__actions button").last();
  await expect(exportButton).toHaveAccessibleName("Export ZIP");
  await exportButton.click();
  await expect(exportButton).toHaveAttribute("aria-busy", "true");
  await expect(dialog.getByRole("button", { name: "Close export" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await expect(dialog.getByText(/Preparing 1 of 2/)).toBeVisible();

  await dialog.getByRole("button", { name: "Close export" }).evaluate((button: HTMLButtonElement) => button.click());
  await dialog.getByRole("button", { name: "Cancel" }).evaluate((button: HTMLButtonElement) => button.click());
  await page.locator(".export-dialog-backdrop").dispatchEvent("mousedown");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  await downloadEvent;
  await expect(dialog.getByText("Export ready", { exact: true })).toBeVisible();
  const statuses = await page.evaluate(() => (window as typeof window & { __exportStatuses?: string[] }).__exportStatuses ?? []);
  expect(statuses).toContain("Loading project 1 of 1");
  expect(statuses).toContain("Preparing 1 of 2");
  expect(statuses).toContain("Preparing 2 of 2");
  expect(statuses).toContain("Export ready");

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await exportTrigger.click();
  dialog = page.getByRole("dialog", { name: "Export diagrams" });
  await dialog.getByRole("button", { name: "Close export" }).click();
  await expect(dialog).toBeHidden();
  await exportTrigger.click();
  dialog = page.getByRole("dialog", { name: "Export diagrams" });
  await page.locator(".export-dialog-backdrop").dispatchEvent("mousedown");
  await expect(dialog).toBeHidden();
  await exportTrigger.click();
  dialog = page.getByRole("dialog", { name: "Export diagrams" });
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
