import { expect, type Page } from "@playwright/test";
import { parseDiagram, type DiagramDocument } from "../src/domain/diagram";

const LONG_PROCESS_NAME = "International customer reimbursement and exception resolution";

export function processManagerFixture(): DiagramDocument {
  const now = new Date().toISOString();
  return parseDiagram({
    format: "activity-diagram",
    version: 4,
    metadata: { title: "One hundred processes", createdAt: now, updatedAt: now },
    processes: Array.from({ length: 100 }, (_, index) => {
      const order = index + 1;
      const id = `stress-process-${order}`;
      const name = order === 99 ? LONG_PROCESS_NAME : `Process ${String(order).padStart(3, "0")}`;
      return {
        id,
        name,
        position: { x: 0, y: index * 920 },
        lanes: ["Intake", "Review", "Completion"].map((laneName, laneIndex) => ({
          id: `${id}-lane-${laneIndex + 1}`,
          name: `${laneName} ${order}`,
          width: 320,
          colorIndex: laneIndex,
        })),
        nodes: [],
        edges: [],
        swimlaneLayout: { heightMode: "automatic", height: 760 },
      };
    }),
    appearance: {
      canvasColor: "#fafafa",
      gridColor: "#d7dde1",
      controlFlowColor: "#000000",
      objectFlowColor: "#000000",
    },
  });
}

export async function importProcessManagerFixture(page: Page) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New diagram" }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.getByLabel("Import diagram JSON").setInputFiles({
    name: "one-hundred-processes.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(processManagerFixture())),
  });
  await expect(page.getByRole("button", { name: "Open processes (100)" })).toBeVisible();
}

export async function openProcessManager(page: Page) {
  await page.getByRole("button", { name: /Open processes \(\d+\)/ }).click();
  const dialog = page.getByRole("dialog", { name: "Processes" });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function addSwimlaneToActiveProcess(page: Page) {
  const dialog = await openProcessManager(page);
  const addSwimlane = dialog.getByRole("button", { name: "Add swimlane" });
  if (!(await addSwimlane.isVisible())) {
    await dialog.getByRole("list", { name: "Processes" }).getByRole("button", { name: /^Select / }).first().click();
  }
  await addSwimlane.click();
  await dialog.getByRole("button", { name: "Close processes" }).click();
  await expect(dialog).toBeHidden();
  const expandTools = page.getByRole("button", { name: "Expand tools" });
  if (await expandTools.isVisible()) await expandTools.click();
}

export { LONG_PROCESS_NAME };
