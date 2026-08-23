import { describe, expect, it } from "vitest";
import { clearFindings, markAllRead, reconcileNotificationState, restoreCleared, type NotificationState } from "./notification-state";

const base: NotificationState = { readIds: [], dismissedIds: [], activeIds: [] };

describe("persisted validation notification state", () => {
  it("marks active findings read without dismissing them", () => {
    expect(markAllRead(base, ["a", "b"])).toEqual({ readIds: ["a", "b"], dismissedIds: [], activeIds: ["a", "b"] });
  });

  it("clears and restores current findings", () => {
    const cleared = clearFindings(base, ["a", "b"]);
    expect(cleared.dismissedIds).toEqual(["a", "b"]);
    expect(restoreCleared(cleared).dismissedIds).toEqual([]);
  });

  it("forgets resolved IDs so reintroduced problems notify again", () => {
    const previous = { readIds: ["a", "gone"], dismissedIds: ["b", "gone"], activeIds: ["a", "b", "gone"] };
    const resolved = reconcileNotificationState(previous, ["a", "b"]);
    expect(resolved).toEqual({ readIds: ["a"], dismissedIds: ["b"], activeIds: ["a", "b"] });
    const absent = reconcileNotificationState(resolved, []);
    expect(reconcileNotificationState(absent, ["a"])).toEqual({ readIds: [], dismissedIds: [], activeIds: ["a"] });
  });
});
