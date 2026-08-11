// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDiagram, parseDiagram, type DiagramDocument } from "../domain/diagram";
import type { ExportPreferences } from "../domain/preferences";
import type { ProjectRecord, ProjectRepository } from "../persistence/project-repository";
import { ExportDialog } from "./ExportDialog";

const browserExports = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  exportDiagramImage: vi.fn(),
  encodeExportArchive: vi.fn(),
}));

vi.mock("../diagram/export-diagram", async (importOriginal) => {
  const original = await importOriginal<typeof import("../diagram/export-diagram")>();
  return { ...original, downloadBlob: browserExports.downloadBlob, exportDiagramImage: browserExports.exportDiagramImage };
});

vi.mock("../diagram/workspace-export", async (importOriginal) => {
  const original = await importOriginal<typeof import("../diagram/workspace-export")>();
  return { ...original, encodeExportArchive: browserExports.encodeExportArchive };
});

const preferences: ExportPreferences = { defaultFormat: "png", transparentBackground: false, imageScale: 2 };

function twoProcessDocument(title = "Canvas"): DiagramDocument {
  const document = createDiagram(title);
  document.processes[0].id = "process-first";
  document.processes[0].name = "Intake";
  document.processes[0].position = { x: 40, y: 60 };
  document.processes.push({
    id: "process-second",
    name: "Approval",
    position: { x: 900, y: 400 },
    lanes: [],
    nodes: [],
    edges: [],
    swimlaneLayout: { heightMode: "automatic", height: 760 },
  });
  return document;
}

function projectRecord(id: string, title: string, updatedAt: string): ProjectRecord {
  const document = twoProcessDocument(title);
  document.metadata.updatedAt = updatedAt;
  return { id, title, document, createdAt: document.metadata.createdAt, updatedAt };
}

function repositoryFor(records: ProjectRecord[]): ProjectRepository {
  return {
    list: vi.fn(async () => records.map((record) => ({
      id: record.id,
      title: record.title,
      nodeCount: 0,
      edgeCount: 0,
      updatedAt: record.updatedAt,
    }))),
    get: vi.fn(async (id) => records.find((record) => record.id === id) ?? null),
    put: vi.fn(async (record) => record),
    delete: vi.fn(async () => undefined),
  };
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof ExportDialog>> = {}) {
  const document = overrides.document ?? twoProcessDocument();
  return render(<ExportDialog
    document={document}
    activeProcessId="process-second"
    currentProjectId="current"
    repository={repositoryFor([projectRecord("current", document.metadata.title, document.metadata.updatedAt)])}
    workspaceCount={1}
    defaults={preferences}
    initialFormat="png"
    onClose={() => undefined}
    {...overrides}
  />);
}

async function readJsonBlob(blob: Blob): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(JSON.parse(String(reader.result)));
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  browserExports.downloadBlob.mockReset();
  browserExports.exportDiagramImage.mockReset();
  browserExports.exportDiagramImage.mockResolvedValue(undefined);
  browserExports.encodeExportArchive.mockReset();
  browserExports.encodeExportArchive.mockResolvedValue(new Uint8Array([1, 2, 3]));
});

afterEach(cleanup);

describe("format-specific export scopes", () => {
  it("shows image scopes for one multi-process project and JSON organization only for all-in-one", () => {
    renderDialog();

    expect(screen.getByLabelText("Export selected")).toBeChecked();
    expect(screen.getByLabelText("Export separately")).toBeVisible();
    expect(screen.getByLabelText("All-in-one")).toBeVisible();
    expect(screen.getByText("1 project in workspace")).toBeVisible();

    fireEvent.click(screen.getByLabelText("JSON"));
    expect(screen.getByLabelText("Export project")).toBeVisible();
    expect(screen.queryByLabelText("Export separately")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("All-in-one"));
    expect(screen.getByRole("group", { name: "Organization" })).toBeVisible();
    expect(screen.getByLabelText("Diagram-wise")).toBeChecked();
  });

  it("maps format-specific scopes while retaining scopes valid for both formats", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText("Export separately"));
    fireEvent.click(screen.getByLabelText("JSON"));
    expect(screen.getByLabelText("Export project")).toBeChecked();

    fireEvent.click(screen.getByLabelText("SVG"));
    expect(screen.getByLabelText("Export separately")).toBeChecked();

    fireEvent.click(screen.getByLabelText("All-in-one"));
    fireEvent.click(screen.getByLabelText("JSON"));
    expect(screen.getByLabelText("All-in-one")).toBeChecked();
  });

  it("disables selected export and associates its explanation when no process is active", () => {
    renderDialog({ activeProcessId: null });

    const selected = screen.getByLabelText("Export selected");
    const explanation = screen.getByText("Select a process before exporting a selected diagram.");
    expect(selected).toBeDisabled();
    expect(selected).toHaveAttribute("aria-describedby", explanation.id);
    expect(screen.getByRole("button", { name: "Export PNG" })).toBeDisabled();
  });
});

describe("direct exports", () => {
  it("downloads the active second process as a numbered JSON document without mutating the source", async () => {
    const document = twoProcessDocument();
    const source = structuredClone(document);
    renderDialog({ document, initialFormat: "json" });

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    await waitFor(() => expect(browserExports.downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, filename] = browserExports.downloadBlob.mock.calls[0] as [Blob, string];
    const exported = parseDiagram(await readJsonBlob(blob));
    expect(filename).toBe("Canvas-002.json");
    expect(exported.processes).toHaveLength(1);
    expect(exported.processes[0]).toMatchObject({ id: "process-second", position: { x: 0, y: 0 } });
    expect(document).toEqual(source);
  });

  it("downloads the complete validated current project as JSON", async () => {
    renderDialog({ initialFormat: "json" });
    fireEvent.click(screen.getByLabelText("Export project"));
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    await waitFor(() => expect(browserExports.downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, filename] = browserExports.downloadBlob.mock.calls[0] as [Blob, string];
    expect(filename).toBe("Canvas.json");
    expect(parseDiagram(await readJsonBlob(blob)).processes).toHaveLength(2);
  });

  it("renders the active image process with its numbered filename base", async () => {
    renderDialog({ initialFormat: "svg" });
    fireEvent.click(screen.getByRole("button", { name: "Export SVG" }));

    await waitFor(() => expect(browserExports.exportDiagramImage).toHaveBeenCalledTimes(1));
    const [document, format, , filenameBase] = browserExports.exportDiagramImage.mock.calls[0];
    expect(format).toBe("svg");
    expect(filenameBase).toBe("Canvas-002");
    expect(parseDiagram(document).processes).toHaveLength(1);
    expect(document.processes[0].position).toEqual({ x: 0, y: 0 });
  });
});

describe("archive exports", () => {
  it("passes only current-project root entries to the separate image encoder", async () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText("Export separately"));
    fireEvent.click(screen.getByRole("button", { name: "Export ZIP" }));

    await waitFor(() => expect(browserExports.encodeExportArchive).toHaveBeenCalledTimes(1));
    const entries = browserExports.encodeExportArchive.mock.calls[0][0];
    expect(entries.map((entry: { path: string }) => entry.path)).toEqual(["Canvas-001.png", "Canvas-002.png"]);
    expect(entries.every((entry: { document: DiagramDocument }) => entry.document.processes.length === 1)).toBe(true);
    expect(browserExports.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "Canvas-diagrams-png.zip");
  });

  it("uses current-first project folders and the selected JSON organization for all-in-one", async () => {
    const current = projectRecord("current", "Canvas", "2026-08-10T00:00:00.000Z");
    const old = projectRecord("old", "Archive", "2026-08-08T00:00:00.000Z");
    const recent = projectRecord("recent", "Review", "2026-08-11T00:00:00.000Z");
    const repository = repositoryFor([old, current, recent]);
    renderDialog({ document: current.document, repository, workspaceCount: 3, initialFormat: "json" });
    fireEvent.click(screen.getByLabelText("All-in-one"));
    fireEvent.click(screen.getByLabelText("Project-wise"));
    fireEvent.click(screen.getByRole("button", { name: "Export ZIP" }));

    await waitFor(() => expect(browserExports.encodeExportArchive).toHaveBeenCalledTimes(1));
    const [entries, format] = browserExports.encodeExportArchive.mock.calls[0];
    expect(format).toBe("json");
    expect(entries.map((entry: { path: string }) => entry.path)).toEqual([
      "Canvas/Canvas.json",
      "Review/Review.json",
      "Archive/Archive.json",
    ]);
    expect(entries.every((entry: { document: DiagramDocument }) => entry.document.processes.length === 2)).toBe(true);
    expect(browserExports.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "flox-workspace-json.zip");
  });

  it("uses manifest entry count for encoding progress", async () => {
    let finishArchive!: (value: Uint8Array) => void;
    browserExports.encodeExportArchive.mockImplementationOnce(async (entries, _format, _preferences, onProgress) => {
      onProgress(1, entries.length);
      return await new Promise<Uint8Array>((resolve) => { finishArchive = resolve; });
    });
    renderDialog();
    fireEvent.click(screen.getByLabelText("Export separately"));
    fireEvent.click(screen.getByRole("button", { name: "Export ZIP" }));

    expect(await screen.findByText("Preparing 1 of 2")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("max", "2");
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");
    finishArchive(new Uint8Array([1]));
    await screen.findByText("Export ready");
  });

  it("identifies an unreadable project and does not begin archive encoding", async () => {
    const current = projectRecord("current", "Canvas", "2026-08-10T00:00:00.000Z");
    const repository = repositoryFor([current]);
    vi.mocked(repository.list).mockResolvedValueOnce([
      { id: "current", title: "Canvas", nodeCount: 0, edgeCount: 0, updatedAt: current.updatedAt },
      { id: "broken", title: "Broken project", nodeCount: 0, edgeCount: 0, updatedAt: "2026-08-11T00:00:00.000Z" },
    ]);
    renderDialog({ document: current.document, repository, workspaceCount: 2 });
    fireEvent.click(screen.getByLabelText("All-in-one"));
    fireEvent.click(screen.getByRole("button", { name: "Export ZIP" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Broken project");
    expect(browserExports.encodeExportArchive).not.toHaveBeenCalled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("PNG export preferences", () => {
  it("enables 1x/2x/3x and remembers scale only after a successful selected PNG export", async () => {
    const onDefaultsChange = vi.fn();
    renderDialog({ onDefaultsChange });
    expect(screen.getByLabelText("PNG quality")).toHaveTextContent("1×");
    expect(screen.getByLabelText("PNG quality")).toHaveTextContent("2×");
    expect(screen.getByLabelText("PNG quality")).toHaveTextContent("3×");
    expect(screen.getByRole("checkbox", { name: /Remember as default/i })).not.toBeChecked();
    fireEvent.change(screen.getByLabelText("PNG quality"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Remember as default/i }));
    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }));

    await waitFor(() => expect(onDefaultsChange).toHaveBeenCalledWith(expect.objectContaining({ imageScale: 3 })));
  });

  it("persists scale only after the complete requested PNG archive succeeds", async () => {
    const onDefaultsChange = vi.fn();
    let fail = true;
    browserExports.encodeExportArchive.mockImplementation(async () => {
      if (fail) throw new Error("render failed");
      return new Uint8Array([1]);
    });
    renderDialog({ onDefaultsChange });
    fireEvent.click(screen.getByLabelText("Export separately"));
    fireEvent.change(screen.getByLabelText("PNG quality"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Remember as default/i }));
    fireEvent.click(screen.getByRole("button", { name: "Export ZIP" }));

    await screen.findByText("render failed");
    expect(onDefaultsChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Export separately")).toBeChecked();
    expect(screen.getByLabelText("PNG quality")).toHaveValue("1");
    expect(screen.getByRole("checkbox", { name: /Remember as default/i })).toBeChecked();

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Export ZIP" }));
    await waitFor(() => expect(onDefaultsChange).toHaveBeenCalledWith(expect.objectContaining({ imageScale: 1 })));
  });
});
