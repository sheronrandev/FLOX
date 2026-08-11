import { beforeEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { createDiagram, parseDiagram } from "../domain/diagram";
import type { ExportPreferences } from "../domain/preferences";
import type { ProjectRecord } from "../persistence/project-repository";
import { buildProjectProcessManifest, buildWorkspaceManifest, type ExportManifestEntry } from "./process-export";

const svgToPngBlob = vi.hoisted(() => vi.fn());

vi.mock("./export-diagram", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./export-diagram")>();
  return { ...actual, svgToPngBlob };
});

import { encodeExportArchive, orderWorkspaceRecords } from "./workspace-export";

const preferences: ExportPreferences = { defaultFormat: "png", transparentBackground: false, imageScale: 1 };

function record(id: string, title: string, updatedAt: string, processNames = ["Intake", "Approval"]): ProjectRecord {
  const document = createDiagram(title);
  document.metadata.updatedAt = updatedAt;
  document.processes[0].name = processNames[0];
  for (let index = 1; index < processNames.length; index += 1) {
    document.processes.push({
      id: `${id}-process-${index + 1}`,
      name: processNames[index],
      position: { x: index * 300, y: index * 200 },
      lanes: [],
      nodes: [],
      edges: [],
      swimlaneLayout: { heightMode: "automatic", height: 760 },
    });
  }
  return { id, title, document, createdAt: document.metadata.createdAt, updatedAt };
}

describe("workspace export", () => {
  beforeEach(() => {
    svgToPngBlob.mockReset();
    svgToPngBlob.mockResolvedValue(new Blob(["png-bytes"], { type: "image/png" }));
  });

  it("orders current first then the remaining diagrams by recency", () => {
    const records = [
      record("old", "Review", "2026-01-01T00:00:00.000Z"),
      record("current", "Review", "2026-01-02T00:00:00.000Z"),
      record("new", "Approve", "2026-01-03T00:00:00.000Z"),
    ];

    expect(orderWorkspaceRecords(records, "current").map((entry) => entry.id)).toEqual(["current", "new", "old"]);
  });

  it("preserves workspace manifest SVG paths and renders one process in each file", async () => {
    const entries = buildWorkspaceManifest([
      record("claims", "Claims", "2026-01-01T00:00:00.000Z", ["Claims intake", "Claims approval"]),
      record("billing", "Billing", "2026-01-02T00:00:00.000Z", ["Billing intake", "Billing approval"]),
    ], "svg", "diagram-wise");

    const archive = unzipSync(await encodeExportArchive(entries, "svg", preferences));

    expect(Object.keys(archive)).toEqual([
      "Claims/Claims-001.svg",
      "Claims/Claims-002.svg",
      "Billing/Billing-001.svg",
      "Billing/Billing-002.svg",
    ]);
    for (const entry of entries) {
      const svg = strFromU8(archive[entry.path]);
      const title = entry.document.processes[0].name;
      const sibling = entries.find((candidate) => candidate.projectId === entry.projectId && candidate.path !== entry.path)?.document.processes[0].name;
      expect(svg).toContain(title);
      expect(svg).not.toContain(sibling!);
    }
  });

  it("serializes diagram-wise JSON entries as one valid process document", async () => {
    const entries = buildProjectProcessManifest(record("claims", "Claims", "2026-01-01T00:00:00.000Z"), "json");
    const archive = unzipSync(await encodeExportArchive(entries, "json", preferences));

    expect(Object.keys(archive)).toEqual(["Claims-001.json", "Claims-002.json"]);
    for (const entry of entries) {
      expect(parseDiagram(JSON.parse(strFromU8(archive[entry.path]))).processes).toHaveLength(1);
    }
  });

  it("serializes project-wise JSON entries with every project process", async () => {
    const claims = record("claims", "Claims", "2026-01-01T00:00:00.000Z");
    const entries = buildWorkspaceManifest([claims], "json", "project-wise");
    const archive = unzipSync(await encodeExportArchive(entries, "json", preferences));

    expect(Object.keys(archive)).toEqual(["Claims/Claims.json"]);
    expect(parseDiagram(JSON.parse(strFromU8(archive["Claims/Claims.json"]))).processes).toHaveLength(2);
  });

  it("reports progress immediately before each manifest entry is encoded", async () => {
    const entries = buildProjectProcessManifest(record("claims", "Claims", "2026-01-01T00:00:00.000Z"), "svg");
    const progress = vi.fn();

    await encodeExportArchive(entries, "svg", preferences, progress);

    expect(progress.mock.calls).toEqual([[1, 2], [2, 2]]);
  });

  it("rejects an invalid later entry before progress or PNG conversion", async () => {
    const valid = buildProjectProcessManifest(record("claims", "Claims", "2026-01-01T00:00:00.000Z", ["Claims intake"]), "png")[0];
    const invalid: ExportManifestEntry = {
      ...valid,
      path: "Claims-002.png",
      document: { ...valid.document, processes: [{ ...valid.document.processes[0], name: "" }] },
    };
    const progress = vi.fn();

    await expect(encodeExportArchive([valid, invalid], "png", preferences, progress)).rejects.toThrow();

    expect(progress).not.toHaveBeenCalled();
    expect(svgToPngBlob).not.toHaveBeenCalled();
  });

  it.each(["svg", "png"] as const)("rejects a multi-process %s manifest before progress or conversion", async (format) => {
    const project = record("claims", "Claims", "2026-01-01T00:00:00.000Z");
    const entry: ExportManifestEntry = {
      projectId: project.id,
      projectName: project.title,
      processOrder: null,
      path: `Claims.${format}`,
      document: project.document,
    };
    const progress = vi.fn();

    await expect(encodeExportArchive([entry], format, preferences, progress)).rejects.toThrow("Image export entries must contain exactly one process");

    expect(progress).not.toHaveBeenCalled();
    expect(svgToPngBlob).not.toHaveBeenCalled();
  });

  it("rejects duplicate paths before encoding", async () => {
    const entry = buildProjectProcessManifest(record("claims", "Claims", "2026-01-01T00:00:00.000Z", ["Claims intake"]), "svg")[0];
    const progress = vi.fn();

    await expect(encodeExportArchive([entry, { ...entry }], "svg", preferences, progress)).rejects.toThrow("Duplicate export archive path");

    expect(progress).not.toHaveBeenCalled();
  });

  it("rejects when a PNG conversion fails without producing an archive", async () => {
    const [entry] = buildProjectProcessManifest(record("claims", "Claims", "2026-01-01T00:00:00.000Z", ["Claims intake"]), "png");
    svgToPngBlob.mockRejectedValueOnce(new Error("PNG unavailable"));

    await expect(encodeExportArchive([entry], "png", preferences)).rejects.toThrow("PNG unavailable");
  });
});
