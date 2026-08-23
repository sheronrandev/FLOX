// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createDiagram } from "../domain/diagram";
import { buildSwimlanePoolNode, SwimlanePoolNode } from "./SwimlanePoolNode";

describe("synthetic swimlane pool", () => {
  afterEach(cleanup);
  it("is one noninteractive background node below diagram content", () => {
    const document = createDiagram("Claims review");
    document.processes[0].lanes = [
      { id: "a", name: "Agent", width: 300, colorIndex: 0 },
      { id: "b", name: "Manager", width: 320, colorIndex: 1 },
    ];
    expect(buildSwimlanePoolNode(document.processes[0])).toMatchObject({
      id: `__process-pool-${document.processes[0].id}`, selectable: false, focusable: false, connectable: false,
      draggable: false, deletable: false, zIndex: -10,
    });
  });

  it("renders a title rule and dashed vertical separators without an interactive role", () => {
    render(SwimlanePoolNode({ data: {
      processId: "process", title: "Claims review", width: 620, height: 800, titleHeight: 40, laneHeight: 760,
      lanes: [{ id: "a", label: "Agent", width: 300, colorIndex: 0 }, { id: "b", label: "Manager", width: 320, colorIndex: 1 }],
    } } as never));
    expect(screen.queryByText("Claims review")).toBeNull();
    expect(document.querySelector(".swimlane-pool__title-rule")).not.toBeNull();
    expect(document.querySelector(".swimlane-pool__separator")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders unspecified lanes white and preserves an explicit lane fill", () => {
    render(SwimlanePoolNode({ data: {
      processId: "process", title: "Claims review", width: 620, height: 800, titleHeight: 40, laneHeight: 760,
      lanes: [
        { id: "a", label: "Agent", width: 300, colorIndex: 0 },
        { id: "b", label: "Manager", width: 320, colorIndex: 1, fill: "#ddeeff" },
      ],
    } } as never));

    const lanes = document.querySelectorAll<HTMLElement>(".swimlane-pool__lane");
    expect(lanes[0].style.background).toBe("rgb(255, 255, 255)");
    expect(lanes[1].style.background).toBe("rgb(221, 238, 255)");
  });
});
