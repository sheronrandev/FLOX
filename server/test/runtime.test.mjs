import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { startServer } from "../src/runtime/server-runtime.mjs";

it("starts a ready server and shuts it down idempotently", async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "activity-runtime-"));
  let runtime;
  const events = [];
  const logger = {
    info(event, fields) { events.push({ event, fields }); },
    error(event, fields) { events.push({ event, fields }); },
  };

  try {
    runtime = await startServer({
      config: {
        port: 0,
        host: "127.0.0.1",
        dataDirectory,
        secureCookies: false,
        sessionHours: 1,
        maxProjectsPerUser: 5,
        maxDocumentBytes: 200_000,
        defaultRevisionRetention: 5,
        shutdownTimeoutMs: 1_000,
      },
      logger,
    });
    const address = runtime.server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/ready`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ready", storageVersion: 2 });
    assert.equal(runtime.shutdown("test"), runtime.shutdown("test"));
    await runtime.shutdown("test");
    assert.deepEqual(events.map(({ event }) => event), ["server_started", "http_request", "server_stopping", "server_stopped"]);
  } finally {
    await runtime?.shutdown("test-cleanup");
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
