import { loadConfig } from "./config.mjs";
import { logger } from "./lib/logger.mjs";
import { startServer } from "./runtime/server-runtime.mjs";

const runtime = await startServer({ config: loadConfig(), logger });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    runtime.shutdown(signal).catch((error) => {
      logger.error("server_shutdown_failure", { signal, message: error.message });
      process.exitCode = 1;
    });
  });
}
