// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanePropertiesForm } from "./LanePropertiesForm";

describe("lane properties form", () => {
  afterEach(cleanup);
  it("stages values until Save and Cancel leaves the document callback untouched", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const onDirtyChange = vi.fn();
    render(<LanePropertiesForm
      lane={{ id: "lane", name: "Agent", width: 320, colorIndex: 0, style: { fill: "#ddeeff" } }}
      layout={{ heightMode: "automatic", height: 760 }}
      onSave={onSave}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
    />);
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Reviewer" } });
    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "440" } });
    expect(onSave).not.toHaveBeenCalled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("reveals fixed height and submits one complete settings packet", () => {
    const onSave = vi.fn();
    render(<LanePropertiesForm
      lane={{ id: "lane", name: "Agent", width: 320, colorIndex: 0 }}
      layout={{ heightMode: "automatic", height: 760 }}
      onSave={onSave}
      onCancel={() => undefined}
      onDirtyChange={() => undefined}
    />);
    fireEvent.change(screen.getByLabelText("Height mode"), { target: { value: "fixed" } });
    fireEvent.change(screen.getByLabelText("Height"), { target: { value: "980" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: "Agent", fill: "#ffffff", width: 320,
      heightMode: "fixed", height: 980,
    }));
  });
});
