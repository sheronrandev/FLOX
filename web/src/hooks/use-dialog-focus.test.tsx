// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogFocus } from "./use-dialog-focus";

function DialogHarness({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, onClose);
  return <section ref={dialogRef} role="dialog" tabIndex={-1}><button>Close</button></section>;
}

function FocusHarness() {
  const dialogRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useDialogFocus(dialogRef, () => undefined, searchRef);
  return <section ref={dialogRef}><button type="button">Close</button><input ref={searchRef} aria-label="Find a process" /></section>;
}

describe("useDialogFocus", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.requestAnimationFrame = (callback) => { callback(0); return 1; };
    window.cancelAnimationFrame = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => container.remove());

  it("focuses the first control initially and closes on Escape", async () => {
    const onClose = vi.fn();
    const root = createRoot(container);
    await act(async () => root.render(<DialogHarness onClose={onClose} />));

    expect(document.activeElement).toBe(container.querySelector("button"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });

  it("honors an explicit initial focus target", async () => {
    const root = createRoot(container);
    await act(async () => root.render(<FocusHarness />));

    expect(document.activeElement).toBe(container.querySelector('[aria-label="Find a process"]'));

    await act(async () => root.unmount());
  });
});
