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
    await waitFor(() => expect(screen.getByRole("button", { name: "More actions for Claims approval" })).toHaveFocus());
  });

  it("closes when focus tabs away and restores focus after a non-destructive action", async () => {
    const onDelete = vi.fn();
    render(<>
      <ProcessActionsMenu
        processName="Claims approval"
        canMoveSelection
        onMoveSelection={() => undefined}
        onDelete={onDelete}
      />
      <button type="button">Outside control</button>
    </>);

    const trigger = screen.getByRole("button", { name: "More actions for Claims approval" });
    const outside = screen.getByRole("button", { name: "Outside control" });
    fireEvent.click(trigger);
    const move = screen.getByRole("menuitem", { name: "Move selection to this process" });
    await waitFor(() => expect(move).toHaveFocus());
    fireEvent.blur(move, { relatedTarget: outside });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const remove = screen.getByRole("menuitem", { name: "Delete process" });
    fireEvent.click(remove);
    expect(onDelete).toHaveBeenCalledOnce();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes on reverse tab without overriding the browser focus move", async () => {
    render(
      <ProcessActionsMenu
        processName="Claims approval"
        canMoveSelection
        onMoveSelection={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions for Claims approval" }));
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "Tab", shiftKey: true });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
