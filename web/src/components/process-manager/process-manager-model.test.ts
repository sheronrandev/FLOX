import { describe, expect, it } from "vitest";
import type { DiagramProcess } from "../../domain/diagram";
import { buildProcessSummaries, filterAndSortProcesses } from "./process-manager-model";

const processes: DiagramProcess[] = [
  {
    id: "p-z",
    name: "Zulu approval",
    position: { x: 0, y: 0 },
    lanes: [
      { id: "l1", name: "One", width: 320, colorIndex: 0 },
      { id: "l2", name: "Two", width: 320, colorIndex: 1 },
    ],
    nodes: [],
    edges: [],
    swimlaneLayout: { heightMode: "automatic", height: 760 },
  },
  {
    id: "p-a",
    name: "Annual procurement review",
    position: { x: 0, y: 900 },
    lanes: [],
    nodes: [],
    edges: [],
    swimlaneLayout: { heightMode: "automatic", height: 760 },
  },
];

describe("process manager model", () => {
  it("derives stable display sequence and lane counts without mutating processes", () => {
    const before = structuredClone(processes);

    expect(buildProcessSummaries(processes)).toEqual([
      { id: "p-z", name: "Zulu approval", sequence: "001", laneCount: 2, documentIndex: 0 },
      { id: "p-a", name: "Annual procurement review", sequence: "002", laneCount: 0, documentIndex: 1 },
    ]);
    expect(processes).toEqual(before);
  });

  it("matches case-insensitive names and displayed sequence numbers", () => {
    const summaries = buildProcessSummaries(processes);

    expect(filterAndSortProcesses(summaries, "PROCUREMENT", "document").map((item) => item.id)).toEqual(["p-a"]);
    expect(filterAndSortProcesses(summaries, "001", "document").map((item) => item.id)).toEqual(["p-z"]);
  });

  it("sorts names without changing document order", () => {
    const summaries = buildProcessSummaries(processes);

    expect(filterAndSortProcesses(summaries, "", "name-asc").map((item) => item.id)).toEqual(["p-a", "p-z"]);
    expect(filterAndSortProcesses(summaries, "", "name-desc").map((item) => item.id)).toEqual(["p-z", "p-a"]);
    expect(summaries.map((item) => item.id)).toEqual(["p-z", "p-a"]);
  });
});
