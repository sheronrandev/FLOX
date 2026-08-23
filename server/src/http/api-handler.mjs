import { randomUUID } from "node:crypto";
import { HttpError } from "../lib/errors.mjs";

const SESSION_COOKIE = "activity_session";
const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function parseCookies(header = "") {
  const parsed = {};
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key || !value) continue;
    try { parsed[key] = decodeURIComponent(value); } catch { /* Ignore malformed cookies. */ }
  }
  return parsed;
}

function sessionCookie(value, secure, maxAge) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

async function readJsonBody(request, maxBytes) {
  if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json", "invalid_content_type");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "Request body is too large", "request_too_large");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw new HttpError(400, "Request body is not valid JSON", "invalid_json"); }
}

function sendJson(response, status, value, headers = {}) {
  const payload = value === undefined ? "" : JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...JSON_HEADERS,
    ...headers,
  });
  response.end(payload);
}

function assertSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  try {
    if (new URL(origin).host === request.headers.host) return;
  } catch { /* Invalid origins are rejected below. */ }
  throw new HttpError(403, "Cross-origin request refused", "invalid_origin");
}

function routeMatch(pathname, pattern) {
  return pathname.match(pattern)?.slice(1) ?? null;
}

export function createApiHandler({ auth, projects, readiness, config, logger, rateLimiter }) {
  return async function apiHandler(request, response) {
    const requestId = randomUUID();
    const startedAt = Date.now();
    response.setHeader("X-Request-Id", requestId);
    response.once("finish", () => logger.info("http_request", {
      requestId,
      method: request.method,
      path: request.url?.split("?")[0],
      status: response.statusCode,
      durationMs: Date.now() - startedAt,
    }));

    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const method = request.method ?? "GET";

      if (url.pathname === "/api/health" && method === "GET") {
        return sendJson(response, 200, { status: "ok", service: "activity-studio-api" });
      }
      if (url.pathname === "/api/ready" && method === "GET") {
        const storage = await readiness();
        const ready = storage?.version === 2;
        return sendJson(response, ready ? 200 : 503, { status: ready ? "ready" : "not_ready", storageVersion: storage?.version ?? null });
      }

      if (url.pathname === "/api/auth/register" && method === "POST") {
        rateLimiter.consume({ identity: request.socket.remoteAddress ?? "unknown", scope: "register", limit: 10 });
        const user = await auth.register(await readJsonBody(request, 32_000));
        const session = await auth.createSession(user.id);
        return sendJson(response, 201, { user, csrfToken: session.csrfToken }, {
          "Set-Cookie": sessionCookie(session.cookieValue, config.secureCookies, config.sessionHours * 3600),
        });
      }
      if (url.pathname === "/api/auth/login" && method === "POST") {
        rateLimiter.consume({ identity: request.socket.remoteAddress ?? "unknown", scope: "login", limit: 10 });
        const user = await auth.login(await readJsonBody(request, 32_000));
        const session = await auth.createSession(user.id);
        return sendJson(response, 200, { user, csrfToken: session.csrfToken }, {
          "Set-Cookie": sessionCookie(session.cookieValue, config.secureCookies, config.sessionHours * 3600),
        });
      }

      const authenticated = await auth.authenticate(parseCookies(request.headers.cookie)[SESSION_COOKIE]);
      if (url.pathname === "/api/auth/session" && method === "GET") {
        return sendJson(response, 200, authenticated
          ? { user: authenticated.user, csrfToken: authenticated.session.csrfToken }
          : { user: null, csrfToken: null });
      }
      if (!authenticated) throw new HttpError(401, "Sign in required", "unauthenticated");

      if (!["GET", "HEAD"].includes(method)) {
        assertSameOrigin(request);
        auth.verifyCsrf(authenticated.session, request.headers["x-csrf-token"]);
      }
      if (url.pathname === "/api/auth/logout" && method === "POST") {
        await auth.logout(authenticated.session.id);
        return sendJson(response, 204, undefined, { "Set-Cookie": sessionCookie("", config.secureCookies, 0) });
      }
      if (url.pathname === "/api/projects" && method === "GET") {
        return sendJson(response, 200, { projects: await projects.list(authenticated.user.id) });
      }

      const projectRoute = routeMatch(url.pathname, /^\/api\/projects\/([^/]+)$/);
      if (projectRoute && method === "GET") {
        const project = await projects.get(authenticated.user.id, projectRoute[0]);
        if (!project) throw new HttpError(404, "Project not found", "not_found");
        return sendJson(response, 200, { project });
      }
      if (projectRoute && method === "PUT") {
        const input = await readJsonBody(request, config.maxDocumentBytes + 100_000);
        const project = await projects.put(authenticated.user.id, projectRoute[0], input.document, input.expectedRevision);
        return sendJson(response, 200, { project });
      }
      if (projectRoute && method === "DELETE") {
        await projects.delete(authenticated.user.id, projectRoute[0], Number(url.searchParams.get("revision")));
        return sendJson(response, 204);
      }

      const membersRoute = routeMatch(url.pathname, /^\/api\/projects\/([^/]+)\/members$/);
      if (membersRoute && method === "GET") {
        const membership = await projects.members(authenticated.user.id, membersRoute[0]);
        const users = await auth.publicUsers([membership.ownerId, ...membership.members.map((member) => member.userId)]);
        const byId = new Map(users.map((user) => [user.id, user]));
        return sendJson(response, 200, { accessRole: membership.accessRole, members: [
          { ...byId.get(membership.ownerId), role: "owner" },
          ...membership.members.map((member) => ({ ...byId.get(member.userId), role: member.role, addedAt: member.addedAt })),
        ] });
      }
      if (membersRoute && method === "PUT") {
        const input = await readJsonBody(request, 32_000);
        const target = await auth.findPublicUserByEmail(input.email);
        if (!target) throw new HttpError(404, "No account uses that email address", "user_not_found");
        await projects.addMember(authenticated.user.id, membersRoute[0], target.id, input.role);
        return sendJson(response, 200, { member: { ...target, role: input.role } });
      }

      const memberRoute = routeMatch(url.pathname, /^\/api\/projects\/([^/]+)\/members\/([^/]+)$/);
      if (memberRoute && method === "DELETE") {
        await projects.removeMember(authenticated.user.id, memberRoute[0], memberRoute[1]);
        return sendJson(response, 204);
      }

      const revisionsRoute = routeMatch(url.pathname, /^\/api\/projects\/([^/]+)\/revisions$/);
      if (revisionsRoute && method === "GET") {
        const revisions = await projects.revisions(authenticated.user.id, revisionsRoute[0]);
        const users = await auth.publicUsers(revisions.map((revision) => revision.actorId));
        const byId = new Map(users.map((user) => [user.id, user]));
        return sendJson(response, 200, { revisions: revisions.map((revision) => ({
          ...revision,
          actor: byId.get(revision.actorId) ?? null,
        })) });
      }

      const restoreRoute = routeMatch(url.pathname, /^\/api\/projects\/([^/]+)\/revisions\/(\d+)\/restore$/);
      if (restoreRoute && method === "POST") {
        const input = await readJsonBody(request, 32_000);
        const project = await projects.restore(authenticated.user.id, restoreRoute[0], Number(restoreRoute[1]), input.expectedRevision);
        return sendJson(response, 200, { project });
      }

      const settingsRoute = routeMatch(url.pathname, /^\/api\/projects\/([^/]+)\/settings$/);
      if (settingsRoute && method === "PUT") {
        const input = await readJsonBody(request, 32_000);
        const project = await projects.setRetention(authenticated.user.id, settingsRoute[0], input.retentionLimit);
        return sendJson(response, 200, { project });
      }
      throw new HttpError(404, "API route not found", "not_found");
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) logger.error("request_failure", {
        requestId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return sendJson(response, status, { error: {
        code: error instanceof HttpError ? error.code : "internal_error",
        message: status === 500 ? "Internal server error" : error.message,
        details: error instanceof HttpError ? error.details : undefined,
      } });
    }
  };
}
