import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { JsonStore } from "../src/storage/json-store.mjs";
import { createApp } from "../src/app.mjs";
import { createBackup } from "../src/storage/backup.mjs";

const diagram = () => {
  const now = new Date().toISOString();
  return {
    format: "activity-diagram", version: 1,
    metadata: { title: "Server project", createdAt: now, updatedAt: now },
    nodes: [], edges: [], lanes: [],
    appearance: { canvasColor: "#fafafa", gridColor: "#d7dde1", controlFlowColor: "#58666d", objectFlowColor: "#58666d" },
  };
};

const diagramV2 = () => {
  const value = diagram();
  value.version = 2;
  value.lanes = [{ id: "lane", name: "Operations", width: 320, colorIndex: 0, style: { fill: "#ddeeff", stroke: "#334455", textColor: "#112233" } }];
  value.nodes = [
    { id: "object", type: "object-in-state", position: { x: 0, y: 0 }, label: "Order", state: "Approved", laneId: "lane" },
    { id: "constraint", type: "constraint", position: { x: 200, y: 0 }, label: "Limit", body: "Total < 100", laneId: "lane" },
  ];
  value.edges = [{ id: "edge", type: "object-flow", sourceNodeId: "object", sourceAnchorId: "right", targetNodeId: "constraint", targetAnchorId: "left", guardLabel: "[valid]", routing: "automatic", style: { stroke: "#087f73", width: 2, dash: "dashed" } }];
  return value;
};

const exportProcess = (id, name) => ({
  id, name, position: { x: 0, y: 0 }, lanes: [], nodes: [], edges: [],
  swimlaneLayout: { heightMode: "automatic", height: 760 },
});

const selectedProcessExport = () => {
  const now = new Date().toISOString();
  return {
    format: "activity-diagram", version: 4,
    metadata: { title: "Canvas - Claims", createdAt: now, updatedAt: now },
    processes: [exportProcess("claims-process", "Claims")],
    appearance: { canvasColor: "#fafafa", gridColor: "#d7dde1", controlFlowColor: "#58666d", objectFlowColor: "#58666d" },
  };
};

const completeProjectExport = () => {
  const selected = selectedProcessExport();
  return {
    ...selected,
    metadata: { ...selected.metadata, title: "Canvas" },
    processes: [selected.processes[0], exportProcess("approval-process", "Approval")],
  };
};

describe("self-hosted API", () => {
  let directory; let server; let base;
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "activity-server-"));
    const store = new JsonStore(directory); await store.initialize();
    server = createApp({ store, config: { secureCookies: false, sessionHours: 1, maxProjectsPerUser: 5, maxDocumentBytes: 200_000, defaultRevisionRetention: 5 }, logger: { info() {}, error() {} } });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });

  async function request(url, { cookie, csrf, ...options } = {}) {
    const response = await fetch(`${base}${url}`, { ...options, headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...(csrf ? { "x-csrf-token": csrf } : {}), ...options.headers } });
    return { response, value: response.status === 204 ? null : await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
  }
  async function register(email) {
    return request("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password: "correct horse battery staple", displayName: email.split("@")[0] }) });
  }

  it("registers securely, persists a session, and never stores the raw password", async () => {
    const readiness = await request("/api/ready");
    assert.deepEqual(readiness.value, { status: "ready", storageVersion: 2 });
    const result = await register("owner@example.com");
    assert.equal(result.response.status, 201);
    assert.match(result.cookie, /^activity_session=/);
    const session = await request("/api/auth/session", { cookie: result.cookie });
    assert.equal(session.value.user.email, "owner@example.com");
    const userFile = (await readdir(path.join(directory, "users")))[0];
    const raw = await readFile(path.join(directory, "users", userFile), "utf8");
    assert.doesNotMatch(raw, /correct horse battery staple/);
    assert.match(raw, /scrypt/);
  });

  it("requires CSRF and detects revision conflicts", async () => {
    const account = await register("owner@example.com");
    const projectId = randomUUID();
    const refused = await request(`/api/projects/${projectId}`, { method: "PUT", cookie: account.cookie, body: JSON.stringify({ document: diagram(), expectedRevision: 0 }) });
    assert.equal(refused.response.status, 403);
    const created = await request(`/api/projects/${projectId}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, body: JSON.stringify({ document: diagram(), expectedRevision: 0 }) });
    assert.equal(created.value.project.revision, 1);
    const listed = await request("/api/projects", { cookie: account.cookie });
    assert.deepEqual(listed.value.projects.map((project) => project.id), [projectId]);
    const conflict = await request(`/api/projects/${projectId}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, body: JSON.stringify({ document: diagram(), expectedRevision: 0 }) });
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.value.error.code, "revision_conflict");
  });

  it("normalizes v1/v2 projects and persists the complete v4 notation contract", async () => {
    const account = await register("notation-owner@example.com");
    const legacyId = randomUUID();
    const legacy = await request(`/api/projects/${legacyId}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, body: JSON.stringify({ document: diagram(), expectedRevision: 0 }) });
    assert.equal(legacy.value.project.document.version, 4);
    assert.deepEqual(legacy.value.project.document.processes[0].swimlaneLayout, { heightMode: "fixed", height: 760 });

    const projectId = randomUUID();
    const created = await request(`/api/projects/${projectId}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, body: JSON.stringify({ document: diagramV2(), expectedRevision: 0 }) });
    assert.equal(created.response.status, 200);
    assert.equal(created.value.project.document.version, 4);
    assert.equal(created.value.project.document.processes[0].nodes[0].state, "Approved");
    assert.equal(created.value.project.document.processes[0].edges[0].guardLabel, "[valid]");
    assert.equal(created.value.project.document.processes[0].lanes[0].style.fill, "#ddeeff");

    const invalid = diagramV2();
    invalid.nodes[0].body = "not allowed";
    const refused = await request(`/api/projects/${randomUUID()}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, body: JSON.stringify({ document: invalid, expectedRevision: 0 }) });
    assert.equal(refused.response.status, 400);
  });

  it("persists, revisions, and restores selected-process and complete-project v4 exports", async () => {
    const owner = await register("export-owner@example.com");
    const projectId = randomUUID();
    const selected = selectedProcessExport();
    const complete = completeProjectExport();

    const first = await request(`/api/projects/${projectId}`, { method: "PUT", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ document: selected, expectedRevision: 0 }) });
    assert.equal(first.value.project.revision, 1);
    assert.equal(first.value.project.document.processes.length, 1);

    const second = await request(`/api/projects/${projectId}`, { method: "PUT", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ document: complete, expectedRevision: 1 }) });
    assert.equal(second.value.project.revision, 2);
    assert.equal(second.value.project.document.processes.length, 2);

    const history = await request(`/api/projects/${projectId}/revisions`, { cookie: owner.cookie });
    assert.deepEqual(history.value.revisions.map((entry) => ({ revision: entry.revision, title: entry.title, processCount: entry.processCount })), [
      { revision: 2, title: "Canvas", processCount: 2 },
      { revision: 1, title: "Canvas - Claims", processCount: 1 },
    ]);

    const restored = await request(`/api/projects/${projectId}/revisions/1/restore`, { method: "POST", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ expectedRevision: 2 }) });
    assert.equal(restored.value.project.revision, 3);
    assert.equal(restored.value.project.document.version, 4);
    assert.equal(restored.value.project.document.metadata.title, "Canvas - Claims");
    assert.deepEqual(restored.value.project.document.processes, selected.processes);
    assert.deepEqual(restored.value.project.document.processes[0].position, { x: 0, y: 0 });

    const current = await request(`/api/projects/${projectId}`, { cookie: owner.cookie });
    assert.equal(current.value.project.revision, 3);
    assert.deepEqual(current.value.project.document, restored.value.project.document);
  });

  it("accepts the public frontend origin and rejects a different origin", async () => {
    const account = await register("origin-owner@example.com");
    const acceptedId = randomUUID();
    const publicOrigin = new URL(base).origin;
    const accepted = await request(`/api/projects/${acceptedId}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, headers: { origin: publicOrigin }, body: JSON.stringify({ document: diagram(), expectedRevision: 0 }) });
    assert.equal(accepted.response.status, 200);
    const refused = await request(`/api/projects/${randomUUID()}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, headers: { origin: "http://attacker.example" }, body: JSON.stringify({ document: diagram(), expectedRevision: 0 }) });
    assert.equal(refused.response.status, 403);
    assert.equal(refused.value.error.code, "invalid_origin");
  });

  it("rejects malformed origins and ignores malformed cookies without leaking failures", async () => {
    const anonymous = await request("/api/auth/session", { headers: { cookie: "activity_session=%E0%A4%A" } });
    assert.equal(anonymous.response.status, 200);
    assert.deepEqual(anonymous.value, { user: null, csrfToken: null });

    const account = await register("origin-validation@example.com");
    const refused = await request(`/api/projects/${randomUUID()}`, {
      method: "PUT",
      cookie: account.cookie,
      csrf: account.value.csrfToken,
      headers: { origin: "not a valid origin" },
      body: JSON.stringify({ document: diagram(), expectedRevision: 0 }),
    });
    assert.equal(refused.response.status, 403);
    assert.equal(refused.value.error.code, "invalid_origin");
  });

  it("sets defensive response headers", async () => {
    const result = await request("/api/health");
    assert.equal(result.response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(result.response.headers.get("x-frame-options"), "DENY");
    assert.equal(result.response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(result.response.headers.get("permissions-policy"), "geolocation=(), microphone=(), camera=()");
  });

  it("allows only one concurrent writer for the same expected revision", async () => {
    const account = await register("concurrent@example.com");
    const projectId = randomUUID();
    await request(`/api/projects/${projectId}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, body: JSON.stringify({ document: diagram(), expectedRevision: 0 }) });
    const first = diagram(); first.metadata.title = "Writer one";
    const second = diagram(); second.metadata.title = "Writer two";
    const results = await Promise.all([first, second].map((document) => request(`/api/projects/${projectId}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, body: JSON.stringify({ document, expectedRevision: 1 }) })));
    assert.deepEqual(results.map((result) => result.response.status).sort(), [200, 409]);
  });

  it("isolates projects by owner and rejects path-like ids", async () => {
    const owner = await register("owner@example.com");
    const outsider = await register("outsider@example.com");
    const projectId = randomUUID();
    await request(`/api/projects/${projectId}`, { method: "PUT", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ document: diagram(), expectedRevision: 0 }) });
    const hidden = await request(`/api/projects/${projectId}`, { cookie: outsider.cookie });
    assert.equal(hidden.response.status, 404);
    const unsafe = await request("/api/projects/not-a-uuid", { cookie: owner.cookie });
    assert.equal(unsafe.response.status, 400);
  });

  it("validates constrained diagram styles and leaves no temporary files", async () => {
    const account = await register("owner@example.com");
    const projectId = randomUUID();
    const unsafe = diagram(); unsafe.appearance.canvasColor = "url(https://tracker.invalid)";
    const result = await request(`/api/projects/${projectId}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, body: JSON.stringify({ document: unsafe, expectedRevision: 0 }) });
    assert.equal(result.response.status, 400);
    const files = await readdir(directory, { recursive: true });
    assert.equal(files.some((file) => file.endsWith(".tmp")), false);
  });

  it("rejects malformed, oversized, and non-JSON request bodies", async () => {
    const account = await register("hostile@example.com"); const projectId = randomUUID();
    const malformed = await fetch(`${base}/api/projects/${projectId}`, { method: "PUT", headers: { cookie: account.cookie, "x-csrf-token": account.value.csrfToken, "content-type": "application/json" }, body: "{" });
    assert.equal(malformed.status, 400);
    const wrongType = await fetch(`${base}/api/projects/${projectId}`, { method: "PUT", headers: { cookie: account.cookie, "x-csrf-token": account.value.csrfToken, "content-type": "text/plain" }, body: "hello" });
    assert.equal(wrongType.status, 415);
    const oversized = diagram(); oversized.metadata.title = "x".repeat(210_000);
    const tooLarge = await request(`/api/projects/${projectId}`, { method: "PUT", cookie: account.cookie, csrf: account.value.csrfToken, body: JSON.stringify({ document: oversized, expectedRevision: 0 }) });
    assert.equal(tooLarge.response.status, 413);
  });

  it("invalidates a session on logout", async () => {
    const account = await register("logout@example.com");
    const loggedOut = await request("/api/auth/logout", { method: "POST", cookie: account.cookie, csrf: account.value.csrfToken });
    assert.equal(loggedOut.response.status, 204);
    const session = await request("/api/auth/session", { cookie: account.cookie });
    assert.equal(session.value.user, null);
  });

  it("enforces owner, editor, and viewer project roles", async () => {
    const owner = await register("owner@example.com");
    const editor = await register("editor@example.com");
    const viewer = await register("viewer@example.com");
    const projectId = randomUUID();
    await request(`/api/projects/${projectId}`, { method: "PUT", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ document: diagram(), expectedRevision: 0 }) });
    await request(`/api/projects/${projectId}/members`, { method: "PUT", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ email: "editor@example.com", role: "editor" }) });
    await request(`/api/projects/${projectId}/members`, { method: "PUT", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ email: "viewer@example.com", role: "viewer" }) });

    const editorCopy = await request(`/api/projects/${projectId}`, { cookie: editor.cookie });
    assert.equal(editorCopy.value.project.accessRole, "editor");
    const changed = diagram(); changed.metadata.title = "Edited together";
    const edit = await request(`/api/projects/${projectId}`, { method: "PUT", cookie: editor.cookie, csrf: editor.value.csrfToken, body: JSON.stringify({ document: changed, expectedRevision: 1 }) });
    assert.equal(edit.value.project.revision, 2);
    const viewerList = await request("/api/projects", { cookie: viewer.cookie });
    assert.equal(viewerList.value.projects[0].accessRole, "viewer");
    const refused = await request(`/api/projects/${projectId}`, { method: "PUT", cookie: viewer.cookie, csrf: viewer.value.csrfToken, body: JSON.stringify({ document: changed, expectedRevision: 2 }) });
    assert.equal(refused.response.status, 403);
    assert.equal(refused.value.error.code, "viewer_read_only");
    const memberAdmin = await request(`/api/projects/${projectId}/members`, { method: "PUT", cookie: editor.cookie, csrf: editor.value.csrfToken, body: JSON.stringify({ email: "viewer@example.com", role: "editor" }) });
    assert.equal(memberAdmin.response.status, 403);
  });

  it("lists, restores, and prunes immutable revisions", async () => {
    const owner = await register("owner@example.com");
    const projectId = randomUUID();
    const original = diagram(); original.metadata.title = "Revision one";
    await request(`/api/projects/${projectId}`, { method: "PUT", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ document: original, expectedRevision: 0 }) });
    const second = diagram(); second.metadata.title = "Revision two";
    await request(`/api/projects/${projectId}`, { method: "PUT", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ document: second, expectedRevision: 1 }) });
    const history = await request(`/api/projects/${projectId}/revisions`, { cookie: owner.cookie });
    assert.deepEqual(history.value.revisions.map((entry) => entry.revision), [2, 1]);
    const restored = await request(`/api/projects/${projectId}/revisions/1/restore`, { method: "POST", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ expectedRevision: 2 }) });
    assert.equal(restored.value.project.revision, 3);
    assert.equal(restored.value.project.document.metadata.title, "Revision one");
    await request(`/api/projects/${projectId}/settings`, { method: "PUT", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ retentionLimit: 5 }) });
    for (let revision = 3; revision < 8; revision += 1) {
      const next = diagram(); next.metadata.title = `Revision ${revision + 1}`;
      await request(`/api/projects/${projectId}`, { method: "PUT", cookie: owner.cookie, csrf: owner.value.csrfToken, body: JSON.stringify({ document: next, expectedRevision: revision }) });
    }
    const retained = await request(`/api/projects/${projectId}/revisions`, { cookie: owner.cookie });
    assert.deepEqual(retained.value.revisions.map((entry) => entry.revision), [8, 7, 6, 5, 4]);
  });
});

it("migrates Phase 4 project records to storage version 2", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "activity-migration-"));
  const ownerId = randomUUID(); const projectId = randomUUID();
  try {
    await mkdir(path.join(directory, "projects", ownerId), { recursive: true });
    await writeFile(path.join(directory, "projects", ownerId, `${projectId}.json`), JSON.stringify({ id: projectId, ownerId, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), document: diagram() }));
    const store = new JsonStore(directory); await store.initialize();
    const migrated = await store.read(["projects", ownerId, `${projectId}.json`]);
    assert.deepEqual(migrated.members, []);
    assert.equal(migrated.retentionLimit, 50);
    assert.equal((await store.read(["storage.json"])).version, 2);
    assert.equal((await store.read(["revisions", ownerId, projectId, "1.json"])).revision, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it("removes interrupted atomic-write files and creates a restorable backup", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "activity-recovery-"));
  const backup = `${directory}-backup`;
  try {
    const store = new JsonStore(directory); await store.initialize();
    const stale = path.join(directory, `.project.json.${randomUUID()}.tmp`);
    await writeFile(stale, "partial");
    await store.initialize();
    await assert.rejects(access(stale));
    const manifest = await createBackup(directory, backup);
    assert.equal(manifest.storageVersion, 2);
    const restored = new JsonStore(path.join(backup, "data"));
    await restored.initialize();
    assert.equal((await restored.read(["storage.json"])).version, 2);
  } finally { await rm(directory, { recursive: true, force: true }); await rm(backup, { recursive: true, force: true }); }
});
