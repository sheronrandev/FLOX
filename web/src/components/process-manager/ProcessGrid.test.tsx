// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProcessGrid } from "./ProcessGrid";

afterEach(cleanup);

const processes = [
  {
    id: "long",
    name: "Supplier Registration, Compliance Review and Final Authorization",
    sequence: "001",
    laneCount: 5,
    documentIndex: 0,
  },
];

describe("process grid", () => {
  it("renders the complete name and keeps selection separate from Show on canvas", () => {
    const onSelect = vi.fn();
    const onShowOnCanvas = vi.fn();

    render(
      <ProcessGrid
        processes={processes}
        selectedProcessId={null}
        activeProcessId={null}
        readOnly={false}
        canMoveSelection={() => false}
        onSelect={onSelect}
        onShowOnCanvas={onShowOnCanvas}
        onEdit={() => undefined}
        onMoveSelection={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(screen.getByText(processes[0].name)).toBeVisible();
    expect(screen.getByText("001")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: `Select ${processes[0].name}` }));
    expect(onSelect).toHaveBeenCalledWith("long");
    expect(onShowOnCanvas).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: `Show ${processes[0].name} on canvas` }));
    expect(onShowOnCanvas).toHaveBeenCalledWith("long");
  });

  it("hides mutation menus in read-only mode", () => {
    render(
      <ProcessGrid
        processes={processes}
        selectedProcessId="long"
        activeProcessId="long"
        readOnly
        canMoveSelection={() => false}
        onSelect={() => undefined}
        onShowOnCanvas={() => undefined}
        onEdit={() => undefined}
        onMoveSelection={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(screen.queryByRole("button", { name: /More actions/ })).not.toBeInTheDocument();
    expect(screen.getByText("Active on canvas")).toBeVisible();
  });
});
