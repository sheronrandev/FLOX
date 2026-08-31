import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiagram } from "../domain/diagram";
import { getProcessTitleLayout, getSwimlanePoolGeometry } from "../domain/swimlane-layout";
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

  it("reports incomplete imported geometry with an actionable export error", async () => {
    const document = createDiagram("Incomplete import");
    document.processes[0].nodes.push({ id: "broken", type: "activity", position: undefined as never, label: "Broken", laneId: null });

    await expect(exportDiagramImage(document, "png", { defaultFormat: "png", transparentBackground: false, imageScale: 1 }))
      .rejects.toThrow("incomplete node or process position");
  });

  it("exports the dedicated process font size separately from actor, guard, and node text", () => {
    const document = createDiagram("Typography export");
    document.appearance.nodeFontSize = 16;
    document.appearance.processNameFontSize = 24;
    const process = document.processes[0];
    process.name = "Custom process";
    process.lanes = [{ id: "lane", name: "Reviewer", width: 280, colorIndex: 0 }];
    process.nodes = [
      { id: "source", type: "activity", position: { x: 80, y: 100 }, label: "Review", laneId: "lane" },
      { id: "target", type: "activity", position: { x: 80, y: 260 }, label: "Approve", laneId: "lane" },
    ];
    process.edges = [{ id: "flow", type: "control-flow", sourceNodeId: "source", sourceAnchorId: "bottom", targetNodeId: "target", targetAnchorId: "top", guardLabel: "accepted", routing: "automatic" }];

    const svg = diagramToSvg(document, false);

    expect(svg).toMatch(/font-size="24"[^>]*>Custom process/);
    for (const value of ["Reviewer", "Review", "accepted"]) {
      expect(svg).toMatch(new RegExp(`font-size="16"[^>]*>[^<]*(?:<tspan[^>]*>)?${value}`));
    }
  });

  it("automatically exports misplaced lane nodes below the actor name", () => {
    const document = createDiagram("Export");
    const process = document.processes[0];
    process.lanes = [{ id: "lane", name: "Accounts Officer", width: 280, colorIndex: 0 }];
    process.nodes = [{ id: "activity", type: "activity", position: { x: 80, y: 0 }, label: "Review request", laneId: "lane" }];

    const svg = diagramToSvg(document, false);

    expect(svg).toContain('<rect x="80" y="86"');
  });

  it("separates overlapping nodes and halos the complete exported flow", () => {
    const document = createDiagram("Export");
    const process = document.processes[0];
    process.nodes = [
      { id: "start", type: "initial", position: { x: 100, y: 0 }, label: "", laneId: null },
      { id: "activity", type: "activity", position: { x: 80, y: 0 }, label: "Receive trigger", laneId: null },
    ];
    process.edges = [{ id: "flow", type: "control-flow", sourceNodeId: "start", sourceAnchorId: "bottom", targetNodeId: "activity", targetAnchorId: "top", guardLabel: "", routing: "automatic" }];

    const svg = diagramToSvg(document, false);

    expect(svg).toContain('<rect x="80" y="74"');
    expect(svg).toContain('class="edge-halo"');
    expect(svg).toContain('stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"');
    expect(svg).toContain('markerUnits="userSpaceOnUse"');
  });

  it("wraps long activity text in SVG output", () => {
    const document = createDiagram("Export");
    document.processes[0].nodes.push({ id: "activity", type: "activity", position: { x: 80, y: 90 }, label: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do", laneId: null });
    const svg = diagramToSvg(document, false);
    expect(svg.match(/<tspan/g)?.length).toBeGreaterThan(1);
    expect(svg).toContain("Lorem ipsum dolor sit");
    expect(svg).toContain('width="240"');
  });

  it("keeps a long process title on one line when the pool has room", () => {
    const document = createDiagram("Export");
    const process = document.processes[0];
    process.name = "FIN1-P01-D01 — Normal Processing - Purchase Requisition";
    process.lanes = [
      { id: "lane-1", name: "Lane 1", width: 280, colorIndex: 0 },
      { id: "lane-2", name: "Lane 2", width: 280, colorIndex: 1 },
      { id: "lane-3", name: "Lane 3", width: 280, colorIndex: 2 },
    ];

    const svg = diagramToSvg(document, false);
    const escapedTitle = "FIN1-P01-D01 — Normal Processing - Purchase Requisition";
    expect(svg).toContain(`>${escapedTitle}</text>`);
    expect(svg).toMatch(/fill="#000000"[^>]*font-size="20"[^>]*font-weight="700"[^>]*>FIN1-P01-D01/);
    expect(svg).not.toContain(`<tspan x="${40 + (280 * 3) / 2}"`);
    expect(svg).toContain('class="swimlane-title-row" x="40" y="-10" width="840" height="40"');
  });

  it("wraps an oversized process title in a narrow pool", () => {
    const document = createDiagram("Export");
    const process = document.processes[0];
    process.name = "A very long business process title that cannot fit in one lane";
    process.lanes = [{ id: "lane-1", name: "Lane 1", width: 280, colorIndex: 0 }];

    const svg = diagramToSvg(document, false);
    const title = getProcessTitleLayout(process.name, 280, document.appearance);
    for (const line of title.lines) expect(svg).toContain(`>${line}</tspan>`);
    expect(svg.match(/<tspan/g)?.length).toBeGreaterThan(1);
    const geometry = getSwimlanePoolGeometry(process, document.appearance);
    expect(geometry.titleHeight).toBeGreaterThan(40);
    expect(svg).toContain(`class="swimlane-title-row" x="40" y="${geometry.y}" width="280" height="${geometry.titleHeight}"`);
    expect(geometry.y + geometry.titleHeight).toBe(30);
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

  it("exports unspecified swimlane fills as white and preserves explicit colors", () => {
    const document = createDiagram("Lane colors");
    document.processes[0].lanes = [
      { id: "lane-default", name: "Default", width: 280, colorIndex: 0 },
      { id: "lane-custom", name: "Custom", width: 280, colorIndex: 1, style: { fill: "#ddeeff" } },
    ];

    const svg = diagramToSvg(document, false);

    expect(svg).toContain('width="280" height="760" fill="#ffffff"');
    expect(svg).toContain('width="280" height="760" fill="#ddeeff"');
  });

  it("exports unspecified nodes in black and white and preserves explicit node colors", () => {
    const document = createDiagram("Node colors");
    document.processes[0].nodes = [
      { id: "default", type: "activity", position: { x: 80, y: 90 }, label: "Default", laneId: null },
      { id: "initial", type: "initial", position: { x: 320, y: 90 }, label: "", laneId: null },
      { id: "custom", type: "activity", position: { x: 420, y: 90 }, label: "Custom", laneId: null, style: { fill: "#ddeeff", stroke: "#334455", textColor: "#112233" } },
    ];

    const svg = diagramToSvg(document, false);

    expect(svg).toMatch(/<rect[^>]*fill="#ffffff" stroke="#000000"/);
    expect(svg).toMatch(/<circle[^>]*fill="#000000" stroke="#000000"/);
    expect(svg).toMatch(/<rect[^>]*fill="#ddeeff" stroke="#334455"/);
    expect(svg).toContain('fill="#112233"');
  });

  it("exports default flows, arrowheads, and guard labels in black", () => {
    const document = createDiagram("Flow colors");
    const process = document.processes[0];
    process.nodes = [
      { id: "source", type: "activity", position: { x: 80, y: 90 }, label: "Source", laneId: null },
      { id: "target", type: "activity", position: { x: 320, y: 90 }, label: "Target", laneId: null },
    ];
    process.edges = [{ id: "flow", type: "object-flow", sourceNodeId: "source", sourceAnchorId: "right", targetNodeId: "target", targetAnchorId: "left", guardLabel: "approved", routing: "automatic" }];

    const svg = diagramToSvg(document, false);

    expect(svg).toMatch(/<marker[^>]*><path[^>]*fill="#000000"/);
    expect(svg).toMatch(/<polyline[^>]*stroke="#000000"[^>]*stroke-dasharray="7 5"/);
    expect(svg).toMatch(/<text[^>]*fill="#000000"[^>]*>approved<\/text>/);
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
