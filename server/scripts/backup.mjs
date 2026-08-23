import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBackup } from "../src/storage/backup.mjs";

const serverRoot = fileURLToPath(new URL("../", import.meta.url));
const source = path.resolve(process.env.ACTIVITY_STUDIO_DATA ?? path.join(serverRoot, "data"));
const destination = process.argv[2];
if (!destination) throw new Error("Usage: npm --prefix server run backup -- <new-destination-directory>");
await createBackup(source, destination);
console.log(`Backup written to ${path.resolve(destination)}`);
