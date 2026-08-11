import { expect, test } from "@playwright/test";

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
  await page.getByTitle("Add Swimlane").click();
  const notations = ["Activity", "State", "Object in State", "Decision", "Merge", "Fork", "Join", "Initial State", "Final State", "Constraint", "Note"];
  for (const name of notations) await page.getByTitle(`Add ${name}`).click();
  await page.getByTitle("Auto arrange diagram").click();
  await page.getByRole("button", { name: "Fit diagram" }).click();
  await page.waitForTimeout(250);
  await expect(page.locator(".react-flow")).toHaveScreenshot("node-catalog-light.png");

  await page.getByRole("button", { name: "Open settings" }).click();
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
  await page.getByTitle("Add Swimlane").click();
  await page.getByTitle("Add Activity").click();
  await page.getByTitle("Add Decision").click();
  await page.getByTitle("Export image").click();
  await expect(page.getByRole("dialog", { name: "Export diagrams" })).toHaveScreenshot("export-modal.png");
});

test("process and swimlane manager hierarchy", async ({ page }) => {
  test.skip(test.info().project.name !== "edge", "Visual baselines use the stable Edge renderer");
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();

  for (const [index, name] of ["User", "Manager", "Officer"].entries()) {
    await page.getByRole("region", { name: "Untitled diagram" }).getByRole("button", { name: "Add lane" }).click();
    await page.getByRole("button", { name: `Lane settings for Lane ${index + 1}` }).click();
    const form = page.locator(".lane-properties-form");
    await form.getByLabel("Label").fill(name);
    await form.getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: `Lane settings for ${name}` }).click();
  }

  await page.getByRole("button", { name: "Add process" }).click();
  await page.getByLabel("Process name").fill("Fulfillment");
  await page.locator(".process-editor-disclosure").getByRole("button", { name: "Save" }).click();
  await page.getByRole("region", { name: "Fulfillment" }).getByRole("button", { name: "Add lane" }).click();
  await page.getByRole("button", { name: "Lane settings for Lane 1" }).click();
  await page.locator(".lane-properties-form").getByLabel("Label").fill("Operations");
  await page.locator(".lane-properties-form").getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Lane settings for Operations" }).click();

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("radio", { name: /Dark/ }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("button", { name: "Fulfillment", exact: true }).click();
  await page.addStyleTag({ content: ".sidebar-heading,.node-palette,.appearance-manager,.sidebar-spacer,.sidebar-actions,.sidebar-status{display:none!important}.editor-sidebar{overflow:visible!important}" });
  await page.locator(".lane-manager").scrollIntoViewIfNeeded();
  await expect(page.locator(".editor-sidebar")).toHaveScreenshot("process-swimlane-manager-dark.png");
});
