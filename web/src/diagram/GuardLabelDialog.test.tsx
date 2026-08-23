// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuardLabelDialog } from "./GuardLabelDialog";

describe("decision flow guard dialog", () => {
  beforeEach(() => {
    window.requestAnimationFrame = (callback) => { callback(0); return 1; };
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(cleanup);

  it("stays open until a non-empty guard label is submitted", async () => {
    const onSubmit = vi.fn();
    render(<GuardLabelDialog onSubmit={onSubmit} />);

    const dialog = screen.getByRole("dialog", { name: "Guard label required" });
    const input = screen.getByRole("textbox", { name: "Guard label" });
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a guard label before creating the flow.");
    expect(dialog).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialog).toBeVisible();

    fireEvent.change(input, { target: { value: " [approved] " } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("[approved]");
  });
});
