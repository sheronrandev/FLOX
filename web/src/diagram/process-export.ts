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

function processDocumentTitle(projectTitle: string, processName: string): string {
  const separator = " - ";
  const composite = `${projectTitle}${separator}${processName}`;
  if (composite.length <= 120) return composite;
  if (processName.length >= 120) return processName.slice(0, 120);
  const projectTitleLength = 120 - separator.length - processName.length;
  return projectTitleLength > 0 ? `${projectTitle.slice(0, projectTitleLength)}${separator}${processName}` : processName;
}

export function sliceProcessDocument(document: DiagramDocument, processId: string): DiagramDocument {
  const source = parseDiagram(document);
  const process = source.processes.find((entry) => entry.id === processId);
  if (!process) throw new Error("The selected diagram is no longer available.");
  const title = processDocumentTitle(source.metadata.title, process.name);
  return parseDiagram({
    ...source,
    metadata: { ...source.metadata, title },
    processes: [{ ...process, position: { x: 0, y: 0 } }],
  });
}

function projectName(record: ProjectRecord, document: DiagramDocument): string {
  return record.title || document.metadata.title;
}

function validatedDocument(record: ProjectRecord): DiagramDocument {
  return parseDiagram(record.document);
}

function uniqueFolder(base: string, usedFolders: Set<string>, nextSuffix: Map<string, number>): string {
  if (!usedFolders.has(base)) {
    usedFolders.add(base);
    nextSuffix.set(base, 2);
    return base;
  }
  let suffix = nextSuffix.get(base) ?? 2;
  let folder = `${base}-${suffix}`;
  while (usedFolders.has(folder)) {
    suffix += 1;
    folder = `${base}-${suffix}`;
  }
  usedFolders.add(folder);
  nextSuffix.set(base, suffix + 1);
  return folder;
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
  const usedFolders = new Set<string>();
  const nextSuffix = new Map<string, number>();
  const entries: ExportManifestEntry[] = [];
  for (const record of records) {
    const document = validatedDocument(record);
    const name = projectName(record, document);
    const baseFolder = safeArchiveSegment(name);
    const folder = uniqueFolder(baseFolder, usedFolders, nextSuffix);
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
