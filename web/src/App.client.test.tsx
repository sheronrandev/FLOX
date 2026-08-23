// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { useDiagramStore } from "./store/diagram-store";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("client routing", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;
    window.history.replaceState({}, "", "/projects/client-test/editor");
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    window.localStorage.clear();
  });

  it("opens the editor route without a React Flow selection feedback loop", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<BrowserRouter><App /></BrowserRouter>);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(container.textContent).toContain("Components");
    expect(container.textContent).toMatch(/Saving locally|Saved locally/);
    expect(container.querySelector<HTMLElement>(".process-title-node")?.style.color).toBe("rgb(0, 0, 0)");
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Open settings"]')?.click());
    const projectTab = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Project");
    expect(projectTab).toBeTruthy();
    const appearanceTab = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Appearance");
    expect(appearanceTab).toBeTruthy();
    await act(async () => appearanceTab?.click());
    expect(container.querySelector('[role="radio"][aria-checked="true"]')).toBeTruthy();
    await act(async () => projectTab?.click());
    const fontSize = container.querySelector<HTMLSelectElement>('select[aria-label="Default diagram font size"]');
    const innerPadding = container.querySelector<HTMLSelectElement>('select[aria-label="Default node inner padding"]');
    expect(fontSize).toBeTruthy();
    expect(innerPadding).toBeTruthy();
    expect(fontSize?.querySelector('option[value="12"]')?.textContent).toBe("12 px (Default)");
    expect(innerPadding?.querySelector('option[value="12"]')?.textContent).toBe("12 px (Default)");
    await act(async () => {
      if (!fontSize) return;
      fontSize.value = "16";
      fontSize.dispatchEvent(new Event("change", { bubbles: true }));
      if (innerPadding) {
        innerPadding.value = "4";
        innerPadding.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(useDiagramStore.getState().document.appearance.nodeFontSize).toBe(16);
    expect(useDiagramStore.getState().document.appearance.nodeInnerPadding).toBe(4);
    expect(container.textContent).toContain("Application interface text is unchanged.");
    const resetDefaults = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Reset to defaults");
    expect(resetDefaults?.disabled).toBe(false);
    await act(async () => resetDefaults?.click());
    expect(useDiagramStore.getState().document.appearance).toMatchObject({ nodeFontSize: 12, nodeInnerPadding: 12 });
    expect(resetDefaults?.disabled).toBe(true);
    await act(async () => root.unmount());
  });
});
