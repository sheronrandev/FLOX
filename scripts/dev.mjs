import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const webDirectory = fileURLToPath(new URL("../web/", import.meta.url));
const viteEntry = fileURLToPath(new URL("../web/node_modules/vite/bin/vite.js", import.meta.url));
const children = [
  spawn(process.execPath, ["server/src/index.mjs"], { stdio: "inherit" }),
  spawn(process.execPath, [viteEntry, "--configLoader", "runner"], { cwd: webDirectory, stdio: "inherit" }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 150).unref();
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping) stop(signal ? 1 : (code ?? 0));
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
