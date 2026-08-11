import { describe, expect, it } from "vitest";
import { createDiagram, parseDiagram } from "../domain/diagram";
import type { ProjectRecord } from "../persistence/project-repository";
import {
  buildProjectProcessManifest,
  buildWorkspaceManifest,
  processExportFilename,
  safeArchiveSegment,
  sliceProcessDocument,
} from "./process-export";

function record(id: string, title: string): ProjectRecord {
  const document = createDiagram(title);
  return { id, title, document, createdAt: document.metadata.createdAt, updatedAt: document.metadata.updatedAt };
}

describe("process export manifests", () => {
  it("slices a selected process into an independently valid v4 document", () => {
    const document = createDiagram("Claims Project");
    document.processes[0].name = "Intake";
    document.processes.push({
      id: "process-b", name: "Approval", position: { x: 900, y: 400 },
      lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 },
    });

    const sliced = sliceProcessDocument(document, "process-b");

    expect(parseDiagram(sliced).processes).toHaveLength(1);
    expect(sliced.processes[0]).toMatchObject({ id: "process-b", name: "Approval", position: { x: 0, y: 0 } });
    expect(sliced.metadata.title).toBe("Claims Project - Approval");
    expect(document.processes[1].position).toEqual({ x: 900, y: 400 });
  });

  it("reports a process that is no longer available", () => {
    expect(() => sliceProcessDocument(createDiagram("Claims"), "missing-process")).toThrow("The selected diagram is no longer available.");
  });

  it("creates safe readable archive segments for untrusted names", () => {
    expect(safeArchiveSegment("Claims Project")).toBe("Claims-Project");
    expect(safeArchiveSegment("../")).toBe("activity-diagram");
    expect(safeArchiveSegment("..\\")).toBe("activity-diagram");
    expect(safeArchiveSegment(".")).toBe("activity-diagram");
    expect(safeArchiveSegment("..")).toBe("activity-diagram");
    expect(safeArchiveSegment("claims\u0000\n/export\\approval")).toBe("claims-export-approval");
    expect(safeArchiveSegment("")).toBe("activity-diagram");
  });

  it("numbers zero-based process indexes in export filenames", () => {
    expect(processExportFilename("Claims Project", 1, "png")).toBe("Claims-Project-002.png");
  });

  it("rejects process indexes outside the supported one-through-one-hundred range", () => {
    expect(() => processExportFilename("Claims", -1, "svg")).toThrow("Process index must be between 0 and 99.");
    expect(() => processExportFilename("Claims", 100, "svg")).toThrow("Process index must be between 0 and 99.");
  });

  it("builds root-level current-project entries in process order", () => {
    const claims = record("claims", "Claims");
    claims.document.processes[0].name = "Intake";
    claims.document.processes.push({
      id: "claims-approval", name: "Approval", position: { x: 25, y: 50 },
      lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 },
    });

    const manifest = buildProjectProcessManifest(claims, "svg");

    expect(manifest.map((entry) => entry.path)).toEqual(["Claims-001.svg", "Claims-002.svg"]);
    expect(manifest.map((entry) => entry.processOrder)).toEqual([1, 2]);
    expect(manifest.every((entry) => parseDiagram(entry.document).processes.length === 1)).toBe(true);
  });

  it("uses safe unique project folders in workspace manifests", () => {
    const first = record("first", "Claims");
    const second = record("second", "Claims");

    const manifest = buildWorkspaceManifest([first, second], "svg", "diagram-wise");

    expect(manifest.map((entry) => entry.path)).toEqual(["Claims/Claims-001.svg", "Claims-2/Claims-001.svg"]);
    expect(manifest.every((entry) => parseDiagram(entry.document).processes.length === 1)).toBe(true);
  });

  it("allocates a unique folder when a duplicate suffix is another project title", () => {
    const manifest = buildWorkspaceManifest([
      record("claims-1", "Claims"),
      record("claims-2", "Claims"),
      record("claims-2-title", "Claims-2"),
    ], "svg", "diagram-wise");

    expect(manifest.map((entry) => entry.path)).toEqual([
      "Claims/Claims-001.svg",
      "Claims-2/Claims-001.svg",
      "Claims-2-2/Claims-2-001.svg",
    ]);
  });

  it("slices maximum-length titles into strict v4 documents", () => {
    const document = createDiagram("P".repeat(120));
    document.processes[0].name = "A".repeat(120);

    const sliced = sliceProcessDocument(document, document.processes[0].id);

    expect(parseDiagram(sliced)).toMatchObject({ version: 4 });
    expect(sliced.metadata.title).toHaveLength(120);
  });

  it("keeps complete validated multi-process documents in project-wise JSON", () => {
    const claims = record("claims", "Claims");
    claims.document.processes.push({
      id: "claims-approval", name: "Approval", position: { x: 10, y: 20 },
      lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 },
    });

    const manifest = buildWorkspaceManifest([claims], "json", "project-wise");

    expect(manifest).toHaveLength(1);
    expect(manifest[0]).toMatchObject({ path: "Claims/Claims.json", processOrder: null });
    expect(parseDiagram(manifest[0].document).processes).toHaveLength(2);
  });
});
