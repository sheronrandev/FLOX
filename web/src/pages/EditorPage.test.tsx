import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EditorPage } from "./EditorPage";
import { themePresets } from "../domain/app-theme";
import { AuthProvider } from "../auth/AuthContext";

describe("editor route", () => {
  it("renders its application shell without a browser-only render crash", () => {
    const markup = renderToString(
      <MemoryRouter initialEntries={["/projects/test/editor"]}>
        <AuthProvider><Routes>
          <Route path="/projects/:projectId/editor" element={<EditorPage theme={themePresets.light} />} />
        </Routes></AuthProvider>
      </MemoryRouter>,
    );
    expect(markup).toContain("Activity diagram editor");
    expect(markup).toContain("Opening project");
    expect(markup).toContain("Import JSON");
    expect(markup).toContain(">Export</span>");
  });
});
