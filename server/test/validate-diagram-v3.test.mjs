import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateDiagram } from "../src/domain/validate-diagram.mjs";

const document = (version = 3) => ({
  format: "activity-diagram", version,
  metadata: { title: "Process", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  nodes: [], edges: [], lanes: [],
  appearance: { canvasColor: "#fafafa", gridColor: "#d7dde1", controlFlowColor: "#58666d", objectFlowColor: "#58666d" },
  ...(version === 3 ? { swimlaneLayout: { heightMode: "automatic", height: 760 } } : {}),
});

describe("v3 diagram validation", () => {
  it("accepts v3 and normalizes v1/v2 into a v4 process", () => {
    assert.deepEqual(validateDiagram(document()).processes[0].swimlaneLayout, { heightMode: "automatic", height: 760 });
    assert.deepEqual(validateDiagram(document(2)).processes[0].swimlaneLayout, { heightMode: "fixed", height: 760 });
    assert.equal(validateDiagram(document(1)).version, 4);
  });

  it("rejects unknown layout fields, invalid modes, and out-of-range heights", () => {
    for (const swimlaneLayout of [
      { heightMode: "automatic", height: 760, extra: true },
      { heightMode: "dynamic", height: 760 },
      { heightMode: "fixed", height: 319 },
      { heightMode: "fixed", height: 5001 },
    ]) assert.throws(() => validateDiagram({ ...document(), swimlaneLayout }), /swimlane layout/i);
  });
});
