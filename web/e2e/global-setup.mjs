import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonStore } from "../../server/src/storage/json-store.mjs";
import { createApp } from "../../server/src/app.mjs";

export default async function globalSetup() {
  const directory = await mkdtemp(path.join(tmpdir(), "activity-e2e-"));
  const webRoot = fileURLToPath(new URL("../dist/", import.meta.url));
  const store = new JsonStore(directory);
  await store.initialize();
  const api = createApp({ store, config: { secureCookies: false, sessionHours: 1, maxProjectsPerUser: 100, maxDocumentBytes: 2_000_000, defaultRevisionRetention: 20 }, logger: { info() {}, error() {} } });
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };
  const server = createServer(async (request, response) => {
    if ((request.url ?? "").startsWith("/api/")) { api.emit("request", request, response); return; }
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      const candidate = path.resolve(webRoot, pathname === "/" ? "index.html" : pathname.slice(1));
      const safeCandidate = candidate.startsWith(webRoot) ? candidate : path.join(webRoot, "index.html");
      let payload; let servedPath = safeCandidate;
      try { payload = await readFile(safeCandidate); } catch { servedPath = path.join(webRoot, "index.html"); payload = await readFile(servedPath); }
      response.writeHead(200, { "Content-Type": types[path.extname(servedPath)] ?? "application/octet-stream", "Content-Length": payload.length });
      response.end(request.method === "HEAD" ? undefined : payload);
    } catch { response.writeHead(500).end(); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(4173, "127.0.0.1", resolve); });
  return async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  };
}
