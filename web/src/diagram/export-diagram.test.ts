import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiagram } from "../domain/diagram";
import { processExportFilename } from "./process-export";
import { diagramToSvg, exportDiagramImage, safeExportName } from "./export-diagram";

describe("diagram image export", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the shared bounded Windows-safe policy for direct filenames", () => {
    expect(safeExportName("CON.svg")).toBe("activity-diagram");
    expect(safeExportName("cOm1")).toBe("activity-diagram");
    expect(safeExportName("A".repeat(200))).toBe("A".repeat(80));
  });

  it("creates escaped SVG and supports transparent backgrounds", () => {
    const document = createDiagram("Export");
    document.processes[0].nodes.push({ id: "activity", type: "activity", position: { x: 80, y: 90 }, label: "Review <request>", laneId: null });
    const opaque = diagramToSvg(document, false);
    const transparent = diagramToSvg(document, true);
    expect(opaque).toContain(`fill="${document.appearance.canvasColor}"`);
    expect(opaque).toContain("Review &lt;request&gt;");
    expect(transparent).not.toContain(`fill="${document.appearance.canvasColor}"`);
  });

  it("rejects direct image exports that contain more than one process", async () => {
    const document = createDiagram("Export");
    document.processes.push({
      id: "process-second", name: "Second", position: { x: 0, y: 0 },
      lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 },
    });

    await expect(exportDiagramImage(document, "svg", { defaultFormat: "svg", transparentBackground: false, imageScale: 1 })).rejects.toThrow("Image export supports exactly one process.");
  });

  it("exports structured notations, styled lanes, and guard labels", () => {
    const document = createDiagram("Complete export");
    document.processes[0].nodes = [
      { id: "object", type: "object-in-state", position: { x: 80, y: 90 }, label: "Order", state: "Approved", laneId: "lane" },
      { id: "constraint", type: "constraint", position: { x: 300, y: 90 }, label: "Limit", body: "Total < 100", laneId: "lane" },
    ];
    document.processes[0].lanes = [
      { id: "lane", name: "Operations", width: 260, colorIndex: 0, style: { fill: "#ddeeff", stroke: "#334455", textColor: "#112233" } },
      { id: "lane-2", name: "Review", width: 260, colorIndex: 1 },
    ];
    document.processes[0].edges = [{ id: "edge", type: "object-flow", sourceNodeId: "object", sourceAnchorId: "right", targetNodeId: "constraint", targetAnchorId: "left", guardLabel: "[valid]", routing: "automatic", style: { stroke: "#087f73", width: 2, dash: "dashed" } }];
    const svg = diagramToSvg(document, false);
    expect(svg).toContain("[Approved]");
    expect(svg).toContain("Total &lt; 100");
    expect(svg).toContain("Operations");
    expect(svg).toContain("[valid]");
    expect(svg).toContain("stroke-dasharray=\"7 5\"");
    expect(svg).toContain("Complete export");
    expect(svg).toContain('class="swimlane-pool-outline"');
    expect(svg).toContain('class="swimlane-separator"');
    expect(svg).toContain('stroke-dasharray="4 4"');
    expect(svg).not.toContain('class="swimlane-heading-rule"');
  });

  it("downloads a supplied process-order SVG filename", async () => {
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:export"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("window", { document: { createElement: vi.fn(() => link) }, setTimeout: (handler: () => void) => handler() });

    await exportDiagramImage(createDiagram("Claims"), "svg", { defaultFormat: "svg", transparentBackground: false, imageScale: 1 }, "Claims-002");

    expect(link.download).toBe("Claims-002.svg");
  });

  it.each([
    { format: "svg" as const, title: "A".repeat(80), processIndex: 0, expected: `${"A".repeat(80)}-001.svg` },
    { format: "png" as const, title: "B".repeat(120), processIndex: 99, expected: `${"B".repeat(80)}-100.png` },
  ])("preserves the process-order suffix for a bounded direct $format download", async ({ format, title, processIndex, expected }) => {
    const link = { href: "", download: "", click: vi.fn() };
    const context = { scale: vi.fn(), drawImage: vi.fn() };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context), toBlob: (handler: (blob: Blob) => void) => handler(new Blob(["png"])) };
    class LoadedImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", LoadedImage);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:export"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("window", { document: { createElement: vi.fn((tag: string) => tag === "canvas" ? canvas : link) }, setTimeout: (handler: () => void) => handler() });
    const filename = processExportFilename(title, processIndex, format);

    await exportDiagramImage(createDiagram(title), format, { defaultFormat: format, transparentBackground: false, imageScale: 1 }, filename.slice(0, -(format.length + 1)));

    expect(link.download).toBe(expected);
  });

  it("uses the metadata-derived filename when no direct filename base is supplied", async () => {
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:export"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("window", { document: { createElement: vi.fn(() => link) }, setTimeout: (handler: () => void) => handler() });

    await exportDiagramImage(createDiagram("Claims Project"), "svg", { defaultFormat: "svg", transparentBackground: false, imageScale: 1 });

    expect(link.download).toBe("Claims-Project.svg");
  });

  it("preserves a metadata title extension as part of the default safe filename", async () => {
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:export"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("window", { document: { createElement: vi.fn(() => link) }, setTimeout: (handler: () => void) => handler() });

    await exportDiagramImage(createDiagram("Claims.svg"), "svg", { defaultFormat: "svg", transparentBackground: false, imageScale: 1 });

    expect(link.download).toBe("Claims-svg.svg");
  });
});
