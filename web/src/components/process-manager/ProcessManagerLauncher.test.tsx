// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiagram } from "../../domain/diagram";
import { ProcessManagerLauncher } from "./ProcessManagerLauncher";

afterEach(cleanup);

describe("process manager launcher", () => {
  it("shows the process count and complete active process name", () => {
    const document = createDiagram();
    document.processes[0].name = "Supplier Registration, Compliance Review and Final Authorization";

    render(
      <ProcessManagerLauncher
        processes={document.processes}
        activeProcessId={document.processes[0].id}
        collapsed={false}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Open processes (1)" })).toBeVisible();
    expect(screen.getByText(document.processes[0].name)).toBeVisible();
  });

  it("opens from expanded and collapsed sidebars", () => {
    const onOpen = vi.fn();
    const document = createDiagram();
    const { rerender } = render(
      <ProcessManagerLauncher
        processes={document.processes}
        activeProcessId={document.processes[0].id}
        collapsed={false}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open processes (1)" }));
    rerender(
      <ProcessManagerLauncher
        processes={document.processes}
        activeProcessId={document.processes[0].id}
        collapsed
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open processes (1)" }));

    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
