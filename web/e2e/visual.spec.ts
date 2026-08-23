import { expect, test } from "@playwright/test";
import { addSwimlaneToActiveProcess, importProcessManagerFixture, openProcessManager } from "./process-manager-fixture";

test("dashboard visual baseline", async ({ page }) => {
  test.skip(test.info().project.name !== "edge", "Visual baselines use the stable Edge renderer");
  await page.goto("/projects");
  await expect(page.getByRole("button", { name: "New diagram" })).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard.png", { fullPage: true });
});

test("complete UML node catalog visual baselines", async ({ page }) => {
  test.skip(test.info().project.name !== "edge", "Visual baselines use the stable Edge renderer");
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await addSwimlaneToActiveProcess(page);
  const notations = ["Activity", "State", "Object in State", "Decision", "Merge", "Fork", "Join", "Initial State", "Final State", "Constraint", "Note"];
  for (const name of notations) await page.getByTitle(`Add ${name}`).click();
  await page.getByTitle("Auto arrange diagram").click();
  await page.getByRole("button", { name: "Fit diagram" }).click();
  await page.waitForTimeout(250);
  await expect(page.locator(".react-flow")).toHaveScreenshot("node-catalog-light.png");

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("radio", { name: /Dark/ }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.locator(".react-flow")).toHaveScreenshot("node-catalog-dark.png");
});

test("settings and validation notification surfaces", async ({ page }) => {
  test.skip(test.info().project.name !== "edge", "Visual baselines use the stable Edge renderer");
  await page.goto("/projects");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveScreenshot("settings.png");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByRole("button", { name: /Validation notifications/ }).click();
  await expect(page.getByRole("region", { name: "Diagram health" })).toHaveScreenshot("validation-notifications.png");
});

test("export preview modal", async ({ page }) => {
  test.skip(test.info().project.name !== "edge", "Visual baselines use the stable Edge renderer");
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await addSwimlaneToActiveProcess(page);
  await page.getByTitle("Add Activity").click();
  await page.getByTitle("Add Decision").click();
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("dialog", { name: "Export diagrams" })).toHaveScreenshot("export-modal.png");
});

test("process and swimlane manager hierarchy", async ({ page }) => {
  test.skip(test.info().project.name !== "edge", "Visual baselines use the stable Edge renderer");
  await page.setViewportSize({ width: 1440, height: 960 });
  await importProcessManagerFixture(page);
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("radio", { name: /Dark/ }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  const dialog = await openProcessManager(page);
  await expect(dialog).toHaveScreenshot("process-manager-dark.png");

  await page.setViewportSize({ width: 430, height: 820 });
  await dialog.getByLabel("Find a process").fill("Process 002");
  await dialog.getByRole("button", { name: "Select Process 002" }).click();
  await expect(dialog).toHaveScreenshot("process-manager-mobile-lanes.png");
});
