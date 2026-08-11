import { expect, test, type Page } from "@playwright/test";
import { decodeBytes, readDownload, readZipEntries } from "./helpers";
import { parseDiagram, type DiagramDocument } from "../src/domain/diagram";

function exportFixture(title: string, processes: Array<{ name: string; activity: string }>): DiagramDocument {
  const now = new Date().toISOString();
  const prefix = title.toLowerCase().replace(/\s+/g, "-").slice(0, 60);
  return parseDiagram({
    format: "activity-diagram",
    version: 4,
    metadata: { title, createdAt: now, updatedAt: now },
    processes: processes.map((process, index) => ({
      id: `${prefix}-process-${index + 1}`,
      name: process.name,
      position: { x: 0, y: index * 620 },
      lanes: [{ id: `${prefix}-lane-${index + 1}`, name: `${process.name} Lane`, width: 320, colorIndex: index % 8 }],
      nodes: [{
        id: `${prefix}-activity-${index + 1}`,
        type: "activity",
        position: { x: 90, y: 110 },
        label: process.activity,
        laneId: `${prefix}-lane-${index + 1}`,
      }],
      edges: [],
      swimlaneLayout: { heightMode: "automatic", height: 760 },
    })),
    appearance: { canvasColor: "#fafafa", gridColor: "#d7dde1", controlFlowColor: "#58666d", objectFlowColor: "#58666d" },
  });
}

async function createExportProject(
  page: Page,
  title: string,
  processes: Array<{ name: string; activity: string }>,
) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  const document = exportFixture(title, processes);
  await page.getByLabel("Import diagram JSON").setInputFiles({
    name: `${title}.json`,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(document)),
  });
  await expect(page.getByText("Diagram imported", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Diagram title")).toHaveValue(title);
  await expect(page.locator(".editor-statusbar")).toContainText(`${processes.length} ${processes.length === 1 ? "diagram" : "diagrams"}`);
  await expect(page.locator(".privacy-chip")).toContainText("Saving locally");
  await expect(page.locator(".privacy-chip")).toContainText("Saved locally");
  return page.url();
}

function expectSvgEntry(
  entries: Record<string, Uint8Array>,
  path: string,
  includedText: string[],
  excludedText: string[],
) {
  const svg = decodeBytes(entries[path]);
  for (const text of includedText) expect(svg).toContain(text);
  for (const text of excludedText) expect(svg).not.toContain(text);
}

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
  await page.setViewportSize({ width: 900, height: 500 });
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await page.getByTitle("Add Swimlane").click();

  const processName = page.locator(".process-row__name").first();
  await expect(processName).toBeVisible();
  expect((await processName.boundingBox())!.width).toBeGreaterThanOrEqual(80);
  await expect(page.getByRole("button", { name: /Process settings for/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Show .* on canvas/ })).toHaveText("Show on canvas");
  await expect(page.getByRole("button", { name: /Lane settings for/ })).toBeVisible();

  const overflow = page.getByRole("button", { name: /More actions for/ }).first();
  await overflow.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Delete process" })).toBeVisible();
  const menuBox = await menu.boundingBox();
  const viewport = page.viewportSize();
  expect(menuBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(8);
  expect(menuBox!.y).toBeGreaterThanOrEqual(8);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport!.width - 8);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewport!.height - 8);
  await page.keyboard.press("Escape");
  await expect(overflow).toBeFocused();

  await overflow.click();
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
  await expect(page.locator(":focus")).not.toHaveAttribute("role", "menuitem");

  await overflow.focus();
  await overflow.click();
  await page.keyboard.press("Shift+Tab");
  await expect(menu).toBeHidden();
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

test("process-level export downloads isolated diagrams and importable JSON scopes", async ({ page }) => {
  test.setTimeout(120_000);
  const currentUrl = await createExportProject(page, "Project", [
    { name: "Intake", activity: "First Task" },
    { name: "Approval", activity: "Second Task" },
  ]);
  await createExportProject(page, "Second Project", [{ name: "Archive", activity: "Archive Task" }]);
  await page.goto(currentUrl);
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.getByRole("button", { name: "Approval", exact: true }).click();

  await page.getByTitle("Export image").click();
  const dialog = page.getByRole("dialog", { name: "Export diagrams" });
  await dialog.getByLabel("SVG").check();

  let downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export SVG", exact: true }).click();
  const selectedSvg = await readDownload(await downloadEvent);
  expect(selectedSvg.filename).toBe("Project-002.svg");
  const selectedSvgText = decodeBytes(selectedSvg.bytes);
  expect(selectedSvgText).toContain("Approval");
  expect(selectedSvgText).toContain("Second Task");
  expect(selectedSvgText).not.toContain("Intake");
  expect(selectedSvgText).not.toContain("First Task");

  await dialog.getByLabel("Export separately").check();
  downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export ZIP" }).click();
  const separateSvg = await readDownload(await downloadEvent);
  expect(separateSvg.filename).toBe("Project-diagrams-svg.zip");
  const separateEntries = readZipEntries(separateSvg.bytes);
  expect(Object.keys(separateEntries).sort()).toEqual(["Project-001.svg", "Project-002.svg"]);
  expectSvgEntry(separateEntries, "Project-001.svg", ["Intake", "First Task"], ["Approval", "Second Task", "Archive", "Archive Task"]);
  expectSvgEntry(separateEntries, "Project-002.svg", ["Approval", "Second Task"], ["Intake", "First Task", "Archive", "Archive Task"]);

  await dialog.getByLabel("All-in-one").check();
  downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export ZIP" }).click();
  const workspaceSvg = await readDownload(await downloadEvent);
  expect(workspaceSvg.filename).toBe("flox-workspace-svg.zip");
  const workspaceSvgEntries = readZipEntries(workspaceSvg.bytes);
  expect(Object.keys(workspaceSvgEntries).sort()).toEqual([
    "Project/Project-001.svg",
    "Project/Project-002.svg",
    "Second-Project/Second-Project-001.svg",
  ]);
  expectSvgEntry(workspaceSvgEntries, "Project/Project-001.svg", ["Intake", "First Task"], ["Approval", "Second Task", "Archive", "Archive Task"]);
  expectSvgEntry(workspaceSvgEntries, "Project/Project-002.svg", ["Approval", "Second Task"], ["Intake", "First Task", "Archive", "Archive Task"]);
  expectSvgEntry(workspaceSvgEntries, "Second-Project/Second-Project-001.svg", ["Archive", "Archive Task"], ["Intake", "First Task", "Approval", "Second Task"]);

  await dialog.getByLabel("JSON").check();
  await dialog.getByLabel("Export selected").check();
  downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export JSON", exact: true }).click();
  const selectedJson = await readDownload(await downloadEvent);
  expect(selectedJson.filename).toBe("Project-002.json");
  const selectedDocument = parseDiagram(JSON.parse(decodeBytes(selectedJson.bytes)));
  expect(selectedDocument.version).toBe(4);
  expect(selectedDocument.processes).toHaveLength(1);
  expect(selectedDocument.processes[0]).toMatchObject({ name: "Approval", position: { x: 0, y: 0 } });

  await dialog.getByLabel("Export project").check();
  downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export JSON", exact: true }).click();
  const projectJson = await readDownload(await downloadEvent);
  expect(projectJson.filename).toBe("Project.json");
  const projectDocument = parseDiagram(JSON.parse(decodeBytes(projectJson.bytes)));
  expect(projectDocument.processes.map((process) => process.name)).toEqual(["Intake", "Approval"]);
  expect(selectedDocument.processes[0].id).toBe(projectDocument.processes[1].id);

  await dialog.getByLabel("All-in-one").check();
  await expect(dialog.getByRole("group", { name: "Organization", exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Diagram-wise")).toBeChecked();
  downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export ZIP" }).click();
  const diagramWiseZip = readZipEntries((await readDownload(await downloadEvent)).bytes);
  expect(Object.keys(diagramWiseZip).sort()).toEqual([
    "Project/Project-001.json",
    "Project/Project-002.json",
    "Second-Project/Second-Project-001.json",
  ]);
  const expectedDiagramWise = {
    "Project/Project-001.json": { id: "project-process-1", name: "Intake", activities: ["First Task"] },
    "Project/Project-002.json": { id: "project-process-2", name: "Approval", activities: ["Second Task"] },
    "Second-Project/Second-Project-001.json": { id: "second-project-process-1", name: "Archive", activities: ["Archive Task"] },
  } as const;
  for (const [path, expected] of Object.entries(expectedDiagramWise)) {
    const exported = parseDiagram(JSON.parse(decodeBytes(diagramWiseZip[path])));
    expect(exported.processes.map((process) => ({
      id: process.id,
      name: process.name,
      activities: process.nodes.map((node) => node.label),
    }))).toEqual([expected]);
  }

  await dialog.getByLabel("Project-wise").check();
  downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export ZIP" }).click();
  const projectWiseZip = readZipEntries((await readDownload(await downloadEvent)).bytes);
  expect(Object.keys(projectWiseZip).sort()).toEqual([
    "Project/Project.json",
    "Second-Project/Second-Project.json",
  ]);
  expect(parseDiagram(JSON.parse(decodeBytes(projectWiseZip["Project/Project.json"]))).processes.map((process) => process.name)).toEqual(["Intake", "Approval"]);
  expect(parseDiagram(JSON.parse(decodeBytes(projectWiseZip["Second-Project/Second-Project.json"]))).processes.map((process) => process.name)).toEqual(["Archive"]);

  await dialog.getByRole("button", { name: "Close export" }).click();
  const importInput = page.getByLabel("Import diagram JSON");
  await importInput.setInputFiles({ name: selectedJson.filename, mimeType: "application/json", buffer: Buffer.from(selectedJson.bytes) });
  await expect(page.getByText("Diagram imported", { exact: true })).toBeVisible();
  await expect(page.locator(".editor-statusbar")).toContainText("1 diagram");
  await expect(page.getByRole("button", { name: "Approval", exact: true })).toBeVisible();
  await importInput.setInputFiles({ name: projectJson.filename, mimeType: "application/json", buffer: Buffer.from(projectJson.bytes) });
  await expect(page.locator(".editor-statusbar")).toContainText("2 diagrams");
  await expect(page.getByRole("button", { name: "Intake", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approval", exact: true })).toBeVisible();
});

test("preserves the numbered suffix on long-title direct SVG and PNG downloads", async ({ page }) => {
  const title = "L".repeat(80);
  await createExportProject(page, title, [{ name: "Intake", activity: "First Task" }]);
  await page.getByTitle("Export image").click();
  const dialog = page.getByRole("dialog", { name: "Export diagrams" });

  for (const format of ["SVG", "PNG"] as const) {
    await dialog.getByLabel(format).check();
    const downloadEvent = page.waitForEvent("download");
    await dialog.getByRole("button", { name: `Export ${format}`, exact: true }).click();
    expect((await readDownload(await downloadEvent)).filename).toBe(`${title}-001.${format.toLowerCase()}`);
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
