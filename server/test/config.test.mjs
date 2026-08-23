import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.mjs";

describe("server configuration", () => {
  it("accepts bounded integers", () => {
    const config = loadConfig({
      PORT: "8080",
      SESSION_HOURS: "24",
      MAX_PROJECTS_PER_USER: "250",
      MAX_DOCUMENT_BYTES: "500000",
      REVISION_RETENTION: "80",
      SHUTDOWN_TIMEOUT_MS: "5000",
    });

    assert.deepEqual(
      {
        port: config.port,
        sessionHours: config.sessionHours,
        maxProjectsPerUser: config.maxProjectsPerUser,
        maxDocumentBytes: config.maxDocumentBytes,
        defaultRevisionRetention: config.defaultRevisionRetention,
        shutdownTimeoutMs: config.shutdownTimeoutMs,
      },
      {
        port: 8080,
        sessionHours: 24,
        maxProjectsPerUser: 250,
        maxDocumentBytes: 500_000,
        defaultRevisionRetention: 80,
        shutdownTimeoutMs: 5_000,
      },
    );
  });

  it("uses safe defaults for malformed or out-of-range integers", () => {
    const config = loadConfig({
      PORT: "not-a-port",
      SESSION_HOURS: "0",
      MAX_PROJECTS_PER_USER: "Infinity",
      MAX_DOCUMENT_BYTES: "99999",
      REVISION_RETENTION: "12.5",
      SHUTDOWN_TIMEOUT_MS: "999999",
    });

    assert.equal(config.port, 4174);
    assert.equal(config.sessionHours, 168);
    assert.equal(config.maxProjectsPerUser, 100);
    assert.equal(config.maxDocumentBytes, 2_000_000);
    assert.equal(config.defaultRevisionRetention, 50);
    assert.equal(config.shutdownTimeoutMs, 10_000);
  });
});
