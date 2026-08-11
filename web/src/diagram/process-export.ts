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
const maxNameSegmentLength = 80;
const maxArchiveSegmentLength = 89;
const maxArchivePathLength = 170;
const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/g;
const unsafePunctuation = /[<>:."|?*`~!#$%&'()+,;=@\[\]^{}]/g;
const windowsDeviceBasename = /^(?:con|prn|aux|nul|com(?:[1-9]|[¹²³])|lpt(?:[1-9]|[¹²³]))(?:\.|$)/i;

export function safeArchiveSegment(value: string): string {
  if (windowsDeviceBasename.test(value.trim())) return fallbackSegment;
  const safe = value
    .replace(controlCharacters, "")
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, "-")
    .replace(unsafePunctuation, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  const bounded = safe.slice(0, maxNameSegmentLength).replace(/[.-]+$/g, "");
  return bounded === "." || bounded === ".." || bounded.length === 0 || windowsDeviceBasename.test(bounded)
    ? fallbackSegment
    : bounded;
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
  const baseKey = base.toLocaleLowerCase("en-US");
  if (!usedFolders.has(baseKey)) {
    usedFolders.add(baseKey);
    nextSuffix.set(baseKey, 2);
    return base;
  }
  let suffix = nextSuffix.get(baseKey) ?? 2;
  let suffixText = `-${suffix}`;
  let folder = `${base.slice(0, maxNameSegmentLength - suffixText.length)}${suffixText}`;
  while (usedFolders.has(folder.toLocaleLowerCase("en-US"))) {
    suffix += 1;
    suffixText = `-${suffix}`;
    folder = `${base.slice(0, maxNameSegmentLength - suffixText.length)}${suffixText}`;
  }
  usedFolders.add(folder.toLocaleLowerCase("en-US"));
  nextSuffix.set(baseKey, suffix + 1);
  return folder;
}

function validArchivePathSegment(segment: string): boolean {
  return segment.length > 0
    && segment.length <= maxArchiveSegmentLength
    && !/[\u0000-\u001f\u007f-\u009f\\/:*?"<>|]/.test(segment)
    && !/^[.]|[.]$/.test(segment)
    && !windowsDeviceBasename.test(segment);
}

function validateManifest(entries: ExportManifestEntry[]): ExportManifestEntry[] {
  const paths = new Set<string>();
  for (const entry of entries) {
    if (!entry.projectId || !entry.projectName || entry.processOrder !== null && (!Number.isInteger(entry.processOrder) || entry.processOrder < 1)) {
      throw new Error("Invalid export manifest entry");
    }
    const segments = entry.path.split("/");
    if (entry.path.length > maxArchivePathLength || segments.length === 0 || segments.some((segment) => !validArchivePathSegment(segment)) || paths.has(entry.path)) {
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
  const exportBase = directory === undefined ? safeArchiveSegment(name) : safeArchiveSegment(directory);
  const prefix = directory === undefined ? "" : `${exportBase}/`;
  const entries = document.processes.map((process, index) => ({
    projectId: record.id,
    projectName: name,
    processOrder: index + 1,
    path: `${prefix}${processExportFilename(exportBase, index, format)}`,
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
