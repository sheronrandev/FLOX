import type { DiagramProcess } from "../../domain/diagram";

export type ProcessSortOrder = "document" | "name-asc" | "name-desc";

export interface ProcessSummary {
  id: string;
  name: string;
  sequence: string;
  laneCount: number;
  documentIndex: number;
}

export function buildProcessSummaries(processes: DiagramProcess[]): ProcessSummary[] {
  return processes.map((process, documentIndex) => ({
    id: process.id,
    name: process.name,
    sequence: String(documentIndex + 1).padStart(3, "0"),
    laneCount: process.lanes.length,
    documentIndex,
  }));
}

export function filterAndSortProcesses(
  summaries: ProcessSummary[],
  query: string,
  order: ProcessSortOrder,
): ProcessSummary[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? summaries.filter(
        (process) =>
          process.name.toLocaleLowerCase().includes(normalizedQuery) ||
          process.sequence.includes(normalizedQuery),
      )
    : [...summaries];

  if (order === "document") {
    return filtered.sort((left, right) => left.documentIndex - right.documentIndex);
  }

  const direction = order === "name-asc" ? 1 : -1;
  return filtered.sort(
    (left, right) =>
      direction * left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true }),
  );
}
