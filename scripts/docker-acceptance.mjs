import { spawnSync } from "node:child_process";

function run(args, allowFailure = false) {
  const result = spawnSync("docker", args, { cwd: new URL("../", import.meta.url), encoding: "utf8", shell: process.platform === "win32" });
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || result.stdout || `docker ${args.join(" ")} failed`);
  return result;
}

const available = run(["version"], true);
if (available.status !== 0) {
  console.log("SKIP Docker acceptance: Docker is not installed or not running.");
  process.exit(0);
}

try {
  run(["compose", "config", "--quiet"]);
  run(["compose", "build"]);
  run(["compose", "up", "-d", "--wait"]);
  const response = await fetch("http://127.0.0.1:8080/api/ready");
  if (!response.ok) throw new Error(`Docker readiness returned ${response.status}`);
  console.log("Docker fresh-install acceptance passed.");
} finally {
  run(["compose", "down"], true);
}
