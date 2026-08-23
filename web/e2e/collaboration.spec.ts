import { expect, test } from "@playwright/test";

test("opens an honest Google Drive sharing flow", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("complementary", { name: "Share with Google Drive" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Google" })).toBeVisible();
  await expect(page.getByText("Local until you share")).toBeVisible();
});

test("uses the Stitch design system, custom colors, and export defaults", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  await settings.getByRole("button", { name: "Appearance" }).click();
  await expect(settings.getByText("Architectural Precision")).toBeVisible();
  await expect(settings.getByRole("button", { name: /Midnight Blue/ })).toHaveCount(0);
  await settings.getByLabel("Accent").fill("#00645a");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await settings.getByRole("button", { name: "Export" }).click();
  await settings.getByText("Transparent background").click();
  await settings.getByLabel("PNG quality").selectOption("3");
  await settings.getByRole("button", { name: "Close settings" }).click();
});
