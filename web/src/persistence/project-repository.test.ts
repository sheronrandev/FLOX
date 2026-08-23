import { describe, expect, it } from "vitest";
import { createDiagram } from "../domain/diagram";
import { createAnonymousRepository, createLocalStorageRepository, createNamespacedRepository, recordFor, type KeyValueStorage } from "./project-repository";

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("local project repository", () => {
  it("stores, lists, and reopens a JSON project", async () => {
    const repository = createLocalStorageRepository(memoryStorage());
    const document = createDiagram("Claims process");
    await repository.put(recordFor("project-1", document));
    expect(await repository.list()).toMatchObject([{ id: "project-1", title: "Claims process" }]);
    expect((await repository.get("project-1"))?.document).toEqual(document);
  });

  it("deletes only the selected project", async () => {
    const repository = createLocalStorageRepository(memoryStorage());
    await repository.put(recordFor("one", createDiagram("One")));
    await repository.put(recordFor("two", createDiagram("Two")));
    await repository.delete("one");
    expect((await repository.list()).map((project) => project.id)).toEqual(["two"]);
  });

  it("isolates per-account browser caches", async () => {
    const base = createLocalStorageRepository(memoryStorage());
    const first = createNamespacedRepository(base, "user-one");
    const second = createNamespacedRepository(base, "user-two");
    await first.put(recordFor("shared-id", createDiagram("First")));
    await second.put(recordFor("shared-id", createDiagram("Second")));
    expect((await first.get("shared-id"))?.title).toBe("First");
    expect((await second.get("shared-id"))?.title).toBe("Second");
    expect(await base.list()).toHaveLength(2);
  });

  it("never exposes account caches in the anonymous workspace", async () => {
    const base = createLocalStorageRepository(memoryStorage());
    const anonymous = createAnonymousRepository(base);
    const account = createNamespacedRepository(base, "user-one");
    await anonymous.put(recordFor("local-project", createDiagram("Local")));
    await account.put(recordFor("account-project", createDiagram("Account")));
    expect((await anonymous.list()).map((project) => project.id)).toEqual(["local-project"]);
    expect((await account.list()).map((project) => project.id)).toEqual(["account-project"]);
  });
});
