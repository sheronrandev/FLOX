import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function createBackup(sourceValue, destinationValue) {
  const source = path.resolve(sourceValue); const destination = path.resolve(destinationValue);
  if (destination === source || source.startsWith(`${destination}${path.sep}`) || destination.startsWith(`${source}${path.sep}`)) throw new Error("Backup destination must be separate from the live data directory");
  const storage = JSON.parse(await readFile(path.join(source, "storage.json"), "utf8"));
  await mkdir(destination, { recursive: false });
  await cp(source, path.join(destination, "data"), { recursive: true, errorOnExist: true });
  const manifest = { createdAt: new Date().toISOString(), storageVersion: storage.version };
  await writeFile(path.join(destination, "backup-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return manifest;
}
