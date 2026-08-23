import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { importProcessManagerFixture, LONG_PROCESS_NAME, openProcessManager } from "./process-manager-fixture";

test("finds and manages a process in a 100-process project", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop manager workflow");
  test.setTimeout(60_000);
  await importProcessManagerFixture(page);
  const dialog = await openProcessManager(page);

  await dialog.getByLabel("Find a process").fill("reimbursement");
  await expect(dialog.getByText("Showing 1 process")).toBeAttached();
  await dialog.getByRole("button", { name: `Select ${LONG_PROCESS_NAME}` }).click();
  await expect(dialog.getByRole("complementary", { name: `Manage swimlanes for ${LONG_PROCESS_NAME}` })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Lane settings for/ })).toHaveCount(3);

  await dialog.getByRole("button", { name: "Lane settings for Intake 99" }).click();
  const laneForm = dialog.locator(".lane-properties-form");
  await laneForm.getByLabel("Label").fill("Priority intake");
  await laneForm.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("button", { name: "Lane settings for Priority intake" })).toBeVisible();

  await dialog.getByRole("list", { name: "Processes" }).getByRole("button", { name: `Show ${LONG_PROCESS_NAME} on canvas` }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: `Move process ${LONG_PROCESS_NAME}` })).toBeVisible();
});

test("supports search shortcuts, Escape focus restoration, and accessible zoom reflow", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop accessibility workflow");
  await importProcessManagerFixture(page);
  const trigger = page.getByRole("button", { name: "Open processes (100)" });
  const dialog = await openProcessManager(page);
  await expect(dialog.getByLabel("Find a process")).toBeFocused();

  await dialog.getByLabel("Arrange results").focus();
  await page.keyboard.press("Control+k");
  await expect(dialog.getByLabel("Find a process")).toBeFocused();
  await dialog.getByLabel("Find a process").fill("Process 042");
  await expect(dialog.getByRole("button", { name: "Select Process 042" })).toBeVisible();

  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).include(".process-manager-dialog").analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await page.evaluate(() => { document.documentElement.style.zoom = ""; });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("uses a two-step process and swimlane view on mobile", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile process manager behavior");
  await importProcessManagerFixture(page);
  const dialog = await openProcessManager(page);
  await dialog.getByLabel("Find a process").fill("Process 002");
  await dialog.getByRole("button", { name: "Select Process 002" }).click();

  await expect(dialog.getByRole("complementary", { name: "Manage swimlanes for Process 002" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Back to processes" })).toBeVisible();
  await expect(dialog.getByRole("list", { name: "Processes" })).toBeHidden();

  await dialog.getByRole("button", { name: "Back to processes" }).click();
  await expect(dialog.getByRole("list", { name: "Processes" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Select Process 002" })).toBeFocused();
});
