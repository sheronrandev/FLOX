// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProcessActionsMenu } from "./ProcessActionsMenu";

describe("process actions menu", () => {
  afterEach(cleanup);

  it("disables an unavailable move and restores focus when Escape closes the menu", async () => {
    const onMoveSelection = vi.fn();
    const onDelete = vi.fn();
    render(
      <ProcessActionsMenu
        processName="Claims approval"
        canMoveSelection={false}
        onMoveSelection={onMoveSelection}
        onDelete={onDelete}
      />,
    );

    const trigger = screen.getByRole("button", { name: "More actions for Claims approval" });
    fireEvent.click(trigger);

    const move = screen.getByRole("menuitem", { name: "Move selection to this process" });
    expect(move).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Delete process" })).toBeEnabled();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onMoveSelection).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("moves focus with arrow keys and invokes the selected action once", async () => {
    const onMoveSelection = vi.fn();
    render(
      <ProcessActionsMenu
        processName="Claims approval"
        canMoveSelection
        onMoveSelection={onMoveSelection}
        onDelete={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions for Claims approval" }));
    const move = screen.getByRole("menuitem", { name: "Move selection to this process" });
    const remove = screen.getByRole("menuitem", { name: "Delete process" });
    await waitFor(() => expect(move).toHaveFocus());

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(remove).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(move).toHaveFocus();

    fireEvent.click(move);
    expect(onMoveSelection).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
