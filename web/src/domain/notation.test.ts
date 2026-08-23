import { describe, expect, it } from "vitest";
import { defaultNodeStyles, getNodeDimensions, getNodeTextLayout, nodeDimensions, resolveNodeStyle, wrapText } from "./notation";

describe("UML node text layout", () => {
  it("wraps long text and grows within the width cap", () => {
    const node = { id: "activity", type: "activity" as const, position: { x: 0, y: 0 }, laneId: null, label: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do" };
    const dimensions = getNodeDimensions(node);
    expect(getNodeTextLayout(node).lines.length).toBeGreaterThan(1);
    expect(dimensions.width).toBe(240);
    expect(dimensions.height).toBeGreaterThan(nodeDimensions.activity.height);
  });

  it("preserves compact UML geometry while wrapping external labels", () => {
    const node = { id: "initial", type: "initial" as const, position: { x: 0, y: 0 }, laneId: null, label: "A long initial node label" };
    expect(getNodeDimensions(node)).toEqual(nodeDimensions.initial);
    expect(wrapText(node.label, 18).length).toBeGreaterThan(1);
  });

  it("includes object state and constraint content in layout", () => {
    const object = { id: "object", type: "object-in-state" as const, position: { x: 0, y: 0 }, laneId: null, label: "A very long object name that needs wrapping", state: "Approved" };
    const constraint = { id: "constraint", type: "constraint" as const, position: { x: 0, y: 0 }, laneId: null, label: "Limit", body: "A very long constraint body that needs wrapping" };
    expect(getNodeTextLayout(object).lines.length).toBeGreaterThan(2);
    expect(getNodeDimensions(constraint).height).toBeGreaterThan(nodeDimensions.constraint.height);
  });

  it("uses project typography and padding without resizing fixed UML symbols", () => {
    const activity = { id: "activity", type: "activity" as const, position: { x: 0, y: 0 }, laneId: null, label: "Review" };
    const decision = { id: "decision", type: "decision" as const, position: { x: 0, y: 0 }, laneId: null, label: "" };
    const compact = getNodeDimensions(activity, { nodeFontSize: 12, nodeInnerPadding: 4 });
    const spacious = getNodeDimensions(activity, { nodeFontSize: 20, nodeInnerPadding: 20 });

    expect(spacious.width).toBeGreaterThan(compact.width);
    expect(spacious.height).toBeGreaterThanOrEqual(compact.height);
    expect(getNodeDimensions(decision, { nodeFontSize: 20, nodeInnerPadding: 20 })).toEqual(nodeDimensions.decision);
  });
});

describe("UML node default colors", () => {
  it("uses black and white defaults for every notation", () => {
    const whiteFillTypes = ["activity", "state", "object-in-state", "decision", "merge", "final", "constraint", "note"] as const;
    const blackFillTypes = ["fork", "join", "initial"] as const;

    for (const type of whiteFillTypes) {
      expect(defaultNodeStyles[type]).toEqual({ fill: "#ffffff", stroke: "#000000", textColor: "#000000" });
    }
    for (const type of blackFillTypes) {
      expect(defaultNodeStyles[type]).toEqual({ fill: "#000000", stroke: "#000000", textColor: "#000000" });
    }
  });

  it("preserves colors explicitly selected by the user", () => {
    expect(resolveNodeStyle({
      type: "activity",
      style: { fill: "#ddeeff", stroke: "#334455", textColor: "#112233" },
    })).toEqual({ fill: "#ddeeff", stroke: "#334455", textColor: "#112233" });
  });
});
