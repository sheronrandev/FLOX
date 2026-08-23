import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultDataDirectory = fileURLToPath(new URL("../data", import.meta.url));

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export function loadConfig(environment = process.env) {
  return {
    port: boundedInteger(environment.PORT, 4174, 1, 65_535),
    host: environment.HOST ?? "127.0.0.1",
    dataDirectory: path.resolve(environment.ACTIVITY_STUDIO_DATA ?? defaultDataDirectory),
    secureCookies: environment.COOKIE_SECURE === undefined ? environment.NODE_ENV === "production" : environment.COOKIE_SECURE === "true",
    sessionHours: boundedInteger(environment.SESSION_HOURS, 168, 1, 720),
    maxProjectsPerUser: boundedInteger(environment.MAX_PROJECTS_PER_USER, 100, 1, 1000),
    maxDocumentBytes: boundedInteger(environment.MAX_DOCUMENT_BYTES, 2_000_000, 100_000, 10_000_000),
    defaultRevisionRetention: boundedInteger(environment.REVISION_RETENTION, 50, 5, 200),
    shutdownTimeoutMs: boundedInteger(environment.SHUTDOWN_TIMEOUT_MS, 10_000, 1_000, 60_000),
  };
}
