import { createServer } from "node:http";
import { createApiHandler } from "./http/api-handler.mjs";
import { InMemoryRateLimiter } from "./http/rate-limiter.mjs";
import { logger as defaultLogger } from "./lib/logger.mjs";
import { AuthService } from "./services/auth-service.mjs";
import { ProjectService } from "./services/project-service.mjs";

export function createApp({
  store,
  config,
  logger = defaultLogger,
  auth = new AuthService(store, config),
  projects = new ProjectService(store, config),
  readiness = () => store.read(["storage.json"]),
  rateLimiter = new InMemoryRateLimiter(),
}) {
  return createServer(createApiHandler({ auth, projects, readiness, config, logger, rateLimiter }));
}
