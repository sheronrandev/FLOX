import { parseDiagram, type DiagramDocument } from "../domain/diagram";
import type { ProjectRecord } from "../persistence/project-repository";

export type ExportFormat = "json" | "png" | "svg";
export type JsonOrganization = "diagram-wise" | "project-wise";

export interface ExportManifestEntry {
  projectId: string;
  projectName: string;
  processOrder: number | null;
  path: string;
  document: DiagramDocument;
}

const fallbackSegment = "activity-diagram";
const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/g;
const unsafePunctuation = /[<>:"|?*`~!#$%&'()+,;=@\[\]^{}]/g;

export function safeArchiveSegment(value: string): string {
  const safe = value
    .replace(controlCharacters, "")
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, "-")
    .replace(unsafePunctuation, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return safe === "." || safe === ".." || safe.length === 0 ? fallbackSegment : safe;
}

export function processExportFilename(projectTitle: string, processIndex: number, format: ExportFormat): string {
  if (!Number.isInteger(processIndex) || processIndex < 0 || processIndex > 99) throw new Error("Process index must be between 0 and 99.");
  return `${safeArchiveSegment(projectTitle)}-${String(processIndex + 1).padStart(3, "0")}.${format}`;
}

export function sliceProcessDocument(document: DiagramDocument, processId: string): DiagramDocument {
  const source = parseDiagram(document);
  const process = source.processes.find((entry) => entry.id === processId);
  if (!process) throw new Error("The selected diagram is no longer available.");
  return parseDiagram({
    ...source,
    metadata: { ...source.metadata, title: `${source.metadata.title} - ${process.name}` },
    processes: [{ ...process, position: { x: 0, y: 0 } }],
  });
}

function projectName(record: ProjectRecord, document: DiagramDocument): string {
  return record.title || document.metadata.title;
}

function validatedDocument(record: ProjectRecord): DiagramDocument {
  return parseDiagram(record.document);
}

function validateManifest(entries: ExportManifestEntry[]): ExportManifestEntry[] {
  const paths = new Set<string>();
  for (const entry of entries) {
    if (!entry.projectId || !entry.projectName || entry.processOrder !== null && (!Number.isInteger(entry.processOrder) || entry.processOrder < 1)) {
      throw new Error("Invalid export manifest entry");
    }
    const segments = entry.path.split("/");
    if (segments.length === 0 || segments.some((segment) => !segment || safeArchiveSegment(segment) !== segment) || paths.has(entry.path)) {
      throw new Error("Invalid export manifest path");
    }
    parseDiagram(entry.document);
    paths.add(entry.path);
  }
  return entries;
}

export function buildProjectProcessManifest(record: ProjectRecord, format: ExportFormat, directory?: string): ExportManifestEntry[] {
  const document = validatedDocument(record);
  const name = projectName(record, document);
  const prefix = directory === undefined ? "" : `${safeArchiveSegment(directory)}/`;
  const entries = document.processes.map((process, index) => ({
    projectId: record.id,
    projectName: name,
    processOrder: index + 1,
    path: `${prefix}${processExportFilename(name, index, format)}`,
    document: sliceProcessDocument(document, process.id),
  }));
  return validateManifest(entries);
}

export function buildWorkspaceManifest(records: ProjectRecord[], format: ExportFormat, organization: JsonOrganization): ExportManifestEntry[] {
  const folderCounts = new Map<string, number>();
  const entries: ExportManifestEntry[] = [];
  for (const record of records) {
    const document = validatedDocument(record);
    const name = projectName(record, document);
    const baseFolder = safeArchiveSegment(name);
    const count = (folderCounts.get(baseFolder) ?? 0) + 1;
    folderCounts.set(baseFolder, count);
    const folder = count === 1 ? baseFolder : `${baseFolder}-${count}`;
    if (format === "json" && organization === "project-wise") {
      entries.push({
        projectId: record.id,
        projectName: name,
        processOrder: null,
        path: `${folder}/${folder}.json`,
        document,
      });
    } else {
      entries.push(...buildProjectProcessManifest(record, format, folder));
    }
  }
  return validateManifest(entries);
}
