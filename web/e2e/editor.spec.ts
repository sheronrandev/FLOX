import { expect, test } from "@playwright/test";

test("creates, edits, exports, and reopens a local diagram", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  await expect(page.getByRole("button", { name: "Shortcuts" })).toBeVisible();
  await page.getByTitle("Add Swimlane").click();
  await page.getByTitle("Add Decision").click();
  await page.getByTitle("Add Activity").click();
  await expect(page.locator(".uml-node")).toHaveCount(3);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".uml-node")).toHaveCount(2);
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator(".uml-node")).toHaveCount(3);
  const download = page.waitForEvent("download");
  await page.getByTitle("Export JSON").click();
  let exportDialog = page.getByRole("dialog", { name: "Export diagrams" });
  await exportDialog.getByRole("button", { name: "Export JSON", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
  await exportDialog.getByRole("button", { name: "Close export" }).click();
  await page.getByTitle("Export image").click();
  exportDialog = page.getByRole("dialog", { name: "Export diagrams" });
  await expect(exportDialog).toBeVisible();
  await exportDialog.getByLabel("SVG").check();
  const svgDownload = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "Export SVG", exact: true }).click();
  expect((await svgDownload).suggestedFilename()).toMatch(/\.svg$/);
  await exportDialog.getByLabel("PNG").check();
  await exportDialog.getByLabel("PNG quality").selectOption("3");
  await exportDialog.getByLabel("Remember as default").check();
  const pngDownload = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "Export PNG", exact: true }).click();
  expect((await pngDownload).suggestedFilename()).toMatch(/\.png$/);
  await exportDialog.getByRole("button", { name: "Close export" }).click();
  await page.getByTitle("Export image").click();
  exportDialog = page.getByRole("dialog", { name: "Export diagrams" });
  await expect(exportDialog.getByLabel("PNG quality")).toHaveValue("3");
  await exportDialog.getByRole("button", { name: "Close export" }).click();
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.locator(".uml-node")).toHaveCount(3);
});

test("supports keyboard focus and mobile-safe layout", async ({ page, isMobile }) => {
  await page.goto("/projects");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.getByRole("button", { name: "New diagram" }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (isMobile) {
    await expect(page.locator(".react-flow__minimap")).toBeHidden();
    await page.getByTitle("Add Swimlane").click();
    await page.getByTitle("Add Activity").click();
    const anchorSize = await page.evaluate(() => {
      const anchor = document.querySelector(".uml-anchor");
      if (!anchor) return null;
      const style = getComputedStyle(anchor); return { width: parseFloat(style.width), height: parseFloat(style.height) };
    });
    expect(anchorSize?.width).toBeGreaterThanOrEqual(16);
    expect(anchorSize?.height).toBeGreaterThanOrEqual(16);
  }
});

test("presents contextual process and swimlane management controls", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByTitle("Add Swimlane").click();

  await expect(page.getByRole("button", { name: /Process settings for/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Show .* on canvas/ })).toHaveText("Show on canvas");
  await expect(page.getByRole("button", { name: /Lane settings for/ })).toBeVisible();

  const overflow = page.getByRole("button", { name: /More actions for/ }).first();
  await overflow.click();
  await expect(page.getByRole("menuitem", { name: "Delete process" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overflow).toBeFocused();

  const reorder = page.getByRole("button", { name: /Move .* swimlane left/ }).first();
  const target = await reorder.boundingBox();
  expect(target?.width).toBeGreaterThanOrEqual(44);
  expect(target?.height).toBeGreaterThanOrEqual(44);
});

test("renames a component and closes properties without crashing the editor", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByTitle("Add Swimlane").click();
  await page.getByTitle("Add Activity").click();
  await page.locator(".uml-node--activity").click();
  const properties = page.getByRole("complementary", { name: "Properties" });
  await expect(properties).toBeVisible();
  const label = properties.getByLabel("Label");
  await label.fill("Review request");
  await properties.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".uml-node--activity")).toContainText("Review request");
  await properties.getByRole("button", { name: "Close properties" }).click();
  await expect(properties).toBeHidden();
  expect(pageErrors).toEqual([]);
  await expect(page.locator(".react-flow")).toBeVisible();
});

test("creates and customizes the complete UML notation set", async ({ page, isMobile }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByTitle("Add Swimlane").click();
  const labels = ["Activity", "State", "Object in State", "Decision", "Merge", "Fork", "Join", "Initial State", "Final State", "Constraint", "Note"];
  for (const label of labels) await page.getByTitle(`Add ${label}`).click();
  await expect(page.locator(".uml-node")).toHaveCount(labels.length + 1);
  for (const type of ["activity", "state", "object-in-state", "decision", "merge", "fork", "join", "initial", "final", "constraint", "note"]) {
    await expect(page.locator(`.uml-node--${type}`).first()).toBeVisible();
  }

  const pool = page.locator(".swimlane-pool");
  await expect(pool).toBeVisible();
  await expect(page.locator(".react-flow__node-swimlane-pool")).toHaveCSS("pointer-events", "none");
  if (isMobile) await page.getByRole("button", { name: "Expand tools" }).click();
  await page.getByRole("button", { name: /Lane settings for/ }).click();
  const laneForm = page.locator(".lane-properties-form");
  await laneForm.getByLabel("Label").fill("Operations");
  await laneForm.getByLabel("Width").fill("440");
  await laneForm.getByLabel("Height mode").selectOption("fixed");
  await laneForm.getByRole("spinbutton", { name: "Height", exact: true }).fill("980");
  await laneForm.getByRole("button", { name: "Save" }).click();
  await expect(pool).toContainText("Operations");
  await expect(pool).toHaveCSS("height", "1020px");
  await laneForm.getByLabel("Label").fill("Unsaved name");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: /Lane settings for/ }).click();
  await expect(laneForm).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Lane settings for/ }).click();
  await expect(laneForm).toBeHidden();
  await expect(page.getByRole("button", { name: /Lane settings for/ })).toBeFocused();
});

test("shows nested process counts and keeps workspace exports project-based", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await expect(page.locator(".editor-statusbar")).toContainText("1 diagram");
  await page.getByRole("button", { name: "Add process" }).click();
  await page.getByLabel("Process name").fill("Approval flow");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".editor-statusbar")).toContainText("2 diagrams");
  await page.getByLabel("Back to projects").click();
  await page.getByRole("button", { name: "New diagram" }).click();
  await expect(page.locator(".editor-statusbar")).toContainText("1 diagram");
  await page.getByTitle("Export JSON").click();
  const dialog = page.getByRole("dialog", { name: "Export diagrams" });
  await expect(dialog.getByText("2 diagrams in workspace")).toBeVisible();
  await dialog.getByLabel("All in one").check();
  const combined = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export ZIP" }).click();
  expect((await combined).suggestedFilename()).toBe("flox-workspace-all-in-one-json.zip");
  await dialog.getByLabel("Export separately").check();
  const separate = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export ZIP" }).click();
  expect((await separate).suggestedFilename()).toBe("flox-workspace-separate-json.zip");
  for (const format of ["SVG", "PNG"] as const) {
    await dialog.getByLabel(format).check();
    for (const [scope, suffix] of [["All in one", "all-in-one"], ["Export separately", "separate"]] as const) {
      await dialog.getByLabel(scope).check();
      const archive = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "Export ZIP" }).click();
      expect((await archive).suggestedFilename()).toBe(`flox-workspace-${suffix}-${format.toLowerCase()}.zip`);
    }
  }
});

test("connects visible handles and edits a selectable connector", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByTitle("Add Swimlane").click();
  await page.getByTitle("Add Initial State").click();
  await page.getByTitle("Add Activity").click();
  await page.getByRole("button", { name: "Fit diagram" }).click();
  await page.waitForTimeout(250);
  const source = page.locator('.uml-node--initial .uml-anchor[data-handleid="right"]');
  const target = page.locator('.uml-node--activity .uml-anchor[data-handleid="left"]');
  await expect(source).toBeVisible();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);

  const connector = page.getByRole("button", { name: "Select connector" });
  const connectorPoint = await connector.evaluate((path: SVGPathElement) => {
    const matrix = path.getScreenCTM();
    if (!matrix) throw new Error("Connector is not attached to the canvas");
    const edge = path.closest(".react-flow__edge");
    const length = path.getTotalLength();
    for (let step = 1; step < 20; step += 1) {
      const point = path.getPointAtLength(length * step / 20).matrixTransform(matrix);
      if (document.elementFromPoint(point.x, point.y)?.closest(".react-flow__edge") === edge) {
        return { x: point.x, y: point.y };
      }
    }
    throw new Error("Connector has no pointer-accessible path segment");
  });
  await page.mouse.click(connectorPoint.x, connectorPoint.y);
  const properties = page.getByRole("complementary", { name: "Properties" });
  await properties.getByLabel("Guard label").fill("[approved]");
  await properties.getByLabel("Flow type").selectOption("object-flow");
  await properties.getByLabel("Line pattern").selectOption("dotted");
  await properties.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Select connector with guard [approved]" })).toBeVisible();
});

test("keeps projects local when account connection is skipped", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.getByLabel("Back to projects").click();
  await expect(page.locator(".project-card", { hasText: "Untitled diagram" })).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  await page.getByRole("link", { name: "Continue with local workspace" }).click();
  await expect(page.getByRole("button", { name: "Connect Google" }).first()).toBeVisible();
  await expect(page.locator(".project-card", { hasText: "Untitled diagram" })).toBeVisible();
});

test("edits and keyboard-moves a centered process title", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  const title = page.getByRole("button", { name: "Move process Untitled diagram" });
  const before = await title.boundingBox();
  await title.focus();
  await page.keyboard.press("ArrowRight");
  const after = await title.boundingBox();
  expect(after!.x).toBeGreaterThan(before!.x);

  await page.getByRole("button", { name: "Process settings for Untitled diagram" }).click();
  const form = page.locator(".process-editor-disclosure");
  await form.getByLabel("Process name").fill("Claims approval");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Move process Claims approval" })).toBeVisible();
});

test("marks, clears, and restores per-process health findings", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  const trigger = page.getByRole("button", { name: /Validation notifications/ });
  await trigger.click();
  const health = page.getByRole("region", { name: "Diagram health" });
  await health.getByRole("button", { name: "Mark all as read" }).click();
  await expect(trigger.locator("> span")).toHaveCount(0);
  await expect(health.locator(".notification-item.is-read")).toHaveCount(2);
  await health.getByRole("button", { name: "Clear notifications" }).click();
  await expect(health.getByText("Notifications cleared")).toBeVisible();
  await health.getByRole("button", { name: /Restore cleared/ }).click();
  await expect(health.locator(".notification-item")).toHaveCount(2);
});

test("rejects a cross-process connector before committing it", async ({ page, isMobile }) => {
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
  await page.getByRole("button", { name: "Fit diagram" }).click();
  await page.waitForTimeout(250);

  const source = page.locator('.uml-node--activity .uml-anchor[data-handleid="right"]').first();
  const target = page.locator('.uml-node--activity .uml-anchor[data-handleid="left"]').last();
  const sourceBox = await source.boundingBox(); const targetBox = await target.boundingBox();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await expect(page.getByText("Flows cannot cross process boundaries.", { exact: true })).toBeAttached();
});
