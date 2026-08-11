import { strToU8, zipSync } from "fflate";
import { parseDiagram } from "../domain/diagram";
import type { ExportPreferences } from "../domain/preferences";
import type { ProjectRecord } from "../persistence/project-repository";
import { diagramToSvg, svgToPngBlob } from "./export-diagram";
import type { ExportFormat, ExportManifestEntry } from "./process-export";

export function orderWorkspaceRecords(records: ProjectRecord[], currentProjectId: string): ProjectRecord[] {
  return [...records].sort((a, b) => {
    if (a.id === currentProjectId) return -1;
    if (b.id === currentProjectId) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function exportEntryLabel(entry: ExportManifestEntry): string {
  const process = entry.processOrder === null ? "" : `, process ${String(entry.processOrder).padStart(3, "0")}`;
  return `project “${entry.projectName}”${process}`;
}

function entryFailure(entry: ExportManifestEntry, reason: unknown): Error {
  const cause = reason instanceof Error ? reason : new Error(String(reason));
  return new Error(`Could not export ${exportEntryLabel(entry)}: ${cause.message}`, { cause });
}

function validateEntries(entries: ExportManifestEntry[], format: ExportFormat): ExportManifestEntry[] {
  const validatedEntries: ExportManifestEntry[] = [];
  const paths = new Set<string>();
  for (const entry of entries) {
    try {
      const validated = { ...entry, document: parseDiagram(entry.document) };
      if (paths.has(validated.path)) throw new Error("Duplicate export archive path");
      if (format !== "json" && validated.document.processes.length !== 1) throw new Error("Image export entries must contain exactly one process");
      paths.add(validated.path);
      validatedEntries.push(validated);
    } catch (error) {
      throw entryFailure(entry, error);
    }
  }
  return validatedEntries;
}

export async function encodeExportArchive(
  entries: ExportManifestEntry[],
  format: ExportFormat,
  preferences: ExportPreferences,
  onProgress: (current: number, total: number) => void = () => undefined,
): Promise<Uint8Array> {
  const validatedEntries = validateEntries(entries, format);
  const files: Record<string, Uint8Array> = {};
  const total = validatedEntries.length;
  for (let index = 0; index < total; index += 1) {
    const entry = validatedEntries[index];
    onProgress(index + 1, total);
    try {
      if (format === "json") {
        files[entry.path] = strToU8(JSON.stringify(entry.document, null, 2));
        continue;
      }
      const svg = diagramToSvg(entry.document, preferences.transparentBackground);
      files[entry.path] = format === "svg"
        ? strToU8(svg)
        : new Uint8Array(await (await svgToPngBlob(svg, preferences.imageScale)).arrayBuffer());
    } catch (error) {
      throw entryFailure(entry, error);
    }
  }
  return zipSync(files);
}
