import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateDiagram } from "../src/domain/validate-diagram.mjs";

const now = "2026-08-11T00:00:00.000Z";
const appearance = { canvasColor: "#fafafa", gridColor: "#d7dde1", controlFlowColor: "#58666d", objectFlowColor: "#58666d" };

const process = (id, name) => ({ id, name, position: { x: 0, y: 0 }, lanes: [], nodes: [], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 } });
const document = () => ({ format: "activity-diagram", version: 4, metadata: { title: "Canvas", createdAt: now, updatedAt: now }, processes: [process("process-1", "Claims")], appearance });
const selectedProcessExport = () => ({
  format: "activity-diagram", version: 4,
  metadata: { title: "Canvas - Claims", createdAt: now, updatedAt: now },
  processes: [process("claims-process", "Claims")], appearance,
});
const completeProjectExport = () => ({
  format: "activity-diagram", version: 4,
  metadata: { title: "Canvas", createdAt: now, updatedAt: now },
  processes: [process("claims-process", "Claims"), process("approval-process", "Approval")], appearance,
});

describe("v4 nested diagram validation", () => {
  it("accepts and stores the strict v4 aggregate", () => {
    assert.deepEqual(validateDiagram(document()), document());
  });

  it("accepts current typography settings and rejects process font sizes outside 18 through 40", () => {
    for (const processNameFontSize of [18, 40]) {
      const value = document();
      value.appearance = { ...appearance, nodeFontSize: 12, processNameFontSize, nodeInnerPadding: 12 };
      assert.equal(validateDiagram(value).appearance.processNameFontSize, processNameFontSize);
    }
    for (const processNameFontSize of [17, 41, 20.5]) {
      const value = document();
      value.appearance = { ...appearance, nodeFontSize: 12, processNameFontSize, nodeInnerPadding: 12 };
      assert.throws(() => validateDiagram(value), /appearance/i);
    }
  });

  it("preserves selected-process and complete-project v4 export documents", () => {
    const selected = selectedProcessExport();
    const complete = completeProjectExport();

    for (const value of [selected, complete]) {
      const validated = validateDiagram(value);
      assert.equal(validated.version, 4);
      assert.equal(validated.metadata.title, value.metadata.title);
      assert.equal(validated.processes.length, value.processes.length);
      assert.deepEqual(validated.processes.map((entry) => entry.id), value.processes.map((entry) => entry.id));
      assert.deepEqual(validated.processes.map((entry) => entry.name), value.processes.map((entry) => entry.name));
      assert.deepEqual(validated.processes.map((entry) => entry.position), value.processes.map((entry) => entry.position));
    }

    assert.deepEqual(selected.processes[0].position, { x: 0, y: 0 });
    assert.equal(new Set(complete.processes.map((entry) => entry.id)).size, 2);
  });

  it("normalizes v3 into one named process and expands Decisions", () => {
    const legacy = {
      format: "activity-diagram", version: 3,
      metadata: { title: "Legacy", createdAt: now, updatedAt: now },
      lanes: [{ id: "lane", name: "Owner", width: 260, colorIndex: 0 }],
      nodes: [{ id: "decision", type: "decision", position: { x: 100, y: 180 }, label: "Continue?", laneId: "lane" }],
      edges: [], swimlaneLayout: { heightMode: "fixed", height: 760 }, appearance,
    };
    const migrated = validateDiagram(legacy);
    assert.equal(migrated.version, 4);
    assert.equal(migrated.processes[0].name, "Legacy");
    assert.equal(migrated.processes[0].nodes.find((node) => node.id === "decision").label, "");
    assert.equal(migrated.processes[0].nodes.find((node) => node.id === "decision-decision-activity").label, "Continue?");
  });

  it("rejects cross-process references and globally duplicated IDs", () => {
    const value = document();
    value.processes[0].nodes.push({ id: "one", type: "activity", position: { x: 0, y: 0 }, label: "One", laneId: null });
    value.processes.push(process("process-2", "Second"));
    value.processes[1].nodes.push({ id: "two", type: "activity", position: { x: 0, y: 0 }, label: "Two", laneId: null });
    value.processes[1].edges.push({ id: "cross", type: "control-flow", sourceNodeId: "one", sourceAnchorId: "right", targetNodeId: "two", targetAnchorId: "left", guardLabel: "", routing: "automatic" });
    assert.throws(() => validateDiagram(value), /node|boundary/i);
    value.processes[1].edges = [];
    value.processes[1].nodes[0].id = "one";
    assert.throws(() => validateDiagram(value), /duplicate/i);
  });

  it("rejects unknown process fields, labelled Decisions, and process overflow", () => {
    assert.throws(() => validateDiagram({ ...document(), processes: [{ ...process("p", "P"), extra: true }] }), /process/i);
    const labelled = document();
    labelled.processes[0].nodes.push({ id: "d", type: "decision", position: { x: 0, y: 0 }, label: "Invalid", laneId: null });
    assert.throws(() => validateDiagram(labelled), /node|decision/i);
    const tooMany = document();
    tooMany.processes = Array.from({ length: 101 }, (_, index) => process(`p-${index}`, `P ${index}`));
    assert.throws(() => validateDiagram(tooMany), /limit/i);
  });

  it("rejects export-shaped serialized documents with blank process names or lane references", () => {
    const exported = selectedProcessExport();
    exported.processes[0].lanes.push({ id: "lane-a", name: "Owner", width: 260, colorIndex: 0 });
    exported.processes[0].nodes.push({ id: "node-a", type: "activity", position: { x: 0, y: 0 }, label: "Receive", laneId: "lane-a" });
    const serialized = JSON.stringify(exported);

    const blankProcess = JSON.parse(serialized);
    blankProcess.processes[0].name = "   ";
    assert.throws(() => validateDiagram(blankProcess), /process/i);

    const blankLaneReference = JSON.parse(serialized);
    blankLaneReference.processes[0].nodes[0].laneId = "";
    assert.throws(() => validateDiagram(blankLaneReference), /node|lane/i);
  });

  it("rejects an export-shaped serialized document with a whitespace-only metadata title", () => {
    const exported = JSON.parse(JSON.stringify(selectedProcessExport()));
    exported.metadata.title = "   ";

    assert.throws(() => validateDiagram(exported), /metadata/i);
  });

  it("returns a validation error for malformed legacy array members", () => {
    const legacy = {
      format: "activity-diagram", version: 3,
      metadata: { title: "Malformed", createdAt: now, updatedAt: now },
      lanes: [], nodes: [null], edges: [], swimlaneLayout: { heightMode: "automatic", height: 760 }, appearance,
    };
    assert.throws(() => validateDiagram(legacy), (error) => error?.status === 400 && error?.code === "invalid_diagram");
    legacy.nodes = [{ id: "node", type: "activity", position: { x: 0, y: 0 }, label: "Node", laneId: null, extra: true }];
    assert.throws(() => validateDiagram(legacy), (error) => error?.status === 400 && error?.code === "invalid_diagram");
  });
});
