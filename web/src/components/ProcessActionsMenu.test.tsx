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
        onEdit={() => undefined}
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
    const onEdit = vi.fn();
    const onMoveSelection = vi.fn();
    render(
      <ProcessActionsMenu
        processName="Claims approval"
        canMoveSelection
        onEdit={onEdit}
        onMoveSelection={onMoveSelection}
        onDelete={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions for Claims approval" }));
    const settings = screen.getByRole("menuitem", { name: "Process settings" });
    const move = screen.getByRole("menuitem", { name: "Move selection to this process" });
    await waitFor(() => expect(settings).toHaveFocus());

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(move).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(settings).toHaveFocus();

    fireEvent.click(settings);
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onMoveSelection).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "More actions for Claims approval" })).toHaveFocus());
  });

  it("closes when focus tabs away and restores focus after a non-destructive action", async () => {
    const onDelete = vi.fn();
    render(<>
      <ProcessActionsMenu
        processName="Claims approval"
        canMoveSelection
        onEdit={() => undefined}
        onMoveSelection={() => undefined}
        onDelete={onDelete}
      />
      <button type="button">Outside control</button>
    </>);

    const trigger = screen.getByRole("button", { name: "More actions for Claims approval" });
    const outside = screen.getByRole("button", { name: "Outside control" });
    fireEvent.click(trigger);
    const settings = screen.getByRole("menuitem", { name: "Process settings" });
    await waitFor(() => expect(settings).toHaveFocus());
    fireEvent.blur(settings, { relatedTarget: outside });
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
        onEdit={() => undefined}
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
