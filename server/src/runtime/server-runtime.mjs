import { createApp } from "../app.mjs";
import { JsonStore } from "../storage/json-store.mjs";

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

export async function startServer({ config, logger, store = new JsonStore(config.dataDirectory), createApplication = createApp }) {
  await store.initialize();
  const server = createApplication({ store, config, logger });
  await listen(server, config.port, config.host);
  const address = server.address();
  logger.info("server_started", {
    host: config.host,
    port: typeof address === "object" && address ? address.port : config.port,
    dataDirectory: config.dataDirectory,
  });

  let shutdownPromise;
  function shutdown(signal = "manual") {
    if (shutdownPromise) return shutdownPromise;
    logger.info("server_stopping", { signal });
    shutdownPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        logger.error("server_shutdown_timeout", { signal, timeoutMs: config.shutdownTimeoutMs });
        server.closeAllConnections();
      }, config.shutdownTimeoutMs);
      timeout.unref();
      server.close((error) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else {
          logger.info("server_stopped", { signal });
          resolve();
        }
      });
    });
    return shutdownPromise;
  }

  return { server, store, shutdown };
}
