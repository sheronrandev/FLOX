import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { runStorageMigrations } from "./migrations.mjs";

export class JsonStore {
  #locks = new Map();
  constructor(root) { this.root = path.resolve(root); }

  async initialize() {
    await Promise.all(["users", "sessions", "projects", "memberships", "revisions"].map((name) => mkdir(path.join(this.root, name), { recursive: true })));
    await this.writeIfMissing(["accounts.json"], { byEmail: {} });
    await runStorageMigrations(this);
    const invalid = []; const staleTemporaryFiles = [];
    await this.#scan(this.root, invalid, staleTemporaryFiles);
    if (invalid.length) throw new Error(`Storage integrity check failed: ${invalid.join(", ")}`);
    await Promise.all(staleTemporaryFiles.map((target) => rm(target, { force: true })));
  }

  resolve(segments) {
    const target = path.resolve(this.root, ...segments);
    if (target !== this.root && !target.startsWith(`${this.root}${path.sep}`)) throw new Error("Unsafe storage path");
    return target;
  }

  async read(segments, fallback = null) {
    try { return JSON.parse(await readFile(this.resolve(segments), "utf8")); }
    catch (error) { if (error?.code === "ENOENT") return fallback; throw error; }
  }

  async write(segments, value) {
    const target = this.resolve(segments);
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, target);
  }

  async writeIfMissing(segments, value) {
    const missing = {};
    if (await this.read(segments, missing) === missing) await this.write(segments, value);
  }

  async remove(segments) { await rm(this.resolve(segments), { force: true }); }

  async list(segments) {
    try { return (await readdir(this.resolve(segments))).filter((name) => name.endsWith(".json")); }
    catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  }

  async directories(segments) {
    try { return (await readdir(this.resolve(segments), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name); }
    catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  }

  async locked(key, operation) {
    const previous = this.#locks.get(key) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => current);
    this.#locks.set(key, tail);
    await previous;
    try { return await operation(); }
    finally { release(); if (this.#locks.get(key) === tail) this.#locks.delete(key); }
  }

  async #scan(directory, invalid, staleTemporaryFiles) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await this.#scan(target, invalid, staleTemporaryFiles);
      else if (entry.name.endsWith(".json")) {
        try { JSON.parse(await readFile(target, "utf8")); } catch { invalid.push(path.relative(this.root, target)); }
      } else if (/^\..+\.[0-9a-f-]{36}\.tmp$/i.test(entry.name)) staleTemporaryFiles.push(target);
    }
  }
}
